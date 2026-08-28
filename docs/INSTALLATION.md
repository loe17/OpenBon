# OpenBon - Installations- und Ausführungsanleitung

Umfassendes Handbuch für die Einrichtung von **OpenBon** auf allen gängigen Plattformen: Windows, Linux (x86_64 & ARM/Raspberry Pi), macOS, Docker sowie Mobilgeräten (iOS & Android).

---

## 1. Systemvoraussetzungen
- **Node.js**: Version 18 LTS oder höher (empfohlen: Node.js 20 LTS)
- **Architektur**: x86_64 (Intel/AMD) oder ARM64/ARMv7 (Raspberry Pi 3, 4, 5, Apple Silicon)
- **Netzwerk**: Lokales WLAN/LAN für den Festbetrieb (keine permanente Internetverbindung erforderlich)

---

## 2. Headless Linux & Raspberry Pi (1-Klick Online-Installation)

Für Server ohne grafische Oberfläche (Ubuntu Server, Debian, DietPi, Raspberry Pi OS) steht ein automatisierter Installer bereit:

```bash
# 1-Line Online Setup (inkl. systemd Dienst & Boot-Autostart)
curl -fsSL https://raw.githubusercontent.com/loe17/OpenBon/master/install-headless.sh | sudo bash
```

### Manueller Start des Installers:
```bash
sudo bash install-headless.sh
```

**Was das Skript automatisch tut:**
1. Installiert Node.js 20 LTS und Build-Tools.
2. Richtet OpenBon unter `/opt/openbon` ein.
3. Erzeugt die SQLite-Datenbank und führt das Seeding aus.
4. Erstellt einen systemd-Dienst `/etc/systemd/system/openbon.service` mit automatischer Wiederherstellung bei Abstürzen.
5. Aktiviert den Autostart bei jedem System-Boot.

---

## 3. Windows Installation (1-Klick Starter)

### Erstmalige Einrichtung:
1. Installiere [Node.js 20 LTS für Windows](https://nodejs.org/).
2. Repository herunterladen oder klonen:
   ```cmd
   git clone https://github.com/loe17/OpenBon.git
   cd openbon
   npm install
   ```

### Starten:
- **Hauptserver (Primary Master)**: Doppelklick auf `start-primary.bat` (Port 3000)
- **Ersatzserver (Hot-Standby)**: Doppelklick auf `start-standby.bat` (Port 3001)

---

## 4. Linux & macOS (Desktop)

```bash
# Repository klonen & installieren
git clone https://github.com/loe17/OpenBon.git
cd openbon
npm install

# Starten
./start-primary.sh
```

---

## 5. Docker & Docker Compose (Multi-Arch: ARM64 & AMD64)

```bash
# Beide Server (Primary auf Port 3000 + Standby auf Port 3001) starten:
docker compose up -d --build
```

---

## 6. Mobilgeräte (Smartphones & Tablets als Kellner-Stationen)

OpenBon ist als moderne **Progressive Web App (PWA)** konzipiert. Es ist kein Download aus dem App Store oder Play Store nötig!

### Apple iOS (iPhone & iPad):
1. Verbinde das Gerät mit dem Festzelt-WLAN.
2. Öffne Safari und rufe **`http://openbon.local:3000`** oder die Server-IP auf (z. B. `http://192.168.1.100:3000`).
3. Alternativ: Scanne den QR-Code aus dem **QR-Code Beitritts-Center** (`/admin/qr-codes`).
4. Tippe unten in Safari auf das **Teilen-Symbol** (Viereck mit Pfeil nach oben).
5. Wähle **"Zum Home-Bildschirm"**.
6. OpenBon startet fortan als **echte Vollbild-App** ohne Browser-Leisten!

### Android (Smartphones & Tablets):
1. Öffne Google Chrome und rufe **`http://openbon.local:3000`** oder die Server-IP auf (oder scanne den Stations-QR-Code).
2. Tippe oben rechts auf die 3 Punkte und wähle **"App installieren"** oder **"Zum Startbildschirm hinzufügen"**.
3. Die App wird als native WebAPK installiert und läuft im echten Vollbildmodus.

---

## 7. Standard-Zugangsdaten

- **Admin-PIN**: `1234` (kann im Admin-Bereich unter *Einstellungen* beliebig geändert werden)
- **Standard-Port**: `3000` (Primary) bzw. `3001` (Standby)
