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
- Für den schnellen Direktverkauf und Wertmarkenausgabe an der Theke ohne Tischauswahl.
- **Klare Kassier-Auswahl im Bezahlfenster**:
  - `[ Barzahlung ]`: Direkte Barzahlung an der Theke ohne Bon-Druck für die Küche/Schänke.
  - `[ Wertmarke ]`: Barzahlung mit automatischem Ausdruck von Wertmarken/Abholbons für Küche und Schänke.
  - `[ Kartenzahlung (Beta) ]`: Kartenzahlung bei angebundenem Kartenterminal.
- **Kompakte Kassenansicht ohne Scrollen**:
  - Bargeldrechner (Scheine, Münzen und Ziffernblock) nebeneinander angeordnet – kein vertikales Scrollen nötig.
  - Aufgeräumter Kassieren-Button für schnellen Durchsatz.
- **4-Pfeile Trinkgeld-System**:
  - Wie in der Bedienansicht: 4 Pfeiltasten (▲/▼ links für 1,00 € und ▲/▼ rechts für 0,50 €) zum blitzschnellen Aufrunden.
- **Touch-Artikelsuche mit Bildschirmtastatur**:
  - Such-Knopf mit Lupe oben in der Funktionsleiste neben der Kassenladen-Steuerung.
  - Öffnet ein Vollbildfenster mit Live-Artikelsuche auf der linken Seite und einer großen Touch-Bildschirmtastatur auf der rechten Seite.
- **Fenster minimieren / Vollbild beenden**:
  - Ein Klick auf das Bonkassen-Symbol ganz oben links beendet den Vollbildmodus bzw. minimiert das Fenster.
- Kassenlade springt bei Barzahlung automatisch auf.
- **Beleg-Auswahl nach dem Kassieren**:
  - Touch-Auswahlfenster mit `[ ((o)) E-Bon per NFC ]`, `[ 🖨 Papierbon ]` (wenn aktiviert) und `[ ⊘ Kein Beleg ]` für sofortigen Kassenabschluss.
  - Großformatige Rückgeldanzeige bei Barzahlung.
- **Papierbon-Steuerung**:
  - In den Admin-Einstellungen über *"Papierbon-Knopf an der Bonkasse anzeigen"* flexibel aktivierbar.
  - Bei aktiver Einstellung stehen Touch-Schnellumschalter in der Kopfleiste (`[ 🖨 Papierbon: AN / AUS ]`) und im Warenkorb bereit.
  - Nachdruck-Funktion: Bei Papierstau oder Gast-Nachfrage kann der Beleg jederzeit über `[ 🖨 Erneut drucken ]` nochmals gedruckt werden.

