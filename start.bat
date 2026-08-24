@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

title OpenBon Kassensystem (Port 3000)
echo ========================================================
echo   OPENBON KASSENSYSTEM - VOLLVERSION V2
echo ========================================================
echo.

set PORT=3000
set HA_ROLE=PRIMARY

echo [1/2] Pruefe und synchronisiere Datenbank-Schema...
call npx prisma db push --skip-generate
if %ERRORLEVEL% neq 0 (
  echo Fehler beim Initialisieren der Datenbank!
  pause
  exit /b %ERRORLEVEL%
)

echo.
echo [2/2] Starte OpenBon Server auf Port 3000...
echo ========================================================
echo   Lokal im Browser:    http://localhost:3000
echo   Tablets / Mobil:     http://[DEINE-IP]:3000
echo ========================================================
echo.

node server.js
pause
