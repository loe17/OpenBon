@echo off
setlocal enabledelayedexpansion

REM Stelle sicher, dass das Arbeitsverzeichnis der Ordner dieser Batch-Datei ist
cd /d "%~dp0"

title OpenBon - 1-Klick GitHub Veroeffentlichung
echo ======================================================================
echo   OPENBON - 1-KLICK GITHUB VEROEFFENTLICHUNG
echo   Ziel: https://github.com/loe17/OpenBon
echo ======================================================================
echo.

REM 1. Pruefen ob Git installiert ist
where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [FEHLER] Git ist auf diesem PC nicht installiert oder nicht im PATH!
    echo Bitte lade Git fuer Windows herunter:
    echo https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

REM 2. Git Repository initialisieren falls noetig
if not exist ".git" (
    echo [1/4] Initialisiere lokales Git Repository...
    git init
    git branch -M master
)

REM 3. Remote URL auf https://github.com/loe17/OpenBon.git setzen
echo [2/4] Konfiguriere GitHub Remote Ziel (https://github.com/loe17/OpenBon.git)...
git remote remove origin >nul 2>nul
git remote add origin https://github.com/loe17/OpenBon.git

REM 4. Alle Dateien erfassen und committen
echo [3/4] Erfasse Dateien und erstelle Commit...
git add .
git commit -m "OpenBon Release Update" >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo   -> Aenderungen wurden erfasst und committet.
) else (
    echo   -> Keine neuen lokalen Datei-Aenderungen gefunden (bereits aktuell).
)

REM 5. Auf GitHub hochladen
echo [4/4] Lade Daten auf GitHub hoch (git push origin master)...
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
    echo   Falls GitHub nach Benutzername/Passwort fragt:
    echo   1. Benutzername: loe17
    echo   2. Passwort: Dein GitHub Personal Access Token (PAT)
    echo      (Erstelle ihn unter https://github.com/settings/tokens)
    echo ======================================================================
)

echo.
echo Druecke eine beliebige Taste zum Beenden...
pause >nul
