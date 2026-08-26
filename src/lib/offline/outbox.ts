/**
 * Offline-Outbox fuer OpenBon.
 *
 * Alle kassenrelevanten Schreibvorgaenge (Bestellung, Zahlung) laufen ueber
 * `sendWithOutboxFallback`. Kann der Server den Vorgang nicht bestaetigen,
 * wird er lokal (IndexedDB, Fallback localStorage) zwischengespeichert und
 * mit wachsendem Abstand (Backoff) erneut gesendet.
 *
 * WICHTIG fuer die Bedienoberflaeche: `success: true` bedeutet NICHT
 * automatisch "vom Server gebucht". Nur wenn `pending` unwahr ist, liegt eine
 * echte Serverbestaetigung samt `data` vor. Ist `pending` gesetzt, muss die
 * Station einen Hinweis "noch nicht bestaetigt" anzeigen und darf keine
 * Bonnummer / kein Abholtoken aus `data` lesen.
 */

export type OutboxPayload = Record<string, any>;

export type OutboxFailureReason = 'OFFLINE' | 'SERVER_ERROR' | 'NETWORK_ERROR';

export interface OutboxItem {
  id: string; // Eindeutige Idempotency-Key UUID
  type: 'ORDER' | 'PAYMENT';
  endpoint: string;
  payload: OutboxPayload;
  createdAt: number;
  attempts: number;
  lastError?: string;
  /** Zeitpunkt, ab dem der naechste Sendeversuch erlaubt ist (Backoff). */
  nextAttemptAt?: number;
  status?: 'PENDING' | 'FAILED';
  /** Grund, warum der Vorgang eingereiht wurde. */
  reason?: OutboxFailureReason;
}

export interface OutboxSendResult {
  /** false = endgueltig abgelehnt (fachlicher Fehler, kein Retry). */
  success: boolean;
  /** Nur gesetzt, wenn der Server den Vorgang bestaetigt hat. */
  data?: any;
  /** Vorgang liegt in der lokalen Outbox. */
  queuedOffline?: boolean;
  /** Server hat den Vorgang NICHT bestaetigt - Ausgang noch offen. */
  pending?: boolean;
  reason?: OutboxFailureReason;
  error?: string;
}

export interface OutboxState {
  pending: number;
  failed: number;
}

const DB_NAME = 'openbon_offline_db';
const STORE_NAME = 'outbox';
const DB_VERSION = 1;

/** Backoff-Staffel je Versuch: 2s, 10s, 30s, 2min, 5min. */
const BACKOFF_STEPS_MS = [2_000, 10_000, 30_000, 120_000, 300_000];
const MAX_ATTEMPTS = BACKOFF_STEPS_MS.length;
/** Intervall, in dem faellige Vorgaenge automatisch nachgesendet werden. */
const AUTO_SYNC_INTERVAL_MS = 15_000;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB ist in dieser Umgebung nicht verfügbar'));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }
  return dbPromise;
}

function generateIdempotencyKey(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/** Wartezeit bis zum naechsten Versuch, abhaengig von der Versuchszahl. */
function backoffDelay(attempts: number): number {
  const idx = Math.min(Math.max(attempts, 0), BACKOFF_STEPS_MS.length - 1);
  return BACKOFF_STEPS_MS[idx];
}

function readLocalItems(): OutboxItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem('openbon_outbox') || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeLocalItems(items: OutboxItem[]): void {
  try {
    localStorage.setItem('openbon_outbox', JSON.stringify(items));
  } catch {}
}

/**
 * Reiht einen Vorgang (Bestellung / Bezahlung) in die Offline-Outbox ein.
 */
export async function enqueueOutboxItem(
  type: 'ORDER' | 'PAYMENT',
  endpoint: string,
  payload: OutboxPayload,
  reason: OutboxFailureReason = 'OFFLINE',
  lastError?: string
): Promise<OutboxItem> {
  const idempotencyKey = (payload.idempotencyKey as string) || generateIdempotencyKey('ob');

  const item: OutboxItem = {
    id: idempotencyKey,
    type,
    endpoint,
    payload: { ...payload, idempotencyKey },
    createdAt: Date.now(),
    attempts: 0,
    nextAttemptAt: Date.now() + backoffDelay(0),
    status: 'PENDING',
    reason,
    lastError,
  };

  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fallback auf localStorage
    const existing = readLocalItems();
    existing.push(item);
    writeLocalItems(existing);
  }

  notifyOutboxListeners();
  return item;
}

