import crypto from 'crypto';
import prisma from './db';

/**
 * Stellt sicher, dass ein stabiles JWT-Session-Secret existiert.
 *
 * Problem bisher: Ohne SESSION_SECRET-Env hat jede Runtime (Node-Server UND
 * Edge-Middleware-Sandbox) beim ersten Zugriff ein EIGENES Zufalls-Secret
 * generiert. Die Middleware konnte dadurch nie einen vom Server signierten
 * Cookie verifizieren -> jede /admin-Navigation endete beim Redirect zum
 * Startbildschirm, alle API-Calls liefen in 401.
 *
 * Loesung: Das Secret wird einmalig erzeugt und PERSISTENT in der Datenbank
 * abgelegt (EventConfig.sessionSecret) und an process.env.SESSION_SECRET
 * uebergeben. Alle Node-Runtimes signieren und pruefen damit konsistent.
 */
export async function ensureSessionSecret(): Promise<string> {
  // Explizit gesetztes Env-Secret hat immer Vorrang
  const envSecret = process.env.SESSION_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    setRuntimeSecret(envSecret);
    return envSecret;
  }

  try {
    const config = await prisma.eventConfig.findUnique({
      where: { id: 'default' },
      select: { sessionSecret: true },
    });

    let secret = config?.sessionSecret?.trim() || '';

    if (secret.length < 16) {
      // Kryptografisch sicheres 256-Bit Secret erzeugen und dauerhaft speichern
      secret = crypto.randomBytes(32).toString('hex');
      await prisma.eventConfig.upsert({
        where: { id: 'default' },
        update: { sessionSecret: secret },
        create: { id: 'default', sessionSecret: secret },
      });
      console.log('[AUTH] Neues JWT-Session-Secret erzeugt und in der Datenbank gespeichert.');
    }

    setRuntimeSecret(secret);
    return secret;
  } catch (e) {
    console.warn('[AUTH] Session-Secret konnte nicht aus der DB geladen werden:', e instanceof Error ? e.message : e);
    // Fallback: bisheriges Lazy-Verhalten (globalThis) - besser als kein Betrieb
    return '';
  }
}

function setRuntimeSecret(secret: string): void {
  process.env.SESSION_SECRET = secret;
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).__OPENBON_JWT_SECRET__ = secret;
  }
}
