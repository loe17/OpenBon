@echo off
title OpenBon - 1-Klick GitHub Veroeffentlichung
echo ======================================================================
echo   OPENBON - 1-KLICK GITHUB VEROEFFENTLICHUNG & SYNCHRONISATION
echo   Ziel: https://github.com/loe17/OpenBon
echo ======================================================================
echo.

:: 1. Pruefen ob Git installiert ist
where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [FEHLER] Git ist auf diesem PC nicht installiert!
    echo Bitte lade Git herunter: https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

:: 2. Git Repository initialisieren falls noetig
if not exist ".git" (
    echo [1/4] Initialisiere lokales Git Repository...
    git init
    git branch -M master
)

:: 3. Remote URL auf https://github.com/loe17/OpenBon.git pruefen und setzen
echo [2/4] Konfiguriere GitHub Remote Ziel (https://github.com/loe17/OpenBon.git)...
git remote remove origin >nul 2>nul
git remote add origin https://github.com/loe17/OpenBon.git

:: 4. Alle Dateien stagen und committen
echo [3/4] Erfasse alle geaenderten Dateien und erstelle Commit...
git add .

set COMMIT_MSG=OpenBon Release Update (%DATE% %TIME%)
git commit -m "%COMMIT_MSG%"

:: 5. Auf GitHub hochladen
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
    echo [HINWEIS] Falls GitHub nach Benutzername/Passwort fragt:
    echo Nutze als Passwort deinen 'GitHub Personal Access Token' (PAT).
    echo Erstelle ihn unter: https://github.com/settings/tokens
)

echo.
pause
