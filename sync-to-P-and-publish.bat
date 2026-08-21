@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

title OpenBon - Sync von C: nach P:\Projekte\OpenBon und GitHub Push
echo ======================================================================
echo   OPENBON - SYNC VON C: NACH P:\Projekte\OpenBon & GITHUB PUSH
echo   Quelle: C:\Users\Lukas\Documents\GeminiTemp\Kassensystem
echo   Ziel:   P:\Projekte\OpenBon -> https://github.com/loe17/OpenBon
echo ======================================================================
echo.

set SOURCE_DIR=%~dp0
set TARGET_DIR=P:\Projekte\OpenBon

REM 1. Zielordner auf P: erstellen falls noetig
if not exist "%TARGET_DIR%" (
    echo [1/4] Erstelle Zielordner %TARGET_DIR%...
    mkdir "%TARGET_DIR%" 2>nul
)

REM 2. Synchronisiere alle Dateien von C: nach P: (ohne temporaere Cache-Ordner)
echo [2/4] Kopiere geaenderte Projektdateien nach P:\Projekte\OpenBon...
robocopy "%SOURCE_DIR%." "%TARGET_DIR%." /E /XD node_modules .next .git .system_generated .gemini /XF dev.db dev.db-journal *.log /NDL /NFL /NJH /NJS /nc /ns /np

REM 3. In P:\Projekte\OpenBon wechseln und Git konfigurieren
echo [3/4] Wechsle nach %TARGET_DIR% und konfiguriere Git...
cd /d "%TARGET_DIR%"

git config --global --add safe.directory * >nul 2>nul
git config --global --add safe.directory "P:/Projekte/OpenBon" >nul 2>nul

if not exist .git (
    git init
    git branch -M master
)

git remote remove origin >nul 2>nul
git remote add origin https://github.com/loe17/OpenBon.git

REM 4. In P: committen und zu GitHub pushen
echo [4/4] Committe und lade von P:\Projekte\OpenBon zu GitHub hoch...
git add .
git commit -m "OpenBon Sync & Release Update (%DATE% %TIME%)" >nul 2>nul
git push -u origin master --force

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ======================================================================
    echo   [ERFOLG] Alle Daten wurden von C: nach P:\Projekte\OpenBon kopiert
    echo   und erfolgreich auf https://github.com/loe17/OpenBon veroeffentlicht!
    echo ======================================================================
) else (
    echo.
    echo ======================================================================
    echo   [HINWEIS ZUR GITHUB-ANMELDUNG]
    echo   Falls GitHub nach Benutzername/Passwort fragt:
    echo   1. Benutzername: loe17
    echo   2. Passwort: Dein GitHub Personal Access Token [PAT]
    echo ======================================================================
)

echo.
echo Druecke eine beliebige Taste zum Schliessen...
pause >nul
