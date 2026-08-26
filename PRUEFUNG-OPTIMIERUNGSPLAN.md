# Prüfung des Optimierungsplans `260825_Optimierungen.md`

Stand: 25.08.2026 · Basis: v0.3.8 aus dem Projektordner · **Keine Änderungen vorgenommen**

Jeder Punkt des Plans wurde gegen den echten Code verifiziert. Der Plan enthält an vielen Stellen
„Verdacht, zu prüfen" – ein Teil dieser Verdachtsdiagnosen ist **falsch**. Wer danach umsetzt,
repariert Dinge, die nicht kaputt sind, und übersieht die tatsächliche Ursache.

---

## 0. Der eine Fund, der alles überlagert

**`global.io` wird im gesamten Projekt niemals zugewiesen.**

`server.js:36` legt `const io = new Server(server, …)` rein lokal im `app.prepare().then()`-Closure an.
Zugewiesen werden nur `global.virtualPrinterHistory` (Z. 22) und `global.connectedDevices` (Z. 23).
Ein `global.io = io` existiert nirgends.

**Folge: Alle 96 serverseitigen `global.io.emit(...)`-Aufrufe in `src/` sind wirkungslos.**
Sie stehen sämtlich hinter `if (global.io)` und scheitern damit **stillschweigend** – kein Fehler,
kein Log, kein Hinweis.

Was dadurch tot ist:

| Betroffen | Ort |
|---|---|
| Küchenmonitor bekommt keine neuen Bestellungen | `api/orders/route.ts:297` (`order:new`) |
| Zahlungsbestätigung erreicht keine Station | `api/orders/checkout/route.ts:375` |
| KDS-Statuswechsel | `api/orders/[id]/status/route.ts:30,42,64` |
| Storno-Alarm in der Küche | `api/orders/[id]/void/route.ts:217` |
| Tischstatus-Updates | `api/tables/route.ts:105,152,180,198,215` |
| Virtueller Drucker-Monitor | `lib/printer/network-spooler.ts:153` |
| Chat + Eildurchsage | `api/chat/route.ts:29,32` |
| Audit-Live-Stream | `lib/action-logger.ts:35` |
| Config-Broadcast, Diagnose, Zapfhähne | `api/config/route.ts:185`, `lib/diagnostics.ts:372`, `lib/tap-manager.ts:32` |

**Das erklärt A4 und A10 vollständig und den toten Live-Stream in A9.** Es ist ein Einzeiler
(`global.io = io;` nach `server.js:43`), der ein gutes Dutzend scheinbar unabhängiger
„Echtzeit funktioniert nicht"-Meldungen auf einmal behebt.

Nur die reinen Client→Server→Client-Relays in `server.js` funktionieren (Z. 159–185) – das Chat-UI
nutzt diesen Weg aber nicht, es postet per HTTP.

> **Empfehlung:** Diesen Fix vor allem anderen. Danach A4, A9 und A10 erneut testen, bevor
> irgendetwas daran umgebaut wird – ein Großteil der geplanten Arbeit erledigt sich damit.

---

## 1. Teil A – Bugfixes: Verdikt je Punkt

| # | Verdikt | Kurzfassung |
|---|---|---|
| **A1** | ❌ **widerlegt** | Beide Diagnosen sind bereits behoben |
| **A2** | ⚠️ **teilweise** | Symptom stimmt, Ursache komplett falsch benannt |
| **A3** | ✅ **bestätigt** | Ein Zeichen Fix |
| **A4** | ⚠️ **teilweise** | Symptom stimmt, Ursache ist `global.io` + 401 |
| **A5** | ✅ **bestätigt** | Vollständig zutreffend |
| **A6** | ⚠️ **teilweise** | Symptom stimmt, Ursache ist ein nicht gerendertes Modal |
| **A7** | ⚠️ **teilweise** | API existiert längst – dem UI fehlt die Funktion |
| **A8** | ⚠️ **teilweise** | Vier Ursachen, 401 ist die unwichtigste |
| **A9** | ⚠️ **teilweise** | Kernvorwurf stimmt, Filter/Retention existieren schon |
| **A10** | ⚠️ **teilweise** | Alle drei Verdachtsmomente widerlegt, echte Ursache ist `global.io` |
| **A11** | ⚠️ **teilweise** | „Nicht erreichbar" ist zu stark, „nicht einhandoptimiert" trifft zu |
| **A12** | ❌ **widerlegt** | Diese Bereiche existieren gar nicht |
| **A13** | ✅ **bestätigt** | Und es fehlt noch ein zweites Feld |

