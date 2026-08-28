# OpenBon - Enterprise Kassen-, Bestell- & Festmanagementsystem

OpenBon ist ein modernes, offline-fähiges und hochverfügbares Open-Source Kassen- und Bestellsystem, optimiert für Vereinsfeste, Feuerwehrfeste, Gastronomie und Großveranstaltungen.

---

## 🚀 Schnellstart & Installation

### 1. Headless 1-Klick Komplettinstallation (Raspberry Pi & Linux)
```bash
curl -fsSL https://raw.githubusercontent.com/loe17/OpenBon/master/install-headless.sh | sudo bash
```
*Richtet automatisch Node.js, Avahi-mDNS (`http://openbon.local`), SQLite mit WAL, Litestream-Replikation und den systemd-Hintergrunddienst ein.*

---

### 2. Windows (1-Klick Start)
Doppelklick auf die Datei:
```cmd
start.bat
```

---

### 3. Manueller Entwicklungsstart
```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Datenbank synchronisieren & seeden
npx prisma db push
node prisma/seed.js

# 3. Testsuite ausführen (18 Suiten, 100% grün)
npm test

# 4. Server starten
node server.js
```

---

## 📱 Stationszugriff & URLs im lokalen Netzwerk

Jedes Smartphone, Tablet, Touchscreen-Terminal oder PC kann direkt im Webbrowser geöffnet werden:

| Station | URL | Zweck & Zielgruppe |
| :--- | :--- | :--- |
| **🚀 Erststart-Assistent** | `http://openbon.local/setup` | Schnelleinrichtung: Event-Daten, PINs, Tische & Drucker |
| **👑 Admin Dashboard** | `http://openbon.local/admin/dashboard` | Live-Umsatz, Leitstand, Artikelpflege & Kassenbuch |
| **📱 Kellner-Mobilteil** | `http://openbon.local/waiter` | Offline-fähige Tischaufnahme, Gänge, Funk & Kassieren |
| **💳 Bonkasse / Theke** | `http://openbon.local/pos` | Schneller Direktverkauf, Wertmarken, ZVT/EC & Bar |
| **🖥️ SB-Kiosk Terminal** | `http://openbon.local/kiosk` | Eigenständiges Gäste-Bestellterminal |
| **👨‍🍳 Küchenmonitor (KDS)** | `http://openbon.local/kitchen` | Live-Küchenbons abhaken mit Zubereitungs-Timer |
| **📲 QR-Tischbestellung** | `http://openbon.local/guest/table/1` | Gäste bestellen kontaktlos vom Smartphone am Tisch |
| **🧾 Digitaler E-Bon & NFC** | `http://openbon.local/receipt/[code]` | Papierloser Kassenbeleg (§33 KassenSichV) via QR & NFC |
| **💬 Team-Funk** | `http://openbon.local/chat` | Echtzeit-Notrufe & Küchen-Durchsagen |

---

## 🛡️ Enterprise-Sicherheit & Härtung

- **Vollständige Session-Schranke:** Alle internen API-Endpunkte (`/api/orders`, `/api/payments`, `/api/reports`, etc.) verlangen eine gültige signierte JWT-Session.
- **Kryptografisches PBKDF2-PIN-Hashing:** Stations- und Kellner-PINs werden mit 100.000 Runden, individuellem Salt und Constant-Time-Vergleich geprüft.
- **Zod-Typvalidierung:** Alle schreibenden APIs validieren eingehende Datenstrukturen streng gegen Schemata.
- **Socket.IO Handshake-Auth:** Socket-Rollen werden ausschließlich aus dem verifizierten Token abgeleitet (keine unautorisierte Rechteübernahme möglich).
- **Rollenbasierte Zugriffskontrolle (RBAC):** Zentral definierte Rechte für `ADMIN`, `POS_CASHIER`, `WAITER` und `KITCHEN`.
- **Geschützte Gastbestellung:** Tisch-`qrToken` zwingend erforderlich; Rate-Limiting gegen Denial-of-Service.

---

## ⚡ Ausfallsicherheit & Hochverfügbarkeit

```
[ Raspberry Pi 5 Kassen-Server ]
  ├── SQLite mit PRAGMA synchronous = FULL
  ├── Litestream Service ──► Kontinuierliche WAL-Replikation auf USB-Stick (RPO < 1s)
  │
  └── Offline-First Tablets (PWA)
        ├── Service Worker Cache: Menükatalog & Tischpläne offline verfügbar
        └── IndexedDB Outbox: Bestellungen & Zahlungen bei WLAN-Abbruch lokal gesichert
```