### 3. Küchen- & Schankmonitor (KDS)
- **Tischweise Spalten (Volle Bildschirmhöhe & internes Scrollen)**: Optimiert für Tablets im Querformat. Jeder Tisch nimmt eine eigene senkrechte Karte über die gesamte Bildschirmhöhe ein, die niemals über den unteren Bildschirmrand hinauswächst. Kopfzeile (Tisch, Bedienung) und Fußzeile (Bestätigen, Drucken) bleiben dauerhaft fixiert; bei vielen Positionen scrollt der Inhalt flüssig innerhalb der Tischkarte. Mehrere Tische lassen sich seitlich durchwischen (horizontales Scrollen).
- **Tischbezeichnung oben & Bestellnummer beim Kellner**: Im Kopf der Karte steht prominent die Tischnummer (bzw. „Theke“ oder „Abholmarke“). Die Bestellnummer(n) werden übersichtlich in Klammern hinter dem Namen der Bedienung angezeigt (z. B. `Bedienung: Anna (#101)`).
- **Vollbildmodus per Kochmütze**: Durch Antippen des Kochmützen-Symbols neben dem Schriftzug „Küchen- & Schankmonitor“ wird der Vollbildmodus aktiviert oder beendet (wie in der Bonkasse).
- **Ergonomische Sortierung nach Wartezeit (Ältester Tisch ganz links im Direktblick)**: Die am längsten wartende, dringendste Bestellung steht immer ganz links auf Platz 1 – direkt im natürlichen Blickfeld ohne Scrollen. Neu eingehende Bestellungen reihen sich nach rechts an. Wird der Tisch links abgehakt, rücken die nächsten Tische automatisch nach links nach.
- **Kompaktere Tischspalten**: Die Spaltenbreite ist für Tablets und Großbildschirme optimiert, sodass 4–5 Tische bequem nebeneinander Platz finden.
- **Farbe der Warengruppen & automatische Platzersparnis**: Die Trennbalken der Warengruppen übernehmen automatisch die im Artikelstamm konfigurierte Farbe. Ist oben im Filter nur eine Warengruppe aktiv (oder enthält ein Tisch nur Artikel aus einer Gruppe), wird der Trennbalken automatisch ausgeblendet, um wertvollen vertikalen Platz zu sparen und unnötiges Scrollen zu vermeiden. Warengruppen ohne Positionen werden nicht angezeigt.
- **Ergonomischer Haken-Button im Kopf**: Rechts neben der dezenten, nicht-pulsierenden Wartezeit-Anzeige befindet sich ein praktischer Haken-Button, um alle Positionen eines Tisches mit einem Klick auszuwählen oder abzuwählen.
- **Zuverlässiger Warengruppen-Filter**: Über den Warengruppen-Filter oben können Stationen gezielt gefiltert werden (z. B. Grill-Tablet nur für Speisen, Schank-Tablet nur für Getränke). Ein Klick auf „Keine“ leert die Anzeige für eine gezielte Auswahl.
- **Umschaltbare Betriebsmodi mit Doppel-Druckschutz**:
  - **Reine Überwachung**: Bons drucken sofort beim Kellner; der Küchenmonitor dient als Live-Übersicht.
  - **Monitor steuert Druck**: Der Bon druckt erst dann am Drucker aus, wenn die Küche fertige Positionen abgehakt hat und auf *„Bons drucken & bestätigen“* tippt! Nicht fertige Artikel verbleiben auf dem Tisch.
  - **Garantierter Einmal-Druck**: Jeder Bon druckt garantiert genau einmal – selbst bei nachträglichem Umschalten der Modi oder aktiver Bestellverzögerung.
- **Sauberes Abräumen & Tages-Historie**:
  - Sobald ein Tisch auf „Tisch komplett fertig“ gesetzt wird, verschwindet er sofort aus dem aktiven Monitor.
  - Über den neuen Button **„Historie“** oben rechts können alle heute abgehakten Tische mit allen Details eingesehen und bei Bedarf mit einem Klick auf *„Wiederherstellen“* direkt wieder auf den Monitor zurückgeholt werden.
- **Optionale Kellner-Benachrichtigung**: In den Druckereinstellungen (`/admin/settings` -> Drucker -> Küchenmonitor) kann eingestellt werden, ob Bedienungen bei Fertigmeldung eines Tisches per Gong und Banner benachrichtigt werden (standardmäßig zum Schutz vor Lärm ausgeschaltet).
- **Kompakter Warte-Bon für verzögerte Speisen**: Dauert eine Speise länger (z. B. Kaiserschmarrn), kann bei Teillieferung ein kompakter Hinweisbon gedruckt werden (*„Warte-Bon: Speise folgt in Kürze nach!“*).
- **Rückstandszähler**: Zeigt oben in Echtzeit den Gesamtrückstand aller offenen Speisen (z. B. *"Noch 18x Pommes"*).
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

### 13. Druckerverwaltung, Bonverbrauchsrechner & Rollenüberwachung (`/admin/printers` & `/admin/reports`)
- **Bonverbrauchsrechner & Live-Aktualisierung in Metern**:
  - Jeder gedruckte Bon (egal ob Kassenbon, Küchen-Einzelbon, Stornobeleg, Zwischenbericht oder Tagesabschluss) wird automatisch millimetergenau berechnet.
  - Bei aktiver Rollen-Überwachung sieht man für jeden Drucker live, wie viele Meter Papier bei der aktuellen Veranstaltung bereits verbraucht wurden und wie viel Prozent der aktuellen Rolle noch voll sind.
  - Der Zählerstand und der farbige Rollenbalken zählen im Browser bei jedem Druck sofort mit, ohne dass die Seite neu geladen werden muss.
  - Im Veranstaltungsbericht (`/admin/reports`) wird der gesamte Papierverbrauch aller Drucker zusammengefasst.