### A1 – Kassierfehler ❌ widerlegt, beide Teile

- `lib/utils.ts:21-26` enthält bereits `generateIdempotencyKey()` mit `crypto.randomUUID`-Guard und
  Fallback. `pos/page.tsx:299` und `kiosk/page.tsx:170` nutzen sie. Kein ungeschützter Aufruf.
- `pos/page.tsx:318` zeigt bereits `error(result.error || …)`; der catch-Block `:352-361`
  unterscheidet sogar `crypto`-Fehler und hängt Details an.

**Aber ein echter Restfehler an derselben Stelle:** `lib/offline/outbox.ts:196-199` schluckt
**5xx-Antworten** und meldet `success: true, queuedOffline: true`. Ein echter Serverfehler erscheint
dem Kassierer damit als „offline gespeichert" – die Buchung existiert nie, niemand merkt es.
Das ist die wahrscheinlichere Ursache des gemeldeten Symptoms und sollte in A1 aufgenommen werden.

Punkt 3 des Plans (Kassenlade-Erkennung, `cashDrawerConnected`) bleibt sinnvoll.

### A2 – Split ⚠️ Symptom ja, Ursache nein

Widerlegt: Es gibt **keinen Rundungsfehler** – `lib/pricing.ts:140-193` rechnet durchgängig in Cent
und dividiert nie durch n. Und `paidQuantity` ist korrekt: `api/payments/route.ts:136-150` prüft
`open = quantity - paidQuantity`, wirft bei Überzahlung und inkrementiert in der Transaktion.

**Die echten Ursachen sind zwei andere:**

1. **Der Idempotency-Key wird für alle Zahlungen derselben Seite wiederverwendet.**
   `waiter/payment/page.tsx:84` erzeugt `requestId` einmalig per `useState(() => …)` und setzt ihn
   nie zurück. Beim zweiten Kassiervorgang findet der Server denselben Key
   (`api/payments/route.ts:116-123`) und liefert einen **Replay** mit HTTP 200 zurück.
   Es wird nichts gebucht, kein `paidQuantity` erhöht, keine neue Belegnummer vergeben – aber die
   Oberfläche meldet Erfolg und zeigt den alten Beleg. Genau das ist „Rechnung teilen funktioniert nicht".
   → Fix: `requestId` nach jedem erfolgreichen Abschluss neu erzeugen.

2. **„1/n" ist bei Stückzahl 1 wirkungslos.** `waiter/payment/page.tsx:548-565` rechnet
   `Math.ceil(totalUnpaidQty / n)` je Position. Bei lauter Einzelstücken ergibt „1/2" überall 1 –
   also dasselbe wie „Alles". Eine Teilung nach Geldbeträgen gibt es nirgends.
   → Fix: echte Betragsteilung als eigener Modus (Summe / n, Restcent auf den ersten Anteil).

Der geplante Unit-Test „50 € zu 1/3" prüft eine Funktion, die es gar nicht gibt – die Testmatrix
sollte stattdessen den Replay-Fall und die Betragsteilung abdecken.

### A3 – Gast-Ansicht ✅ bestätigt

Der Button heißt im Code **„Gast-Sicht"** (`waiter/payment/page.tsx:449-464`) und wird
bedingungslos gerendert. Die Public-Config wird zwar geladen (`:128-138`), `enableGuestFacingDisplay`
steuert dort aber nur den Initialzustand des Banners, nicht die Sichtbarkeit des Buttons.
Der Kellner kann das Feature also gegen die Admin-Einstellung einschalten – das Handbuch
(`docs/handbook-data.ts:102`) beschreibt es anders. Fix wie geplant.

### A4 – Virtuelle Drucker ⚠️ Ursache falsch

Widerlegt: Event-Namen stimmen überein (`virtual_printer:new_ticket`, gesendet
`network-spooler.ts:154`, abonniert `virtual-printer/page.tsx:50` und
`admin/virtual-printer/page.tsx:64`), und die Historie **wird** beim Laden per GET geholt
(`:32-47` bzw. `:42-59`).

