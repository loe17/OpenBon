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

/* ------------------------------------------------------------------ */
/* M2.2 Schicht-Limitierung gegen IP-Header-Spoofing                    */
/*                                                                      */
/* Der IP-Key basiert auf x-forwarded-for/x-real-ip und ist im direkten  */
/* LAN vom Client frei waehlbar - eine Sperre allein nach "IP" ist       */
/* trivial rotierbar. Ergaenzend greifen zwei schluesselstabile Ebenen:  */
/*   1. Station (z.B. "station:ADMIN") - loest NICHT mit manipulierter   */
/*      Client-Kennung, sperrt das Zielsystem nach N Fehlversuchen.     */
/*   2. Globaler Boden ueber die gesamte Instanz pro Stunde.            */
/* Die bisherige IP-Ebene bleibt bestehen und ist zuerst an der Reihe,  */
/* damit legitime Nutzer unveraendert weiterarbeiten koennen.           */
/* ------------------------------------------------------------------ */

const ACCOUNT_KEY_PREFIX = 'station:';
const ACCOUNT_MAX_ATTEMPTS = 10;
const ACCOUNT_WINDOW_MS = 60 * 1000; // 1 Minute
const GLOBAL_FLOOD_KEY = '__global__::login-attempts';
const GLOBAL_MAX_ATTEMPTS = 150;
const GLOBAL_WINDOW_MS = 60 * 60 * 1000; // 1 Stunde

export interface LayeredRateResult {
  allowed: boolean;
  remainingSeconds: number;
  layer: 'ip' | 'account' | 'global';
}

export function checkLayeredRateLimit(ipKey: string, station: string): LayeredRateResult {
  hydrateFromDb();

  const ipCheck = checkRateLimit(ipKey);
  if (!ipCheck.allowed) {
    return { allowed: false, remainingSeconds: ipCheck.remainingSeconds, layer: 'ip' };
  }

  const stationCheck = checkRateLimit(`${ACCOUNT_KEY_PREFIX}${station}`);
  if (!stationCheck.allowed) {
    return {
      allowed: false,
      remainingSeconds: stationCheck.remainingSeconds,
      layer: 'account',
    };
  }

  const globalCheck = checkGlobalFlood();
  if (!globalCheck.allowed) {
    return {
      allowed: false,
      remainingSeconds: globalCheck.remainingSeconds,
      layer: 'global',
    };
  }

  return { allowed: true, remainingSeconds: 0, layer: 'ip' };
}

/**
 * Registriert einen Fehlversuch auf ALLEN Ebenen gleichzeitig. Der Aufrufer
 * meldet die strikteste Reaktion (gesperrte Ebene mit der laengsten Restzeit).
 */
export function registerLayeredFailure(
  ipKey: string,
  station: string
): { locked: boolean; remainingSeconds: number; layer: LayeredRateResult['layer'] } {
  const ipAttempt = registerFailedAttempt(ipKey);

  // Stationsebene mit hoeherem Kontingent als die IP-Ebene, damit ein
  // gelegentlicher Tippfehler mehrere Geraete im selben Netz nicht parallel
  // aussperrt.
  const stationAttempt = bumpRecord(
    `${ACCOUNT_KEY_PREFIX}${station}`,
    ACCOUNT_MAX_ATTEMPTS,
    ACCOUNT_WINDOW_MS,
    30 * 1000,
    Math.min(300 * 1000, 120 * 1000) // Obergrenze Stationssperre: 2 Minuten
  );

  // Globaler Boden zaehlt jeden Versuch unabhaengig von bestehenden Sperren mit.
  const globalRecord = bumpRecord(GLOBAL_FLOOD_KEY, GLOBAL_MAX_ATTEMPTS, GLOBAL_WINDOW_MS, 60 * 1000, 5 * 60 * 1000);

  if (ipAttempt.locked) {
    return { locked: true, remainingSeconds: ipAttempt.remainingSeconds, layer: 'ip' };
  }
  if (stationAttempt.locked) {
    return { locked: true, remainingSeconds: stationAttempt.remainingSeconds, layer: 'account' };
  }
  const globalState = checkGlobalFlood();
  if (!globalState.allowed || globalRecord.locked) {
    return {
      locked: true,
      remainingSeconds: Math.max(30, globalRecord.remainingSeconds || globalState.remainingSeconds),
      layer: 'global',
    };
  }
  return { locked: false, remainingSeconds: 0, layer: 'ip' };
}

export function resetLayeredRateLimit(ipKey: string, station: string): void {
  resetRateLimit(ipKey);
  resetRateLimit(`${ACCOUNT_KEY_PREFIX}${station}`);
  // Globale Zaehlung wird bewusst NICHT zurueckgesetzt: Sie bildet einen
  // Instanzweiten Flutschutz ab und soll nicht durch Einzelanmeldungen
  // absinkbar sein.
}

function checkGlobalFlood(): { allowed: boolean; remainingSeconds: number } {
  return checkRateLimit(GLOBAL_FLOOD_KEY);
}

interface BumpResult {
  locked: boolean;
  remainingSeconds: number;
}

/** Generischer Versuchszaehler fuer Account-/Global-Ebene (gleiche Semantik wie IP-Ebene). */
function bumpRecord(
  key: string,
  maxAttempts: number,
  windowMs: number,
  baseLockMs: number,
  maxLockMs: number
): BumpResult {
  hydrateFromDb();
  const now = Date.now();
  let record = attemptStore.get(key);

  if (!record || now - record.firstAttempt > windowMs) {
    record = { attempts: 1, firstAttempt: now, lockUntil: 0 };
  } else {
    record.attempts += 1;
  }

  if (record.attempts >= maxAttempts && record.lockUntil <= now) {
    const exponent = record.attempts - maxAttempts;
    const lockDuration = Math.min(maxLockMs, baseLockMs * Math.pow(2, exponent));
    record.firstAttempt = now; // Fenster startet neu, sonst wuerde die Sperre sofort ablaufen
    record.lockUntil = now + lockDuration;
    attemptStore.set(key, record);
    persistToDb(key, record);
    return { locked: true, remainingSeconds: Math.ceil(lockDuration / 1000) };
  }

  if (record.lockUntil > now) {
    // Bereits gesperrt: Restzeit verlaengern verhindern (kein Rolling Lockout aus Ballenversuchen)
    attemptStore.set(key, record);
    persistToDb(key, record);
    return { locked: false, remainingSeconds: Math.ceil((record.lockUntil - now) / 1000) };
  }

  attemptStore.set(key, record);
  persistToDb(key, record);
  return { locked: false, remainingSeconds: 0 };
}
