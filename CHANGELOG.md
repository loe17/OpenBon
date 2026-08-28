# OpenBon – Master-Changelog & Systemgedächtnis

> **Wichtiger Hinweis für Entwickler & KI-Assistenten:**  
> Dieses Dokument fungiert als das zentrale **Systemgedächtnis** von OpenBon. Es dokumentiert alle Spezifikationen, Architektur- und Sicherheitsentscheidungen, Bugfixes und den aktuellen Umsetzungsgrad.  
> **Pflicht-Regel:** Vor jeder Änderung am Code muss dieses Dokument konsultiert werden. Nach jeder Änderung ist dieses Dokument chronologisch mit Datum, Uhrzeit, Begründung (Weshalb) und technischer Umsetzung (Wie) zu erweitern!

---

## 1. Vollständiger System- & Feature-Katalog (Ist-Stand)

| Bereich / Modul | Implementierte Funktionen | Technische Umsetzung & Architektur | Status |
|---|---|---|---|
| **Admin Leitstand & Dashboard (`/admin`)** | Live-Umsatz, Stunden-Forecast, Bon-Historie, Kassenbuch, Z-Bons, Fiskal-Export (DSFinV-K, DATEV, TSE-Logs), Geräte- & Akkumonitor, HA-Pairing, Event-Profile Snapshots. | Next.js 14 App Router, Recharts, `datev-exporter.ts`, `dsfinvk-exporter.ts`, `ha-pairing.ts`, `action-logger.ts`. | `[✓]` |
| **Kellner-Mobilteil (`/waiter`)** | Tischübersicht (Tischplan mit Gängen & Laufwegen), Schnellbestellung, 1-Klick-Sonderwünsche, Gang-Steuerung (HOLD/Release), Rechnungs-Splitting (Teilzahlung), Rückpfand-Verrechnung, Ziffernblock (0,01 € bis 200 €), digitaler E-Bon & NFC, Tischtransfer & Tischzusammenlegung (`TRANSFER`/`MERGE`), Schichtabrechnung (`/waiter/settle`), X-Bon Zwischenstand. | Touch-optimierte PWA, State Machine (SPLIT -> METHOD -> CASH/CARD -> DONE), Web NFC API (`NDEFReader`), IndexedDB Outbox Fallback. | `[✓]` |
| **Bonkasse / Theke (`/pos`)** | High-Speed Kachelverkauf, 3 Modi (Direktverkauf, Wertmarke, Wertmarke + Gegenbon mit Abholnummer), automatische Kassenladen-Öffnung via RJ11, Wechselgeld-Rechner (0,01 € bis 200 €), digitaler E-Bon QR-Code & NFC. | Touch-Target Grid, SubCategory-Icons, `escpos-builder.ts` Drawer-Kick, Barcode/QR-Generierung via `qrcode`. | `[✓]` |
| **Küchenmonitor KDS (`/kitchen`)** | Live-Küchenbons abhaken, Dringlichkeits-Ampel (Grün/Gelb/Rot bei >10 min), Rückstandszähler in Echtzeit, akustischer Gong, Stationen-Filter (Küche, Schenke). | Socket.IO Client mit Auto-Reconnect, Web Audio API Gong, optimistic UI Updates. | `[✓]` |
| **Gäste-Self-Service (`/guest/table/[id]`)** | Kontaktlose Tisch-Selbstbestellung am Smartphone des Gastes ohne App-Download. | QR-Token-Verifikation, Rate-Limiting, Live-Order-Einspeisung. | `[✓]` |
| **SB-Kiosk Terminal (`/kiosk`)** | Autarkes Stand-Tablet für Gäste-Bestellungen mit 60-Sekunden-Inaktivitäts-Reset. | Fullscreen Touch-Katalog, Kiosk-Sicherheitsschranke. | `[✓]` |
| **Digitaler Beleg E-Bon (`/receipt/[code]`)** | Papierloser Kassenbeleg nach § 33 KassenSichV. Bereitstellung via QR-Code oder NFC-Übertragung. Online-Hosting via Cloudflare Tunnel oder Netcup Webhosting DynDNS / NGINX Proxy. | HMAC-SHA256 Beleg-Hash (`EBON-XXXX`), Responsive Beleg-Webansicht, detaillierte Online-Anleitung in `docs/EBON_ONLINE_ANLEITUNG.md`. | `[✓]` |
| **Druckersystem & ESC/POS Spooler** | Multi-Drucker-Routing (Küche, Schenke, Kasse, Gürteldrucker), Netzwerk (TCP/IP), USB/Seriell, Virtueller Druckmonitor (`/virtual-printer`), automatisches Failover auf Ersatzdrucker, Tablett-Limitierung (`ticket-splitter.ts`), Storno-Ausdrucke. | `network-spooler.ts`, `escpos-builder.ts`, `PrintJob` Persistenz in SQLite, SSRF-Schranke (nur RFC 1918 / Loopback). | `[✓]` |
| **Zahlung & Multi-Provider** | Bargeld-Rechencenter mit vollständiger Stückelung, ZVT-Terminal (LAN TCP/IP), SumUp Deep-Link, VR-Pay Me Deep-Link, Sparkasse S-POS Deep-Link, Zettle Deep-Link, Stripe Cloud QR mit Webhook/API-Verifikation. | `payment-service.ts`, `pricing.ts`, serverseitige Preis-Autorität, signierte Callback-Verifikation (`REPORTED_SUCCESS`). | `[!] (Ungetestet)` *(Schnittstellen implementiert; Live-Betrieb mit echten physischen Terminals noch ungetestet)* |
| **Warenwirtschaft & Lager** | Geteilte Lagerposten (Brötchen-Prinzip: mehrere Artikel greifen auf dieselbe Zutat zu), Meldebestands-Warnung, automatische Rezept-Abbuchung, Fass-/Schanküberwachung (`TapLine`). | Relationale Modelle `StockUnit` & `StockConsumption`, atomare DB-Transaktionen in `stock.ts`. | `[✓]` |
| **Preise & Rabatte** | Zeitgesteuerte Aktionspreise & Happy-Hour (mehrere Zeitfenster & Wochentage), Pfandstufen, Rabatt- und Bewirtungsbelege. | `pricing.ts`, `happyHourRules` JSON-Struktur, Preisfindungs-Engine. | `[✓]` |
| **Hochverfügbarkeit & Ausfallsicherheit** | 2-Knoten Active/Passive Failover (HA-Pairing mit 6-stelligem In-App Bestätigungscode), Split-Brain Fencing mit 10s Lease-TTL, Litestream WAL-Replikation auf USB-Stick (RPO < 1s), Offline-First PWA mit Client-Outbox und Idempotenz-Schlüsseln. | `ha-service.ts`, `ha-pairing.ts`, `outbox.ts`, SQLite WAL-Modus, `litestream.yml`. | `[!] (Ungetestet)` *(Failover- & Sync-Logik implementiert; Stresstest mit zwei autonomen Servern im LAN noch ungetestet)* |
| **Sicherheit & Härtung** | PBKDF2-PIN-Hashing (100.000 Runden mit individuellem Salt), signierte JWT-Sessions (`api-guard.ts`), CSRF-Origin-Check, Schicht-Rate-Limiter, Schutz vor versehentlichem Datenverlust (`OPENBON_ALLOW_DATA_LOSS=1`). | `auth-pin.ts`, `jose` JWT, `rate-limiter.ts`, Non-Root Docker Container. | `[✓]` |