**Zwei echte Ursachen:**
1. `global.io` (siehe Abschnitt 0) → es kommt nie ein Live-Ticket an.
2. `/api/virtual-printer` steht nicht in `PUBLIC_PATHS` (`middleware.ts:6-23`). Ein nicht
   angemeldeter Monitor bekommt **401**, `data` ist kein Array, `setTickets` wird übersprungen
   (`page.tsx:36-38`) – ohne Meldung. Ergebnis: dauerhaft „Warte auf Druckaufträge…".

Bestätigt: Es gibt zwei konkurrierende UIs. Verlinkt wird nur die Admin-Variante
(`navbar.tsx:225`, `admin/printers/page.tsx:360`), und der übergebene `?printerName=` wird von der
Seite nie ausgelesen (`admin/virtual-printer/page.tsx:39`) – der Filter wird still ignoriert.

### A5 – PIN beim Erstbesuch ✅ vollständig bestätigt

- Matcher deckt nur `/admin/*` und `/api/*` ab (`middleware.ts:97-102`) – `/pos`, `/waiter`,
  `/kitchen` laufen daran vorbei.
- `/api/auth/session` existiert nicht; unter `api/auth/` liegt nur `pin/route.ts` mit ausschließlich POST.
- Keine Stationsseite prüft die Session beim Mount, und **alle schlucken den 401 still**:
  `pos/page.tsx:166-174`, `waiter/page.tsx:154-162`, `kitchen/page.tsx:68-77` prüfen nur
  `Array.isArray(data)` – das 401-Objekt ist kein Array, also bleibt der Katalog leer, ohne Hinweis.
- Das PinModal wird nur beim aktiven Rollenwechsel getriggert (`navbar.tsx:146-167`).

Ergänzung zum Plan: Die leeren Listen sollten künftig **nicht** stillschweigend leer bleiben –
ein „Nicht angemeldet"-Zustand gehört sichtbar in jede Station, sonst wiederholt sich die Fehlerklasse.

### A6 – Druckgruppen ⚠️ Ursache falsch

Widerlegt: Es gibt **kein Zod-Schema** für `POST /api/print-groups` (`route.ts:20-36` übernimmt das
Body ungeprüft, `name` ist nicht einmal Pflicht). Die Route würde alles akzeptieren.

**Echte Ursache: Das Druckgruppen-Modal wird nie gerendert.** In `admin/printers/page.tsx` existieren
State (`:33`), Formular-State (`:50-57`) und `handleSaveGroup` (`:201-223`) – aber im JSX kommt
`showGroupModal` nur als **Setter** vor (`:266`). Gerendert werden nur Scan-Modal (`:440`) und
Drucker-Modal (`:506`). Der Klick auf „Druckgruppe" setzt ein Flag, sonst passiert nichts;
es wird nie ein Request gesendet.

### A7 – Drucker editieren ⚠️ API existiert bereits

Widerlegt: `PUT /api/printers` mit `body.id` (`route.ts:133-154`) und `DELETE /api/printers?id=`
(`:156-173`) existieren. Es fehlt kein Endpunkt.

**Echte Ursache: Das UI hat keine Edit-Funktion.** `Edit2` wird importiert
(`admin/printers/page.tsx:7`), aber nie gerendert; es gibt keinen `handleEditPrinter` und keinen
einzigen PUT-Aufruf. `handleSavePrinter` (`:177-199`) sendet immer POST → legt stets neu an.
Zusätzlich fehlen im Modal die Felder `paperWidth` und `characterSet`, obwohl sie im State stehen (`:41-48`).

### A8 – Kellner-Abrechnung ⚠️ vier Ursachen, 401 ist die unwichtigste

Widerlegt: `GET /api/waiters` filtert **nicht** auf `isActive` (`route.ts:4-21`), und
`POST /api/waiters/settle` funktioniert (`:5-51`).

**Echte Ursachen:**
1. **Kein Seed.** `prisma/seed.js` legt **kein einziges `WaiterProfile`** an. Frische Datenbank → Liste leer.
2. **Der Kellner-Login persistiert nichts.** `waiter/page.tsx:348` schreibt den Namen nur nach
   `localStorage`; es gibt keinen `POST /api/waiters`. Profile entstehen ausschließlich manuell
   über `/admin/tips`.
