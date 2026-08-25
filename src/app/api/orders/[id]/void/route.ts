import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import TicketSplitter from '@/lib/printer/ticket-splitter';
import haService from '@/lib/ha/ha-service';
import { VOID_REASONS } from '@/types/domain';

/**
 * Spec 6.4: Storno- & Korrektur-Workflow nach dem Abschicken.
 *
 * - Nur mit Admin-/Leitungs-PIN
 * - Pflicht-Stornogrund
 * - Automatischer Druck eines Storno-Bons in der betroffenen Station
 * - Optionale Kennzeichnung als "Nicht bezahlt" (Freiverzehr / Schwund)
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await req.json()) as {
      pin?: string;
      reason?: string;
      cancelledBy?: string;
      itemIds?: string[];
      markAsUnpaid?: boolean;
    };

    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      return NextResponse.json({ error: 'Keine Konfiguration gefunden' }, { status: 500 });
    }

    // 1. PIN-Absicherung (Admin oder Kassenleitung)
    const pin = (body.pin || '').trim();
    if (pin !== config.adminPin && pin !== config.posPin) {
      return NextResponse.json(
        { error: 'Storno nur mit Admin- oder Kassen-PIN möglich.' },
        { status: 403 }
      );
    }

    // 2. Pflicht-Stornogrund
    const reason = (body.reason || '').trim();
    if (!reason) {
      return NextResponse.json(
        { error: 'Ein Stornogrund ist zwingend erforderlich.', allowedReasons: VOID_REASONS },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: { items: true, table: true },
    });
    if (!order) {
      return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
    }

    const targetItems = order.items.filter((i) => {
      if (i.isCancelled) return false;
      if (body.itemIds && body.itemIds.length > 0) return body.itemIds.includes(i.id);
      return true;
    });

    if (targetItems.length === 0) {
      return NextResponse.json({ error: 'Keine stornierbaren Positionen gefunden.' }, { status: 400 });
    }

    // Bereits bezahlte Positionen duerfen nicht still storniert werden
    const alreadyPaid = targetItems.filter((i) => i.paidQuantity > 0);
    if (alreadyPaid.length > 0) {
      return NextResponse.json(
        {
          error:
            'Bereits kassierte Positionen können nicht storniert werden. Bitte eine Rückerstattung erfassen.',
          paidItems: alreadyPaid.map((i) => i.productName),
        },
        { status: 409 }
      );
    }

    const cancelledBy = body.cancelledBy || 'Leitung';
    const now = new Date();

    // 3. Positionen stornieren und Bestand zurueckbuchen
    await prisma.$transaction(async (tx) => {
      for (const item of targetItems) {
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            isCancelled: true,
            cancellationReason: reason,
            cancelledBy,
            cancelledAt: now,
            kdsStatus: 'COMPLETED',
            kdsCompletedAt: now,
          },
        });

        // Bestand sauber auf StockItem zurückbuchen
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          include: { stockItem: true },
        });
        if (product?.stockItem) {
          const updatedStock = await tx.stockItem.update({
            where: { id: product.stockItem.id },
            data: { currentQuantity: { increment: item.quantity } },
          });

          if (updatedStock.currentQuantity > 0) {
            await tx.product.update({
              where: { id: product.id },
              data: {
                isSoldOut: false,
                status: product.status === 'INACTIVE' ? 'ACTIVE' : product.status,
              },
            });
          }
        }
      }

      // Wenn alle Positionen storniert sind, gilt die Bestellung als storniert
      const remaining = await tx.orderItem.count({
        where: { orderId: order.id, isCancelled: false },
      });
      if (remaining === 0) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED' },
        });
        if (order.tableId) {
          const openOnTable = await tx.orderItem.count({
            where: {
              isCancelled: false,
              order: { tableId: order.tableId, status: { in: ['OPEN', 'IN_PREPARATION', 'READY'] } },
            },
          });
          if (openOnTable === 0) {
            await tx.diningTable.update({
              where: { id: order.tableId },
              data: { status: 'FREE', activeWaiterName: null },
            });
          }
        }
      }
    });

    // 4. Storno-Bon in der Kueche / am Ausschank drucken
    let ticketsGenerated = 0;
    try {
      const result = await TicketSplitter.printVoidTickets({
        orderNumber: order.orderNumber,
        tableLabel: order.table?.label ?? (order.tokenNumber ? `Abholmarke #${order.tokenNumber}` : 'Theke'),
        waiterName: order.waiterName,
        cancelledBy,
        reason,
        isTraining: order.isTraining,
        items: targetItems.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          variantName: i.variantName,
        })),
      });
      ticketsGenerated = result.ticketsGenerated;
    } catch (printErr) {
      console.error('Storno-Bon konnte nicht gedruckt werden:', printErr);
    }

    // 5. Optional als "Nicht bezahlt" fuer Buchhaltung / Schwundstatistik buchen
    let unpaidPaymentId: string | null = null;
    if (body.markAsUnpaid) {
      const grossValue = targetItems.reduce(
        (sum, i) => sum + (i.unitPrice + i.deposit) * i.quantity,
        0
      );
      const invNum = `STORNO-${new Date().getFullYear()}-${String(config.invoiceSequence).padStart(5, '0')}`;
      const openPeriod = await prisma.registerPeriod.findFirst({ where: { status: 'OPEN' } });

      const unpaid = await prisma.$transaction(async (tx) => {
        await tx.eventConfig.update({
          where: { id: 'default' },
          data: { invoiceSequence: { increment: 1 } },
        });
        return tx.payment.create({
          data: {
            invoiceNumber: invNum,
            tableId: order.tableId,
            orderId: order.id,
            periodId: openPeriod?.id ?? null,
            waiterName: order.waiterName,
            totalGross: Math.round(grossValue * 100) / 100,
            totalNet: 0,
            totalTax: 0,
            paymentMethod: 'VOID_UNPAID',
            nonPaidReason: reason,
            isTraining: order.isTraining,
            items: {
              create: targetItems.map((i) => ({
                orderItemId: i.id,
                productName: i.productName,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                deposit: i.deposit,
                taxRate: i.taxRate,
              })),
            },
          },
        });
      });
      unpaidPaymentId = unpaid.id;
    }

    await haService.logMutation('ORDER', order.id, 'UPDATE', { id: order.id, voidedItems: targetItems.length });

    if (global.io) {
      global.io.emit('order:voided', {
        orderId: order.id,
        itemIds: targetItems.map((i) => i.id),
        reason,
        cancelledBy,
      });
      if (order.tableId) {
        global.io.emit('table:updated', { tableId: order.tableId });
      }
    }

    return NextResponse.json({
      success: true,
      voidedItems: targetItems.length,
      ticketsGenerated,
      unpaidPaymentId,
      reason,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('Storno fehlgeschlagen:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
