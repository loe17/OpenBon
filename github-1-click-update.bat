@echo off
title OpenBon - 1-Klick GitHub Update
echo ======================================================================
echo   OPENBON - 1-KLICK SYSTEM-UPDATE VON GITHUB
echo   Quelle: https://github.com/loe17/OpenBon
echo ======================================================================
echo.

where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [FEHLER] Git ist auf diesem PC nicht installiert!
    pause
    exit /b 1
)

echo [1/4] Lade neuesten Code von GitHub herunter (git pull)...
git pull origin master

echo [2/4] Aktualisiere Abhaengigkeiten (npm install)...
call npm install --production=false

echo [3/4] Aktualisiere Datenbankstruktur (prisma db push)...
call npx prisma db push --skip-generate

echo [4/4] Baue Produktions-Version (npm run build)...
call npm run build

echo.
echo ======================================================================
echo   [ERFOLG] OpenBon wurde erfolgreich auf den neuesten Stand gebracht!
echo   Starte das System nun mit 'start-primary.bat'.
echo ======================================================================
echo.
pause
