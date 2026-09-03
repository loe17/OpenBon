import prisma from './db';
import { signFiscalBlock, verifyFiscalBlock } from './fiscal';
import { computeTaxBreakdown, toEuro, type TaxableLine } from './pricing';
import type { TaxSplit, WaiterShiftSummary } from '@/types/domain';

// Re-Export, damit bestehende Importpfade weiterhin funktionieren
export { signFiscalBlock, verifyFiscalBlock };

/**
 * Spec 6.7: Kassenperiode. Der Z-Bon schließt die laufende Periode ab,
 * schreibt einen signierten Fiskalblock fort und setzt die Zähler zurück.
 * Harter Cent-Cut: alle Summen sind Int-Cent.
 */
export async function getOrCreateOpenPeriod() {
  const open = await prisma.registerPeriod.findFirst({
    where: { status: 'OPEN' },
    orderBy: { openedAt: 'desc' },
  });
  if (open) return open;

  const last = await prisma.registerPeriod.findFirst({
    orderBy: { periodNumber: 'desc' },
  });

  return prisma.registerPeriod.create({
    data: { periodNumber: (last?.periodNumber ?? 0) + 1 },
  });
}

export interface PeriodTotals {
  totalGrossCents: number;
  totalNetCents: number;
  taxSplits: TaxSplit[];
  taxAmount19Cents: number;
  taxAmount7Cents: number;
  taxBase0Cents: number;
  totalCashCents: number;
  totalCardCents: number;
  cardSumUpCents: number;
  cardVrPayCents: number;
  cardSparkasseCents: number;
  cardTerminalCents: number;
  totalStaffCents: number;
  totalVoidUnpaidCents: number;
  totalSurchargesCents: number;
  totalDiscountsCents: number;
  totalTipsCents: number;
  totalDepositChargedCents: number;
  totalDepositReturnedCents: number;
  transactionCount: number;
  cashInCents: number;
  cashOutCents: number;
  /** Bar-Soll in Cent = Bareinnahmen + Einlagen - Entnahmen - ausgezahlter Rückpfand */
  cashExpectedCents: number;
  waiters: WaiterShiftSummary[];
  /** @deprecated Anzeige-Euro, abgeleitet aus *Cents */
  totalGross?: number;
  /** @deprecated Anzeige-Euro */
  totalNet?: number;
  /** @deprecated Anzeige-Euro */
  taxAmount19?: number;
  /** @deprecated Anzeige-Euro */
  taxAmount7?: number;
  /** @deprecated Anzeige-Euro */
  taxBase0?: number;
  /** @deprecated Anzeige-Euro */
  totalCash?: number;
  /** @deprecated Anzeige-Euro */
  totalCard?: number;
  /** @deprecated Anzeige-Euro */
  cardSumUp?: number;
  /** @deprecated Anzeige-Euro */
  cardVrPay?: number;
  /** @deprecated Anzeige-Euro */
  cardSparkasse?: number;
  /** @deprecated Anzeige-Euro */
  cardTerminal?: number;
  /** @deprecated Anzeige-Euro */
  totalStaff?: number;
  /** @deprecated Anzeige-Euro */
  totalVoidUnpaid?: number;
  /** @deprecated Anzeige-Euro */
  totalSurcharges?: number;
  /** @deprecated Anzeige-Euro */
  totalDiscounts?: number;
  /** @deprecated Anzeige-Euro */
  totalTips?: number;
  /** @deprecated Anzeige-Euro */
  totalDepositCharged?: number;
  /** @deprecated Anzeige-Euro */
  totalDepositReturned?: number;
  /** @deprecated Anzeige-Euro */
  cashIn?: number;
  /** @deprecated Anzeige-Euro */
  cashOut?: number;
  /** @deprecated Anzeige-Euro */
  cashExpected?: number;
}

interface PeriodFilter {
  periodId?: string | null;
  waiterName?: string | null;
  /** true = auch Zahlungen ohne Periodenzuordnung berücksichtigen (Altbestand) */
  includeUnassigned?: boolean;
}