---

## 2. Status-Legende
- `[✓]` = Vollständig im Code implementiert, verdrahtet und verifiziert.
- `[!]` = Funktional vorhanden, aber mit Einschränkungen, manuellen Schritten oder offenen Restpunkten.
- `[-]` = Spezifiziert oder geplant, jedoch noch nicht umgesetzt bzw. im Backlog.

---

## 3. Chronologische Versions- und Änderungshistorie

### [STAND: 21.08.2026] – Ursprung & v0.1.0 bis v1.3.0

* **2026-08-21 20:43:11 +0200** – *feat: Complete modern POS system with offline LAN, high availability, KDS & ESC/POS*
  * **Status:** `[✓]`
  * **Weshalb:** Ein plattformunabhängiges, netzwerk-autarkes Kassensystem für Vereinsfeste und Gastronomie ohne Cloud-/Internet-Zwang.
  * **Wie:** Next.js 14 App Router, TypeScript, Prisma mit SQLite (WAL-Modus), Socket.IO WebSocket-Server in `server.js`, Tailwind CSS, Radix UI Primitives.
* **2026-08-21 21:11:47 +0200** – *feat: Rebrand to OpenBon, clean emojis to SVGs, PIN protection, QR join center*
  * **Status:** `[✓]`
  * **Weshalb:** Trennung der Rollen Admin (`1234`), Kasse (`1111`), Küche (`2222`) und Kellner (`3333`). Strikte Beseitigung aller Unicode-Emojis zugunsten professioneller Lucide-SVG-Vektorgrafiken.
  * **Wie:** `EventConfig`-Modell, `PinModal`-Komponente, SVG-Renderer `SubCategoryIcon`.
