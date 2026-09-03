import crypto from 'crypto';
import prisma from '../db';

let cachedSecret: { value: string; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 30000;

/**
 * Secrets, die oeffentlich im Quelltext/Repo bekannt sind oder leer sind.
 * Sie erzeugen keine echte Vertraulichkeit und muessen rotiert werden.
 */
export const WEAK_HA_SECRETS = new Set<string>(['', 'openbon-ha-sync-secret-2026']);

/** M5.1 Automatisch erzeugtes Secret fuer EINZELKNOTEN-Betrieb. */
export function generateStrongHaSecret(): string {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * Liefert das Shared Secret fuer die HA-Sync-Endpunkte.
 * Quelle: ENV `HA_SYNC_SECRET` (Vorrang) oder DB-Konfiguration `haSyncSecret`.
 * Wird benutzt, damit nur Primary und Standby einander abfragen koennen.
 */
export async function getHaSyncSecret(): Promise<string> {
  const envSecret = process.env.HA_SYNC_SECRET?.trim();
  if (envSecret) return envSecret;

  if (cachedSecret && Date.now() - cachedSecret.fetchedAt < CACHE_TTL_MS) {
    return cachedSecret.value;
  }

  try {
    const config = await prisma.eventConfig.findUnique({
      where: { id: 'default' },
      select: { haSyncSecret: true },
    });
    const value = config?.haSyncSecret?.trim() || '';
    cachedSecret = { value, fetchedAt: Date.now() };
    return value;
  } catch {
    return cachedSecret?.value || '';
  }
}

/* ------------------------------------------------------------------ */
/* N1 Partner-URL-Erkennung & Status                                    */
/*                                                                      */
/* Der Weak-Secret-Bypass darf NICHT nur die ENV-Umgebungsvariable       */
/* beruecksichtigen: Die Admin-Oberflaeche schreibt die Partner-URL      */
/* ausschliesslich in die Datenbank (EventConfig.haPartnerUrl). Ohne     */
/* diese zentrale Erkennung erhielten DB-konfigurierte Doppelinstallation*/
/* en Heartbeat-401er und faelschlich einen Failover ausloesen.          */
/* ------------------------------------------------------------------ */

let cachedPartner: { url: string | null; fetchedAt: number } | null = null;
const PARTNER_CACHE_TTL_MS = 30_000;

/** Partner-URL: ENV zuerst, sonst Datenbank (mit kleinem Cache). */
export async function getConfiguredPartnerUrl(): Promise<string | null> {
  const envUrl = process.env.HA_PARTNER_URL?.trim();
  if (envUrl) return envUrl;

  if (cachedPartner && Date.now() - cachedPartner.fetchedAt < PARTNER_CACHE_TTL_MS) {
    return cachedPartner.url;
  }

  try {
    const config = await prisma.eventConfig.findUnique({
      where: { id: 'default' },
      select: { haPartnerUrl: true, haRole: true },
    });
    // Wenn Einzelserver-Betrieb (STANDALONE), ist kein Partner aktiv
    if (!config?.haRole || config.haRole === 'STANDALONE') {
      cachedPartner = { url: null, fetchedAt: Date.now() };
      return null;
    }
    const url = config?.haPartnerUrl?.trim() || null;
    cachedPartner = { url, fetchedAt: Date.now() };
    return url;
  } catch {
    return cachedPartner?.url ?? null;
  }
}

/** Invalidiert beide Kurzzeitcaches (nach Secret-/URL-Aenderungen aufrufen). */
export function clearHaCaches(): void {
  cachedSecret = null;
  cachedPartner = null;
}

export interface HaSecretStatus {
  /** Ein Secret ist konfiguriert (egal wie stark). */
  hasSecret: boolean;
  /** Das aktive Secret ist leer oder oeffentlich bekannt. */
  isWeak: boolean;
  source: 'ENV' | 'DB' | 'NONE';
  /** Ein Partnerknoten ist konfiguriert (ENV oder DB). */
  partnerConfigured: boolean;
  /** HA_ENFORCE_SECRET=1 -> ohne starkes Secret wird fail-closed geantwortet. */
  enforceMode: boolean;
}

/**
 * N1 Maschinenlesbarer Zustand fuer Diagnose/UI - enthaelt NIEMALS den
 * Secret-Wert selbst (der GET /api/config bleibt den Admin-Clients vorbehalten).
 */
export async function getHaSecretStatus(): Promise<HaSecretStatus> {
  const envSecret = process.env.HA_SYNC_SECRET?.trim();
  const partnerConfigured = Boolean(await getConfiguredPartnerUrl());
  const enforceMode = process.env.HA_ENFORCE_SECRET === '1';

  if (envSecret) {
    return {
      hasSecret: true,
      isWeak: WEAK_HA_SECRETS.has(envSecret),
      source: 'ENV',
      partnerConfigured,
      enforceMode,
    };
  }

  let dbValue = '';
  try {
    dbValue =
      (
        await prisma.eventConfig.findUnique({
          where: { id: 'default' },
          select: { haSyncSecret: true },
        })
      )?.haSyncSecret?.trim() || '';
  } catch {}

  return {
    hasSecret: dbValue.length > 0,
    isWeak: WEAK_HA_SECRETS.has(dbValue),
    source: dbValue ? 'DB' : 'NONE',
    partnerConfigured,
    enforceMode,
  };
}

/**
 * N1 Schreibt das Sync-Secret in die Konfiguration und invalidiert saemtliche
 * Caches. Aufrufer muessen ADMIN-gesichert sein (siehe /api/system/ha/*).
 */
export async function setHaSyncSecret(nextValue: string): Promise<void> {
  await prisma.eventConfig.upsert({
    where: { id: 'default' },
    update: { haSyncSecret: nextValue },
    create: { id: 'default', haSyncSecret: nextValue },
  });
  clearHaCaches();
}

let loggedLegacyBypass = false;

/**
 * M5.1 Prueft den X-HA-Secret-Header eines eingehenden Sync-Requests.
 *
 * Neues Verhalten:
 *  - Konfiguriertes, NICHT-oeffentliches Secret: strikte konstantzeitige Pruefung.
 *  - Fehlendes ODER oeffentlich bekanntes Default-Secret bei AKTIVEM Partner-
 *    Setup: Warnung pro Boot + Legacy-Durchlass, DAMIT der laufende Doppelbetrieb
 *    nicht abrupt ausfaellt. Mit ENV HA_ENFORCE_SECRET=1 wird sofort fail-closed.
 *    Einzelnodes werden durch ensureHaSecretHardened() automatisch gehaertet.
 *
 * Der fruehere `?secret=`-Query-Umweg wurde entfernt (Log-Leakage-Gefahr).
 */
export async function verifyHaSecret(req: Request): Promise<boolean> {
  const expected = (await getHaSyncSecret()) || '';

  if (WEAK_HA_SECRETS.has(expected)) {
    // Gehärtet: schwaches/fehlendes Secret lehnt immer ab, außer explizit
    // HA_ALLOW_LEGACY=1 für das Upgrade-Fenster alter Doppelinstallationen.
    const partnerUrl = await getConfiguredPartnerUrl();
    if (!loggedLegacyBypass) {
      loggedLegacyBypass = true;
      console.warn(
        '[HA] Schwaches/fehlendes HA-Sync-Secret – Sync abgelehnt' +
          (partnerUrl ? ` (Partner: ${partnerUrl})` : '') +
          '. Bitte über den HA-Assistenten pairen.'
      );
    }
    if (process.env.HA_ALLOW_LEGACY === '1' && partnerUrl && process.env.HA_ENFORCE_SECRET !== '1') {
      return true;
    }
    return false;
  }

  const provided = req.headers.get('x-ha-secret') || '';
  if (!provided) return false;
  if (new URL(req.url).searchParams.has('secret')) {
    // Alte Clients, die das Query-Secret nutzen, sind nicht mehr zulaessig.
    return false;
  }

  return timingSafeEqualHex(provided.trim(), expected);
}

/** Konstantzeitiger Vergleich (keine Timing-Orakel ueber Praefixe). */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) {
    // Auch Laengenunterschiede kosten konstant Zeit je Byte-Slot
    let diffMismatch = a.length ^ b.length;
    const limit = Math.max(a.length, b.length);
    for (let i = 0; i < limit; i++) {
      diffMismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    }
    return diffMismatch === 0 && a.length === b.length && a.length > 0;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * M5.1 Haertet das Sync-Secret beim Start fuer Systeme OHNE konfigurierten
 * Partnerknoten vollautomatisch. Dual-Setups behalten ihr (ggf. altes) Secret,
 * bis einmalig gepairt wurde - hier wartet die dokumentierte Rotaufgabe.
 */
export async function ensureHaSecretHardened(): Promise<void> {
  try {
    const config = await prisma.eventConfig.findUnique({
      where: { id: 'default' },
      select: { haSyncSecret: true, haPartnerUrl: true },
    });

    if (!config) return;
    const hasPartner = Boolean(config.haPartnerUrl && config.haPartnerUrl.trim());
    const current = config.haSyncSecret?.trim() || '';

    if (hasPartner) {
      // Doppelbetrieb: Secret wird NICHT automatisch rotiert (beide Knoten
      // muessen es teilen). Einmalig ueber scripts/ha-pair.mjs pairen.
      return;
    }

    if (WEAK_HA_SECRETS.has(current)) {
      const next = generateStrongHaSecret();
      await prisma.eventConfig.upsert({
        where: { id: 'default' },
        update: { haSyncSecret: next },
        create: { id: 'default', haSyncSecret: next },
      });
      cachedSecret = null; // Cache invalidieren
      console.log('[HA] Starkes HA-Sync-Secret fuer Einzelknoten-Betrieb erzeugt.');
    }
  } catch (err) {
    console.warn(
      '[HA] HA-Secret-Haertung uebersprungen:',
      err instanceof Error ? err.message : err
    );
  }
}
