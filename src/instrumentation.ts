/**
 * Next.js Instrumentation Hook: wird einmalig beim Serverstart ausgeführt
 * (Node.js-Runtime). Startet hier zentral alle Hintergrund-Scheduler,
 * damit kein HTTP-Selbstanruf aus server.js mehr nötig ist.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Zuerst: stabiles JWT-Secret aus der DB laden/erzeugen, damit Signierung
  // (API-Routen) und Pruefung konsistent funktionieren.
  try {
    const { ensureSessionSecret } = await import('@/lib/session-secret');
    await ensureSessionSecret();
  } catch (e) {
    console.warn('[INSTRUMENTATION] Session-Secret konnte nicht initialisiert werden:', e);
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
}
