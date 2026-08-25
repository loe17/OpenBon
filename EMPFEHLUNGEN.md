# OpenBon – Empfehlungen zur Professionalisierung

Stand: 2026-08-25 · Reine Analyse, **keine Codeänderungen vorgenommen**
Vorgänger: `SPEC_ABGLEICH.md` (Ausgangslage), `UMSETZUNG.md` (was umgesetzt wurde)

---

## 0. Gesamturteil in drei Sätzen

Funktional deckt OpenBon inzwischen die Spezifikation ab und ist an vielen Stellen durchdachter als
kommerzielle Vereinsfest-Kassen. **Technisch ist es aber ein Prototyp mit Produktionsanstrich:**
es gibt keine serverseitige Authentifizierung, die Hochverfügbarkeit funktioniert nicht,
der Druckerspooler verliert bei jedem Neustart alle Aufträge und die App ist trotz PWA-Manifest
nicht offline-fähig.

Die gute Nachricht: Fast alles davon sind **klar abgrenzbare, nachrüstbare Bausteine** – keine
Neuentwicklung. Die Reihenfolge unten ist so gewählt, dass nach Phase 1 ein echter Festbetrieb
verantwortbar ist.

---

## 1. Blocker – vor dem ersten Echtbetrieb zu lösen

### 1.1 Es gibt keine Authentifizierung. Nur eine PIN-Abfrage als Dekoration.

Das ist der mit Abstand wichtigste Punkt des ganzen Dokuments.

- `src/app/api/auth/pin/route.ts:12` gibt bei korrekter PIN nur `{ success: true }` zurück –
  **kein Cookie, kein Token, keine Session.** Der „Login" hinterlässt keinerlei serverseitigen Zustand.
- Es existiert **keine `middleware.ts`**. Die Rollenprüfung findet ausschließlich im Browser statt:
  `navbar.tsx:80,113,120,127` lesen `sessionStorage.getItem('admin_pin_verified')`.
  Ein `sessionStorage.setItem('admin_pin_verified','true')` in der Browserkonsole genügt für Admin-Zugang.
- Und selbst das ist unnötig, weil **alle 34 API-Routen direkt und ungeschützt ansprechbar** sind.
  `verifyStationPin` wird außerhalb von `/api/auth/pin` nirgends aufgerufen. Die einzigen Ausnahmen
  sind die von mir ergänzten Routen (Storno, Z-Bon, Kassenbuch), die die PIN im Body mitprüfen –
  ein Workaround, kein Auth-Modell.

**Konkrete Folgen im Fest-WLAN, ohne jede Vorbedingung:**

| Angriff | Ort |
|---|---|
| **Beliebige Shell-Befehle auf der Kasse ausführen** | `api/system/update/route.ts:85` – `execAsync(customCommand)` mit ungeprüftem Body |
| Alle PINs im Klartext auslesen | `api/config/route.ts` GET gibt das komplette `EventConfig` zurück, inkl. `adminPin` und `zvtPassword`. Die Navbar ruft das bei **jedem** Seitenwechsel auf **jedem** Kellnerhandy auf |
| Alle PINs ändern, ohne die alte zu kennen | `api/config/route.ts` POST hat die PIN-Felder in der Whitelist |
| Kompletten Umsatzdatenbestand herunterladen | `api/backup/route.ts` GET |
| Datenbank überschreiben, Wortgruppen löschen | `api/backup/route.ts` POST |
| Alle Preise ändern, Tische löschen, Bestände hochbuchen | `api/products`, `api/tables`, `api/inventory` |
| Jedes Kellnergerät aus dem Betrieb werfen | `server.js:95` `device:force_logout`, Socket.io ohne Auth |
| Gefälschte Bestellungen auf allen Küchenmonitoren | `server.js:100` `order:created` |

**Empfehlung:**

1. **Signiertes Session-Cookie statt Statusflag.** `/api/auth/pin` setzt bei Erfolg ein
   HttpOnly-Cookie mit HMAC-signiertem Payload `{role, deviceId, exp}` (z. B. via `jose`).
2. **`src/middleware.ts` als zentrale Schranke.** Matcher auf `/api/:path*` und `/admin/:path*`,
   Rollenanforderung pro Pfadpräfix in einer Tabelle. Genau eine Stelle, die entscheidet – nicht 34.
3. **PINs hashen** (`argon2id` oder `scrypt`), Vergleich mit `crypto.timingSafeEqual`.
   Der Fail-Open-Pfad in `lib/auth-pin.ts:22-27` (bei DB-Fehler wird `1234` akzeptiert) muss weg.
4. **Rate-Limit** auf `/api/auth/pin`: 5 Versuche pro Gerät und Minute, danach exponentielle Sperre.
   10 000 vierstellige PINs sind sonst in Sekunden durchprobiert.
5. **`/api/config` aufteilen:** ein öffentliches `/api/config/public` (Eventname, Währung,
   Trainingsmodus, Tablett-Limit) für die Clients, und die Geheimnisse nur unter Admin-Rolle.
6. **`api/system/update` EXEC entfernen oder auf eine Allowlist reduzieren.** Ein beliebiger
   Shell-Befehl über HTTP hat in einer Kasse nichts verloren – auch nicht mit Auth. Erlaubt bleiben
   sollten genau: `git pull`, `npm ci`, `npm run build`, `systemctl restart openbon`.
7. **Socket.io absichern:** `io.use()`-Handshake gegen dasselbe Session-Cookie, Rollenprüfung je Event,
   `cors.origin` auf das eigene Netz einschränken. Adressierte Events (`device:kicked`,
   `device:play_sound`) gezielt an die Socket-ID senden statt an alle zu broadcasten.
