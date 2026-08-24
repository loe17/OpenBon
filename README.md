# OpenBon - Kassen-, Bestell- & Festmanagementsystem

---

## 🚀 Schnellstart

### 1. Windows (1-Klick Start)
Doppelklick auf die Datei:
```cmd
start.bat
```
*(Alternativ: `start-primary.bat` für HA-Masterbetrieb oder `start-standby.bat` für redundanten Backup-Server).*

---

### 2. Linux / Raspberry Pi / macOS (1-Klick Start)
Im Terminal ausführen:
```bash
chmod +x *.sh
./start.sh
```

---

### 3. Headless Linux / Raspberry Pi (Automatische Komplettinstallation)
```bash
curl -fsSL https://raw.githubusercontent.com/loe17/OpenBon/master/install-headless.sh | sudo bash
```
Der Installer richtet Node.js, Avahi-mDNS (`http://openbon.local`), SQLite-Datenbank, Systemd-Autostart und Port 80 automatisch ein.

---

### 4. Manueller Start (Entwickler)
```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Datenbank synchronisieren
npx prisma db push

# 3. Testsuite ausführen
npm test

# 4. Server starten (Port 3000)
node server.js
# oder für Entwicklungsmodus mit Hot-Reload:
npm run dev
```

---

## 📱 Stationszugriff im lokalen Netzwerk

Jedes Smartphone, Tablet, PC oder Touchterminal kann direkt im Webbrowser geöffnet werden:

| Station | URL | Standard-PIN | Zweck |
| :--- | :--- | :---: | :--- |
| **Admin Command Center** | `http://openbon.local/admin/dashboard` | `1234` | Live-Umsatz, Leitstand & Konfiguration |
| **Bedienung (Mobilteil)** | `http://openbon.local/waiter` | `3333` | Tische aufnehmen, Gänge, Funk & Abrechnen |
| **Bonkasse / Theke** | `http://openbon.local/pos` | `1111` | Schneller Thekenverkauf, Wertmarken & Bar |
| **SB-Kiosk Terminal** | `http://openbon.local/kiosk` | – | Eigenständiges Gäste-Bestellterminal |
| **Küchenmonitor (KDS)** | `http://openbon.local/kitchen` | `2222` | Live-Bons abhaken & Zubereitungszeiten |
| **Tisch-Bestellung (BYOD)** | `http://openbon.local/guest/table/1` | – | Gäste bestellen per QR-Code am Tisch |
| **Digitaler E-Bon** | `http://openbon.local/receipt/[code]` | – | Papierloser Kassenbeleg nach §33 KassenSichV |
| **Team-Funk** | `http://openbon.local/chat` | – | Echtzeit-Notrufe & Küchen-Durchsagen |

---

## ✨ Funktionsübersicht

### 🍽️ Gast-Bestellung & Self-Service
- **BYOD QR-Tischbestellung (`/guest/table/[nr]`)**: Gäste scannen den QR-Code am Tisch und bestellen direkt vom Smartphone; Bons werden automatisch an Küche und Schanktheke gedruckt.
- **SB-Kiosk Terminal (`/kiosk`)**: Touchscreen-Bestellterminal mit 60-Sekunden Inaktivitäts-Reset, automatischer Abholnummern-Vergabe (`#K-101`) und Terminal-Zahlung.
- **Digitaler E-Bon QR-Code (`/receipt/[code]`)**: Papierloser Kassenbeleg nach §33 KassenSichV mit vollständiger USt-Aufschlüsselung, TSE-Signatur und PDF-Druck.

