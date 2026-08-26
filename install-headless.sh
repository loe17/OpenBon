#!/usr/bin/env bash
# ==============================================================================
# OpenBon - Headless Linux & Raspberry Pi Auto-Installer & Updater
# Unterstützt: Ubuntu, Debian, DietPi, Raspberry Pi OS (ARM64, ARMv7, x86_64)
# Repository: https://github.com/loe17/OpenBon
# ==============================================================================

set -e

INSTALL_DIR="/opt/openbon"
SERVICE_USER="${SUDO_USER:-$USER}"
REPO_URL="https://github.com/loe17/OpenBon.git"

# Parameter-Variablen
TARGET_REF=""
TARGET_TYPE=""
FORCE_REINSTALL=0

# CLI-Argumente parsen
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag|-t)
      TARGET_TYPE="TAG"
      TARGET_REF="$2"
      shift 2
      ;;
    --branch|-b)
      TARGET_TYPE="BRANCH"
      TARGET_REF="$2"
      shift 2
      ;;
    --commit|-c)
      TARGET_TYPE="COMMIT"
      TARGET_REF="$2"
      shift 2
      ;;
    --latest|-l)
      TARGET_TYPE="LATEST_RELEASE"
      shift
      ;;
    --force-reinstall)
      FORCE_REINSTALL=1
      shift
      ;;
    --help|-h)
      echo "OpenBon Headless Installer & Updater"
      echo ""
      echo "Verwendung:"
      echo "  sudo bash install-headless.sh [Optionen]"
      echo ""
      echo "Optionen:"
      echo "  --tag, -t <TAG>       Bestimmten Git-Tag/Release installieren (z. B. v0.4.2)"
      echo "  --branch, -b <NAME>   Bestimmten Git-Branch installieren (z. B. master)"
      echo "  --commit, -c <HASH>   Bestimmten Git-Commit-Hash auschecken"
      echo "  --latest, -l          Neuestes stabiles Release-Tag installieren (Standard)"
      echo "  --force-reinstall     Vollständige Neuinstallation erzwingen"
      echo "  --help, -h            Diese Hilfe anzeigen"
      exit 0
      ;;
    *)
      echo "[HINWEIS] Unbekannter Parameter '$1' wird ignoriert."
      shift
      ;;
  esac
done

echo "======================================================================"
echo " [OpenBon] Headless 1-Klick Installer & Update-Manager"
echo "======================================================================"
echo ""

# 1. Root-Rechte prüfen
if [ "$EUID" -ne 0 ]; then
  echo "[WARNUNG] Bitte führe dieses Skript mit sudo/root-Rechten aus:"
  echo "  sudo bash install-headless.sh"
  exit 1
fi

# ==============================================================================
# 2. NETZWERK-DIAGNOSE & AUTO-REPAIR (DNS-Fix)
# ==============================================================================
echo "[1/7] Überprüfe Netzwerkverbindung & DNS-Namensauflösung..."

fix_dns() {
  echo "  -> [NETZWERK-REPAIR] DNS-Namensauflösung schlägt fehl! Richte temporären Fallback-DNS ein..."
  if [ -f /etc/resolv.conf ]; then
    # Backup resolv.conf
    cp /etc/resolv.conf /tmp/resolv.conf.bak 2>/dev/null || true
    # Schreibe 1.1.1.1 und 8.8.8.8 als Nameserver
    echo "nameserver 1.1.1.1" > /etc/resolv.conf
    echo "nameserver 8.8.8.8" >> /etc/resolv.conf
  fi

  # Falls systemd-resolved aktiv ist
  if command -v resolvectl &>/dev/null; then
    DEF_IFACE=$(ip route show default 2>/dev/null | awk '{print $5}' | head -n1 || true)
    if [ -n "$DEF_IFACE" ]; then
      resolvectl dns "$DEF_IFACE" 1.1.1.1 8.8.8.8 2>/dev/null || true
    fi
  fi
}

# Teste zunächst Internet per IP (Cloudflare 1.1.1.1 oder Google 8.8.8.8)
HAS_IP_CONNECTION=0
if ping -c 1 -W 2 1.1.1.1 &>/dev/null || ping -c 1 -W 2 8.8.8.8 &>/dev/null; then
  HAS_IP_CONNECTION=1
fi

# Teste DNS-Auflösung von github.com
HAS_DNS=0
if curl -Is --connect-timeout 3 https://github.com &>/dev/null || getent hosts github.com &>/dev/null; then
  HAS_DNS=1
fi

if [ "$HAS_DNS" -eq 1 ]; then
  echo "  ✓ Netzwerk- und Internetverbindung erfolgreich hergestellt."
elif [ "$HAS_IP_CONNECTION" -eq 1 ] && [ "$HAS_DNS" -eq 0 ]; then
  # IP geht, aber DNS ist kaputt -> Automatisch reparieren
  fix_dns
  # Erneuter Test
  if curl -Is --connect-timeout 4 https://github.com &>/dev/null || getent hosts github.com &>/dev/null; then
    echo "  ✓ DNS-Auflösung erfolgreich repariert (Fallback-DNS aktiv)."
  else
    echo "  [WARNUNG] DNS konnte nicht automatisch behoben werden. Versuche trotzdem fortzufahren..."
  fi