8. **`/api/sync/pull`** braucht ein gemeinsames Geheimnis zwischen PRIMARY und STANDBY –
   aktuell kann jedes Gerät das komplette Transaktionsjournal abziehen.

Aufwand realistisch: 2–3 Tage. Ohne das ist alles andere in diesem Dokument zweitrangig.

### 1.2 Die Hochverfügbarkeit funktioniert nicht

Der Standby-Pi ist aktuell reine Kosmetik:

- **Der Watcher startet nie.** `ha-service.ts:221` erzeugt das Singleton beim Modul-Import. Das Modul
  wird nur von API-Routen importiert, die Next.js lazy lädt. Ein STANDBY, der keinen HTTP-Verkehr
  bekommt – der Normalfall –, initialisiert den Heartbeat nie. `server.js` importiert `ha-service` nicht.
- **Es werden keine Positionen repliziert.** `ha-service.ts:174-213` legt `order` und `payment`
  ohne `items` an. Nach einem Failover hätten Sie Bons und Belege ohne eine einzige Zeile.
- **Fehler werden stumm verschluckt** (`ha-service.ts:215`), während der Sequenzzeiger vorrückt –
  betroffene Datensätze sind endgültig verloren.
- **Split-Brain ist eingebaut:** 6 Sekunden Netzaussetzer genügen für eine Promotion
  (`ha-service.ts:100,107`), es gibt kein Fencing, keine Rückrichtung, keinen Rejoin.
- **Belegnummern kollidieren nach Failover**, weil `invoiceSequence` nicht repliziert wird und
  `Payment.invoiceNumber` `@unique` ist.
- **Die Selbstdiagnose löscht ungepullte Journaleinträge**, sobald 5000 Einträge überschritten sind
  (`diagnostics.ts:253`) – an einem Festtag realistisch erreichbar.
- Die HA-Anzeige in der Navbar ist zudem schlicht kaputt: `navbar.tsx:64` liest `hb.partnerConnected`,
  ein Feld, das `api/sync/heartbeat` gar nicht liefert – und fragt den eigenen Server, nie den Partner.

**Empfehlung – ehrliche Alternative:** Ein korrektes Active/Passive-Failover mit Fencing und
Konfliktauflösung ist ein Projekt für sich. Für ein Vereinsfest ist der Nutzen zweifelhaft,
das Risiko einer Fehlfunktion aber real.

Ich würde HA in der jetzigen Form **entfernen oder als „experimentell" deutlich kennzeichnen**
und stattdessen in das investieren, was denselben Zweck robuster erfüllt:

- **Kontinuierliches Backup** auf USB-Stick und zweiten Rechner (SQLite `VACUUM INTO`, alle 5 Minuten)
- **Offline-fähige Clients** (Abschnitt 1.3) – dann übersteht das Fest auch einen Serverausfall von
  15 Minuten, weil die Kellner weiterbestellen können
- **Ein dokumentierter Wiederanlauf**: zweiter Pi mit identischem Image, Datenbank einspielen, fertig.
  Ein manueller Failover in 3 Minuten ist einem automatischen, der Daten verliert, klar vorzuziehen.

Wenn HA bleiben soll: Journal erst nach Bestätigung des Partners kürzen, Positionen mitreplizieren,
Sequenzen replizieren, `lastAppliedRemoteSeq` getrennt vom lokalen Journal führen, Promotion nur
mit manueller Bestätigung oder Quorum über einen dritten Knoten.

### 1.3 Die App ist keine offline-fähige PWA

- **Kein Service Worker** im gesamten Repo, keine PWA-Abhängigkeit in `package.json`.
- `public/manifest.json:12` verweist auf `/icon.png`, das nicht existiert –
  „Zum Startbildschirm hinzufügen" scheitert unter Android.
- Der Warenkorb liegt ausschließlich im React-State (`waiter/order/page.tsx:59`). iOS und Android
  entladen Hintergrund-Tabs bei Speicherdruck – der Warenkorb ist dann weg.
- Bei WLAN-Aussetzer während des Absendens gibt es nur eine Fehlermeldung, keine Wiederholung.
- **`/api/orders` hat keine Idempotenz.** Wer bei wackligem WLAN erneut auf „Bestellen" tippt,
  erzeugt eine Doppelbestellung. (`/api/payments` hat mit `requestId` einen Ansatz, der aber
  außerhalb der Transaktion liegt und per Substring-Match arbeitet – zwei parallele Retries
  passieren ihn beide.)

Für ein Open-Air-Fest ist das der praktisch relevanteste Mangel nach der Sicherheit.

**Empfehlung:**

1. `next-pwa` oder ein handgeschriebener Service Worker mit App-Shell-Caching.
2. **Warenkorb und Kellnername in IndexedDB** statt nur im State.
3. **Outbox-Muster:** Bestellungen und Zahlungen landen zuerst in einer lokalen Queue mit
   client-generierter UUID, werden dann gesendet und erst nach Serverbestätigung als erledigt markiert.
   Bei Netzausfall wird automatisch nachgesendet.
4. **Serverseitige Idempotenz** über eine eigene Tabelle `IdempotencyKey(key, route, responseJson)` –
   nicht über einen Substring in der Belegnummer.
5. Offline-Indikator in der Kopfzeile mit Anzahl wartender Vorgänge.

### 1.4 Der Druckerspooler verliert Aufträge

- Reine In-Memory-Queue (`network-spooler.ts:20`). `systemctl restart` löscht alle offenen Bons –
  ohne Meldung. Der Installer setzt `Restart=always`, ein Absturz ist also unbemerkt möglich.
