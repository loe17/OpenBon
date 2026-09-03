import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';
import { validateBody, AmountSplitSchema } from '@/lib/validations/schemas';
import { toCents } from '@/lib/pricing';
import { generateDigitalReceiptCode } from '@/lib/digital-receipt';
import { getOrCreateOpenPeriod } from '@/lib/register-period';
import { logSystemActionSafe } from '@/lib/action-logger';

/**
 * Betragssplit („50 € jetzt, Rest später"): Teilzahlung als fester Euro-Betrag,
 * ohne Stückzahl-Logik. Legt eine Payment mit dem Teilbetrag an.
 */
export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;
  const v = await validateBody(req, AmountSplitSchema);
  if (!v.success) return v.response;
  const { denyStandbyWrite } = await import('@/lib/ha/ha-guard');
  const denied = denyStandbyWrite();
  if (denied) return denied;
  try {
    const { orderId, tableId, amountCents, paymentMethod, waiterName } = v.data;
    if (paymentMethod === 'CASH_REFUND') {
      return NextResponse.json({ error: 'Erstattung bitte über /api/payments/[id]/refund.' }, { status: 400 });
    }
    const period = await getOrCreateOpenPeriod();
    const updatedConfig = await prisma.eventConfig.update({
      where: { id: 'default' },
      data: { invoiceSequence: { increment: 1 } },
    });
    const seq = updatedConfig.invoiceSequence - 1;
    const invNum = `SPLIT-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`;
    const gross = amountCents / 100;
    const payment = await prisma.payment.create({
      data: {
        invoiceNumber: invNum,
        tableId: tableId || null,
        orderId: orderId || null,
        periodId: period.id,
        waiterName: waiterName || auth.session.waiterName || 'Bedienung',
        deviceId: auth.session.deviceId || null,
        digitalReceiptCode: generateDigitalReceiptCode(invNum),
        totalGrossCents: amountCents,
        totalNetCents: Math.round(amountCents / 1.19),
        totalTaxCents: amountCents - Math.round(amountCents / 1.19),
        paymentMethod,
      },
    });
    await logSystemActionSafe(() => ({
      action: 'PAYMENT_SPLIT',
      category: 'SALES',
      actor: auth.session.waiterName || auth.session.role,
      details: `Betragssplit ${invNum}: ${(amountCents / 100).toFixed(2)} € (${paymentMethod})`,
      metadata: { paymentId: payment.id, orderId, tableId, amountCents },
    }));
    if (global.io) {
      global.io.emit('payment:completed', { paymentId: payment.id, orderId, tableId, amount: gross, partial: true });
    }
    return NextResponse.json({ success: true, payment });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
