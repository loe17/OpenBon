import { NextResponse } from 'next/server';
import { logSystemAction } from '@/lib/action-logger';
import prisma from '@/lib/db';
import networkSpooler from '@/lib/printer/network-spooler';
import { EscPosBuilder } from '@/lib/printer/escpos-builder';
import { computePeriodTotals, getOrCreateOpenPeriod } from '@/lib/register-period';
import { requireApiAuth } from '@/lib/api-guard';

/**
 * Spec 6.7: X-Bon (Kellner-Zwischenstand).
 * Zeigt Schicht-Umsatz, Bar-Soll, Kartensplits und Trinkgeld einer Bedienung,
 * OHNE die Kasse abzuschließen. Zähler bleiben unverändert.
 *
 * GET  /api/reports/x-bon?waiterName=...   -> Kennzahlen als JSON
 * POST /api/reports/x-bon                  -> zusätzlich Belegdruck
 */
async function buildXBon(waiterName: string | null) {
  const period = await getOrCreateOpenPeriod();
  const totals = await computePeriodTotals({
    periodId: period.id,
    waiterName,
    includeUnassigned: true,
  });

  return {
    period,
    report: {
      waiterName: waiterName ?? undefined,
      periodNumber: period.periodNumber,
      openedAt: period.openedAt,
      totalGross: totals.totalGross,
      totalCash: totals.totalCash,
      totalCard: totals.totalCard,
      cardSumUp: totals.cardSumUp,
      cardVrPay: totals.cardVrPay,
      cardSparkasse: totals.cardSparkasse,
      cardTerminal: totals.cardTerminal,
      totalTips: totals.totalTips,
      totalDepositReturned: totals.totalDepositReturned,
      totalStaff: totals.totalStaff,
      // Wechselgeld/Entnahmen sind Kassen-, nicht Kellnergrößen
      cashIn: waiterName ? undefined : totals.cashIn,
      cashOut: waiterName ? undefined : totals.cashOut,
      cashExpected: waiterName ? totals.totalCash : totals.cashExpected,
      transactionCount: totals.transactionCount,
    },
    totals,
  };
}

export async function GET(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const waiterName = searchParams.get('waiterName');
    const { report, totals } = await buildXBon(waiterName);
    return NextResponse.json({ ...report, waiters: totals.waiters });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      waiterName?: string;
      printerId?: string;
    };

    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    const { report } = await buildXBon(body.waiterName ?? null);

    const printer = body.printerId
      ? await prisma.printer.findUnique({ where: { id: body.printerId } })
      : await prisma.printer.findFirst({ where: { isActive: true } });

    if (!printer) {
      return NextResponse.json({ error: 'Kein aktiver Drucker konfiguriert.' }, { status: 400 });
    }

    const { rawBuffer, textRepresentation } = EscPosBuilder.buildXBonTicket(
      { ...report, isTraining: config?.trainingMode ?? false },
      printer.paperWidth
    );

    const result = await networkSpooler.sendRawBuffer(printer, rawBuffer, textRepresentation);

    await logSystemAction({
      action: 'X_BON_PRINTED',
      category: 'CASHBOOK',
      actor: body.waiterName || auth.session.waiterName || auth.session.role,
      details: `X-Bon (Zwischenbericht) gedruckt${body.waiterName ? ` für ${body.waiterName}` : ''}.`,
      metadata: { waiterName: body.waiterName ?? null, printerId: printer.id },
    });

    return NextResponse.json({ success: result.success, isVirtual: result.isVirtual, report });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
