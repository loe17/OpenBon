import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import TicketSplitter from '@/lib/printer/ticket-splitter';
import haService from '@/lib/ha/ha-service';
import { getEffectiveProductPrice } from '@/lib/pricing';
import { checkAndTriggerLowStockAlert } from '@/lib/low-stock-notifier';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tableId = searchParams.get('tableId');
    const status = searchParams.get('status');
    const isKds = searchParams.get('kds') === 'true';

    const where: Record<string, unknown> = {};
    if (tableId) where.tableId = tableId;
    if (status) where.status = status;

    if (isKds) {
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
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const idempotencyKey = req.headers.get('x-idempotency-key') || body.idempotencyKey;

    // 0. Idempotenz-Prüfung gegen doppelte Bestellungen bei Netzwerkabbrüchen
    if (idempotencyKey) {
      const existing = await prisma.idempotencyKey.findUnique({
        where: { key: String(idempotencyKey) },
      });
      if (existing) {
        return NextResponse.json(JSON.parse(existing.responseJson), {
          status: existing.statusCode,
          headers: { 'X-Idempotent-Replay': 'true' },
        });
      }
    }

    const normalizedOrderType =
      body.orderType === 'DIRECT_SALE'
        ? 'COUNTER_DIRECT'
        : body.orderType === 'VOUCHER'
        ? 'COUNTER_VOUCHER'
        : body.orderType || 'TABLE';

    const isCounterOrKiosk =
      normalizedOrderType === 'COUNTER_VOUCHER' ||
      normalizedOrderType === 'COUNTER_DIRECT' ||
      normalizedOrderType === 'KIOSK';

    const now = new Date();

    // 1. Produkte laden (Preise, Varianten, Optionen, StockItem)
    const productIds = ((body.items || []) as { productId: string }[]).map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        stockItem: true,
        variants: true,
        options: true,
      },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    // 2. Transaktionale Ausführung (Sequenzen, Bestandsabzug, Order, Table)
    const result = await prisma.$transaction(async (tx) => {
      // EventConfig laden & Sequenzen atomar hochzählen
      const config = await tx.eventConfig.findUnique({ where: { id: 'default' } });
      const isTraining = config?.trainingMode ?? false;

      let tokenNumber: number | null = null;
      let nextOrderNum = config?.orderSequence || 1;

      if (isCounterOrKiosk) {
        tokenNumber = config?.tokenSequence || 100;
        await tx.eventConfig.update({
          where: { id: 'default' },
          data: {
            tokenSequence: { increment: 1 },
            orderSequence: { increment: 1 },
          },
        });
      } else {
        await tx.eventConfig.update({
          where: { id: 'default' },
          data: {
            orderSequence: { increment: 1 },
          },
        });
      }

      // Bestände prüfen & OrderItems vorbereiten
      const orderItemsData = [];
      for (const item of body.items || []) {
        const prod = productMap.get(item.productId);
        if (!prod) continue;

        // Bestand prüfen
        if (prod.stockItem && prod.stockItem.currentQuantity < item.quantity) {
          throw new Error(`Artikel "${prod.name}" ist leider ausverkauft oder nicht mehr ausreichend verfügbar!`);
        }

        const { price: effectiveBasePrice } = getEffectiveProductPrice(prod, now);
        let unitPrice = effectiveBasePrice;

        if (item.variantName) {
          const variant = prod.variants.find((v) => v.name === item.variantName);
          if (variant) unitPrice += variant.priceDelta;
        }

        if (item.selectedOptions && Array.isArray(item.selectedOptions)) {
          for (const optName of item.selectedOptions) {
            const opt = prod.options.find((o) => o.name === optName);
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
          selectedOptions: item.selectedOptions
            ? typeof item.selectedOptions === 'string'
              ? item.selectedOptions
              : JSON.stringify(item.selectedOptions)
            : null,
          customizationText: item.customizationText || null,
          courseNumber: Number(item.courseNumber) > 0 ? Number(item.courseNumber) : 1,
          isHold: Boolean(item.isHold),
          printStatus: item.isHold ? 'HELD' : 'PENDING',
          kdsStatus: 'PENDING',
        });

        // Einmaliger, sauberer Bestandsabzug auf StockItem
        if (prod.stockItem && !isTraining) {
          const newQty = Math.max(0, prod.stockItem.currentQuantity - item.quantity);
          await tx.stockItem.update({
            where: { id: prod.stockItem.id },
            data: { currentQuantity: newQty },
          });

          if (newQty === 0 && prod.stockItem.isAutoDeactivate) {
            await tx.product.update({
              where: { id: prod.id },
              data: { status: 'INACTIVE', isSoldOut: true },
            });
          }
        }
      }

      // Order anlegen
      const createdOrder = await tx.order.create({
        data: {
          orderNumber: nextOrderNum,
          tableId: body.tableId || null,
          waiterId: body.waiterId || null,
          waiterName: body.waiterName || 'Bedienung',
          deviceId: body.deviceId || null,
          source: body.source || 'WAITER',
          status: 'OPEN',
          orderType: normalizedOrderType,
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

      // Tisch auf OCCUPIED setzen
      if (body.tableId) {
        await tx.diningTable.update({
          where: { id: body.tableId },
          data: {
            status: 'OCCUPIED',
            activeWaiterName: body.waiterName || undefined,
          },
        });
      }

      // Idempotenz-Eintrag speichern
      if (idempotencyKey) {
        await tx.idempotencyKey.create({
          data: {
            key: String(idempotencyKey),
            endpoint: '/api/orders',
            statusCode: 200,
            responseJson: JSON.stringify(createdOrder),
          },
        });
      }

      return { order: createdOrder, tokenNumber };
    });

    const { order, tokenNumber } = result;

    // 3. Low-Stock Alerts prüfen
    for (const item of order.items) {
      if (item.product.trackStock) {
        const stock = await prisma.stockItem.findUnique({ where: { productId: item.productId } });
        if (stock) {
          await checkAndTriggerLowStockAlert(item.productId, stock.currentQuantity);
        }
      }
    }

    // 4. Ticket Routing & ESC/POS Printing
    try {
      const { printedItemIds } = await TicketSplitter.routeAndPrintOrder({
        id: order.id,
        orderNumber: order.orderNumber,
        tableLabel: order.table?.label || (tokenNumber ? `Abholmarke #${tokenNumber}` : 'Theke'),
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
          courseNumber: i.courseNumber,
          isHold: i.isHold,
        })),
      });

      if (printedItemIds.length > 0) {
        await prisma.orderItem.updateMany({
          where: { id: { in: printedItemIds } },
          data: { printStatus: 'PRINTED' },
        });
      }
    } catch (printErr) {
      console.error('Error during ticket print spooling:', printErr);
    }

    // 5. HA Replikations-Log
    await haService.logMutation('ORDER', order.id, 'INSERT', order);

    // 6. WebSocket Events
    if (global.io) {
      global.io.emit('order:new', order);
      if (body.tableId) {
        global.io.emit('table:updated', { tableId: body.tableId, status: 'OCCUPIED' });
      }
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    const msg = error instanceof Error ? error.message : 'Fehler beim Erstellen der Bestellung';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