3. **Die Abrechnung löscht den Kellner.** `api/waiters/settle/route.ts:27-33` macht
   `waiterProfile.deleteMany` – nach der ersten Abrechnung ist die Bedienung samt PIN und
   Trinkgeldprofil dauerhaft weg. Das ist ein echter Datenverlust-Bug und gehört auf 🔴.
4. **UI-Schwelle.** Die Auswahl rendert nur bei `waiterList.length > 1` (`settle/page.tsx:251`).

Nebenbefund: `/api/reports` filtert `isActive: true` (`route.ts:122`), `/api/waiters` nicht –
inkonsistent.

### A9 – Audit-Log ⚠️ Kernvorwurf ja, Rest schon vorhanden

Bestätigt und schlimmer als vermutet: Die Funktion heißt `logSystemAction()`
(`lib/action-logger.ts:13`) und hat genau **zwei** Aufrufstellen –
`api/waiters/settle/route.ts:17` und den generischen Passthrough `api/logs/route.ts:91`,
den **kein Client aufruft**. Die Tabelle enthält faktisch nur `WAITER_SETTLED`-Zeilen.
Bestellung, Storno, Zahlung, Config-Änderung, Login, Kassenbewegung, Z-Bon: **kein einziger Log**.
Der Seitentitel „Lückenlose Dokumentation aller Bestellungen, Kassiervorgänge, Stornos und Schichten"
(`admin/logs/page.tsx:129`) ist damit sachlich falsch.

Widerlegt: **Filter existieren bereits** (`api/logs/route.ts:8-23`, UI-Chips `page.tsx:200-214`,
Suchfeld `:173`, plus CSV/TXT/JSON-Export). **Retention existiert ebenfalls**
(`lib/cleanup.ts:6,44-47`, gestartet über `instrumentation.ts:26`).
Nur echte Pagination fehlt – es gibt bloß einen Limit-Selektor 100/200/500/1000.

→ Der Plan sollte auf Punkt 1 zusammengestrichen werden. Punkt 2 und 3 sind erledigt.

### A10 – Chat ⚠️ alle drei Verdachtsmomente widerlegt

- Verlauf **wird** per GET geladen (`chat/page.tsx:38-48`, `api/chat/route.ts:4-14`).
- Die API **schreibt** in die DB (`route.ts:19-27`).
- Event-Namen passen (`chat:incoming`, Server → Client), Eil-Nachrichten gehen zusätzlich als
  `broadcast:alert` global raus – kein Raum-Mismatch.

**Echte Ursache: `global.io`.** Der Guard `if (global.io)` in `api/chat/route.ts:29` ist immer falsch.
Neue Nachrichten erscheinen erst nach manuellem Reload; der Verlauf ist dann aber vollständig da –
was exakt zum gemeldeten Symptom passt.

Nebenbefund: `chat/page.tsx:80` ruft `socket.off('chat:incoming')` **ohne Handler-Referenz** und
entfernt damit auch fremde Listener.

### A11 – Ziffernblock ⚠️ zu stark formuliert

Ist-Zustand: Auf Mobil (<1024 px) liegt das Keypad **bereits unten am Viewport-Rand**
(`waiter/payment/page.tsx:781,836`), Touch-Targets sind 68 px hoch (`globals.css:194-198`),
der Kassieren-Button `h-20`. Das ist Spec-konform.

Zutreffend bleibt: kein Bottom-Sheet, keine Links-/Rechtshand-Option (null Treffer für
`fixed bottom-0` / `sticky bottom-0` in `src/`), volle Breite über drei Spalten, und der
Sticky-Header mit XXL-Gast-Banner (`:422-446`) frisst auf kleinen Displays viel Höhe.

→ „Einhandzone optimieren" ja, „neu bauen" nein.

### A12 – Grunddesign / Bon-Design ❌ widerlegt

**Diese Bereiche existieren nicht.** `admin/settings/page.tsx` hat genau fünf Tabs (`:118-124`):
Allgemein, Drucker & Layout, Sicherheit & PINs, Fiskal & Steuern, Vorlagen & Snapshots.
Es gibt weder eine Seite noch einen Tab „Grunddesign" oder „Bon-Design".

