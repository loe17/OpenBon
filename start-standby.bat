@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

title OpenBon - HA STANDBY REPLICA (Port 3001)
echo ========================================================
echo   OPENBON KASSENSYSTEM - HA STANDBY REPLICA
echo ========================================================
echo.
set PORT=3001
set HA_ROLE=STANDBY
set HA_PARTNER_URL=http://127.0.0.1:3000

echo Initialisiere Datenbank...
call npx prisma db push --skip-generate
echo.
echo Starte Standby-Server auf Port 3001 mit Heartbeat-Ueberwachung...
echo.
node server.js
pause
