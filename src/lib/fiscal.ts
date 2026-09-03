import crypto from 'crypto';

// Gehärtet: Salt aus ENV (FISCAL_SALT, mind. 16 Zeichen), sonst DB-Secret, sonst Fehler.
// Der fest verdrahtete Default ist entfernt – ohne Secret keine Signatur.
function getFiscalSalt(): string {
  const env = process.env.FISCAL_SALT?.trim();
  if (env && env.length >= 16) return env;
  const rt = String((globalThis as unknown as Record<string, unknown>).__OPENBON_JWT_SECRET__ || '').trim();
  if (rt.length >= 16) return `FISCAL-${rt}`;
  // Test-Fallback (nur Vitest), damit isolierte Krypto-Tests ohne ENV laufen.
  // Produktion wirft weiterhin hart (fail-closed).
  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    return 'OPENBON-TEST-FISCAL-SALT-MIN-16-CHARS';
  }
  throw new Error('[FISCAL] Kein FISCAL_SALT konfiguriert. Bitte FISCAL_SALT (min. 16 Zeichen) setzen.');
}

export const TSE_HINWEIS =
  'Ohne zertifizierte TSE (fiskaly/efsta/Swissbit) nicht §146a-konform – nur für Vereins-/Testbetrieb.';

/**
 * Spec 6.7: Fiskalblock des Z-Bons.
 *
 * Reine Krypto-Funktionen ohne Datenbankzugriff, damit sie in der Test-Suite
 * isoliert geprüft werden können. Jede Signatur ist auf den vorherigen
 * Abschluss verkettet – so fällt ein gelöschter oder nachträglich geänderter
 * Z-Bon beim Nachrechnen auf.
 */
export interface FiscalBlockInput {
  periodNumber: number;
  closedAt: string;
  totalGrossCents: number;
  totalNetCents: number;
  transactionCount: number;
  previousSignature?: string | null;
  /** @deprecated Legacy Euro, wird via Math.round(x*100) normalisiert */
  totalGross?: number;
  /** @deprecated Legacy Euro, wird via Math.round(x*100) normalisiert */
  totalNet?: number;
}

function resolveCents(cents: number | undefined, legacyEuro: number | undefined): number {
  if (typeof cents === 'number') return Math.round(cents);
  if (typeof legacyEuro === 'number') return Math.round((legacyEuro + Number.EPSILON) * 100);
  return 0;
}

export function signFiscalBlock(input: FiscalBlockInput): string {
  const grossCents = resolveCents(input.totalGrossCents, input.totalGross);
  const netCents = resolveCents(input.totalNetCents, input.totalNet);
  const payload = [
    input.periodNumber,
    input.closedAt,
    grossCents,
    netCents,
    input.transactionCount,
    input.previousSignature ?? 'GENESIS',
  ].join('|');
  return crypto.createHmac('sha256', getFiscalSalt()).update(payload).digest('hex').toUpperCase();
}

export function verifyFiscalBlock(signature: string, input: FiscalBlockInput): boolean {
  return signFiscalBlock(input) === signature;
}