* **2026-08-21 21:50:52 +0200** – *feat: mDNS openbon.local support, Admin Command Center & predictive forecasting*
  * **Status:** `[✓]`
  * **Weshalb:** Zero-Config-Netzwerkzugriff für Helfer (`http://openbon.local:3000`) ohne IP-Eingabe; Live-Umsatzüberwachung.
  * **Wie:** Multicast-DNS Responder auf Port 5353, Recharts Dashboard.
* **2026-08-21 22:11:35 +0200** – *feat: VR-Pay Me, surcharges, waiter hourly performance & autostart*
  * **Status:** `[✓]`
  * **Weshalb:** Mobile Kartenzahlung für Volks- und Raiffeisenbanken und flexible Aufschläge (Pfand, Nachtzuschlag).
  * **Wie:** Custom-Scheme Deep Link Handler (`vrpayme://pay`), Preiskalkulation in `pricing.ts`.

---

### [STAND: 24.08.2026] – Spezifikation V1, V2 & Release v0.2.0 bis v0.3.5

* **24.08.2026 09:49–11:17 – Spezifikation V2 & Festzelt-Spezialfunktionen**
  * **Tablett-Limitierung & Bon-Splitting (Tray Capacity)** `[✓]`:
    * *Weshalb:* Kellner können nur 6–8 Getränke gleichzeitig tragen; Großbestellungen (z. B. 14x Bier) müssen getrennt gedruckt werden (`*** BON 1 von 3 ***`).
    * *Wie:* `ticket-splitter.ts` teilt Positionen nach `PrintGroup.maxItemsPerTicket` auf.
  * **Storno-Workflow mit Stornogrund & rotem Küchen-Stornobon** `[✓]`:
    * *Weshalb:* Fehlbestellungen in der Hektik müssen PIN-gesichert abgebrochen werden, damit die Küche die Zubereitung stoppt (`*** STORNO-BON - NICHT ZUBEREITEN ***`).
    * *Wie:* `POST /api/orders/[id]/void`, Setzen von `isCancelled: true` und Druckauslösung.
  * **Gang-Steuerung & HOLD** `[✓]`:
    * *Weshalb:* Zeitversetzte Zubereitung (Gang 1–3) und manueller Postenabruf für die Küche.
    * *Wie:* `OrderItem.courseNumber`, `isHold: true` blockiert den Küchenausdruck bis zum Release via `POST /api/orders/[id]/release`.
  * **DATEV & DSFinV-K Export-Engine** `[✓]`:
    * *Weshalb:* KassenSichV- und GoBD-Konformität bei Steuerprüfungen.
    * *Wie:* Generatoren `datev-exporter.ts` (ASCII-CSV) und `dsfinvk-exporter.ts` (ZIP mit `bonkopf.csv`, `bonpos.csv`, etc.).
  * **Jugendschutz-Hinweis mit dynamischem Mindestgeburtsdatum** `[✓]`:
    * *Weshalb:* Das Personal soll das Geburtsdatum bei 16er-/18er-Artikeln direkt mit dem Ausweis abgleichen können, ohne im Kopf zu rechnen.
    * *Wie:* `calculateMinBirthdate()` in `compliance.ts`, Anzeige von `<ShieldAlert />` am Handheld.
  * **Gäste-Self-Service QR (BYOD) & SB-Kiosk** `[✓]`:
    * *Weshalb:* Entlastung des Personals durch Tisch-Selbstbestellung am Smartphone oder Steh-Terminals.
    * *Wie:* Routen `/guest/table/[tableNumber]` mit QR-Token und `/kiosk` mit 60-Sekunden-Inaktivitäts-Reset.
  * **Fass- & Schanküberwachung (TapLine)** `[✓]`:
    * *Weshalb:* Überwachung des Füllstands von Bierfässern und Erfassung von Schankverlusten (Schaum).
    * *Wie:* `TapLine`-Modell mit Restvolumen und `lossPercentage`.
* **2026-08-24 15:46:49 +0200** – *release: v0.3.0 - Waiter split view, live device sync, PIN protection for all stations*
  * **Status:** `[✓]`
  * **Weshalb:** 4-Stufen Bezahlflow (Split -> Zahlart -> Ziffernblock -> Belegabschluss) zur maximalen Fehlerminimierung im Hektikbetrieb.
  * **Wie:** Smaragdgrün (`#10B981`) für Bar, Cyan (`#3B82F6`) für SumUp, Rot (`#DC2626`) für Sparkasse/S-POS, Violett (`#7C3AED`) für ZVT.

