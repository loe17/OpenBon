# OpenBon – Master-Changelog & Systemgedächtnis

> **Wichtiger Hinweis für Entwickler & KI-Assistenten:**  
> Dieses Dokument fungiert als das zentrale **Systemgedächtnis** von OpenBon. Es dokumentiert alle Spezifikationen, Architektur- und Sicherheitsentscheidungen, Bugfixes und den aktuellen Umsetzungsgrad.  
> **Pflicht-Regel:** Vor jeder Änderung am Code muss dieses Dokument konsultiert werden. Nach jeder Änderung ist dieses Dokument chronologisch mit Datum, Uhrzeit, Begründung (Weshalb) und technischer Umsetzung (Wie) zu erweitern!

---

## Inhaltsverzeichnis
1. [Status-Legende](#status-legende)
2. [Chronologische Versions- und Änderungshistorie](#chronologische-versions--und-%C3%A4nderungshistorie)
   - [v0.1.0 bis v1.3.0 (21.08.2026) – Fundament & Basis](#21082026--ursprung--v010-bis-v130)
   - [v0.2.0 bis v0.3.5 (24.08.2026) – Gastro-Spezifikation V1 & V2](#24082026--spezifikation-v1-v2--release-v020-bis-v035)
   - [v0.3.6 bis v0.3.8 (25.08.2026) – Architektur- & Sicherheitsrevision](#25082026--architektur--und-sicherheitsrevision-v036-bis-v038)
   - [v0.4.0 bis v0.4.8 (26.08.2026) – UI-Refinement, Schichtabrechnung & Resilienz](#26082026--ui-refinement-schichtabrechnung--resilienz-v040-bis-v048)
   - [v0.4.9 bis v0.4.11 (27.08.2026) – Sicherheits-Härtung & In-App HA-Pairing](#27082026--sicherheits-h%C3%A4rtung--in-app-ha-pairing-v049-bis-v0411)
3. [Aktueller Umsetzungsstand & Reality-Check](#aktueller-umsetzungsstand--reality-check)
4. [Lagerposten & geteilter Verbrauch (Brötchen-Prinzip) – Funktionsweise](#lagerposten--geteilter-verbrauch-br%C3%B6tchen-prinzip)
5. [Backlog & Zukünftige Erweiterungen](#backlog--zuk%C3%BCnftige-erweiterungen)

---

## Status-Legende
- `[✅ UMGESETZT]` = Vollständig im Code implementiert, verdrahtet und verifiziert.
- `[⚠️ TEILWEISE]` = Funktional vorhanden, aber mit Einschränkungen, manuellen Schritten oder offenen Restpunkten.
- `[⏳ OFFEN / BACKLOG]` = Spezifiziert oder geplant, jedoch noch nicht umgesetzt bzw. bewusst zurückgestellt.

---

## Chronologische Versions- und Änderungshistorie

### 📅 21.08.2026 – Ursprung & v0.1.0 bis v1.3.0

* **2026-08-21 20:43:11 +0200** – *feat: Complete modern POS system with offline LAN, high availability, KDS & ESC/POS*
  * **Status:** `[✅ UMGESETZT]`
  * **Weshalb:** Ein plattformunabhängiges, netzwerk-autarkes Kassensystem für Vereinsfeste und Gastronomie ohne Cloud-/Internet-Zwang.
  * **Wie:** Next.js 14 App Router, TypeScript, Prisma mit SQLite (WAL-Modus), Socket.IO WebSocket-Server in `server.js`, Tailwind CSS, Radix UI Primitives.
* **2026-08-21 21:11:47 +0200** – *feat: Rebrand to OpenBon, clean emojis to SVGs, PIN protection, QR join center*
  * **Status:** `[✅ UMGESETZT]`
  * **Weshalb:** Trennung der Rollen Admin (`1234`), Kasse (`1111`), Küche (`2222`) und Kellner (`3333`). Strikte Beseitigung aller Unicode-Emojis zugunsten professioneller Lucide-SVG-Vektorgrafiken.
  * **Wie:** `EventConfig`-Modell, `PinModal`-Komponente, SVG-Renderer `SubCategoryIcon`.
* **2026-08-21 21:50:52 +0200** – *feat: mDNS openbon.local support, Admin Command Center & predictive forecasting*
  * **Status:** `[✅ UMGESETZT]`
  * **Weshalb:** Zero-Config-Netzwerkzugriff für Helfer (`http://openbon.local:3000`) ohne IP-Eingabe; Live-Umsatzüberwachung.
  * **Wie:** Multicast-DNS Responder auf Port 5353, Recharts Dashboard.
* **2026-08-21 22:11:35 +0200** – *feat: VR-Pay Me, surcharges, waiter hourly performance & autostart*
  * **Status:** `[✅ UMGESETZT]`
  * **Weshalb:** Mobile Kartenzahlung für Volks- und Raiffeisenbanken und flexible Aufschläge (Pfand, Nachtzuschlag).
  * **Wie:** Custom-Scheme Deep Link Handler (`vrpayme://pay`), Preiskalkulation in `pricing.ts`.

---

### 📅 24.08.2026 – Spezifikation V1, V2 & Release v0.2.0 bis v0.3.5

* **24.08.2026 09:49–11:17 – Spezifikation V2 & Festzelt-Spezialfunktionen**
  * **Tablett-Limitierung & Bon-Splitting (Tray Capacity)** `[✅ UMGESETZT]`:
    * *Weshalb:* Kellner können nur 6–8 Getränke gleichzeitig tragen; Großbestellungen (z. B. 14x Bier) müssen getrennt gedruckt werden (`*** BON 1 von 3 ***`).
    * *Wie:* `ticket-splitter.ts` teilt Positionen nach `PrintGroup.maxItemsPerTicket` auf.
  * **Storno-Workflow mit Stornogrund & rotem Küchen-Stornobon** `[✅ UMGESETZT]`:
    * *Weshalb:* Fehlbestellungen in der Hektik müssen PIN-gesichert abgebrochen werden, damit die Küche die Zubereitung stoppt (`*** STORNO-BON - NICHT ZUBEREITEN ***`).
    * *Wie:* `POST /api/orders/[id]/void`, Setzen von `isCancelled: true` und Druckauslösung.
  * **Gang-Steuerung & HOLD** `[✅ UMGESETZT]`:
    * *Weshalb:* Zeitversetzte Zubereitung (Gang 1–3) und manueller Postenabruf für die Küche.
    * *Wie:* `OrderItem.courseNumber`, `isHold: true` blockiert den Küchenausdruck bis zum Release via `POST /api/orders/[id]/release`.
  * **DATEV & DSFinV-K Export-Engine** `[✅ UMGESETZT]`:
    * *Weshalb:* KassenSichV- und GoBD-Konformität bei Steuerprüfungen.
    * *Wie:* Generatoren `datev-exporter.ts` (ASCII-CSV) und `dsfinvk-exporter.ts` (ZIP mit `bonkopf.csv`, `bonpos.csv`, etc.).
  * **Jugendschutz-Hinweis mit dynamischem Mindestgeburtsdatum** `[✅ UMGESETZT]`:
    * *Weshalb:* Das Personal soll das Geburtsdatum bei 16er-/18er-Artikeln direkt mit dem Ausweis abgleichen können, ohne im Kopf zu rechnen.
    * *Wie:* `calculateMinBirthdate()` in `compliance.ts`, Anzeige von `<ShieldAlert />` am Handheld.
  * **Gäste-Self-Service QR (BYOD) & SB-Kiosk** `[✅ UMGESETZT]`:
    * *Weshalb:* Entlastung des Personals durch Tisch-Selbstbestellung am Smartphone oder Steh-Terminals.
    * *Wie:* Routen `/guest/table/[tableNumber]` mit QR-Token und `/kiosk` mit 60-Sekunden-Inaktivitäts-Reset.
  * **Fass- & Schanküberwachung (TapLine)** `[✅ UMGESETZT]`:
    * *Weshalb:* Überwachung des Füllstands von Bierfässern und Erfassung von Schankverlusten (Schaum).
    * *Wie:* `TapLine`-Modell mit Restvolumen und `lossPercentage`.
* **2026-08-24 15:46:49 +0200** – *release: v0.3.0 - Waiter split view, live device sync, PIN protection for all stations*
  * **Status:** `[✅ UMGESETZT]`
  * **Weshalb:** 4-Stufen Bezahlflow (Split → Zahlart → Ziffernblock → Belegabschluss) zur maximalen Fehlerminimierung im Hektikbetrieb.
  * **Wie:** Smaragdgrün (`#10B981`) für Bar, Cyan (`#3B82F6`) für SumUp, Rot (`#DC2626`) für Sparkasse/S-POS, Violett (`#7C3AED`) für ZVT.

---

### 📅 25.08.2026 – Architektur- und Sicherheitsrevision (v0.3.6 bis v0.3.8)

* **2026-08-25 09:23:07 +0200** – *feat: Implement recommendations - auth middleware, session cookies, persistent queue, outbox*
  * **Entdeckung & Fix der Socket-Echtzeit-Blockade (`global.io = io`)** `[✅ UMGESETZT]`:
    * *Weshalb:* Alle 96 serverseitigen WebSocket-Events (`order:new`, KDS-Updates) liefen still ins Leere, weil `global.io` nie zugewiesen wurde.
    * *Wie:* Zuweisung in `server.js:43`. Behebt sofort KDS-Updates, Live-Druckmonitor und Team-Funk.
  * **Serverseitige Authentifizierung via Middleware & JWT-Cookies** `[✅ UMGESETZT]`:
    * *Weshalb:* Bisherige PIN-Prüfung war rein clientseitig; alle API-Routen waren ungeschützt im LAN erreichbar.
    * *Wie:* Einführung von `jose`-basierten JWT-Sessions in `src/middleware.ts` und `src/lib/api-guard.ts`.
  * **Transaktions-Klammerung im Bestell- und Kassiervorgang** `[✅ UMGESETZT]`:
    * *Weshalb:* Parallele Bestellungen führten zu doppelten Sequenznummern und Bestands-Inkonsistenzen.
    * *Wie:* Kapselung aller Schreiboperationen in atomare `prisma.$transaction([])`.
  * **Lagerposten mit geteiltem Verbrauch (StockUnit & StockConsumption)** `[✅ UMGESETZT]`:
    * *Weshalb:* Mehrere Artikel (z. B. Steaksemmel, Bratwurstsemmel) greifen auf denselben Vorrat („Brötchen“) zu.
    * *Wie:* Relationale Modelle `StockUnit` und `StockConsumption` mit automatischer Gesamtsperre bei Nullbestand.
* **2026-08-25 21:08:00 +0200** – *fix: Release v0.3.8 - Session-Login repariert*
  * **Status:** `[✅ UMGESETZT]`
  * **Weshalb:** Nach der Auth-Einführung geriet die Admin-Navigation in einen Redirect-Loop zur Startseite.
  * **Wie:** Korrektur der Hook-Reihenfolge in `PinModal` und Session-Persistenz im Cookie.

---

### 📅 26.08.2026 – UI-Refinement, Schichtabrechnung & Resilienz (v0.4.0 bis v0.4.8)

* **2026-08-26 08:57:52 +0200** – *release: v0.4.0 - Theme Klassisch & Formular-Modularisierung*
  * **Status:** `[✅ UMGESETZT]`
  * **Weshalb:** Bereitstellung eines ruhigen, kontrastoptimierten hellen Themes für Außenbereiche bei direkter Sonneneinstrahlung.
  * **Wie:** Theme-Engine mit CSS-Variablen in `tailwind.config.js` (`#202124` Text, Pastell-Akzente).
* **2026-08-26 14:07:34 +0200** – *feat: Release v0.4.1 - PIN hardening, multi-provider payment, recipe inventory, change calculator*
  * **Status:** `[✅ UMGESETZT]`
  * **Weshalb:** Blindzählung beim Kassensturz (Kellner sieht Soll-Betrag nicht vorab) verhindert Manipulationen.
  * **Wie:** 5-Stufen-Assistent `/admin/settle` (Bedienung → Zählen → Soll/Ist-Vergleich → Differenzprotokoll → Unterschriftenbon).
* **2026-08-26 18:24:14 +0200** – *feat: 10-step font size sliders, table designer, bump to v0.4.4*
  * **Status:** `[✅ UMGESETZT]`
  * **Weshalb:** Unterschiedliche Thermodrucker und Papierbreiten (58mm/80mm) benötigen anpassbare Schriftgrößen; Festzelte benötigen Gänge/Laufwege im Tischplan.
  * **Wie:** Schieberegler im Admin für Fontgrößen (`receiptItemFontSize` 1–10), Gang-Definitionen (`aisles` im Tischplan-Editor).

---

### 📅 27.08.2026 – Sicherheits-Härtung & In-App HA-Pairing (v0.4.9 bis v0.4.11)

* **2026-08-27 13:54:10 +0200** – *Release v0.4.10: Sicherheits-Härtung (M1 bis M6)*
  * **M1: Preis-Autorität bei `/api/payments`** `[✅ UMGESETZT]`:
    * *Weshalb:* Schutz vor manipulierten Client-Preisen. Preise und Steuern werden zwingend aus den DB-Positionen überschrieben.
    * *Wie:* `computeCheckout` liest `orderItems` direkt aus der DB; Diskrepanzen > 1 Cent lösen `409 PRICE_MISMATCH` aus.
  * **M1: Payment-Callback Zustandsmaschine (`REPORTED_SUCCESS`)** `[✅ UMGESETZT]`:
    * *Weshalb:* Deep-Link-Apps (SumUp, VR-Pay, Zettle) können beim App-Rücksprung URL-Parameter fälschen.
    * *Wie:* Status `REPORTED_SUCCESS` verlangt Bestätigungstap des Personals; Stripe wird serverseitig via API verifiziert.
  * **M2: Schicht-Rate-Limiter & Account-Lockout** `[✅ UMGESETZT]`:
    * *Weshalb:* Brute-Force-Schutz gegen PIN-Erraten im Fest-WLAN.
    * *Wie:* Kaskadierender Rate-Limiter in `rate-limiter.ts` (IP-basiert, Stations-Lockout, globaler Deckel).
  * **M3: Waiter-PINs gehasht via PBKDF2** `[✅ UMGESETZT]`:
    * *Weshalb:* Keine Klartext-PINs mehr in der Datenbank.
    * *Wie:* `hashPin()` mit PBKDF2/Salt und automatischer Lazy-Migration beim ersten Login.
  * **M4: Drucker-SSRF-Schranke & ESC/POS-Sanitizer** `[✅ UMGESETZT]`:
    * *Weshalb:* Verhindert Netzwerk-Scanning externer Netze über das Drucker-Interface und schützt vor ESC/POS-Steuerzeichen-Injektionen.
    * *Wie:* IP-Validierung (nur RFC 1918 / Loopback) und Steuerzeichenfilter (<0x20) in `escpos-builder.ts`.
  * **M6: Schutz vor Datenverlust beim Start** `[✅ UMGESETZT]`:
    * *Weshalb:* `prisma db push --accept-data-loss` hat bei Schema-Änderungen stillschweigend Tabellen geleert.
    * *Wie:* Entfernung des Flags aus allen Batch- und Shell-Skripten; harter Stopp mit Hinweis auf `OPENBON_ALLOW_DATA_LOSS=1`.
* **2026-08-27 15:56:07 +0200** – *Release v0.4.11: In-App HA-Pairing & Resilienz-Ausbau*
  * **In-App HA-Pairing-Assistent** `[✅ UMGESETZT]`:
    * *Weshalb:* Terminalfreie Kopplung zweier Raspberry Pis für Ausfallsicherheit im Festzelt.
    * *Wie:* 6-stelliger Bestätigungscode (TTL 10 min, timing-safe) generiert ein gemeinsames kryptografisches Sync-Secret (`src/lib/ha/ha-pairing.ts`).
  * **Karten-Callback HMAC-Signatur** `[✅ UMGESETZT]`:
    * *Weshalb:* Schutz der Rücksprung-Route gegen SessionStorage-Manipulationen.
    * *Wie:* HMAC-SHA256 Tokengenerierung und Verifikation in `/api/payments/card/verify`.
  * **Offline-Outbox für Zahlungen verdrahtet** `[✅ UMGESETZT]`:
    * *Weshalb:* Zahlungen können nun auch bei Verbindungsaussetzern lokal in IndexedDB gepuffert und nachgesendet werden.
    * *Wie:* Integration des Typs `PAYMENT` in `outbox.ts` und Anbindung an `/waiter/payment`.
  * **Entfernung toter UI-Codes für Trinkgeld/Rabatt** `[✅ UMGESETZT]`:
    * *Weshalb:* Im Waiter-Payment-Screen existierten unverbundene UI-Zustände, die Verwirrung stifteten.
    * *Wie:* Bereinigung der toten States; Backend-API bleibt abwärtskompatibel.

---

### 📅 28.08.2026 – Release v0.4.12: Ziffernblock-Harmonisierung (0,01€ bis 200€), E-Bon Cloudflare/Netcup & NFC-Transfer

* **2026-08-28 09:30:00 +0200** – *Release v0.4.12: Unified Cash Numpad (0.01€-200€), Cloudflare/Netcup E-Bon Manual & NFC E-Bon Transfer*
  * **Status:** `[✅ UMGESETZT]`
  * **Weshalb:** Harmonisierung der Kassen-Ziffernblöcke und lückenlose Stückelung (0,01 € bis 200 €); ausführliche Schritt-für-Schritt-Anleitung für die Internet-Bereitstellung von E-Bons via Cloudflare Tunnels (Netcup-Domain) und Netcup Webhosting Nginx/PHP Reverse-Proxy mit DynDNS; Implementierung der kontaktlosen E-Bon-Übertragung per NFC für Kellner-Handhelds und Bonkasse.
  * **Wie:**
    1. **Ziffernblock & Stückelung**:
       - `pricing.ts`: Erweiterung von `CASH_NOTE_VALUES` und `CASH_QUICK_NOTES` um den 200 € Schein.
       - `change-calculator.tsx`: Scheine-Schnellwahl (5€, 10€, 20€, 50€, 100€, 200€ + Passend), Münzen-Schnellwahl (1ct bis 2€) und 3x4 Touch-Ziffernblock (`0–9`, `00`, `C`, `,`).
       - `/waiter/payment`: Entfernung des redundanten rechten 4x3 Keypads; zentriertes Layout mit `ChangeCalculator`.
       - `/pos`: Saubere Integration des erweiterten `ChangeCalculator` im Warenkorb-Checkout.
    2. **E-Bon Online-Handbuch & Dokumentation**:
       - Neuer Leitfaden [`docs/EBON_ONLINE_ANLEITUNG.md`](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/docs/EBON_ONLINE_ANLEITUNG.md) mit Anleitungen für Cloudflare Tunnels (Zero Trust, `cloudflared`-Dienst für Linux/RPi/Windows), Netcup DynDNS API, NGINX-Direktiven und PHP-Proxy Fallback sowie NFC-Best-Practices.
    3. **NFC-Engine & Prisma**:
       - Erweiterung von `EventConfig` um `enableNfc`, `enableNfcWaiter` und `enableNfcPos` in Prisma Schema, Domain-Types, Whitelist und Public-Config Route.
       - Toggles für NFC-Aktivierung und selektive Freigabe auf Kellner-Smartphones und/oder Bonkasse in `GeneralTab.tsx` und `ReceiptTab.tsx`.
    4. **Kellneransicht (`/waiter/payment`)**:
       - E-Bon Button ist nur sichtbar/aktiv, wenn Online- oder NFC-Option im Admin aktiviert ist.
       - Wenn beides aktiv: Umschaltbarer Dialog mit Reitern für **QR-Code anzeigen** und **NFC Beamen**.
       - Web NFC API (`NDEFReader.write`) mit Radar-Puls-Animation, akustischer Rückmeldung und Fehlerbehandlung.
    5. **Bonkasse (`/pos`)**:
       - Integration von NFC-Beamen im E-Bon-Modal mit Umschaltung zwischen QR-Code und direktem NFC-Sendevorgang.

---

## Aktueller Umsetzungsstand & Reality-Check

| Bereich / Komponente | Vorgabe / Spezifikation | Echter Code-Befund | Bewertung |
|---|---|---|---|
| **Echtzeit WebSocket** | Live-KDS, Druckverlauf, Tischstatus | `global.io = io` in `server.js` aktiv; Events in API-Routen verdrahtet. | `[✅ UMGESETZT]` |
| **API-Authentifizierung** | Keine unbefugten API-Aufrufe | `api-guard.ts` sichert 52 von 59 Routen mit `requireApiAuth` / `requireAdmin`. Public-Routen isoliert. | `[✅ UMGESETZT]` |
| **Preis-Integrität** | Schutz vor Manipulation | `/api/payments/route.ts` lädt `orderItems` aus DB und validiert Summen serverseitig. | `[✅ UMGESETZT]` |
| **HA-Pairing & Fencing** | Ausfallsicher ohne Split-Brain | `HaLease` Tabelle mit 10s TTL, In-App-Pairing mit 6-stelligem Code in `GeneralTab.tsx`. | `[✅ UMGESETZT]` |
| **Geteilte Bestände** | Mehrere Artikel teilen eine Zutat | `StockUnit` & `StockConsumption` in Prisma + `src/lib/stock.ts` Transaktionen. | `[✅ UMGESETZT]` |
| **Offline-Outbox** | Nahtloses Weiterarbeiten bei Netzausfall | IndexedDB Outbox mit Idempotenz-Keys; `sw.js` liefert gecachte App-Shell. | `[✅ UMGESETZT]` |
| **DATEV / DSFinV-K** | Prüfer-Export für Finanzamt | Vollständige Generatoren in `src/lib/` mit ZIP-Download im Adminbereich. | `[✅ UMGESETZT]` |
| **Float vs. Int** | Cent-Genauigkeit | Schema nutzt `Float` (z. B. `totalGross Float`). Berechnungen laufen in Cents, DB-Spalten sind noch Floats. | `[⚠️ TEILWEISE]` |
| **Refund-API** | Kartenerstattung per WebUI | Karten-Erstattungen erfolgen direkt am Terminal; keine dedizierte Refund-Route. | `[⏳ OFFEN]` |

---

## Lagerposten & geteilter Verbrauch (Brötchen-Prinzip)

### Problemstellung
Im Festbetrieb greifen oft mehrere eigenständige Verkaufsartikel auf dieselbe Basiszutat zu:
- **Artikel A:** *„Steak im Brötchen“* (Preis: z. B. 6,50 €)
- **Artikel B:** *„Grillwurst im Brötchen“* (Preis: z. B. 4,50 €)
- **Artikel C:** *„Portion Leberkäse mit Brötchen“* (Preis: z. B. 5,00 €)

Wenn der Vorrat an Brötchen aufgebraucht ist, dürfen **alle drei Artikel** nicht mehr verkauft werden können.

### Wie erfolgt die Zuweisung in der Benutzeroberfläche (UI)?

1. **Navigation:**
   - Im Admin-Menü (oben rechts) navigieren zu: **Sortiment ➔ Lagerposten & Verbrauch** (URL: `/admin/stock-units`).
2. **Schritt 1: Den Lagerposten „Brötchen“ anlegen:**
   - Klick auf den blauen Button **„+ Lagerposten anlegen“** oben rechts.
   - **Name:** `Brötchen` (oder `Semmeln`)
   - **Einheit:** `Stück`
   - **Anfangsbestand / Aktueller Bestand:** z. B. `200`
   - **Warnung ab:** z. B. `20` (löst bei <20 Stück eine visuelle Warnung im Admin aus)
   - **Checkbox:** `[x] Artikel sperren, wenn aufgebraucht` (aktivieren!)
   - Klick auf **„Speichern“**.
3. **Schritt 2: Verbrauch den Artikeln zuordnen:**
   - In der Liste erscheint die neue Kachel **„Brötchen“** mit Füllstandsbalken.
   - Klick auf den Button **„🔗 Verbrauch zuordnen“** auf der Kachel.
   - Es öffnet sich der Dialog **„Verbrauch von ‚Brötchen‘“** mit einer Suchleiste und allen Artikeln des Sortiments.
   - Im Suchfeld `Steak` eingeben ➔ Im Eingabefeld neben *„Steak im Brötchen“* die Zahl **`1`** eintragen.
   - Im Suchfeld `Grillwurst` eingeben ➔ Im Eingabefeld neben *„Grillwurst im Brötchen“* die Zahl **`1`** eintragen.
   - *(Hinweis: Eingaben werden beim Verlassen des Feldes per `onBlur` vollautomatisch in der Datenbank gespeichert).*
   - Klick auf **„Fertig“**.

### Was passiert im Live-Betrieb?
- **Automatischer Abbruch beim Bestellen:** Sobald eine Kellnerin oder Thekenkraft 1x *„Steak im Brötchen“* bucht, bucht `src/lib/stock.ts` atomar in derselben Transaktion **1 Stück** vom Lagerposten *„Brötchen“* ab.
- **Gemeinsame Ausverkauft-Sperre (`isSoldOut`):** Erreicht der Vorrat *„Brötchen“* `0`, setzt das System automatisch **sowohl das Steak als auch die Grillwurst** auf ausverkauft. Auf den Smartphones und Kassenkacheln wird der Artikel sofort rot gesperrt.
- **Echtzeit-Nachlegen:** Liefert die Bäckerei Nachschub, tippt der Schichtleiter in `/admin/stock-units` einfach auf **`+50`** ➔ Beide Artikel sind augenblicklich auf allen Geräten im WLAN wieder bestellbar!

---

## Backlog & Zukünftige Erweiterungen

1. **Ganzzahlige Cent-Beträge in der Datenbank (Integer Cents):**
   * *Ziel:* `totalGrossCents Int` zur Vermeidung von Floating-Point-Rundungsdifferenzen bei großen Datenbeständen.
2. **In-App Kartenerstattungs-Route (Refund):**
   * *Ziel:* `POST /api/payments/[id]/refund` mit Anbindung an ZVT/Stripe-Refund APIs.
3. **Echte Betragsteilung („50 € jetzt, Rest später“):**
   * *Ziel:* Modus zur freien Betragsteilung unabhängig von Artikeln.
4. **Erweiterte Offline-Precache-Routen:**
   * *Ziel:* Aufnahme von `/kiosk` und `/customer-display` in den Service-Worker-Precache.
