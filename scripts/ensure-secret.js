/**
 * Vorstart-Schritt: stellt sicher, dass ein stabiler Sitzungsschluessel
 * existiert, BEVOR der Server startet.
 *
 * Hintergrund
 * -----------
 * Die Zugriffsschranke (Middleware) laeuft in einer eigenen Sandbox und sieht
 * nur Umgebungsvariablen, die beim Prozessstart bereits gesetzt waren. Erzeugt
 * die Anwendung den Schluessel erst zur Laufzeit, kann die Schranke die
 * Signatur der Anmeldungen im selben Lauf noch nicht pruefen - erst nach einem
 * zweiten Start. Genau diesen zweiten Start macht dieses Skript ueberfluessig.
 *
 * Ablauf
 * ------
 * 1. Steht SESSION_SECRET schon in der .env, ist nichts zu tun.
 * 2. Sonst wird der in der Datenbank hinterlegte Schluessel uebernommen.
 * 3. Gibt es auch dort keinen, wird ein neuer 256-Bit-Schluessel erzeugt und
 *    in BEIDEN Ablagen gespeichert (Datenbank und .env).
 *
 * Das Skript ist absichtlich fehlertolerant: schlaegt es fehl, wird der Start
 * NICHT abgebrochen. Die Anwendung faellt dann auf ihr bisheriges Verhalten
 * zurueck (Schluessel zur Laufzeit erzeugen, Pruefung ab dem naechsten Start).
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(process.cwd(), '.env');

function readEnvFile() {
  try {
    return fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf-8') : '';
  } catch {
    return '';
  }
}

function currentEnvSecret(content) {
  const match = content.match(/^SESSION_SECRET\s*=\s*"?([^"\r\n]*)"?\s*$/m);
  return match ? match[1].trim() : '';
}

function writeEnvSecret(secret) {
  let content = readEnvFile();
  if (/^SESSION_SECRET\s*=/m.test(content)) {
    content = content.replace(/^SESSION_SECRET\s*=.*$/m, `SESSION_SECRET="${secret}"`);
  } else {
    if (content.length > 0 && !content.endsWith('\n')) content += '\n';
    content += `SESSION_SECRET="${secret}"\n`;
  }
  fs.writeFileSync(ENV_PATH, content, 'utf-8');
}

async function main() {
  const envContent = readEnvFile();
  const existing = currentEnvSecret(envContent);

  if (existing.length >= 16) {
    console.log('[AUTH] Sitzungsschluessel vorhanden - kein zweiter Start noetig.');
    return;
  }

  // DATABASE_URL setzen wie der Server es tut, damit Prisma dieselbe Datei sieht
  try {
    require('dotenv').config();
  } catch {}
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'file:./prisma/dev.db';
  }

  let prisma = null;
  try {
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient();
  } catch (e) {
    console.warn('[AUTH] Prisma nicht verfuegbar - Schluessel wird beim Serverstart erzeugt.');
    return;
  }

  try {
    const config = await prisma.eventConfig.findUnique({
      where: { id: 'default' },
      select: { sessionSecret: true },
    });

    let secret = (config && config.sessionSecret ? config.sessionSecret : '').trim();

    if (secret.length >= 16) {
      writeEnvSecret(secret);
      console.log('[AUTH] Sitzungsschluessel aus der Datenbank in die .env uebernommen.');
    } else {
      secret = crypto.randomBytes(32).toString('hex');
      await prisma.eventConfig.upsert({
        where: { id: 'default' },
        update: { sessionSecret: secret },
        create: { id: 'default', sessionSecret: secret },
      });
      writeEnvSecret(secret);
      console.log('[AUTH] Neuer Sitzungsschluessel erzeugt und dauerhaft gespeichert.');
    }
  } catch (e) {
    console.warn(
      '[AUTH] Sitzungsschluessel konnte nicht vorbereitet werden:',
      e instanceof Error ? e.message : e
    );
  } finally {
    try {
      await prisma.$disconnect();
    } catch {}
  }
}

main().catch((e) => {
  console.warn('[AUTH] Vorstart-Schritt uebersprungen:', e instanceof Error ? e.message : e);
});
