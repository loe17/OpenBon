import type { TaxSplit } from '@/types/domain';

/**
 * Zentrale Preis- und Steuer-Engine (Spec 7.1.1 + V2 Happy Hour).
 *
 * Cent-harter Cut: alle Berechnungen laufen intern in Cent (Ganzzahlen).
 * Die API akzeptiert sowohl Cent-Felder (*Cents) als auch Legacy Euro-Floats
 * (unitPrice, deposit, ...) und gibt immer BEIDES zurück (Cents + Euro-Aliase),
 * damit altes Backend und neues Frontend während der Migration grün bleiben.
 */

export function toCents(euro: number): number {
  return Math.round((euro + Number.EPSILON) * 100);
}

export function toEuro(cents: number): number {
  return Math.round(cents) / 100;
}

/** Kaufmaennisch runden auf 2 Nachkommastellen. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function resolveCents(centsVal: number | null | undefined, euroVal: number | null | undefined): number {
  if (typeof centsVal === 'number' && Number.isFinite(centsVal)) return Math.round(centsVal);
  if (typeof euroVal === 'number' && Number.isFinite(euroVal)) return toCents(euroVal);
  return 0;
}

export interface TaxableLine {
  /** Cent-hart (bevorzugt) */
  unitPriceCents?: number;
  depositCents?: number;
  /** Legacy Euro-Float (Fallback) */
  unitPrice?: number;
  deposit?: number;
  quantity: number;
  taxRate: number;
}

export interface TaxBreakdown {
  /** Cent-hart (primär) */
  grossCents: number;
  netCents: number;
  taxCents: number;
  depositCents: number;
  /** Legacy Euro-Aliase */
  grossTotal: number;
  netTotal: number;
  taxTotal: number;
  depositTotal: number;
  /** Aufschluesselung je Steuersatz, aufsteigend sortiert */
  splits: TaxSplit[];
}

/**
 * Rechnet eine Positionsliste in eine cent-genaue Steueraufschluesselung um.
 * Der Bruttopreis ist fuehrend (Gastronomie-Preisauszeichnung), die Steuer
 * wird herausgerechnet.
 */
export function computeTaxBreakdown(lines: TaxableLine[]): TaxBreakdown {
  const byRate = new Map<number, { grossCents: number }>();
  let depositCentsTotal = 0;

  for (const line of lines) {
    const qty = Math.max(0, Math.trunc(line.quantity));
    if (qty === 0) continue;

    const unitCents = resolveCents(
      (line as { unitPriceCents?: number }).unitPriceCents,
      (line as { unitPrice?: number }).unitPrice
    );
    const depCents = resolveCents(
      (line as { depositCents?: number }).depositCents,
      (line as { deposit?: number }).deposit
    );
    const itemGrossCents = unitCents * qty;
    const rate = Number.isFinite(line.taxRate) ? line.taxRate : 19;
    const bucket = byRate.get(rate) ?? { grossCents: 0 };
    bucket.grossCents += itemGrossCents;
    byRate.set(rate, bucket);

    depositCentsTotal += depCents * qty;
  }

  const splits: TaxSplit[] = [];
  let netCents = 0;
  let taxCents = 0;

  for (const [rate, bucket] of Array.from(byRate.entries()).sort((a, b) => a[0] - b[0])) {
    const lineNetCents = Math.round(bucket.grossCents / (1 + rate / 100));
    const lineTaxCents = bucket.grossCents - lineNetCents;
    netCents += lineNetCents;
    taxCents += lineTaxCents;
    splits.push({
      rate,
      baseCents: lineNetCents,
      taxCents: lineTaxCents,
      grossCents: bucket.grossCents,
      base: toEuro(lineNetCents),
      tax: toEuro(lineTaxCents),
      gross: toEuro(bucket.grossCents),
    });
  }

  // Pfand als eigener 0 %-Block, sofern vorhanden
  if (depositCentsTotal > 0) {
    const zero = splits.find((s) => s.rate === 0);
    if (zero) {
      zero.baseCents += depositCentsTotal;
      zero.grossCents += depositCentsTotal;
      zero.base = round2((zero.base ?? 0) + toEuro(depositCentsTotal));
      zero.gross = round2((zero.gross ?? 0) + toEuro(depositCentsTotal));
    } else {
      splits.push({ rate: 0, baseCents: depositCentsTotal, taxCents: 0, grossCents: depositCentsTotal, base: toEuro(depositCentsTotal), tax: 0, gross: toEuro(depositCentsTotal) });
      splits.sort((a, b) => a.rate - b.rate);
    }
    netCents += depositCentsTotal;
  }

  const grossCents = Array.from(byRate.values()).reduce((s, b) => s + b.grossCents, 0) + depositCentsTotal;

  return {
    grossCents,
    netCents,
    taxCents,
    depositCents: depositCentsTotal,
    grossTotal: toEuro(grossCents),
    netTotal: toEuro(netCents),
    taxTotal: toEuro(taxCents),
    depositTotal: toEuro(depositCentsTotal),
    splits,
  };
}

