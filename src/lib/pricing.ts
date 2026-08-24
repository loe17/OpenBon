import type { TaxSplit } from '@/types/domain';

/**
 * Zentrale Preis- und Steuer-Engine (Spec 7.1.1 + V2 Happy Hour).
 *
 * Alle Berechnungen laufen intern in Cent (Ganzzahlen), damit auf einem Fest
 * mit mehreren tausend Buchungen keine Float-Rundungsdrift entsteht.
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

export interface TaxableLine {
  /** Artikelpreis pro Stueck ohne Pfand */
  unitPrice: number;
  /** Pfand pro Stueck (immer steuerfrei / durchlaufender Posten) */
  deposit?: number;
  quantity: number;
  taxRate: number;
}

export interface TaxBreakdown {
  /** Bruttosumme inkl. Pfand */
  grossTotal: number;
  /** Nettosumme der steuerpflichtigen Artikel */
  netTotal: number;
  /** Steuersumme ueber alle Saetze */
  taxTotal: number;
  /** Pfandanteil (steuerfrei ausgewiesen) */
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
  let depositCents = 0;

  for (const line of lines) {
    const qty = Math.max(0, Math.trunc(line.quantity));
    if (qty === 0) continue;

    const itemGrossCents = toCents(line.unitPrice) * qty;
    const rate = Number.isFinite(line.taxRate) ? line.taxRate : 19;
    const bucket = byRate.get(rate) ?? { grossCents: 0 };
    bucket.grossCents += itemGrossCents;
    byRate.set(rate, bucket);

    depositCents += toCents(line.deposit ?? 0) * qty;
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
      base: toEuro(lineNetCents),
      tax: toEuro(lineTaxCents),
      gross: toEuro(bucket.grossCents),
    });
  }

  // Pfand als eigener 0 %-Block, sofern vorhanden
  if (depositCents > 0) {
    const zero = splits.find((s) => s.rate === 0);
    if (zero) {
      zero.base = round2(zero.base + toEuro(depositCents));
      zero.gross = round2(zero.gross + toEuro(depositCents));
    } else {
      splits.push({ rate: 0, base: toEuro(depositCents), tax: 0, gross: toEuro(depositCents) });
      splits.sort((a, b) => a.rate - b.rate);
    }
    netCents += depositCents;
  }

  const grossCents = Array.from(byRate.values()).reduce((s, b) => s + b.grossCents, 0) + depositCents;

  return {
    grossTotal: toEuro(grossCents),
    netTotal: toEuro(netCents),
    taxTotal: toEuro(taxCents),
    depositTotal: toEuro(depositCents),
    splits,
  };
}

export function findSplit(splits: TaxSplit[], rate: number): TaxSplit {
  return splits.find((s) => s.rate === rate) ?? { rate, base: 0, tax: 0, gross: 0 };
}

export interface CheckoutInput {
  lines: TaxableLine[];
  returnDepositAmount?: number;
  discountAmount?: number;
  surchargeFixed?: number;
  surchargePercent?: number;
  tipAmount?: number;
  givenAmount?: number;
}

export interface CheckoutResult extends TaxBreakdown {
  surchargeTotal: number;
  discountAmount: number;
  returnDeposit: number;
  tipAmount: number;
  /** Zu zahlender Betrag ohne Trinkgeld */
  amountDue: number;
  /** Zu zahlender Betrag inkl. Trinkgeld */
  amountDueWithTip: number;
  givenAmount: number;
  changeAmount: number;
}

/**
 * Vollstaendige Rechnungsberechnung inkl. Rueckpfand, Rabatt, Aufschlag,
 * Trinkgeld und Rueckgeld – identisch verwendet in UI und API,
 * damit Anzeige und Buchung nie auseinanderlaufen.
 */
