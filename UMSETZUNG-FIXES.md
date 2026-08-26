# OpenBon – Umsetzung der Prüfliste (Schritt 1–10)

Stand: 25.08.2026 · Basis: v0.3.8 · Alle Änderungen liegen in
`C:\Users\Lukas\Documents\GeminiTemp\Kassensystem`

Auftrag war: *„beginne bei 1 und behebe alles schritt für schritt“* – abgearbeitet
wurde die korrigierte Fassung der Liste aus `PRUEFUNG-OPTIMIERUNGSPLAN.md`,
nicht die ursprüngliche `260825_Optimierungen.md` (dort waren 2 von 13 Punkten
sachlich falsch und 6 nur teilweise richtig).

---

## Schritt 1 – Echtzeit-Ereignisse (`server.js`)

`global.io` wurde nie zugewiesen. Sämtliche 96 `global.io.emit(...)`-Aufrufe in
den API-Routen liefen deshalb still ins Leere: keine Live-Bestellung im
Küchenmonitor, kein Tischstatus, kein Storno-Signal, kein Team-Funk, kein
Live-Druckverlauf, kein Protokoll-Stream.

**Behoben:** `global.io = io;` beim Serverstart. Das ist die Ursache hinter den
Punkten A4, A9 und A10 der ursprünglichen Liste sowie rund neun weiteren
Symptomen.

## Schritt 2 – Serverseitige Authentifizierung

Keine der 59 API-Routen prüfte die Signatur des Session-Tokens; die Middleware
hat es nur dekodiert. Ein selbst zusammengebautes, **unsigniertes** Token mit
`{"role":"ADMIN"}` öffnete das gesamte System – inklusive
`/api/system/update` (Befehlsausführung auf dem Kassenrechner).

**Behoben:**

- neues `src/lib/api-guard.ts` mit `requireApiAuth` / `requireAdmin` / `requireStation`
- Schutz auf **52 von 59** Routen; bewusst öffentlich bleiben: `auth/pin`,
  `config/public`, `guest/orders`, `health`, `network-ip`, `receipt/[code]`,
  `sync/heartbeat`
- `middleware.ts` prüft die Signatur, sobald ein `SESSION_SECRET` vorliegt
- `session-secret.ts` schreibt das erzeugte Geheimnis in die `.env`, damit die
  Edge-Middleware ab dem nächsten Start ebenfalls prüfen kann
- `sync/pull` akzeptiert weiterhin das HA-Shared-Secret **oder** eine
  Administrator-Session – die Replikation bleibt funktionsfähig

## Schritt 3 – Stations-Gate

Stationen rendern bisher durch, obwohl ihre Datenabrufe mit 401 zurückkamen –
Ergebnis: leere Artikel-, Tisch- und KDS-Listen ohne jeden Hinweis.

**Behoben:** `StationGate` prüft die Session beim Aufruf und zeigt sofort das
PIN-Feld. Angebunden an: Bonkasse, Tischübersicht, Küchenmonitor,
Bestellaufnahme, Kassiervorgang, Schichtabrechnung, Team-Funk, virtueller
Drucker. Ohne Netz arbeitet die Station weiter (Offline-First) und zeigt einen
Hinweisbalken.

## Schritt 4–7 – Bezahlflow, Kellner, Drucker, Artikel

- **Idempotenz-Schlüssel** im Kassiervorgang gilt jetzt für genau **einen**
  Vorgang; bisher wurde bei Teilzahlungen derselbe Schlüssel wiederverwendet,
  die zweite Teilzahlung wurde vom Server als Wiederholung verworfen.
- **Rechnungsteilung nach Wert** statt `Math.ceil(Menge/n)`: die Beträge werden
  nach Stückwert absteigend verteilt, jede Teilrechnung erhält mindestens eine
  Position.
- **Schichtabrechnung** löscht das Kellnerprofil nicht mehr (`deleteMany`),
  sondern setzt es inaktiv – die Zuordnung vergangener Umsätze bleibt erhalten.
- **Selbst-Anmeldung** der Bedienung über `/api/waiters/checkin` (ohne PIN-Vergabe).
- **Druckgruppen-Bearbeitung**: das Formular fehlte vollständig, Bearbeiten und
  Löschen sind ergänzt; Drucker lassen sich per PUT ändern statt doppelt anzulegen.
- **Artikelpflege**: Warengruppe und Druckgruppe sind jetzt auswählbar.

## Schritt 8 – Offline-Warteschlange & Service Worker

**Vorher:** Ein echter Serverfehler (5xx) wurde der Kasse als `success: true`
gemeldet – die Bedienung sah einen Erfolg, obwohl nichts gebucht war. Bei jeder
Wiederverbindung wurde alles gleichzeitig erneut gesendet, und endgültig
gescheiterte Vorgänge verschwanden unsichtbar aus der Warteschlange.

**Jetzt:**

- Rückgabewert unterscheidet bestätigt / **noch offen** (`pending`) mit Grund
  (`OFFLINE`, `SERVER_ERROR`, `NETWORK_ERROR`); Bonkasse und Bestellaufnahme
  zeigen entsprechend „noch NICHT gebucht“ statt eines Erfolgshinweises
