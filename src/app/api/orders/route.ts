import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import TicketSplitter from '@/lib/printer/ticket-splitter';
import haService from '@/lib/ha/ha-service';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tableId = searchParams.get('tableId');
    const status = searchParams.get('status');
    const isKds = searchParams.get('kds') === 'true';

    const where: any = {};
    if (tableId) where.tableId = tableId;
    if (status) where.status = status;

    if (isKds) {
      // Kitchen Monitor needs active orders with open food/drinks
      where.status = { in: ['OPEN', 'IN_PREPARATION', 'READY'] };
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        table: true,
        items: {
          include: {
            product: {
              include: {
                printGroup: {
                  include: { printer: true },
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json(orders);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Body: { tableId, waiterName, deviceId, orderType, items: [{ productId, quantity, variantName, selectedOptions, customizationText }] }
    
    // 1. Get Event config for sequence and training mode
    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    const isTraining = config?.trainingMode ?? false;

    let tokenNumber: number | null = null;
    let nextOrderNum = (config?.orderSequence || 1);

    if (body.orderType === 'COUNTER_VOUCHER' || body.orderType === 'COUNTER_DIRECT') {
      tokenNumber = config?.tokenSequence || 100;
      await prisma.eventConfig.update({
        where: { id: 'default' },
        data: {
          tokenSequence: { increment: 1 },
          orderSequence: { increment: 1 },
        },
      });
    } else {
      await prisma.eventConfig.update({
        where: { id: 'default' },
        data: {
          orderSequence: { increment: 1 },
        },
      });
    }

    // 2. Fetch product details
    const productIds = body.items.map((i: any) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { stockItem: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Check stock limits & compute item prices
    const orderItemsData = [];
    for (const item of body.items) {
      const prod = productMap.get(item.productId);
      if (!prod) continue;

      // Check stock
      if (prod.stockItem && prod.stockItem.currentQuantity < item.quantity) {
        return NextResponse.json(
          { error: `Artikel "${prod.name}" ist leider ausverkauft oder nicht in ausreichender Menge verfügbar!` },
          { status: 400 }
        );
      }

      let unitPrice = prod.price;
      // Add variant price delta
      if (item.variantName) {
        const variant = await prisma.productVariant.findFirst({
          where: { productId: prod.id, name: item.variantName },
        });
        if (variant) unitPrice += variant.priceDelta;
      }

      // Add options price delta
      if (item.selectedOptions && Array.isArray(item.selectedOptions)) {
        for (const optName of item.selectedOptions) {
          const opt = await prisma.productOption.findFirst({
            where: { productId: prod.id, name: optName },
          });
          if (opt) unitPrice += opt.priceDelta;
        }
      }

      orderItemsData.push({
        productId: prod.id,
        productName: prod.name,
        quantity: item.quantity,
        unitPrice,
        deposit: prod.deposit || 0,
        taxRate: prod.taxRate || 19,
        variantName: item.variantName || null,
        selectedOptions: item.selectedOptions ? JSON.stringify(item.selectedOptions) : null,
        customizationText: item.customizationText || null,
        printStatus: 'PENDING',
        kdsStatus: 'PENDING',
      });

      // Decrement stock in live DB
      if (prod.stockItem && !isTraining) {
        const newQty = Math.max(0, prod.stockItem.currentQuantity - item.quantity);
        await prisma.stockItem.update({
          where: { id: prod.stockItem.id },
          data: { currentQuantity: newQty },
        });

        if (newQty === 0 && prod.stockItem.isAutoDeactivate) {
          await prisma.product.update({
            where: { id: prod.id },
            data: { status: 'INACTIVE' },
          });
        }
      }
    }

    // 3. Create Order in DB
    const table = body.tableId ? await prisma.diningTable.findUnique({ where: { id: body.tableId } }) : null;

    const order = await prisma.order.create({
      data: {
        orderNumber: nextOrderNum,
        tableId: body.tableId || null,
        waiterName: body.waiterName || 'Bedienung',
        deviceId: body.deviceId || null,
        status: 'OPEN',
        orderType: body.orderType || 'TABLE',
        tokenNumber,
        isTraining,
        items: {
          create: orderItemsData,
        },
      },
      include: {
        table: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Update table status to occupied
    if (table) {
      await prisma.diningTable.update({
        where: { id: table.id },
        data: {
          status: 'OCCUPIED',
          activeWaiterName: body.waiterName || table.activeWaiterName,
        },
      });
    }

    // 4. Trigger Ticket Routing & ESC/POS Printing
    try {
      await TicketSplitter.routeAndPrintOrder({
        id: order.id,
        orderNumber: order.orderNumber,
        tableLabel: table?.label || (tokenNumber ? `Abholmarke #${tokenNumber}` : 'Theke'),
        waiterName: order.waiterName,
        tokenNumber: order.tokenNumber,
        isTraining: order.isTraining,
        createdAt: order.createdAt,
        items: order.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.productName,
          alternativeName: i.product.alternativeTicketName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          deposit: i.deposit,
          variantName: i.variantName,
          selectedOptions: i.selectedOptions,
          customizationText: i.customizationText,
        })),
      });

      // Mark order items as printed
      await prisma.orderItem.updateMany({
        where: { orderId: order.id },
        data: { printStatus: 'PRINTED' },
      });
    } catch (printErr) {
      console.error('Error during ticket print spooling:', printErr);
    }

    // 5. Log to SyncJournal for High Availability
    await haService.logMutation('ORDER', order.id, 'INSERT', order);

    // 6. Broadcast Realtime WebSocket Events
    if (global.io) {
      global.io.emit('order:new', order);
      global.io.emit('table:updated', { tableId: body.tableId, status: 'OCCUPIED' });
    }

    return NextResponse.json(order);
  } catch (error: any) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