export function computeCheckout(input: CheckoutInput): CheckoutResult {
  const breakdown = computeTaxBreakdown(input.lines);

  const grossCents = toCents(breakdown.grossTotal);
  const surchargePercent = input.surchargePercent ?? 0;
  const surchargeCents =
    toCents(input.surchargeFixed ?? 0) + Math.round((grossCents * surchargePercent) / 100);
  const discountCents = toCents(input.discountAmount ?? 0);
  const returnDepositCents = toCents(input.returnDepositAmount ?? 0);
  const tipCents = toCents(input.tipAmount ?? 0);

  const dueCents = Math.max(0, grossCents - returnDepositCents - discountCents + surchargeCents);
  const givenCents = toCents(input.givenAmount ?? 0);
  const changeCents = givenCents > 0 ? Math.max(0, givenCents - dueCents - tipCents) : 0;

  // Aufschlag wird mit dem hoechsten vorkommenden Steuersatz versteuert,
  // ersatzweise mit dem Normalsatz.
  const splits = breakdown.splits.map((s) => ({ ...s }));
  if (surchargeCents > 0) {
    const rate = splits.filter((s) => s.rate > 0).sort((a, b) => b.rate - a.rate)[0]?.rate ?? 19;
    const target = splits.find((s) => s.rate === rate);
    const netCents = Math.round(surchargeCents / (1 + rate / 100));
    if (target) {
      target.base = round2(target.base + toEuro(netCents));
      target.tax = round2(target.tax + toEuro(surchargeCents - netCents));
      target.gross = round2(target.gross + toEuro(surchargeCents));
    } else {
      splits.push({
        rate,
        base: toEuro(netCents),
        tax: toEuro(surchargeCents - netCents),
        gross: toEuro(surchargeCents),
      });
      splits.sort((a, b) => a.rate - b.rate);
    }
  }

  const netTotal = round2(splits.reduce((s, x) => s + x.base, 0));
  const taxTotal = round2(splits.reduce((s, x) => s + x.tax, 0));

  return {
    ...breakdown,
    splits,
    netTotal,
    taxTotal,
    surchargeTotal: toEuro(surchargeCents),
    discountAmount: toEuro(discountCents),
    returnDeposit: toEuro(returnDepositCents),
    tipAmount: toEuro(tipCents),
    amountDue: toEuro(dueCents),
    amountDueWithTip: toEuro(dueCents + tipCents),
    givenAmount: toEuro(givenCents),
    changeAmount: toEuro(changeCents),
  };
}

/** Spec 5.3: Schnellwahltasten fuer Banknoten */
export const CASH_QUICK_NOTES = [5, 10, 20, 50, 100] as const;

/**
 * Schlaegt die naechstliegenden Scheine oberhalb des Rechnungsbetrags vor
 * (fuer die dynamische Belegung der Schnellwahltasten).
 */
export function suggestCashNotes(amountDue: number, count = 4): number[] {
  const all = [5, 10, 20, 50, 100, 200];
  const above = all.filter((n) => n >= amountDue);
  if (above.length >= count) return above.slice(0, count);
  return all.slice(-count);
}

/** V2 Spec 6.5: Happy-Hour & Zeit-Aktionspreise */
export interface HappyHourConfig {
  happyHourPrice?: number | null;
  happyHourStart?: string | null; // Format "HH:mm" z. B. "18:00"
  happyHourEnd?: string | null;   // Format "HH:mm" z. B. "19:00"
  happyHourDays?: string | null;  // JSON-Array String z. B. "[1,2,3,4,5]" (0=So, 1=Mo, ...)
}

export function isHappyHourActive(config: HappyHourConfig, targetDate: Date = new Date()): boolean {
  if (config.happyHourPrice === undefined || config.happyHourPrice === null) return false;
  if (!config.happyHourStart || !config.happyHourEnd) return false;

  // Wochentagspruefung (0 = Sonntag, 1 = Montag, ..., 6 = Samstag)
  if (config.happyHourDays) {
    try {
      const activeDays: number[] = JSON.parse(config.happyHourDays);
      if (Array.isArray(activeDays) && activeDays.length > 0) {
        const currentDay = targetDate.getDay();
        if (!activeDays.includes(currentDay)) {
          return false;
        }
      }
    } catch {
      // Ungueltiges JSON ignorieren -> Zeitfenster pruefen
    }
  }

  const hours = targetDate.getHours().toString().padStart(2, '0');
  const minutes = targetDate.getMinutes().toString().padStart(2, '0');
  const currentTimeStr = `${hours}:${minutes}`;

  return currentTimeStr >= config.happyHourStart && currentTimeStr <= config.happyHourEnd;
}

export function getEffectiveProductPrice(
  product: { price: number } & HappyHourConfig,
  targetDate: Date = new Date()
): { price: number; isHappyHour: boolean } {
  if (isHappyHourActive(product, targetDate) && typeof product.happyHourPrice === 'number') {
    return {
      price: product.happyHourPrice,
      isHappyHour: true,
    };
  }
  return {
    price: product.price,
    isHappyHour: false,
  };
}