- gestaffelte Wiederholung (2 s → 10 s → 30 s → 2 min → 5 min), danach `FAILED`
- Doppelversand ausgeschlossen: parallele Aufrufe laufen zusammen
- gescheiterte Vorgänge werden im Statusbalken **rot** gemeldet, mit
  „Erneut versuchen“ – sie verschwinden nicht mehr still
- **SB-Kiosk** täuscht keinen Erfolg mehr vor: ohne Serverbestätigung gibt es
  keine Abholnummer, der Vorgang wird verworfen und der Gast an das Personal
  verwiesen (vorher zeigte das Terminal `#K-NaN`)
- `sw.js`: der Offline-Ersatz (`caches.match(a) || caches.match(b)`) war ein
  Promise-Vergleich und damit **immer wahr** → weiße Seite. Jetzt korrekt
  aufgelöst, mit eigener Offline-Seite als letzter Rückfallebene.
  Navigationen laufen „Netz zuerst“, damit Stationen nach einem Update nicht auf
  einer alten Oberfläche hängen bleiben. `/pos`, `/kitchen` und `/chat` sind im
  Vorrat ergänzt.

## Schritt 9 – Gast-Sicht, Drucker-Monitor, Protokoll

- **Gast-Sicht** erscheint nur noch, wenn die Kundenanzeige in den Einstellungen
  freigegeben ist.
- **Virtueller Drucker**: die zwei auseinandergelaufenen Oberflächen sind zu
  einer zusammengeführt (`components/printer/virtual-printer-monitor.tsx`).
  `?printerName=` wird jetzt ausgewertet, „Verlauf leeren“ bleibt der
  Administration vorbehalten.
- **Protokoll (GoBD)**: bisher zwei Aufrufstellen. Ergänzt für Bestellung,
  Direktverkauf, Zahlung, **Storno**, Kassenbewegung, Konfigurationsänderung,
  X-Bon sowie erfolgreiche **und fehlgeschlagene** Anmeldungen und die Änderung
  des Administrator-PINs.

## Zusätzlich gefunden und behoben

| Fund | Wirkung |
|---|---|
| `instrumentation.ts` lief **nie** (Next.js 14 braucht `experimental.instrumentationHook`) | Kein JWT-Geheimnis, keine Diagnose, kein Aufräumen, kein Backup |
| Automatisches Backup war nie angebunden | `startAutoBackupScheduler()` existierte, wurde aber nirgends aufgerufen |
| Doppelte Bestellnummern | `/api/orders` las die Nummer **vor**, `/api/orders/checkout` und `/api/guest/orders` **nach** dem Hochzählen – im Mischbetrieb entstand dieselbe Nummer zweimal. Jetzt überall dieselbe Regel. |
| Druckauftrag-Wiederaufnahme konnte doppelt drucken | Wiederaufnahme ist jetzt gegen Mehrfachaufruf abgesichert |
| Schichtabrechnung war von keiner Oberfläche erreichbar | Menüeintrag für die Bedienung ergänzt |
| Kaputter Aufruf `getPendingCount()` in der Navigationsleiste | Entfernt; der Zähler kommt aus dem Abonnement |
| Falsch kodierte Umlaute in 8 Dateien (`Ã¼`, `â€“`) | In allen Meldungstexten korrigiert |

## Bewusst **nicht** geändert

- **`Order.orderNumber` bekommt kein `@unique`.** Der Z-Bon setzt
  `orderSequence` auf 1 zurück – die Bestellnummer ist nur innerhalb eines
  Kassenabschlusses eindeutig. Eine eindeutige Spalte hätte den Z-Bon zerstört.
  Stattdessen ein einfacher Index für die Suche.
- **Aufräumen abgelaufener Idempotenz-Schlüssel** existierte bereits
  (`src/lib/cleanup.ts`, 24 Stunden) – der Punkt war schon erledigt.

## Prüfstand

| Prüfung | Ergebnis |
|---|---|
| `npx tsc --noEmit` | **0 Fehler** |
| `npx next build` | **erfolgreich**, 56 Routen übersetzt |
| `node --check` (server.js, seed.js, sw.js) | fehlerfrei |
| `npx vitest run` | 98 bestanden, 19 übersprungen, **11 fehlgeschlagen** |

Die 11 fehlgeschlagenen Tests scheitern **ausnahmslos** an einem
`PrismaClientInitializationError`: in meiner Prüfumgebung ist der native
Prisma-Abfragemotor nicht installierbar (Download gesperrt). Keiner der
Fehlschläge ist eine inhaltliche Zusicherung. Auf Ihrem Rechner mit vollständig
installierten Abhängigkeiten sollten sie durchlaufen – bitte einmal
`npx vitest run` lokal ausführen und gegenprüfen.

## Was Sie nach dem Einspielen tun sollten

1. `npx prisma generate` und `npx prisma db push` – wegen des neuen Index auf
   `orderNumber`.
2. Server neu starten. Beim ersten Start wird ein `SESSION_SECRET` erzeugt und
   in die `.env` geschrieben; **ab dem zweiten Start** prüft auch die Middleware
   die Signatur. Nach dem Schreiben also einmal zusätzlich neu starten.
3. Vorhandene Anmeldungen an allen Stationen einmal erneuern – alte Tokens
   wurden mit dem alten Standardgeheimnis signiert.
4. `npx vitest run` lokal ausführen.