---

### [STAND: 25.08.2026] – Architektur- und Sicherheitsrevision (v0.3.6 bis v0.3.8)

* **2026-08-25 09:23:07 +0200** – *feat: Implement recommendations - auth middleware, session cookies, persistent queue, outbox*
  * **Entdeckung & Fix der Socket-Echtzeit-Blockade (`global.io = io`)** `[✓]`:
    * *Weshalb:* Alle 96 serverseitigen WebSocket-Events (`order:new`, KDS-Updates) liefen still ins Leere, weil `global.io` nie zugewiesen wurde.
    * *Wie:* Zuweisung in `server.js:43`. Behebt sofort KDS-Updates, Live-Druckmonitor und Team-Funk.
  * **Serverseitige Authentifizierung via Middleware & JWT-Cookies** `[✓]`:
    * *Weshalb:* Bisherige PIN-Prüfung war rein clientseitig; alle API-Routen waren ungeschützt im LAN erreichbar.
    * *Wie:* Einführung von `jose`-basierten JWT-Sessions in `src/middleware.ts` und `src/lib/api-guard.ts`.
  * **Transaktions-Klammerung im Bestell- und Kassiervorgang** `[✓]`:
    * *Weshalb:* Parallele Bestellungen führten zu doppelten Sequenznummern und Bestands-Inkonsistenzen.
    * *Wie:* Kapselung aller Schreiboperationen in atomare `prisma.$transaction([])`.
  * **Lagerposten mit geteiltem Verbrauch (StockUnit & StockConsumption)** `[✓]`:
    * *Weshalb:* Mehrere Artikel (z. B. Steaksemmel, Bratwurstsemmel) greifen auf denselben Vorrat ("Brötchen") zu.
    * *Wie:* Relationale Modelle `StockUnit` und `StockConsumption` mit automatischer Gesamtsperre bei Nullbestand.
* **2026-08-25 21:08:00 +0200** – *fix: Release v0.3.8 - Session-Login repariert*
  * **Status:** `[✓]`
  * **Weshalb:* Nach der Auth-Einführung geriet die Admin-Navigation in einen Redirect-Loop zur Startseite.
  * **Wie:** Korrektur der Hook-Reihenfolge in `PinModal` und Session-Persistenz im Cookie.

---

### [STAND: 26.08.2026] – UI-Refinement, Schichtabrechnung & Resilienz (v0.4.0 bis v0.4.8)

* **2026-08-26 08:57:52 +0200** – *release: v0.4.0 - Theme Klassisch & Formular-Modularisierung*
  * **Status:** `[✓]`
  * **Weshalb:* Bereitstellung eines ruhigen, kontrastoptimierten hellen Themes für Außenbereiche bei direkter Sonneneinstrahlung.
  * **Wie:** Theme-Engine mit CSS-Variablen in `tailwind.config.js` (`#202124` Text, Pastell-Akzente).
* **2026-08-26 14:07:34 +0200** – *feat: Release v0.4.1 - PIN hardening, multi-provider payment, recipe inventory, change calculator*
  * **Status:** `[✓]`
  * **Weshalb:* Blindzählung beim Kassensturz (Kellner sieht Soll-Betrag nicht vorab) verhindert Manipulationen.
  * **Wie:** 5-Stufen-Assistent `/admin/settle` (Bedienung -> Zählen -> Soll/Ist-Vergleich -> Differenzprotokoll -> Unterschriftenbon).
* **2026-08-26 18:24:14 +0200** – *feat: 10-step font size sliders, table designer, bump to v0.4.4*
  * **Status:** `[✓]`
  * **Weshalb:* Unterschiedliche Thermodrucker und Papierbreiten (58mm/80mm) benötigen anpassbare Schriftgrößen; Festzelte benötigen Gänge/Laufwege im Tischplan.
  * **Wie:** Schieberegler im Admin für Fontgrößen (`receiptItemFontSize` 1–10), Gang-Definitionen (`aisles` im Tischplan-Editor).

---

### [STAND: 27.08.2026] – Sicherheits-Härtung & In-App HA-Pairing (v0.4.9 bis v0.4.11)

