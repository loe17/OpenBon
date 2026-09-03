import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';

/** Eigene Schichtabrechnung (X-Bon): nur eigene Zahlungen, keine Gesamtumsätze. */
export async function GET(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;
  const me = auth.session.waiterName;
  if (!me) {
    return NextResponse.json({ error: 'Keine Bedienung in Session.' }, { status: 400 });
  }
  try {
    const payments = await prisma.payment.findMany({
      where: { waiterName: me, isCancelled: false, isTraining: false },
      select: { id: true, totalGrossCents: true, tipAmountCents: true, paymentMethod: true, createdAt: true, invoiceNumber: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const totalCents = payments.reduce((s, p) => s + p.totalGrossCents, 0);
    const cashCents = payments.filter((p) => p.paymentMethod === 'CASH').reduce((s, p) => s + p.totalGrossCents, 0);
    const cardCents = totalCents - cashCents;
    const tipsCents = payments.reduce((s, p) => s + p.tipAmountCents, 0);
    return NextResponse.json({
      waiterName: me,
      transactionCount: payments.length,
      totalGrossCents: totalCents,
      cashGrossCents: cashCents,
      cardGrossCents: cardCents,
      tipsCents: tipsCents,
      payments,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