export function findSplit(splits: TaxSplit[], rate: number): TaxSplit {
  return splits.find((s) => s.rate === rate) ?? { rate, baseCents: 0, taxCents: 0, grossCents: 0, base: 0, tax: 0, gross: 0 };
}

export interface CheckoutInput {
  lines: TaxableLine[];
  returnDepositCents?: number;
  returnDepositAmount?: number;
  discountCents?: number;
  discountAmount?: number;
  surchargeFixedCents?: number;
  surchargeFixed?: number;
  surchargePercent?: number;
  tipCents?: number;
  tipAmount?: number;
  givenCents?: number;
  givenAmount?: number;
}

export interface CheckoutResult extends TaxBreakdown {
  surchargeCents: number;
  surchargeTotal: number;
  discountCents: number;
  discountAmount: number;
  returnDepositCents: number;
  returnDeposit: number;
  tipCents: number;
  tipAmount: number;
  /** Zu zahlender Betrag ohne Trinkgeld */
  amountDueCents: number;
  amountDue: number;
  /** Zu zahlender Betrag inkl. Trinkgeld */
  amountDueWithTipCents: number;
  amountDueWithTip: number;
  givenCents: number;
  givenAmount: number;
  changeCents: number;
  changeAmount: number;
}

/**
 * Vollstaendige Rechnungsberechnung inkl. Rueckpfand, Rabatt, Aufschlag,
 * Trinkgeld und Rueckgeld – identisch verwendet in UI und API,
 * damit Anzeige und Buchung nie auseinanderlaufen.
 */
export function computeCheckout(input: CheckoutInput): CheckoutResult {
  const breakdown = computeTaxBreakdown(input.lines);

  const grossCents = breakdown.grossCents;
  const surchargePercent = input.surchargePercent ?? 0;
  const surchargeCents =
    resolveCents(input.surchargeFixedCents, input.surchargeFixed) +
    Math.round((grossCents * surchargePercent) / 100);
  const discountCents = resolveCents(input.discountCents, input.discountAmount);
  const returnDepositCentsVal = resolveCents(input.returnDepositCents, input.returnDepositAmount);
  const tipCentsVal = resolveCents(input.tipCents, input.tipAmount);

  const dueCents = Math.max(0, grossCents - returnDepositCentsVal - discountCents + surchargeCents);
  const givenCentsVal = resolveCents(input.givenCents, input.givenAmount);
  const changeCentsVal = givenCentsVal > 0 ? Math.max(0, givenCentsVal - dueCents - tipCentsVal) : 0;

  // Aufschlag wird mit dem hoechsten vorkommenden Steuersatz versteuert,
  // ersatzweise mit dem Normalsatz.
  const splits = breakdown.splits.map((s) => ({ ...s }));
  if (surchargeCents > 0) {
    const rate = splits.filter((s) => s.rate > 0).sort((a, b) => b.rate - a.rate)[0]?.rate ?? 19;
    const target = splits.find((s) => s.rate === rate);
    const netCentsAdd = Math.round(surchargeCents / (1 + rate / 100));
    if (target) {
      target.baseCents += netCentsAdd;
      target.taxCents += surchargeCents - netCentsAdd;
      target.grossCents += surchargeCents;
      target.base = round2((target.base ?? 0) + toEuro(netCentsAdd));
      target.tax = round2((target.tax ?? 0) + toEuro(surchargeCents - netCentsAdd));
      target.gross = round2((target.gross ?? 0) + toEuro(surchargeCents));
    } else {
      splits.push({
        rate,
        baseCents: netCentsAdd,
        taxCents: surchargeCents - netCentsAdd,
        grossCents: surchargeCents,
        base: toEuro(netCentsAdd),
        tax: toEuro(surchargeCents - netCentsAdd),
        gross: toEuro(surchargeCents),
      });
      splits.sort((a, b) => a.rate - b.rate);
    }
  }

  const netTotal = round2(splits.reduce((s, x) => s + (x.base ?? 0), 0));
  const taxTotal = round2(splits.reduce((s, x) => s + (x.tax ?? 0), 0));

  return {
    ...breakdown,
    splits,
    netTotal,
    taxTotal,
    netCents: toCents(netTotal),
    taxCents: toCents(taxTotal),
    surchargeCents,
    surchargeTotal: toEuro(surchargeCents),
    discountCents,
    discountAmount: toEuro(discountCents),
    returnDepositCents: returnDepositCentsVal,
    returnDeposit: toEuro(returnDepositCentsVal),
    tipCents: tipCentsVal,
    tipAmount: toEuro(tipCentsVal),
    amountDueCents: dueCents,
    amountDue: toEuro(dueCents),
    amountDueWithTipCents: dueCents + tipCentsVal,
    amountDueWithTip: toEuro(dueCents + tipCentsVal),
    givenCents: givenCentsVal,
    givenAmount: toEuro(givenCentsVal),
    changeCents: changeCentsVal,
    changeAmount: toEuro(changeCentsVal),
  };
}

