#!/bin/bash
export PORT=3001
export HA_ROLE=STANDBY
export HA_PARTNER_URL=http://127.0.0.1:3000

echo "========================================================"
echo "  OPENBON KASSENSYSTEM - HA STANDBY REPLICA"
echo "========================================================"

# M6.2: kein stiller Datenverlust - siehe start.sh fuer Details
run_db_push() {
  local push_output code
  push_output=$(npx prisma db push --skip-generate 2>&1)
  code=$?
  if [ "$code" -eq 0 ]; then return 0; fi
  if printf '%s' "$push_output" | grep -qi "data loss"; then
    if [ "${OPENBON_ALLOW_DATA_LOSS:-}" = "1" ]; then
      npx prisma db push --accept-data-loss --skip-generate
      return $?
    fi
    printf '%s\n' "$push_output"
    echo "[ABBRUCH] Datenverlust wuerde entstehen - Freigabe: OPENBON_ALLOW_DATA_LOSS=1"
    exit 1
  fi
  printf '%s\n' "$push_output"
  exit "$code"
}
run_db_push

node server.js
