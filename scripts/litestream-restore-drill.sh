#!/usr/bin/env bash
# =============================================================================
# OpenBon – Litestream Restore-Drill
# -----------------------------------------------------------------------------
# Prüft regelmäßig, dass ein Backup wirklich wiederherstellbar ist.
# Ein Backup ohne getesteten Restore ist kein Backup!
#
# Empfehlung: nächtlich per Cron ausführen, z. B.
#   15 3 * * * /opt/openbon/scripts/litestream-restore-drill.sh >> /var/log/openbon-restore-drill.log 2>&1
# =============================================================================
set -euo pipefail

DB_PATH="${OPENBON_DB:-./prisma/dev.db}"
REPLICA_DIR="${OPENBON_REPLICA:-./prisma/backups/litestream-replica}"
DRILL_DIR="${OPENBON_DRILL_DIR:-/tmp/openbon-restore-drill}"
MAX_AGE_SECONDS="${OPENBON_MAX_REPLICA_AGE:-600}"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESTORED_DB="$DRILL_DIR/restored-$TIMESTAMP.db"

echo "[DRILL] Starte Restore-Drill $(date)"

# 1. Replikat-Frische prüfen
if [ ! -d "$REPLICA_DIR" ]; then
  echo "[DRILL][ERROR] Replikatverzeichnis $REPLICA_DIR existiert nicht!"
  exit 1
fi

NEWEST=$(find "$REPLICA_DIR" -name '*.db' -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2- || true)
if [ -z "$NEWEST" ]; then
  echo "[DRILL][ERROR] Keine Replikatdateien in $REPLICA_DIR gefunden!"
  exit 1
fi

AGE=$(( $(date +%s) - $(stat -c %Y "$NEWEST" 2>/dev/null || stat -f %m "$NEWEST") ))
echo "[DRILL] Neuestes Replikat: $NEWEST (Alter: ${AGE}s)"
if [ "$AGE" -gt "$MAX_AGE_SECONDS" ]; then
  echo "[DRILL][WARNING] Replikat älter als ${MAX_AGE_SECONDS}s – Litestream läuft evtl. nicht!"
fi

# 2. Wiederherstellung in isoliertes Verzeichnis
mkdir -p "$DRILL_DIR"
rm -f "$RESTORED_DB"

if command -v litestream >/dev/null 2>&1; then
  # Vollständiger Restore inkl. WAL über Litestream (bevorzugt)
  litestream restore -o "$RESTORED_DB" "$NEWEST"
else
  echo "[DRILL][INFO] litestream nicht gefunden – nutze direkte Dateikopie."
  cp "$NEWEST" "$RESTORED_DB"
fi

# 3. Integritätsprüfung der wiederhergestellten DB
INTEGRITY=$(sqlite3 "$RESTORED_DB" "PRAGMA integrity_check;" 2>/dev/null || echo "SQLITE3_FEHLT")
if [ "$INTEGRITY" = "ok" ]; then
  COUNTS=$(sqlite3 "$RESTORED_DB" "SELECT 'orders='||(SELECT count(*) FROM Order)||' payments='||(SELECT count(*) FROM Payment);" 2>/dev/null || echo "n/a")
  echo "[DRILL][OK] Wiederhergestellte DB intakt ($COUNTS)."
else
  echo "[DRILL][ERROR] Integritätscheck fehlgeschlagen: $INTEGRITY"
  exit 1
fi

# 4. Alte Drill-Artefakte aufräumen (älter als 7 Tage)
find "$DRILL_DIR" -name 'restored-*.db' -type f -mtime +7 -delete 2>/dev/null || true

echo "[DRILL] Restore-Drill erfolgreich abgeschlossen."