* **2026-08-27 13:54:10 +0200** – *Release v0.4.10: Sicherheits-Härtung (M1 bis M6)*
  * **M1: Preis-Autorität bei `/api/payments`** `[✓]`:
    * *Weshalb:* Schutz vor manipulierten Client-Preisen. Preise und Steuern werden zwingend aus den DB-Positionen überschrieben.
    * *Wie:* `computeCheckout` liest `orderItems` direkt aus der DB; Diskrepanzen > 1 Cent lösen `409 PRICE_MISMATCH` aus.
  * **M1: Payment-Callback Zustandsmaschine (`REPORTED_SUCCESS`)** `[✓]`:
    * *Weshalb:* Deep-Link-Apps (SumUp, VR-Pay, Zettle) können beim App-Rücksprung URL-Parameter fälschen.
    * *Wie:* Status `REPORTED_SUCCESS` verlangt Bestätigungstap des Personals; Stripe wird serverseitig via API verifiziert.
  * **M2: Schicht-Rate-Limiter & Account-Lockout** `[✓]`:
    * *Weshalb:* Brute-Force-Schutz gegen PIN-Erraten im Fest-WLAN.
    * *Wie:* Kaskadierender Rate-Limiter in `rate-limiter.ts` (IP-basiert, Stations-Lockout, globaler Deckel).
  * **M3: Waiter-PINs gehasht via PBKDF2** `[✓]`:
    * *Weshalb:* Keine Klartext-PINs mehr in der Datenbank.
    * *Wie:* `hashPin()` mit PBKDF2/Salt und automatischer Lazy-Migration beim ersten Login.
  * **M4: Drucker-SSRF-Schranke & ESC/POS-Sanitizer** `[✓]`:
    * *Weshalb:* Verhindert Netzwerk-Scanning externer Netze über das Drucker-Interface und schützt vor ESC/POS-Steuerzeichen-Injektionen.
    * *Wie:* IP-Validierung (nur RFC 1918 / Loopback) und Steuerzeichenfilter (<0x20) in `escpos-builder.ts`.
  * **M6: Schutz vor Datenverlust beim Start** `[✓]`:
    * *Weshalb:* `prisma db push --accept-data-loss` hat bei Schema-Änderungen stillschweigend Tabellen geleert.
    * *Wie:* Entfernung des Flags aus allen Batch- und Shell-Skripten; harter Stopp mit Hinweis auf `OPENBON_ALLOW_DATA_LOSS=1`.
* **2026-08-27 15:56:07 +0200** – *Release v0.4.11: In-App HA-Pairing & Resilienz-Ausbau*
  * **In-App HA-Pairing-Assistent** `[✓]`:
    * *Weshalb:* Terminalfreie Kopplung zweier Raspberry Pis für Ausfallsicherheit im Festzelt.
    * *Wie:* 6-stelliger Bestätigungscode (TTL 10 min, timing-safe) generiert ein gemeinsames kryptografisches Sync-Secret (`src/lib/ha/ha-pairing.ts`).
  * **Karten-Callback HMAC-Signatur** `[✓]`:
    * *Weshalb:* Schutz der Rücksprung-Route gegen SessionStorage-Manipulationen.
    * *Wie:* HMAC-SHA256 Tokengenerierung und Verifikation in `/api/payments/card/verify`.
  * **Offline-Outbox für Zahlungen verdrahtet** `[✓]`:
    * *Weshalb:* Zahlungen können nun auch bei Verbindungsaussetzern lokal in IndexedDB gepuffert und nachgesendet werden.
    * *Wie:* Integration des Typs `PAYMENT` in `outbox.ts` und Anbindung an `/waiter/payment`.
  * **Entfernung toter UI-Codes für Trinkgeld/Rabatt** `[✓]`:
    * *Weshalb:* Im Waiter-Payment-Screen existierten unverbundene UI-Zustände, die Verwirrung stifteten.
    * *Wie:* Bereinigung der toten States; Backend-API bleibt abwärtskompatibel.

---

### [STAND: 28.08.2026] – Release v0.4.12: Ziffernblock-Harmonisierung (0,01 € bis 200 €), E-Bon Cloudflare/Netcup & NFC-Transfer

