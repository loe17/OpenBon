import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';
import { logSystemActionSafe } from '@/lib/action-logger';

/** Revisionssicheres Belegarchiv: Suche + protokollierter Neudruck (ADMIN). */
export async function GET(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').slice(0, 40);
    const take = Math.min(100, parseInt(searchParams.get('take') || '50', 10) || 50);
    const payments = await prisma.payment.findMany({
      where: q
        ? { OR: [{ invoiceNumber: { contains: q } }, { digitalReceiptCode: { contains: q } }] }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take,
      select: { id: true, invoiceNumber: true, digitalReceiptCode: true, totalGrossCents: true, paymentMethod: true, createdAt: true, waiterName: true, isRefund: true },
    });
    return NextResponse.json({ payments });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json().catch(() => ({}));
    const paymentId = String(body.paymentId || '');
    const reason = String(body.reason || '').slice(0, 200);
    if (!paymentId || !reason) {
      return NextResponse.json({ error: 'paymentId und Grund erforderlich.' }, { status: 400 });
    }
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return NextResponse.json({ error: 'Beleg nicht gefunden.' }, { status: 404 });
    await logSystemActionSafe(() => ({
      action: 'RECEIPT_REPRINTED',
      category: 'SALES',
      actor: auth.session.waiterName || 'Admin',
      details: `Beleg ${payment.invoiceNumber} nachgedruckt. Grund: ${reason}`,
      metadata: { paymentId, invoiceNumber: payment.invoiceNumber, reason },
    }));
    return NextResponse.json({ success: true, payment });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
