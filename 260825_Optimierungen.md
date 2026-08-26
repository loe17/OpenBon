# OpenBon – Optimierungs- & Fehlerbehebungsplan

**Datum:** 25.08.2026 · **Basis-Version:** v0.3.8 · **Status:** Planung – Umsetzung nach GO

---

## Teil A – Gemeldete Fehler (Bugfixes)

### A1 · „Fehler beim Kassiervorgang" ohne Details an der Bonkasse 🔴

**Symptom:** Klick auf „Sofort kassieren" zeigt generischen Fehler (Bild 1). Kassenlade ist nicht angeschlossen.

**Analyse (Verdacht, hochkonfident):** Im Umbau auf den Atomic Checkout ruft `pos/page.tsx` und `kiosk/page.tsx` `crypto.randomUUID()` **ungeschützt** auf. `crypto.randomUUID` existiert nur in **Secure Contexts** (HTTPS oder localhost) – über `http://openbon.local` bzw. LAN-IP ist die Funktion nicht vorhanden → TypeError → landet im generischen `catch`. Auf localhost beim Testen funktioniert es deshalb, im Feld nicht. Zweitens: Der Server-Fehlertext (`result.error`) wird im Toast nicht durchgereicht.

**Umsetzung:**
1. Zentrale Helper-Funktion `generateIdempotencyKey(prefix)` (mit Fallback wie in `outbox.ts` bereits vorhanden) in POS + Kiosk nutzen statt direktem `crypto.randomUUID()`.
2. Toast zeigt künftig die konkrete Server-Fehlermeldung: `error(result.error || '…')` – zusätzlich Debug-Details (Statuscode) bei 5xx.
3. **Kassenlade-Erkennung:** Neues Config-Feld `cashDrawerConnected` (je Kassenstation, Admin einstellbar). Ist „Lade angeschlossen" aktiv, aber der Drucker beim Öffnen nicht erreichbar → klare Warnung „Kassenlade nicht erreichbar (Drucker X) – Verkauf wurde trotzdem abgeschlossen". Lade-Fehler blockiert NIEMALS den Verkauf (ist bereits so, wird aber jetzt sichtbar gemeldet).
4. Global: Einheitliches Fehlerformat aller API-Routen `{ error, details? }` + zentrale `showApiError()`-Helper-Funktion im Frontend, damit überall dieselbe, sprechende Meldung erscheint.

**Aufwand:** 0,5–1 Tag · **Priorität:** 🔴 kritisch (blockiert Livebetrieb)

---

### A2 · Split-Funktion (1/2, 1/3 …) im Bedienmodus prüfen 🔴

**Symptom:** Rechnungsteilung im Kellner-Payment funktioniert nicht korrekt.

**Analyse:** Zu prüfen: `waiter/payment/page.tsx` (Split-UI) und `findSplit()`/Teilzahlungslogik in `api/payments`. Mögliche Fehlerquellen: Rundung bei ungeraden Beträgen, `paidQuantity`-Inkrement bei Teilbeträgen, Restbetrag-Anzeige nach Split.

**Umsetzung:** Reproduktion per E2E-Test (50 € zu 1/3 teilen → 16,67/16,67/16,66, Rest korrekt), dann Fix in `pricing.ts`/Payment-Route; Unit-Tests für alle Split-Fälle (gerade/ungerade, mit Pfand, mit Trinkgeld).

**Aufwand:** 0,5–1 Tag · **Priorität:** 🔴 kritisch

---

### A3 · Button „Gast-Ansicht" nur bei aktivierter Funktion zeigen 🟠

**Symptom:** Gast-Ansicht-Button im Bedienmodus immer sichtbar, unabhängig von der Admin-Einstellung.

**Umsetzung:** Die Stationen laden bereits die Public-Config (`/api/config/public`) – dort liegt `enableGuestFacingDisplay`. Button in `waiter/payment/page.tsx` (und POS, falls vorhanden) conditional rendern: `{enableGuestFacingDisplay && <Button/>}`.

**Aufwand:** 1–2 h · **Priorität:** 🟠

---

### A4 · Virtuelle Drucker: Webinterfaces kaputt, Monitor zeigt nichts 🔴

**Symptom:** Die Webinterfaces der virtuellen Drucker funktionieren nicht; der zentrale „Virtueller Drucker-Monitor" bleibt leer.