- `printTicket` meldet Erfolg, **sobald der Job in die Queue gepusht wurde** (`network-spooler.ts:40-46`),
  nicht wenn der Drucker ihn hat. `api/orders/route.ts:242` setzt daraufhin `printStatus: 'PRINTED'`.
  **Folge: Der Drucker-Wächter der Selbstdiagnose sucht nach `PENDING` und findet konstruktionsbedingt nie
  etwas.** Die von mir eingebaute Selbstheilung läuft an dieser Stelle ins Leere – das gehört korrigiert.
- `restartSpooler()` verwirft Jobs mit 3 Fehlversuchen (`network-spooler.ts:187`) statt sie in eine
  Fehlerqueue zu legen.
- Der Retry hängt Jobs ans Ende der Queue – **die Reihenfolge der Küchenbons geht verloren.**

**Empfehlung:** Queue in die Datenbank (`PrintJob`-Tabelle mit Status, Versuchen, Payload).
`printStatus` erst nach bestätigtem Socket-Write setzen. Fehlgeschlagene Jobs in einen sichtbaren
„Druckerausfall"-Bereich im Admin mit Knopf „erneut senden". Reihenfolge über eine Sequenznummer
je Druckgruppe erhalten. Zusätzlich: Fallback auf einen Ersatzdrucker derselben Gruppe.

### 1.5 Funktionaler Fehler: Die Bonkasse vergibt keine Abholmarken

`src/app/pos/page.tsx:124` sendet `orderType: 'DIRECT_SALE'` bzw. `'VOUCHER'`.
`src/app/api/orders/route.ts:59` prüft aber auf `'COUNTER_DIRECT'` bzw. `'COUNTER_VOUCHER'`
(so auch im Schema, `prisma/schema.prisma:148`).

**Die Bedingung greift nie.** Es wird nie eine `tokenNumber` vergeben, die Anzeige
`#{lastToken}` (`pos/page.tsx:346`) erscheint nie, und auf dem Thekenbon steht keine Abholnummer.
Der gesamte Wertmarken-/Abholmarken-Workflow der Theke ist damit unbrauchbar.

Zusätzlich: Der POS-Checkout setzt zwei getrennte Requests ab (erst Order, dann Payment,
`pos/page.tsx:119` und `:142`) ohne Transaktionsklammer und ohne Prüfung, ob der erste erfolgreich war.
Schlägt der zweite fehl, bleibt eine unbezahlte Thekenbestellung stehen.

### 1.6 Doppelte Bestandsführung – der Bestand wird zweimal abgezogen

`api/orders/route.ts:136-148` zieht von `StockItem.currentQuantity` ab,
`api/orders/route.ts:191-208` zusätzlich von `Product.stockQuantity`.
Beide laufen, wenn `trackStock=true` **und** ein `StockItem` existiert.
Beim Storno wird entsprechend doppelt gutgeschrieben (`orders/[id]/void/route.ts:103` und `:112`).

Verschärfend: Der Seed legt `StockItem` an, setzt aber `trackStock=false`
(`prisma/seed.js:334`), während `api/inventory/route.ts:8` nur auf `trackStock: true` filtert.
Das Lager-UI zeigt diese Artikel also gar nicht an, während im Hintergrund still gezählt wird.

Und `status='INACTIVE'` sperrt faktisch nichts: die Verkaufsoberflächen prüfen nur `isSoldOut`
(`pos/page.tsx:50,302`), die API-Filter nur `HIDDEN`.

**Empfehlung:** `StockItem` als einzige Quelle behalten, `Product.stockQuantity`,
`Product.stockAlertThreshold` und `Product.isSoldOut` entfernen. Verfügbarkeit über **genau ein**
berechnetes Feld ausliefern (`isAvailable`), abgeleitet aus `status`, Bestand und Variantensperre.
Alle Bestandsänderungen in dieselbe `$transaction` wie `order.create`.

### 1.7 Weitere Transaktionslücken im Bestellpfad

`api/orders/route.ts:59-73` erhöht die Sequenzzähler außerhalb der Transaktion, in der die
Bestellung angelegt wird (`:154`). **Zwei gleichzeitig bestellende Kellner bekommen dieselbe
`orderNumber`.** Ein Fehler nach dem Bestandsabzug hinterlässt einen reduzierten Bestand ohne
zugehörige Bestellung.

`api/products/[id]/route.ts:20-25` löscht Varianten und Optionen **vor** dem Update, ohne Transaktion.
Schlägt das Update fehl, sind alle Varianten unwiederbringlich weg.

---

## 2. Architektur – was das Projekt professionell macht

### 2.1 Eine Service-Schicht zwischen API und Prisma einziehen

Aktuell steht die gesamte Geschäftslogik in den Route-Handlern. `api/payments/route.ts` ist
250 Zeilen aus Validierung, Berechnung, Persistenz, Tischstatus, Druck, HA-Log und Socket-Broadcast.
Das ist der Grund, warum der Geldpfad **nicht getestet werden kann** – die einzige Testmöglichkeit
wäre ein HTTP-Aufruf gegen eine echte Datenbank.

Vorschlag:

```
src/server/
  services/     order-service.ts, payment-service.ts, register-service.ts, print-service.ts
  repositories/ Prisma-Zugriff, austauschbar für Tests
  events/       ein zentraler Emitter statt global.io an 20 Stellen
src/app/api/    nur noch: Auth prüfen → Body validieren → Service rufen → Antwort mappen
```

Nutzen: Der Kassiervorgang wird mit einer In-Memory-Repository-Implementierung testbar,
ohne Prisma und ohne Server. Genau das, was der Spec-Anspruch „100 % Testabdeckung" verlangt.

### 2.2 Eingabevalidierung mit Zod an jeder Schreibroute

Es gibt derzeit praktisch keine Validierung. Beispiele:

- `api/products/route.ts:43` `parseFloat(body.price || 0)` – bei `"abc"` landet `NaN` in der Datenbank
- `api/inventory/route.ts:42` – negative Mengen erlaubt, `NaN` persistierbar
- `api/tables/route.ts:77` – `rows`/`cols` serverseitig unbegrenzt (`max="20"` steht nur im HTML)
- `api/tables/route.ts:117` – `PRINT_MARKERS` mit `endNumber: 100000` sendet 100 000 Bons an den Drucker
- `api/printers/route.ts:95` – IP ohne Formatprüfung, geht direkt an den Netzwerk-Spooler
- `api/word-groups/route.ts:26` – `JSON.stringify(body.words)` ohne Array-Prüfung; ein String bricht
  später das Bestell-UI
- `api/printers/route.ts` – unbekannte `action` fällt stillschweigend in den Zweig „Drucker anlegen"
  und erzeugt einen Geisterdrucker mit `name: undefined`

Ein Zod-Schema je Route, ein gemeinsamer `withValidation()`-Wrapper. Nebeneffekt: Die Schemata sind
gleichzeitig die API-Dokumentation und lassen sich für die Client-Typen wiederverwenden.

Ebenso wichtig: **Rohe Fehlermeldungen nicht an den Client geben.** Alle Routen geben im `catch`
`error.message` zurück – Prisma-Interna und Feldnamen landen im Browser. Stattdessen eine
Fehler-ID loggen und dem Client eine verständliche Meldung zeigen.

### 2.3 Migrationen statt `db push`

`package.json:19` und `install-headless.sh:72` nutzen `prisma db push` – auch beim Update über
`/admin/system-update`, also **gegen die produktive Kasse mit Echtumsätzen**. `db push` führt keine
Historie, ist nicht reviewbar, nicht rückrollbar und kann bei Spaltenänderungen Daten verwerfen.

Umstellen auf `prisma migrate dev` in der Entwicklung und `prisma migrate deploy` im Betrieb,
`prisma/migrations/` ins Repository. Vor jeder Migration automatisch ein Backup ziehen.

### 2.4 Indizes – aktuell gibt es keinen einzigen

`prisma/schema.prisma` enthält **kein `@@index`**. Prisma legt auf SQLite für Relationen keine
Indizes automatisch an; jeder `include` ist ein Full Table Scan. Bei 5000 Bestellungen an einem
Festtag ist das der Unterschied zwischen flüssig und unbenutzbar.

Mindestens nötig:

```prisma
@@index([status, createdAt])          // Order
@@index([tableId])                    // Order
@@index([orderId])                    // OrderItem
@@index([printStatus, isCancelled])   // OrderItem
@@index([periodId, createdAt])        // Payment
@@index([isTraining, isCancelled])    // Payment
@@index([createdAt])                  // SyncJournal
```

### 2.5 Logging, Health, Metriken

- **Logging** ist durchgehend `console.log`, an mehreren Stellen wird komplett stumm geschluckt
  (`ha-service.ts:150,215`, `server.js:160,205,213`). Nach der `journalctl`-Rotation ist die
  Fehlerursache weg. → `pino` mit JSON-Ausgabe, Log-Level, Korrelations-ID je Request, Rotation in eine Datei.
- **Health:** `api/sync/heartbeat/route.ts:4-10` gibt **statisch** `HEALTHY` zurück, ohne die
  Datenbank, den Spooler oder den Plattenplatz zu prüfen. Eine Kasse mit korrupter SQLite meldet
  fröhlich „gesund". → Echter `/api/health` mit DB-Ping, Queue-Länge, freiem Speicher, Druckerstatus.
- **Metriken:** `getQueueLength()` existiert, wird aber nirgends ausgegeben. Ein schlankes
  `/api/metrics` mit Queue-Länge, Druckfehlerrate, offenen Tischen und Speicherplatz genügt für
  eine Statusampel im Admin-Dashboard.

### 2.6 CI und Testabdeckung

Es gibt kein `.github/`, obwohl die Spezifikation in §9 eine Pipeline fordert.
`vitest.config.ts` hat keine Coverage-Schwelle. Die 77 Tests decken die reinen Rechenfunktionen ab –
**der gesamte Geld- und Druckpfad in den API-Routen ist ungetestet.**

Der `ha.test.ts` startet zudem ein echtes 2-Sekunden-Intervall mit echten `fetch`-Aufrufen,
das nie gestoppt wird (`ha.test.ts:11-18`) – ein Timer-Leak in der Testsuite.

Vorschlag: GitHub-Actions-Workflow mit `tsc --noEmit`, `vitest run --coverage` (Schwelle zunächst 60 %,
schrittweise anheben), `next build`, und ein Integrationstest gegen eine temporäre SQLite-Datei,
der einen kompletten Vorgang durchspielt: bestellen → splitten → kassieren → stornieren → Z-Bon.

### 2.7 Installer und Betrieb

`install-headless.sh` hat mehrere konkrete Fehler:

- Zeile 45: `git config --global --add safe.directory * >nul 2>nul` – `>nul` ist Windows-Syntax und
  legt unter Linux eine Datei namens `nul` an; das `*` wird vom Shell-Glob expandiert
- Zeile 46: `git pull origin master || true` überspielt Merge-Konflikte stillschweigend, danach wird
  auf veraltetem Code weitergebaut
- Zeile 70: `npm install` statt `npm ci` – nicht reproduzierbar, Dev-Abhängigkeiten inklusive
- Portkonflikt: `.env` setzt `PORT=3000` (Zeile 60), die systemd-Unit überschreibt auf 80 (Zeile 90),
  `server.js:132` meldet weiterhin Port 3000 in der mDNS-Ausgabe
- Keine automatischen Backups, kein `WatchdogSec`, kein Restart-Backoff-Limit