/** Spec 5.3: Schnellwahltasten fuer Banknoten & Muenzen */
export const CASH_QUICK_NOTES = [5, 10, 20, 50, 100, 200] as const;
export const CASH_NOTE_VALUES = [200, 100, 50, 20, 10, 5] as const;
export const CASH_COIN_VALUES = [2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01] as const;
/** Cent-Varianten für Keypad/Rechner (harter Cut) */
export const CASH_QUICK_NOTES_CENTS = [500, 1000, 2000, 5000, 10000, 20000] as const;
export const CASH_COIN_VALUES_CENTS = [200, 100, 50, 20, 10, 5, 2, 1] as const;

/**
 * Schlaegt die naechstliegenden Scheine oberhalb des Rechnungsbetrags vor
 * (fuer die dynamische Belegung der Schnellwahltasten).
 * Akzeptiert Euro oder Cent (Erkennung via amountDueCents-Option).
 */
export function suggestCashNotes(amountDue: number, count = 4): number[] {
  const all = [5, 10, 20, 50, 100, 200];
  const above = all.filter((n) => n >= amountDue);
  if (above.length >= count) return above.slice(0, count);
  return all.slice(-count);
}

export function suggestCashNotesCents(amountDueCents: number, count = 4): number[] {
  return suggestCashNotes(amountDueCents / 100, count).map((n) => Math.round(n * 100));
}

/** V2 Spec 6.5: Happy-Hour & Zeit-Aktionspreise (Mehrfach-Regeln) */
export interface HappyHourRule {
  id?: string;
  name?: string;
  /** Cent-hart (bevorzugt) */
  priceCents?: number;
  /** Legacy Euro */
  price?: number;
  start: string; // Format "HH:mm" z. B. "17:00"
  end: string;   // Format "HH:mm" z. B. "19:00"
  days?: number[]; // [0,1,2,3,4,5,6] (0 = Sonntag)
  // Legacy-Aliase aus Admin-UI
  startTime?: string;
  endTime?: string;
  label?: string;
}

export interface HappyHourConfig {
  happyHourPriceCents?: number | null;
  happyHourPrice?: number | null;
  happyHourStart?: string | null; // Format "HH:mm" z. B. "18:00"
  happyHourEnd?: string | null;   // Format "HH:mm" z. B. "19:00"
  happyHourDays?: string | null;  // JSON-Array String z. B. "[1,2,3,4,5]" (0=So, 1=Mo, ...)
  happyHourRules?: string | null; // JSON-Array String von HappyHourRule[]
}

function rulePriceCents(rule: { priceCents?: number | null; price?: number | null }): number | null {
  if (typeof rule.priceCents === 'number' && Number.isFinite(rule.priceCents)) return Math.round(rule.priceCents);
  if (typeof rule.price === 'number' && Number.isFinite(rule.price)) return toCents(rule.price);
  return null;
}