Alle `href="/admin/..."` im Projekt zeigen auf existierende Seiten, und die Navigation nutzt
durchgängig `next/link` (`navbar.tsx:501-511`) – der Client-Router-Verdacht ist ebenfalls widerlegt.

**Was wirklich dahintersteckt – drei verschiedene Dinge:**
1. „Grunddesign" ist der **Theme-Picker in der Navbar** (`navbar.tsx:346-380`), rein clientseitig,
   navigiert gar nicht.
2. „Bon-Design" ist nur ein **Label**: `navbar.tsx:240` verlinkt „Grundeinstellungen & Bon-Design"
   auf `/admin/settings`. Die Bon-Felder liegen im Tab „Drucker & Layout"
   (`tabs/PrintersTab.tsx:20`). Namensmismatch, kein defekter Link.
3. Der Effekt „landet auf der Startseite" entsteht durch das Auth-Gate: `/admin/*` wird bei
   fehlendem oder nicht verifizierbarem Cookie auf `/` umgeleitet (`middleware.ts:61-69`,
   `admin/layout.tsx:26-28`). Die Menürolle kommt dagegen aus `localStorage` und überlebt das
   Cookie – deshalb bleiben die Admin-Einträge sichtbar, obwohl die Session weg ist.

→ **A12 ist kein Link-Bug, sondern ein Symptom von A5.** Nach A5 verschwindet es. Die geplante
Arbeit („Links umbiegen, Deep-Linking") ist überflüssig; sinnvoll wäre stattdessen, die
Menüsichtbarkeit an die Session statt an `localStorage` zu binden.

### A13 – Warengruppe ✅ bestätigt, plus ein zweites Feld

Im Produkt-Modal (`admin/products/page.tsx:559-950`) gibt es nur zwei `<select>`: MwSt (`:611`) und
Mindestalter (`:643`). **Weder `categoryId` noch `printGroupId`** sind editierbar, obwohl beide im
`formData` stehen (`:58-59`) und beim Öffnen befüllt werden (`:200-201`).

Die API ist nicht schuld: `PUT /api/products/[id]` akzeptiert beides (`route.ts:91-92`), und
`handleSaveProduct` sendet das komplette `formData` (`page.tsx:252-267`). **Ein Dropdown genügt.**

Die fehlende Druckgruppen-Auswahl widerspricht direkt der eigenen Anleitung auf der Druckerseite
(„In der Artikelverwaltung bei jedem Artikel im Feld ‚Druckgruppe' wählen", `admin/printers/page.tsx:307`).
→ Sollte von 🟢 auf 🔴 hochgestuft werden: Ohne dieses Feld landen neue Getränke auf dem Küchendrucker.

---

## 2. Teil B–G: was schon erledigt ist

| # | Verdikt | Befund |
|---|---|---|
| **B2** Warenkorb-Verlust | ✅ bestätigt | Beide Körbe rein in `useState` (`pos/page.tsx:51`, `waiter/order/page.tsx:94`). **60** localStorage-Zugriffe in 17 Dateien, nicht ~15 |
| **B4** StrictMode | ⚠️ teilweise | `reactStrictMode: false` steht in `next.config.mjs:3`, Cleanup ohne `disconnect()` in `socket-provider.tsx:105-113`. **Aber:** `getSocket()` ist ein Modul-Singleton (`socket-client.ts:5-9`) – StrictMode erzeugt gar keine Doppel*verbindungen*. Das echte Leck sind doppelte **Listener** (`socket-client.ts:17,56` ohne `off`) |
| **C1** Drei PIN-Quellen | ✅ bestätigt | `auth-pin.ts:52` prüft kaskadierend Staff-Hash (`:61-71`), EventConfig-Klartext (`:74-89`), WaiterProfile-Klartext (`:92-101`). `lib/rbac.ts` existiert und wird **nur vom Test** importiert – null Produktionsaufrufe |
| **C2** Revocation | ✅ bestätigt | Kein `tokenVersion` im gesamten Repo. Token 12 h gültig (`auth-session.ts:43`), PIN-Wechsel invalidiert nichts |
| **C3** CSRF | ✅ bestätigt | Kein Token, keine Origin-Prüfung. Nur `sameSite: 'lax'`; `secure` ist im LAN aus → Cookie geht im Klartext übers WLAN |
| **D1** Float-Beträge | ✅ bestätigt | **Alle** Money-Felder sind `Float`, kein einziges `Int`/`Decimal`. Besonders kritisch: `cashExpected`, `cashCounted`, `cashDifference` (`schema.prisma:446-448`) |
| **E2** SQLite-Pragmas | ❌ **erledigt** | `lib/db.ts:20-27` setzt WAL, `busy_timeout=5000` und `synchronous=FULL` bereits. Nachzubessern nur: Fire-and-Forget mit `.catch(()=>{})` (Z. 25) verschluckt Fehler, kein `await` vor der ersten Query, und `busy_timeout` ist verbindungslokal – im Prisma-Pool nicht garantiert |
| **F3** SW-Precache | ⚠️ teilweise | `sw.js:3-9` precacht `/`, `/waiter`, `/waiter/order`, `/manifest.json`, `/icon.png`. `/pos`, `/kitchen`, `/chat` fehlen – bestätigt. **Aber ein echter Bug obendrauf:** `sw.js:103` `return caches.match('/waiter') \|\| caches.match('/')` – `caches.match()` liefert ein Promise, das immer truthy ist. Der `\|\|`-Fallback ist toter Code; ist `/waiter` nicht im Cache, resolved es zu `undefined` → **weiße Seite** |
| **G1** E2E-Tests | ⚠️ teilweise | Kein Playwright/Cypress. **Aber CI existiert** (`.github/workflows/ci.yml` mit Typecheck, `prisma db push`, Tests, Build) – der Plan geht offenbar von einem älteren Stand aus. `e2e_full_lifecycle.test.ts` ist trotz Namen kein Browsertest (`vitest.config.ts:5` → `environment: 'node'`) |

---

## 3. Was im Plan fehlt

### 3.1 🔴 Keine einzige API-Route prüft die JWT-Signatur

Das ist der gravierendste Fund dieser Prüfung.

`middleware.ts:49` nutzt bewusst `decodeSessionToken` statt `verifySessionToken` – der Kommentar
`:43-46` erklärt es damit, dass die Edge-Sandbox das DB-Secret nicht kennt.
`decodeSessionToken` (`auth-session.ts:82-92`) prüft **nur Struktur und Ablaufzeit, nicht die Signatur**.

Der Kommentar verspricht, die Signaturprüfung erfolge „Node-seitig im Admin-Layout-Gate und in den
API-Routen". Das Admin-Layout tut das tatsächlich (`admin/layout.tsx:23`).
**Die API-Routen nicht: 0 von 59 rufen `getVerifiedSessionFromRequest`, `verifySessionToken` oder
`requireAuth` auf.**

Konkret: Ein selbst gebautes, **unsigniertes** JWT mit `{"role":"ADMIN","exp":<Zukunft>}` passiert die
Middleware und öffnet damit alle 59 Routen – inklusive `/api/config` (alle PINs im Klartext),
`/api/backup`, `/api/fiscal`, `/api/payments` und `/api/system/update`.

Die Middleware erzeugt damit den *Anschein* von Schutz, ohne ihn zu leisten. Das gehört als
eigener 🔴-Punkt in Phase 1 – vor allen anderen Sicherheitsthemen (C1/C2/C3).

**Lösungsvorschlag:** Das Secret nicht aus der DB, sondern aus einer Env-Variablen beziehen, die
`instrumentation.ts` beim ersten Start erzeugt und in `.env` schreibt. Dann kann auch die Edge-Middleware
`verifySessionToken` nutzen. Alternativ: in jeder API-Route einen `withAuth()`-Wrapper, der
tatsächlich verifiziert – dann ist `rbac.ts` endlich angeschlossen (siehe C1).

> Positiv anzumerken: `lib/session-secret.ts` löst das frühere Problem des hartkodierten
> Default-Secrets sauber (256 Bit, persistiert in der DB). Der Preis war nur, dass die
> Signaturprüfung in der Middleware dafür geopfert wurde.

### 3.2 🔴 `api/waiters/settle` löscht den Kellner

`api/waiters/settle/route.ts:27-33` – `waiterProfile.deleteMany` nach der Abrechnung.
Steht nicht im Plan, ist aber Datenverlust im Regelbetrieb (siehe A8).

### 3.3 🔴 Outbox meldet Serverfehler als „offline gespeichert"

`lib/offline/outbox.ts:196-199`, siehe A1. Die Buchung existiert nie, niemand merkt es.

### 3.4 🟠 Service-Worker-Fallback erzeugt weiße Seiten

`sw.js:103`, siehe F3. Einzeiler, aber genau das Symptom, das F3 verhindern soll.

### 3.5 🟠 Zwei Outbox-Schlüssel, keine Versuchsbegrenzung

`outbox.ts:47` und `:50` erzeugen **zwei verschiedene** Zufallsschlüssel – einer geht als
`X-Idempotency-Key`-Header, einer in den Body. Beim Wiederholungsversuch passen sie nicht zusammen.
`:148-155` zählt `attempts` nur im Speicher hoch, ohne Rückschreiben: kein Limit, kein Backoff,
ein dauerhaft mit 400 abgelehnter Eintrag wird bei jedem `online`-Ereignis endlos erneut gesendet.

### 3.6 🟠 Kein Seed für Personal

`prisma/seed.js` legt keinen einzigen Kellner an – Ursache Nr. 1 von A8. Ein Seed mit zwei
Beispiel-Kellnern und einem Trinkgeldprofil würde den Punkt entschärfen.

---

## 4. Empfohlene Korrektur des Plans

**Streichen (Diagnose falsch oder bereits erledigt):**
A1 Punkte 1+2 · A12 komplett · A9 Punkte 2+3 · E2

**Umformulieren (Symptom stimmt, Ursache anders):**
A2 → Idempotency-Key-Wiederverwendung + echte Betragsteilung ·
A4 → `global.io` + `PUBLIC_PATHS` · A6 → Modal rendern · A7 → Edit-UI bauen ·
A8 → Seed + Persistenz + `deleteMany` entfernen · A10 → `global.io`

**Hochstufen:** A13 von 🟢 auf 🔴 (Druckgruppen-Feld fehlt ebenfalls)

**Neu aufnehmen:** Signaturprüfung in den API-Routen (3.1) · `settle`-Löschbug (3.2) ·
Outbox-5xx (3.3) · SW-Fallback (3.4) · Outbox-Schlüssel (3.5) · Personal-Seed (3.6)

### Vorgeschlagene neue Phase 1

```
0.  global.io = io                          (1 Zeile, behebt A4, A10, A9-Livestream + 9 weitere)
1.  Signaturprüfung in API-Routen           (🔴 Sicherheit, siehe 3.1)
2.  A5 Session-Check je Station             (behebt zugleich A12 und A8-Teil)
3.  A2 requestId zurücksetzen               (behebt „Split geht nicht")
4.  A8 settle-deleteMany entfernen + Seed   (Datenverlust)
5.  A6 Modal rendern / A7 Edit-UI           (2× überschaubar)
6.  A13 zwei Dropdowns ergänzen
7.  Outbox: 5xx nicht schlucken, Key vereinheitlichen
```

Punkt 0 bis 3 sind zusammen weniger als ein Tag Arbeit und beheben den Großteil der gemeldeten
Symptome. Der ursprüngliche Plan veranschlagt für dieselben Symptome etwa vier Tage – weil er an
den falschen Stellen ansetzt.

---

## 5. Einordnung

Der Plan ist gut strukturiert und die Priorisierung ist plausibel. Das Problem ist die
Diagnosetiefe: Von 13 Bugfix-Punkten sind zwei ganz und sechs teilweise falsch begründet.
Ursache ist erkennbar, dass die Verdachtsmomente aus dem Symptom abgeleitet wurden, statt aus dem Code.

Auffällig ist außerdem, dass mehrere „fehlt komplett"-Annahmen an bereits umgesetzter Funktionalität
vorbeigehen (Filter und Retention im Audit-Log, SQLite-Pragmas, Drucker-Update-API, CI-Pipeline).
Ein kurzer Grep vor dem Schreiben eines Punktes hätte das gezeigt – und hätte an mehreren Stellen
Aufwand von Tagen auf Stunden reduziert.

Der wertvollste Einzelschritt bleibt `global.io = io`. Es lohnt sich, danach die Liste noch einmal
durchzugehen, bevor irgendetwas umgebaut wird.
