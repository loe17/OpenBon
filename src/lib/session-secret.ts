import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
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
      persistSecretToEnvFile(secret);
      console.log('[AUTH] Neues JWT-Session-Secret erzeugt und dauerhaft gespeichert.');
    } else if (!process.env.SESSION_SECRET) {
      // Secret liegt in der DB, aber noch nicht als Umgebungsvariable vor.
      // Ohne .env-Eintrag kann die Edge-Middleware die Signatur nicht pruefen.
      persistSecretToEnvFile(secret);
    }

    setRuntimeSecret(secret);
    return secret;
  } catch (e) {
    console.warn(
      '[AUTH] Session-Secret konnte nicht aus der DB geladen/erstellt werden:',
      e instanceof Error ? e.message : e,
      '- Anmeldungen bleiben gesperrt (fail-closed), bis ein Secret etabliert ist.'
    );
    // Bewusst KEIN oeffentlicher Fallback mehr: Ohne Secret sind Tokens
    // nicht signier- und nicht verifizierbar (M2.1).
    return '';
  }
}

function setRuntimeSecret(secret: string): void {
  process.env.SESSION_SECRET = secret;
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).__OPENBON_JWT_SECRET__ = secret;
  }
}

/**
 * Schreibt das Secret zusaetzlich in die .env-Datei.
 *
 * Grund: Die Edge-Middleware laeuft in einer eigenen Sandbox und sieht keine
 * zur Laufzeit gesetzten `process.env`-Werte. Nur wenn SESSION_SECRET beim
 * Prozessstart bereits als echte Umgebungsvariable existiert, kann die
 * Middleware die JWT-Signatur selbst pruefen statt das Token nur zu dekodieren.
 * Ab dem naechsten Serverstart ist das der Fall.
 */
function persistSecretToEnvFile(secret: string): void {
  try {
    const envPath = path.join(process.cwd(), '.env');
    let content = '';
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf-8');
    }

    if (/^SESSION_SECRET=/m.test(content)) {
      content = content.replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET="${secret}"`);
    } else {
      if (content.length > 0 && !content.endsWith('\n')) content += '\n';
      content += `SESSION_SECRET="${secret}"\n`;
    }

    fs.writeFileSync(envPath, content, 'utf-8');
    console.log('[AUTH] SESSION_SECRET in .env hinterlegt (ab naechstem Start prueft auch die Middleware die Signatur).');
  } catch (e) {
    console.warn(
      '[AUTH] SESSION_SECRET konnte nicht in .env geschrieben werden:',
      e instanceof Error ? e.message : e
    );
  }
}
