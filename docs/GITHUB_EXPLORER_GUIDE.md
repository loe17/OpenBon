# OpenBon - GitHub Leitfaden (Arbeiten auf C: & Veröffentlichen über P:)

Dieser Leitfaden beschreibt deinen genauen Workflow:
- **Lokaler Arbeitsordner**: `C:\Users\Lukas\Documents\GeminiTemp\Kassensystem` (reine Entwicklung, unabhängig von GitHub)
- **Haupt-Projektordner**: `P:\Projekte\OpenBon` (verknüpft mit GitHub `https://github.com/loe17/OpenBon`)

---

## 1. Lösung für den Fehler "fatal: detected dubious ownership in repository at 'P:/Projekte/OpenBon'"

Dieser Fehler tritt bei Git auf Netzlaufwerken oder externen Laufwerken (`P:`) auf.
Er wurde bereits **vollautomatisch in allen Skripten behoben** durch den globalen Befehl:
```cmd
git config --global --add safe.directory *
```
Dadurch akzeptiert Git das Laufwerk `P:` dauerhaft ohne Sicherheitswarnung.

---

## 2. Der 1-Klick Workflow

### Option A: Direkt von C: nach P: synchronisieren und auf GitHub hochladen (Empfohlen)
1. Wenn du in `C:\Users\Lukas\Documents\GeminiTemp\Kassensystem` fertig gearbeitet hast:
2. Mache einen **Doppelklick auf `sync-to-P-and-publish.bat`**.
3. Das Skript:
   - Kopiert automatisch alle neuen und geänderten Dateien von `C:` nach `P:\Projekte\OpenBon`.
   - Schließt temporäre Dateien (`node_modules`, `.next`, etc.) intelligent aus.
   - Setzt `safe.directory` für Laufwerk `P:`.
   - Committet und pusht alles von `P:\Projekte\OpenBon` direkt auf **`https://github.com/loe17/OpenBon`**.

### Option B: Direkt in `P:\Projekte\OpenBon` arbeiten
- **Veröffentlichen**: Doppelklick auf `github-1-click-publish.bat` in `P:\Projekte\OpenBon`.
- **Updates von GitHub ziehen**: Doppelklick auf `github-1-click-update.bat` in `P:\Projekte\OpenBon`.

---

## 3. Web-Konsole im Adminbereich

Du kannst Updates auch im laufenden Kassenbetrieb prüfen und einspielen:
- Öffne **Verwaltung -> System-Update & Konsole** (`/admin/system-update`).
- Klicke auf **"Auf Updates prüfen"** oder **"Update installieren"**.
