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
echo Starte Standby-Server auf Port 3001 mit Heartbeat-Ueberwachung...
echo.
node server.js
pause