* **2026-08-28 09:30:00 +0200** – *Release v0.4.12: Unified Cash Numpad (0.01€-200€), Cloudflare/Netcup E-Bon Manual & NFC E-Bon Transfer*
  * **Status:** `[✓]`
  * **Weshalb:** Harmonisierung der Kassen-Ziffernblöcke und lückenlose Stückelung (0,01 € bis 200 €); ausführliche Schritt-für-Schritt-Anleitung für die Internet-Bereitstellung von E-Bons via Cloudflare Tunnels (Netcup-Domain) und Netcup Webhosting Nginx/PHP Reverse-Proxy mit DynDNS; Implementierung der kontaktlosen E-Bon-Übertragung per NFC für Kellner-Handhelds und Bonkasse.
  * **Wie:**
    1. **Ziffernblock & Stückelung**:
       - `pricing.ts`: Erweiterung von `CASH_NOTE_VALUES` und `CASH_QUICK_NOTES` um den 200 € Schein.
       - `change-calculator.tsx`: Scheine-Schnellwahl (5€, 10€, 20€, 50€, 100€, 200€ + Passend), Münzen-Schnellwahl (1ct bis 2€) und 3x4 Touch-Ziffernblock (`0–9`, `00`, `C`, `,`).
       - `/waiter/payment`: Entfernung des redundanten rechten 4x3 Keypads; zentriertes Layout mit `ChangeCalculator`.
       - `/pos`: Saubere Integration des erweiterten `ChangeCalculator` im Warenkorb-Checkout.
    2. **E-Bon Online-Handbuch & Dokumentation**:
       - Neuer Leitfaden `docs/EBON_ONLINE_ANLEITUNG.md` mit Anleitungen für Cloudflare Tunnels (Zero Trust, `cloudflared`-Dienst für Linux/RPi/Windows), Netcup DynDNS API, NGINX-Direktiven und PHP-Proxy Fallback sowie NFC-Best-Practices.
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

---

### [STAND: 28.08.2026] – Release v0.4.13: Modern Themes, Live-Druckerwarteschlange, WCAG 2.1 Testsuite & Handheld-Optimierungen

* **2026-08-28 10:30:00 +0200** – *Release v0.4.13: 5 Modern Themes, Print Queue Spooler, WCAG 2.1 Contrast Suite, X-Bon Modal & Auto-Lock*
  * **Status:** `[✓]`
  * **Weshalb:** Ablösung des veralteten Klassik-Themes durch 5 eigenständige, hochkontrastige Themes; Bereitstellung einer interaktiven Live-Druckerwarteschlange mit Wiederholung, Umleitung und Bon-Vorschau; automatische mathematische WCAG 2.1 Kontrastvalidierung aller Stationen; schneller X-Bon Schichtzwischenstand für Bedienungen; Inaktivitäts-Auto-Lock für Handhelds; adaptive Kachel-Skalierung und USB-Gesundheitswächter.
  * **Wie:**
    1. **5 Moderne, barrierefreie Themes**:
       - `dark` (Modern Deep Slate): Eleganter Mitternachtsmodus (`#020617`).
       - `light` (Klares Tageslicht): Schneeweißer Grund (`#ffffff` / `#f8fafc`) mit sonnenlichttauglichen Kontrasten.
       - `contrast` (Festzelt High-Contrast / OLED): Pures Tiefschwarz (`#000000`) mit signalgelben 2px-Rahmen (`#eab308` / `#facc15`) für blendfreies Arbeiten im Freien.
       - `tradition` (Tradition & Verein): Warme Holz- und Bernsteintöne (`#140d07`, `#78350f`, `#b45309`) für Biergärten und Traditionsvereine.
       - `speed` (High-Speed Tresen): Kompakte Radien, scharfe Kanten (`#2563eb`) und maximale Kacheldichte.
       - Entfernung von `klassisch` und `minimal`; Anpassung von `ThemeProvider`, `globals.css`, `navbar.tsx` und `GeneralTab.tsx`.
    2. **Automatisierte WCAG 2.1 Kontrast- & Lesbarkeits-Testsuite**:
       - Neuer Test `src/__tests__/theme_contrast_validation.test.ts` (28 Tests) mit mathematischer relative-Luminanz- und Kontrastberechnung nach W3C-Standard für alle 5 Themes über alle 7 Kernstationen.
    3. **Live-Druckerwarteschlange (Print Queue Manager)**:
       - API-Route `src/app/api/printers/queue/route.ts` (GET mit Statusfiltern `ALL`, `PENDING`, `FAILED`, `PRINTED`, Statistiken; POST mit Aktionen `RETRY`, `REROUTE`, `DELETE`, `CLEAR_COMPLETED`).
       - Komponente `src/components/admin/print-queue-manager.tsx` mit Live-Statustabelle, Fehlerursachenanzeige, 1-Klick-Wiederholung, Drucker-Umleitung, formatierter Bon-Vorschau und Tab-Integration in `/admin/printers`.
    4. **Kellner-Zwischenstand (X-Bon Modal)**:
       - Schneller 1-Klick-Button in `/waiter` zur Anzeige des aktuellen Schicht-Zwischenstands (Bargeld-Soll im Geldbeutel, Gesamtumsatz Brutto, Kartenzahlungen, erhaltenes Trinkgeld, ausbezahltes Pfand) und Direktdruck via `/api/reports/x-bon`.
    5. **Auto-Lock bei Inaktivität**:
       - Konfigurierbarer Inaktivitäts-Timer (`waiterAutoLockMinutes`: 0 = Deaktiviert, 1, 2, 3, 5, 10 Minuten) in `EventConfig`, Whitelist und Public-Config; automatisches Sperren des Handheld-Displays auf den PIN-Screen bei Inaktivität.
    6. **Adaptive Kachel-Skalierung für Handhelds**:
       - Umstellung der Artikelkacheln in `/pos` und `/waiter/order` auf `grid-cols-[repeat(auto-fill,minmax(125px,1fr))]` für flüssige 2 bis 6 Spalten je nach Bildschirmbreite.
    7. **Haptisches Sound-Routing & USB-Wächter**:
       - `playCashRegisterChime()` und `playWarningBeep()` in `src/lib/audio-feedback.ts`.
       - Integrierter USB-Replikations- und Schreibbereitschafts-Check in `src/app/api/health/route.ts`.

