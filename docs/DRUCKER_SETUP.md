# 🖨️ ESC/POS Thermodrucker Einrichtung

OrderAssist Web steuert alle gängigen Thermobondrucker (Epson, Star, Munbyn, Bixolon, Metapace, etc.) über das standardisierte **ESC/POS-Protokoll** über TCP-Port **9100** (Raw Socket) an.

---

## ⚙️ Unterstützte Funktionen

- **Deutsche Umlaute & Euro-Symbol**: Native Konvertierung nach Zeichentabelle `CP858` (ä, ö, ü, Ä, Ö, Ü, ß, €).
- **Automatischer Papierschnitt**: Sendet `GS V 66 0` für sauberen Teil- oder Vollschnitt.
- **Kassenladen-Impuls**: Sendet `ESC p 0 25 250` an die RJ11/RJ12-Buchse des Bondruckers.
- **Bon-Splitting**: Teilt Bestellungen automatisch auf (z. B. Küche = 1 Einzelbon pro Schnitzel, Schenke = 4 Getränke pro Tablettbon).

---

## 🧪 Testen ohne echten Drucker

- Lege unter `/admin/printers` einfach einen Drucker mit der Option **"Als virtuellen Simulator-Drucker anlegen"** an.
- Unter `/virtual-printer` siehst du sofort alle Bons in echter Thermopapier-Optik.
