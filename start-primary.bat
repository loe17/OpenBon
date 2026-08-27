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
REM M6.2: kein stiller Datenverlust (Freigabe: set OPENBON_ALLOW_DATA_LOSS=1)
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
      echo   ABBRUCH: Datenverlust wuerde entstehen. Freigabe via
      echo     set OPENBON_ALLOW_DATA_LOSS=1  und Neustart dieses Skripts.
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
)
if exist "%TEMP%\openbon_dbpush.out" del "%TEMP%\openbon_dbpush.out" >nul 2>&1
echo.
echo Starte Server auf Port 3000...
echo Oeffne im Browser: http://localhost:3000 oder die lokale WLAN-IP
echo.
node server.js
pause
