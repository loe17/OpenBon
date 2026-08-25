#!/usr/bin/env bash
# ==============================================================================
# OpenBon - Headless Linux & Raspberry Pi Auto-Installer
# Unterstützt: Ubuntu, Debian, DietPi, Raspberry Pi OS (ARM64, ARMv7, x86_64)
# Repository: https://github.com/loe17/OpenBon
# ==============================================================================

set -e

echo "======================================================================"
echo " [OpenBon] Headless 1-Klick Installer & Systemd-Dienst Setup"
echo "======================================================================"
echo ""

# 1. Root-Rechte prüfen
if [ "$EUID" -ne 0 ]; then
  echo "[WARNUNG] Bitte führe dieses Skript mit sudo/root-Rechten aus:"
  echo "  sudo bash install-headless.sh"
  exit 1
fi

INSTALL_DIR="/opt/openbon"
SERVICE_USER="${SUDO_USER:-$USER}"

echo "[1/6] Aktualisiere Paketquellen & installiere Basis-Tools & mDNS (avahi)..."
apt-get update -y
apt-get install -y curl git build-essential avahi-daemon avahi-utils
systemctl enable avahi-daemon 2>/dev/null || true
systemctl restart avahi-daemon 2>/dev/null || true

# 2. Node.js 20+ installieren, falls nicht vorhanden
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 18 ]; then
  echo "[2/6] Installiere Node.js 20 LTS (NodeSource)..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo "[2/6] Node.js bereits installiert: $(node -v)"
fi

# 3. Quellcode klonen oder aktualisieren von https://github.com/loe17/OpenBon.git
echo "[3/6] Richte OpenBon unter $INSTALL_DIR ein..."
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "  -> Aktualisiere bestehendes Repository..."
  cd "$INSTALL_DIR"
  git config --global --add safe.directory * >nul 2>nul || true
  git pull origin master || true
else
  echo "  -> Klone OpenBon von https://github.com/loe17/OpenBon.git..."
  mkdir -p "$INSTALL_DIR"
  git clone https://github.com/loe17/OpenBon.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# 4. Erstelle .env Datei falls nicht vorhanden
if [ ! -f "$INSTALL_DIR/.env" ]; then
  echo "  -> Erstelle Standard-Umgebungskonfiguration (.env)..."
  cat <<EOF > "$INSTALL_DIR/.env"
DATABASE_URL="file:./dev.db"
NODE_ENV="production"
PORT=3000
HOST="0.0.0.0"
HA_ROLE="PRIMARY"
EOF
fi

chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

# 5. Abhängigkeiten & Datenbank initialisieren
echo "[4/6] Installiere npm-Abhängigkeiten & initialisiere Datenbank..."
sudo -u "$SERVICE_USER" npm install
sudo -u "$SERVICE_USER" DATABASE_URL="file:./dev.db" npx prisma generate
sudo -u "$SERVICE_USER" DATABASE_URL="file:./dev.db" npx prisma db push --accept-data-loss --skip-generate
sudo -u "$SERVICE_USER" DATABASE_URL="file:./dev.db" node prisma/seed.js

echo "[5/6] Baue Next.js Produktions-Build..."
sudo -u "$SERVICE_USER" DATABASE_URL="file:./dev.db" npm run build

# 6. Litestream Replikation installieren & einrichten
echo "[6/7] Installiere Litestream für kontinuierliche SQLite-WAL-Replikation..."
ARCH=$(uname -m)
LITESTREAM_VERSION="v0.3.13"
if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
  LITESTREAM_PKG="litestream-${LITESTREAM_VERSION}-linux-arm64.tar.gz"
elif [ "$ARCH" = "armv7l" ] || [ "$ARCH" = "armhf" ]; then
  LITESTREAM_PKG="litestream-${LITESTREAM_VERSION}-linux-armv7.tar.gz"
else
  LITESTREAM_PKG="litestream-${LITESTREAM_VERSION}-linux-amd64.tar.gz"
fi

curl -fsSL "https://github.com/benbjohnson/litestream/releases/download/${LITESTREAM_VERSION}/${LITESTREAM_PKG}" -o /tmp/litestream.tar.gz 2>/dev/null || true
if [ -f /tmp/litestream.tar.gz ]; then
  tar -C /usr/local/bin -xzf /tmp/litestream.tar.gz 2>/dev/null || true
  rm -f /tmp/litestream.tar.gz
  chmod +x /usr/local/bin/litestream 2>/dev/null || true
  cp "$INSTALL_DIR/scripts/litestream.service" /etc/systemd/system/ 2>/dev/null || true
  systemctl daemon-reload
  systemctl enable litestream 2>/dev/null || true
  systemctl restart litestream 2>/dev/null || true
  echo "  -> Litestream erfolgreich installiert und gestartet."
fi

# 7. Systemd Hintergrunddienst erstellen
echo "[7/7] Richte systemd-Dienst ein (/etc/systemd/system/openbon.service)..."
cat <<EOF > /etc/systemd/system/openbon.service
[Unit]
Description=OpenBon - Kassensystem Server
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
Environment=NODE_ENV=production
Environment=PORT=80
Environment=HOST=0.0.0.0
Environment=HA_ROLE=PRIMARY
Environment=DATABASE_URL="file:./dev.db"
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable openbon
systemctl restart openbon

# Lokale IP ermitteln
IP_ADDR=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")

echo ""
echo "======================================================================"
echo "  [ERFOLG] OpenBon wurde erfolgreich installiert!"
echo "  Server laeuft im Hintergrunddienst: systemctl status openbon"
echo "  Aufruf im Browser: http://openbon.local oder http://$IP_ADDR"
echo "======================================================================"
echo ""
echo "  -> Web-Zugriff (mDNS): http://openbon.local"
echo "  -> Web-Zugriff (IP):   http://$IP_ADDR"
echo "  -> Server-Status:      systemctl status openbon"
echo "  -> Admin-PIN:          1234 (in Einstellungen aenderbar)"
echo "  -> Autostart:          Aktiviert (Startet automatisch bei Serverboot)"
echo ""
echo "======================================================================"
