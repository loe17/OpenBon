/**
 * Spec 8: Umfassendes Handbuch und Referenz-Dokumentation für OpenBon.
 * Offline-fähig direkt im Bundle integriert – keine externe Verbindung nötig.
 */

export interface DocSection {
  heading: string;
  paragraphs?: string[];
  steps?: string[];
  hints?: { kind: 'tip' | 'warn'; text: string }[];
  table?: { headers: string[]; rows: string[][] };
}

export interface DocChapter {
  id: string;
  title: string;
  subtitle: string;
  icon: 'waiter' | 'pos' | 'kitchen' | 'admin';
  sections: DocSection[];
}

export const HANDBOOK: DocChapter[] = [
  {
    id: 'kellner',
    title: 'Kellner- & Servicehandbuch',
    subtitle: 'Direkteingabe, Bestellen, Sonderwünsche, Gang-Steuerung, Splitting, Gastansicht und Abrechnung',
    icon: 'waiter',
    sections: [
      {
        heading: '1. Schnellstart am Smartphone & Tablet',
        steps: [
          'Öffne im mobilen Browser die Adresse http://openbon.local (oder die angezeigte IP-Adresse).',
          'Tippe auf "Zum Home-Bildschirm hinzufügen", um OpenBon wie eine native App ohne störende Browserleisten zu nutzen.',
          'Wähle beim ersten Start deinen Namen oder tippe oben auf das Bedienungs-Feld, um deinen Namen festzulegen. Dieser Name erscheint auf allen Bons und in den Abrechnungsberichten.',
          'Wähle die Station "Bedienung (Tische)" – freie Tische werden dunkel, belegte Tische mit Betrag und offener Artikelanzahl hervorgehoben.',
        ],
        hints: [
          {
            kind: 'tip',
            text: 'Der eigene Name kann bei Schicht- oder Gerätewechsel jederzeit mit einem Klick auf das Bedienungs-Symbol in der Kopfzeile geändert werden.',
          },
        ],
      },
      {
        heading: '2. Direkteingabe von Tischnummern (Blitz-Bestellung)',
        paragraphs: [
          'Um keine Zeit mit dem Suchen auf großen Tischplänen zu verlieren, befindet sich ganz oben in der Bedienungsansicht eine Direkteingabeleiste.',
          'Tippe einfach die Tischnummer (z. B. "14") in das Zahlenfeld und drücke auf "Bestellen".',
          'Das System öffnet sofort die Speisekarte für diesen Tisch. Existiert der Tisch noch nicht, wird er automatisch und verzögerungsfrei angelegt.',
        ],
      },
      {
        heading: '3. Tischbestellung aufnehmen & Warengruppen',
        steps: [
          'Tischnummer eingeben oder Tisch im Plan antippen und "Bestellen" wählen.',
          'Wähle oben die gewünschte Warengruppe (z. B. "Getränke", "Grill", "Kaffee & Kuchen").',
          'Tippe auf den gewünschten Artikel. Hat der Artikel Größen oder Sorten (z. B. 0,3 l / 0,5 l / mit Pommes), öffnet sich automatisch das Auswahldialogfeld.',
          'Im einklappbaren Bestell-Drawer unten siehst du die Summe und Anzahl der Posten. Durch Antippen kannst du die Details aufklappen, Mengen ändern oder Sonderwünsche erfassen.',
          'Tippe auf "Bestellen", um die Bons an die zuständigen Drucker (Küche, Ausschank, Grill) abzusenden.',
        ],
        hints: [
          {
            kind: 'warn',
            text: 'Ausverkaufte Artikel sind rot durchgestrichen und können nicht bestellt werden. Der Warenbestand wird beim Abschicken automatisch synchronisiert.',
          },
        ],
      },
      {
        heading: '4. Sonderwünsche & Zusatzoptionen',
        paragraphs: [
          'Über "+ Wunsch" öffnet sich der interaktive Baukasten für Küchenwünsche. Dieser kombiniert Vorsatzwörter ("ohne", "extra", "wenig", "viel") mit den hinterlegten Zutaten (z. B. "ohne Zwiebeln", "extra scharf").',
          'Zusätzlich kann jederzeit ein individueller Freitext eingegeben werden. Der Sonderwunsch wird auf dem Küchenbon groß, fett und mit Ausrufezeichen hervorgehoben.',
        ],
      },
      {
        heading: '5. Gang-Steuerung & Zurückhalten (HOLD)',
        paragraphs: [
          'OpenBon unterstützt eine 3-Gänge-Steuerung (Gang 1: Sofort / Vorspeise, Gang 2: Hauptgang, Gang 3: Dessert).',
          'Mit dem Schalter "Zurückhalten" (HOLD) wird die Zubereitung zunächst pausiert. Der Küchenbon wird erst ausgedruckt, wenn die Bedienung den Gang später manuell abruft.',
        ],
      },
      {
        heading: '6. Schnelle Wiederholung: Gleiche Runde',
        paragraphs: [
          'Möchte der Tisch "nochmal die gleiche Runde", tippe in der Tischübersicht auf "Gleiche Runde". Alle zuletzt georderten Getränke und Speisen werden sofort in den Warenkorb geladen.',
        ],
      },
      {
        heading: '7. Kassieren, Rechnung teilen (Split) & Gastansicht',
        steps: [
          'Tisch antippen und "Kassieren" wählen.',
          'Stufe 1 (Postenauswahl): "Alles bezahlen" wählt alle offenen Posten. Alternativ können einzelne Artikel angetippt und mit + / − Mengen aufgeteilt werden (z. B. 1 von 4 Bieren).',
          'Mit den Schnell-Split-Tasten ("1/2", "1/3", "1/4") lässt sich die Bestellung im Handumdrehen auf mehrere Gäste aufteilen.',
          'Rückpfand / Leergut kann direkt im Pfandblock gegengerechnet werden.',
          'Stufe 2 (Zahlart): Wähle Barzahlung, Kartenzahlung oder Sonderzahlart.',
          'Stufe 3 (Bargeldrechner): Gegebenen Betrag per Ziffernblock oder Schnell-Scheintasten eingeben. Das Rückgeld wird mit 48px in Bernstein berechnet.',
          'Stufe 4 (Abschluss): Nach dem Verbuchen ermöglicht "Nächsten Gast am selben Tisch kassieren" das direkte Weiterkassieren des verbleibenden Restbetrags.',
        ],
        hints: [
          {
            kind: 'tip',
            text: 'Ist im Adminbereich die "Gastansicht" aktiviert, zeigt das Smartphone dem Gast oben ein großes, spiegelverkehrt lesbares Preisschild für maximale Transparenz.',
          },
        ],
      },
      {
        heading: '8. Kartenzahlung (App-to-App & Terminal)',
        paragraphs: [
          'SumUp, VR-Pay Me und Sparkasse S-POS starten per Deep-Link automatisch die jeweilige Karten-App auf dem Smartphone. Nach erfolgreicher Zahlung kehrt das System zurück und schließt den Bon ab.',
          'ZVT-EC-Terminals (z. B. Ingenico, Verifone, CCV) werden direkt vom OpenBon-Server über das lokale Netzwerk per TCP/IP angesteuert.',
        ],
      },
      {
        heading: '9. Storno-Vorgänge & Fehlbonierung',
        paragraphs: [
          'Bereits abgesendete Bestellungen können nur mit dem Kassen- oder Admin-PIN und unter Angabe eines Pflicht-Stornogrundes storniert werden.',
          'Das System druckt automatisch einen Storno-Bon ("*** STORNO - NICHT ZUBEREITEN ***") auf dem zuständigen Küchendrucker und bucht den Warenbestand zurück.',
        ],
      },
    ],
  },
  {
    id: 'kasse',
    title: 'Kassen-, Theken- & Schankhandbuch',
    subtitle: 'Bonkasse, Wertmarken, DUAL-Modus, Kundendisplay, Fassmonitor, Kassenbuch & Z-Bon',
    icon: 'pos',
    sections: [
      {
        heading: '1. Bonkasse für den Thekenverkauf',
        steps: [
          'Kachel "Bonkasse (Theke)" wählen und Kassen-PIN eingeben.',
          'Artikel per Touch in den Bon legen und direkt bar oder unbar abrechnen.',
          'Bei Barzahlung sendet OpenBon automatisch den Öffnungsimpuls an die Kassenlade.',
        ],
        paragraphs: [
          'Betriebsmodi der Bonkasse:',
          '• "Nur Kassieren" (DIRECT): Der klassische Modus für Theke & Imbiss. Nach Zahlung wird der Bon sofort an Küche/Ausschank gedruckt oder am Monitor angezeigt.',
          '• "Wertmarken" (VOUCHER): Druckt abreißbare Verzehrbons mit Barcode/Abholnummer zum Einlösen an separaten Ausgabeständen.',
          '• "Kombimodus" (DUAL): Ermöglicht den gemischten Verkauf von Sofortartikeln und Wertmarken in einem Kassiervorgang.',
        ],
      },
      {
        heading: '2. Kundendisplay (Zweiter Monitor)',
        paragraphs: [
          'Auf jedem Tablet, Monitor oder Raspberry-Pi-Bildschirm kann unter `/customer-display` ein Kundendisplay geöffnet werden.',
          'Es zeigt dem Kunden in Echtzeit die gebuchten Positionen, den Gesamtbetrag, das Rückgeld sowie nach der Bezahlung einen QR-Code für den digitalen E-Bon.',
          'Im Einstellungsmenü des Kundendisplays kann gezielt ausgewählt werden, welche Kasse (z. B. "Bonkasse 1", "Bierstand") auf dem Monitor gespiegelt werden soll.',
        ],
      },
      {
        heading: '3. Fass- & Schankmonitor',
        paragraphs: [
          'Unter `/taps` befindet sich der digitale Fassmonitor. Für jede Biersorte werden Füllstand, gezapfte Liter und verbleibende Gläser in Echtzeit visualisiert.',
          'Wird ein Fass leer, genügt ein Klick auf "Neues Fass anstechen", um die Zählung zurückzusetzen und den Füllstand auf 100% zu setzen.',
        ],
      },
      {
        heading: '4. Kassenbuch & Bargeldverkehr',
        steps: [
          'Admin-Bereich → "Kassenbuch & Barverkehr" öffnen.',
          'Wechselgeld-Vorschuss zu Schichtbeginn als Einlage (CASH_IN) erfassen.',
          'Barentnahmen für Zwischenabschöpfungen oder Lieferanten als CASH_OUT erfassen.',
          'Jede Buchung wird im revisionssicheren Kassenbuch protokolliert und kann quittiert werden.',
        ],
      },
      {
        heading: '5. Schichtwechsel & Tagesabschluss (Z-Bon)',
        paragraphs: [
          'Der Z-Bon schließt den Kassen- und Festtag unwiderruflich ab. Er berechnet die Gesamteinnahmen, getrennt nach Bar, Karte und MwSt-Sätzen, prüft das Bar-Soll und signiert den Abschluss mit einem HMAC-SHA256 Fiskalcode.',
          'Solange noch unbezahlte Tische offen sind, verweigert das System den Z-Bon, um Fehlbuchungen zu verhindern.',
        ],
      },
    ],
  },
  {
    id: 'kueche',
    title: 'Küchen- & Ausschank-Handbuch',
    subtitle: 'Küchenmonitor (KDS), getrennte Einzelbons, Tablett-Splitting und Wartezeit-Ampel',
    icon: 'kitchen',
    sections: [
      {
        heading: '1. Digitaler Küchenmonitor (KDS)',
        steps: [
          'Kachel "Küchenmonitor" aufrufen und Küchen-PIN eingeben.',
          'Eingehende Bestellungen erscheinen als übersichtliche Bestellkarten mit Tischnummer, Bedienung und Zeitstempel.',
          'Positionen können durch Antippen abgestrichen werden. Sind alle Positionen fertig, wandert die Karte automatisch in den Bereich "Fertig".',
        ],
      },
      {
        heading: '2. Wartezeit-Ampel & Akustik-Gong',
        table: {
          headers: ['Farbe', 'Bedeutung', 'Aktion'],
          rows: [
            ['Blau', 'Frisch eingegangen', 'Normale Zubereitungsreihenfolge'],
            ['Bernstein', 'Wartezeit > 10 Min', 'Bevorzugt fertigstellen'],
            ['Rot', 'Kritische Wartezeit > 20 Min', 'Priorität Küche / Bedienung verständigen'],
          ],
        },
        paragraphs: [
          'Bei jeder neuen Bestellung ertönt ein zweistufiger Signal-Gong, damit das Küchenteam auch bei hohem Lärmpegel sofort reagieren kann.',
        ],
      },
      {
        heading: '3. Getrennte Einzelbons für Speisen und Getränke',
        paragraphs: [
          'In den Systemeinstellungen kann separat für Speisen (Küche) und Getränke (Ausschank) festgelegt werden, ob Sammelbons oder Einzelbons gedruckt werden.',
          'Speisen-Einzelbon: Jedes Essen erhält einen eigenen Abschnitt mit Sorte, Beilagen und Sonderwünschen zur perfekten Übergabe an die Teller.',
          'Getränke-Einzelbon: Jedes Getränk wird einzeln ausgegeben, ideal für schnelle Thekenteams.',
        ],
      },
      {
        heading: '4. Tablett-Splitting (Tray-Split)',
        paragraphs: [
          'Wird das Tablett-Limit einer Druckgruppe überschritten (z. B. max. 6 Getränke je Tablett), teilt OpenBon die Bestellung automatisch auf mehrere Bons auf (z. B. "BON 1 von 3", "BON 2 von 3").',
        ],
      },
    ],
  },
  {
    id: 'admin',
    title: 'Admin-, Hardware- & Revisionshandbuch',
    subtitle: 'Drucker-Routing, Virtueller Monitor, Audit-Log, Kellner-Abrechnung, DATEV und Notfallplan',
    icon: 'admin',
    sections: [
      {
        heading: '1. Automatisches Drucker-Routing (Drucker ➔ Druckgruppen ➔ Artikel)',
        steps: [
          'Schritt 1 (Drucker anlegen): Unter Admin → "Drucker & Druckgruppen" einen Netzwerkdrucker mit IP und Port 9100 oder einen "Virtuellen Drucker" anlegen.',
          'Schritt 2 (Druckgruppe erstellen): Eine Druckgruppe (z. B. "Küche", "Grill", "Ausschank / Bier") erstellen und dem gewünschten Drucker zuweisen.',
          'Schritt 3 (Artikel zuweisen): In der Artikelverwaltung ("Artikel & Speisekarte") bei jedem Artikel im Dropdown "Druckgruppe" die passende Gruppe wählen.',
        ],
        hints: [
          {
            kind: 'tip',
            text: 'Wird ein Artikel bestellt, leitet OpenBon die Position automatisch an den Drucker der hinterlegten Druckgruppe weiter.',
          },
        ],
      },
      {
        heading: '2. Virtueller Drucker-Monitor (/admin/virtual-printer)',
        paragraphs: [
          'Über den virtuellen Drucker-Monitor können alle ESC/POS-Druckaufträge in Echtzeit im Webbrowser simuliert und überwacht werden.',
          'Ideal für Testläufe vor dem Event, Küchen ohne Thermodrucker oder zur schnellen Fehlerdiagnose.',
        ],
      },
      {
        heading: '3. Stufenlose Bon-Schriftgrößen & Layout-Konfiguration',
        paragraphs: [
          'Unter Admin → "Grundeinstellungen & Bon-Design" kann die Schriftgröße der Tischnummer stufenlos skaliert werden.',
          'Über die 3 Live-Vorschau-Tabs ("Kassenbeleg", "Speisen-Bon", "Getränke-Bon") sieht der Administrator jede Änderung sofort als fotorealistischen 80mm-Thermobon.',
        ],
      },
      {
        heading: '4. Revisions- & Systemprotokoll (Audit-Trail)',
        paragraphs: [
          'Unter Admin → "System- & Revisionsprotokoll" (/admin/logs) zeichnet OpenBon jede Aktion lückenlos auf: Kassiervorgänge, Stornos, Schichtabrechnungen, Kassenbuchungen und Konfigurationsänderungen.',
          'Das Protokoll kann jederzeit als CSV-, TXT- oder JSON-Datei für Steuerberater oder Vereinsprüfer heruntergeladen werden.',
        ],
      },
      {
        heading: '5. Kellner-Abrechnung, Kassensturz & Trinkgeld-Matrix',
        steps: [
          'Unter Admin → "Kellner-Abrechnung & Trinkgeld" werden alle registrierten Bedienungen mit Umsatz, Bareinnahmen und Trinkgeld aufgeführt.',
          'Der integrierte Kassensturz-Geldzähler berechnet aus Münz- und Scheinzählung die exakte Differenz zur Soll-Barabgabe an die Hauptkasse.',
          'Über "Schicht abrechnen & Bedienung abmelden" wird die Abrechnung im Audit-Log archiviert und die Bedienung für die nächste Schicht zurückgesetzt.',
        ],
      },
      {
        heading: '6. DATEV & Fiskal-Export',
        paragraphs: [
          'Das Kassenbuch kann unter `/admin/accounting` direkt im offiziellen DATEV-Format (CSV nach DATEV-Kontenrahmen SKR03 / SKR04) exportiert und an den Steuerberater übergeben werden.',
          'Das DSFinV-K / TSE Archiv unter `/admin/fiscal` liefert alle gesetzlich vorgeschriebenen Prüfdaten nach KassenSichV.',
        ],
      },
      {
        heading: '7. Hardware-Diagnose & Testbetrieb',
        paragraphs: [
          'Unter `/admin/diagnostics` kann vor dem Fest ein vollständiger E2E-Bestellzyklus durchgespielt werden. Das System prüft Datenbank, Spooler, Drucker und bereinigt nach dem Testlauf alle Testartikel und Testtische automatisch.',
        ],
      },
      {
        heading: '8. Notfall-Wiederherstellung & Backup',
        steps: [
          'Lade regelmäßig unter Admin → "Grundeinstellungen" ein vollständiges Datenbank-Backup herunter.',
          'Im Notfall den Serverdienst stoppen: "sudo systemctl stop openbon".',
          'Die Datei prisma/dev.db durch die gesicherte Backup-Datei ersetzen.',
          'Dienst wieder starten: "sudo systemctl start openbon". Alle Daten stehen sofort wieder bereit.',
        ],
      },
    ],
  },
];
