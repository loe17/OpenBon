import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';
import { logSystemActionSafe } from '@/lib/action-logger';

/**
 * Küchen-Quittung: „Bon physisch angekommen".
 * TCP-Push an Port 9100 kann Papier-leer/Stau nicht erkennen – erst diese
 * Bestätigung durch die Küche gilt als echtes Druck-ACK.
 */
export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;
  const { denyStandbyWrite } = await import('@/lib/ha/ha-guard');
  const denied = denyStandbyWrite();
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const orderId = String(body.orderId || '');
    const jobId = String(body.jobId || '');
    if (!orderId && !jobId) {
      return NextResponse.json({ error: 'orderId oder jobId erforderlich.' }, { status: 400 });
    }

    const where = jobId ? { id: jobId } : { orderId, status: { in: ['PRINTED', 'PENDING'] } };
    const jobs = await prisma.printJob.findMany({ where, take: 50 });
    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Kein offener Druckauftrag gefunden.' }, { status: 404 });
    }

    const by = auth.session.waiterName || auth.session.role;
    await prisma.printJob.updateMany({
      where: { id: { in: jobs.map((j) => j.id) } },
      data: { status: 'CONFIRMED', confirmedAt: new Date(), confirmedBy: by },
    });

    await logSystemActionSafe(() => ({
      action: 'PRINT_CONFIRMED',
      category: 'ORDERS',
      actor: by,
      details: `Druck bestätigt (${jobs.length} Auftrag/Aufträge${orderId ? `, Bestellung ${orderId}` : ''}).`,
      metadata: { jobIds: jobs.map((j) => j.id), orderId: orderId || null },
    }));

    if (global.io) {
      global.io.emit('print:confirmed', {
        jobIds: jobs.map((j) => j.id),
        orderId: orderId || jobs[0]?.orderId || null,
        confirmedBy: by,
      });
    }

    return NextResponse.json({ success: true, confirmed: jobs.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