export function isSingleRuleActive(
  rule: { price?: number | null; priceCents?: number | null; start?: string | null; end?: string | null; startTime?: string | null; endTime?: string | null; days?: number[] | string | null },
  targetDate: Date = new Date()
): boolean {
  const cents = rulePriceCents(rule as { priceCents?: number | null; price?: number | null });
  if (cents === null) return false;
  const start = rule.start ?? rule.startTime ?? null;
  const end = rule.end ?? rule.endTime ?? null;
  if (!start || !end) return false;

  if (rule.days) {
    try {
      const activeDays: number[] = Array.isArray(rule.days) ? rule.days : JSON.parse(String(rule.days));
      if (Array.isArray(activeDays) && activeDays.length > 0) {
        const currentDay = targetDate.getDay();
        if (!activeDays.includes(currentDay)) {
          return false;
        }
      }
    } catch {}
  }

  const hours = targetDate.getHours().toString().padStart(2, '0');
  const minutes = targetDate.getMinutes().toString().padStart(2, '0');
  const currentTimeStr = `${hours}:${minutes}`;

  return currentTimeStr >= start && currentTimeStr <= end;
}

export function isHappyHourActive(config: HappyHourConfig, targetDate: Date = new Date()): boolean {
  // 1. Prüfe Mehrfach-Regeln
  if (config.happyHourRules) {
    try {
      const rules: HappyHourRule[] = JSON.parse(config.happyHourRules);
      if (Array.isArray(rules) && rules.length > 0) {
        return rules.some((r) => isSingleRuleActive(r as unknown as Parameters<typeof isSingleRuleActive>[0], targetDate));
      }
    } catch {}
  }

  // 2. Fallback auf Einzel-Regel
  return isSingleRuleActive(
    {
      price: config.happyHourPrice ?? undefined,
      priceCents: config.happyHourPriceCents ?? undefined,
      start: config.happyHourStart,
      end: config.happyHourEnd,
      days: config.happyHourDays,
    },
    targetDate
  );
}

export interface EffectivePrice {
  /** Cent-hart (primär) */
  priceCents: number;
  /** Legacy Euro-Alias */
  price: number;
  isHappyHour: boolean;
  ruleName?: string;
}

function productBaseCents(product: { priceCents?: number | null; price?: number | null }): number | null {
  if (typeof (product as { priceCents?: number }).priceCents === 'number' && Number.isFinite((product as { priceCents?: number }).priceCents!)) {
    return Math.round((product as { priceCents: number }).priceCents);
  }
  if (typeof (product as { price?: number }).price === 'number' && Number.isFinite((product as { price: number }).price)) {
    return toCents((product as { price: number }).price);
  }
  return null;
}

export function getEffectiveProductPrice(
  product: { priceCents?: number | null; price?: number | null } & HappyHourConfig,
  targetDate: Date = new Date()
): EffectivePrice {
  // 1. Prüfe Mehrfach-Regeln
  if (product.happyHourRules) {
    try {
      const rules: HappyHourRule[] = JSON.parse(product.happyHourRules);
      if (Array.isArray(rules) && rules.length > 0) {
        const matchingRule = rules.find((r) => isSingleRuleActive(r as unknown as Parameters<typeof isSingleRuleActive>[0], targetDate));
        if (matchingRule) {
          const cents = rulePriceCents(matchingRule);
          if (cents !== null) {
            return {
              priceCents: cents,
              price: toEuro(cents),
              isHappyHour: true,
              ruleName: matchingRule.name ?? (matchingRule as { label?: string }).label,
            };
          }
        }
      }
    } catch {}
  }

  // 2. Fallback auf Einzel-Regel
  if (
    isSingleRuleActive(
      {
        price: product.happyHourPrice ?? undefined,
        priceCents: product.happyHourPriceCents ?? undefined,
        start: product.happyHourStart,
        end: product.happyHourEnd,
        days: product.happyHourDays,
      },
      targetDate
    )
  ) {
    const cents = rulePriceCents({ price: product.happyHourPrice ?? undefined, priceCents: product.happyHourPriceCents ?? undefined });
    if (cents !== null) {
      return {
        priceCents: cents,
        price: toEuro(cents),
        isHappyHour: true,
      };
    }
  }

  const base = productBaseCents(product) ?? 0;
  return {
    priceCents: base,
    price: toEuro(base),
    isHappyHour: false,
  };
}