/**
 * Aktualisiert den Status eines Eintrags in der IndexedDB.
 */
export async function updateOutboxItem(item: OutboxItem): Promise<void> {
  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const existing = readLocalItems();
    const idx = existing.findIndex((i) => i.id === item.id);
    if (idx !== -1) {
      existing[idx] = item;
    } else {
      existing.push(item);
    }
    writeLocalItems(existing);
  }
  notifyOutboxListeners();
}

/** Liest ausnahmslos alle gespeicherten Vorgaenge (auch endgueltig fehlgeschlagene). */
export async function getAllOutboxItems(): Promise<OutboxItem[]> {
  try {
    const db = await getDb();
    return await new Promise<OutboxItem[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve((request.result as OutboxItem[]) || []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return readLocalItems();
  }
}

/**
 * Liest alle wartenden Outbox-Vorgänge aus (ohne endgueltig fehlgeschlagene).
 */
export async function getPendingOutboxItems(): Promise<OutboxItem[]> {
  const items = await getAllOutboxItems();
  return items.filter((i) => i.status !== 'FAILED');
}

/**
 * Vorgaenge, die nach {@link MAX_ATTEMPTS} Versuchen aufgegeben wurden.
 * Diese muessen der Bedienung angezeigt werden - sonst geht Umsatz still verloren.
 */
export async function getFailedOutboxItems(): Promise<OutboxItem[]> {
  const items = await getAllOutboxItems();
  return items.filter((i) => i.status === 'FAILED');
}

/** Wartende Vorgaenge, deren Backoff-Fenster abgelaufen ist. */
async function getDueOutboxItems(): Promise<OutboxItem[]> {
  const now = Date.now();
  const items = await getPendingOutboxItems();
  return items.filter((i) => !i.nextAttemptAt || i.nextAttemptAt <= now);
}

/** Zaehlerstand fuer Statusanzeigen. */
export async function getOutboxState(): Promise<OutboxState> {
  const items = await getAllOutboxItems();
  return {
    pending: items.filter((i) => i.status !== 'FAILED').length,
    failed: items.filter((i) => i.status === 'FAILED').length,
  };
}

/**
 * Setzt aufgegebene Vorgaenge zurueck in die Warteschlange (manuelles "Erneut senden").
 */
export async function retryFailedOutboxItems(): Promise<number> {
  const failed = await getFailedOutboxItems();
  for (const item of failed) {
    item.status = 'PENDING';
    item.attempts = 0;
    item.nextAttemptAt = Date.now();
    await updateOutboxItem(item);
  }
  if (failed.length > 0) {
    await syncOutboxWithServer();
  }
  return failed.length;
}

/**
 * Entfernt einen erfolgreich synchronisierten Eintrag aus der Outbox.
 */
export async function removeOutboxItem(id: string): Promise<void> {
  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    writeLocalItems(readLocalItems().filter((item) => item.id !== id));
  }
  notifyOutboxListeners();
}

/**
 * Verwirft einen endgueltig fehlgeschlagenen Vorgang bewusst (Bedienung hat ihn
 * anderweitig erfasst oder storniert).
 */
export async function discardFailedOutboxItem(id: string): Promise<void> {
  await removeOutboxItem(id);
}

/**
 * Sendet einen Request direkt. Bei Offline, Netzwerkfehler oder Serverfehler wird
 * der Request in die lokale Outbox eingereiht und mit `pending: true` gemeldet.
 */
export async function sendWithOutboxFallback(
  type: 'ORDER' | 'PAYMENT',
  endpoint: string,
  payload: OutboxPayload
): Promise<OutboxSendResult> {
  const idempotencyKey = (payload.idempotencyKey as string) || generateIdempotencyKey('ob');

  const bodyWithKey = { ...payload, idempotencyKey };

  // Wenn der Browser offline ist, direkt einreihen
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await enqueueOutboxItem(type, endpoint, bodyWithKey, 'OFFLINE');
    return {
      success: true,
      queuedOffline: true,
      pending: true,
      reason: 'OFFLINE',
      error: 'Keine Netzwerkverbindung – Vorgang wurde lokal gesichert.',
    };
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(bodyWithKey),
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, data };
    }

    // 5xx: Der Server ist erreichbar, hat den Vorgang aber nicht verarbeitet.
    // Das ist KEIN Offline-Fall - der Vorgang wird zwar zum Nachsenden gesichert,
    // die Station muss ihn aber als "noch nicht bestaetigt" kennzeichnen.
    if (res.status >= 500) {
      const serverMsg = await res
        .json()
        .then((d: any) => d?.error as string | undefined)
        .catch(() => undefined);
      const message = serverMsg || `Serverfehler ${res.status} – Vorgang wurde zum Nachsenden gesichert.`;
      await enqueueOutboxItem(type, endpoint, bodyWithKey, 'SERVER_ERROR', message);
      return {
        success: true,
        queuedOffline: true,
        pending: true,
        reason: 'SERVER_ERROR',
        error: message,
      };
    }

    // 4xx: fachlicher Fehler - erneutes Senden wuerde denselben Fehler erzeugen.
    const errData = await res.json().catch(() => ({}));
    return { success: false, error: errData.error || `Server-Fehler (${res.status})` };
  } catch (netErr) {
    // Netzwerk-Abbruch / Timeout -> in Outbox einreihen
    const message = netErr instanceof Error ? netErr.message : String(netErr);
    await enqueueOutboxItem(type, endpoint, bodyWithKey, 'NETWORK_ERROR', message);
    return {
      success: true,
      queuedOffline: true,
      pending: true,
      reason: 'NETWORK_ERROR',
      error: 'Server nicht erreichbar – Vorgang wurde lokal gesichert.',
    };
  }
}