Außerdem: `src/lib/mdns-responder.ts` wird **nirgends importiert** – die Funktionalität ist in
`server.js:174-213` dupliziert. Eine der beiden Implementierungen sollte weg. Beide beantworten
zudem jedes UDP-Paket, das irgendwo die Bytes „openbon" und „local" enthält, ohne DNS zu parsen.
Und `install-headless.sh:27` installiert `avahi-daemon`, der Port 5353 bereits belegt – der eigene
Responder scheitert dann am Bind, was als „ist okay" abgetan wird.

---

## 3. Code-Optimierungen

### 3.1 Die teuersten Stellen bei ~5000 Bestellungen

**`/api/reports`** ist mit Abstand am teuersten: vier unbegrenzte `findMany` ohne Datumsfilter,
wobei die `OrderItem`-Tabelle über drei verschiedene Includes **dreimal vollständig** geladen und
dann in JavaScript aggregiert wird (`api/reports/route.ts:11-26` und `:62-167`).
Bei 20 000 Positionen sind das 60 000 Objekte pro Aufruf – auf einem Pi mehrere Sekunden.
→ Auf SQL-`groupBy`/`aggregate` umstellen und auf die aktuelle Kassenperiode filtern.

**`/api/tables`** lädt alle Tische mit allen offenen Bestellungen und allen Positionen und schickt
das komplette `orders`-Array an den Client (`api/tables/route.ts:16-31,61`), obwohl die Tischkacheln
nur Summe und Anzahl brauchen. → Aggregat serverseitig berechnen, `orders` nicht ausliefern.

**Refetch-Sturm:** Jedes Socket-Event löst auf jedem Gerät einen kompletten Neuladevorgang aus
(`waiter/page.tsx:102-105`, `kitchen/page.tsx:74-92`). Eine einzige Bestellung erzeugt bei 15 Geräten
15 vollständige Aggregationsabfragen – obwohl die Events die Nutzdaten bereits mitbringen.
→ Events als Delta in den lokalen State einarbeiten, Vollabgleich nur als Fallback alle paar Minuten.
Alternativ TanStack Query mit gezielter Cache-Invalidierung.

**Heartbeat-Broadcast:** Alle 15 Sekunden sendet jedes Gerät `device:heartbeat`, der Server antwortet
mit der kompletten Geräteliste an **alle** (`server.js:73,85`). Bei 20 Geräten sind das 400 Nachrichten
je 15 Sekunden, nur für Akkustände, die niemand außer der Admin-Seite ansieht.
→ Nur an Admin-Sockets senden, Intervall auf 60 Sekunden.

**N+1 im Bestellpfad:** `api/orders/route.ts:99-111` fragt pro Position eine Variante und pro Option
eine Option einzeln ab – in einer verschachtelten Schleife, auf dem Pfad, der 5000-mal am Tag läuft.
Beides ist über das bereits geladene `products` verfügbar.

**Weitere Schleifen-Queries ohne Transaktion:** `api/tables/route.ts:87-97` (Raster anlegen),
`:120-128` (Tischmarken sequenziell drucken), `:160-170` (Bulk-Update).

### 3.2 Struktur und Wartbarkeit

- **Seitenkomponenten sind zu groß.** `waiter/order/page.tsx` (650 Zeilen),
  `admin/reports/page.tsx` (700+), `waiter/payment/page.tsx` (900+ nach meinem Umbau).
  → Pro Seite in Präsentationskomponenten plus einen Hook mit der Logik aufteilen
  (`useCart`, `useCheckout`, `useTableOrders`). Das macht sie testbar.
- **Datenzugriff dupliziert:** `fetch`-Aufrufe stehen roh in den Komponenten, jeweils mit eigenem
  `try/catch` und eigenem Loading-State. → Ein typisierter API-Client (`src/lib/api-client.ts`),
  der die DTOs aus `types/domain.ts` verwendet.