- **Rollenwechsel & manuelle Zählerkorrektur**:
  - Nach dem Einlegen einer neuen Rolle genügt ein Klick auf *"Neue Rolle eingelegt"*, um den Zähler wieder auf 0 Meter zurückzusetzen.
  - Wurde eine bereits angebrochene Rolle eingelegt, kann der verbrauchte Meterstand über *"Werte & Kalibrierung"* jederzeit von Hand angepasst werden.
- **Papierrollen-Vorwarnhebel & geräuschloser Stopp-Bon (aktivierbar / deaktivierbar)**:
  - In den **Admin-Einstellungen** (`/admin/settings` → Reiter *Drucker*) kann die Papierrollen-Überwachung jederzeit per Schalter flexibel aktiviert oder deaktiviert werden.
  - **Standardmäßig ist die Überwachung ausgeschaltet.** Ist sie deaktiviert, werden die Sensorplakette und die Papierverbrauchs-Anzeige in der Druckerverwaltung und im Bericht vollständig ausgeblendet, damit die Ansicht ruhig und übersichtlich bleibt.
  - Bei eingeschalteter Überwachung fragt das System den mechanischen Fühlerhebel im Drucker ab und zeigt seinen Status übersichtlich an (*"Sensorhebel ruht"* oder *"Vorwarnhebel aktiv"*).
  - Schlägt der Hebel an, weil die Rolle fast leer ist, zählt das System die letzten Meter herunter und druckt kurz vor dem Rollenende automatisch einen gut sichtbaren Warnbeleg (*"STOPP - LETZTER BON AUF DIESER ROLLE!"*).
  - So wird verhindert, dass eine Kundenbestellung mitten im Druck abreißt. Wichtig: Dieser Hinweis erfolgt rein als Ausdruck und **vollständig geräuschlos ohne Piepton**, um Gäste und Thekenpersonal nicht zu erschrecken.
  - Ist die Funktion in den Einstellungen deaktiviert, druckt das System ohne Vorwarnung oder Stopp-Bons ganz normal bis zum physischen Ende der Rolle durch.
- **USB-Drucker an Kassenstationen für alle freigeben (Web-Relay)**:
  - Wenn ein Bondrucker per USB-Kabel an einem Kassen-PC oder Laptop angeschlossen ist, kann dieser direkt im Webbrowser für das gesamte Festzelt freigegeben werden.
  - Es müssen keine Treiber oder Netzwerkfreigaben im Betriebssystem eingerichtet werden: In der Druckerverwaltung einfach die Verbindungsart *"Web-Relay (Browser)"* wählen und an der Station auf *"Mit USB-Drucker verbinden"* klicken. Ab diesem Moment können alle Kellner-Smartphones automatisch über diesen Drucker drucken.

### 14. Grafischer Tischplan-Designer mit Orientierungs-Randleisten (`/admin/tables`)
- **Randleisten an allen vier Seiten**:
  - Rund um das Tischnetz (oben, unten, links und rechts) befinden sich schmale Randleisten.
  - In diese Leisten können Orientierungsfelder eingefügt werden, um den Raumplan für das Team verständlich zu beschriften.
  - Die Randfelder links und rechts sind genau halb so breit (38 Pixel, abgestimmt auf die Höhe der oberen und unteren Felder). Der Text steht darin platzsparend um 90° gedreht.
- **Wegweiser & Markierungen ohne Emojis**:
  - Typische Raummerkmale wie *Eingang*, *Ausgang*, *Notausgang*, *Küche*, *Bar / Schank*, *WC*, *Bühne*, *Garderobe* oder *Kasse / Info* können per Vorlage ausgewählt oder frei eingetippt werden.
  - Alle Vorlagen und Felder sind bewusst sachlich ohne Emojis gehalten.
  - Jedes Feld kann farblich hervorgehoben und bei Bedarf über mehrere Tische hinweg in die Länge gezogen werden (z. B. für eine lange Theke oder eine breite Bühne).