else
  echo "  [WARNUNG] Keine direkte Internetverbindung zu GitHub erkannt!"
  echo "  Hinweis: Falls dieser Server an einem Offline-Festrouter betrieben wird,"
  echo "  verbinden Sie das Gerät kurzzeitig mit dem Internet für Updates."
fi

# ==============================================================================
# 3. ERKENNUNG BESTEHENDER INSTALLATION & UPDATE-MODUS
# ==============================================================================
IS_UPDATE=0
if [ -d "$INSTALL_DIR/.git" ] && [ "$FORCE_REINSTALL" -eq 0 ]; then
  IS_UPDATE=1
  echo ""
  echo "----------------------------------------------------------------------"
  echo " [UPDATE-MODUS] Bestehende OpenBon-Installation unter $INSTALL_DIR erkannt!"
  echo " Datenbank (prisma/dev.db) und Einstellungen (.env) bleiben erhalten."
  echo "----------------------------------------------------------------------"
fi

# ==============================================================================
# 4. SYSTEM-PAKETE & NODE.JS PRÜFEN
# ==============================================================================
echo ""
echo "[2/7] Überprüfe System-Tools, mDNS (avahi) & Node.js..."
if [ "$IS_UPDATE" -eq 0 ] || ! command -v git &>/dev/null || ! command -v avahi-daemon &>/dev/null; then
  apt-get update -y
  apt-get install -y curl git build-essential avahi-daemon avahi-utils
  systemctl enable avahi-daemon 2>/dev/null || true
  systemctl restart avahi-daemon 2>/dev/null || true
fi

# Node.js 20+ installieren, falls nicht vorhanden
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 18 ]; then
  echo "  -> Installiere Node.js 20 LTS (NodeSource)..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo "  ✓ Node.js ist installiert: $(node -v)"
fi

# ==============================================================================
# 5. REPOSITORY INITIALISIEREN & TAGS / RELEASES ABRUFEN
# ==============================================================================
echo ""
echo "[3/7] Initialisiere Repository unter $INSTALL_DIR..."

if [ "$IS_UPDATE" -eq 0 ]; then
  mkdir -p "$INSTALL_DIR"
  if [ ! -d "$INSTALL_DIR/.git" ]; then
    git clone "$REPO_URL" "$INSTALL_DIR"
  fi
fi

cd "$INSTALL_DIR"
git config --global --add safe.directory * >/dev/null 2>&1 || true
git fetch --all --tags --prune >/dev/null 2>&1 || true

# Verfügbare Tags ermitteln
AVAILABLE_TAGS=$(git tag -l "v*" --sort=-v:refname 2>/dev/null || git tag -l --sort=-v:refname 2>/dev/null || true)
LATEST_TAG=$(echo "$AVAILABLE_TAGS" | head -n1 || true)

# ==============================================================================
# 6. VERSIONS- & KANAL-AUSWAHL
# ==============================================================================
# Falls interaktives Terminal und kein CLI-Parameter übergeben wurde
if [ -t 0 ] && [ -z "$TARGET_REF" ] && [ -z "$TARGET_TYPE" ]; then
  echo ""
  echo "======================================================================"
  echo "  Welche Version von OpenBon soll installiert / aktiviert werden?"
  echo "======================================================================"
  if [ -n "$LATEST_TAG" ]; then
    echo "  [1] Neuestes stabiles Release ($LATEST_TAG) [Empfohlen für Festbetrieb]"
  else
    echo "  [1] Neuestes Release (nicht gefunden, verwende master)"
  fi
  echo "  [2] Entwicklungs-Branch (master - neuester Stand)"
  echo "  [3] Bestimmtes Release / Tag aus Liste auswählen"
  echo "  [4] Manuelle Eingabe (Branch, Tag oder Commit-Hash)"
  echo ""
  read -r -p "Ihre Auswahl [1-4, Standard: 1]: " USER_CHOICE
  USER_CHOICE="${USER_CHOICE:-1}"

  case "$USER_CHOICE" in
    1)
      if [ -n "$LATEST_TAG" ]; then
        TARGET_REF="$LATEST_TAG"
      else
        TARGET_REF="master"
      fi
      ;;
    2)
      TARGET_REF="master"
      ;;
    3)
      echo ""
      echo "Verfügbare Tags:"
      TAG_ARR=($AVAILABLE_TAGS)
      for i in "${!TAG_ARR[@]}"; do
        echo "  $((i+1))) ${TAG_ARR[$i]}"
      done
      read -r -p "Nummer der Version wählen: " TAG_NUM
      TAG_IDX=$((TAG_NUM-1))
      if [ "$TAG_IDX" -ge 0 ] && [ "$TAG_IDX" -lt "${#TAG_ARR[@]}" ]; then
        TARGET_REF="${TAG_ARR[$TAG_IDX]}"
      else
        TARGET_REF="$LATEST_TAG"
      fi
      ;;
    4)
      read -r -p "Branch, Tag oder Commit eingeben (z. B. v0.4.2 oder master): " CUSTOM_REF
      TARGET_REF="${CUSTOM_REF:-master}"
      ;;
    *)
      TARGET_REF="${LATEST_TAG:-master}"
      ;;
  esac
