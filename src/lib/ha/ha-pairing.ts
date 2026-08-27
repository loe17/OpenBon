/**
 * N1 In-App-HA-Pairing (6-stelliger Bestaetigungscode).
 *
 * Ablauf (kein Terminal mehr noetig):
 *  1. INITIATE am Knoten A (z. B. PRIMARY): erzeugt intern ein starkes Secret
 *     plus einen 6-stelligen Code, der auf dem Bildschirm angezeigt wird.
 *  2. PULL am Knoten B (STANDBY): Admin gibt den Code dort ein. Knoten B ruft
 *     den Initiator ueber den BESTEHENDEN (klassischen) Sync-Kanal ab
 *     (X-HA-Secret = aktuell gemeinsam genutztes Secret) und erhaelt das neue
 *     Secret. Anschliessend schreibt es sein eigenes DB-Secret um.
 *  3. FINALIZE wieder an Knoten A: Admin bestaetigt dort mit PIN; das von
 *     Schritt 1 vorgehaltene Secret wird ebenfalls persistent gesetzt.
 *
 * Der alte Kanal bleibt bewusst als Bootstrap genutzt - genau dafuer existiert
 * der Weak-Bypass in verifyHaSecret(). Danach gilt konstantzeitiger Vergleich
 * gegen das neue Secret.
 *
 * Sicherheitsanker:
 *  - Jeder Schritt verlangt eine gueltige ADMIN-Session UND die Admin-PIN
 *    (Guard in der Route, nicht hier).
 *  - Code-TTL 10 Minuten, max. 5 Fehlversuche je Pending-Pairing.
 *  - Code-Vergleich timing-safe; Secret-Transport nur im HTTP-Koerper via TLS
 *    bzw. verschlossenem Fest-WLAN.
 */

import crypto from 'crypto';
import { generateStrongHaSecret } from './ha-secret';

export interface PendingPairing {
  pairId: string;
  code: string;
  secret: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
}

const PENDING_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// Prozesslokaler Speicher reicht: Das Pending-Pairing lebt hoechstens 10 min.
const pendingPairings = new Map<string, PendingPairing>();
/** Zweiter Index per Code: Der Partner kennt ausschliesslich den 6-Steller. */
const pendingByCode = new Map<string, PendingPairing>();

function removeFromBoth(entry: PendingPairing): void {
  pendingPairings.delete(entry.pairId);
  if (pendingByCode.get(entry.code)?.pairId === entry.pairId) {
    pendingByCode.delete(entry.code);
  }
}

function cleanupExpired(): void {
  const now = Date.now();
  for (const entry of Array.from(pendingPairings.values())) {
    if (entry.expiresAt <= now || entry.attempts > MAX_ATTEMPTS) {
      removeFromBoth(entry);
    }
  }
}

/** Schritt 1: Neues Pending-Pairing erzeugen. Liefert ID + 6-stelligen Code. */
export function initiatePairing(): { pairId: string; code: string; expiresAt: number } {
  cleanupExpired();

  // 6-stelliger numerischer Code fuer die manuelle Bestaetigung
  const code = String(crypto.randomInt(100_000, 1_000_000));
  const pairId = crypto.randomUUID();
  const now = Date.now();

  const entry: PendingPairing = {
    pairId,
    code,
    secret: generateStrongHaSecret(),
    createdAt: now,
    expiresAt: now + PENDING_TTL_MS,
    attempts: 0,
  };
  pendingPairings.set(pairId, entry);
  pendingByCode.set(code, entry);

  return { pairId, code, expiresAt: now + PENDING_TTL_MS };
}

/** Holt ein noch gueltiges Pending-Pairing per ID (ohne es zu entwerten). */
export function getPendingPairing(pairId: string): PendingPairing | null {
  cleanupExpired();
  return pendingPairings.get(pairId) ?? null;
}

/** Lookup per 6-Steller fuer den Partner-Abruf (PULL), nach dem Code-Check. */
export function getPendingPairingByCode(code: string): PendingPairing | null {
  cleanupExpired();
  return pendingByCode.get(String(code ?? '').trim()) ?? null;
}

interface CodeCheckResult {
  ok: boolean;
  error?: 'NOT_FOUND' | 'EXPIRED' | 'MAX_ATTEMPTS' | 'WRONG_CODE';
  /** Bei WRONG_CODE die verbleibenden Versuche, sonst undefined. */
  remainingAttempts?: number;
}

/** Timing-sicherer Code-Vergleich inkl. Versuchszahl-Verbrauch (Lookup per Code). */
export function checkPairingCode(submittedCode: string): CodeCheckResult {
  cleanupExpired();
  const cleanInput = String(submittedCode ?? '').trim();
  const entry = cleanInput ? pendingByCode.get(cleanInput) : undefined;
  if (!entry) {
    return { ok: false, error: 'NOT_FOUND' };
  }
  if (entry.expiresAt <= Date.now()) {
    removeFromBoth(entry);
    return { ok: false, error: 'EXPIRED' };
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    removeFromBoth(entry);
    return { ok: false, error: 'MAX_ATTEMPTS' };
  }

  let mismatch = cleanInput.length ^ entry.code.length;
  const limit = Math.max(cleanInput.length, entry.code.length);
  for (let i = 0; i < limit; i++) {
    mismatch |= (cleanInput.charCodeAt(i) || 0) ^ (entry.code.charCodeAt(i) || 0);
  }

  if (mismatch !== 0 || cleanInput.length !== entry.code.length) {
    entry.attempts += 1;
    const remaining = Math.max(0, MAX_ATTEMPTS - entry.attempts);
    if (remaining === 0) {
      removeFromBoth(entry);
      return { ok: false, error: 'MAX_ATTEMPTS', remainingAttempts: 0 };
    }
    return { ok: false, error: 'WRONG_CODE', remainingAttempts: remaining };
  }

  return { ok: true };
}

/** Entfernt alle Pending-Pairings (Testhelfer). */
export function resetPendingPairings(): void {
  pendingPairings.clear();
  pendingByCode.clear();
}

/**
 * Schritt 3 (Initiator): Wendet das bei INITIATE erzeugte Secret persistent an
 * und entfernt das Pending-Pairing AUS BEIDEN Indizes. Gibt das Secret zur
 * Pruefung des Aufrufs zurueck - die Route ist fuer diese Quelle zustandslos
 * genug und vertraut ausschliesslich ihrer eigenen, durch ADMIN+PIN
 * geschuetzten Session.
 */
export function finalizePairing(
  pairId: string
): { ok: true; secret: string } | { ok: false; error: 'NOT_FOUND' } {
  cleanupExpired();
  const entry = pendingPairings.get(pairId);
  if (!entry) return { ok: false, error: 'NOT_FOUND' };
  removeFromBoth(entry);
  return { ok: true, secret: entry.secret };
}

export function isMapEmptyForTest(): boolean {
  return pendingPairings.size === 0 && pendingByCode.size === 0;
}
