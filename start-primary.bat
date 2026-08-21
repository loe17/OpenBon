@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

title OpenBon - HA PRIMARY MASTER (Port 3000)
echo ========================================================
echo   OPENBON KASSENSYSTEM - HA PRIMARY MASTER
echo ========================================================
echo.
set PORT=3000
set HA_ROLE=PRIMARY
set HA_PARTNER_URL=http://127.0.0.1:3001

echo Initialisiere Datenbank...
call npx prisma db push --skip-generate
echo.
echo Starte Server auf Port 3000...
echo Oeffne im Browser: http://localhost:3000 oder die lokale WLAN-IP
echo.
node server.js
pause
