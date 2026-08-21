# OpenBon - Plattformunabhängiges Fest- & Gastronomie-Kassensystem

> **Modernes, offenes Kassen-, Bestell- und Küchensystem für Vereinsfeste, Gastronomie & Events**  
> Entwickelt für 100% Offline-LAN-Betrieb, Dual-Server-Hochverfügbarkeit, PIN-Sicherheit, QR-Code Beitritt und flexible Kartenzahlung.

---

## Hauptfunktionen

- **100% Plattformunabhängig (PWA)**: Läuft auf jedem Gerät im Webbrowser (iOS Safari, Android Chrome, Windows, Mac, Linux) – keine App-Store-Downloads erforderlich.
- **Rollen-Sicherheit & PIN-Schutz**: 4-stelliger Admin-PIN schützt Preislisten, Einstellungen und Berichte. Helfer-Smartphones werden in ihrer Station arretiert.
- **QR-Code Beitritts-Center**: Helfer treten Stationen (Bedienung, Kasse, Küche) blitzschnell per Scan bei. QR-Codes können direkt auf Thermobondruckern ausgedruckt werden.
- **2-Rechner-Hochverfügbarkeit (HA Failover)**: Primär- und Ersatzserver spiegeln Transaktionen in Echtzeit (<3s automatischer Failover bei PC-Ausfall).
- **100% Offline-Fähig + Flexible Kartenzahlung**: Funktioniert im autarken Festzelt-WLAN ohne Internet. Sobald Internet an den Router gesteckt wird (LAN/LTE), steht sofort Kartenzahlung (SumUp / Terminal) bereit.
- **Komplett-Veranstaltungsbackup**: 1-Klick Download des vollständigen Veranstaltungsarchivs (Artikel, Tische, Buchungen, Rechnungen) als portable JSON-Datei.
- **Schnelle Kellner-Bestellmaske**:
  - Tischübersicht mit Live-Farbcodierung und Offenbeträgen
  - 1-Klick-Sonderwünsche (z. B. *"ohne Zwiebeln"*, *"extra Soße"*)
  - Rechnungs-Splitting (Teilzahlung pro Gast)
  - Pfandrückgabe (Leergutverrechnung) & Wechselgeld-Rechner
- **Bonkasse / Theken-Express**:
  - Wertmarken- & Gutschein-Bons mit fortlaufender Abholnummer (#101, #102...)
  - Synchroner Gegenbon für die Küchenausgabe
  - Automatische Kassenladen-Öffnung bei Barzahlung
- **Küchenmonitor (KDS)**:
  - Live-Bestellspalten mit FIFO- und Tischanordnung
  - Farbcodierte Dringlichkeits-Ampel (Wartezeit-Alarm)
  - Live-Rückstandsanzeige (*"Noch 18x Pommes"*)
  - Akustischer Audio-Gong bei neuen Bons
- **Live-Geräteübersicht & Akku-Monitor**:
  - Echtzeit-Akkustand % aller Kellner-Smartphones
  - Uptime & Schichtdauer
  - **Suchton (Find My Device)**: Löst auf verlegten Smartphones einen lauten Signalton & Vibration aus
- **ESC/POS Thermodrucker & Bon-Splitting**:
  - Ansteuerung über TCP-Port 9100
  - Native deutsche Zeichentabelle `CP858` (äöüÄÖÜß€)
  - Automatisches Splitten nach Druckgruppen (Küche, Schenke) und Tablett-Limits
  - Integrierter **Virtueller Drucker-Simulator** im Browser
- **Auswertungen & Buchhaltung**:
  - Kellner-Schichtabrechnung (Z-Bon pro Kellner)
  - Renner-/Penner-Statistik
  - 1-Klick CSV-Export (Excel)
  - JSON-Backup & Wiederherstellung
- **Trainingsmodus (Übungsmodus)**:
  - Helfer können gefahrlos üben, ohne echte Bons zu drucken oder Umsätze zu verfälschen

---

## Schnellstart

### 1. Headless Linux & Raspberry Pi (1-Line Online Installer)
```bash
curl -fsSL https://raw.githubusercontent.com/openbon-pos/openbon/master/install-headless.sh | sudo bash
```

### 2. Manuelle Installation
```bash
git clone https://github.com/openbon-pos/openbon.git
cd openbon
npm install
npx prisma db push
node prisma/seed.js
```

### 3. Starten (Windows 1-Klick)
- **Hauptserver**: Doppelklick auf `start-primary.bat`
- **Ersatzserver (Hot-Standby)**: Doppelklick auf `start-standby.bat`

### 4. Starten (Linux / macOS / Docker)
```bash
./start-primary.sh

# Oder mit Docker Compose (Dual-Server)
docker compose up -d --build
```

Öffne im Browser: `http://localhost:3000` bzw. die IP-Adresse im Festzelt-WLAN.

---

## Ausführliche Dokumentation

- [Installationsanleitung für alle Plattformen (docs/INSTALLATION.md)](./docs/INSTALLATION.md)
- [Bedienungsanleitung für Service & Küche (docs/ANLEITUNG.md)](./docs/ANLEITUNG.md)
- [Rollen-Sicherheit & PIN-Schutz (docs/ROLLEN_PIN_SICHERHEIT.md)](./docs/ROLLEN_PIN_SICHERHEIT.md)
- [QR-Code Beitritts-Center (docs/QR_CODE_BEITRITT.md)](./docs/QR_CODE_BEITRITT.md)
- [Router- & Netzwerkkonfiguration mit Kartenzahlung (docs/NETZWERK_ROUTER.md)](./docs/NETZWERK_ROUTER.md)
- [Hochverfügbarkeit & Replikations-Setup (docs/HOCHVERFUEGBARKEIT.md)](./docs/HOCHVERFUEGBARKEIT.md)
- [ESC/POS Thermodrucker-Einrichtung (docs/DRUCKER_SETUP.md)](./docs/DRUCKER_SETUP.md)

---

## Technologie-Stack

- **Frontend & Backend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons
- **Echtzeit-Synchronisation**: Socket.io WebSocket Hub & Custom Node Server
- **Datenbank**: SQLite mit WAL-Mode & Prisma ORM
- **Drucker-Treiber**: Natives ESC/POS Raw Socket Protokoll (Port 9100) mit `iconv-lite` CP858
- **Testing**: Vitest Automated Test Suite
- **Lizenz**: MIT
