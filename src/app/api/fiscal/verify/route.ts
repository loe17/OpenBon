import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';
import { requireAdmin } from '@/lib/admin-guard';
import { verifyFiscalBlock } from '@/lib/fiscal';

/** Verifiziert Z-Bon-Kette (Signaturverkettung) + TSE-Lückenreport. */
export async function GET(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const periods = await prisma.registerPeriod.findMany({ orderBy: { periodNumber: 'asc' }, take: 200 });
    const results: Array<{ periodNumber: number; ok: boolean; detail: string }> = [];
    let prev: string | null = null;
    for (const p of periods) {
      if (!p.fiscalSignature) {
        results.push({ periodNumber: p.periodNumber, ok: false, detail: 'Keine Signatur vorhanden' });
        continue;
      }
      const input = {
        periodNumber: p.periodNumber,
        closedAt: (p.closedAt || p.openedAt).toISOString(),
        totalGrossCents: p.totalGrossCents ?? 0,
        totalNetCents: p.totalNetCents ?? 0,
        transactionCount: p.transactionCount,
        previousSignature: prev,
      };
      let ok = false;
      try {
        ok = verifyFiscalBlock(p.fiscalSignature, input);
      } catch {
        ok = false;
      }
      results.push({ periodNumber: p.periodNumber, ok, detail: ok ? 'Kette OK' : 'Kette gebrochen (Salt-Wechsel oder Manipulation)' });
      prev = p.fiscalSignature;
    }
    const noTse = await prisma.payment.count({ where: { tseSignature: null } });
    const withTse = await prisma.payment.count({ where: { tseSignature: { not: null } } });
    return NextResponse.json({
      success: true,
      chain: results,
      tse: { withSignature: withTse, withoutSignature: noTse, state: withTse > 0 ? 'PARTIAL' : 'NO_TSE' },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
