@echo off
setlocal enabledelayedexpansion

REM Arbeitsverzeichnis auf Ordner dieser Batch-Datei festlegen
cd /d "%~dp0"

REM Behebt die Git-Meldung 'detected dubious ownership' auf Netzlaufwerken / P:
git config --global --add safe.directory * >nul 2>nul
git config --global --add safe.directory "%~dp0" >nul 2>nul

title OpenBon - 1-Klick GitHub Veroeffentlichung
echo ======================================================================
echo   OPENBON - 1-KLICK GITHUB VEROEFFENTLICHUNG
echo   Arbeitsordner: %~dp0
echo   Ziel:          https://github.com/loe17/OpenBon
echo ======================================================================
echo.

REM 1. Pruefen ob Git installiert ist
where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [FEHLER] Git ist auf diesem PC nicht installiert oder nicht im PATH!
    echo Bitte lade Git fuer Windows herunter: https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

REM 2. Git Repository initialisieren falls noch nicht vorhanden
if not exist .git (
    echo [1/4] Initialisiere lokales Git Repository...
    git init
    git branch -M master
)

REM 3. Remote URL auf https://github.com/loe17/OpenBon.git setzen
echo [2/4] Konfiguriere GitHub Remote Ziel: https://github.com/loe17/OpenBon.git
git remote remove origin >nul 2>nul
git remote add origin https://github.com/loe17/OpenBon.git

REM 4. Alle Dateien erfassen und committen
echo [3/4] Erfasse geaenderte Dateien und erstelle Commit...
git add .
git commit -m "OpenBon Release Update" >nul 2>nul

REM 5. Auf GitHub hochladen
echo [4/4] Lade Daten auf GitHub hoch [git push origin master]...
echo.
git push -u origin master --force

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ======================================================================
    echo   [ERFOLG] OpenBon wurde erfolgreich auf GitHub veroeffentlicht!
    echo   Repository-URL: https://github.com/loe17/OpenBon
    echo ======================================================================
) else (
    echo.
    echo ======================================================================
    echo   [HINWEIS ZUR GITHUB-ANMELDUNG]
    echo   Falls GitHub nach Benutzername oder Passwort fragt:
    echo   1. Benutzername: loe17
    echo   2. Passwort: Dein GitHub Personal Access Token [PAT]
    echo      Erstelle ihn unter: https://github.com/settings/tokens
    echo ======================================================================
)

echo.
echo Druecke eine beliebige Taste zum Schliessen...
pause >nul
