/**
 * N2.1 Serverseitige Absicherung des klassischen Karten-Deep-Link-Callbacks.
 *
 * Problem bisher: Die Rueckkehr der Zahl-App nach /waiter/payment/callback
 * uebergab den Status ausschliesslich in der URL - jede manipulierte Adresse
 * wie `...&status=success` wurde bedingungslos als autorisierte Kartenzahlung
 * übernommen und konnte die Verbuchung freischalten.
 *
 * Loesung: Bei der Erzeugung des Deep Links signiert der Kassenserver die
 * sicherheitsrelevanten Parameter (orderId + Status + Zeitstempel) mit dem
 * geheimen Session-Signaturschluessel. Die Callback-Seite verifiziert die
 * Signatur serverseitig (/api/payments/card/verify), bevor ein Ergebnis in
 * den SessionStorage geschrieben wird. Nach ~30 Minuten abgelaufene
 * Rueckspruenge werden ebenfalls abgelehnt.
 */

import crypto from 'crypto';
import prisma from '../db';

const SIGNATURE_MAX_AGE_MS = 30 * 60 * 1000;

/** Liefert den kasseneigenen Signaturschluessel (ENV zuerst, sonst DB-Secret). */
async function getCardCallbackKey(): Promise<Buffer> {
  try {
    const { getJwtSecretKey } = await import('../auth-session');
    const key = getJwtSecretKey();
    return Buffer.from(key);
  } catch {
    const config = await prisma.eventConfig.findUnique({
      where: { id: 'default' },
      select: { sessionSecret: true },
    });
    return Buffer.from(config?.sessionSecret || 'openbon-card-callback-fallback-key');
  }
}

function hmacHex(payload: string, key: Buffer): string {
  return crypto.createHmac('sha256', key).update(payload).digest('hex').slice(0, 32);
}

export interface SignedCallbackParameters {
  orderId: string;
  provider?: string;
  status: 'success' | 'failed' | 'cancel' | string;
}

/** Erzeugt ts+sig für die angehaengten Callback-Parameter. */
export async function signCardCallback(
  params: SignedCallbackParameters
): Promise<{ ts: string; sig: string }> {
  const key = await getCardCallbackKey();
  const ts = String(Date.now());
  const sig = hmacHex(`${params.orderId}|${params.status}|${ts}`, key);
  return { ts, sig };
}

export interface VerificationResult {
  verified: boolean;
  reason?: 'MISSING_PARAMS' | 'EXPIRED' | 'BAD_SIGNATURE';
}

/**
 * Prueft eine Rueckkehr signaturtechnisch. Muss NUR serverseitig laufen -
 * die Callback-Seite ruft dafuer /api/payments/card/verify auf.
 */
export async function verifyCardCallback(raw: Record<string, unknown>): Promise<VerificationResult> {
  const orderId = String(raw.orderId ?? '');
  const status = String(raw.status ?? '');
  const ts = String(raw.ts ?? '');
  const sig = String(raw.sig ?? '');

  if (!orderId || !status || !ts || !sig) {
    return { verified: false, reason: 'MISSING_PARAMS' };
  }

  const ageOk =
    Number.isFinite(Number(ts)) && Date.now() - Number(ts) >= 0 && Date.now() - Number(ts) <= SIGNATURE_MAX_AGE_MS;
  if (!ageOk) {
    return { verified: false, reason: 'EXPIRED' };
  }

  const key = await getCardCallbackKey();
  const expected = hmacHex(`${orderId}|${status}|${ts}`, key);

  // Konstantzeitiger Vergleich (gleiche Laenge durch slice(32))
  let mismatch = expected.length ^ sig.length;
  const limit = Math.max(expected.length, sig.length);
  for (let i = 0; i < limit; i++) {
    mismatch |= (expected.charCodeAt(i) || 0) ^ (sig.charCodeAt(i) || 0);
  }

  if (mismatch !== 0 || sig.length !== expected.length) {
    return { verified: false, reason: 'BAD_SIGNATURE' };
  }

  return { verified: true };
}
