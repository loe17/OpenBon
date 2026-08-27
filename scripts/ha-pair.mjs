#!/usr/bin/env node
/**
 * @deprecated seit v0.4.11
 *
 * N1: Das HA-Pairing läuft jetzt als IN-APP-ASSISTENT:
 *   Admin-Oberfläche -> Einstellungen -> Allgemein -> Hochverfügbarkeit
 *   -> "Pairing starten" (6-stelliger Bestätigungscode statt Token-Befehl).
 *
 * HINWEIS ZU DIESER DATEI: Sie funktioniert NICHT mehr wie dokumentiert -
 * das Script setzt haSyncSecret per POST /api/config, dieser Feldname ist
 * seit der Restore-Whitelist (v0.4.10) serverseitig gesperrt. Die Datei
 * bleibt nur als historische Referenz im Repo.
 *
 * ------------------------------------------------------------------------
 */
 * M5.1 HA-Secret-Pairing fuer OpenBon Doppelinstallationen (Primary <-> Standby).
 *
 * Hintergrund: Bis v0.4.9 verwendeten beide Knoten das im Quellcode bekannte
 * Default-Secret "openbon-ha-sync-secret-2026". Damit der LIVE-Doppelbetrieb
 * beim Upgrade nicht abreisst, akzeptiert v0.4.10 dieses alte Secret noch mit
 * Warnung - diese Rotaufgabe schliesst das Fenster ab.
 *
 * Aufruf (auf einer beliebigen Maschine mit Zugriff auf beide Knoten):
 *
 *   node scripts/ha-pair.mjs \
 *     --primary http://192.168.1.100:3000 \
 *     --standby http://192.168.1.101:3000 \
 *     --token <ADMIN-SESSION-TOKEN>
 *
 * Den ADMIN-Token erhaelt man per Anmeldung an einem Admin-Geraet (Login-
 * Antwort-Feld `token`) oder aus dem lokalen Storage der angemeldeten Session.
 *
 * Nur anzeigen ohne setzen:
 *   node scripts/ha-pair.mjs --print
 */

import { randomBytes } from 'node:crypto';

const args = process.argv.slice(2);

function argValue(flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const WEAK_HA_SECRETS = ['', 'openbon-ha-sync-secret-2026'];

async function main() {
  if (args.includes('--print')) {
    console.log(generateStrongHaSecret());
    return;
  }

  const primary = (argValue('--primary') || '').replace(/\/+$/, '');
  const standby = (argValue('--standby') || '').replace(/\/+$/, '');
  const explicitSecret = argValue('--secret');
  const token = argValue('--token');

  if (!primary || !standby) {
    printUsage();
    process.exit(1);
  }

  let nodeUrls;
  try {
    nodeUrls = [new URL(primary), new URL(standby)];
  } catch {
    console.error('[FEHLER] Primary-/Standby-URL sind nicht gueltig.');
    process.exit(1);
  }

  const secret = explicitSecret || generateStrongHaSecret();
  if (WEAK_HA_SECRETS.has(secret.trim())) {
    console.error('[FEHLER] Das angegebene Secret ist leer oder bekannt unsicher.');
    process.exit(1);
  }

  for (const url of nodeUrls) {
    // Altbestand pruefen und Klartext-Hinweis geben
    try {
      const res = await fetch(`${url.origin}/api/sync/heartbeat`, {
        headers: { 'X-HA-Secret': 'openbon-ha-sync-secret-2026' },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        console.log(`[HINWEIS] ${url.origin} nutzt noch das bekannte Default-Secret - Rotation ist dringend.`);
      } else {
        console.log(`[INFO] ${url.origin} akzeptiert das Default-Secret nicht mehr (Bereits gehaertet?).`);
      }
    } catch {
      console.warn(`[WARNUNG] ${url.origin} ist nicht erreichbar - fahre trotzdem fort.`);
    }

    if (!explicitSecret && !token) {
      printUsage();
      console.error('[FEHLER] Fuer das Setzen wird --token benoetigt (oder nur --print bzw. --secret nutzen).');
      process.exit(1);
    }

    try {
      const setRes = await fetch(`${url.origin}/api/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ haSyncSecret: secret }),
        signal: AbortSignal.timeout(10000),
      });

      if (!setRes.ok) {
        const bodyText = await setRes.text().catch(() => '(keine Antwort)');
        throw new Error(`${setRes.status}: ${bodyText.slice(0, 200)}`);
      }
      console.log(`[OK] Neues Sync-Secret auf ${url.origin} gesetzt.`);
    } catch (err) {
      console.error(`[FEHLER] Konnte Secret auf ${url.origin} nicht setzen: ${err.message}`);
      process.exit(2);
    }
  }

  // Validierung: Beide Knoten muessen das neue Secret fuer den Heartbeat akzeptieren.
  await sleep(31_000); // getHaSyncSecret() cachet bis zu 30 Sekunden pro Node-Prozess
  let allHealthy = true;
  for (const url of nodeUrls) {
    try {
      const res = await fetch(`${url.origin}/api/sync/heartbeat`, {
        headers: { 'X-HA-Secret': secret },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        console.log(`[OK] Heartbeat auf ${url.origin} validiert.`);
      } else {
        allHealthy = false;
        console.error(`[WARNUNG] Heartbeat auf ${url.origin} antwortete ${res.status}.`);
      }
    } catch (err) {
      allHealthy = false;
      console.error(`[WARNUNG] Heartbeat auf ${url.origin} nicht erreichbar: ${err.message}`);
    }
  }

  if (allHealthy) {
    console.log('\n[SUCCESS] HA-Secret auf beiden Knoten rotiert und verifiziert.');
    console.log('Tipp: Mit ENV HA_ENFORCE_SECRET=1 wird das schwache Legacy-Secret ab sofort hart abgelehnt.');
  } else {
    console.log('\n[TEILWEISE] Secret gesetzt, aber mind. ein Knoten unvalidiert. Herzschlag/Warnungen beobachten.');
  }
}

function generateStrongHaSecret() {
  return randomBytes(24).toString('hex');
}

function printUsage() {
  console.log(
    [
      '',
      'Verwendung:',
      '  node scripts/ha-pair.mjs --primary http://<PRIMARY>:3000 --standby http://<STANDBY>:3001 \\',
      '       --token <ADMIN_SESSION_TOKEN>',
      '',
      'Optionen:',
      '  --print            Erzeugt NUR ein starkes Secret und gibt es aus.',
      '  --secret <wert>    Bestehendes Secret uebernehmen statt neu generieren.',
      '',
    ].join('\n')
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(3);
});
