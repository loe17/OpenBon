/**
 * Umfassendes Handbuch und Referenz-Dokumentation für OpenBon.
 * Offline verfügbar, druckoptimiert (A4) und thematisch gegliedert.
 * Enthält Screenshots aller Programmbereiche und lückenlose Erklärungen aller Funktionen.
 */

export interface DocSection {
  id: string;
  heading: string;
  paragraphs?: string[];
  steps?: string[];
  hints?: { kind: 'tip' | 'warn'; text: string }[];
  table?: { headers: string[]; rows: string[][] };
  image?: { src: string; alt: string; caption?: string };
}

export interface DocChapter {
  id: string;
  chapterNumber: number;
  title: string;
  subtitle: string;
  icon: 'system' | 'waiter' | 'pos' | 'kitchen' | 'products' | 'printers' | 'payment' | 'backup' | 'diagnostics';
  sections: DocSection[];
}

export const HANDBOOK: DocChapter[] = [
  {
    id: 'system',
    chapterNumber: 1,
    title: 'Systemarchitektur, Erststart & Sicherheit',
    subtitle: 'Lokaler Betrieb, Stationsauswahl, Einrichtungsassistent, PIN-Schutz und Installation',
    icon: 'system',
    sections: [
      {
        id: '1.1',
        heading: '1.1 Grundkonzept: Lokaler Fest-Server & Unabhängigkeit',
        paragraphs: [
          'OpenBon wurde speziell für Vereinsfeste, Feuerwehrfeste, Schützenfeste, Biergärten und die Gastronomie entwickelt. Das System läuft komplett auf Ihrem eigenen Computer vor Ort – eine ständige Internetverbindung ist zu keinem Zeitpunkt erforderlich.',
          'Alle Daten (Bestellungen, Tische, Zahlungen und Berichte) werden direkt auf dem Kassenrechner in einer geschützten Datenbank gespeichert. Smartphones der Bedienungen, stationäre Kassen und Küchendrucker kommunizieren rein über das lokale WLAN-Netzwerk.',
        ],
        hints: [
          {
            kind: 'tip',
            text: 'Sollte während des Festbetriebs das externe Internet oder der Telefonanschluss ausfallen, arbeitet OpenBon völlig ungestört weiter.',
          },
        ],
      },
      {
        id: '1.2',
        heading: '1.2 Startseite & Stationsauswahl',
        paragraphs: [
          'Beim Aufrufen von OpenBon erscheint die zentrale Stationsauswahl. Hier wählt jeder Mitarbeiter mit einer Berührung seinen Einsatzbereich aus:',
          '• Bedienung (Kellner): Schnelle Tischaufnahme, Wünsche, Splitten und Kassieren auf Smartphones.',
          '• Bonkasse / Theke: Schneller Direktverkauf für Einlass, Wertmarken und Schänken.',
          '• Küche (KDS): Digitaler Küchen- und Ausschankmonitor zur Abarbeitung der Bestellungen.',
          '• SB-Kiosk: Gästeterminal zur kontaktlosen Selbstbestellung mit Warenkorb und Sofort-Reset.',
          '• Kundendisplay: Bildschirm mit Blick zum Gast zur Live-Anzeige der gebuchten Artikel.',
          '• Administration: Alle Einstellungen, Artikel, Tische, Drucker, Berichte und Abrechnungen.',
        ],
        image: {
          src: '/docs/images/01_home_station_select.png',
          alt: 'Stationsauswahl OpenBon',
          caption: 'Die Startseite: Direkter Einstieg in alle Stationen mit Touch-Bedienung',
        },
      },
      {
        id: '1.3',
        heading: '1.3 Erststart-Assistent (Setup-Wizard)',
        paragraphs: [
          'Wird OpenBon zum ersten Mal gestartet oder ist das System noch nicht konfiguriert, öffnet sich automatisch der geführte Erststart-Assistent. In 4 einfachen Schritten ist das System einsatzbereit:',
          '1. Fest- & Betriebsdaten: Name der Veranstaltung, Währung und Standard-Steuersätze hinterlegen.',
          '2. Sichere PIN-Vergabe: Festlegung von individuellen Geheimzahlen für Admin, Kasse, Küche und Kellner.',
          '3. Tische & Räume: Blitzschnelle automatische Erstellung von Tischreihen (z. B. Tische 1 bis 50).',
          '4. Drucker-Zuweisung: Auswahl der Netzwerkdrucker für Theke, Küche und Kassenbelege.',
        ],
        image: {
          src: '/docs/images/02_setup_wizard.png',
          alt: 'Erststart-Assistent Setup-Wizard',
          caption: 'Geführter 4-Schritte-Assistent bei der Erstinbetriebnahme',
        },
        hints: [
          {
            kind: 'tip',
            text: 'Sobald aktive Buchungen im System vorhanden sind, wird der Assistent automatisch gesperrt, damit keine Live-Daten versehentlich überschrieben werden.',
          },
        ],
      },
      {
        id: '1.4',
        heading: '1.4 Netzwerk-Setup & Mobilgeräte verbinden',
        steps: [
          'Schließen Sie den Kassenrechner (Server) per Netzwerkkabel an den WLAN-Router (z. B. FRITZ!Box) an.',
          'Stellen Sie im Router ein, dass der Server immer die gleiche feste IP-Adresse erhält (z. B. 192.168.1.100).',
          'Verbinden Sie die Smartphones und Tablets mit dem Fest-WLAN.',
          'Öffnen Sie auf den Mobilgeräten den Browser und geben Sie die Kassen-Adresse ein (z. B. http://192.168.1.100:3000 oder http://openbon.local).',
        ],
      },
      {
        id: '1.5',
        heading: '1.5 Rollenbasierte PIN-Sicherheit',
        paragraphs: [
          'Sensible Bereiche sind durch separate Geheimzahlen geschützt. Das Kassenpersonal kann Bestellungen aufnehmen und kassieren, aber nicht eigenmächtig Preise ändern oder Tage abschließen.',
        ],
        table: {
          headers: ['Rolle / Station', 'Standard-PIN', 'Rechte & Aufgaben'],
          rows: [
            ['Administrator', '1234', 'Vollzugriff: Preise, Stammdaten, Berichte, Drucker, Backups & Kassensturz'],
            ['Kasse / Theke (POS)', '0000', 'Direktverkauf, Bon-Druck, Kassenladen-Öffnung, Kassenbuch'],
            ['Küche (KDS)', '2222', 'Küchen- & Ausschankmonitor, Bon-Statusverwaltung, Gang-Freigaben'],
            ['Bedienung (Kellner)', '1111', 'Tischaufnahme, Wünsche-Baukasten, Rechnungs-Splitting & Kassieren'],
          ],
        },
        hints: [
          {
            kind: 'warn',
            text: 'Bitte ändern Sie die Standard-PINs vor dem Festbetrieb in den Systemeinstellungen.',
          },
        ],
      },
      {
        id: '1.6',
        heading: '1.6 Progressive Web App (PWA) & Vollbild-Betrieb',
        paragraphs: [
          'OpenBon lässt sich auf jedem Apple- und Android-Gerät als vollwertige App ohne App-Store installieren:',
          '1. Kassen-Adresse auf dem Smartphone in Safari (iOS) oder Chrome (Android) öffnen.',
          '2. Auf die Teilen-Taste bzw. das Drei-Punkte-Menü tippen.',
          '3. "Zum Home-Bildschirm" auswählen.',
          'OpenBon startet fortan im Vollbildmodus ohne störende Adresszeile.',
        ],
      },
      {
        id: '1.7',
        heading: '1.7 Navigationsschutz & Menü-Scroll-Kapselung',
        paragraphs: [
          'Damit bei langen Menüs oder Listen auf Touch-Geräten kein versehentliches Verschieben des Hintergrunds auftritt, kapselt OpenBon das Hauptmenü vollständig ab. Das Scrollen bleibt exakt im Menüfenster gebunden.',
          'Werden in den Systemeinstellungen Änderungen vorgenommen und der Benutzer möchte die Seite verlassen, erinnert ein automatischer Sicherheitsdialog an das Speichern ungesicherter Eingaben.',
        ],
      },
    ],
  },
  {
    id: 'waiter',
    chapterNumber: 2,
    title: 'Kellner- & Servicehandbuch',
    subtitle: 'Tischauswahl, Bestellungen, Wünsche, Stornierung, Splitting & Kassieren',
    icon: 'waiter',
    sections: [
      {
        id: '2.1',
        heading: '2.1 Schnelle Tischauswahl per Ziffernblock (Keypad)',
        paragraphs: [
          'Im hektischen Festbetrieb ist das Tippen der Tischnummer schneller als das Suchen auf großen Raumplänen. Die Kellneransicht bietet ganz oben eine Direkteingabe mit großen Touch-Tasten.',
          'Geben Sie die Tischnummer (z. B. "12") ein und tippen Sie auf "Tisch öffnen". Existiert der Tisch noch nicht, wird er sofort automatisch angelegt.',
        ],
        image: {
          src: '/docs/images/04b_waiter_tischnummer_keypad.png',
          alt: 'Tischnummern Keypad',
          caption: 'Schnelle Direkteingabe der Tischnummer über das Touch-Keypad',
        },
      },
      {
        id: '2.2',
        heading: '2.2 Tischplan & Statusfarben in Echtzeit',
        paragraphs: [
          'Über den Reiter "Tischplan" werden alle Tische räumlich übersichtlich dargestellt. Statusänderungen synchronisieren sich sekundenschnell zwischen allen Geräten.',
        ],
        table: {
          headers: ['Farbe', 'Bedeutung', 'Aktion bei Berührung'],
          rows: [
            ['Dunkelgrau', 'Freier Tisch', 'Öffnet sofort eine neue Bestellung'],
            ['Blau / Bernstein', 'Belegter Tisch mit offenen Posten', 'Öffnet das Tisch-Aktionsmenü (Bestellen, Kassieren, Storno)'],
            ['Rot blinkend', 'Wartezeit-Warnung', 'Bestellung wartet schon ungewöhnlich lange auf Zubereitung'],
          ],
        },
        image: {
          src: '/docs/images/04a_waiter_tischplan.png',
          alt: 'Grafischer Tischplan mit Statusfarben',
          caption: 'Tischplan-Übersicht mit Räumen und farbiger Belegungskennzeichnung',
        },
      },
      {
        id: '2.3',
        heading: '2.3 Tisch-Aktionsmenü',
        paragraphs: [
          'Beim Antippen eines bereits belegten Tisches öffnet sich das zentrale Aktionsmenü. Hier stehen alle relevanten Werkzeuge auf einen Blick bereit:',
          '• [ Bestellen ]: Neue Speisen und Getränke für diesen Tisch aufnehmen.',
          '• [ Kassieren ]: Zur Abrechnung wechseln (Gesamt oder Getrennt zahlen).',
          '• [ Bestellung stornieren ]: Macht fehlerhafte Buchungen innerhalb der eingestellten Frist rückgängig.',
          '• [ Tisch umbuchen ]: Zieht die Gäste auf einen anderen Tisch um oder legt zwei Tische zusammen.',
          '• [ Gleiche Runde ]: Lädt alle zuletzt bestellten Getränke mit einem Tipp erneut in den Warenkorb.',
          '• [ Bestellhistorie ]: Zeigt alle bisher für diesen Tisch aufgenommenen Runden mit Uhrzeit und Kellner an.',
        ],
        image: {
          src: '/docs/images/04c_waiter_tisch_aktionen.png',
          alt: 'Tisch Aktionsmenü',
          caption: 'Das Aktionsmenü beim Klick auf einen belegten Tisch',
        },
      },
      {
        id: '2.4',
        heading: '2.4 Storno-Funktion mit Frist-Countdown & Barauszahlung',
        paragraphs: [
          'Tippfehler passieren. OpenBon bietet ein durchdachtes Storno-Verfahren:',
          '1. Storno-Zeitfenster: In den Admin-Einstellungen wird festgelegt, wie viele Minuten nach der Bestellung eine Stornierung durch das Servicepersonal zulässig ist (z. B. 3 Minuten). Nach Ablauf dieser Zeit ist der Storno-Knopf gesperrt.',
          '2. Countdown-Anzeige: Wenn die Option im Adminbereich aktiviert ist, zeigt der Storno-Knopf am Tisch minutengenau an, wie lange die Stornierung noch möglich ist.',
          '3. Automatischer Auszahlvorgang: Wurde die Bestellung direkt mit "Bestellen & Kassieren" abgeschlossen und bezahlt, führt der Storno-Knopf einen Auszahlvorgang des Geldes an den Gast durch. Der Betrag wird ordnungsgemäß aus der Kellnerkasse ausgebucht.',
          '4. Lager-Korrektur & Nachvollziehbarkeit: Verknüpfte Zutatenlagerbestände werden wieder gutgeschrieben und der Vorgang erscheint lückenlos im Schichtbericht unter "Stornierte Artikel".',
        ],
        hints: [
          {
            kind: 'tip',
            text: 'Wird in den Admin-Einstellungen die Storno-Zeit auf 0 gesetzt oder deaktiviert, können Kellner gar nicht mehr nachträglich stornieren, sondern nur noch die Kassenleitung.',
          },
        ],
      },
      {
        id: '2.5',
        heading: '2.5 Bestellaufnahme & Warenkorb',
        paragraphs: [
          'Die Bestellmaske listet alle Warengruppen auf. Ein Fingertipp auf ein Produkt legt es in den Warenkorb. Besitzt ein Artikel Untervarianten (z. B. Groß/Klein oder verschiedene Beilagen), öffnet sich automatisch das Auswahlfenster.',
          'Der Warenkorb am unteren Bildschirmrand fasst Menge und Summe zusammen. Mit der Taste "Bestellen" werden die Bons an Küche und Schänke gedruckt.',
        ],
        image: {
          src: '/docs/images/05b_waiter_order_warenkorb.png',
          alt: 'Bestellmaske mit Warenkorb',
          caption: 'Bestellmaske mit Warengruppen und geöffnetem Warenkorb',
        },
      },
      {
        id: '2.6',
        heading: '2.6 Sonderwünsche-Baukasten & Freitext',
        paragraphs: [
          'Über die Schaltfläche "+ Wunsch" öffnet sich der Wünsche-Baukasten. Hier können typische Gastwünsche ("ohne Zwiebeln", "extra Soße", "kross gebraten") kombiniert oder freie Notizen eingegeben werden.',
          'Sonderwünsche werden auf dem Küchenausdruck und dem Monitor besonders auffällig markiert.',
        ],
      },
      {
        id: '2.7',
        heading: '2.7 Gänge-Steuerung & HOLD (Zurückhalten)',
        paragraphs: [
          'Speisen können Gängen zugeordnet werden (Gang 1: Vorspeise, Gang 2: Hauptgang, Gang 3: Dessert).',
          'Wird ein Gang auf "Zurückhalten (HOLD)" gesetzt, wird der Küchenbon noch nicht gedruckt. Erst wenn die Bedienung den Gang später am Tisch freigibt, beginnt die Küche mit der Zubereitung.',
        ],
      },
      {
        id: '2.8',
        heading: '2.8 Rechnungs-Splitting (Getrennt zahlen)',
        paragraphs: [
          'Wollen Gäste getrennt bezahlen, bietet OpenBon eine komfortable Splitting-Maske:',
          '1. Auf "Getrennt zahlen" tippen.',
          '2. Die Artikel antippen, die der erste Gast übernimmt (oder Mengen mit +/- anpassen).',
          '3. Sofort kassieren. Nach dem Bezahlvorgang kehrt OpenBon direkt zum Tisch zurück, um den nächsten Gast abzurechnen.',
        ],
        image: {
          src: '/docs/images/06a_waiter_payment_splitting.png',
          alt: 'Rechnungs-Splitting',
          caption: 'Postenweises Auswählen beim getrennten Bezahlen',
        },
      },
      {
        id: '2.9',
        heading: '2.9 Touch-Bargeldrechner & Trinkgeld-Schnellrundung',
        paragraphs: [
          'Der Bezahlbildschirm beschleunigt das Kassieren spürbar:',
          '• Pfeiltasten-Schnellrundung: Mit den 4 Touch-Pfeilen kann die Rechnung schnell auf volle Euro oder 50-Cent aufgerundet werden. Das Trinkgeld wird automatisch errechnet.',
          '• Geldscheine & Münzen: Ein Tipp auf die abgebildeten Euro-Scheine und Münzen summiert das übergebene Geld.',
          '• Rückgeldanzeige: Das exakte Wechselgeld wird groß und fett in Grün angezeigt.',
        ],
        image: {
          src: '/docs/images/06c_waiter_payment_cash_rechner.png',
          alt: 'Bargeldrechner und Trinkgeld-Rundung',
          caption: 'Touch-Bargeldrechner mit Scheinen, Münzen und Schnellrundung',
        },
      },
      {
        id: '2.10',
        heading: '2.10 Pfandrückgabe-Matrix',
        paragraphs: [
          'Bringen Gäste Gläser, Krüge oder Flaschen zurück, können diese direkt im Bezahlfenster über die Pfandmatrix verrechnet werden. Der Pfandbetrag wird sofort vom Zahlbetrag abgezogen.',
        ],
        image: {
          src: '/docs/images/06d_waiter_payment_pfand_matrix.png',
          alt: 'Pfandrückgabe Matrix',
          caption: 'Verrechnung von Pfandgut direkt im Bezahlprozess',
        },
      },
      {
        id: '2.11',
        heading: '2.11 X-Bon Zwischenstand & Tischhistorie',
        paragraphs: [
          'Jede Bedienung kann am Smartphone jederzeit ihren aktuellen Zwischenumsatz (X-Bon) abfragen, um den bisherigen Kassenstand zu kontrollieren.',
        ],
        image: {
          src: '/docs/images/04d_waiter_xbon_zwischenstand.png',
          alt: 'X-Bon Zwischenstand',
          caption: 'Kellner-Zwischenstand mit Umsatz, Baranteil und Kartenzahlungen',
        },
      },
    ],
  },
  {
    id: 'pos',
    chapterNumber: 3,
    title: 'Stationäre Kasse, SB-Kiosk & Kundendisplay',
    subtitle: 'Direktverkauf, Wertmarken, Kassenlade, E-Bon, SB-Terminal und Zweitbildschirm',
    icon: 'pos',
    sections: [
      {
        id: '3.1',
        heading: '3.1 Sofortverkauf an der Bonkasse',
        paragraphs: [
          'Unter /pos befindet sich die optimierte Theken- und Bonkasse für feste Kassenplätze, Wertmarkenbuden und Zelteingänge.',
          'Artikel werden mit einem Klick ausgewählt und erscheinen im übersichtlichen Warenkorb. Für maximale Übersicht wurde die alte Anzeige der Abholnummer entfernt.',
        ],
        image: {
          src: '/docs/images/03_pos_counter.png',
          alt: 'Stationäre Bonkasse',
          caption: 'Die Kassenansicht für Thekenverkauf und Wertmarkenausgabe',
        },
      },
      {
        id: '3.2',
        heading: '3.2 Kassiermodal & Zahlungsarten',
        paragraphs: [
          'Beim Klick auf "Kassieren" öffnet sich das Kassiermodal. Hier stehen Barzahlung, Kartenzahlung und Wertmarken zur Auswahl. Auch gemischte Teilzahlungen (z. B. 20 € bar und Rest per Karte) werden unterstützt.',
        ],
        image: {
          src: '/docs/images/03c_pos_kassiermodal_voll.png',
          alt: 'Kassiermodal Bonkasse',
          caption: 'Kassiermaske mit Zahlungsarten, Rückgeld und Belegoptionen',
        },
      },
      {
        id: '3.3',
        heading: '3.3 Kassenladen-Steuerung (RJ12 Impuls)',
        paragraphs: [
          'Wird ein Barverkauf abgeschlossen, sendet OpenBon automatisch den Auslöseimpuls über das Druckerkabel an die Kassenlade, sodass sie sofort aufspringt.',
        ],
      },
      {
        id: '3.4',
        heading: '3.4 Wertmarken- & Festbon-Druck',
        paragraphs: [
          'Artikel können als Wertmarken konfiguriert werden. Beim Verkauf druckt der Drucker für jede Marke einen separaten Bonabschnitt mit fortlaufender Festnummer.',
        ],
      },
      {
        id: '3.5',
        heading: '3.5 Digitaler E-Bon & Web-NFC',
        paragraphs: [
          'Nach dem Kassieren kann dem Gast ein digitaler Beleg ausgestellt werden: Entweder hält der Gast sein Smartphone an das Kassentablet (Web-NFC) oder scannt den angezeigten QR-Code ab.',
        ],
        image: {
          src: '/docs/images/12_receipt_ebon.png',
          alt: 'Digitaler E-Bon',
          caption: 'Papierloser digitaler Kassenbeleg mit TSE-Signatur',
        },
      },
      {
        id: '3.6',
        heading: '3.6 SB-Kiosk (Self-Order-Terminal) & "Alles löschen"',
        paragraphs: [
          'Das SB-Kiosk (/kiosk) erlaubt es Gästen, Speisen und Getränke selbstständig an einem Terminal auszuwählen und bargeldlos zu bezahlen.',
          'Um Verwirrung durch unerwartete Zeitabläufe zu vermeiden, wurde der automatische 60-Sekunden-Countdown entfernt. Stattdessen befindet sich im Warenkorb ein deutlicher Button "Alles löschen", mit dem der Gast oder die nächste Person den Warenkorb bei Bedarf mit einem Klick vollständig leeren kann.',
        ],
        image: {
          src: '/docs/images/09_kiosk_self_order.png',
          alt: 'SB-Kiosk Selbstbedienung',
          caption: 'SB-Kiosk mit klarer Artikelauswahl und "Alles löschen"-Schaltfläche',
        },
      },
      {
        id: '3.7',
        heading: '3.7 Kundendisplay (Customer-Facing-Display)',
        paragraphs: [
          'Ein zweites Tablet oder Monitor (/display) kann dem Gast zugewandt aufgestellt werden. Es spiegelt die Eingaben der Bonkasse in Echtzeit wider.',
          'Die Bonkasse meldet sich automatisch beim Start am Kundendisplay an – auch dann, wenn der Warenkorb noch völlig leer ist. Das Kundendisplay erkennt die Kasse sofort im Auswahlmenü.',
        ],
        image: {
          src: '/docs/images/10_customer_display.png',
          alt: 'Kundendisplay',
          caption: 'Live-Kundendisplay mit gebuchten Artikeln und Gesamtsumme',
        },
      },
      {
        id: '3.8',
        heading: '3.8 Digitale Gästekarte am Tisch',
        paragraphs: [
          'Über am Tisch angebrachte QR-Codes können Gäste mit dem eigenen Smartphone die Speisekarte (/menu?table=...) aufrufen, Preise einsehen und Allergene prüfen.',
        ],
        image: {
          src: '/docs/images/11_guest_table_menu.png',
          alt: 'Digitale Speisekarte Gast',
          caption: 'Speisekarte auf dem Smartphone des Gastes',
        },
      },
    ],
  },
  {
    id: 'kitchen',
    chapterNumber: 4,
    title: 'Küchen- & Ausschank-Monitor (KDS)',
    subtitle: 'Digitale Bonleiste, Garzeiten, Alarmierung, Team-Chat und Schankanlagen-Monitor',
    icon: 'kitchen',
    sections: [
      {
        id: '4.1',
        heading: '4.1 Digitale Bonleiste & Farbsignalisierung',
        paragraphs: [
          'Der Küchen- und Schankmonitor (/kitchen) ersetzt Papierbons durch digitale Kacheln auf einem Touch-Bildschirm.',
        ],
        table: {
          headers: ['Farbe der Bonkarte', 'Wartezeit', 'Status & Bedeutung'],
          rows: [
            ['Grün', '0 bis 5 Minuten', 'Neu eingetroffene Bestellung'],
            ['Gelb / Bernstein', '5 bis 12 Minuten', 'In Zubereitung am Grill / an der Schänke'],
            ['Rot blinkend', 'Über 12 Minuten', 'Dringend! Akustischer Warnton ertönt'],
          ],
        },
        image: {
          src: '/docs/images/08_kitchen_kds.png',
          alt: 'Küchenmonitor KDS',
          caption: 'Digitaler Küchenmonitor mit farblicher Wartezeit-Einstufung',
        },
      },
      {
        id: '4.2',
        heading: '4.2 Arbeitsablauf & Gang-Freigaben',
        steps: [
          'Beim Start der Zubereitung: Den Bon einmal antippen (Status wechselt auf Gelb "In Arbeit").',
          'Wenn Speisen oder Getränke fertig sind: Den Bon erneut antippen (wechselt auf Grün "Fertig").',
          'Das Kellner-Team sieht den Status sofort auf den Smartphones und kann die Bestellung abholen.',
        ],
      },
      {
        id: '4.3',
        heading: '4.3 Bons wiederherstellen',
        paragraphs: [
          'Wurde ein Bon versehentlich als fertig abgehakt, tippt das Küchenpersonal auf "Erledigte anzeigen" und kann den Bon mit einer Berührung reaktivieren.',
        ],
      },
      {
        id: '4.4',
        heading: '4.4 Team-Chat & Durchsagen',
        paragraphs: [
          'Über das Chat-Symbol können Küche, Schänke, Kassenleitung und Kellner kurze Textdurchsagen austauschen (z. B. "Pommes dauert 5 Min", "Fasswechsel an Bar 2").',
        ],
        image: {
          src: '/docs/images/13_team_chat.png',
          alt: 'Team-Chat',
          caption: 'Integrierter Funk-Ersatz: Schnelle Text-Durchsagen ans Team',
        },
      },
      {
        id: '4.5',
        heading: '4.5 Schankanlagen-Überwachung (Flow Monitor)',
        paragraphs: [
          'Unter /taps können Durchflussmesser an den Bierzapfhähnen angebunden werden, um den Füllstand der Fässer in Litern und Prozent exakt im Blick zu behalten.',
        ],
        image: {
          src: '/docs/images/14_taps_flow_monitor.png',
          alt: 'Schankanlagen Monitor',
          caption: 'Live-Füllstandsanzeige aller angeschlossenen Bierfässer',
        },
      },
    ],
  },
  {
    id: 'products',
    chapterNumber: 5,
    title: 'Stammdaten, Speisekarte & Zutatenlager',
    subtitle: 'Artikel, Warengruppen, Rezepturen, Zutatenlager (StockUnit) und Allergene',
    icon: 'products',
    sections: [
      {
        id: '5.1',
        heading: '5.1 Warengruppen & Artikelpflege',
        paragraphs: [
          'Unter /admin/products werden Speisen und Getränke angelegt. Warengruppen (z. B. "Biere", "Alkoholfrei", "Grill", "Kaffee & Kuchen") sorgen für Struktur und erhalten eigene Kennfarben.',
        ],
        image: {
          src: '/docs/images/17_admin_products.png',
          alt: 'Artikelverwaltung',
          caption: 'Verwaltung von Artikeln, Warengruppen, Preisen und Steuersätzen',
        },
      },
      {
        id: '5.2',
        heading: '5.2 Steuersätze & Pfandartikel',
        paragraphs: [
          'Jedem Artikel wird der korrekte Steuersatz (19 % Vor-Ort-Verzehr oder 7 % Mitnahme/Grundnahrungsmittel) zugewiesen. Bei Pfandartikeln (z. B. 1,00 € Glaspfand) wird der Pfandbetrag separat hinterlegt und finanzamtkonform als durchlaufender Posten geführt.',
        ],
      },
      {
        id: '5.3',
        heading: '5.3 Zutatenlager (StockUnit) & Rezepturabzug',
        paragraphs: [
          'Verkaufsartikel können mit echten Rohstoffen verknüpft werden. Ein Beispiel: "Bratwurstsemmel" und "Steaksemmel" greifen beide auf die Zutat "Semmeln" zu. Beim Verkauf wird die Zutat automatisch abgebucht.',
        ],
        image: {
          src: '/docs/images/27_admin_stock_units.png',
          alt: 'Zutatenlager StockUnits',
          caption: 'Verknüpfung von Verkaufsartikeln mit Zutaten und Gebinden',
        },
      },
      {
        id: '5.4',
        heading: '5.4 Inventar & Meldebestand',
        paragraphs: [
          'Für jeden Artikel oder jede Zutat kann ein Meldebestand hinterlegt werden. Fällt der Bestand unter diesen Wert, warnt OpenBon das Personal rechtzeitig vor dem Ausverkauf.',
        ],
        image: {
          src: '/docs/images/26_admin_inventory.png',
          alt: 'Lagerbestand Übersicht',
          caption: 'Lagerbestände mit Warnanzeige bei knappem Vorrat',
        },
      },
      {
        id: '5.5',
        heading: '5.5 Beschaffungsliste & Nachbestellungen',
        paragraphs: [
          'Unter /admin/procurement wird auf Basis der aktuellen Bestände automatisch eine druckbare Einkaufsliste generiert.',
        ],
        image: {
          src: '/docs/images/28_admin_procurement.png',
          alt: 'Beschaffungsliste',
          caption: 'Automatisch berechnete Einkaufs- und Nachbestellungsliste',
        },
      },
      {
        id: '5.6',
        heading: '5.6 Druckbare Speisekarte (4 Vorlagen)',
        paragraphs: [
          'Mit einem Klick lässt sich die Speisekarte in 4 verschiedenen A4- und A5-Layouts drucken oder als PDF speichern: Klassisch, Modernes Raster, Großschrift-Aushang für Kassenhäuschen und A5-Tischaufsteller.',
        ],
      },
    ],
  },
  {
    id: 'printers',
    chapterNumber: 6,
    title: 'Druckermanagement & Raumpläne',
    subtitle: 'ESC/POS-Netzwerkdrucker, Bon-Routing, Tischplan-Editor und Druckansicht',
    icon: 'printers',
    sections: [
      {
        id: '6.1',
        heading: '6.1 Netzwerkdrucker einrichten',
        paragraphs: [
          'OpenBon steuert Standard-Thermodrucker (Epson, Star, Munbyn etc.) direkt über das Netzwerk via TCP Port 9100 an. Es müssen keine Druckertreiber auf Windows installiert werden.',
        ],
        image: {
          src: '/docs/images/20_admin_printers.png',
          alt: 'Druckerverwaltung',
          caption: 'Konfiguration von Bondruckern mit IP-Adresse und Druckergruppen',
        },
      },
      {
        id: '6.2',
        heading: '6.2 Virtueller Testdrucker',
        paragraphs: [
          'Ist kein echter Bondrucker angeschlossen, fängt der "Virtuelle Drucker" alle Belege ab und zeigt sie 1:1 im Browserfenster an. Perfekt zum Testen vor dem Fest.',
        ],
        image: {
          src: '/docs/images/15_virtual_printer.png',
          alt: 'Virtueller Drucker',
          caption: 'Simulation von Kassen- und Küchenbons direkt im Browser',
        },
      },
      {
        id: '6.3',
        heading: '6.3 Druckergruppen & Bon-Splitting',
        paragraphs: [
          'Jeder Artikel ist einer Druckergruppe zugeordnet (z. B. Küche -> Grillstation, Getränke -> Ausschank 1). Bestellt ein Gast Steak und Bier zusammen, trennt OpenBon die Positionen automatisch und druckt parallel an den richtigen Stationen.',
          'Werden viele Getränke auf einmal geordert, teilt das Tablett-Splitting den Druck automatisch in handliche Bons auf (z. B. max. 6 Krüge pro Bon).',
        ],
      },
      {
        id: '6.4',
        heading: '6.4 Tisch- & Raumplan-Editor',
        paragraphs: [
          'Unter /admin/tables können Räume (z. B. "Festzelt", "Biergarten", "Bar") und Tische per Drag-and-Drop angeordnet und beschriftet werden.',
        ],
        image: {
          src: '/docs/images/18_admin_tables.png',
          alt: 'Tischplan Editor',
          caption: 'Visueller Raumplan-Editor mit Tischen und Raumkategorien',
        },
      },
      {
        id: '6.5',
        heading: '6.5 Tischplan drucken (Nur Tischnummern)',
        paragraphs: [
          'Für die Schichtleitung, die Feuerwehr oder den Ausschank kann der Tischplan ausgedruckt werden. Auf dem Ausdruck wird in jedem Tisch ausschließlich die Tischnummer groß und lesbar abgebildet – ohne störende Zusatzangaben wie Koordinaten oder Beschriftungs-Präfixe.',
        ],
        image: {
          src: '/docs/images/19_admin_tables_print.png',
          alt: 'Druckbarer Tischplan',
          caption: 'Druckfertiger Tischplan mit klaren, großen Tischnummern',
        },
      },
    ],
  },
  {
    id: 'payment',
    chapterNumber: 7,
    title: 'Zahlungen, Trinkgeld & Abrechnung',
    subtitle: 'Kartenterminals, Kassensturz, Storno-Übersicht, Touch-Numpad und Kassenbuch',
    icon: 'payment',
    sections: [
      {
        id: '7.1',
        heading: '7.1 Kartenzahlung & Terminals (Beta)',
        paragraphs: [
          'OpenBon unterstützt gängige Kartenterminals für bargeldlose Zahlung vor Ort:',
          'Hinweis (Beta): Die Schnittstellen für externe Kartenterminals (SumUp, VR-Pay, Sparkasse S-POS, Zettle, Stripe und stationäre ZVT-Terminals) befinden sich aktuell im Beta-Status. Sie wurden nach offiziellen Vorgaben implementiert, jedoch noch nicht im echten Großveranstaltungsbetrieb vor Ort getestet. Führen Sie vor Festbeginn stets Testbuchungen mit Ihrem Terminal durch.',
        ],
        table: {
          headers: ['Anbieter', 'Verbindungsart', 'Einsatzgebiet'],
          rows: [
            ['SumUp', 'App-to-App & Bluetooth', 'Kompakte mobile Leser für Kellner'],
            ['VR-Pay:Me', 'App-to-App (Volksbanken)', 'Mobiles Bezahlen mit VR-Smart Guide'],
            ['Sparkasse S-POS', 'App-to-App (Sparkassen)', 'Direkte Abrechnung auf das Vereinskonto'],
            ['Zettle by PayPal', 'App-to-App', 'Zettle Card Reader Integration'],
            ['Stripe Terminal', 'Smart Reader & QR', 'Cloudbasierte Kreditkartenabwicklung'],
            ['ZVT-over-IP', 'Netzwerk (Port 20007)', 'Stationäre Standard-EC-Terminals an Theken'],
          ],
        },
      },
      {
        id: '7.2',
        heading: '7.2 Trinkgeld-Modelle & Personal',
        paragraphs: [
          'Unter "Personal & Abrechnung" (/admin/settle) können flexible Trinkgeld-Verteilungsregeln hinterlegt werden: Kellner behält 100 %, Team-Pool mit Schänke und Küche, oder individuelle Prozentaufteilungen.',
        ],
        image: {
          src: '/docs/images/30_admin_tips.png',
          alt: 'Trinkgeld-Verwaltung',
          caption: 'Regeln für Trinkgeld-Ausschüttung und Team-Pool',
        },
      },
      {
        id: '7.3',
        heading: '7.3 Geführter Kassensturz & Touch-Numpad',
        paragraphs: [
          'Die Schichtabrechnung erfolgt in einem sicheren 5-Schritte-Assistenten:',
          '1. Mitarbeiter wählen.',
          '2. Soll-Umsatz und Zahlungsmittel prüfen.',
          '3. Gezähltes Bargeld eingeben: Hier erscheint bei Berührung automatisch das Touch-Zahlenfeld mit praktischen Tasten für +5, +10, +20, +50 €. Das Tippen ist fehlerfrei möglich, da störende führende Nullen automatisch ersetzt werden.',
          '4. Abrechnungsbericht mit 4 Reitern prüfen: Übersicht, Verkaufte Artikel, Bestellungen und der neue Reiter "Stornierte Artikel".',
          '5. Abrechnung ausdrucken und Schicht abschließen.',
        ],
        image: {
          src: '/docs/images/22b_admin_settle_touch_numpad.png',
          alt: 'Touch-Zahlenfeld Bargeld',
          caption: 'Touch-Zahlenfeld mit extra großen Tasten für Übernehmen und Löschen sowie Schnelladdition (+5, +10, +20, +50 €)',
        },
      },
      {
        id: '7.4',
        heading: '7.4 Reiter "Stornierte Artikel" & Berichts-Ausdruck',
        paragraphs: [
          'In der Schichtabrechnung listet der neue Reiter "Stornierte Artikel" alle Stornierungen der Schicht auf (Artikelname, Anzahl, Einzelpreis und Gesamtsumme).',
          'Sowohl auf dem A4-Ausdruck als auch auf dem 80mm-Thermobon-Ausdruck werden stornierte Posten transparent ausgewiesen, sodass Kassenleitung und Vereinsvorstand lückenlose Nachvollziehbarkeit haben.',
        ],
        image: {
          src: '/docs/images/22_admin_settle.png',
          alt: 'Schichtabrechnung mit Storno-Reiter',
          caption: 'Schichtabrechnung mit den 4 Reitern inklusive "Stornierte Artikel"',
        },
      },
      {
        id: '7.5',
        heading: '7.5 Kassenbuch (GoBD: Bareinlagen & Barentnahmen)',
        paragraphs: [
          'Unter /admin/cashbook wird das gesetzliche Kassenbuch geführt. Wechselgeldeinlagen zu Beginn der Schicht, Barauslagen (z. B. Einkauf von Eiswürfeln) und Geldabgaben an den Haupttresor werden revisionssicher erfasst.',
        ],
        image: {
          src: '/docs/images/23_admin_cashbook.png',
          alt: 'GoBD Kassenbuch',
          caption: 'Kassenbuch für Bareinlagen, Wechselgeld und Barentnahmen',
        },
      },
      {
        id: '7.6',
        heading: '7.6 Buchhaltung & DATEV-Export',
        paragraphs: [
          'Für das Steuerbüro und den Vereinskassierer stellt OpenBon unter /admin/accounting fertige DATEV-kompatible Buchungslisten (SKR03 / SKR04) bereit.',
        ],
        image: {
          src: '/docs/images/29_admin_accounting.png',
          alt: 'DATEV Buchhaltungs-Export',
          caption: 'Buchungsstapel und Export für die Vereinsbuchhaltung',
        },
      },
    ],
  },
  {
    id: 'backup',
    chapterNumber: 8,
    title: 'TSE, Finanzamt, Backups & Datenschutz',
    subtitle: 'KassenSichV, Kassenmeldung § 146a AO, automatische Snapshots und USB-Export',
    icon: 'backup',
    sections: [
      {
        id: '8.1',
        heading: '8.1 Gesetzliche KassenSichV & Technische Sicherheitseinrichtung (TSE) (Beta)',
        paragraphs: [
          'OpenBon erfüllt die Vorgaben der deutschen Kassensicherungsverordnung. Unter /admin/fiscal kann eine zertifizierte TSE (Hardware-USB-Stick von Swissbit oder Cloud-TSE) angebunden werden. Jeder Kassiervorgang erhält eine manipulationssichere Signatur.',
          'Hinweis (Beta): Die TSE-Anbindung und die DSFinV-K Prüfexporte befinden sich im Beta-Status und wurden noch nicht bei einer behördlichen Betriebsprüfung im Produktiveinsatz getestet.',
        ],
        image: {
          src: '/docs/images/24_admin_fiscal.png',
          alt: 'KassenSichV TSE Status',
          caption: 'TSE-Konfiguration und Signaturprüfung nach KassenSichV (Beta)',
        },
      },
      {
        id: '8.2',
        heading: '8.2 Amtliche Kassenmeldung (§ 146a Abs. 4 AO) (Beta)',
        paragraphs: [
          'Gemäß Abgabenordnung müssen elektronische Aufzeichnungssysteme dem Finanzamt gemeldet werden. OpenBon erzeugt das offizielle Meldeformular unter /admin/fiscal/kassenmeldung auf Knopfdruck.',
          'Hinweis (Beta): Die automatische Kassenmeldung befindet sich im Beta-Status.',
        ],
        image: {
          src: '/docs/images/25_admin_fiscal_kassenmeldung.png',
          alt: 'Amtliche Kassenmeldung Finanzamt',
          caption: 'Vollständiges Meldeformular für das zuständige Finanzamt (Beta)',
        },
      },
      {
        id: '8.3',
        heading: '8.3 Smartphone-Outbox (WLAN-Ausfallsicherheit)',
        paragraphs: [
          'Sollte das WLAN im Festzelt kurzzeitig abreißen, bleiben die Kellner-Handys voll bedienbar: Die Bestellungen werden lokal auf dem Telefon zwischengespeichert und automatisch an die Kasse gesendet, sobald das Netz wieder steht.',
        ],
      },
      {
        id: '8.4',
        heading: '8.4 Automatische Snapshots & Datensicherung',
        paragraphs: [
          'Unter /admin/backup legt OpenBon in regelmäßigen Intervallen Sicherungskopien an. Zudem kann vor oder nach dem Fest mit einem Klick ein vollständiges Backup auf einen USB-Stick gespeichert werden.',
        ],
        image: {
          src: '/docs/images/35_admin_backup.png',
          alt: 'Datensicherung und Backups',
          caption: 'Snapshot-Verwaltung und 1-Klick-Backup auf USB-Laufwerke',
        },
      },
      {
        id: '8.5',
        heading: '8.5 Vorlagen exportieren & importieren',
        paragraphs: [
          'In den Einstellungen unter "Vorlagen & Snapshots" kann die gesamte Fest-Konfiguration (Speisekarte, Tische, Preise, Drucker) als Vorlage exportiert und beim nächsten Fest oder auf einem Zweitsystem sekundenschnell wieder importiert werden.',
        ],
      },
    ],
  },
  {
    id: 'diagnostics',
    chapterNumber: 9,
    title: 'Systemdiagnose, Einstellungen & Updates',
    subtitle: 'Preflight-Check, Revisionssicheres ActionLog, Einstellungen und Versions-Manager',
    icon: 'diagnostics',
    sections: [
      {
        id: '9.1',
        heading: '9.1 1-Klick Preflight-Check vor Festbeginn',
        paragraphs: [
          'Unter /admin/diagnostics prüft das System vor Festbeginn automatisch alle wichtigen Komponenten: Datenbank-Integrität, Drucker-Erreichbarkeit im Netzwerk, Speisekarten-Konsistenz und simuliert einen vollständigen Test-Bestellzyklus.',
        ],
        image: {
          src: '/docs/images/34_admin_diagnostics.png',
          alt: 'Systemdiagnose Preflight-Check',
          caption: 'Automatisierter 1-Klick-Systemtest vor Veranstaltungsbeginn',
        },
      },
      {
        id: '9.2',
        heading: '9.2 Revisionssicheres ActionLog',
        paragraphs: [
          'Jede Buchung, Stornierung, Preisänderung und Benutzeranmeldung wird manipulationssicher im ActionLog mit Zeitstempel und Gerät protokolliert. Bei Prüfungen kann das Log nach Zeiträumen und Ereignissen gefiltert exportiert werden.',
        ],
        image: {
          src: '/docs/images/36_admin_logs.png',
          alt: 'ActionLog Revisionsprotokoll',
          caption: 'Audit-Protokoll aller Systemereignisse und Kassenaktionen',
        },
      },
      {
        id: '9.3',
        heading: '9.3 Zentrale Fest- und Systemeinstellungen',
        paragraphs: [
          'Unter /admin/settings werden alle grundlegenden Optionen festgelegt: Name des Vereins, Steuersätze, Währung, Tischfarben, Stornierungsfristen und Kassenoptionen.',
          'Wird eine Einstellung verändert, warnt OpenBon beim Verlassen der Seite vor ungespeicherten Daten.',
        ],
        image: {
          src: '/docs/images/37_admin_settings.png',
          alt: 'Systemeinstellungen',
          caption: 'Zentrale Verwaltung aller Fest-Parameter und Kassenoptionen',
        },
      },
      {
        id: '9.4',
        heading: '9.4 Angemeldete Geräte & Stationen',
        paragraphs: [
          'Unter /admin/devices behält die Kassenleitung den Überblick über alle angemeldeten Kellner-Handys, Tablets und Kassenmonitore inklusive Akkuladestand und Verbindungsqualität.',
        ],
        image: {
          src: '/docs/images/32_admin_devices.png',
          alt: 'Geräteübersicht',
          caption: 'Übersicht aller im Netzwerk aktiven Smartphones und Kassen',
        },
      },
      {
        id: '9.5',
        heading: '9.5 System-Update & Versions-Manager',
        paragraphs: [
          'Unter /admin/system-update kann OpenBon mit einem Klick aktualisiert werden. Ein Arbeitsspeicher-Balken zeigt die Serverauslastung an. Der Schalter "Nur Releases anzeigen" stellt sicher, dass ausschließlich erprobte und stabile Hauptversionen installiert werden.',
        ],
        image: {
          src: '/docs/images/38_admin_system_update.png',
          alt: 'System-Update Manager',
          caption: '1-Klick-Update-Manager mit Speicheranzeige und Release-Filter',
        },
      },
    ],
  },
];
