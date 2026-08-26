@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

REM Version aus package.json lesen, damit hier nie wieder eine veraltete
REM Nummer steht (stand zuvor fest auf v0.2.1, waehrend v0.3.8 lief).
for /f "usebackq tokens=2 delims=:," %%v in (`findstr /r /c:"\"version\"" package.json`) do (
  set RAWVER=%%v
  goto :gotver
)
:gotver
set APPVER=!RAWVER: =!
set APPVER=!APPVER:"=!
if "!APPVER!"=="" set APPVER=unbekannt

title OpenBon Kassensystem (v!APPVER!)
echo ========================================================
echo   OPENBON KASSENSYSTEM - VERSION v!APPVER!
echo ========================================================
echo.

set PORT=3000
set HA_ROLE=PRIMARY

echo [1/2] Pruefe und synchronisiere Datenbank-Schema...
call npx prisma db push --accept-data-loss --skip-generate
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

REM Sitzungsschluessel anlegen, bevor der Server startet
call node scripts\ensure-secret.js

node server.js
pause