**Analyse:** Der Spooler schreibt Events auf `virtual_printer:new_ticket` (Socket) und hält die Historie in `global.virtualPrinterHistory` (max. 100). Vermutliche Ursachen: (a) Die Monitor-Seite lauscht auf falsches Event oder lädt die Historie nicht beim Join, (b) es gibt konkurrierende UIs (`/virtual-printer`, `/admin/virtual-printer`), von denen eine/einges veraltet ist.

**Umsetzung:**
1. Monitor-Seite (`/virtual-printer`) als **einzige** verbleibende UI: Beim Join Historie per GET laden (neuer Endpoint `GET /api/virtual-printer/history`), Live-Tickets per Socket.
2. Alte/parallele Drucker-Webinterfaces entfernen oder auf den Monitor redirecten (Nutzerwunsch: „alles nur auf den Monitor").
3. Druckervorschau-Links in Admin/Drucker-Einstellungen auf den Monitor zeigen lassen.

**Aufwand:** 0,5–1 Tag · **Priorität:** 🔴 (wichtig für druckerlosen Testbetrieb)

---

### A5 · Erster Besuch auf openbon.local: keine PIN-Abfrage, Stationen-Wechsel nötig 🔴

**Symptom:** Beim initialen Aufruf kommt keine PIN-Abfrage; man muss einmal manuell zwischen zwei Stationen wechseln, bevor etwas funktioniert.

**Analyse:** Stationsseiten (POS/Waiter/…) sind nicht middleware-geschützt (nur deren API-Calls). Beim Erstbesitz ohne Session liefern die API-Aufrufe 401, die Seiten zeigen aber keinen Login an – erst ein Stationswechsel (der `?auth_required`-Flow des Startbildschirms) triggert das PinModal. Es fehlt ein **zentraler Session-Check beim Laden jeder Station**.

**Umsetzung:**
1. Neuer leichtgewichtiger Endpoint `GET /api/auth/session` → `{ authenticated, role }`.
2. Zentrale `PinGate`-Komponente (existiert als `pin-modal.tsx` – wird erweitert): Prüft beim Mount die Session; bei 401/keine Session → PIN-Pad für die jeweilige Station anzeigen, nach Erfolg Daten neu laden. In POS, Waiter, Kitchen, Kiosk (kein PIN), Gast (kein PIN) einhängen.
3. Ergebnis: Jeder direkte Einstieg per QR/Lesezeichen fragt sofort korrekt die PIN ab.

**Aufwand:** 0,5–1 Tag · **Priorität:** 🔴

---

### A6 · Druckgruppen können nicht angelegt werden 🔴

**Analyse zu prüfen:** `POST /api/print-groups` + Formular in `admin/printers/page.tsx`. Verdacht: Validierung lehnt das Payload ab (z. B. `productIds`-Format) oder das Formular sendet ein leeres Pflichtfeld.

**Umsetzung:** Reproduzieren, Fehler im Route-Handler/Schema fixen, Erfolgsfall per Test absichern.

**Aufwand:** 2–4 h · **Priorität:** 🔴

---

### A7 · Vorhandene Drucker können nicht editiert werden 🔴

**Analyse zu prüfen:** Gibt es `PATCH/PUT /api/printers/[id]`? Falls nur POST existiert, ist Edit im UI ein No-Op. Zusätzlich prüfen, ob das Edit-Modal die Drucker-Daten korrekt vorbelegt.

**Umsetzung:** Fehlende Update-Route ergänzen (Zod-Schema `UpdatePrinterSchema`), UI-Modal anbinden, Test.

**Aufwand:** 2–4 h · **Priorität:** 🔴

---

### A8 · Kellner-Abrechnung & Trinkgeld: keine Kellner sichtbar, Abrechnen unmöglich 🔴

**Analyse zu prüfen:** `/waiter/settle` + `api/waiters/settle`. Verdacht: Kellnerliste wird aus `WaiterProfile` geladen, aber die Seite filtert nach `isActive`/Session-Rolle oder das API liefert ins leere Feld (401 durch A5!). Wahrscheinlich teils **Folgefehler von A5** – wird nach A5-Fix re-testet.

**Umsetzung:** Nach A5 verifizieren; Restfehler in Lade-/Settle-Logik fixen; Test mit 2 Kellnern + Trinkgeldprofil.

**Aufwand:** 2–4 h (nach A5) · **Priorität:** 🔴

---

### A9 · System- & Revisionsprotokoll zeigt keine Einträge 🔴

**Symptom:** Weder Einstellungsänderungen noch Bestellungen/Zahlungen erscheinen im Audit-Log.

**Analyse:** `action-logger.ts` existiert, wird aber vermutlich nur an wenigen Stellen (oder nirgends) aufgerufen; `admin/logs`-Seite liest dann eine leere `ActionLog`-Tabelle. Zusätzlich Wunsch: beim Ansichtenwechsel alle Einträge ansehen können (Filter/Pagination statt starrer Vorauswahl).

**Umsetzung:**
1. `logAction()` an allen kritischen Punkten verdrahten: Order erstellt/Storno, Payment/Zahlungsstorno, Config-Änderung (mit Feld-Diff), Login-Versuche, Kassenbewegungen, Z-Bon, Drucker-Änderungen, System-Update.
2. Logs-Seite: Filter (Kategorie/Aktion/Zeitraum/Actor) + „Alle"-Ansicht + Pagination (Cursor-basiert, `createdAt`-Index existiert).
3. Retention bleibt beim Cleanup-Job (90 Tage).

**Aufwand:** 1 Tag · **Priorität:** 🔴 (Compliance-relevant)

---

### A10 · Chat: keine Nachrichten im Verlauf, Eildurchsage erscheint nicht 🟠

**Symptom:** Chatverlauf bleibt komplett leer; Eil-Durchsagen erscheinen weder in der Bedienansicht noch im Verlauf.

**Analyse zu prüfen:** Chat läuft über Socket-Event `chat:message` → `io.emit('chat:incoming')` und `ChatMessage`-Tabelle. Verdacht: (a) Verlauf wird beim Join nicht aus der DB geladen (nur Live-Events), (b) Eil-Nachrichten werden an einen Zielraum gesendet, den die Bedienansicht nicht abonniert, (c) Sender-UI sendet an falsches Event.

**Umsetzung:**
1. Beim Seitenaufruf Verlauf per `GET /api/chat?limit=50` laden (Route prüfen/ergänzen), Live per Socket ergänzen.
2. Eildurchsage: akustischer+visueller Alarm (Vollbild-Puls) auf allen Staff-Stationen, solange nicht bestätigt; Eintrag immer im Verlauf markiert.
3. Read-Receipts (`isRead`) beim Ansehen setzen.

**Aufwand:** 0,5–1 Tag · **Priorität:** 🟠

---

### A11 · Ziffernblock für Einhandbedienung am Mobilgerät optimieren 🟠

**Symptom:** Aktuelles Layout (Bild 2) schlecht mit einer Hand erreichbar.

**Umsetzung:**
- Numpad als **Bottom-Sheet** (unten andockbar, Daumenzone), 3×4-Raster mit ≥56 px Targets, großer Betragsanzeige oben.
- Quick-Add-Buttons (5/10/20/50 €) direkt über dem Block; Haptik-Feedback bei jedem Tastendruck; „OK/Buchen"-Button rechts Daumen-nah (grün, breit).
- Auf Tablets (≥1024 px) bleibt das seitliche Layout bestehen – Responsive-Breakpoint.

**Aufwand:** 0,5 Tag · **Priorität:** 🟠

---

### A12 · „Grunddesign" & „Bon-Design" landen auf der Startseite 🟠

**Symptom:** Klick auf diese Einstellungs-Bereiche zeigt die Stationsauswahl (Bild 3) statt der Einstellungen.

**Analyse:** Startseite = Redirect-Ziel der Middleware bei `auth_required`. Verdacht: Die Links zeigen auf entfernte/umbenannte Unterseiten (nach der Einstellungs-Modularisierung in Tabs) oder ein `<a href>` ohne Client-Router, das einen vollen Reload mit ungültiger/fehlender Session auslöst. Wird nach A5 mitgeprüft.

**Umsetzung:** Links auf die existierenden Tabs (`GeneralTab`/Design-Sektion) umbiegen, Deep-Linking per Query-Param (`/admin/settings?tab=design`) ermöglichen; nach A5 verifizieren.

**Aufwand:** 1–2 h · **Priorität:** 🟠

---

### A13 · Artikel nachträglich einer anderen Warengruppe zuweisen 🟢

**Umsetzung:** Im Produkt-Edit-Modal (admin/products) fehlt vermutlich das Kategorie-Feld: Dropdown „Warengruppe" ergänzen, `PATCH /api/products/[id]` um `categoryId` erweitern (Schema-Feld existiert), Sortierung/Cache invalidieren.

**Aufwand:** 1–2 h · **Priorität:** 🟢

---

### A14 · Speisekarte: individuelle Fußzeile + Designs 🟢

**Umsetzung:**
1. Config-Felder `menuFooterText` (String) + `menuDesign` (Enum: `classic`, `modern`, `rustic`, `minimal`) in `EventConfig` bzw. `ConfigList`.
2. PDF-Generator (Speisekarte) um Design-Templates erweitern (Farbschema, Typografie, Kopf-/Fußzeilen-Layout) + Fußzeile frei editierbar im Admin.
3. Live-Vorschau im Admin.

**Aufwand:** 1 Tag · **Priorität:** 🟢

---

### A15 · Handbuch auf professionelles Niveau 🟠

**Symptom:** Dokumentation zu knapp.

**Umsetzung:** `docs/HANDBUCH.md` (bzw. Neuaufbau der ANLEITUNG) mit:
- Kapitel je Station (Admin, Bonkasse, Bedienung, Küche, Kiosk, Gast) mit Schritt-für-Schritt-Anleitungen
- Erstinstallation & Fest-Vorbereitung (Checkliste inkl. Preflight-Check, Drucker, WLAN, USV)
- Tagesgeschäft: Kassieren, Splitten, Storno, Kassensturz/Z-Bon, Kellnerabrechnung, Wertmarken
- Fehlerbehebung (Troubleshooting-Matrix: Drucker, WLAN, PIN, Kassenlade, Offline-Modus)
- Glossar + FAQ + Notfall-RUNBOOK-Verweis
- Verweis aus dem Admin-Docs-Bereich und der Startseite

**Aufwand:** 1–2 Tage · **Priorität:** 🟠

---

## Teil B – Architektur- & Code-Optimierungen

| # | Vorschlag | Begründung | Umsetzung | Aufwand |
|---|---|---|---|---|
| B1 | **Server-State zu TanStack Query** | ~15 verstreute useEffect+fetch-Stellen, doppelter Cache, Race-Risks; Socket wird zum reinen Invalidierungs-Trigger | `QueryProvider` im Root-Layout; schrittweise: Kitchen → Waiter → POS | 3–5 T |
| B2 | **Warenkorb in zustand-Store mit Persistenz** | Refresh am Tablet verliert aktuell den kompletten Warenkorb; 15 verstreute localStorage-Zugriffe | `zustand/persist` für Cart, Modus, Kassierer; localStorage-Zugriffe damit konsolidieren | 1 T |
| B3 | **Typsichere API-Schicht** | DTO-Duplikate pro Seite; Typ-Divergenz verursachte den Payments-Cast-Bug | `api-client.ts` mit zod-inferierten Typen aus `validations/schemas.ts` | 1–2 T |
| B4 | **React Strict Mode aktivieren** | `reactStrictMode:false` kaschiert Socket-Doppelverbindungen statt sie zu fixen | `socket-provider` disconnect-Cleanup ergänzen, dann Flag aktivieren, Stationen durchtesten | 0,5 T |

## Teil C – Sicherheit

| # | Vorschlag | Begründung | Umsetzung | Aufwand |
|---|---|---|---|---|
| C1 | **Auth-Konsolidierung auf `Staff`** | 3 parallele PIN-Quellen (EventConfig-Klartext, WaiterProfile-Klartext, Staff-Hash) blockieren feingranulare Rollen | (a) Seed beim ersten Admin-Login, (b) `verifyStationPin` intern auf Staff, (c) Klartext-Spalten droppen; danach ungenutztes `rbac.ts` aktivieren | 3–4 T |
| C2 | **Session-Revocation („Überall abmelden")** | Verlorener Tablet-Token bis 12 h gültig | `tokenVersion` in EventConfig, Claim im JWT, Prüfung in `getVerifiedSessionFromRequest`, Button im Security-Tab | 0,5 T |
| C3 | **CSRF Double-Submit-Token** | Cookie-Auth ohne CSRF-Token angreifbar bei Subdomain/DNS-Rebinding-Szenarien | `openbon_csrf`-Cookie + `X-CSRF-Token`-Header, Vergleich in Middleware (Edge-fähig) | 1 T |

## Teil D – Daten & Fiskal

| # | Vorschlag | Begründung | Umsetzung | Aufwand |
|---|---|---|---|---|
| D1 | **Geldbeträge auf Integer-Cents** | Float-Rundung ist Audit-Risiko in DSFinV-K/DATEV-Auswertungen | Doppel-Spalten-Migration (Cent-Felder, Backfill `ROUND(x*100)`), Reads/Writes über `toCents/toEuro`, alte Spalten 2 Releases später droppen | 4–5 T |
| D2 | **TSE-Status sichtbar machen** | `tseProvider=NONE` unsichtbar – Risiko bei Kassennachschau | Badge im Dashboard + Hinweis im Fiscal-Tab (inkl. Hinweis auf §146 Abs. 4 AO Befreiung) | 0,5 T |

## Teil E – Betrieb & Beobachtbarkeit

| # | Vorschlag | Begründung | Umsetzung | Aufwand |
|---|---|---|---|---|
| E1 | **Fehler-Webhook (ntfy/Telegram)** | Drucker-/DB-Fehler werden erst bemerkt, wenn Gäste stehen | `alert-webhook.ts` mit Queue + Rate-Limit (1/min/Typ); Anbindung an `printer:error`, Preflight-ERROR, Diagnose-Statuswechsel | 0,5–1 T |
| E2 | **SQLite-Pragmas beim Boot** | WAL/busy_timeout entscheiden über Latenz & SQLITE_BUSY unter Last | `PRAGMA journal_mode=WAL; busy_timeout=5000; synchronous=NORMAL;` idempotent im Boot-Pfad, Ergebnis loggen | 1 h |
| E3 | **Logrotation** | Unbegrenzte Konsolen-Logs töten SD-Karten | systemd `SystemMaxUse=50M` bzw. Windows-Logrotation in start-scripts | 2 h |

## Teil F – UX & Funktionen

| # | Vorschlag | Begründung | Umsetzung | Aufwand |
|---|---|---|---|---|
| F1 | **Visueller Tischplan-Editor** | `gridX/gridY` liegen ungenutzt im Schema; räumlicher Plan = größter Alltagsmehrwert für Kellner | Drag&Drop-Raster im Tables-Admin (Pointer-Events), Waiter-Ansicht rendert lesend mit Statusfarben | 2–3 T |
| F2 | **Barcode/QR für Wertmarken** | Manuelles Zählen fehleranfällig bei Stoßzeiten; 20 € HID-Scanner genügt | QR auf Wertmarke drucken (ESC/POS-Barcode in `escpos-builder`), Scanner-Input in POS-Einlösefeld automatisch verbuchen | 1 T |
| F3 | **Offline-Cache für POS/Kitchen** | SW precacht nur `/waiter*` – bei WLAN-Dropout weiße Seiten | `PRECACHE_ASSETS` erweitern + stale-while-revalidate für Produktdaten | 2–3 h |
| F4 | **„Letzte Vorgänge"-Panel an der Bonkasse** | Retoure/Doppelbuchungs-Check erfordert aktuell Admin-Dashboard | `GET /api/payments?deviceId&take=10` + Bottom-Sheet im POS mit rollenbewehrtem Storno | 0,5 T |

## Teil G – Qualitätssicherung

| # | Vorschlag | Begründung | Umsetzung | Aufwand |
|---|---|---|---|---|
| G1 | **Playwright-E2E-Rauchtest** | Die Bugs dieser Session (A1, A5, A12, v0.3.8-Login) wären nur im echten Browser aufgefallen | 3 Tests: (1) PIN-Login je Rolle + Navigation zu allen Admin-Seiten, (2) Atomic Checkout inkl. Netzwerk-Abort, (3) Drucker-Fallback via Virtual Printer; CI-Job | 1 T |
| G2 | **Unit-Tests für Split/Trinkgeld-Rundung** | A2-Klasse von Bugs dauerhaft ausschließen | Vitest-Matrix: Split 1/2–1/8, ungerade Cent-Beträge, Pfand, Trinkgeld, Surcharge | 0,5 T |

---

## Roadmap-Vorschlag (Reihenfolge nach GO)

**Phase 1 – Livebetrieb-Kritisches (Ziel: sofort einsetzbar)**
A1 (Kassier-Fehler + Lade-Erkennung) → A5 (PIN beim Erstbesuch) → A6/A7 (Drucker-CRUD) → A2 (Split) → A8 (Kellnerabrechnung, nach A5 re-testen)

**Phase 2 – Funktionslöcher**
A4 (Virtual-Drucker-Monitor) → A9 (Audit-Log) → A10 (Chat/Eildurchsage) → A12 (Design-Links) → A3 (Gast-Ansicht-Gate) → A11 (Numpad)

**Phase 3 – Ausbau**
A13 → A14 → F3 → F4 → A15 (Handbuch) → E2 → G1 → G2

**Phase 4 – Strukturell**
B2 → B4 → C1 → C2 → F1 → E1 → B1/B3 → D1 → C3 → D2 → F2 → E3

---

*Erstellt zur Freigabe durch den Betreiber. Umsetzung erfolgt erst nach explizitem GO – Phase 1 wird als v0.3.9, Phase 2 als v0.4.0 geplant.*
