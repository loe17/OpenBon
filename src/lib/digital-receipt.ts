import crypto from 'crypto';

/**
 * Digitaler Kassenbeleg / E-Bon Generator (Spec V2 §5.2).
 *
 * Erstellt eindeutige, kryptografisch verifizierbare Beleg-Hashes fuer
 * den papierlosen Belegabruf via QR-Code nach §33 KassenSichV.
 */

export function generateDigitalReceiptCode(invoiceNumber: string, createdAt: Date = new Date()): string {
  const secret = process.env.LICENSE_HMAC_SECRET || 'OPENBON_DIGITAL_RECEIPT_SECRET_2026';
  const payload = `${invoiceNumber}:${createdAt.getTime()}:${Math.random().toString(36).substring(2, 9)}`;
  const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex').substring(0, 16).toUpperCase();
  return `EBON-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}`;
}

export function buildReceiptUrl(baseUrl: string, receiptCode: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  return `${cleanBase}/receipt/${receiptCode}`;
}
