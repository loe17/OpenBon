# OpenBon - GitHub Veröffentlichungs- & Update-Leitfaden für Windows

Diese Anleitung zeigt dir Schritt für Schritt, wie du **OpenBon** aus dem Windows Explorer auf deinem GitHub-Repository **[https://github.com/loe17/OpenBon](https://github.com/loe17/OpenBon)** veröffentlichst und künftig mit einem Klick aktualisierst.

---

## 1. Methode 1: 1-Klick Schnell-Veröffentlichung (Empfohlen)

Im OpenBon-Projektordner findest du zwei vorgefertigte Batch-Dateien:

### Erstmaliges Hochladen & spätere Updates veröffentlichen:
1. Öffne den Projektordner `Kassensystem` im Windows Explorer.
2. Mache einen **Doppelklick auf `github-1-click-publish.bat`**.
3. Das Skript:
   - Verknüpft deinen Ordner automatisch mit `https://github.com/loe17/OpenBon.git`.
   - Erfasst alle geänderten Dateien.
   - Erstellt einen Commit mit aktuellem Zeitstempel.
   - Lädt alles per `git push` auf dein GitHub-Repository hoch.

---

## 2. GitHub Authentifizierung unter Windows (Einmalig)

Wenn du das erste Mal auf GitHub hochlädst, fragt Windows/Git nach deinen Zugangsdaten:

1. **GitHub Anmeldefenster**:
   - Wenn das Browser-Fenster aufpoppt, klicke einfach auf **"Sign in with your browser"** und bestätige den Zugriff.
2. **Alternativ mit Personal Access Token (PAT)**:
   - Da GitHub seit 2021 keine reinen Account-Passwörter bei `git push` mehr akzeptiert, erstelle einen Token:
     1. Öffne [github.com/settings/tokens](https://github.com/settings/tokens).
     2. Klicke auf **"Generate new token (classic)"**.
     3. Gib als Notiz z. B. `OpenBon-Windows` ein und setze den Haken bei **`repo`** (Full control of private repositories).
     4. Klicke unten auf **"Generate token"** und kopiere den Code (z. B. `ghp_xxxxxxxxxxxx`).
     5. Wenn Git im Terminal nach deinem Passwort fragt, füge diesen Token ein!

---

## 3. Methode 2: Über GitHub Desktop (Grafische Oberfläche)

Falls du eine grafische Benutzeroberfläche bevorzugst:

1. Lade [GitHub Desktop](https://desktop.github.com/) herunter und installiere es.
2. Melde dich in GitHub Desktop mit deinem Account `loe17` an.
3. Klicke im Menü auf **File -> Add Local Repository...**
4. Wähle deinen OpenBon-Ordner aus (`c:\Users\Lukas\Documents\GeminiTemp\Kassensystem`).
5. Klicke oben rechts auf **"Publish repository"** und wähle `loe17/OpenBon`.
6. Wenn du künftig Dateien änderst:
   - Siehst du links alle Änderungen.
   - Unten links: Gib eine Nachricht ein (z. B. *"Update Preisliste"*).
   - Klicke auf **"Commit to master"** und danach oben auf **"Push origin"**.

---

## 4. Updates von GitHub auf den Kassen-PC herunterladen

Wenn du oder ein Teammitglied Änderungen auf GitHub hochgeladen hat und du deinen Haupt-PC oder Laptop auf den neuesten Stand bringen möchtest:

1. Öffne den Projektordner im Windows Explorer.
2. Mache einen **Doppelklick auf `github-1-click-update.bat`**.
3. Das Skript lädt automatisch alle Neuerungen herunter, aktualisiert die Datenbank und baut das System neu.

---

## 5. Web-Konsole im Adminbereich (Browser)

Du kannst Updates auch direkt im laufenden Betrieb über die Weboberfläche prüfen und installieren:
1. Öffne OpenBon im Browser und gehe zu **Verwaltung -> System-Update & Konsole** (`/admin/system-update`).
2. Klicke auf **"Auf Updates prüfen"** oder **"Update jetzt installieren"**.