- **Wo sind die Randleisten sichtbar?**:
  - Die Beschriftungsfelder erscheinen im **Tischplan-Designer** (`/admin/tables`) sowie auf dem **ausgedruckten Tischplan** (`/admin/tables/print`), der zur Orientierung für Aushilfen im Ausschank oder der Küche aufgehängt wird.
  - Auf den **Smartphones der Bedienungen** (`/waiter`) bleibt der Bildschirm bewusst übersichtlich und blendet nur die Tische ein, damit alles schnell mit einem Daumen erreichbar bleibt.

### 15. Ausfallsicherheit mit Ersatzrechner (High Availability) & Offline-Puffer

- **Warum ein Ersatzrechner?**:
  Fällt der Haupt-Laptop an der Theke plötzlich aus (z. B. versehentlich ausgeschaltet, Stromstecker gezogen, Display defekt oder Flüssigkeit verschüttet), übernimmt ein beliebiger zweiter Rechner im Netzwerk (z. B. ein alter Laptop, Mini-PC oder Raspberry Pi am Router) nach 10 Sekunden vollautomatisch den Kassenbetrieb.
  Alle Buchungen, Tische und Kassenstände werden im laufenden Betrieb fortlaufend im Sekundentakt auf den Ersatzrechner gespiegelt.

- **Muss man auf dem Ersatzrechner auch OpenBon installieren und starten?**:
  Ja. Auf dem Ersatzrechner muss OpenBon ebenfalls installiert und gestartet sein. Dort stellt man in den Einstellungen einmalig die Rolle auf *„STANDBY (Ersatzrechner)“*. Ab diesem Moment läuft das Programm auf dem Ersatzrechner still im Hintergrund mit und synchronisiert sich pausenlos mit der Hauptkasse.

- **Automatische 1-Klick-Netzwerksuche im Adminbereich (`/admin/settings` → Reiter *Allgemein*)**:
  - Im Bereich **Sync-Sicherheit & Pairing-Assistent** befindet sich der Knopf **„Nach Ersatzrechner suchen“**.
  - Ein Klick genügt: OpenBon tastet das lokale Netzwerk selbstständig ab und findet jeden beliebigen PC, Laptop oder Raspberry Pi, auf dem OpenBon läuft.
  - Sobald das Gerät gefunden wird, klickt man einfach auf **„Koppeln“** – die Netzwerkadresse wird sofort vollautomatisch hinterlegt.
  - Wer feste Adressen bevorzugt, kann die IP-Adresse des Ersatzrechners auch weiterhin wie gewohnt von Hand eingeben.

- **Der Offline-Puffer auf den Kellner-Smartphones**:
  - **Dauerhafte Speisekarte**: Die Speisekarte, Preise und Warengruppen werden im internen Speicher des Smartphones vorgehalten. Selbst im Funkloch oder während eines Kassenwechsels öffnet sich die Bestellmaske sofort.
  - **Nahtloses Kassieren**: Bricht die Netzwerkverbindung kurz ab, erscheint **keine rote Fehlermeldung**. Die Bedienung kann Barzahlungen wie gewohnt abrechnen – das Smartphone berechnet das Rückgeld sekundenschnell und sichert die Zahlung im internen Ausgangskorb.
  - **Automatischer Wechsel**: Sobald der Ersatzrechner nach wenigen Sekunden übernimmt, bemerken die Kellnerhandys das Signal automatisch. Sie schwenken ohne Neuanmeldung oder QR-Code-Scan im Hintergrund auf den Ersatzrechner um und übertragen alle gepufferten Bons und Zahlungen selbstständig.