fi

# Falls weiterhin leer (z. B. bei nicht-interaktivem curl | bash)
if [ -z "$TARGET_REF" ]; then
  if [ "$TARGET_TYPE" = "BRANCH" ]; then
    TARGET_REF="master"
  elif [ -n "$LATEST_TAG" ]; then
    TARGET_REF="$LATEST_TAG"
  else
    TARGET_REF="master"
  fi
fi

echo ""
echo "  -> Ziel-Version gewählt: $TARGET_REF"
echo "  -> Checke $TARGET_REF aus..."

if git show-ref --verify --quiet "refs/tags/$TARGET_REF" 2>/dev/null; then
  # Es ist ein Tag
  git checkout -f "tags/$TARGET_REF"
elif git show-ref --verify --quiet "refs/heads/$TARGET_REF" 2>/dev/null || git show-ref --verify --quiet "refs/remotes/origin/$TARGET_REF" 2>/dev/null; then
  # Es ist ein Branch
  git checkout -f "$TARGET_REF"
  git reset --hard "origin/$TARGET_REF" 2>/dev/null || true
else
  # Commit oder Tag direkt probieren
  git checkout -f "$TARGET_REF" || git checkout -f master
fi

CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo "  ✓ Aktivierter Stand: $TARGET_REF (Commit: $CURRENT_COMMIT)"

# ==============================================================================
# 7. KONFIGURATION (.env) PRÜFEN / ERSTELLEN
# ==============================================================================
if [ ! -f "$INSTALL_DIR/.env" ]; then
  echo ""
  echo "  -> Erstelle Standard-Umgebungskonfiguration (.env)..."
  cat <<EOF > "$INSTALL_DIR/.env"
DATABASE_URL="file:./dev.db"
NODE_ENV="production"
PORT=3000
HOST="0.0.0.0"
HA_ROLE="PRIMARY"
EOF
fi

chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR" 2>/dev/null || true

# ==============================================================================
# 8. ABHÄNGIGKEITEN & DATENBANK-MIGRATION
# ==============================================================================
echo ""
echo "[4/7] Installiere npm-Abhängigkeiten..."
sudo -u "$SERVICE_USER" npm install --production=false

echo ""
echo "[5/7] Führe Prisma Datenbank-Migrationen durch..."
sudo -u "$SERVICE_USER" DATABASE_URL="file:./dev.db" npx prisma generate
sudo -u "$SERVICE_USER" DATABASE_URL="file:./dev.db" npx prisma db push --accept-data-loss --skip-generate

# Seed nur bei Neuinstallation (wenn noch keine Tabellen/Bestellungen da sind)
if [ "$IS_UPDATE" -eq 0 ]; then
  sudo -u "$SERVICE_USER" DATABASE_URL="file:./dev.db" node prisma/seed.js 2>/dev/null || true
fi

# ==============================================================================
# 9. NEXT.JS PRODUKTIONS-BUILD
# ==============================================================================
echo ""
echo "[6/7] Kompiliere Next.js Produktions-Build (optimiert)..."
sudo -u "$SERVICE_USER" DATABASE_URL="file:./dev.db" npm run build

# ==============================================================================
# 10. SYSTEMD-DIENST & RESTART
# ==============================================================================
echo ""
echo "[7/7] Richte systemd-Hintergrunddienst ein und starte OpenBon neu..."

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
systemctl enable openbon 2>/dev/null || true
systemctl restart openbon

# Lokale IP ermitteln
IP_ADDR=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")

echo ""
echo "======================================================================"
if [ "$IS_UPDATE" -eq 1 ]; then
  echo "  [ERFOLG] OpenBon wurde erfolgreich auf Version $TARGET_REF aktualisiert!"
else
  echo "  [ERFOLG] OpenBon ($TARGET_REF) wurde erfolgreich installiert!"
fi
echo "  Server laeuft als systemd-Dienst: systemctl status openbon"
echo "  Aufruf im Browser: http://openbon.local oder http://$IP_ADDR"
echo "======================================================================"
echo ""
echo "  -> Aktive Version:    $TARGET_REF (Commit $CURRENT_COMMIT)"
echo "  -> Web-Zugriff (mDNS): http://openbon.local"
echo "  -> Web-Zugriff (IP):   http://$IP_ADDR"
echo "  -> Server-Status:      systemctl status openbon"
echo "  -> Admin-PIN:          1234 (in Einstellungen anpassbar)"
echo "  -> Autostart:          Aktiviert (Startet automatisch bei Serverboot)"
echo ""
echo "======================================================================"

