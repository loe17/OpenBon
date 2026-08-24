import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAndTriggerLowStockAlert } from '@/lib/low-stock-notifier';
import TicketSplitter from '@/lib/printer/ticket-splitter';
import networkSpooler from '@/lib/printer/network-spooler';
import { getEffectiveProductPrice } from '@/lib/pricing';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tableNumber, qrToken, items, guestNote } = body;

    if (!tableNumber || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Ungültige Bestelldaten' }, { status: 400 });
    }

    const table = await prisma.diningTable.findUnique({
      where: { tableNumber: parseInt(tableNumber, 10) },
    });

    if (!table || !table.isActive) {
      return NextResponse.json({ error: 'Tisch nicht gefunden oder inaktiv' }, { status: 404 });
    }

    // Wenn ein QR-Token am Tisch hinterlegt ist, muss dieser übereinstimmen
    if (table.qrToken && qrToken && table.qrToken !== qrToken) {
      return NextResponse.json({ error: 'Ungültiger oder abgelaufener QR-Code' }, { status: 403 });
    }

    const config = await prisma.eventConfig.findUnique({
      where: { id: 'default' },
    });

    if (config && !config.enableGuestSelfOrder) {
      return NextResponse.json({ error: 'Gäste-Selbstbestellung ist derzeit deaktiviert' }, { status: 403 });
    }

    // Erhöhe Sequenzzähler atomar
    const updatedConfig = await prisma.eventConfig.update({
      where: { id: 'default' },
      data: { orderSequence: { increment: 1 } },
    });

    const now = new Date();

    // Validiere und erstelle die Bestellpositionen
    const orderItemsData: any[] = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { printGroup: true },
      });

      if (!product) continue;

      const { price: effectivePrice } = getEffectiveProductPrice(product, now);
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);

      // Bestandsabzug & Meldebestand-Prüfung
      if (product.trackStock) {
        const newStock = Math.max(0, product.stockQuantity - qty);
        await prisma.product.update({
          where: { id: product.id },
          data: {
            stockQuantity: newStock,
            isSoldOut: newStock === 0,
          },
        });
        // Pruefe Meldebestand
        await checkAndTriggerLowStockAlert(product.id, newStock);
      }

      orderItemsData.push({
        productId: product.id,
        productName: product.name,
        quantity: qty,
        unitPrice: effectivePrice,
        deposit: product.deposit,
        taxRate: product.taxRate,
        variantName: item.variantName || null,
        selectedOptions: item.selectedOptions ? (typeof item.selectedOptions === 'string' ? item.selectedOptions : JSON.stringify(item.selectedOptions)) : '[]',
        customizationText: item.customizationText || guestNote || null,
        courseNumber: item.courseNumber || 1,
        isHold: false,
        status: 'PENDING',
        printStatus: 'PENDING',
      });
    }

    const order = await prisma.order.create({
      data: {
        orderNumber: updatedConfig.orderSequence,
        tableId: table.id,
        waiterName: `Gast (Tisch ${table.tableNumber})`,
        source: 'GUEST_QR',
        status: 'OPEN',
        orderType: 'TABLE',
        isTraining: config?.trainingMode ?? false,
        items: {
          create: orderItemsData,
        },
      },
      include: {
        items: {
          include: { product: true },
        },
        table: true,
      },
    });

    // Tischstatus auf OCCUPIED setzen
    if (table.status === 'FREE') {
      await prisma.diningTable.update({
        where: { id: table.id },
        data: { status: 'OCCUPIED' },
      });
    }

    // Automatischer Druck auf den entsprechenden Druckergruppen
    try {
      const { printedItemIds } = await TicketSplitter.routeAndPrintOrder({
        id: order.id,
        orderNumber: order.orderNumber,
        tableLabel: table.label || `Tisch ${table.tableNumber}`,
        waiterName: 'Gast (QR-Bestellung)',
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
      console.warn('Druckerausgabe fuer Gastbestellung fehlgeschlagen:', printErr);
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      itemCount: order.items.length,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/guest/orders error:', error);
    return NextResponse.json({ error: 'Fehler beim Übermitteln der Gastbestellung' }, { status: 500 });
  }
}