let syncInFlight: Promise<{ synced: number; failed: number }> | null = null;

/**
 * Synchronisiert alle faelligen Outbox-Vorgänge mit dem Server.
 * Mehrfachaufrufe (Reconnect + Timer + Button) laufen zusammen, damit ein
 * Vorgang nicht parallel doppelt gesendet wird.
 */
export async function syncOutboxWithServer(): Promise<{ synced: number; failed: number }> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = runSync().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

async function runSync(): Promise<{ synced: number; failed: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const items = await getDueOutboxItems();
  if (items.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const res = await fetch(item.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': item.id,
        },
        body: JSON.stringify(item.payload),
      });

      if (res.ok) {
        await removeOutboxItem(item.id);
        synced++;
        continue;
      }

      item.attempts += 1;
      item.lastError = `Server-Status ${res.status}`;
      // 4xx ist fachlich - erneutes Senden aendert nichts.
      if (res.status >= 400 && res.status < 500) {
        item.status = 'FAILED';
        item.reason = 'SERVER_ERROR';
      } else if (item.attempts >= MAX_ATTEMPTS) {
        item.status = 'FAILED';
        item.reason = 'SERVER_ERROR';
      } else {
        item.nextAttemptAt = Date.now() + backoffDelay(item.attempts);
      }
      await updateOutboxItem(item);
      failed++;
    } catch (err) {
      item.attempts += 1;
      item.lastError = err instanceof Error ? err.message : String(err);
      if (item.attempts >= MAX_ATTEMPTS) {
        item.status = 'FAILED';
        item.reason = 'NETWORK_ERROR';
      } else {
        item.nextAttemptAt = Date.now() + backoffDelay(item.attempts);
      }
      await updateOutboxItem(item);
      failed++;
    }
  }

  notifyOutboxListeners();
  return { synced, failed };
}

// Event-Listener für Outbox-Änderungen in der UI
type Listener = (count: number, failed: number) => void;
const listeners = new Set<Listener>();

export function subscribeToOutbox(listener: Listener): () => void {
  listeners.add(listener);
  getOutboxState()
    .then((state) => listener(state.pending, state.failed))
    .catch(() => {});
  return () => {
    listeners.delete(listener);
  };
}

function notifyOutboxListeners() {
  getOutboxState()
    .then((state) => {
      listeners.forEach((l) => l(state.pending, state.failed));
    })
    .catch(() => {});
}

// Automatisches Nachsenden: bei Reconnect sofort, danach im Backoff-Takt.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void syncOutboxWithServer();
  });

  window.setInterval(() => {
    if (!navigator.onLine) return;
    void getDueOutboxItems().then((due) => {
      if (due.length > 0) void syncOutboxWithServer();
    });
  }, AUTO_SYNC_INTERVAL_MS);
}
