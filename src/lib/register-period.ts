import prisma from './db';
import { signFiscalBlock, verifyFiscalBlock } from './fiscal';
import { computeTaxBreakdown, round2, type TaxableLine } from './pricing';
import type { TaxSplit, WaiterShiftSummary } from '@/types/domain';

// Re-Export, damit bestehende Importpfade weiterhin funktionieren
export { signFiscalBlock, verifyFiscalBlock };

/**
 * Spec 6.7: Kassenperiode. Der Z-Bon schließt die laufende Periode ab,
 * schreibt einen signierten Fiskalblock fort und setzt die Zähler zurück.
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
  totalGross: number;
  totalNet: number;
  taxSplits: TaxSplit[];
  taxAmount19: number;
  taxAmount7: number;
  taxBase0: number;
  totalCash: number;
  totalCard: number;
  cardSumUp: number;
  cardVrPay: number;
  cardSparkasse: number;
  cardTerminal: number;
  totalStaff: number;
  totalVoidUnpaid: number;
  totalSurcharges: number;
  totalDiscounts: number;
  totalTips: number;
  totalDepositCharged: number;
  totalDepositReturned: number;
  transactionCount: number;
  cashIn: number;
  cashOut: number;
  /** Bar-Soll = Bareinnahmen + Einlagen - Entnahmen - ausgezahlter Rückpfand */
  cashExpected: number;
  waiters: WaiterShiftSummary[];
}

interface PeriodFilter {
  periodId?: string | null;
  waiterName?: string | null;
  /** true = auch Zahlungen ohne Periodenzuordnung berücksichtigen (Altbestand) */
  includeUnassigned?: boolean;
}

/**
 * Aggregiert alle Kennzahlen einer Kassenperiode – Grundlage für X-Bon und Z-Bon.
 */
export async function computePeriodTotals(filter: PeriodFilter = {}): Promise<PeriodTotals> {
  const paymentWhere: Record<string, unknown> = {
    isCancelled: false,
    isTraining: false,
  };
  if (filter.periodId) {
    paymentWhere.periodId = filter.includeUnassigned
      ? { in: [filter.periodId, null] }
      : filter.periodId;
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

  let totalGross = 0;
  let totalCash = 0;
  let cardSumUp = 0;
  let cardVrPay = 0;
  let cardSparkasse = 0;
  let cardTerminal = 0;
  let totalStaff = 0;
  let totalVoidUnpaid = 0;
  let totalSurcharges = 0;
  let totalDiscounts = 0;
  let totalTips = 0;
  let totalDepositCharged = 0;
  let totalDepositReturned = 0;

  const taxLines: TaxableLine[] = [];
  const waiterMap = new Map<string, WaiterShiftSummary>();

  for (const payment of payments) {
    const method = payment.paymentMethod;
    const isRevenue = !method.startsWith('NON_PAID') && method !== 'VOID_UNPAID';

    if (isRevenue) {
      totalGross += payment.totalGross;
      totalSurcharges += payment.surchargeAmount;
      totalDiscounts += payment.discountAmount;
      totalTips += payment.tipAmount;
      totalDepositCharged += payment.totalDeposit;
      totalDepositReturned += payment.returnDeposit;

      for (const item of payment.items) {
        taxLines.push({
          unitPrice: item.unitPrice,
          deposit: item.deposit,
          quantity: item.quantity,
          taxRate: item.taxRate,
        });
      }
    }

    switch (method) {
      case 'CASH':
        totalCash += payment.totalGross;
        break;
      case 'CARD_SUMUP':
        cardSumUp += payment.totalGross;
        break;
      case 'CARD_VRPAY':
        cardVrPay += payment.totalGross;
        break;
      case 'CARD_SPARKASSE':
        cardSparkasse += payment.totalGross;
        break;
      case 'CARD_TERMINAL':
        cardTerminal += payment.totalGross;
        break;
      case 'VOID_UNPAID':
        totalVoidUnpaid += payment.totalGross;
        break;
      default:
        if (method.startsWith('NON_PAID')) totalStaff += payment.totalGross;
        break;
    }

    const name = payment.waiterName || 'Unbekannt';
    if (!waiterMap.has(name)) {
      waiterMap.set(name, {
        waiterName: name,
        totalGross: 0,
        cashGross: 0,
        cardGross: 0,
        tips: 0,
        depositReturned: 0,
        transactionCount: 0,
        ordersLastHour: 0,
        salesLastHour: 0,
      });
    }
    const w = waiterMap.get(name)!;
    if (isRevenue) {
      w.transactionCount++;
      w.totalGross += payment.totalGross;
      w.tips += payment.tipAmount;
      w.depositReturned += payment.returnDeposit;
      if (payment.createdAt >= oneHourAgo) {
        w.ordersLastHour++;
        w.salesLastHour += payment.totalGross;
      }
      if (method === 'CASH') w.cashGross += payment.totalGross;
      else if (method.startsWith('CARD')) w.cardGross += payment.totalGross;
    }
  }

  const breakdown = computeTaxBreakdown(taxLines);
  const findRate = (rate: number) => breakdown.splits.find((s) => s.rate === rate);

  const cashIn = movements
    .filter((m) => m.type === 'CASH_IN')
    .reduce((s, m) => s + m.amount, 0);
  const cashOut = movements
    .filter((m) => m.type === 'CASH_OUT')
    .reduce((s, m) => s + m.amount, 0);

  const totalCard = cardSumUp + cardVrPay + cardSparkasse + cardTerminal;

  const waiters = Array.from(waiterMap.values())
    .map((w) => ({
      ...w,
      totalGross: round2(w.totalGross),
      cashGross: round2(w.cashGross),
      cardGross: round2(w.cardGross),
      tips: round2(w.tips),
      depositReturned: round2(w.depositReturned),
      salesLastHour: round2(w.salesLastHour),
    }))
    .sort((a, b) => b.totalGross - a.totalGross)
    .map((w, idx) => ({ ...w, rank: idx + 1 }));

  return {
    totalGross: round2(totalGross),
    totalNet: round2(breakdown.netTotal),
    taxSplits: breakdown.splits,
    taxAmount19: round2(findRate(19)?.tax ?? 0),
    taxAmount7: round2(findRate(7)?.tax ?? 0),
    taxBase0: round2(findRate(0)?.base ?? 0),
    totalCash: round2(totalCash),
    totalCard: round2(totalCard),
    cardSumUp: round2(cardSumUp),
    cardVrPay: round2(cardVrPay),
    cardSparkasse: round2(cardSparkasse),
    cardTerminal: round2(cardTerminal),
    totalStaff: round2(totalStaff),
    totalVoidUnpaid: round2(totalVoidUnpaid),
    totalSurcharges: round2(totalSurcharges),
    totalDiscounts: round2(totalDiscounts),
    totalTips: round2(totalTips),
    totalDepositCharged: round2(totalDepositCharged),
    totalDepositReturned: round2(totalDepositReturned),
    transactionCount: payments.filter(
      (p) => !p.paymentMethod.startsWith('NON_PAID') && p.paymentMethod !== 'VOID_UNPAID'
    ).length,
    cashIn: round2(cashIn),
    cashOut: round2(cashOut),
    cashExpected: round2(totalCash + cashIn - cashOut - totalDepositReturned),
    waiters,
  };
}
