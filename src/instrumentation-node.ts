/**
 * Node-only Teil des Instrumentation-Hooks.
 *
 * Muss in einer EIGENEN Datei liegen: `src/instrumentation.ts` wird von Next.js
 * auch fuer die Edge-Runtime uebersetzt (wir haben eine Middleware). Die hier
 * verwendeten Module (`fs`, `net`, `crypto`) gibt es dort nicht - der Build
 * scheiterte deshalb mit "Module not found". Durch den Aufruf in einem
 * `if (process.env.NEXT_RUNTIME === 'nodejs')`-Block wird dieser Import beim
 * Edge-Build als toter Zweig entfernt.
 */
export async function registerNodeInstrumentation() {

  // Zuerst: stabiles JWT-Secret aus der DB laden/erzeugen, damit Signierung
  // (API-Routen) und Pruefung konsistent funktionieren.
  try {
    const { ensureSessionSecret } = await import('@/lib/session-secret');
    await ensureSessionSecret();
  } catch (e) {
    console.warn('[INSTRUMENTATION] Session-Secret konnte nicht initialisiert werden:', e);
  }

  // M3.1 Historische Klartext-Kellner-PINs einmalig auf PBKDF2 heben.
  try {
    const { migratePlaintextWaiterPins } = await import('@/lib/auth-pin');
    await migratePlaintextWaiterPins();
  } catch (e) {
    console.warn('[INSTRUMENTATION] Waiter-PIN-Migration fehlgeschlagen:', e);
  }

  // M5.1 HA-Sync-Secret haerten (Einzelknoten automatisch, Dual via Pairing).
  try {
    const { ensureHaSecretHardened } = await import('@/lib/ha/ha-secret');
    await ensureHaSecretHardened();
  } catch (e) {
    console.warn('[INSTRUMENTATION] HA-Secret-Haertung fehlgeschlagen:', e);
  }

  try {
    const { startDiagnosticsCycle } = await import('@/lib/diagnostics');
    startDiagnosticsCycle();
  } catch (e) {
    console.warn('[INSTRUMENTATION] Diagnostik-Zyklus konnte nicht gestartet werden:', e);
  }

  try {
    const { startCleanupScheduler } = await import('@/lib/cleanup');
    startCleanupScheduler();
  } catch (e) {
    console.warn('[INSTRUMENTATION] Cleanup-Scheduler konnte nicht gestartet werden:', e);
  }

  // Der Backup-Zeitplan war bisher nirgends angebunden: die Funktion existierte,
  // wurde aber nie aufgerufen - es gab also nie ein automatisches Backup.
  try {
    const { startAutoBackupScheduler } = await import('@/lib/backup-scheduler');
    startAutoBackupScheduler();
  } catch (e) {
    console.warn('[INSTRUMENTATION] Backup-Scheduler konnte nicht gestartet werden:', e);
  }

  // Wiederaufnahme haengengebliebener Druckauftraege nach einem Neustart.
  try {
    const spooler = (await import('@/lib/printer/network-spooler')).default;
    if (typeof (spooler as { recoverPendingJobs?: () => Promise<void> }).recoverPendingJobs === 'function') {
      await (spooler as unknown as { recoverPendingJobs: () => Promise<void> }).recoverPendingJobs();
    }
  } catch (e) {
    console.warn('[INSTRUMENTATION] Druckauftraege konnten nicht wiederhergestellt werden:', e);
  }
}
