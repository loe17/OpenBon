#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

# --------------------------------------------------------------------
# M6.2: Schema-Abgleich OHNE stillen Datenverlust. Blockt Prisma den
# Abgleich wegen drohendem Datenverlust ab, bricht der Start kontrolliert
# ab - nichts wird automatisch geloescht. Bewusste Freigabe:
#   OPENBON_ALLOW_DATA_LOSS=1 ./start.sh
# --------------------------------------------------------------------
run_db_push() {
  local push_output code
  push_output=$(npx prisma db push --skip-generate 2>&1)
  code=$?
  if [ "$code" -eq 0 ]; then
    echo "      Datenbank-Schema ist aktuell."
    return 0
  fi
  if printf '%s' "$push_output" | grep -qi "data loss"; then
    printf '%s\n' "$push_output"
    echo ""
    echo "  ABBRUCH: Das neue Schema wuerde bestehende Daten verlieren."
    echo "  Es wurde NICHTS geloescht. Backup ziehen (Admin -> Backup) und dann"
    echo "  bewusst freigeben: OPENBON_ALLOW_DATA_LOSS=1 $0"
    exit 1
  fi
  printf '%s\n' "$push_output"
  return "$code"
}

export PORT=3000
export HA_ROLE=PRIMARY

echo "========================================================"
# Version aus package.json lesen statt fest verdrahten
APPVER=$(node -p "require('./package.json').version" 2>/dev/null || echo "unbekannt")
echo "  OPENBON KASSENSYSTEM - VERSION v${APPVER}"
echo "========================================================"
echo ""
echo "[1/2] Pruefe und synchronisiere Datenbank-Schema..."
run_db_push

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
