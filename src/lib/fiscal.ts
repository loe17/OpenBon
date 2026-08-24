import crypto from 'crypto';

const FISCAL_SALT = 'OPENBON-FISCAL-BLOCK-SIGNATURE-SALT-2026';

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
  totalGross: number;
  totalNet: number;
  transactionCount: number;
  previousSignature?: string | null;
}

export function signFiscalBlock(input: FiscalBlockInput): string {
  const payload = [
    input.periodNumber,
    input.closedAt,
    input.totalGross.toFixed(2),
    input.totalNet.toFixed(2),
    input.transactionCount,
    input.previousSignature ?? 'GENESIS',
  ].join('|');
  return crypto.createHmac('sha256', FISCAL_SALT).update(payload).digest('hex').toUpperCase();
}

export function verifyFiscalBlock(signature: string, input: FiscalBlockInput): boolean {
  return signFiscalBlock(input) === signature;
}