- **Fünf Duplikate der Unterkategorien-Liste** mit jeweils abweichenden Labels
  („Kaffee & Tee" vs. „Heiß" vs. „Heißgetränke"): `admin/products/page.tsx:230,439`,
  `pos/page.tsx:271`, `waiter/order/page.tsx:363`, `components/ui/subcategory-icon.tsx:11`.
  `BAR` fehlt in der Icon-Map.
- **`alert()` und `confirm()`** werden noch an mehreren Stellen verwendet
  (`admin/tables/page.tsx:123`, `pos/page.tsx:174`, `admin/printers`, `admin/products`).
  Auf einem Tablet im Hektikbetrieb blockieren die den ganzen Bildschirm.
  → Einheitliche Toast- und Bestätigungs-Komponenten (die im Kellner-Screen bereits existieren).
- **Toter Code:** `mdns-responder.ts` (nie importiert), `StockItem.initialQuantity` (nie gelesen),
  `ProductCategory.color` und `.icon` (nie gerendert), importierte, aber nie gerenderte Icons
  (`Copy`, `Edit2`, `Trash2`, `Search` in mehreren Admin-Seiten).
- **Der `search`-State in `admin/products/page.tsx:33`** existiert samt Filterlogik, aber
  **das Eingabefeld fehlt** – die Suche ist nicht bedienbar.

### 3.3 Datenmodell aufräumen

| Doppelung | Empfehlung |
|---|---|
| `Product.stockQuantity` vs. `StockItem.currentQuantity` (+ beide Schwellwerte) | `StockItem` behalten, Felder am Produkt entfernen |
| `Product.isSoldOut` vs. `Product.status` (ACTIVE/INACTIVE/HIDDEN) | Ein `status`-Enum plus berechnetes `isAvailable` |
| `EventConfig.trayMaxItems` vs. `PrintGroup.maxItemsPerTicket` | Beibehalten, aber `null` statt `0` für „erben" – `0` bedeutet je Feld etwas anderes |
| `OrderItem.isCancelled` vs. `Payment.isCancelled` | Verknüpfen; ein stornierter `OrderItem` mit bereits erzeugtem `PaymentItem` hinterlässt sonst eine verwaiste Zahlungsposition |
| `DiningTable.activeWaiterName` vs. `Order.waiterName` | Ableiten statt speichern |

`String`-Felder mit festem Wertebereich (`status`, `orderType`, `paymentMethod`, `kdsStatus`,
`haRole`, `type`) sollten bei einem späteren Wechsel auf PostgreSQL echte Enums werden.
SQLite kennt keine – bis dahin hilft ein `@db.Check` oder mindestens konsequente Zod-Prüfung.

---

## 4. Funktionen: anpassen, ergänzen, entfernen

### 4.1 Anpassen

| Funktion | Problem | Empfehlung |
|---|---|---|
| **Kellner-Identität** | Freitextname pro Gerät (`waiter/page.tsx:73`), keine Personalstammdaten. „Bedienung" vs. „Bedienung 1" erzeugt zwei Zeilen in der Rangliste. Ein Tippfehler zerlegt die Abrechnung | `Staff`-Tabelle mit Name, Rolle, eigenem PIN; Anmeldung per Auswahl statt Freitext. Grundlage für echte Schichtabrechnung und Trinkgeldverteilung |
| **Artikel anlegen** | Keine Druckgruppen-Auswahl im Modal; neue Artikel landen automatisch in der ersten Gruppe (`admin/products/page.tsx:94`) – also Getränke auf dem Küchendrucker | Druckgruppe, Bon-Kurzname, Farbe, Varianten und Optionen ins Formular aufnehmen |
| **Artikel bearbeiten** | `printGroupId: ''` wird ungeprüft an Prisma gereicht (`api/products/[id]/route.ts:44`) → 500 bei jedem Artikel ohne Druckgruppe | `'' → null` normalisieren, Existenz prüfen |
| **Tischplan** | Kein Editor, nur ein CSS-Raster. `gridX`/`gridY` beeinflussen die Darstellung nicht. `section` ist im Schema vorhanden, wird aber von keinem Endpoint geschrieben oder ausgeliefert | Echter Plan-Editor mit Drag & Drop und Bereichen (Zelt / Biergarten / Empore); Kellner Bereichen zuordnen |
| **Raster generieren** | `deleteMany({})` ohne PIN und ohne Prüfung auf offene Bestellungen (`api/tables/route.ts:81`). Offene Orders und Payments verlieren still ihren Tischbezug | PIN verlangen, offene Tische blockieren, statt Löschen ein Zusammenführen anbieten |
| **Bestand nachbuchen** | `isSoldOut` wird beim Nachbuchen automatisch zurückgesetzt (`api/inventory/route.ts:52`) – eine bewusst gesetzte Sperre verschwindet | Manuelle Sperre von der Automatik trennen |
| **X-Bon / Z-Bon** | Aktuell nur Ausdruck | Zusätzlich als PDF und CSV, mit Vorschau am Bildschirm vor dem Abschluss |
| **Selbstdiagnose** | Läuft, kann hängende Druckaufträge aber prinzipiell nicht finden (siehe 1.4) | Nach der Spooler-Umstellung neu verdrahten; Ergebnis als Ampel ins Dashboard |
| **Trainingsmodus** | Globaler Schalter | Pro Gerät schaltbar, damit ein neuer Helfer üben kann, während der Rest live arbeitet |

### 4.2 Ergänzen – nach Nutzen sortiert

1. **Offline-Modus mit Outbox** (siehe 1.3). Für Open-Air der größte einzelne Gewinn.
2. **Artikel-Import/-Export als CSV.** Eine Speisekarte mit 80 Positionen im Browser einzutippen
   ist die realistische Hürde vor jedem Fest. Excel-Vorlage, Vorschau, dann übernehmen.
3. **Vorlagen für Veranstaltungen.** Komplette Konfiguration (Artikel, Kategorien, Druckgruppen,
   Tische, Pfandwerte) als benanntes Profil sichern und laden. Nächstes Jahr ist das Fest in
   zwei Minuten eingerichtet.
4. **Personalverwaltung mit Schichten** – Voraussetzung für Trinkgeldverteilung und Kassensturz je Kellner.
5. **Kassensturz-Assistent:** Stückzahlen je Schein und Münze eingeben, Differenz zum Bar-Soll
   automatisch ausweisen und protokollieren.
6. **Wertmarken und Gutscheine.** Die Dokumentation erwähnt sie, im Code gibt es sie nicht.
   Für Vereinsfeste (Essensmarken, Helferbons) sehr üblich.
7. **Happy Hour / Zeitpreise** – Preisstaffel je Artikel nach Uhrzeit.
8. **Rundenverwaltung und Deckel** – Gäste auf einen Namen buchen, nicht nur auf einen Tisch.
9. **Küchen-Bump-Bar mit Rückgängig** – ein versehentlich abgestrichener Posten ist derzeit nicht
   wiederherstellbar.
10. **Live-Warteschlangenanzeige** für Gäste (Abholmarken auf einem Fernseher).
11. **Mehrsprachigkeit.** Deutsche Texte stehen im gesamten Code fest verdrahtet. Für Helfer,
    die kein Deutsch sprechen, wäre `next-intl` mit einer Sprachdatei die Grundlage.
12. **Audit-Log:** Wer hat wann welchen Preis geändert, storniert, Bestand gebucht.
    Bei Vereinsfesten mit wechselnden Helfern der wirksamste Schutz gegen Schwund.

### 4.3 Entfernen oder zurückstufen

| Kandidat | Begründung |
|---|---|
| **`api/system/update` EXEC-Aktion** | Beliebige Shell-Befehle über HTTP. Ersatzlos streichen oder auf eine Allowlist reduzieren |
| **Hochverfügbarkeit in der jetzigen Form** | Funktioniert nicht, erzeugt aber Vertrauen. Entweder korrekt bauen oder als „experimentell" kennzeichnen und stattdessen auf Backups plus Offline-Clients setzen (siehe 1.2) |
| **Client-seitige Lizenzprüfung** | `lib/license.ts:3` – der HMAC-Salt liegt im Browser-Bundle, `maxDevices` wird nirgends durchgesetzt, die Signatur deckt `features` nicht ab. Entweder serverseitig prüfen oder ganz weglassen; bei einem MIT-lizenzierten Community-Projekt ist Letzteres ehrlicher |
| **`mdns-responder.ts`** | Toter Code, dupliziert in `server.js`. Eine Implementierung behalten – idealerweise ganz auf `avahi` setzen, das der Installer ohnehin einrichtet |
| **`Product.stockQuantity` / `stockAlertThreshold` / `isSoldOut`** | Doppelung zu `StockItem` (siehe 1.6) |
| **`StockItem.initialQuantity`, `ProductCategory.color` und `.icon`** | Werden nirgends gelesen bzw. gerendert |
| **Umsatzprognose (`lib/forecast.ts`)** | Nette Spielerei, aber die „KI-Bedarfsprognose" ist eine lineare Hochrechnung. Entweder ehrlich als „Hochrechnung" bezeichnen oder zugunsten der Bestandswarnung zurückstufen, die praktisch nützlicher ist |
| **`orderType: 'DIRECT_SALE' / 'VOUCHER'`** | Falsche Werte, die nie greifen (siehe 1.5) |

---

## 5. Nutzerfreundlichkeit

**Das Leitbild sollte sein: Ein Helfer, der das Gerät zum ersten Mal in der Hand hält, muss ohne
Einweisung eine Bestellung aufgeben können. Und ein Fehler darf nie Geld kosten.**

### 5.1 Einrichtung

- **Einrichtungsassistent beim ersten Start:** Eventname → Steuersätze → Kategorien und Artikel
  (oder CSV-Import) → Drucker suchen und zuordnen → Tische anlegen → PINs setzen.
  Heute muss man sich das über sechs Admin-Seiten zusammensuchen.
- **Drucker-Zuordnung visuell:** eine Matrix „Warengruppe × Drucker" statt eines Dropdowns je Artikel.
- **Testlauf-Modus vor dem Fest:** Demodaten erzeugen, alle Stationen durchspielen, Probedruck
  auf jeder Station, Checkliste mit grünen Haken.

### 5.2 Im Betrieb

- **Fehlermeldungen in Klartext.** Aktuell erreichen den Kellner rohe Prisma-Meldungen.
  Jede Meldung sollte sagen, was zu tun ist: „Der Küchendrucker antwortet nicht. Bon wurde
  gespeichert und wird automatisch nachgedruckt."
- **Undo statt Bestätigungsdialog.** Ein „Wirklich löschen?" wird im Hektikbetrieb blind weggetippt.
  Besser: Aktion sofort ausführen und 10 Sekunden lang „Rückgängig" anbieten.
- **Große Trefferflächen konsequent.** Die 48×48-px-Regel gilt bisher nur in den von mir
  überarbeiteten Screens; die Admin-Seiten haben teils 24-px-Buttons.
- **Einhand-Bedienung:** Die wichtigsten Aktionen gehören an den unteren Bildschirmrand,
  nicht nach oben – dort erreicht sie der Daumen.
- **Suchfeld im Bestellscreen.** Bei 80 Artikeln ist Scrollen durch Kategorien langsamer als Tippen.
- **Favoriten/Schnellwahl** je Kellner: die sechs meistbestellten Artikel als erste Kachel.
- **Statusampel dauerhaft sichtbar:** WLAN, Drucker, Server, wartende Vorgänge – eine Zeile,
  drei Farben, auf jedem Gerät.
- **Barrierefreiheit:** Der Spec-Anspruch ist WCAG AA. Ungeprüft sind bisher Kontrastwerte
  (die Slate-400-Texte auf Slate-900 liegen grenzwertig), Fokusreihenfolge, `aria-label`
  an Icon-Buttons und Bedienbarkeit per Tastatur.

### 5.3 Für die Festleitung

- **Ein Dashboard, das aus fünf Metern lesbar ist:** Umsatz, offene Tische, Wartezeit Küche,
  kritische Bestände, Druckerstatus. Als Kiosk-Ansicht für einen Bildschirm im Backstage-Bereich.
- **Push-Hinweise bei kritischen Ereignissen:** Drucker offline, Artikel ausverkauft,
  Wartezeit über 20 Minuten, Kassendifferenz beim Abschluss.

---

## 6. Anpassungsfähigkeit

Ziel: **Ein Verein soll OpenBon für sein Fest einrichten können, ohne eine Zeile Code anzufassen.**
Davon ist das Projekt derzeit weiter entfernt, als es wirkt – vieles ist hart verdrahtet.

### 6.1 Was heute im Code steht und in die Datenbank gehört

| Hart verdrahtet | Ort |
|---|---|
| Unterkategorien BIER/WEIN/ALKOHOLFREI/HEISS/BAR | 5 Stellen, s. o. – ein Verein mit „Cocktails" oder „Kinder" kann nichts hinzufügen |
| Pfandstufen 1,00 / 2,00 / 0,50 € | `waiter/payment/page.tsx:47` |
| Aufschlag- und Rabattstufen inkl. Begründungstexte | `waiter/payment/page.tsx:579` |
| Trinkgeldstufen 0 / 0,50 / 1 / 2 € | `waiter/payment/page.tsx:770` |
| Bargeld-Schnellscheine | `lib/pricing.ts:197` |
| Stornogründe (6 feste Texte, kein Freitext) | `types/domain.ts:27` |
| Gänge mit Labels „Vorspeise/Hauptgang/Dessert" | `types/domain.ts:38` – für ein Vereinsfest untypisch |
| Kellnernamen-Vorschläge | `waiter/page.tsx:683` |
| Steuersätze im Artikel-Dropdown | `admin/products/page.tsx:407` – ignoriert die einstellbaren `EventConfig`-Werte |
| Nachfüllstufen +10/+50/+100 | `admin/inventory/page.tsx:213` |
| Drucker-Defaults (IP, Port, Papierbreite, Zeichensatz) | `admin/printers/page.tsx:38` |
| Währung | `lib/utils.ts:8` kennt nur EUR und CHF; `EventConfig.currency` ist frei editierbar und wird ignoriert |

**Empfehlung:** Eine Tabelle `ConfigList(key, items JSON, sortIndex)` für alle diese Listen,
dazu eine Admin-Seite „Auswahllisten". Das ist ein überschaubarer Umbau mit großer Wirkung.

### 6.2 Fehlende CRUD-Operationen

- **Warengruppen sind praktisch unverwaltbar:** `api/categories` hat nur GET und POST,
  kein PUT, kein DELETE – **und kein UI ruft den POST auf.** Kategorien sind ausschließlich über
  `prisma/seed.js` änderbar. (Achtung bei DELETE: `onDelete: Cascade` löscht alle Artikel mit.)
- **Drucker:** kein Ändern, kein Löschen. Ein falsch eingetragener Drucker bleibt für immer.
- **Druckgruppen:** Der PUT-Endpoint existiert, wird aber nie aufgerufen – die UI postet immer an
  POST und erzeugt Duplikate (`admin/printers/page.tsx:181`).
- **Wortgruppen:** kein PUT, kein DELETE, kein Admin-UI.
- **Sortierung:** `sortIndex` existiert an fünf Modellen, wird aber von keinem Formular gesetzt –
  alle über die UI angelegten Artikel haben `sortIndex: 0` und erscheinen in undefinierter Reihenfolge.
- **Varianten und Optionen** sind über die UI weder anlegbar noch änderbar – nur der Seed kann das.
- **Nicht editierbar im Artikel-Modal:** Bon-Kurzname, Farbe, Druckgruppe, Status.
- **Duplizieren** gibt es nirgends (das `Copy`-Icon ist importiert, aber nie gerendert).
- **Versteckte Artikel** (Soft-Delete auf `HIDDEN`) lassen sich nicht wiederherstellen,
  weil jeder GET sie herausfiltert.

### 6.3 Erweiterbarkeit für Fortgeschrittene

- **Plugin-Punkte für Zahlarten.** `PAYMENT_METHODS` und die Deep-Link-Builder sind bereits sauber
  getrennt – ein Interface `PaymentProvider` mit Registrierung würde neue Anbieter (Payone, Adyen,
  Nexi) ohne Eingriff in den Bezahlflow ermöglichen.
- **Bon-Layouts als Vorlagen** statt fest im `EscPosBuilder`: Kopfzeile, Fußzeile, Logo,
  Feldreihenfolge pro Bon-Typ konfigurierbar. Vereine wollen ihr Logo auf dem Beleg.
- **Webhooks** für externe Systeme (Buchhaltung, Anzeigetafel, Türzähler).
- **PostgreSQL-Option.** Prisma macht das einfach; ab etwa vier gleichzeitig schreibenden Stationen
  wird SQLite mit seinem Datei-Lock zum Engpass.

---

## 7. Vorgeschlagene Reihenfolge

**Phase 1 – Vor dem ersten Echtbetrieb (ca. 1–2 Wochen)**
Auth mit Middleware und Session-Cookie · PIN-Hashing und Rate-Limit · EXEC-Endpunkt entfernen ·
Socket.io absichern · Abholmarken-Bug beheben · Bestandsdoppelung auflösen ·
Transaktionsklammer im Bestellpfad · Indizes · `prisma migrate` · automatische Backups

**Phase 2 – Robustheit (ca. 2 Wochen)**
Service Worker und Outbox · echte Idempotenz · persistente Druckerqueue mit Nachdruck ·
strukturiertes Logging · echter Health-Endpoint · CI mit Integrationstest über den Geldpfad ·
HA entweder reparieren oder als experimentell kennzeichnen

**Phase 3 – Bedienbarkeit (ca. 2 Wochen)**
Einrichtungsassistent · CSV-Import für Artikel · fehlende CRUD-Operationen ·
konfigurierbare Auswahllisten · Personalverwaltung · Undo statt Bestätigungsdialogen ·
Suchfeld und Favoriten im Bestellscreen

**Phase 4 – Ausbau**
Tischplan-Editor mit Bereichen · Veranstaltungsvorlagen · Wertmarken · Kassensturz-Assistent ·
Audit-Log · Mehrsprachigkeit · Bon-Layouts

---

## 8. Was ich an dem Projekt gut finde

Damit das Bild nicht schief hängt: Vieles ist bereits überdurchschnittlich gelöst.
Die Druckgruppen-Architektur mit Tablett-Splitting ist präziser als bei vielen kommerziellen Systemen.
Der virtuelle Drucker ist ein sehr gutes Testwerkzeug. Team-Funk, Geräte- und Akkumonitor sowie das
QR-Beitritts-Center sind genau die Dinge, die im Festbetrieb wirklich helfen und die man in einer
Spezifikation nicht findet. Die Domänenmodellierung – Pfand, Rückpfand, Aufschläge, Splitting –
zeigt, dass jemand den Ablauf an der Theke kennt.

Was fehlt, ist nicht die fachliche Substanz, sondern die technische Härtung darum herum.
