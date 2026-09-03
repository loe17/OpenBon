import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency === 'CHF' ? 'CHF' : 'EUR',
  }).format(amount);
}

/** Cent-harter Cut: formatiert einen Cent-Integer als Euro-String. */
export function formatCents(cents: number, currency = 'EUR'): string {
  const safe = Number.isFinite(cents) ? Math.round(cents) : 0;
  return formatCurrency(safe / 100, currency);
}

/** Euro-Float -> Cent-Integer (kaufmännisch). */
export function euroToCents(euro: number): number {
  return Math.round((Number(euro) + Number.EPSILON) * 100);
}

/** Cent-Integer -> Euro-Float. */
export function centsToEuro(cents: number): number {
  return Math.round(Number(cents)) / 100;
}

/**
 * Erzeugt einen kollisions sicheren Idempotency-Key – auch in NICHT-Secure-
 * Contexts (http://openbon.local bzw. LAN-IP). `crypto.randomUUID` ist dort
 * nicht verfügbar und würde einen TypeError werfen, der den kompletten
 * Kassiervorgang mit "Fehler beim Kassiervorgang" abbricht.
 */
export function generateIdempotencyKey(prefix = 'ob'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 15)}${Math.random().toString(36).slice(2, 8)}`;
}
