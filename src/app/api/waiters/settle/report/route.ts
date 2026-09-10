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

export interface SettlementItemSold {
  name: string;
  quantity: number;
  amountCents: number;
}

export interface SettlementOrderSummary {
  id: string;
  orderNumber: number;
  time: string;
  tableName: string;
  totalCents: number;
  itemsCount: number;
  itemsSummary: string;
}

export interface SettlementReport {
  waiterName: string;
  periodNumber: number;
  periodOpenedAt: string;
  generatedAt: string;
  totalGross?: number;
  totalGrossCents: number;
  transactionCount: number;
  byMethod: { method: string; label: string; amount?: number; amountCents: number; count: number }[];
  cashGross?: number;
  cashGrossCents: number;
  cashExpected?: number;
  /** Soll-Barbestand: Barumsatz abzueglich der Trinkgelder, die die Bedienung behaelt. */
  cashExpectedCents: number;
  tipsTotal?: number;
  tipsTotalCents: number;
  tipWaiterShare?: number;
  tipWaiterShareCents: number;
  tipPoolShare?: number;
  tipPoolShareCents: number;
  tipProfileName: string | null;
  isTraining: boolean;
  eventName: string;
  orderCount: number;
  itemsSold: SettlementItemSold[];
  orders: SettlementOrderSummary[];
}

export async function GET(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const rawWaiterName = (searchParams.get('waiterName') || '').trim();
    if (!rawWaiterName) {
      return NextResponse.json({ error: 'waiterName ist erforderlich.' }, { status: 400 });
    }

    const cleanWaiterName = rawWaiterName
      .replace(/\s*\(Schicht\s*\d+\)$/i, '')
      .replace(/\s*\(Abgerechnet\)$/i, '')
      .trim();
    const isCorrection = searchParams.get('isCorrection') === 'true';

    const [config, period] = await Promise.all([
      prisma.eventConfig.findUnique({ where: { id: 'default' } }),
      getOrCreateOpenPeriod(),
    ]);

    // Wenn es keine Korrektur ist, prüfen ob die Bedienung zuvor schon abgerechnet wurde
    const latestSettle = await prisma.actionLog.findFirst({
      where: {
        action: { in: ['WAITER_SETTLED', 'WAITER_SETTLEMENT_CORRECTION'] },
        actor: cleanWaiterName,
        createdAt: { gte: period.openedAt },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Bei neuer Schicht nur Umsätze nach dem vorherigen Abschluss zählen
    const shiftStartDate = !isCorrection && latestSettle ? latestSettle.createdAt : period.openedAt;

    const [payments, ordersData, profile] = await Promise.all([
      prisma.payment.findMany({
        where: {
          waiterName: cleanWaiterName,
          isCancelled: false,
          createdAt: { gte: shiftStartDate },
        },
        select: {
          totalGrossCents: true,
          tipAmountCents: true,
          tipWaiterShareCents: true,
          tipPoolShareCents: true,
          paymentMethod: true,
        },
      }),
      prisma.order.findMany({
        where: {
          OR: [
            { waiterName: cleanWaiterName },
            { payments: { some: { waiterName: cleanWaiterName, isCancelled: false } } },
          ],
          status: { not: 'CANCELLED' },
          createdAt: { gte: shiftStartDate },
        },
        include: {
          table: { select: { label: true } },
          items: {
            where: { isCancelled: false },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.waiterProfile.findFirst({
        where: { name: cleanWaiterName },
        select: { tipProfile: { select: { name: true } } },
      }),
    ]);

    let totalGross = 0;
    let cashGross = 0;
    let tipsTotal = 0;
    let tipWaiterShare = 0;
    let tipPoolShare = 0;
    const methodMap = new Map<string, { amount: number; count: number }>();

    for (const p of payments) {
      totalGross += p.totalGrossCents;
      tipsTotal += p.tipAmountCents;
      tipWaiterShare += p.tipWaiterShareCents;
      tipPoolShare += p.tipPoolShareCents;

      const method = p.paymentMethod || 'CASH';
      if (method === 'CASH') cashGross += p.totalGrossCents;

      const entry = methodMap.get(method) || { amount: 0, count: 0 };
      entry.amount += p.totalGrossCents;
      entry.count += 1;
      methodMap.set(method, entry);
    }

    // Detail-Auswertung: Bestellungen & Verkaufte Artikel
    const itemsMap = new Map<string, { quantity: number; amountCents: number }>();

    const orders: SettlementOrderSummary[] = ordersData.map((o) => {
      let orderTotalCents = 0;
      let orderItemsCount = 0;
      const summaryParts: string[] = [];

      for (const item of o.items) {
        const qty = item.quantity || 1;
        const priceCents = (item.unitPriceCents || 0) * qty;
        orderTotalCents += priceCents;
        orderItemsCount += qty;

        const itemName = item.variantName ? `${item.productName} (${item.variantName})` : item.productName;
        summaryParts.push(`${qty}x ${itemName}`);

        const existing = itemsMap.get(itemName) || { quantity: 0, amountCents: 0 };
        existing.quantity += qty;
        existing.amountCents += priceCents;
        itemsMap.set(itemName, existing);
      }

      const tableName = o.table?.label || (o.tokenNumber ? `Token #${o.tokenNumber}` : 'Theke / Ohne Tisch');
      const time = new Date(o.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        time,
        tableName,
        totalCents: orderTotalCents,
        itemsCount: orderItemsCount,
        itemsSummary: summaryParts.join(', ') || 'Keine Artikel',
      };
    });

    const itemsSold: SettlementItemSold[] = Array.from(itemsMap.entries())
      .map(([name, val]) => ({
        name,
        quantity: val.quantity,
        amountCents: val.amountCents,
      }))
      .sort((a, b) => b.quantity - a.quantity || b.amountCents - a.amountCents);

    const cashExpectedCents = Math.round(cashGross - tipWaiterShare);

    const report: SettlementReport = {
      waiterName: rawWaiterName,
      periodNumber: period.periodNumber,
      periodOpenedAt: period.openedAt.toISOString(),
      generatedAt: new Date().toISOString(),
      totalGross: Math.round(totalGross) / 100,
      totalGrossCents: Math.round(totalGross),
      transactionCount: payments.length,
      byMethod: Array.from(methodMap.entries())
        .map(([method, v]) => ({
          method,
          label: getPaymentLabel(method),
          amount: Math.round(v.amount) / 100,
          amountCents: Math.round(v.amount),
          count: v.count,
        }))
        .sort((a, b) => b.amountCents - a.amountCents),
      cashGross: Math.round(cashGross) / 100,
      cashGrossCents: Math.round(cashGross),
      cashExpected: cashExpectedCents / 100,
      cashExpectedCents,
      tipsTotal: Math.round(tipsTotal) / 100,
      tipsTotalCents: Math.round(tipsTotal),
      tipWaiterShare: Math.round(tipWaiterShare) / 100,
      tipWaiterShareCents: Math.round(tipWaiterShare),
      tipPoolShare: Math.round(tipPoolShare) / 100,
      tipPoolShareCents: Math.round(tipPoolShare),
      tipProfileName: profile?.tipProfile?.name ?? null,
      isTraining: config?.trainingMode ?? false,
      eventName: config?.name || 'OpenBon',
      orderCount: orders.length,
      itemsSold,
      orders,
    };

    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('Fehler beim Erstellen der Schichtabrechnung:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
