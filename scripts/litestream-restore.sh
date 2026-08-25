#!/bin/bash
# OpenBon Litestream Notfall-Wiederherstellung (Disaster Recovery)
# Stellt die SQLite-Datenbank aus der Litestream-Replikation auf den exakten Sekundentakt wieder her.

set -e

BACKUP_SOURCE="${1:-/media/usb/openbon-litestream}"
TARGET_DB="${2:-./prisma/dev.db}"

echo "=================================================="
echo "[OPENBON NOTFALL-RESTORE]"
echo "Quelle: $BACKUP_SOURCE"
echo "Ziel:   $TARGET_DB"
echo "=================================================="

if [ ! -d "$BACKUP_SOURCE" ]; then
  echo "[FEHLER] Backup-Quelle '$BACKUP_SOURCE' nicht gefunden!"
  echo "Prüfe, ob der USB-Stick eingesteckt ist oder gib den Pfad an:"
  echo "Usage: ./scripts/litestream-restore.sh [QUELLPFAD] [ZIEL_DB]"
  exit 1
fi

# Server stoppen falls aktiv
if command -v systemctl &> /dev/null; then
  echo "[1/3] Stoppe OpenBon-Dienst..."
  systemctl stop openbon || true
fi

# Alte DB sichern falls vorhanden
if [ -f "$TARGET_DB" ]; then
  echo "[2/3] Sichere aktuelle defekte DB nach ${TARGET_DB}.corrupt-$(date +%s)..."
  mv "$TARGET_DB" "${TARGET_DB}.corrupt-$(date +%s)" || true
  rm -f "${TARGET_DB}-wal" "${TARGET_DB}-shm" || true
fi

# Restore mit Litestream
echo "[3/3] Führe Litestream Restore durch..."
litestream restore -o "$TARGET_DB" -config ./litestream.yml "$TARGET_DB" || \
litestream restore -o "$TARGET_DB" "$BACKUP_SOURCE"

echo "=================================================="
echo "[ERFOLG] Datenbank erfolgreich wiederhergestellt!"
echo "Du kannst OpenBon jetzt mit 'systemctl start openbon' starten."
echo "=================================================="
