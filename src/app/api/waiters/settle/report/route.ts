import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';
import { getOrCreateOpenPeriod } from '@/lib/register-period';
import { getPaymentLabel } from '@/lib/payment/methods';

/**
 * Berechnet die Schichtabrechnung einer Bedienung - serverseitig und an EINER
 * Stelle.
 *
 * Warum hier und nicht in der Oberflaeche: Bildschirmansicht, Papierbeleg und
 * PDF muessen zwingend dieselben Zahlen zeigen. Rechnet die Oberflaeche selbst,
 * genuegt eine abweichende Rundung, und der unterschriebene Beleg widerspricht
 * dem, was am Bildschirm stand.
 *
 * Beruecksichtigt wird ausschliesslich die laufende Kassenperiode (seit dem
 * letzten Z-Bon) - eine Schichtabrechnung ueber einen bereits abgeschlossenen
 * Kassentag waere sachlich falsch.
 */

export interface SettlementReport {
  waiterName: string;
  periodNumber: number;
  periodOpenedAt: string;
  generatedAt: string;
  totalGross: number;
  transactionCount: number;
  byMethod: { method: string; label: string; amount: number; count: number }[];
  cashGross: number;
  /** Soll-Barbestand: Barumsatz abzueglich der Trinkgelder, die die Bedienung behaelt. */
  cashExpected: number;
  tipsTotal: number;
  tipWaiterShare: number;
  tipPoolShare: number;
  tipProfileName: string | null;
  isTraining: boolean;
  eventName: string;
}

export async function GET(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const waiterName = (searchParams.get('waiterName') || '').trim();

    if (!waiterName) {
      return NextResponse.json({ error: 'waiterName ist erforderlich.' }, { status: 400 });
    }

    const [config, period] = await Promise.all([
      prisma.eventConfig.findUnique({ where: { id: 'default' } }),
      getOrCreateOpenPeriod(),
    ]);

    const payments = await prisma.payment.findMany({
      where: {
        waiterName,
        isCancelled: false,
        createdAt: { gte: period.openedAt },
      },
      select: {
        totalGross: true,
        tipAmount: true,
        tipWaiterShare: true,
        tipPoolShare: true,
        paymentMethod: true,
      },
    });

    let totalGross = 0;
    let cashGross = 0;
    let tipsTotal = 0;
    let tipWaiterShare = 0;
    let tipPoolShare = 0;
    const methodMap = new Map<string, { amount: number; count: number }>();

    for (const p of payments) {
      totalGross += p.totalGross;
      tipsTotal += p.tipAmount;
      tipWaiterShare += p.tipWaiterShare;
      tipPoolShare += p.tipPoolShare;

      const method = p.paymentMethod || 'CASH';
      if (method === 'CASH') cashGross += p.totalGross;

      const entry = methodMap.get(method) || { amount: 0, count: 0 };
      entry.amount += p.totalGross;
      entry.count += 1;
      methodMap.set(method, entry);
    }

    // Trinkgeldprofil der Bedienung fuer die Beschriftung der Verteilung
    const profile = await prisma.waiterProfile.findFirst({
      where: { name: waiterName },
      select: { tipProfile: { select: { name: true } } },
    });

    const round2 = (v: number) => Math.round(v * 100) / 100;

    // Soll-Barbestand: Was die Bedienung abgeben muss. Der Anteil am
    // Trinkgeld, den sie behaelt, wird abgezogen; der Pool-Anteil bleibt drin.
    const cashExpected = round2(cashGross - tipWaiterShare);

    const report: SettlementReport = {
      waiterName,
      periodNumber: period.periodNumber,
      periodOpenedAt: period.openedAt.toISOString(),
      generatedAt: new Date().toISOString(),
      totalGross: round2(totalGross),
      transactionCount: payments.length,
      byMethod: Array.from(methodMap.entries())
        .map(([method, v]) => ({
          method,
          label: getPaymentLabel(method),
          amount: round2(v.amount),
          count: v.count,
        }))
        .sort((a, b) => b.amount - a.amount),
      cashGross: round2(cashGross),
      cashExpected,
      tipsTotal: round2(tipsTotal),
      tipWaiterShare: round2(tipWaiterShare),
      tipPoolShare: round2(tipPoolShare),
      tipProfileName: profile?.tipProfile?.name ?? null,
      isTraining: config?.trainingMode ?? false,
      eventName: config?.name || 'OpenBon',
    };

    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('Fehler beim Erstellen der Schichtabrechnung:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
