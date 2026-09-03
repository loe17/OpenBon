import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';
import { logSystemActionSafe } from '@/lib/action-logger';
import { toCents } from '@/lib/pricing';
import { checkSimpleRateLimit, registerSimpleAttempt, getClientKey } from '@/lib/rate-limiter';

/**
 * Bar-Erstattung (CASH_REFUND) – bewusst NUR bar, keine Karten-Rückbuchung.
 * Erstellt eine Gegenbuchung (isRefund) statt Löschen, mit Pflichtgrund + Admin-Session.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  const rlKey = getClientKey(req, 'refund');
  const rl = checkSimpleRateLimit(rlKey, 10, 10 * 60 * 1000, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Zu viele Erstattungen. Bitte warten.' }, { status: 429 });
  }
  registerSimpleAttempt(rlKey, 10 * 60 * 1000);
  const { denyStandbyWrite } = await import('@/lib/ha/ha-guard');
  const denied = denyStandbyWrite();
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const reason = String(body.reason || '').trim().slice(0, 200);
    const amount = Number(body.amount);
    if (!reason) {
      return NextResponse.json({ error: 'Erstattungsgrund ist Pflicht.' }, { status: 400 });
    }

    const original = await prisma.payment.findUnique({
      where: { id: params.id },
      include: { items: true },
    });
    if (!original) {
      return NextResponse.json({ error: 'Originalzahlung nicht gefunden.' }, { status: 404 });
    }
    if (original.isRefund) {
      return NextResponse.json({ error: 'Erstattungen können nicht erneut erstattet werden.' }, { status: 409 });
    }
    if (String(original.paymentMethod).startsWith('CARD')) {
      // Hinweis: Karten-Refund fachlich offen – aktuell nur Barauszahlung als Gutschrift
      return NextResponse.json(
        { error: 'Kartenzahlungen werden bar erstattet (Barauszahlung). Karten-Rückbuchung am Terminal bitte separat.' },
        { status: 422 }
      );
    }

    const refundGross = Number.isFinite(amount) && amount > 0 ? Math.min(amount, original.totalGrossCents) : original.totalGrossCents;
    const refundCents = toCents(refundGross);

    const updatedConfig = await prisma.eventConfig.update({
      where: { id: 'default' },
      data: { invoiceSequence: { increment: 1 } },
    });
    const seq = updatedConfig.invoiceSequence - 1;
    const invNum = `ERSTATTUNG-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`;

    const refundedBy = auth.session.waiterName || 'Admin';
    const refund = await prisma.payment.create({
      data: {
        invoiceNumber: invNum,
        tableId: original.tableId,
        orderId: original.orderId,
        periodId: original.periodId,
        waiterName: original.waiterName,
        totalGrossCents: -Math.abs(refundCents),
        totalNetCents: -Math.abs(Math.round(refundCents / 1.19)),
        totalTaxCents: -Math.abs(refundCents - Math.round(refundCents / 1.19)),
        paymentMethod: 'CASH_REFUND',
        isRefund: true,
        refundOfPaymentId: original.id,
        refundReason: reason,
        refundedBy,
        nonPaidReason: `Bar-Erstattung zu ${original.invoiceNumber}: ${reason}`,
        items: {
          create: original.items.map((i) => ({
            orderItemId: i.orderItemId,
            productName: `ERSTATTUNG: ${i.productName}`,
            quantity: i.quantity,
            unitPriceCents: -Math.abs(i.unitPriceCents),
            depositCents: i.depositCents,
            taxRate: i.taxRate,
          })),
        },
      },
    });

    await logSystemActionSafe(() => ({
      action: 'PAYMENT_REFUNDED',
      category: 'SALES',
      actor: refundedBy,
      details: `Bar-Erstattung ${invNum} zu ${original.invoiceNumber} über ${refundGross.toFixed(2)} € (bar). Grund: ${reason}`,
      metadata: { refundId: refund.id, originalId: original.id, amount: refundGross, method: 'CASH' },
    }));

    if (global.io) {
      global.io.emit('payment:refunded', { refundId: refund.id, originalId: original.id, amount: refundGross });
    }

    return NextResponse.json({ success: true, refund, method: 'CASH' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