1. **Offline-First mit Client-Outbox:** Bricht das WLAN im Festzelt ab, speichern Kellner-Tablets und Thekenkassen die Vorgänge in der lokalen IndexedDB. Beim Reconnect synchronisiert die Outbox automatisch mit Idempotency-Keys (keine Doppelbons).
2. **Litestream WAL-Replikation:** Jede geschriebene Buchung wird im Sekundentakt auf einen USB-Stick oder ein Zweitgerät gespiegelt.
3. **Automatisches Drucker-Fallback-Routing:** Ist ein Bon-Drucker offline oder ohne Papier, leitet der Spooler den Auftrag automatisch auf den konfigurierten Ersatzdrucker um.
4. **Kalt-Standby & 1-Klick Disaster Recovery:** Bei Hardwareausfall des Servers wird das Ersatzgerät mit `./scripts/litestream-restore.sh` in 2 Minuten auf den exakten Stand wiederhergestellt.
5. **Automatischer Backup-Scheduler:** Erstellt zyklisch Online-Snapshots (`VACUUM INTO`) mit 10-fach Rotation.
6. **Persistente Druck-Warteschlange:** Druckaufträge überleben Server-Neustarts und werden bei Drucker-Störungen mit automatischem Retry verarbeitet.

---

## 👆 Durchgängige Touch-Bedienung & UI

- **Große Touch-Ziele:** Sämtliche Schaltflächen und Schnellauswahlfelder besitzen eine Mindesthöhe von 48px (`min-h-[48px]`) mit haptischem Feedback und `touch-manipulation`.
- **5 Barrierefreie POS-Themes:** Umschaltbar zwischen *Dunkel (Modern Slate)*, *Hell (Klares Tageslicht)*, *Festzelt High-Contrast (OLED & Signalgelb)*, *Tradition & Verein (Warm Amber)* und *High-Speed Tresen (Kompakt)* – alle mit automatisierter mathematischer WCAG 2.1 Kontrastvalidierung.
- **Vollständiger Bargeld-Ziffernblock & Stückelung:** Einheitlicher Touch-Ziffernblock (`0–9`, `00`, `C`, `,`) plus Direkttasten für alle Euro-Scheine (5€ bis 200€) und Münzen (0,01€ bis 2€) mit automatischer Wechselgeld-Berechnung.
- **Live-Druckerwarteschlange (Spooler Manager):** Interaktive Überwachung aller offenen, gedruckten und fehlgeschlagenen Druckaufträge mit 1-Klick-Wiederholung (Retry), Drucker-Umleitung (Reroute) und Bon-Vorschau.
- **Kellner-Zwischenstand (X-Bon) & Auto-Lock:** Schneller 1-Klick Schichteinblick (Bargeld-Soll im Geldbeutel, Umsatz, Trinkgeld) und Inaktivitäts-Schutz auf Smartphones.
- **Kontaktloser E-Bon per NFC & QR:** Direkte Belegübertragung via Web NFC an Gast-Smartphones oder per Cloudflare Tunnel / Netcup Webhosting über Mobilfunk.
- **Keine blockierenden Browser-Popups:** Alle Bestätigungen und Warnungen erfolgen über animierte Toasts und barrierefreie Touch-Dialoge.
- **Kellner-Schichtabrechnung (`/waiter/settle`):** Touch-optimierter Soll/Ist-Kassensturz mit Trinkgeld-Ausschüttung und digitalem Kassenabschlussbeleg.
- **1-Klick EventProfile-Snapshots:** Speichern und blitzschnelles Wiederherstellen kompletter Fest-Konfigurationen (Tische, Drucker-Routing, Warengruppen, Artikel) im Einstellungsmenü.

---

## 📚 Dokumentation & Leitfäden

Im Verzeichnis [`docs/`](docs/) stehen praxisnahe Anleitungen bereit:

- 🌐 **[`docs/EBON_ONLINE_ANLEITUNG.md`](docs/EBON_ONLINE_ANLEITUNG.md)**: E-Bon Online-Bereitstellung (Cloudflare Tunnel, Netcup DynDNS) & NFC-Übertragung.
- 📖 **[`docs/AUSFALLSICHERHEIT_LITESTREAM.md`](docs/AUSFALLSICHERHEIT_LITESTREAM.md)**: Litestream-Setup, USB-Replikation und Kalt-Standby.
- 📱 **[`docs/OFFLINE_FIRST_GUIDE.md`](docs/OFFLINE_FIRST_GUIDE.md)**: Offline-First Leitfaden für Kassenbedienungen und Helfer.
- 🆘 **[`docs/NOTFALL_RUNBOOK.md`](docs/NOTFALL_RUNBOOK.md)**: Stufenplan & Papier-Notbetrieb bei Stromausfall.
- 💳 **[`docs/KARTENZAHLUNG_ANLEITUNG.md`](docs/KARTENZAHLUNG_ANLEITUNG.md)**: Einrichtung von ZVT-Terminals, SumUp & Sparkasse S-POS.
- 🔒 **[`docs/ONLINE_BETRIEB.md`](docs/ONLINE_BETRIEB.md)**: Sicherheits-Leitfaden für den gesicherten Internet-Betrieb.

---

## 🧪 Tests & Qualitätssicherung

```bash
# Gesamte Testsuite ausführen
npm test

# Produktions-Build kompilieren
npm run build
```

- **26 Test-Suiten / 189 Tests (100% bestanden):** E2E-Lebenszyklus, WCAG 2.1 Kontrastvalidierung, Idempotenz, Berechtigungen, PBKDF2-PIN-Hashing, Drucker-Fallback, DSFinV-K/DATEV-Fiskalisierung, Druckspooler-Resilienz und ESC/POS-Rendering.
