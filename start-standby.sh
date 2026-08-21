#!/bin/bash
export PORT=3001
export HA_ROLE=STANDBY
export HA_PARTNER_URL=http://127.0.0.1:3000

echo "========================================================"
echo "  OPENBON KASSENSYSTEM - HA STANDBY REPLICA"
echo "========================================================"
npx prisma db push --skip-generate
node server.js
