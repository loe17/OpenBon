#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

export PORT=3000
export HA_ROLE=PRIMARY

echo "========================================================"
# Version aus package.json lesen statt fest verdrahten
APPVER=$(node -p "require('./package.json').version" 2>/dev/null || echo "unbekannt")
echo "  OPENBON KASSENSYSTEM - VERSION v${APPVER}"
echo "========================================================"
echo ""
echo "[1/2] Pruefe und synchronisiere Datenbank-Schema..."
npx prisma db push --accept-data-loss --skip-generate

echo ""
echo "[2/2] Starte OpenBon Server auf Port 3000..."
echo "========================================================"
echo "  Lokal im Browser:    http://localhost:3000"
echo "  Tablets / Mobil:     http://[DEINE-IP]:3000"
echo "========================================================"
echo ""

# Sitzungsschluessel anlegen, bevor der Server startet
node scripts/ensure-secret.js || true

node server.js
