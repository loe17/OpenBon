export interface OutboxItem {
  id: string; // Eindeutige Idempotency-Key UUID
  type: 'ORDER' | 'PAYMENT';
  endpoint: string;
  payload: any;
  createdAt: number;
  attempts: number;
  lastError?: string;
  status?: 'PENDING' | 'FAILED';
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
 * Reiht einen Vorgang (Bestellung / Bezahlung) in die Offline-Outbox ein.
 */
export async function enqueueOutboxItem(
  type: 'ORDER' | 'PAYMENT',
  endpoint: string,
  payload: any
): Promise<OutboxItem> {
  const idempotencyKey =
    payload.idempotencyKey ||
    `ob_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const item: OutboxItem = {
    id: idempotencyKey,
    type,
    endpoint,
    payload: { ...payload, idempotencyKey },
    createdAt: Date.now(),
    attempts: 0,
    status: 'PENDING',
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
    try {
      const existing: OutboxItem[] = JSON.parse(localStorage.getItem('openbon_outbox') || '[]');
      const idx = existing.findIndex((i) => i.id === item.id);
      if (idx !== -1) {
        existing[idx] = item;
      } else {
        existing.push(item);
      }
      localStorage.setItem('openbon_outbox', JSON.stringify(existing));
    } catch {}
  }
  notifyOutboxListeners();
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
      request.onsuccess = () => {
        const items: OutboxItem[] = request.result || [];
        resolve(items.filter((i) => i.status !== 'FAILED'));
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    try {
      const items: OutboxItem[] = JSON.parse(localStorage.getItem('openbon_outbox') || '[]');
      return items.filter((i) => i.status !== 'FAILED');
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
 * Sendet einen Request direkt. Bei Offline oder Netzwerkfehler wird der Request automatisch
 * in die lokale Outbox eingereiht und liefert ein optimistisches OK zurück.
 */
export async function sendWithOutboxFallback(
  type: 'ORDER' | 'PAYMENT',
  endpoint: string,
  payload: any
): Promise<{ success: boolean; data?: any; queuedOffline?: boolean; error?: string }> {
  const idempotencyKey =
    payload.idempotencyKey ||
    `ob_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const bodyWithKey = { ...payload, idempotencyKey };

  // Wenn der Browser offline ist, direkt einreihen
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await enqueueOutboxItem(type, endpoint, bodyWithKey);
    return { success: true, queuedOffline: true };
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

    // Bei 5xx Server-Fehler in die Outbox legen für automatischen Retry
    if (res.status >= 500) {
      await enqueueOutboxItem(type, endpoint, bodyWithKey);
      return { success: true, queuedOffline: true };
    }

    const errData = await res.json().catch(() => ({}));
    return { success: false, error: errData.error || `Server-Fehler (${res.status})` };
  } catch (netErr) {
    // Netzwerk-Abbruch / Timeout -> in Outbox einreihen
    await enqueueOutboxItem(type, endpoint, bodyWithKey);
    return { success: true, queuedOffline: true };
  }
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
        if (item.attempts >= 5 || res.status === 400) {
          item.status = 'FAILED';
        }
        await updateOutboxItem(item);
        failed++;
      }
    } catch (err) {
      item.attempts += 1;
      item.lastError = err instanceof Error ? err.message : String(err);
      if (item.attempts >= 5) {
        item.status = 'FAILED';
      }
      await updateOutboxItem(item);
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