* **28.08.2026 14:50 – Release v0.4.14 Detailverbesserungen, Font-Autarkie & Design-Härtung** `[✓]`
  * **Weshalb:** Vollständig lokaler System-Font-Stack ohne externe Google-Font-Abrufe beim Offline-Build; Bereinigung der Themes auf 4 klare Varianten (`Dunkel`, `Hell`, `Tradition`, `Kompakt`) ohne Klammerzusätze; präzise Ausrichtung des Tischplan-Designers; Freiraum-Option beim Raumplan-Druck; bereinigte PIN-Anzeige im QR-Center; homogenes Versionierungs-Branding; lückenlose 39-View Screenshot-Pipeline mit Versionierungs-Archivierung und vollständige Dokumentation der Design-Token.
  * **Wie:**
    1. **Lokaler Font-Stack & Build-Autarkie:** Umstellung in `src/app/layout.tsx` von `next/font/google` auf einen robusten, lokalen System-Font-Stack (`Plus Jakarta Sans`, `system-ui`, `sans-serif`), wodurch Builds auch ohne Internetverbindung in unter 30s übersetzt werden.
    2. **Theme-Bereinigung (4 saubere Themes):** Entfernung des `contrast`-Themes zugunsten der 4 klaren, optimierten Themes `Dunkel`, `Hell`, `Tradition` und `Kompakt`. Säuberung der Theme-Labels in der UI (Entfernung von Klammern und Zusätzen).
    3. **Tischplan-Designer Ausrichtung:** Spaltenköpfe `S1`–`Sn` und Reihenköpfe `R1`–`Rn` wurden geometrisch fest mit den Grid-Zellen synchronisiert (relative Zwischen-Buttons ohne Flex-Verzerrung).
    4. **Druckansicht Tischplan:** Checkbox `[x] Freie Tische als Freiraum darstellen` blendet leere Rasterfelder als weiße Flächen ohne Rahmen und Text aus.
    5. **QR-Code Center:** Erkennung von PBKDF2-Hashes ersetzt kryptische 100-Zeichen-Strings durch `PIN geschützt (4 Ziffern)`.
    6. **Homogene Versionsanzeige:** `v0.4.14` in der Top-Navbar wurde typografisch in `Plus Jakarta Sans` als dezent elegantes Pill-Badge integriert.
    7. **Jugendschutz-Kontrast:** Helle, kontraststarke Farbgebung für den Jugendschutz- und Allergenbalken im Light-Theme (`#f1f5f9` mit `#991b1b` / `#b45309`).
    8. **Screenshot-Archivierung & .gitignore:** Screenshots werden bei Testläufen automatisch mit Version (`v0.4.14`) und ISO-Zeitstempel nach `screenshots/alt/` archiviert; `/screenshots/` ist in `.gitignore` eingetragen.
    9. **Master-Featurekatalog & Ungetestet-Hinweise:** Vollständige Aktualisierung des Feature-Katalogs in Abschnitt 1 mit Kennzeichnung von Kartenzahlung und HA als `[!] (Ungetestet)`.

---

## 4. Theme-Spezifikation & Design-Tokens (Master-Referenz)

Um dauerhafte Konsistenz über alle Stationen und Updates hinweg zu gewährleisten, gelten folgende feste Design-Token für die 4 Themes von OpenBon:

