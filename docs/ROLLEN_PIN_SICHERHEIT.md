# Rollenverwaltung & PIN-Sicherheit in OpenBon

OpenBon bietet eine flexible Schutzarchitektur, um unbefugte Zugriffe auf Preise, Berichte und Systemeinstellungen zu verhindern.

---

## 1. Rollenübersicht

| Rolle | Pfad | Beschreibung | Berechtigung |
|---|---|---|---|
| **Bedienung** | `/waiter` | Kellner-Handys | Tischplan, Bestellaufnahme, Sonderwünsche, Rechnungs-Splitting |
| **Bonkasse** | `/pos` | Theken-Kassen | Schnellverkauf, Gutscheinbons, Kassenladen-Impuls |
| **Küche (KDS)** | `/kitchen` | Küchen-Monitore | Auftragsspalten, Wartezeit-Ampel, Rückstandsanzeige |
| **Drucker-Monitor** | `/virtual-printer` | Vorschau-Bildschirme | Virtuelle Bon-Anzeige in Thermopapier-Optik |
| **Administrator** | `/admin/*` | Leitung & Setup | Preislisten, Tischplan, Drucker, Geräte, Berichte, Z-Bon, Backups |

---

## 2. Stations-Lock & PIN-Schutz

### Schutz der Administration:
- Der gesamte Bereich unter `/admin/*` ist durch einen **4-stelligen Admin-PIN** geschützt (Standard: `1234`).
- Beim Versuch, über die Navigation oder URL auf Admin-Funktionen zuzugreifen, erscheint automatisch das **Touch-PIN-Pad**.
- Nach erfolgreicher Eingabe bleibt die Admin-Sitzung im Browser-Tab freigeschaltet.

### Stations-Lock für Helfer-Smartphones:
- Gib Helfern einfach den **QR-Code** für ihre jeweilige Station (z. B. Kellner-Modus).
- Das Smartphone wird auf die Route `/waiter` geleitet und kann dort autonom arbeiten.
- Helfer können nicht versehentlich in den Admin-Bereich wechseln oder Preise verändern, da dafür der Admin-PIN verlangt wird.

---

## 3. Ändern des Admin-PINs
1. Navigiere als Admin zu **Einstellungen & Backup** (`/admin/settings`).
2. Scrolle zum Abschnitt **Admin-PIN ändern**.
3. Gib den aktuellen PIN ein und wähle einen neuen 4- bis 6-stelligen Zahlencode.
4. Klicke auf **"Neuen PIN speichern"**.