### 💰 Kasse, Abrechnung & Trinkgeld
- **Flexible Trinkgeld-Profile & Bereiche (`/admin/tips`)**: Standard 100% an die Bedienung; frei konfigurierbare Pool-Verteilung (z. B. Theke 20%, Küche 10%, Service 70%) und Zuordnung je Kellner.
- **Wertmarken- & Token-System (`/admin/tokens`)**: Verkauf, Einlösung und Rückkauf von Verzehrbons, Pfandmarken und Getränkechips mit digitalem Kassenjournal und Umlaufsaldo.
- **Kartenzahlung & EC-Terminals**: Integrierte Unterstützung für ZVT-over-IP Netzwerkkassen, SumUp App-to-App, VR-Pay Me und Sparkasse S-POS (nur aktiv bei hinterlegten Zugangsdaten).
- **Kassenbuch & Barverkehr (`/admin/cashbook`)**: Z-Bons, Wechselgeld-Einlagen und Tresor-Entnahmen mit GoBD-konformer Protokollierung.

### ⚖️ Jugendschutz, Allergene & Bestandsführung
- **Jugendschutz-Hinweis mit Geburtsdatum**: Taggenaue Berechnung des Mindestgeburtsdatums für 16 und 18 Jahre (z. B. *„Ab 16 J: ≤ 24.08.2010“*) auf Kasse und Mobilteil.
- **LMIV Allergen-Matrix & Filter**: Alle 14 offiziellen EU-Hauptallergene und Zusatzstoffe direkt im Artikelstamm pflegbar; Kellner und Gäste können Allergene mit 1 Klick filtern.
- **Zeitgesteuerte Aktionspreise (Happy Hour)**: Zeitfenster (Start/Ende), Wochentagsfilter und Aktionspreise je Artikel mit automatischem Wechsel.
- **Meldebestand-Warnung & Warndrucker**: Warnhinweis auf Kasse und Admin bei Unterschreitung des Mindestbestands; optionaler automatischer Warnzettel-Ausdruck auf Netzwerkdrucker.

### 📑 Buchhaltung & Finanzamts-Compliance
- **DATEV Kassenbuch-Export (`/admin/accounting`)**: Download standardkonformer DATEV EXTF 700 Buchungsstapel mit Kontenrahmen (19% Erlöse `8400`, 7% `8300`, Kasse `1000`, Geldtransit `1360`).
- **DSFinV-K & TSE Prüfer-Export (`/admin/fiscal`)**: Standardisierter DSFinV-K 2.3+ Export (`bonkopf.csv`, `bonpos.csv`, `bonpos_preise.csv`, `tse_transaktionen.csv`) mit SHA-256 Prüfsumme für Kassennachschauen nach KassenSichV.

### 🖨️ Hochverfügbarkeit & Druckersteuerung
- **2-Server Hochverfügbarkeit (Dual HA Failover)**: Primär- und Standby-Server synchronisieren Bestellungen in Echtzeit; bei Serverausfall springt der Standby-Server nahtlos ein.
- **ESC/POS Netzwerkdrucker-Routing**: Druckergruppen-Steuerung für Küche, Schanktheke, Ausschank und Abholung mit CP858-Umlauten (äöüß€) und Tablett-Splitting.

---

## 🛠️ Systemvoraussetzungen & Hardware

Ausführliche Anleitungen und Empfehlungen befinden sich im Ordner [`docs/`](docs/):
- [**Hardware-Empfehlungen**](docs/HARDWARE_EMPFEHLUNGEN.md): Server, Tablets, Bondrucker und Router
- [**Netzwerk & WLAN-Setup**](docs/NETZWERK_ROUTER.md): Empfehlungen für stabiles WLAN im Festzelt
- [**Drucker-Setup**](docs/DRUCKER_SETUP.md): ESC/POS-Drucker über LAN/WLAN einrichten
- [**Hochverfügbarkeit (HA)**](docs/HOCHVERFUEGBARKEIT.md): 2-Server Ausfallsicherheit
- [**Rollen- & PIN-Sicherheit**](docs/ROLLEN_PIN_SICHERHEIT.md): Zugriffsschutz im Livebetrieb

---

## 🧪 Tests & Qualitätssicherung

Die Codebase verfügt über eine umfassende automatisierte Testsuite:
```bash
npm test
```
```
Test Files: 17 passed (17)
Tests:      106 passed (106)
```

---

## 📄 Lizenz
OpenBon steht unter der [MIT-Lizenz](LICENSE).
