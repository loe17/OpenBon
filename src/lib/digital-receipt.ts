import crypto from 'crypto';

/**
 * Digitaler Kassenbeleg / E-Bon Generator (Spec V2 §5.2).
 *
 * Erstellt eindeutige, kryptografisch verifizierbare Beleg-Hashes fuer
 * den papierlosen Belegabruf via QR-Code nach §33 KassenSichV.
 */

export function generateDigitalReceiptCode(invoiceNumber: string, createdAt: Date = new Date()): string {
  const envSecret = process.env.LICENSE_HMAC_SECRET?.trim();
  const secret =
    envSecret && envSecret.length >= 16
      ? envSecret
      : process.env.VITEST || process.env.NODE_ENV === 'test'
        ? 'OPENBON-TEST-RECEIPT-SECRET-MIN-16'
        : '';
  if (!secret) {
    throw new Error('[E-BON] LICENSE_HMAC_SECRET fehlt (min. 16 Zeichen). Bitte in .env setzen – kein Public-Fallback.');
  }
  const rand = crypto.randomBytes(16).toString('hex').toUpperCase();
  const payload = `${invoiceNumber}:${createdAt.getTime()}:${rand}`;
  const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex').substring(0, 16).toUpperCase();
  return `EBON-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}`;
}

export function buildReceiptUrl(baseUrl: string, receiptCode: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  return `${cleanBase}/receipt/${receiptCode}`;
}