/**
 * Aggregiert alle Kennzahlen einer Kassenperiode – Grundlage für X-Bon und Z-Bon.
 * Reine Int-Cent-Arithmetik, kein round2 in der Logik.
 */
export async function computePeriodTotals(filter: PeriodFilter = {}): Promise<PeriodTotals> {
  const paymentWhere: Record<string, unknown> = {
    isCancelled: false,
    isTraining: false,
  };
  if (filter.periodId) {
    if (filter.includeUnassigned) {
      paymentWhere.OR = [
        { periodId: filter.periodId },
        { periodId: null },
      ];
    } else {
      paymentWhere.periodId = filter.periodId;
    }
  }
  if (filter.waiterName) {
    paymentWhere.waiterName = filter.waiterName;
  }

  const [payments, movements] = await Promise.all([
    prisma.payment.findMany({
      where: paymentWhere,
      include: { items: true },
    }),
    prisma.cashMovement.findMany({
      where: filter.periodId
        ? { periodId: filter.periodId, isTraining: false }
        : { isTraining: false },
    }),
  ]);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  let totalGrossCents = 0;
  let totalCashCents = 0;
  let cardSumUpCents = 0;
  let cardVrPayCents = 0;
  let cardSparkasseCents = 0;
  let cardTerminalCents = 0;
  let totalStaffCents = 0;
  let totalVoidUnpaidCents = 0;
  let totalSurchargesCents = 0;
  let totalDiscountsCents = 0;
  let totalTipsCents = 0;
  let totalDepositChargedCents = 0;
  let totalDepositReturnedCents = 0;

  const taxLines: TaxableLine[] = [];
  const waiterMap = new Map<string, WaiterShiftSummary>();

  for (const payment of payments) {
    const method = payment.paymentMethod;
    const isRevenue = !method.startsWith('NON_PAID') && method !== 'VOID_UNPAID';

    if (isRevenue) {
      totalGrossCents += payment.totalGrossCents;
      totalSurchargesCents += payment.surchargeAmountCents;
      totalDiscountsCents += payment.discountAmountCents;
      totalTipsCents += payment.tipAmountCents;
      totalDepositChargedCents += payment.totalDepositCents;
      totalDepositReturnedCents += payment.returnDepositCents;

      for (const item of payment.items) {
        taxLines.push({
          unitPriceCents: item.unitPriceCents,
          depositCents: item.depositCents,
          quantity: item.quantity,
          taxRate: item.taxRate,
        });
      }
    }

    switch (method) {
      case 'CASH':
        totalCashCents += payment.totalGrossCents;
        break;
      case 'CARD_SUMUP':
        cardSumUpCents += payment.totalGrossCents;
        break;
      case 'CARD_VRPAY':
        cardVrPayCents += payment.totalGrossCents;
        break;
      case 'CARD_SPARKASSE':
        cardSparkasseCents += payment.totalGrossCents;
        break;
      case 'CARD_TERMINAL':
        cardTerminalCents += payment.totalGrossCents;
        break;
      case 'VOID_UNPAID':
        totalVoidUnpaidCents += payment.totalGrossCents;
        break;
      default:
        if (method.startsWith('NON_PAID')) totalStaffCents += payment.totalGrossCents;
        break;
    }

    const name = payment.waiterName || 'Unbekannt';
    if (!waiterMap.has(name)) {
      waiterMap.set(name, {
        waiterName: name,
        totalGrossCents: 0,
        cashGrossCents: 0,
        cardGrossCents: 0,
        tipsCents: 0,
        depositReturnedCents: 0,
        transactionCount: 0,
        ordersLastHour: 0,
        salesLastHourCents: 0,
      });
    }
    const w = waiterMap.get(name)!;
    if (isRevenue) {
      w.transactionCount++;
      w.totalGrossCents += payment.totalGrossCents;
      w.tipsCents += payment.tipAmountCents;
      w.depositReturnedCents += payment.returnDepositCents;
      if (payment.createdAt >= oneHourAgo) {
        w.ordersLastHour++;
        w.salesLastHourCents += payment.totalGrossCents;
      }
      if (method === 'CASH') w.cashGrossCents += payment.totalGrossCents;
      else if (method.startsWith('CARD')) w.cardGrossCents += payment.totalGrossCents;
    }
  }

  const breakdown = computeTaxBreakdown(taxLines);
  const findRate = (rate: number) => breakdown.splits.find((s) => s.rate === rate);

  const cashInCents = movements
    .filter((m) => m.type === 'CASH_IN')
    .reduce((s, m) => s + m.amountCents, 0);
  const cashOutCents = movements
    .filter((m) => m.type === 'CASH_OUT')
    .reduce((s, m) => s + m.amountCents, 0);

  const totalCardCents = cardSumUpCents + cardVrPayCents + cardSparkasseCents + cardTerminalCents;

  const waiters = Array.from(waiterMap.values())
    .map((w) => ({
      ...w,
      totalGross: toEuro(w.totalGrossCents),
      cashGross: toEuro(w.cashGrossCents),
      cardGross: toEuro(w.cardGrossCents),
      tips: toEuro(w.tipsCents),
      depositReturned: toEuro(w.depositReturnedCents),
      salesLastHour: toEuro(w.salesLastHourCents),
    }))
    .sort((a, b) => b.totalGrossCents - a.totalGrossCents)
    .map((w, idx) => ({ ...w, rank: idx + 1 }));

  const totalNetCents = breakdown.netCents;
  const taxAmount19Cents = findRate(19)?.taxCents ?? 0;
  const taxAmount7Cents = findRate(7)?.taxCents ?? 0;
  const taxBase0Cents = findRate(0)?.baseCents ?? 0;
  const cashExpectedCents = totalCashCents + cashInCents - cashOutCents - totalDepositReturnedCents;

  return {
    totalGrossCents,
    totalNetCents,
    taxSplits: breakdown.splits,
    taxAmount19Cents,
    taxAmount7Cents,
    taxBase0Cents,
    totalCashCents,
    totalCardCents,
    cardSumUpCents,
    cardVrPayCents,
    cardSparkasseCents,
    cardTerminalCents,
    totalStaffCents,
    totalVoidUnpaidCents,
    totalSurchargesCents,
    totalDiscountsCents,
    totalTipsCents,
    totalDepositChargedCents,
    totalDepositReturnedCents,
    transactionCount: payments.filter(
      (p) => !p.paymentMethod.startsWith('NON_PAID') && p.paymentMethod !== 'VOID_UNPAID'
    ).length,
    cashInCents,
    cashOutCents,
    cashExpectedCents,
    waiters,
    totalGross: toEuro(totalGrossCents),
    totalNet: toEuro(totalNetCents),
    taxAmount19: toEuro(taxAmount19Cents),
    taxAmount7: toEuro(taxAmount7Cents),
    taxBase0: toEuro(taxBase0Cents),
    totalCash: toEuro(totalCashCents),
    totalCard: toEuro(totalCardCents),
    cardSumUp: toEuro(cardSumUpCents),
    cardVrPay: toEuro(cardVrPayCents),
    cardSparkasse: toEuro(cardSparkasseCents),
    cardTerminal: toEuro(cardTerminalCents),
    totalStaff: toEuro(totalStaffCents),
    totalVoidUnpaid: toEuro(totalVoidUnpaidCents),
    totalSurcharges: toEuro(totalSurchargesCents),
    totalDiscounts: toEuro(totalDiscountsCents),
    totalTips: toEuro(totalTipsCents),
    totalDepositCharged: toEuro(totalDepositChargedCents),
    totalDepositReturned: toEuro(totalDepositReturnedCents),
    cashIn: toEuro(cashInCents),
    cashOut: toEuro(cashOutCents),
    cashExpected: toEuro(cashExpectedCents),
  };
}
