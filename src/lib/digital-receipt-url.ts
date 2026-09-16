/**
 * Reiner URL-Helfer für digitale Kassenbelege (E-Bon).
 * Plattformunabhängig (Client- & Server-kompatibel, ohne Node.js fs/crypto).
 */

export function isExternalBridgeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;
  if (trimmed.includes('openbon.local')) return false;
  if (trimmed.includes('localhost')) return false;
  if (trimmed.includes('127.0.0.1')) return false;
  if (trimmed.includes('0.0.0.0')) return false;
  return true;
}

export function buildReceiptUrl(baseUrl: string, receiptCode: string): string {
  const cleanBase = (baseUrl || '').replace(/\/+$/, '');
  // Für externe Webhosting-Brücken (Netcup, Plesk, Apache, Nginx):
  // Direkter Parameter ?code= funktioniert auf jedem Server ohne .htaccess-Abhängigkeit und verhindert 404-Fehler.
  if (isExternalBridgeUrl(cleanBase)) {
    return `${cleanBase}/?code=${receiptCode}`;
  }
  return `${cleanBase}/receipt/${receiptCode}`;
}