- **Vollautomatische Rückkehr zur Hauptkasse (Auto-Failback)**:
  - **Was passiert, wenn der Hauptrechner wieder startet?**:
    Wird der Haupt-Laptop nach einem Stromausfall oder Neustart wieder eingeschaltet, startet OpenBon darauf zunächst leise als „Zuhörer“. Er verbindet sich mit dem Ersatzrechner und lädt alle Bestellungen und Zahlungen nach, die während des Ausfalls auf dem Ersatzrechner kassiert wurden.
  - **Stabilitätsschutz (20-Sekunden-Puffer)**:
    Damit die Kassen nicht bei einem Wackelkontakt am Stromkabel hin- und herspringen, wartet der Hauptrechner ab, bis die Verbindung 20 Sekunden lang lückenlos und ohne Verzögerung stabil läuft.
  - **Sanfte Kassenübergabe (Handover)**:
    Sobald alle Buchungen auf dem Hauptrechner aktuell sind, gibt der Ersatzrechner die Kassenführung automatisch an den Hauptrechner zurück und wechselt wieder in den Standby-Bereitschaftsmodus.
  - **Unterbrechungsfreier Rückschwenk**:
    Die Smartphones aller Bedienungen bemerken die Rückkehr der Hauptkasse automatisch und schalten die Verbindung nahtlos zurück. Keine Bedienung muss sich neu einloggen oder den QR-Code neu scannen.

- **Was passiert, wenn genau während der Übergabe kassiert wird? (3-facher Schutz)**:
  Niemand muss beim Wechsel aufpassen – das System schützt Buchungen zu 100 % vor Verlust und doppelten Abrechnungen:
  1. **Handy-Ausgangskorb**: Drückt eine Bedienung exakt im Moment der Umschaltung auf „Bezahlen“, speichert das Handy die Zahlung für einen Wimpernschlag im internen Puffer und sendet sie sofort an die Hauptkasse, sobald die Umschaltung steht.
  2. **Kurze Ausklingzeit (200 Millisekunden)**: Bevor der Ersatzrechner die Führung abgibt, wartet er einen Sekundenbruchteil ab, damit alle bereits losgeschickten Buchungen die Datenbank sicher erreichen. Der Hauptrechner zieht vor der Übernahme die allerletzten Bons ab.
  3. **Einmaliges Bonsiegel (Schutz vor Doppelbuchungen)**: Jeder Bon und jede Abrechnung hat einen weltweit einmaligen Schlüssel. Selbst wenn eine Zahlung durch eine Funkstörung versehentlich auf beiden Rechnern ankommen sollte, erkennt das System die Kennung sofort und führt die Buchung nur exakt ein einziges Mal durch.

### 16. OpenBon als echte App auf Smartphones & Tablets installieren (Android & iOS)

- **Vorteile der App-Installation**:
  - Kein Browser-Rahmen und keine störende Adresszeile – die Bedienung hat den kompletten Bildschirm für Tische und Bestellungen zur Verfügung.
  - Schneller Direktstart mit eigenem Icon vom Startbildschirm des Handys.
  - Bessere Stabilität und automatischer Offline-Puffer auch bei Funkaussetzern.

- **Schritt 1: Einmaliges Sicherheits-Zertifikat am Smartphone hinterlegen**:
  1. Am Handy im Browser auf die Kassenadresse gehen und das Sicherheits-Zertifikat herunterladen (z. B. unter Einstellungen oder über den bereitgestellten Download-Link).
  2. In die Smartphone-Einstellungen wechseln: Menüpunkt *Sicherheit* (oder *Sicherheit & Datenschutz* bzw. *Biometrische Daten*).
  3. Dort auf *Weitere Sicherheitseinstellungen* → *Zertifikate* → *Vom Speicher installieren* (oder *CA-Zertifikat installieren*) tippen.
  4. Die heruntergeladene Datei auswählen und mit Geräte-PIN oder Fingerabdruck bestätigen.
  5. Sobald das Zertifikat hinterlegt ist, zeigt der Chrome-Browser bei der Kassenadresse (`https://...`) das grüne bzw. geschlossene Sicherheitsschloss an.

- **Schritt 2: Als vollwertige App auf dem Startbildschirm installieren**:
  1. Im Chrome-Browser die Kassenansicht (z. B. Kellner-Station `/waiter`) über die sichere Adresse aufrufen.
  2. Falls die Seite vorher schon geöffnet war: Einmal von oben nach unten wischen, um die Seite frisch zu laden.
  3. Oben rechts auf die drei Punkte (`⋮`) im Browser tippen.
  4. Im Menü auf **„App installieren“** (oder **„OpenBon installieren“**) tippen.
  5. Die Nachfrage mit **„Installieren“** bestätigen.
  6. Fertig! OpenBon öffnet sich ab jetzt als eigenständige App direkt vom Startbildschirm.
