#!/usr/bin/env bash
# ==============================================================================
# OpenBon - Headless Linux & Raspberry Pi Auto-Installer
# Unterstützt: Ubuntu, Debian, DietPi, Raspberry Pi OS (ARM64, ARMv7, x86_64)
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

echo "[1/6] Aktualisiere Paketquellen & installiere Basis-Tools..."
apt-get update -y
apt-get install -y curl git build-essential

# 2. Node.js 20+ installieren, falls nicht vorhanden
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 18 ]; then
  echo "[2/6] Installiere Node.js 20 LTS (NodeSource)..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo "[2/6] Node.js bereits installiert: $(node -v)"
fi

# 3. Quellcode klonen oder aktualisieren
echo "[3/6] Richte OpenBon unter $INSTALL_DIR ein..."
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "  -> Aktualisiere bestehendes Repository..."
  cd "$INSTALL_DIR"
  git pull origin master || true
else
  mkdir -p "$INSTALL_DIR"
  cp -r ./* "$INSTALL_DIR/" 2>/dev/null || true
  cd "$INSTALL_DIR"
fi

chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

# 4. Abhängigkeiten & Datenbank initialisieren
echo "[4/6] Installiere npm-Abhängigkeiten & initialisiere Datenbank..."
sudo -u "$SERVICE_USER" npm install --production=false
sudo -u "$SERVICE_USER" npx prisma db push --skip-generate
sudo -u "$SERVICE_USER" node prisma/seed.js

echo "[5/6] Baue Next.js Produktions-Build..."
sudo -u "$SERVICE_USER" npm run build

# 6. Systemd Hintergrunddienst erstellen
echo "[6/6] Richte systemd-Dienst ein (/etc/systemd/system/openbon.service)..."
cat <<EOF > /etc/systemd/system/openbon.service
[Unit]
Description=OpenBon - Kassensystem Server
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOST=0.0.0.0
Environment=HA_ROLE=PRIMARY
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable openbon.service
systemctl restart openbon.service

# Lokale IP ermitteln
IP_ADDR=$(hostname -I | awk '{print $1}')

echo ""
echo "======================================================================"
echo " [ERFOLG] OpenBon wurde erfolgreich als Hintergrunddienst installiert!"
echo "======================================================================"
echo ""
echo "  -> Server-Status: systemctl status openbon"
echo "  -> Web-Zugriff:   http://$IP_ADDR:3000"
echo "  -> Admin-PIN:     1234 (in Einstellungen aenderbar)"
echo "  -> Autostart:     Aktiviert (Startet automatisch bei Serverboot)"
echo ""
echo "======================================================================"
