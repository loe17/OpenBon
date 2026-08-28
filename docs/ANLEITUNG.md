# OpenBon - Vollständige Bedienungsanleitung

Willkommen bei **OpenBon**, dem plattformunabhängigen, hochverfügbaren Kassensystem für Vereinsfeste, Gastronomie und Events.

---

## 1. Schnellstart in 3 Schritten

1. **Server starten**:
   - Starte auf deinem Haupt-PC einfach die Datei `start-primary.bat` (Windows) oder `./start-primary.sh` (Linux/Mac).
   - Der Server öffnet Port **3000** und ist sofort betriebsbereit.
2. **Geräte verbinden**:
   - Verbinde Smartphones, Tablets oder Theken-Touchscreens mit demselben WLAN.
   - Öffne im Webbrowser die IP-Adresse des Servers (z. B. `http://192.168.1.100:3000`) oder scanne den QR-Code aus dem **QR-Code Beitritts-Center** (`/admin/qr-codes`).
3. **Station auswählen**:
   - Wähle auf der Startseite deine Station (**Bedienung**, **Bonkasse**, **Küchenmonitor** oder **Verwaltung**).

---

## 2. Die Stationen im Detail

### 1. Bedienung / Service (Kellner-Smartphone)
- **Tischübersicht**: Zeigt alle Tische mit Farbcodierung (Grau = Frei, Gelb/Orange = Belegt mit offenen Posten und Gesamtsumme).
- **Bestellaufnahme**:
  - Schnellauswahl nach Warengruppen (Getränke, Speisen, etc.).
  - Schnelle Mengenänderung per `+` / `-`.
  - **1-Klick-Sonderwünsche**: Tippe auf einen Artikel im Korb, um blitzschnell Wortgruppen wie `"ohne Zwiebeln"` oder `"extra Soße"` auszuwählen.
  - Mit Klick auf **"Bestellen"** wird der Auftrag sofort an die zuständigen Drucker (Küche, Schenke) und den Küchenmonitor gesendet.
- **Kassieren & Rechnungs-Splitting (Teilzahlung)**:
  - Wähle pro Gast nur die tatsächlich zu zahlenden Positionen aus.
  - **Rückpfand**: Erfasse zurückgegebenes Leergut (1€, 2€) direkt im Kassierdialog – wird automatisch vom Betrag abgezogen.
  - **Rückgeld-Rechner**: Schnelltasten für 10€, 20€, 50€, 100€ berechnen sofort das korrekte Wechselgeld.
  - Zahlarten: Bar, Karte (SumUp / Terminal), Rabatt, Personal/Bewirtung.

### 2. Bonkasse / Thekenverkauf (Counter Express)
- Für den Direktverkauf an der Theke ohne Tischauswahl.
- Unterstützt 3 Modi:
  1. *Nur Kassieren*
  2. *Gutscheinbon für den Gast*
  3. *Gutschein + Gegenbon (Abholmarke mit fortlaufender Nummer)*
- Kassenlade springt bei Barzahlung automatisch auf.

### 3. Küchenmonitor (KDS)
- Zeigt alle offenen Zubereitungsaufträge in Echtzeit.
- **Dringlichkeits-Ampel**: Zeigt die Wartezeit in Minuten (Grün -> Gelb -> Rot bei >10 min).
- **Rückstandszähler**: Zeigt oben in Echtzeit den Gesamtrückstand (z. B. *"Noch 18x Pommes"*).
- **Audio-Gong**: Bei jedem neuen Bon ertönt ein akustisches Signal.

### 4. Geräteübersicht & Akku-Monitor (`/admin/devices`)
- Zeigt alle verbundenen Smartphones mit **Live-Akkustand %**, Ladezustand und Uptime.
- **Suchton (Find My Device)**: Löst auf einem verlegten Smartphone einen lauten Signalton und Vibration aus.
- **Fernabmeldung**: Ermöglicht das Kicken nicht autorisierter Geräte.

### 5. Virtueller Drucker-Monitor (`/virtual-printer`)
- Zeigt gedruckte Küchen-, Ausschank- und Kassenbelege live im Browser an. Ideal zum Testen ohne echten Thermodrucker!

### 6. Digitaler Beleg (E-Bon nach §33 KassenSichV) & NFC-Übertragung
- **Papierlose Belegausgabe**: Gäste können ihren Kassenbeleg digital per **QR-Code** (über Mobilfunk/Internet) oder per **NFC (Smartphone kurz anhalten)** abrufen.
- **Einrichtung & Hosting**: Detaillierte Anleitung zur Bereitstellung via **Cloudflare Tunnel (Netcup-Domain)** oder **Netcup Webhosting Reverse-Proxy / DynDNS** siehe:
  👉 [Ausführliche E-Bon & NFC Online-Anleitung](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/docs/EBON_ONLINE_ANLEITUNG.md)

