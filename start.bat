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

REM M6.2: Schema-Abgleich OHNE stillen Datenverlust. Nur mit expliziter
REM Freigabe (set OPENBON_ALLOW_DATA_LOSS=1) werden Daten veraenderungen akzeptiert.
call npx prisma db push --skip-generate > "%TEMP%\openbon_dbpush.out" 2>&1
if !ERRORLEVEL! neq 0 (
  findstr /i /c:"data loss" "%TEMP%\openbon_dbpush.out" >nul 2>&1
  if !ERRORLEVEL! equ 0 (
    type "%TEMP%\openbon_dbpush.out"
    echo.
    if /i "!OPENBON_ALLOW_DATA_LOSS!"=="1" (
      echo   Freigabe aktiv - Abgleich MIT Datenverlustrisiko wird ausgefuehrt...
      call npx prisma db push --accept-data-loss --skip-generate
    ) else (
      echo   ABBRUCH: Das neue Schema wuerde bestehende Daten verlieren.
      echo   Es wurde NICHTS geloescht. Backup ziehen und dann bewusst freigeben:
      echo     set OPENBON_ALLOW_DATA_LOSS=1
      if exist "%TEMP%\openbon_dbpush.out" del "%TEMP%\openbon_dbpush.out" >nul 2>&1
      pause
      exit /b 1
    )
  ) else (
    type "%TEMP%\openbon_dbpush.out"
    echo.
    echo   FEHLER beim Initialisieren der Datenbank!
    if exist "%TEMP%\openbon_dbpush.out" del "%TEMP%\openbon_dbpush.out" >nul 2>&1
    pause
    exit /b 1
  )
) else (
  echo       Datenbank-Schema ist aktuell.
)
if exist "%TEMP%\openbon_dbpush.out" del "%TEMP%\openbon_dbpush.out" >nul 2>&1

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
