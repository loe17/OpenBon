#!/bin/bash
# ============================================================
#  OpenBon - Start im PRODUKTIONSBETRIEB (Linux / headless)
#
#  Gegenstueck zu start-produktiv.bat. Anders als start.sh laeuft
#  hier nicht der Entwicklungsmodus, der jede Seite erst beim
#  ersten Aufruf uebersetzt.
#
#  Aufruf:
#    ./start-produktiv.sh        startet, uebersetzt nur bei Bedarf
#    ./start-produktiv.sh neu    erzwingt eine Neuuebersetzung
# ============================================================
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

# --------------------------------------------------------------------
# M6.2: Schema-Abgleich OHNE stillen Datenverlust. Bewusste Freigabe:
#   OPENBON_ALLOW_DATA_LOSS=1 ./start-produktiv.sh
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

# Gewinnt gegen NODE_ENV in der .env: dotenv ueberschreibt
# bereits gesetzte Umgebungsvariablen nicht.
export NODE_ENV=production
export PORT="${PORT:-3000}"
export HA_ROLE="${HA_ROLE:-PRIMARY}"

APPVER=$(node -p "require('./package.json').version" 2>/dev/null || echo "unbekannt")

echo "========================================================"
echo "  OPENBON KASSENSYSTEM - VERSION v${APPVER}"
echo "  Betriebsart: PRODUKTIV"
echo "========================================================"
echo ""

echo "[1/5] Pruefe Abhaengigkeiten..."
if [ ! -d node_modules ]; then
  echo "      node_modules fehlt - installiere Pakete. Das dauert einige Minuten."
  npm install
else
  echo "      vorhanden."
fi

echo ""
echo "[2/5] Gleiche Datenbank-Schema ab..."
run_db_push

echo ""
echo "[3/5] Pruefe, ob eine Neuuebersetzung noetig ist..."
NEED_BUILD=1
if [ "${1:-}" = "neu" ]; then
  echo "      Neuuebersetzung wurde ausdruecklich angefordert."
elif [ -f .next/BUILD_ID ]; then
  # Gibt es eine Quelldatei, die neuer ist als der letzte Build?
  if [ -z "$(find src prisma public package.json next.config.mjs server.js \
              -newer .next/BUILD_ID -type f -print -quit 2>/dev/null)" ]; then
    NEED_BUILD=0
    echo "      Vorhandener Build ist aktuell - Uebersetzung wird uebersprungen."
  else
    echo "      Quellcode wurde geaendert."
  fi
else
  echo "      Es gibt noch keinen Produktions-Build."
fi

if [ "$NEED_BUILD" = "1" ]; then
  echo ""
  echo "[4/5] Uebersetze die Anwendung. Das dauert je nach Rechner 1-4 Minuten."
  rm -rf .next
  if ! npm run build; then
    echo ""
    echo "  FEHLER: Die Uebersetzung ist fehlgeschlagen."
    echo "  Der Server wurde NICHT gestartet, damit nicht unbemerkt ein"
    echo "  veralteter Stand ausgeliefert wird."
    exit 1
  fi
  echo "      Uebersetzung abgeschlossen."
else
  echo ""
  echo "[4/5] Uebersetzung nicht noetig - uebersprungen."
fi

echo ""
echo "[5/5] Bereite Sitzungsschluessel vor..."
# Legt den Schluessel an, BEVOR der Server startet. Dadurch prueft die
# Zugriffsschranke die Anmeldungen schon beim ersten Start.
node scripts/ensure-secret.js || true

echo ""
echo "========================================================"
echo "  Starte OpenBon im Produktionsbetrieb auf Port ${PORT}"
echo "  Lokal im Browser:    http://localhost:${PORT}"
echo "  Tablets / Mobil:     http://[DEINE-IP]:${PORT}"
echo "  Domain im Netz:      http://openbon.local:${PORT}"
echo "========================================================"
echo ""

node server.js
