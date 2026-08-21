#!/bin/bash
export PORT=3000
export HA_ROLE=PRIMARY
export HA_PARTNER_URL=http://127.0.0.1:3001

echo "========================================================"
echo "  ORDERASSIST WEB KASSENSYSTEM - HA PRIMARY MASTER"
echo "========================================================"
npx prisma db push --skip-generate
node server.js
