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
  - Wähle pro Gast nur die tatsächlich zu zahlenden Positionen aus (oder über "Alles" / "Keine").
  - **Trinkgeld-Schnellrundung**: 4 Pfeiltasten (▲/▼ links für 1,00 € und ▲/▼ rechts für 0,50 €) runden den Betrag schnell auf. Das Trinkgeld wird automatisch erfasst und gebucht.
  - **Rückpfand**: Erfasse zurückgegebenes Leergut (1€, 2€) direkt im Kassierdialog – wird automatisch vom Betrag abgezogen.
  - **Rückgeld-Rechner**: Schnelltasten für 10€, 20€, 50€, 100€ berechnen sofort das korrekte Wechselgeld.
  - Zahlarten: Bar, Rabatt / Freiverzehr, Karte (SumUp / Terminal), Personal/Bewirtung.
- **Tisch-Bestellhistorie**: Über das Uhr-Symbol kann die gesamte Bestellhistorie des Tisches eingesehen werden.
- **Bedienungswechsel**: Schneller Wechsel durch Antippen des Kellnernamens (mit Schließen-Knopf im PIN-Dialog).

### 2. Bonkasse / Thekenverkauf (Counter Express)
- Für den Direktverkauf an der Theke ohne Tischauswahl.
- Unterstützt 3 Ausgabe-Modi:
  1. *Nur Kassieren*
  2. *Gutscheinbon für den Gast (Wertmarken)*
  3. *Gutschein + Gegenbon (Gast-Wertmarke UND Küchen-Gegenbon mit fortlaufender Nummer)*
- Kassenlade springt bei Barzahlung automatisch auf.
- **Beleg-Auswahl nach dem Kassieren**:
  - Touch-Auswahlfenster mit `[ ((o)) E-Bon per NFC ]`, `[ 🖨 Papierbon ]` (wenn aktiviert) und `[ ⊘ Kein Beleg ]` für sofortigen Kassenabschluss.
  - Großformatige Rückgeldanzeige bei Barzahlung.
- **Papierbon-Steuerung**:
  - In den Admin-Einstellungen über *"Papierbon-Knopf an der Bonkasse anzeigen"* flexibel aktivierbar.
  - Bei aktiver Einstellung stehen Touch-Schnellumschalter in der Kopfleiste (`[ 🖨 Papierbon: AN / AUS ]`) und im Warenkorb bereit.
  - Nachdruck-Funktion: Bei Papierstau oder Gast-Nachfrage kann der Beleg jederzeit über `[ 🖨 Erneut drucken ]` nochmals gedruckt werden.

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
- **Papierlose Belegausgabe**: Gäste können ihren Kassenbeleg digital per **NFC (Smartphone kurz anhalten)** oder per **QR-Code** (über Mobilfunk/Internet) abrufen.
- **Einrichtung & Hosting**: Detaillierte Anleitung zur Bereitstellung via **Cloudflare Tunnel (Netcup-Domain)** oder **Netcup Webhosting Reverse-Proxy / DynDNS** siehe:
  👉 [Ausführliche E-Bon & NFC Online-Anleitung](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/docs/EBON_ONLINE_ANLEITUNG.md)

### 7. Erststart-Assistent & Setup Wizard (`/setup`)
- Geführter 4-Schritte-Assistent bei Erstinstallation zur schnellen Vergabe sicherer Initial-PINs, Festdaten, Tischreihen und Drucker.
- Schützt bereits konfigurierte Systeme automatisch vor Überschreiben.

### 8. Verwaltung & Schutz vor Datenverlust (`/admin/settings`)
- Lückenlose Erfassung ungespeicherter Änderungen: Beim Anklicken von Links (Chat, Artikel etc.), Stationswechseln im Menü oder Browser-Navigation erscheint ein In-App-Bestätigungsdialog (*„Speichern & wechseln“*, *„Verwerfen & wechseln“*, *„Hier bleiben“*).

### 9. Integriertes Handbuch & Offline-Dokumentation (`/docs`)
- Vollständiges, thematisch gegliedertes Benutzerhandbuch direkt in der Anwendung für alle Stationen und Einstellungen verfügbar (auch offline).

### 10. Personal & Abrechnung (`/admin/settle`)
- Zentrale Schaltzentrale für Mitarbeiter und Kassenabschlüsse mit 3 Reitern:
  - **Reiter 1: Kassensturz & Schichtabrechnung**: Revisionssicherer 5-Schritte-Ablauf. Ermöglicht die Erfassung des gezählten Ist-Trinkgelds und stellt Soll-Trinkgeld, Ist-Trinkgeld und Differenz transparent gegenüber.
  - **Reiter 2: Bedienungen & Trinkgeld-Regeln**: Mitarbeiter anlegen, PINs vergeben und flexible Trinkgeld-Verteilungsregeln (Bedienung, Bar-Pool, Küchen-Pool, Service-Pool) definieren.
  - **Reiter 3: Live-Umsatzübersicht**: Umsätze, Bar- und Karteneinnahmen aller Kellner auf einen Blick mit Direktsprung zum Kassensturz.

### 11. System-Update & Versions-Manager (`/admin/system-update`)
- **Arbeitsspeicher-Monitor**: Zeigt RAM-Gesamtkapazität, belegten Speicher in GB und prozentuale Auslastung live an.
- **Schalter "Nur Releases anzeigen"**: Standardmäßig aktiv, blendet unfertige Entwicklungs-Tags aus und zeigt ausschließlich geprüfte Versionen.
- **1-Klick Hotfix-Update**: Auch wenn bereits die neueste Version installiert ist, können neu erschienene Zwischen-Updates direkt per Knopfdruck eingespielt werden.

### 12. Vorlagen & Snapshots herunterladen & hochladen (`/admin/settings`)
- Fest-Vorlagen (Tische, Warengruppen, Artikel, Bon-Layouts) können im Reiter *Vorlagen & Snapshots* als Datei heruntergeladen und auf anderen Kassenrechnern importiert werden, ohne Verkaufs- oder Finanzdaten zu überschreiben.

