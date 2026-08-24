#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

export PORT=3000
export HA_ROLE=PRIMARY

echo "========================================================"
echo "  OPENBON KASSENSYSTEM - VERSION v0.2.1"
echo "========================================================"
echo ""
echo "[1/2] Pruefe und synchronisiere Datenbank-Schema..."
npx prisma db push --skip-generate

echo ""
echo "[2/2] Starte OpenBon Server auf Port 3000..."
echo "========================================================"
echo "  Lokal im Browser:    http://localhost:3000"
echo "  Tablets / Mobil:     http://[DEINE-IP]:3000"
echo "========================================================"
echo ""

node server.js
