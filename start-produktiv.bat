@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

REM ============================================================
REM  OpenBon - Start im PRODUKTIONSBETRIEB
REM
REM  Unterschied zu start.bat: dort laeuft der Entwicklungsmodus,
REM  der jede Seite erst beim ersten Aufruf uebersetzt (der erste
REM  Seitenaufruf dauerte zuletzt 49 Sekunden). Hier wird einmal
REM  vollstaendig uebersetzt, danach laden alle Seiten sofort.
REM
REM  Aufruf:
REM    start-produktiv.bat        normaler Start (uebersetzt nur bei Bedarf)
REM    start-produktiv.bat neu    erzwingt eine vollstaendige Neuuebersetzung
REM ============================================================

set FORCE_BUILD=0
if /i "%~1"=="neu" set FORCE_BUILD=1

REM --- Version aus package.json lesen, damit sie nie veraltet ---
for /f "usebackq tokens=2 delims=:," %%v in (`findstr /r /c:"\"version\"" package.json`) do (
  set RAWVER=%%v
  goto :gotver
)
:gotver
set APPVER=!RAWVER: =!
set APPVER=!APPVER:"=!
if "!APPVER!"=="" set APPVER=unbekannt

title OpenBon Kassensystem (v!APPVER!) - PRODUKTIV
echo ========================================================
echo   OPENBON KASSENSYSTEM - VERSION v!APPVER!
echo   Betriebsart: PRODUKTIV
echo ========================================================
echo.

REM Diese Zuweisung gewinnt gegen NODE_ENV in der .env:
REM dotenv ueberschreibt gesetzte Umgebungsvariablen nicht.
set NODE_ENV=production
if "%PORT%"=="" set PORT=3000
if "%HA_ROLE%"=="" set HA_ROLE=PRIMARY

REM ---------------------------------------------------------------
echo [1/5] Pruefe Abhaengigkeiten...
if not exist "node_modules" (
  echo       node_modules fehlt - installiere Pakete. Das dauert einige Minuten.
  call npm install
  if !ERRORLEVEL! neq 0 (
    echo.
    echo   FEHLER: npm install ist fehlgeschlagen. Server wurde nicht gestartet.
    pause
    exit /b !ERRORLEVEL!
  )
) else (
  echo       vorhanden.
)

REM ---------------------------------------------------------------
echo.
echo [2/5] Gleiche Datenbank-Schema ab...
call npx prisma db push --accept-data-loss --skip-generate
if !ERRORLEVEL! neq 0 (
  echo.
  echo   FEHLER: Das Datenbank-Schema konnte nicht abgeglichen werden.
  echo   Server wurde NICHT gestartet - bitte Meldung oben pruefen.
  pause
  exit /b !ERRORLEVEL!
)

REM ---------------------------------------------------------------
echo.
echo [3/5] Pruefe, ob eine Neuuebersetzung noetig ist...

set NEED_BUILD=1
if "!FORCE_BUILD!"=="1" (
  echo       Neuuebersetzung wurde ausdruecklich angefordert.
) else (
  REM Vergleicht den Zeitstempel des letzten Produktions-Builds mit
  REM allen Quelldateien. Nur wenn etwas neuer ist, wird uebersetzt.
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$b = Get-Item '.next\BUILD_ID' -ErrorAction SilentlyContinue; if (-not $b) { exit 1 }; $neuer = Get-ChildItem -Path 'src','prisma','public','package.json','next.config.mjs','server.js' -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -gt $b.LastWriteTime } | Select-Object -First 1; if ($neuer) { exit 1 } else { exit 0 }"
  if !ERRORLEVEL! equ 0 (
    set NEED_BUILD=0
    echo       Vorhandener Build ist aktuell - Uebersetzung wird uebersprungen.
  ) else (
    echo       Quellcode wurde geaendert oder es gibt noch keinen Produktions-Build.
  )
)

if "!NEED_BUILD!"=="1" (
  echo.
  echo [4/5] Uebersetze die Anwendung. Das dauert je nach Rechner 1-4 Minuten.
  echo       Bitte dieses Fenster NICHT schliessen.
  if exist ".next" rmdir /s /q ".next"
  call npm run build
  if !ERRORLEVEL! neq 0 (
    echo.
    echo   FEHLER: Die Uebersetzung ist fehlgeschlagen.
    echo   Der Server wurde NICHT gestartet, damit nicht unbemerkt ein
    echo   veralteter Stand ausgeliefert wird.
    echo.
    echo   Zum Weiterarbeiten notfalls start.bat verwenden ^(Entwicklungsmodus^).
    pause
    exit /b !ERRORLEVEL!
  )
  echo       Uebersetzung abgeschlossen.
) else (
  echo.
  echo [4/5] Uebersetzung nicht noetig - uebersprungen.
)

REM ---------------------------------------------------------------
echo.
echo [5/5] Bereite Sitzungsschluessel vor...
REM Legt den Schluessel an, BEVOR der Server startet. Dadurch prueft die
REM Zugriffsschranke die Anmeldungen schon beim ersten Start - ein zweiter
REM Startdurchlauf ist nicht mehr noetig.
call node scripts\ensure-secret.js

echo.
echo ========================================================
echo   Starte OpenBon im Produktionsbetrieb auf Port %PORT%
echo   Lokal im Browser:    http://localhost:%PORT%
echo   Tablets / Mobil:     http://[DEINE-IP]:%PORT%
echo   Domain im Netz:      http://openbon.local:%PORT%
echo ========================================================
echo.

node server.js

echo.
echo Der Server wurde beendet.
pause
