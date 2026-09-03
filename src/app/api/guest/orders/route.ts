import { NextRequest, NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import { checkAndTriggerLowStockAlert } from '@/lib/low-stock-notifier';
import TicketSplitter from '@/lib/printer/ticket-splitter';
import networkSpooler from '@/lib/printer/network-spooler';
import { getEffectiveProductPrice, toCents } from '@/lib/pricing';

import { assertStockUnitsAvailable, applyStockConsumption } from '@/lib/stock';
export async function POST(req: NextRequest) {
  try {
    const { checkSimpleRateLimit, registerSimpleAttempt, getClientKey } = await import('@/lib/rate-limiter');
    const rlKey = getClientKey(req, 'guest-orders');
    const rl = checkSimpleRateLimit(rlKey, 20, 60 * 1000, 5 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Zu viele Gastbestellungen. Bitte kurz warten.' }, { status: 429 });
    }
    registerSimpleAttempt(rlKey);
    const { denyStandbyWrite } = await import('@/lib/ha/ha-guard');
    const denied = denyStandbyWrite();
    if (denied) return denied;
    const body = await req.json();
    const { tableNumber, qrToken, items, guestNote } = body;

    if (!tableNumber || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Ungültige Bestelldaten' }, { status: 400 });
    }

    // Mengenbegrenzung zum Schutz vor automatisierten Überlastungen
    if (items.length > 20) {
      return NextResponse.json(
        { error: 'Maximal 20 Positionen pro Gastbestellung zulässig.' },
        { status: 400 }
      );
    }
    const cleanGuestNote = typeof guestNote === 'string' ? guestNote.slice(0, 280).replace(/[<>"']/g, '') : null;

    const table = await prisma.diningTable.findUnique({
      where: { tableNumber: parseInt(tableNumber, 10) },
    });

    if (!table || !table.isActive) {
      return NextResponse.json({ error: 'Tisch nicht gefunden oder inaktiv' }, { status: 404 });
    }

    // Wenn ein QR-Token am Tisch hinterlegt ist, MUSS er zwingend übergeben werden und übereinstimmen.
    // Ohne hinterlegtes Token ist die Gastbestellung nur bei aktiviertem Kiosk-/Gastmodus möglich.
    if (table.qrToken) {
      if (!qrToken || table.qrToken !== qrToken) {
        return NextResponse.json(
          { error: 'Ungültiger, fehlender oder abgelaufener QR-Code. Bitte scannen Sie den QR-Code am Tisch erneut.' },
          { status: 403 }
        );
      }
    } else {
      const cfg = await prisma.eventConfig.findUnique({ where: { id: 'default' } }).catch(() => null);
      if (!cfg?.enableGuestSelfOrder && !cfg?.enableKioskMode) {
        return NextResponse.json({ error: 'Gäste-Selbstbestellung ist derzeit deaktiviert' }, { status: 403 });
      }
    }

    const config = await prisma.eventConfig.findUnique({
      where: { id: 'default' },
    });

    if (config && !config.enableGuestSelfOrder) {
      return NextResponse.json({ error: 'Gäste-Selbstbestellung ist derzeit deaktiviert' }, { status: 403 });
    }

    const now = new Date();

    // Transaktionale Bestellabwicklung mit Single-Source-of-Truth StockItem
    const { order, orderItemsData, printJobsToQueue } = await prisma.$transaction(async (tx) => {
      const updatedConfig = await tx.eventConfig.update({
        where: { id: 'default' },
        data: { orderSequence: { increment: 1 } },
      });

      // Lagerposten pruefen (siehe src/lib/stock.ts)
      await assertStockUnitsAvailable(tx, body.items || []);

      const itemsToCreate: any[] = [];
      const stockAlerts: { productId: string; newStock: number }[] = [];

      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          include: { printGroup: { include: { printer: true } }, stockItem: true },
        });

        if (!product || product.status === 'HIDDEN') continue;

        const qty = Math.max(1, Math.min(10, parseInt(item.quantity, 10) || 1));
        const { price: effectivePrice } = getEffectiveProductPrice({ price: product.priceCents / 100, happyHourPrice: (product as any).happyHourPriceCents != null ? (product as any).happyHourPriceCents / 100 : null, happyHourStart: (product as any).happyHourStart, happyHourEnd: (product as any).happyHourEnd, happyHourDays: (product as any).happyHourDays, happyHourRules: (product as any).happyHourRules } as any, now);

        // Bestandsabzug atomar auf StockItem
        if (product.trackStock) {
          const stock = await tx.stockItem.findUnique({ where: { productId: product.id } });
          if (stock) {
            if (stock.currentQuantity < qty) {
              throw new Error(`Artikel "${product.name}" ist leider ausverkauft oder nicht in ausreichender Menge verfügbar.`);
            }

            const newStock = stock.currentQuantity - qty;
            await tx.stockItem.update({
              where: { id: stock.id },
              data: { currentQuantity: newStock },
            });

            if (newStock === 0 && stock.isAutoDeactivate) {
              await tx.product.update({
                where: { id: product.id },
                data: { isSoldOut: true },
              });
            }

            stockAlerts.push({ productId: product.id, newStock });
          }
        }

        itemsToCreate.push({
          productId: product.id,
          productName: product.name,
          quantity: qty,
          unitPriceCents: toCents(effectivePrice),
          depositCents: product.depositCents,
          taxRate: product.taxRate,
          variantName: item.variantName || null,
          selectedOptions: item.selectedOptions
            ? typeof item.selectedOptions === 'string'
              ? item.selectedOptions
              : JSON.stringify(item.selectedOptions)
            : '[]',
          customizationText: (typeof item.customizationText === 'string' ? item.customizationText.slice(0, 200).replace(/[<>"']/g, '') : null) || cleanGuestNote || null,
          courseNumber: item.courseNumber || 1,
          isHold: false,
          status: 'PENDING',
          printStatus: 'PENDING',
          productPrintGroup: product.printGroup,
          productCategory: product.categoryId,
        });
      }

      if (itemsToCreate.length === 0) {
        throw new Error('Keine bestellbaren Artikel im Warenkorb.');
      }

      await applyStockConsumption(tx, body.items || []);

      const createdOrder = await tx.order.create({
        data: {
          // Wert VOR dem Inkrement - identisch zu /api/orders und /api/orders/checkout.
          orderNumber: updatedConfig.orderSequence - 1,
          tableId: table.id,
          waiterName: `Gast (Tisch ${table.tableNumber})`,
          source: 'GUEST_QR',
          status: 'OPEN',
          orderType: 'TABLE',
          isTraining: config?.trainingMode ?? false,
          items: {
            create: itemsToCreate.map((i) => ({
              productId: i.productId,
              productName: i.productName,
              quantity: i.quantity,
              unitPriceCents: i.unitPriceCents,
              depositCents: i.depositCents,
              taxRate: i.taxRate,
              variantName: i.variantName,
              selectedOptions: i.selectedOptions,
              customizationText: i.customizationText,
              courseNumber: i.courseNumber,
              isHold: i.isHold,
              status: i.status,
              printStatus: i.printStatus,
            })),
          },
        },
        include: { items: true, table: true },
      });

      await tx.diningTable.update({
        where: { id: table.id },
        data: { status: 'OCCUPIED' },
      });

      return {
        order: createdOrder,
        orderItemsData: itemsToCreate,
        printJobsToQueue: stockAlerts,
      };
    });

    // Nach erfolgreicher Transaktion Drucker ansteuern (async ACK: PENDING bis print:acked)
    try {
      const { jobIds } = await TicketSplitter.routeAndPrintOrder({
        id: order.id,
        orderNumber: order.orderNumber,
        tableLabel: table.label || `Tisch ${table.tableNumber}`,
        waiterName: order.waiterName,
        isTraining: order.isTraining,
        createdAt: order.createdAt,
        items: order.items.map((i: any) => ({
          id: i.id,
          productName: i.productName,
          quantity: i.quantity,
          unitPriceCents: i.unitPriceCents,
          depositCents: i.depositCents ?? 0,
          variantName: i.variantName,
          selectedOptions: i.selectedOptions,
          customizationText: i.customizationText,
          productId: i.productId,
          courseNumber: i.courseNumber,
          isHold: i.isHold,
        })),
      });
      if (global.io && jobIds.length > 0) {
        global.io.emit('print:queued', { orderId: order.id, jobIds });
      }
    } catch {}

    if (global.io) {
      global.io.emit('order:created', order);
      global.io.emit('table:updated', { tableId: table.id, status: 'OCCUPIED' });
    }

    await logSystemActionSafe(() => ({
      action: 'GUEST_ORDER_CREATED',
      category: 'ORDERS',
      actor: order.waiterName || 'Gast (QR am Tisch)',
      details: 'Gast-Bestellung ueber QR erfasst.',
    }));

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      message: 'Bestellung erfolgreich an die Küche übermittelt!',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Fehler beim Aufgeben der Gastbestellung' },
      { status: 500 }
    );
  }
}
