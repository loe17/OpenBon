import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';
import { logSystemActionSafe } from '@/lib/action-logger';
import { TicketSplitter } from '@/lib/printer/ticket-splitter';
import { EscPosBuilder } from '@/lib/printer/escpos-builder';
import networkSpooler from '@/lib/printer/network-spooler';
import { parseSelectedOptions } from '@/lib/stock';

export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { tableLabel, itemIds, printDelayTicket, delayedItemIds } = body;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ error: 'Keine Artikel zum Drucken ausgewählt.' }, { status: 400 });
    }

    // 1. Zu fertigstellende Positionen laden
    const completedItems = await prisma.orderItem.findMany({
      where: { id: { in: itemIds } },
      include: {
        order: {
          include: { table: true },
        },
        product: {
          include: {
            category: true,
            printGroup: { include: { printer: true } },
            variants: { include: { printGroup: { include: { printer: true } } } },
          },
        },
      },
    });

    if (completedItems.length === 0) {
      return NextResponse.json({ error: 'Ausgewählte Artikel nicht gefunden.' }, { status: 404 });
    }

    // 2. Status der abgehakten Artikel auf COMPLETED & PRINTED setzen
    await prisma.orderItem.updateMany({
      where: { id: { in: itemIds } },
      data: {
        kdsStatus: 'COMPLETED',
        kdsCompletedAt: new Date(),
        printStatus: 'PRINTED',
      },
    });

    // 3. Nach Bestellung gruppieren und Bons über TicketSplitter erzeugen & drucken
    const orderGroupMap = new Map<string, typeof completedItems>();
    for (const it of completedItems) {
      const arr = orderGroupMap.get(it.orderId) || [];
      arr.push(it);
      orderGroupMap.set(it.orderId, arr);
    }

    let totalTickets = 0;
    const allJobIds: string[] = [];

    for (const [orderId, itemsForOrder] of orderGroupMap.entries()) {
      const ord = itemsForOrder[0].order;
      const orderToRoute = {
        id: ord.id,
        orderNumber: ord.orderNumber,
        tableLabel: ord.table?.label || (ord.tokenNumber ? `Abholmarke #${ord.tokenNumber}` : 'Theke'),
        waiterName: ord.waiterName,
        tokenNumber: ord.tokenNumber,
        isTraining: ord.isTraining,
        createdAt: ord.createdAt,
        items: itemsForOrder.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.productName,
          alternativeName: i.product?.alternativeTicketName,
          quantity: i.quantity,
          unitPriceCents: i.unitPriceCents,
          depositCents: i.depositCents ?? 0,
          variantName: i.variantName,
          selectedOptions: i.selectedOptions,
          customizationText: i.customizationText,
          courseNumber: i.courseNumber,
          isHold: false,
        })),
      };

      const printRes = await TicketSplitter.routeAndPrintOrder(orderToRoute, {
        onlyItemIds: itemsForOrder.map((i) => i.id),
        includeHold: true,
      });

      totalTickets += printRes.ticketsGenerated;
      if (printRes.jobIds) allJobIds.push(...printRes.jobIds);
    }

    // 4. Prüfen, ob alle Positionen der Bestellungen abgeschlossen sind
    for (const orderId of orderGroupMap.keys()) {
      const remainingCount = await prisma.orderItem.count({
        where: {
          orderId,
          kdsStatus: { not: 'COMPLETED' },
          isCancelled: false,
        },
      });
      if (remainingCount === 0) {
        await prisma.order.update({
          where: { id: orderId },
          data: { status: 'COMPLETED' },
        });
      }
    }

    // 5. Warte-Bon für noch offene / verzögerte Artikel drucken (falls gewünscht)
    let delayTicketPrinted = false;
    if (printDelayTicket && Array.isArray(delayedItemIds) && delayedItemIds.length > 0) {
      const delayedItems = await prisma.orderItem.findMany({
        where: { id: { in: delayedItemIds }, isCancelled: false, kdsStatus: { not: 'COMPLETED' } },
        include: {
          order: { include: { table: true } },
          product: {
            include: {
              printGroup: { include: { printer: true } },
              variants: { include: { printGroup: { include: { printer: true } } } },
            },
          },
        },
      });

      if (delayedItems.length > 0) {
        // Drucker der verzögerten Artikel ermitteln
        const printerItemsMap = new Map<string, { printer: any; items: typeof delayedItems }>();
        for (const dItem of delayedItems) {
          const variant = dItem.variantName
            ? dItem.product?.variants.find((v) => v.name === dItem.variantName)
            : undefined;
          const printer = variant?.printGroup?.printer || dItem.product?.printGroup?.printer;
          if (!printer || !printer.isActive) continue;
          const entry = printerItemsMap.get(printer.id) || { printer, items: [] };
          entry.items.push(dItem);
          printerItemsMap.set(printer.id, entry);
        }

        for (const { printer, items: dItems } of printerItemsMap.values()) {
          const firstOrder = dItems[0].order;
          const tLabel = tableLabel || firstOrder.table?.label || (firstOrder.tokenNumber ? `Abholmarke #${firstOrder.tokenNumber}` : 'Theke');
          const waiterName = firstOrder.waiterName;

          const ticket = EscPosBuilder.buildDelayNoticeTicket(
            {
              tableLabel: tLabel,
              waiterName,
              orderNumber: firstOrder.orderNumber,
              createdAt: new Date(),
              items: dItems.map((di) => {
                const rawOpts = di.selectedOptions ? parseSelectedOptions(di.selectedOptions) : [];
                const opts = rawOpts.map((o) => (o.quantity > 1 ? `${o.quantity}x ${o.name}` : o.name));
                return {
                  name: di.productName,
                  quantity: di.quantity,
                  variantName: di.variantName,
                  options: opts,
                  customizationText: di.customizationText,
                };
              }),
            },
            printer.paperWidth || 80
          );

          await networkSpooler.sendRawBuffer(printer, ticket.rawBuffer, ticket.textRepresentation, {
            ticketType: 'WARTE-BON',
            lengthMm: ticket.lengthMm,
          });
          delayTicketPrinted = true;
        }
      }
    }

    // 6. Logging & Events
    await logSystemActionSafe(() => ({
      action: 'KDS_PRINT_CONFIRM',
      category: 'ORDERS',
      actor: auth.session.waiterName || auth.session.role,
      details: `KDS Druck & Fertigstellung: ${itemIds.length} Positionen, Warte-Bon: ${delayTicketPrinted}`,
      metadata: { itemIds, delayedItemIds, ticketsGenerated: totalTickets },
    }));

    if (global.io) {
      global.io.emit('kds:item_updated', { itemIds });
      global.io.emit('kds:order_updated');
      if (allJobIds.length > 0) {
        global.io.emit('print:queued', { jobIds: allJobIds });
      }
    }

    return NextResponse.json({
      success: true,
      completedCount: itemIds.length,
      ticketsGenerated: totalTickets,
      delayTicketPrinted,
    });
  } catch (error) {
    console.error('Fehler in /api/kds/print:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
