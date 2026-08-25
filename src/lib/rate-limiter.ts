import prisma from './db';

interface RateLimitRecord {
  attempts: number;
  firstAttempt: number;
  lockUntil: number;
}

const attemptStore = new Map<string, RateLimitRecord>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000; // 1 Minute

let hydrated = false;

/**
 * Lädt aktive Sperren einmalig aus der DB, damit Lockouts einen
 * Serverneustart überleben (z. B. nach einem Absturz im Livebetrieb).
 */
function hydrateFromDb(): void {
  if (hydrated) return;
  hydrated = true;

  prisma.authAttempt
    .findMany({
      where: { lockUntil: { gt: new Date() } },
    })
    .then((rows) => {
      for (const row of rows) {
        attemptStore.set(row.key, {
          attempts: row.attempts,
          firstAttempt: row.firstAttempt.getTime(),
          lockUntil: row.lockUntil?.getTime() || 0,
        });
      }
      if (rows.length > 0) {
        console.log(`[AUTH] ${rows.length} aktive PIN-Sperren aus der Datenbank geladen.`);
      }
    })
    .catch(() => {
      // DB noch nicht bereit -> rein im Memory weiterarbeiten
    });
}

/** Schreibt den aktuellen Stand eines Keys best-effort in die DB (Write-Through). */
function persistToDb(key: string, record: RateLimitRecord | null): void {
  const data = {
    attempts: record?.attempts ?? 0,
    firstAttempt: new Date(record?.firstAttempt ?? Date.now()),
    lockUntil: record && record.lockUntil > 0 ? new Date(record.lockUntil) : null,
  };

  prisma.authAttempt
    .upsert({
      where: { key },
      update: data,
      create: { key, ...data },
    })
    .catch(() => {
      // Persistenz ist best-effort; der Memory-Schutz greift immer.
    });
}

/**
 * Prueft, ob ein Client (nach IP/DeviceId) die maximalen PIN-Versuche ueberschritten hat.
 */
export function checkRateLimit(key: string): { allowed: boolean; remainingSeconds: number } {
  hydrateFromDb();
  const now = Date.now();
  const record = attemptStore.get(key);

  if (!record) {
    return { allowed: true, remainingSeconds: 0 };
  }

  // Ist noch gesperrt?
  if (record.lockUntil > now) {
    const remainingSeconds = Math.ceil((record.lockUntil - now) / 1000);
    return { allowed: false, remainingSeconds };
  }

  // Zeitfenster abgelaufen -> Reset
  if (now - record.firstAttempt > WINDOW_MS) {
    attemptStore.delete(key);
    return { allowed: true, remainingSeconds: 0 };
  }

  return { allowed: true, remainingSeconds: 0 };
}

/**
 * Registriert einen fehlgeschlagenen PIN-Versuch und sperrt bei Bedarf.
 */
export function registerFailedAttempt(key: string): { locked: boolean; remainingSeconds: number } {
  hydrateFromDb();
  const now = Date.now();
  let record = attemptStore.get(key);

  if (!record || now - record.firstAttempt > WINDOW_MS) {
    record = { attempts: 1, firstAttempt: now, lockUntil: 0 };
  } else {
    record.attempts += 1;
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    // Exponentielle Sperre: 30s beim ersten Lockout, 60s beim zweiten, etc.
    const lockDuration = Math.min(300 * 1000, 30 * 1000 * Math.pow(2, record.attempts - MAX_ATTEMPTS));
    record.lockUntil = now + lockDuration;
    attemptStore.set(key, record);
    persistToDb(key, record);
    return { locked: true, remainingSeconds: Math.ceil(lockDuration / 1000) };
  }

  attemptStore.set(key, record);
  persistToDb(key, record);
  return { locked: false, remainingSeconds: 0 };
}

/**
 * Setzt den Rate-Limit-Status nach erfolgreicher PIN-Eingabe zurueck.
 */
export function resetRateLimit(key: string): void {
  attemptStore.delete(key);
  persistToDb(key, null);
}
