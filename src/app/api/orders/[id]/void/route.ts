import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import TicketSplitter from '@/lib/printer/ticket-splitter';
import haService from '@/lib/ha/ha-service';
import { round2, toCents } from '@/lib/pricing';
import { VOID_REASONS } from '@/types/domain';
import { requireApiAuth } from '@/lib/api-guard';
import { verifyPinHash } from '@/lib/auth-pin';
import { cancelDelayedPrint } from '@/lib/order-delay-manager';

/**
 * Spec 6.4: Storno- & Korrektur-Workflow nach dem Abschicken.
 *
 * - Wenn innerhalb des Storno-Zeitfensters (Bestellverzögerung): Bedienung kann direkt stornieren (kein Bon-Druck erfolgt).
 * - Nach Ablauf des Zeitfensters: Admin-Rechte oder Admin-PIN erforderlich mit Storno-Bon-Druck.
 * - Pflicht-Stornogrund
 * - Optionale Kennzeichnung als "Nicht bezahlt" (Freiverzehr / Schwund)
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;
  const { checkSimpleRateLimit, registerSimpleAttempt, getClientKey } = await import('@/lib/rate-limiter');
  const rlKey = getClientKey(req, `void:${auth.session.waiterName || auth.session.role}`);
  const rl = checkSimpleRateLimit(rlKey, 10, 10 * 60 * 1000, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Zu viele Storno-Versuche. Bitte in ${rl.remainingSeconds}s erneut versuchen.` },
      { status: 429 }
    );
  }
  const { denyStandbyWrite } = await import('@/lib/ha/ha-guard');
  const denied = denyStandbyWrite();
  if (denied) return denied;

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

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: { items: true, table: true },
    });
    if (!order) {
      return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
    }

    const delaySeconds = config.enableOrderPrintDelay ? (config.orderPrintDelaySeconds || 60) : 0;
    const ageMs = Date.now() - new Date(order.createdAt).getTime();
    const isWithinDelayWindow = delaySeconds > 0 && ageMs <= (delaySeconds * 1000 + 4000);

    // Berechtigungsprüfung:
    // 1. Innerhalb des Storno-Zeitfensters darf die angemeldete Bedienung stornieren.
    // 2. Außerhalb muss Admin-Rolle aktiv sein oder eine gültige Admin-PIN eingegeben werden.
    if (!isWithinDelayWindow && auth.session.role !== 'ADMIN') {
      const pin = (body.pin || '').trim();
      let pinValid = false;
      if (pin) {
        if (config.adminPin && (await verifyPinHash(pin, config.adminPin))) {
          pinValid = true;
        } else {
          const adminStaff = await prisma.staff.findFirst({ where: { role: 'ADMIN', isActive: true } });
          if (adminStaff && (await verifyPinHash(pin, adminStaff.pinHash))) {
            pinValid = true;
          }
        }
      }
      if (!pinValid) {
        return NextResponse.json(
          { error: 'Diese Aktion erfordert die Rolle ADMIN oder eine gültige Admin-PIN (Storno-Zeitfenster abgelaufen).' },
          { status: 403 }
        );
      }
    }

    const reason = (body.reason || (isWithinDelayWindow ? 'Fehleingabe (vor Bondruck)' : '')).trim();
    if (!reason) {
      return NextResponse.json(
        { error: 'Ein Stornogrund ist zwingend erforderlich.', allowedReasons: VOID_REASONS },
        { status: 400 }
      );
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
    // WICHTIG: Wenn die Bestellung innerhalb des Storno-Zeitfensters storniert wurde,
    // ist die Bestellung physisch noch gar nicht gedruckt worden! Daher kein Storno-Bon nötig.
    let ticketsGenerated = 0;
    if (!isWithinDelayWindow) {
      try {
        const result = await TicketSplitter.printVoidTickets({
          orderNumber: order.orderNumber,
          orderId: order.id,
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
    } else {
      // Wurden alle verbleibenden Positionen storniert, den ausstehenden Druck komplett abbrechen
      const remainingCount = order.items.filter((i) => !i.isCancelled && !targetItems.some((t) => t.id === i.id)).length;
      if (remainingCount === 0) {
        cancelDelayedPrint(order.id);
      }
    }

    // 5. Optional als "Nicht bezahlt" fuer Buchhaltung / Schwundstatistik buchen
    let unpaidPaymentId: string | null = null;
    if (body.markAsUnpaid) {
      const grossValueCents = targetItems.reduce((sum, i) => sum + (Number(i.unitPriceCents) + Number(i.depositCents || 0)) * Number(i.quantity), 0);
      const openPeriod = await prisma.registerPeriod.findFirst({ where: { status: 'OPEN' } });

      const unpaid = await prisma.$transaction(async (tx) => {
        const currentConfig = await tx.eventConfig.update({
          where: { id: 'default' },
          data: { invoiceSequence: { increment: 1 } },
        });
        const seq = currentConfig.invoiceSequence - 1;
        const invNum = `STORNO-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`;

        return tx.payment.create({
          data: {
            invoiceNumber: invNum,
            tableId: order.tableId,
            orderId: order.id,
            periodId: openPeriod?.id || null,
            waiterName: order.waiterName,
            totalGrossCents: grossValueCents,
            totalNetCents: Math.round(grossValueCents / 1.19),
            totalTaxCents: grossValueCents - Math.round(grossValueCents / 1.19),
            paymentMethod: 'NON_PAID_COMPLAINT',
            nonPaidReason: `Storno: ${reason}`,
            isCancelled: true,
            cancellationReason: reason,
            items: {
              create: targetItems.map((i) => ({
                orderItemId: i.id,
                productName: i.productName,
                quantity: i.quantity,
                unitPriceCents: i.unitPriceCents,
                depositCents: i.depositCents,
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

    // Stornos sind der kritischste Vorgang einer Kasse - luecklose Protokollierung.
    await logSystemActionSafe(() => ({
      action: 'ORDER_VOIDED',
      category: 'ORDERS',
      actor: cancelledBy || 'Unbekannt',
      details: `Storno an Bestellung #${order.orderNumber}: ${targetItems.length} Position(en), Grund: ${reason}`,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        itemIds: targetItems.map((i) => i.id),
        reason,
        cancelledBy,
        unpaidPaymentId,
      },
    }));

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
