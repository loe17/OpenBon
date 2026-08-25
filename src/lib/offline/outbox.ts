export interface OutboxItem {
  id: string; // Eindeutige UUID / Idempotency Key
  type: 'ORDER' | 'PAYMENT';
  endpoint: string;
  payload: any;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

const DB_NAME = 'openbon_offline_db';
const STORE_NAME = 'outbox';
const DB_VERSION = 1;

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

/**
 * Reiht eine Bestellung in die Offline-Outbox ein.
 */
export async function enqueueOutboxItem(
  type: 'ORDER' | 'PAYMENT',
  endpoint: string,
  payload: any
): Promise<OutboxItem> {
  const item: OutboxItem = {
    id: payload.idempotencyKey || `outbox_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    type,
    endpoint,
    payload: { ...payload, idempotencyKey: payload.idempotencyKey || `outbox_${Date.now()}_${Math.random().toString(36).substring(2, 9)}` },
    createdAt: Date.now(),
    attempts: 0,
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
    try {
      const existing = JSON.parse(localStorage.getItem('openbon_outbox') || '[]');
      existing.push(item);
      localStorage.setItem('openbon_outbox', JSON.stringify(existing));
    } catch {}
  }

  notifyOutboxListeners();
  return item;
}

/**
 * Liest alle wartenden Outbox-Vorgänge aus.
 */
export async function getPendingOutboxItems(): Promise<OutboxItem[]> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    try {
      return JSON.parse(localStorage.getItem('openbon_outbox') || '[]');
    } catch {
      return [];
    }
  }
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
    try {
      const existing = JSON.parse(localStorage.getItem('openbon_outbox') || '[]');
      const filtered = existing.filter((item: OutboxItem) => item.id !== id);
      localStorage.setItem('openbon_outbox', JSON.stringify(filtered));
    } catch {}
  }
  notifyOutboxListeners();
}

/**
 * Synchronisiert alle ausstehenden Outbox-Vorgänge mit dem Server.
 */
export async function syncOutboxWithServer(): Promise<{ synced: number; failed: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const items = await getPendingOutboxItems();
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
      } else {
        item.attempts += 1;
        item.lastError = `Server-Status ${res.status}`;
        failed++;
      }
    } catch (err) {
      item.attempts += 1;
      item.lastError = err instanceof Error ? err.message : String(err);
      failed++;
    }
  }

  notifyOutboxListeners();
  return { synced, failed };
}

// Event-Listener für Outbox-Änderungen in der UI
type Listener = (count: number) => void;
const listeners = new Set<Listener>();

export function subscribeToOutbox(listener: Listener): () => void {
  listeners.add(listener);
  getPendingOutboxItems().then((items) => listener(items.length)).catch(() => {});
  return () => listeners.delete(listener);
}

function notifyOutboxListeners() {
  getPendingOutboxItems().then((items) => {
    listeners.forEach((l) => l(items.length));
  }).catch(() => {});
}

// Bei Reconnect automatisch Outbox synchronisieren
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncOutboxWithServer();
  });
}