| Theme-Eigenschaft | `Dunkel` (`dark`) | `Hell` (`light`) | `Tradition` (`tradition`) | `Kompakt` (`speed`) |
| :--- | :--- | :--- | :--- | :--- |
| **Primär-Hintergrund (`body`)** | `#020617` (Deep Slate) | `#f1f5f9` (Hellgrau/Tageslicht) | `#140d07` (Dunkles Eichenholz) | `#080c14` (Mitternachtsblau) |
| **Karten & Dialoge (`surface`)** | `#0f172a` (`slate-900`) | `#ffffff` (Reines Weiß) | `#1a1008` (Warmes Holz) | `#0f172a` (Technik-Slate) |
| **Header & Navigationsleiste** | `#0f172a` / `#020617` | `#ffffff` (mit Box-Shadow) | `#1a1008` (Border `#92400e`) | `#0d1527` (Border `#2563eb`) |
| **Schriftfarbe Primär** | `#f8fafc` (`slate-50`) | `#000000` (Tiefschwarz) | `#fffbeb` (Warmes Elfenbein) | `#ffffff` (Reinweiß) |
| **Schriftfarbe Sekundär** | `#94a3b8` (`slate-400`) | `#334155` (`slate-700`) | `#fde68a` (Bernstein-Gold) | `#94a3b8` (`slate-400`) |
| **Rahmen & Linien (`border`)** | `#334155` (`slate-700`) | `#cbd5e1` / `#94a3b8` | `#78350f` / `#b45309` | `#334155` / `#2563eb` |
| **Border-Radius Kacheln/Karten** | `1rem` (`rounded-2xl`) | `1rem` (`rounded-2xl`) | `1rem` (`rounded-2xl`) | `0.25rem` (`rounded-sm` 4px) |
| **Ziffernblock (`keypad-key`)** | `#1e293b` (Slate-800) | `#ffffff` (Weiß mit Schatten) | `#26170b` (Holz-Panel) | `#0f172a` (4px Border `#2563eb`) |
| **Einsatz-Schwerpunkt** | Gedimmtes Licht / Abend | Helles Tageslicht / Sonne | Biergarten, Festzelt & Verein | Schneller Thekenverkauf |

---

## 5. Lagerposten & geteilter Verbrauch (Brötchen-Prinzip)

Im Festbetrieb teilen sich oft mehrere Verkaufsartikel eine gemeinsame, begrenzte Zutat:
- Beispiel: **100 Brötchen** im Lager (`StockUnit`).
- Verkaufsartikel:
  - *Steak im Brötchen* (zieht 1x Brötchen ab)
  - *Grillwurst im Brötchen* (zieht 1x Brötchen ab)
  - *Käsebrötchen* (zieht 1x Brötchen ab)

### Funktionsweise in OpenBon:
1. **Lagerposten anlegen:** Unter `/admin/stock-units` wird der Posten `Brötchen` mit Anfangsbestand (z. B. `100 Stück`) und Meldebestand (z. B. `15 Stück`) definiert.
2. **Zuweisung zum Artikel:** Im Artikel-Editor (`/admin/products`) wird dem Artikel die Zutat zugewiesen:
   - Artikel *Steak im Brötchen* -> Verbrauch: `1.0` von `Brötchen`.
   - Artikel *Grillwurst im Brötchen* -> Verbrauch: `1.0` von `Brötchen`.
3. **Automatischer Abbruch bei Nullbestand:**
   - Jeder Verkauf bucht den Lagerposten atomar über `src/lib/stock.ts` ab.
   - Sobald der Vorrat `0` erreicht, werden **alle verknüpften Artikel** automatisch als `isSoldOut: true` markiert und können auf keinem Kellner-Smartphone oder Kiosk mehr bestellt werden.
4. **Meldebestand:** Erreicht der Vorrat den Meldebestand, ertönt ein akustischer Gong und ein Warnbon wird am Küchendrucker gedruckt (*"ACHTUNG: Brötchen fast leer (nur noch 15 Stück)"*).

---

## 6. Backlog & Zukünftige Erweiterungen

- `[-]` **Float zu BigInt/Cents DB-Migration**: Schema nutzt `Float` (Berechnungen laufen in Cents, DB-Spalten noch Float).
- `[-]` **Online-Tischreservierung mit Gästedaten**: Optionale Vorbestellung für Festzelttische.
- `[-]` **Gutschein-Verwaltung mit Barcode-Guthaben**: Verwaltung wiederaufladbarer Festkarten.
