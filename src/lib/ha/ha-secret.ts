import prisma from '../db';

let cachedSecret: { value: string; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 30000;

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

/**
 * Prueft den X-HA-Secret-Header eines eingehenden Sync-Requests.
 * Gibt false zurueck, wenn ein Secret konfiguriert ist, aber nicht uebereinstimmt
 * oder fehlt. Ohne konfiguriertes Secret wird der Betrieb (Legacy) erlaubt.
 */
export async function verifyHaSecret(req: Request): Promise<boolean> {
  const expected = await getHaSyncSecret();
  if (!expected) return true; // kein Secret konfiguriert -> Legacy-Verhalten

  const provided =
    req.headers.get('x-ha-secret') ||
    new URL(req.url).searchParams.get('secret') ||
    '';

  return provided === expected;
}
