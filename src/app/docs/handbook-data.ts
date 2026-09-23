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
        heading: '1.7 Navigationsschutz, Stationswechsel & Menü-Scroll-Kapselung',
        paragraphs: [
          'Damit bei langen Menüs oder Listen auf Touch-Geräten kein versehentliches Verschieben des Hintergrunds auftritt, kapselt OpenBon das Hauptmenü vollständig ab. Das Scrollen bleibt exakt im Menüfenster gebunden.',
          'Direkter Stationswechsel im Hauptmenü: Tippt man im Seitenmenü auf eine andere Station (z. B. Küche, Kasse oder Verwaltung), schließt sich das Menü sofort von selbst und das PIN-Zahlenfeld erscheint direkt im Vordergrund. Niemand muss das Menü erst umständlich von Hand wegdrücken.',
          'Werden in den Systemeinstellungen Änderungen vorgenommen und der Benutzer möchte die Seite verlassen, erinnert ein automatischer Sicherheitsdialog an das Speichern ungesicherter Eingaben.',
        ],
      },
      {
        id: '1.8',
        heading: '1.8 Hardware-Empfehlungen & Kapazitätsplanung nach Festgröße',
        paragraphs: [
          'Wie viele Geräte (Bedienungs-Handys, Kassenmonitore, Küchenbildschirme) können gleichzeitig mit dem Hauptrechner verbunden werden? Dies hängt vor allem von der Leistungsfähigkeit des Computers ab, auf dem OpenBon läuft.',
          'Da OpenBon extrem sparsam programmiert ist, genügt für viele Vereinsfeste bereits ein vorhandener Laptop oder ein günstiger Mini-PC. Wichtig ist vor allem eine moderne SSD-Festplatte und eine feste Netzwerkverbindung (LAN-Kabel) zum WLAN-Router.',
          'In der folgenden Tabelle finden Sie praxiserprobte Empfehlungen, aufgeteilt nach der Größe Ihres Festes:',
        ],
        table: {
          headers: ['Festgröße & Gästezahl', 'Gleichzeitige Geräte', 'Empfohlener Rechner & Mindestanforderung an den Prozessor', 'Arbeitsspeicher & Speicherplatz'],
          rows: [
            [
              'Kleines Fest (bis ca. 500 Gäste)',
              'Bis zu 5 Geräte (z. B. 2 Kellner, 1 Kasse, 1 Küchenanzeige)',
              'Einfacher Laptop oder kompakter Mini-PC. Prozessor: mind. Intel Core i3 ab der 2. Generation (z. B. Core i3-2350M oder höher), Intel Celeron N4100 / N5100, AMD Athlon 3000G oder Raspberry Pi 4.',
              'Mindestens 4 GB Arbeitsspeicher, SSD-Festplatte (mind. 30 GB freier Speicher).'
            ],
            [
              'Mittleres Vereinsfest (500 bis 2.500 Gäste)',
              '6 bis 20 Geräte (z. B. 8 Kellner, 2 Kassen, 2 Küchen- & Schankmonitore, 1 SB-Kiosk)',
              'Moderner Mini-PC oder Office-Laptop. Prozessor: mind. Intel Prozessor N95 / N100 (Alder-Lake-Generation), Intel Core i3 oder Core i5 ab der 6. Generation (z. B. Core i5-6400, Core i3-8100 oder neuer), AMD Ryzen 3 / 5 ab der 2000er-Serie (z. B. Ryzen 3 2200G, Ryzen 5 3500U) oder Raspberry Pi 5.',
              'Mindestens 8 GB Arbeitsspeicher, schnelle SSD-Festplatte (mind. 60 GB freier Speicher).'
            ],
            [
              'Großes Festzelt & Großveranstaltung (über 2.500 Gäste)',
              '20 bis über 50 Geräte dauerhaft im Volleinsatz',
              'Leistungsstarker Desktop-PC oder starker Mini-PC. Prozessor: mind. Intel Core i5 oder Core i7 ab der 10. Generation (z. B. Core i5-10400, Core i5-12400 oder neuer) oder AMD Ryzen 5 / 7 ab der 4000/5000er-Serie (z. B. Ryzen 5 5600G).',
              'Mindestens 16 GB Arbeitsspeicher, blitzschnelle NVMe-SSD (mind. 120 GB freier Speicher).'
            ],
          ],
        },
        hints: [
          {
            kind: 'tip',
            text: 'Tipp für stabile Verbindungen: Schließen Sie den Hauptrechner immer mit einem echten Netzwerkkabel (LAN) an den WLAN-Router an, anstatt ihn über WLAN zu betreiben. Das sorgt für blitzschnelle Reaktionszeiten aller Handys.',
          },
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
      {
        id: '2.12',
        heading: '2.12 Bedienungsname, Schichtwechsel, Pausen & Schicht-Ende',
        paragraphs: [
          'Bedienungsname und Stift-Symbol: In der oberen Leiste steht der Name der aktuellen Bedienung. Ein Fingertipp auf das Stift-Symbol öffnet das Wechsel- und Abmeldefenster.',
          'Sicherer Helferwechsel ohne Versehentliches Umschalten: Tippt man auf einen Namen aus der Schnellauswahl, wird dieser zunächst sicher in das Namensfeld eingetragen. Erst wenn man auf die grüne Taste "Wechseln & Weiter" tippt, wird der Wechsel tatsächlich ausgeführt.',
          'Auswahl beim Abmelden (Pause vs. Schichtende):',
          '• Kurze Pause (Nur sperren): Das Smartphone wird vorübergehend gesperrt, damit während einer kurzen Essens- oder WC-Pause niemand versehentlich darauf bucht. Bei erneuter Anmeldung setzt die Bedienung ihre Schicht nahtlos mit derselben Schicht-Kennnummer und Schichtzeit fort.',
          '• Schicht beenden (Ganz abmelden): Beendet die aktuelle Schicht vollständig und erfasst das genaue Abmeldedatum mit Uhrzeit. Meldet sich dieselbe Person später für eine neue Schicht wieder an, vergibt das System automatisch eine neue Schicht-Kennnummer mit eigener, frischer Startzeit.',
          'Live-Geräteübertragung: Der Name der angemeldeten Bedienung wird in Echtzeit an die Kassenleitung (/admin/devices) übertragen, sodass immer ersichtlich ist, wer welches Smartphone nutzt.',
          'WLAN-Empfangs-Ampel: Neben dem Namen befindet sich eine praktische Status-Ampel für das Zelt-WLAN:',
          '• Grün ("WLAN OK"): Die Funkverbindung zur Hauptkasse ist stabil. Bestellungen werden sofort übermittelt.',
          '• Rot blinkend ("Offline / WLAN getrennt"): Sobald eine Bedienung außerhalb der Funkreichweite gerät (z. B. im hinteren Biergarten), schlägt die Ampel rot an und ein auffälliges Warnbanner weist darauf hin. So weiß die Bedienung sofort, dass sie sich wieder ein Stück in Richtung Zelt bewegen muss, bevor sie Bestellungen absendet.',
        ],
      },
    ],
  },
  {
    id: 'pos',
    chapterNumber: 3,
    title: 'Stationäre Kasse, SB-Kiosk & Kundendisplay',
    subtitle: 'Direktverkauf, Wertmarken, Kassenlade, E-Bon, SB-Terminal, Zweitbildschirm und Android Kiosk-Modus',
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
          src: '/docs/images/07_pos_direct_sale.png',
          alt: 'Bonkasse Sofortverkauf',
          caption: 'Direktverkauf an der Bonkasse mit schneller Artikelauswahl',
        },
      },
      {
        id: '3.2',
        heading: '3.2 Nummernblock: Schnelle Mengeneingabe',
        paragraphs: [
          'Über den integrierten Ziffernblock können Beträge oder Stückzahlen blitzschnell eingetippt werden.',
          'Die Tasten "Übernehmen" und "C" (Löschen) sind für zügiges Kassieren besonders groß gestaltet und lassen sich auch mit nassen Fingern treffsicher bedienen.',
        ],
        image: {
          src: '/docs/images/08_pos_numpad.png',
          alt: 'Nummernblock Bonkasse',
          caption: 'Großzügig dimensionierter Nummernblock für Fehleingabe-freies Arbeiten',
        },
      },
      {
        id: '3.3',
        heading: '3.3 Kassenschublade manuell & automatisch öffnen',
        paragraphs: [
          'OpenBon steuert Kassenladen direkt über den angeschlossenen Bondrucker an (über das Standard-RJ11/RJ12-Kabel an der Rückseite des Druckers).',
          'Stationsgenaue Zuweisung ("Bonkasse benennen"): Jede Kassenstation kann oben rechts über das Einstellungs-Symbol genau dem Thermodrucker zugewiesen werden, an dem die Schublade per Kabel angeschlossen ist. So öffnet sich immer exakt die Lade an der richtigen Theke – auch wenn mehrere Kassen, Küchendrucker oder Schenkendrucker im Einsatz sind.',
          'Automatisches Öffnen beim Kassieren: Sobald eine Barzahlung verbucht wird, sendet OpenBon zusammen mit dem Belegauftrag den Öffnungsimpuls an den zugewiesenen Kassen-Drucker.',
          'Manuelles Öffnen auf Knopfdruck: In der Bonkasse befindet sich oben in der Leiste der Button "Lade öffnen". Damit kann die Kassenlade jederzeit geöffnet werden – z. B. für Wechselgeldprüfungen oder Geldwechsel.',
          'Klares optisches Feedback: Bei manuellem Öffnen bestätigt eine grüne Erfolgsmeldung ("Kassenlade geöffnet!"). Sollte das Druckerkabel nicht eingesteckt oder der Drucker offline sein, erscheint eine deutliche, leicht verständliche Hinweismeldung statt stummem Verhalten.',
          'Berechtigung & Sicherheit: Um Reibungsverluste am Thekenplatz zu vermeiden, dürfen Hauptadministratoren (ADMIN), Thekenkräfte (Rolle POS_CASHIER) und Kellner mit Kassenberechtigung (WAITER) die Schublade öffnen.',
          'Voraussetzung: In der Druckerverwaltung unter /admin/printers muss beim zuständigen Thermodrucker die Option "Kassenlade angeschlossen" aktiviert sein, und in den Stationseinstellungen der Bonkasse muss der Haken bei "Kassenlade an dieser Station vorhanden" gesetzt sein.',
        ],
      },
      {
        id: '3.4',
        heading: '3.4 Wertmarken & Abhol-Tokens',
        paragraphs: [
          'Für Festzelte mit separater Essens- oder Getränkeausgabe druckt OpenBon auf Wunsch fortlaufende Wertmarkennummern auf separate Bons, sodass Gäste ihre Speisen an der Essensausgabe per Nummernabruf abholen können.',
        ],
      },
      {
        id: '3.5',
        heading: '3.5 Digitaler E-Bon per QR-Code, Webhosting-Brücke & Speisekarte (PDF)',
        paragraphs: [
          'Nach dem Kassieren kann dem Gast auf Wunsch ein papierloser digitaler Beleg ausgestellt werden. Das schont Thermopapier und die Umwelt.',
          'Einfacher QR-Code statt komplizierter Technik: Der Beleg wird als gut lesbarer QR-Code direkt auf dem Kassenbildschirm oder Kellner-Smartphone angezeigt. Der Gast öffnet einfach die normale Kamera-App seines Smartphones und scannt den Code ab – funktioniert auf jedem iPhone und Android-Gerät ohne zusätzliche App.',
          'Garantierter Sofort-Abruf ohne 404-Fehler: Die erzeugten QR-Codes verwenden für externe Webhostings (wie Netcup oder Vereins-Webspaces) die universelle Link-Struktur "?code=EBON-...". Diese funktioniert auf 100 % aller Webserver sofort beim ersten Klick – selbst wenn keine speziellen Umleitungsregeln (.htaccess / mod_rewrite) aktiv sind.',
          'Schnelleres Scannen im Zelt: Durch den kompakteren Link enthält der QR-Code weniger Punkte und wird von Handykameras auch bei schwächerem Zeltlicht oder aus größerer Distanz blitzschnell erfasst.',
          'Webhosting-Brücke (LTE/5G Abruf): Damit Gäste den digitalen Beleg und die Speisekarte auch ohne Einwahl in das Festzelt-WLAN abrufen können, synchronisiert OpenBon die Belege auf ein gewöhnliches Webhosting (z. B. Netcup Webhosting 1000 oder ein Vereins-Webspace).',
          'Höchste Sicherheit & kein DynDNS: Das Kassennetzwerk im Zelt baut nur ausgehende, verschlüsselte Verbindungen zum Webhosting auf. Es ist WEDER eine Portfreigabe noch DynDNS am Zeltrouter nötig. Das Kassensystem bleibt von außen unangreifbar.',
          'Automatischer Datenschutz nach 24 Stunden: Alle auf das Webhosting übertragenen Belege werden nach genau 24 Stunden automatisch gelöscht. So bleibt der Speicherplatz sauber und Gastdaten werden nicht dauerhaft im Web gespeichert.',
          '1-Klick Verbindungstest: Unter "Einstellungen -> Bonlayout & Vorschau" prüft die Schaltfläche "Webhosting-Verbindung prüfen" in 3 Schritten, ob das Webhosting erreichbar ist, der Beleg uploadbar ist und die Daten wieder gelöscht werden können.',
          'Automatische Internet-Erkennung & Offline-Schutz: OpenBon prüft im Hintergrund in regelmäßigen Abständen, ob der Kassen-Computer tatsächlichen Internetzugang hat. Ist das Zelt-WLAN offline oder die Mobilfunkverbindung unterbrochen, wird die E-Bon-Option automatisch pausiert und stattdessen der Papierbon als zuverlässiger Fallback angeboten. So wird verhindert, dass Gäste QR-Codes scannen, die ohne Internet nicht aufgerufen werden können.',
          'Digitale Speisekarte als Vollbild-PDF: Beim Aufruf der Speisekarte über das Smartphone erscheint direkt das PDF randlos auf die volle Bildschirmbreite skaliert – ohne störende Buttons, Balken oder Umwege. Gäste können mit zwei Fingern stufenlos heranzoomen.',
          'Selbstlöschung nach 7 Tagen oder Wunsch-Festende: Die Speisekarte verschwindet nach 7 Tagen automatisch vom Webserver. Zusätzlich kann in den Kassen-Einstellungen ein minutengenaues Festende hinterlegt werden: Die Karte wird dann pünktlich vom Webspace gelöscht, selbst wenn alle Kassenrechner längst ausgeschaltet sind.',
        ],
        table: {
          headers: ['Schritt', 'Aktion', 'Erklärung (ohne Fachbegriffe)'],
          rows: [
            ['1. ZIP herunterladen', 'In OpenBon unter "Einstellungen -> Bonlayout & Vorschau"', 'Klicke neben der Basis-URL auf "ZIP-Paket herunterladen". Alle nötigen PHP-Dateien und der Sicherheitsschlüssel sind fertig verpackt.'],
            ['2. Webspace hochladen', 'Dateimanager (Plesk / cPanel) oder FTP', 'Entpacke das ZIP-Paket einfach in den Web-Ordner deines Webhostings (meist "httpdocs").'],
            ['3. Adresse eintragen', 'Öffentliche Basis-URL speichern', 'Trage die Web-Adresse (z. B. https://bon.mein-verein.de) in OpenBon ein. Fertig!'],
            ['4. Funktion testen', 'Schaltfläche "Webhosting-Verbindung prüfen"', 'Prüft sofort live, ob Übertragung und Belegabruf fehlerfrei funktionieren.'],
          ],
        },
        image: {
          src: '/docs/images/12_receipt_ebon.png',
          alt: 'Digitaler E-Bon',
          caption: 'Papierloser digitaler Kassenbeleg mit TSE-Signatur und Webhosting-Übertragung',
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
      {
        id: '3.9',
        heading: '3.9 Android-Tablets dauerhaft im Vollbild (Kiosk-Modus)',
        paragraphs: [
          'Auf Festen sollen Kassen- und Kellner-Tablets dauerhaft im Vollbild laufen. Normale Webbrowser wie Google Chrome sind dafür ungeeignet: Chrome beendet den Vollbildmodus automatisch, sobald das Tablet gesperrt und wieder entsperrt wird oder der Bildschirm kurz ausgeht.',
          'Die praxiserprobte und empfohlene Lösung für Android-Tablets: "Fully Kiosk Browser & Launcher" (kostenlos im Google Play Store erhältlich).',
          'Vorteile von Fully Kiosk Browser für das Vereinsfest:',
          '1. Dauerhafter Immersive Fullscreen: Adressleiste und Android-Navigationsleiste werden vollständig ausgeblendet. Auch nach dem Sperren und Entsperren des Tablets bleibt OpenBon zuverlässig im Vollbild.',
          '2. Zuverlässig bei Festzelt-WLAN: Verliert das Tablet kurz das WLAN und verbindet sich neu, lädt Fully Kiosk die Kassenoberfläche automatisch neu ("Auto-Reload on Network Reconnect").',
          '3. Fehlbedienung verhindern: Wischgesten oder der versehentliche Druck auf die Home-Taste können blockiert werden, sodass Helfer nicht versehentlich in die Android-Einstellungen gelangen.',
          '4. Bildschirm dauerhaft aktiv halten: Über die Einstellung "Keep Screen On" bleibt das Display während der gesamten Schicht eingeschaltet.',
        ],
        table: {
          headers: ['Einstellung in Fully Kiosk', 'Empfohlener Wert', 'Erklärung (ohne Fachbegriffe)'],
          rows: [
            ['Start URL', 'http://openbon.local:3000 oder IP', 'Öffnet beim Starten des Tablets sofort die Kassenoberfläche'],
            ['Enable Fullscreen Mode', 'Aktiviert (AN)', 'Blendet alle störenden Browser- und Android-Leisten aus'],
            ['Keep Screen On', 'Aktiviert (AN)', 'Verhindert automatisches Abdunkeln während des Kassenbetriebs'],
            ['Auto-Reload on Network Reconnect', 'Aktiviert (AN)', 'Stellt die Kasse nach kurzen WLAN-Pausen automatisch wieder her'],
          ],
        },
      },
      {
        id: '3.10',
        heading: '3.10 Android: Google Chrome Warnung („Dies ist keine sichere Verbindung“) & Festzelt-HTTPS (Port 3443)',
        paragraphs: [
          'Warum meldet Google Chrome auf Android-Geräten bei HTTPS (Port 3443) „Dies ist keine sichere Verbindung“?',
          'Da OpenBon auf Vereinsfesten in einem eigenen, autarken Festzelt-Netzwerk ohne weltweite Internetverbindung läuft, besitzt die Kasse eine lokale Netzwerk-Adresse (z. B. https://192.168.178.50:3443). Der Browser kennt dieses lokale Festzelt-Zertifikat zunächst noch nicht und zeigt eine rote Sicherheitswarnung an.',
          'Die 2-Sekunden-Lösung (Sofort startklar ganz OHNE Datei-Installation – Empfohlen!):',
          'Tippen Sie auf dem Smartphone auf den grauen Button „Erweitert“ und danach ganz unten auf den Link „Weiter zu [IP-Adresse] (unsicher)“. Schon öffnet sich OpenBon sofort über https://[IP-Adresse]:3443 mit voller HTTPS-Verschlüsselung, PWA-Funktionen und Ton-Signalen. Diese Freigabe merkt sich Chrome dauerhaft.',
          'Lösung für die Meldung: „Für das Installieren von Zertifikaten ist ein Privater Schlüssel erforderlich“:',
          'Diese Meldung erscheint auf Android-Handys nur dann, wenn das Smartphone glaubt, man wolle ein persönliches Ausweis-Zertifikat einrichten. OpenBon stellt dafür ab Version 0.4.58 ein reines Stamm-Vertrauenszertifikat bereit (Download als openbon-ca.crt unter Admin -> QR-Codes).',
          'So speichern Sie es dauerhaft im Handy ein: Öffnen Sie die Android-Einstellungen -> „Sicherheit & Datenschutz“ -> „Zertifikat installieren“ -> wählen Sie zwingend den Menüpunkt „CA-Zertifikat“ aus und bestätigen Sie die Datei openbon-ca.crt mit „Trotzdem installieren“. Es wird kein privater Schlüssel und kein Kennwort verlangt!',
          'Tipp: Wenn Sie überhaupt keine Zertifikatsdateien auf Handys installieren möchten, nutzen Sie einfach „Fully Kiosk Browser“ (siehe Abschnitt 3.9). Dieser läuft auch über Standard-HTTP perfekt im Vollbildmodus.',
        ],
      },
      {
        id: '3.11',
        heading: '3.11 Smartphone als Bezahlterminal am SB-Kiosk (SoftPOS / VR Pay:Me Beta)',
        paragraphs: [
          'Kann man ein ganz normales Smartphone als Kartenterminal am SB-Kiosk nutzen, ohne ein extra Kartenlesegerät kaufen zu müssen?',
          'Ja! Mit modernen Android-Smartphones (ab Android 13 mit NFC-Funkchip) und Apps wie "VR Pay:Me" (von den Volksbanken / Raiffeisenbanken) verwandelt sich das Smartphone selbst in ein vollständiges Kartenterminal ("SoftPOS").',
          'Wie der Ablauf in der Praxis funktioniert (vollautomatisch ohne Helfer-Eingriff):',
          '1. Platzierung am Kiosk: Neben dem Bestell-Bildschirm oder Kiosk-Tablet liegt oder steht das Bezahl-Smartphone. Darauf ist die Seite "/pos/card-terminal" geöffnet (über den QR-Code unter "Admin -> QR-Codes" sofort startklar).',
          '2. Bestellung & Übertragung: Der Gast stellt am Kiosk seine Bestellung zusammen und tippt auf "Jetzt Bezahlen". Das Kiosk-Terminal schickt den genauen Cent-Betrag sekundenschnell über das Festzelt-Netzwerk an das Bezahl-Smartphone.',
          '3. Karte anhalten: Das Smartphone wacht auf, zeigt den Betrag groß an und fordert den Gast auf: "Bitte Karte an die Rückseite dieses Handys halten". Der Gast hält seine Girokarte, Kreditkarte oder sein eigenes Smartphone (Apple Pay / Google Pay) an die Rückseite des Bezahl-Handys.',
          '4. Was passiert bei PIN-Eingabe? Bei Beträgen über 50 Euro oder bei Sicherheitsprüfungen verlangt die Bank eine PIN. Diese muss NICHT auf einem separaten Gerät eingegeben werden: Die VR Pay:Me App blendet eine sichere Zifferntastatur direkt auf dem Display des Bezahl-Handys ein ("PIN on Glass"). Der Gast tippt seine 4-stellige PIN ein und bestätigt.',
          '5. Vollautomatischer Rückkanal & Bondruck: Das Bezahl-Handy meldet den Zahlungserfolg sofort an OpenBon zurück. Der Kiosk springt automatisch auf "Vielen Dank für Ihre Bestellung!", zeigt die Abholnummer an und druckt die Küchenbons sowie die Abholmarke aus – ganz ohne dass ein Helfer eingreifen muss.',
          'Dauerhaft eingeschaltetes Display: Die Seite "/pos/card-terminal" verhindert automatisch das Einschlafen des Bildschirms ("Wake Lock"), sodass das Bezahl-Handy während der gesamten Schicht immer empfangsbereit bleibt.',
          'Beta-Testmodus ohne Bankvertrag: Sollten Sie noch keinen aktiven Händlervertrag besitzen, können Sie die Funktion trotzdem sofort vorab ausprobieren: Auf dem Bezahl-Smartphone befinden sich zwei Test-Schaltflächen ("Zahlung simulieren" und "Abbrechen"), mit denen der gesamte Ablauf inklusive Kiosk-Reaktion und Bondruck realistisch getestet werden kann.',
        ],
        table: {
          headers: ['Schritt', 'Wo passiert es?', 'Aktion / Was ist zu tun?'],
          rows: [
            ['1. Bestellen', 'SB-Kiosk Bildschirm', 'Gast wählt Artikel und drückt "Jetzt Bezahlen"'],
            ['2. Automatische Weiterleitung', 'Netzwerk (WLAN)', 'Kiosk sendet den Betrag an das Bezahl-Smartphone'],
            ['3. Karte vorhalten', 'Rückseite des Handys', 'Gast hält Karte oder Handy an die Rückseite'],
            ['4. PIN-Eingabe (falls > 50 €)', 'Display des Handys', 'Gast tippt PIN direkt auf dem Bildschirm ein ("PIN on Glass")'],
            ['5. Bondruck & Abholung', 'Kiosk & Drucker', 'Erfolgsmeldung erscheint, Belege und Abholmarke werden gedruckt'],
          ],
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
          'Feste Kopfleiste & vertikales Scrollen: Die obere Leiste mit Schnellfiltern (Ausverkauft, Warengruppen, Wartezeit-Sortierung) bleibt dauerhaft fest oben fixiert. Bei vielen gleichzeitigen Bestellungen scrollt nur der Kachelbereich nach unten durch. Alle Bestellkarten passen sich der Bildschirmbreite an, sodass kein Bon seitlich über den Bildschirmrand hinausragt.',
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
      {
        id: '4.6',
        heading: '4.6 Ausverkauft-Schnellzugriff (Artikel direkt in der Küche sperren)',
        paragraphs: [
          'Geht ein Gericht oder Getränk zur Neige (z. B. Grillhähnchen oder Fassbier ausverkauft), muss die Küche nicht zur Hauptkasse laufen.',
          'Über den Button "Ausverkauft" in der Kopfzeile des Küchenmonitors öffnet sich eine bequeme Schnellauswahl aller Artikel mit Suchfeld und Kategoriefilter.',
          'Mit einem Fingertipp wird der Artikel sofort gesperrt. Alle Kellner-Handys und Kassen übernehmen diese Sperre in Echtzeit, sodass keine neuen Bestellungen dafür mehr aufgenommen werden können.',
          'Sobald Nachschub bereitsteht, genügt ein weiterer Klick auf "Wieder freigeben", um den Artikel sekundenschnell wieder buchbar zu machen.',
        ],
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
      {
        id: '5.7',
        heading: '5.7 PDF-Speisekarten-Import & Automatische Erkennung',
        paragraphs: [
          'Sparen Sie sich das mühsame manuelle Eintippen aller Speisen und Getränke: Über den Button "PDF-Karte importieren" in der Artikelverwaltung (/admin/products) können Sie bestehende PDF-Speisekarten, Flyer oder Preislisten direkt hochladen.',
          'Automatische Erkennung: Das System liest die PDF-Datei ein, erkennt selbstständig die Namen der Gerichte und Getränke, die Preise und ordnet sie den passenden Warengruppen (z. B. Speisen, Getränke, Grill) sowie den richtigen Steuersätzen (7 % Speisen, 19 % Getränke) zu.',
          'Interaktive Vorschlags-Tabelle: Vor der endgültigen Übernahme öffnet sich eine übersichtliche Tabelle. Hier können Sie jeden vorgeschlagenen Namen, Preis oder Steuersatz direkt per Tastatur anpassen, einzelne Zeilen abwählen, neue Zeilen hinzufügen oder nicht gewünschte Einträge löschen.',
          'Mit einem Klick auf "Ausgewählte Artikel jetzt anlegen" werden alle bestätigten Positionen sofort in die Kasse übernommen und sind einsatzbereit.',
        ],
      },
      {
        id: '5.8',
        heading: '5.8 Artikel-Zeitfenster (Zeitgesteuerte Verfügbarkeit)',
        paragraphs: [
          'Viele Speisen oder Getränke werden nur zu bestimmten Zeiten angeboten – zum Beispiel der Mittagstisch von 11:30 bis 14:00 Uhr, Kaffee und Kuchen ab 14:30 Uhr oder die Bar erst ab 20:00 Uhr am Abend.',
          'Zeitfenster aktivieren: Im Artikel-Bearbeitungsfenster schalten Sie einfach das Kästchen "Zeitfenster aktivieren" ein. Wie bei den Sorten und Varianten können Sie beliebig viele Zeitfenster hinzufügen und wieder entfernen.',
          'Uhrzeit und Wochentage: Für jedes Zeitfenster legen Sie die Startzeit, die Endzeit sowie die gewünschten Wochentage fest (z. B. nur Samstag und Sonntag oder nur werktags). Auch Nachtzeiten über Mitternacht hinweg (z. B. 21:00 bis 02:00 Uhr) werden voll unterstützt.',
          'Automatische Ausblendung: Ist ein Artikel außerhalb seines Zeitfensters inaktiv, wird er auf den Smartphones der Bedienungen und an den Kassen automatisch ausgeblendet. Dadurch bleibt der Bildschirm stets aufgeräumt und es können keine Gerichte bestellt werden, die die Küche gerade gar nicht anbietet.',
          'In der Artikelverwaltung bleibt der Artikel für den Betreiber sichtbar und zeigt mit einem farbigen Uhr-Symbol auf einen Blick, ob er gerade aktiv oder zeitgesteuert pausiert ist.',
        ],
      },
    ],
  },
  {
    id: 'printers',
    chapterNumber: 6,
    title: 'Druckermanagement & Raumpläne',
    subtitle: 'ESC/POS-Bondrucker, Bonverbrauchsrechner, Web-Relay, Tischplan-Editor und Randleisten',
    icon: 'printers',
    sections: [
      {
        id: '6.1',
        heading: '6.1 Bondrucker einrichten & Verbindungsarten',
        paragraphs: [
          'OpenBon steuert Standard-Thermodrucker (z. B. Epson, Star, Munbyn) flexibel über drei verschiedene Wege an:',
          '• Netzwerk (LAN / WLAN): Der Drucker hängt direkt im Fest-Netzwerk und wird über seine IP-Adresse (Port 9100) angesteuert. Es sind keinerlei Treiber auf Windows erforderlich.',
          '• Server-Direkt (USB/COM): Der Drucker ist direkt per USB-Kabel oder seriellem Anschluss am Hauptserver angeschlossen (z. B. /dev/usb/lp0 unter Linux oder COM3 unter Windows).',
          '• USB-Freigabe über Kassen-PC (Web-Relay): Ist ein Drucker per USB an einem Computer angeschlossen, auf dem die Bonkasse im Browser läuft, kann er mit einem einzigen Klick im Browser gekoppelt werden. Alle anderen Geräte im System (Kellner-Smartphones, Kiosk, weitere Kassen) können dann vollautomatisch über diese Kassen-Station drucken – ganz ohne komplizierte Windows-Freigaben.',
        ],
        image: {
          src: '/docs/images/20_admin_printers.png',
          alt: 'Druckerverwaltung',
          caption: 'Konfiguration von Bondruckern mit Verbindungsart, Papierüberwachung und Druckergruppen',
        },
      },
      {
        id: '6.2',
        heading: '6.2 Bonverbrauchsrechner & Rollenüberwachung',
        paragraphs: [
          'OpenBon misst millimetergenau, wie viel Papier jeder Drucker während der Veranstaltung verbraucht:',
          '• Echte Längenmessung: Für jede Bonart (Kassenbelege, Küchenbons, Stornos, Zwischenstände und Tagesabschlüsse) wird anhand der Zeilen und Vorschübe die genaue Bonlänge berechnet und als Gesamtzähler in Metern gespeichert.',
          '• Rollen-Fortschritt & manuelle Anpassung: Unter /admin/printers und /admin/reports sehen Sie auf einen Blick, wie viele Meter einer Rolle (z. B. 80 Meter) verbraucht sind. Sie können den Zählerstand jederzeit von Hand korrigieren oder mit dem Knopf "Neue Rolle eingelegt" auf 0 Meter zurücksetzen.',
          '• Drucker-Sensorhebel (Papier fast leer): Jeder Drucker zeigt an, ob sein mechanischer Vorwarnhebel ruht (genug Papier) oder aktiv ist (Rolle fast leer).',
          '• Countdown & Stopp-Bon: Sobald der Vorwarnhebel auslöst, zählt OpenBon die verbleibenden Meter herunter. Kurz bevor die Rolle endgültig abreißt, wird vollautomatisch ein deutlicher Stopp-Bon gedruckt ("STOPP - LETZTER BON AUF DIESER ROLLE"). So wird verhindert, dass eine Bestellung mitten im Text abreißt. Wichtig: Der Stopp-Bon druckt absichtlich ohne lauten Alarmton, um Gäste und Helfer nicht zu erschrecken.',
          '• Ein- und Ausschaltbar: In den Admin-Einstellungen unter "Drucker" (/admin/settings) kann die Sensor-Überwachung und der automatische Stopp-Bon mit einem einzigen Klick jederzeit aktiviert oder deaktiviert werden.',
        ],
      },
      {
        id: '6.3',
        heading: '6.3 Virtueller Testdrucker',
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
        id: '6.4',
        heading: '6.4 Druckergruppen & Bon-Splitting',
        paragraphs: [
          'Jeder Artikel ist einer Druckergruppe zugeordnet (z. B. Küche -> Grillstation, Getränke -> Ausschank 1). Bestellt ein Gast Steak und Bier zusammen, trennt OpenBon die Positionen automatisch und druckt parallel an den richtigen Stationen.',
          'Werden viele Getränke auf einmal geordert, teilt das Tablett-Splitting den Druck automatisch in handliche Bons auf (z. B. max. 6 Krüge pro Bon).',
        ],
      },
      {
        id: '6.5',
        heading: '6.5 Tisch- & Raumplan-Editor mit Randleisten',
        paragraphs: [
          'Unter /admin/tables können Tische frei im Raum angeordnet, Gänge eingefügt und Raum-Orientierungen festgelegt werden:',
          '• Randleisten an allen vier Seiten: An jeder Seite des Tischplans (oben/Nord, unten/Süd, links/West, rechts/Ost) befindet sich eine Randleiste mit halbhohen bzw. halbbreiten Feldern.',
          '• Schnellauswahl & Freitext: Mit einem Klick können wichtige Orientierungspunkte wie "Eingang / Tür", "Notausgang", "Küche", "Bar / Schank", "WC", "Bühne", "Garderobe" oder freie Beschriftungen eingefügt werden.',
          '• Flexible Breite & Farben: Randfelder können sich über mehrere Tische erstrecken (z. B. eine 3 Tische breite Theke) und farblich hervorgehoben werden (z. B. Grün für Türen, Rot für Notausgänge, Gelb für die Bar).',
          '• Nur im Designer und Ausdruck sichtbar: Die Randfelder sind bewusst nur im Tischplan-Designer und auf dem Raumplan-Ausdruck zu sehen. Auf den Bildschirmen der Bedienungen bleiben die Tische sauber und übersichtlich.',
        ],
        image: {
          src: '/docs/images/18_admin_tables.png',
          alt: 'Tischplan Editor',
          caption: 'Visueller Raumplan-Editor mit Tischen, Gängen und Randfeldern für Türen, Küche und Bar',
        },
      },
      {
        id: '6.6',
        heading: '6.6 Tischplan drucken (Offizieller Raumplan)',
        paragraphs: [
          'Für die Schichtleitung, die Feuerwehr oder den Ausschank kann der Tischplan unter /admin/tables/print ausgedruckt werden. Auf dem Ausdruck sind alle Tische mit großen, klaren Nummern sowie die Randfelder (Türen, Notausgänge, Küche, Bar, WC) gut lesbar abgebildet.',
        ],
        image: {
          src: '/docs/images/19_admin_tables_print.png',
          alt: 'Druckbarer Tischplan',
          caption: 'Druckfertiger Tischplan mit Tischen und Randmarkierungen',
        },
      },
      {
        id: '6.7',
        heading: '6.7 Tischmarken für Biertische drucken (Bondrucker)',
        paragraphs: [
          'Über den Tischplan-Designer (/admin/tables) können praktische Tischmarken für Biertische und Garnituren auf jedem beliebigen Bondrucker ausgedruckt werden:',
          '• Flexible Anzahl je Tisch (Standard: 2): Legen Sie fest, wie viele Marken pro Tisch gedruckt werden sollen (z. B. 2 Ausdrucke, damit an beiden Seiten einer langen Bierzeltgarnitur die Tischnummer gut sichtbar angebracht werden kann). Bei 10 Tischen und Anzahl 2 druckt OpenBon vollautomatisch 20 fertige Abschnitte.',
          '• Maximale Schriftgröße (Vollbreite auf Stufe 10): Die Zifferngröße kann stufenlos von Stufe 1 bis 10 eingestellt werden. Auf der höchsten Stufe 10 nimmt die Tischnummer ohne störenden Umbruch die gesamte Rollenbreite des Bons ein – für perfekte Lesbarkeit selbst aus mehreren Metern Entfernung.',
          '• Aufgeräumter Ausdruck: Störende gestrichelte Trennlinien und automatische Standardtexte wurden entfernt. Der Ausdruck bleibt sauber und minimalistisch (nur Tischnummer, optionaler Smartphone-Bestell-QR-Code und bei Bedarf ein individueller Zusatztext).',
          '• Live-Vorschau in Echtzeit: Jede Anpassung der Schriftgröße, der Tischnummer oder des QR-Codes wird rechts im maßstabsgetreuen Belegfenster (58 mm oder 80 mm) sofort eins zu eins angezeigt.',
        ],
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
        heading: '7.1 Kartenzahlung, Terminals & Smartphone als Bezahlstation (Beta)',
        paragraphs: [
          'OpenBon unterstützt sowohl klassische Kartenterminals als auch den modernen Einsatz eines Smartphones als Bezahlterminal (SoftPOS):',
          'Hinweis (Beta): Die Schnittstellen für externe Kartenterminals (SumUp, VR-Pay, Sparkasse S-POS, Zettle, Stripe und stationäre ZVT-Terminals) befinden sich aktuell im Beta-Status. Sie wurden nach offiziellen Vorgaben implementiert, jedoch noch nicht im echten Großveranstaltungsbetrieb vor Ort getestet. Führen Sie vor Festbeginn stets Testbuchungen mit Ihrem Terminal durch.',
          'Besonderheit Smartphone als Terminal: Mit VR Pay:Me kann ein separates Smartphone ohne extra Kartenleser als Bezahlterminal neben dem SB-Kiosk betrieben werden (ausführlich erklärt in Kapitel 3, Abschnitt 3.11).',
        ],
        table: {
          headers: ['Anbieter', 'Verbindungsart', 'Einsatzgebiet'],
          rows: [
            ['VR-Pay:Me (SoftPOS)', 'App-to-App & Begleiter-Smartphone', 'Kein Extra-Leser nötig: Smartphone selbst fungiert als Kartenterminal am Kiosk oder Stand'],
            ['SumUp', 'App-to-App & Bluetooth', 'Kompakte mobile Leser für Kellner'],
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
          '1. Mitarbeiter wählen: Neben dem Namen werden hier auch die Schicht-Kennnummer, der Pausenstatus sowie das genaue Anmelde- und Abmeldedatum mit Uhrzeit übersichtlich angezeigt.',
          '2. Soll-Umsatz und Zahlungsmittel prüfen.',
          '3. Gezähltes Bargeld eingeben: Hier erscheint bei Berührung automatisch das Touch-Zahlenfeld mit praktischen Tasten für +5, +10, +20, +50 €. Das Tippen ist fehlerfrei möglich, da störende führende Nullen automatisch ersetzt werden.',
          '4. Abrechnungsbericht mit 4 Reitern prüfen: Übersicht, Verkaufte Artikel, Bestellungen und der Reiter "Stornierte Artikel".',
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
        heading: '7.4 Schichtzeiten, Kennnummer & Berichts-Ausdruck',
        paragraphs: [
          'Jede Kellnerschicht erhält eine eigene Kennnummer sowie die exakten Zeitstempel für Anmeldung und Schichtabmeldung.',
          'Sowohl auf dem A4-Ausdruck als auch auf dem 80mm-Thermobon-Ausdruck werden die Kellner-Kennnummer, Schicht-ID sowie Beginn und Ende mit Datum und Uhrzeit lückenlos aufgedruckt.',
          'Zusätzlich listet der Reiter "Stornierte Artikel" alle Stornierungen der Schicht auf (Artikelname, Anzahl, Einzelpreis und Gesamtsumme), sodass Kassenleitung und Vereinsvorstand vollständige Transparenz haben.',
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
      {
        id: '7.7',
        heading: '7.7 Abschlussbericht der Veranstaltung (PDF & Excel / CSV)',
        paragraphs: [
          'Unter /admin/reports steht am Ende der Veranstaltung oder nach Abschluss aller Festtage der umfassende Abschlussbericht per 1-Klick-Download bereit.',
          'Automatische Prüfung & Fehlerkorrektur: Das System prüft die Daten vor dem Herunterladen automatisch ab. Selbst wenn im Laufe des Festes Artikel gelöscht, umbenannt oder verändert wurden, repariert OpenBon eventuelle Lücken im Hintergrund selbstständig. Der Download bricht niemals ab und liefert immer eine saubere Datei.',
          'Druckfähiger PDF-Abschlussbericht: Generiert automatisch ein sauberes, mehrseitiges A4-Dokument mit ansprechender Formatierung für Vorstandschaft und Vereinskasse. Es fasst alle Kennzahlen zusammen: Gesamtumsatz (Brutto/Netto), MwSt.-Aufteilung (19 % und 7 %), Bar- und Karteneinnahmen, Trinkgelder, Pfandsaldo, tägliche Verbrauchstabellen (aufgeteilt nach Speisen und Getränken je Tag), alle Bedienungsabrechnungen und eine vollständige Verbrauchsliste aller verkauften Artikel.',
          'Excel / CSV-Tabelle: Exportiert alle tabellarischen Daten (Tagesübersicht, Kellner-Abrechnungen und Speisen/Getränke-Verbrauch) als Excel-optimierte CSV-Datei. Dank integriertem UTF-8-Erkennungssignal (BOM) und deutschem Trennzeichen-Format öffnet sich die Tabelle in Microsoft Excel direkt ohne Zeichenfehler bei Umlauten.',
        ],
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
          'Unter /admin/diagnostics prüft das System vor Festbeginn automatisch alle wichtigen Komponenten: Datenbank-Integrität, Drucker-Erreichbarkeit im Netzwerk, Speisekarten-Konsistenz, echten Internetzugang für digitale Belege und simuliert einen vollständigen Test-Bestellzyklus.',
          '100% freie Software (Keine Lizenzschlüssel nötig): OpenBon steht unter der freien MIT-Lizenz. Es gibt keine Beschränkungen bei Geräten, Tischen oder Funktionen – anstelle alter Lizenzkacheln sehen Sie direkt den echten Netzwerk- und Internetstatus.',
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
        heading: '9.3 Zentrale Fest- und Systemeinstellungen (Übersicht)',
        paragraphs: [
          'Unter /admin/settings befindet sich das Herzstück der Konfiguration von OpenBon. Hier werden alle Parameter, Funktionen und Sicherheitsregeln für das Fest festgelegt.',
          'Übersichtliche Reiterstruktur: Die Einstellungen sind in 7 logische Bereiche aufgeteilt: Allgemein, Bonlayout & Vorschau, Drucker, Kartenzahlung, Sicherheit & PINs, Fiskal & Steuern sowie Vorlagen & Snapshots.',
          'Schutz vor Datenverlust: Verlassen Sie versehentlich die Seite oder wechseln den Reiter, während noch ungespeicherte Änderungen vorliegen, warnt OpenBon sofort mit einem Bestätigungsfenster ("Ungespeicherte Änderungen"). Erst nach dem Klick auf "Einstellungen speichern" werden die Änderungen systemweit aktiv.',
        ],
        image: {
          src: '/docs/images/37_admin_settings.png',
          alt: 'Systemeinstellungen Übersicht',
          caption: 'Zentrale Verwaltung aller Fest-Parameter mit Suchleiste und Reitern',
        },
      },
      {
        id: '9.3.1',
        heading: '9.3.1 Einstellungen: Reiter "Allgemein"',
        paragraphs: [
          'Im Reiter "Allgemein" werden der offizielle Festname, die Anschrift, Steuernummern sowie grundlegende Programmfunktionen und Aussehen bestimmt.',
        ],
        table: {
          headers: ['Einstellung / Bereich', 'Funktion', 'Erklärung (ohne Fachbegriffe)'],
          rows: [
            ['Name der Veranstaltung', 'Titel & Grußzeile', 'Erscheint oben auf allen gedruckten Bons, digitalen E-Bons und auf dem Kundendisplay.'],
            ['Untertitel / Slogan', 'Zusatzzeile', 'Z. B. "100 Jahre Freiwillige Feuerwehr Musterdorf" oder "Traditionelles Gartenfest".'],
            ['Straße & PLZ/Ort', 'Veranstaltungsanschrift', 'Offizielle Adresse des Vereinsheims oder Festplatzes für ordnungsgemäße Belege.'],
            ['Steuernummer & USt-IdNr.', 'Finanzamt-Identifikation', 'Wird auf den Kassenbelegen und Z-Bons ausgewiesen.'],
            ['Gänge / Speisenfolge', 'Schalter (AN/AUS)', 'Ermöglicht der Bedienung am Tisch, Speisen getrennt als Vorspeise, Hauptgang oder Dessert abzurufen.'],
            ['Digitaler Beleg', 'Schalter (AN/AUS)', 'Aktiviert die Erstellung papierloser Bons für Gäste über Smartphone-Link.'],
            ['Gast bestellt selbst (Tisch-QR)', 'Schalter (AN/AUS)', 'Erlaubt Gästen, Speisen direkt über den am Biertisch aufgeklebten QR-Code selbst zu ordern.'],
            ['Selbstbedienungs-Terminal', 'Schalter (AN/AUS)', 'Schaltet den SB-Kioskmodus frei, damit Gäste an einem festen Tablet selbst bestellen können.'],
            ['Virtuelle Drucker', 'Schalter (AN/AUS)', 'Bestellungen können digital auf Küchen- oder Schankmonitoren angezeigt werden statt auf Papier.'],
            ['Hinweis bei Alterskontrolle', 'Schalter (AN/AUS)', 'Warnt die Bedienung beim Tippen von Schnaps oder Tabakwaren mit einem gut sichtbaren Prüfhinweis.'],
            ['QR-Code auf Beleg', 'Schalter (AN/AUS)', 'Druckt den Beleg-Link als scanbaren QR-Code auf den gedruckten Papierbon.'],
            ['Bestellverzögerung für Storno', 'Schalter & Zeitwähler', 'Sendet Bestellungen erst nach z. B. 60 Sekunden an die Küche. In dieser Zeitspanne kann die Bedienung Vertipper am Tisch sofort kostenfrei stornieren.'],
            ['Startseite sperren', 'Schalter (AN/AUS)', 'Beim Öffnen der App muss sofort eine PIN eingegeben werden. Ausgeschaltet kann man sich die Stationen erst ansehen.'],
            ['Auto-Lock Kellner-Handys', 'Minuten-Auswahl', 'Sperrt das Kellner-Smartphone nach 1 bis 10 Minuten Inaktivität gegen unbefugte Buchungen.'],
            ['Erscheinungsbild & Theme', '4 Design-Modi', 'Dunkel (Standard), Hell (Sonnenlicht-geeignet), Kompakt Dunkel oder Kompakt Hell (extra große Tasten für Tablets).'],
            ['Währung & Steuersätze', 'Währungssymbol & %', 'Standardmäßig Euro (€) mit 19 % Regelsteuersatz und 7 % ermäßigtem Satz (Speisen).'],
            ['Daten bereinigen / Werksreset', 'Mülleimer-Symbol', 'Erlaubt vor dem Festbeginn das gezielte Löschen aller Testbestellungen, ohne dass Speisekarte oder Tische verloren gehen.'],
          ],
        },
      },
      {
        id: '9.3.2',
        heading: '9.3.2 Einstellungen: Reiter "Bonlayout & Vorschau"',
        paragraphs: [
          'Hier gestalten Sie das Aussehen Ihrer Kassenbons und richten den papierlosen Digitalbeleg (E-Bon) sowie die digitale Speisekarte ein.',
          'Übersichtliche Struktur: Die Einstellungen sind praxisnah angeordnet: 1. Kopf- und Fußzeile (ganz oben für Veranstaltungs- und Vereinsnamen), 2. Speisen-Bon (Küche), 3. Getränke-Bon (Ausschank), 4. Kassenbeleg für den Gast und 5. Digitaler E-Bon & Webhosting.',
          'Synchronisation Speisen- & Getränkebon: Über den Schiebeschalter "Mit Getränke-Bon synchronisieren" lassen sich Design-Vorlage, Schriftgröße der Tischnummer und Schriftgröße für Artikel & Menge automatisch zwischen Küche und Ausschank koppeln. Ändern Sie z. B. die Tischnummer auf Stufe 6, übernimmt der Ausschankbon diesen Wert automatisch.',
          'Live-Internetstatus: Der E-Bon-Bereich zeigt in Echtzeit an, ob echter Internetzugang besteht. Ist kein Internet vorhanden, pausiert OpenBon den Online-Belegabruf automatisch und bietet an den Kassen Papierbelege als sicheren Fallback an.',
          'Live-Vorschau: Jede Änderung an Texten oder Schriftgrößen wird sofort in der maßstabsgetreuen Thermobon-Vorschau (58 mm oder 80 mm Rollenbreite) angezeigt.',
        ],
        table: {
          headers: ['Einstellung', 'Bedeutung', 'Praxistipp'],
          rows: [
            ['Kopfzeile & Fußzeile', 'Erster Bereich: Belegkopf & Fußzeile', 'Hier werden Name der Veranstaltung und Veranstalter automatisch aus Allgemein übernommen, ergänzt um frei wählbaren Begrüßungs- und Dankestext.'],
            ['Speisen-Bon (Küche)', 'Zweiter Bereich: Küchenzettel', 'Wähle zwischen Klassisch, Kompakt (Eco) oder Großschrift für optimale Lesbarkeit am Grill.'],
            ['Getränke-Bon (Ausschank)', 'Dritter Bereich: Schankzettel', 'Kann separat konfiguriert oder direkt mit der Küche synchronisiert werden.'],
            ['Kassenbeleg (Gast)', 'Vierter Bereich: Kundenquittung', 'Legt fest, ob Bedienungen oder Kassierer Quittungen drucken dürfen und welches Layout gilt.'],
            ['Schriftgrößen-Schieberegler', 'Skala von 1 (fein) bis 10 (sehr groß)', 'Passen Sie Tischnummer, Artikel und Preise exakt an Ihre Druckerauflösung und Papierbreite an.'],
            ['Öffentliche Basis-URL', 'Internetadresse für den Belegabruf', 'Trage hier die Adresse deines Webhostings ein (z. B. https://bon.mein-verein.de).'],
            ['ZIP-Paket herunterladen', 'Fertiges Webspace-Paket', 'Enthält die fertigen Anzeigeseiten für Gäste und den geheimen Schlüssel. Einfach auf den Webspace hochladen.'],
            ['Webhosting-Verbindung prüfen', '1-Klick-Diagnosetest', 'Prüft automatisch in 3 Schritten, ob Ihr Webspace erreichbar ist und Belege fehlerfrei synchronisiert werden.'],
            ['Speisekarte / Flyer (PDF/Foto)', 'Gäste-Speisekarte am Tisch & Webhosting', 'Ermöglicht das Hochladen der Speisekarte und die Übertragung an das Webhosting inklusive automatischem Festende-Ablaufdatum. Gäste sehen direkt das randlose PDF mit Zoomfunktion.'],
          ],
        },
      },
      {
        id: '9.3.3',
        heading: '9.3.3 Einstellungen: Reiter "Drucker"',
        paragraphs: [
          'In diesem Reiter wird festgelegt, welcher Drucker wichtige Warnmeldungen erhalten soll.',
          'Meldebestand-Warndrucker: Sobald ein Fassbier oder ein beliebter Artikel zur Neige geht, kann das System automatisch einen Zettel an der Kasse oder am Lager ausdrucken, damit frühzeitig Nachschub geholt wird.',
          'Vollständige Druckerkonfiguration: Über den Link gelangen Sie direkt zur Druckerverwaltung (/admin/printers). Dort können Bondrucker per IP-Adresse oder automatischem Netzwerk-Suchlauf eingerichtet, Kassenladen zugewiesen und Druckgruppen (z. B. Grill, Ausschank, Bar) festgelegt werden.',
        ],
      },
      {
        id: '9.3.4',
        heading: '9.3.4 Einstellungen: Reiter "Kartenzahlung (Beta)"',
        paragraphs: [
          'OpenBon unterstützt bargeldloses Bezahlen mit modernen Kartenterminals am Tisch und an der Theke.',
        ],
        table: {
          headers: ['Anbieter', 'Funktionsweise', 'Vorteile auf dem Fest'],
          rows: [
            ['SumUp', 'App-to-App Weiterschaltung', 'Die Kellner-App übergibt den exakten Zahlbetrag automatisch an die SumUp-App. Kein Vertippen möglich.'],
            ['Zettle by PayPal', 'App-Weiterschaltung & Kartenterminal', 'Ermöglicht Kartenzahlungen über das Zettle-Terminal mit automatischer Quittungsrückmeldung an OpenBon.'],
            ['Trinkgeld-Erfassung', 'Eingabefenster vor Kartenzahlung', 'Gäste können bei der Kartenzahlung bequem ein Trinkgeld hinzufügen, das dem Kellner korrekt zugeordnet wird.'],
          ],
        },
      },
      {
        id: '9.3.5',
        heading: '9.3.5 Einstellungen: Reiter "Sicherheit & PINs"',
        paragraphs: [
          'Schützen Sie die Stationen gegen unbefugten Zugriff durch Helfer oder Gäste.',
        ],
        table: {
          headers: ['Sicherheitsbereich', 'Einstellung', 'Erklärung (ohne Fachbegriffe)'],
          rows: [
            ['Stations-PINs', 'Admin, Kasse, Küche, Kellner', 'Jede Station hat eine eigene 4-stellige Zahlen-PIN. Helfer an der Theke sehen nur die Kasse, Kellner nur die Tische.'],
            ['PIN-Sicherheit', 'PBKDF2-Verschlüsselung', 'Alle PINs werden sicher verschlüsselt in der Datenbank abgelegt und sind selbst bei Systemzugriff nicht im Klartext lesbar.'],
            ['Brute-Force-Sperre', 'Automatischer Schutz', 'Nach 5 falschen PIN-Eingaben wird das betreffende Gerät für 30 Sekunden gesperrt, um Durchprobieren zu verhindern.'],
            ['Festzelt-HTTPS (Port 3443)', 'Verschlüsseltes WLAN (100 Jahre)', 'Sichere Datenübertragung im Festzelt über den gesicherten Port 3443 mit lebenslang gültigem Sicherheitszertifikat.'],
            ['Zertifikat neu generieren', '100 Jahre unbegrenzt gültig', 'Erzeugt mit 1 Klick ein frisches, 100 Jahre gültiges Sicherheitszertifikat für alle lokalen Kassen-Adressen.'],
            ['Kassenzertifikat-Download', 'openbon-ca.crt', 'Lädt das Stamm-Vertrauenszertifikat herunter. In Android als „CA-Zertifikat“ importiert, verlangt es keinen privaten Schlüssel und ermöglicht die sichere Vollbild-Nutzung von OpenBon.'],
          ],
        },
      },
      {
        id: '9.3.6',
        heading: '9.3.6 Einstellungen: Reiter "Fiskal & Steuern (Beta)"',
        paragraphs: [
          'OpenBon ist für die deutsche Kassensicherungsverordnung (KassenSichV) vorbereitet.',
          'TSE-Anbindung: Unterstützung für zertifizierte Hardware-TSE-Sticks (z. B. von Swissbit) per USB oder Cloud-TSE. Nach Aktivierung erhält jeder Kassiervorgang eine offizielle digitale Signatur und TSE-Prüfzeile auf dem Bon.',
          'Kassenmeldung (§ 146a AO): Auf Knopfdruck erzeugt das System die amtliche Meldung des Aufzeichnungssystems für das zuständige Finanzamt.',
        ],
      },
      {
        id: '9.3.7',
        heading: '9.3.7 Einstellungen: Reiter "Vorlagen & Snapshots"',
        paragraphs: [
          'Damit Sie nach einem erfolgreichen Fest nicht im nächsten Jahr wieder alle Artikel, Tische, Preise und Drucker von Hand eingeben müssen, bietet OpenBon eine Vorlagen-Verwaltung.',
          'Vorlage exportieren: Mit einem Klick laden Sie eine Sicherungsdatei herunter, die alle Stammdaten enthält – ohne alte Umsätze oder Buchungen.',
          'Vorlage importieren: Beim nächsten Fest spielen Sie diese Datei einfach wieder ein. Innerhalb von zwei Minuten ist das Kassensystem wieder startklar!',
        ],
      },
      {
        id: '9.4',
        heading: '9.4 Angemeldete Geräte & Live Akku-Monitor',
        paragraphs: [
          'Unter /admin/devices behält die Kassenleitung den Überblick über alle angemeldeten Kellner-Handys, Tablets und Kassenmonitore inklusive Akkuladestand, Verbindungsqualität und dem Namen der aktuell eingeloggten Bedienung.',
          'Powerbank-Frühwarnung: Fällt der Akkustand eines aktiven Geräts auf 20 % oder weniger (ohne am Ladekabel zu hängen), erscheint oben ein auffälliges rotes Warnbanner mit dem Namen der betroffenen Bedienung.',
          'Akustischer Suchton (PING): Mit dem Button "PING" kann die Kassenleitung einen lauten Signalton auf dem entsprechenden Kellner-Handy auslösen, um es schnell im Festzelt zu orten oder der Bedienung direkt eine Powerbank zu überreichen.',
        ],
        image: {
          src: '/docs/images/32_admin_devices.png',
          alt: 'Geräteübersicht',
          caption: 'Übersicht aller im Netzwerk aktiven Smartphones, Akkustände und Bedienungsnamen',
        },
      },
      {
        id: '9.5',
        heading: '9.5 System-Update & Echtzeit-Systemauslastung (Prozessor & Speicher)',
        paragraphs: [
          'Unter /admin/system-update kann OpenBon mit einem Klick aktualisiert werden. Der Schalter "Nur Releases anzeigen" stellt sicher, dass ausschließlich erprobte und stabile Hauptversionen installiert werden.',
          'Echtzeit-Messung der Auslastung: Die Auslastung des Hauptprozessors (CPU) und des Arbeitsspeichers (RAM) wird alle 400 Millisekunden (etwa 2,5 Mal pro Sekunde) live aktualisiert. So sehen Sie sofort und vollkommen flüssig, wie stark der Kassenrechner bei Hochbetrieb gefordert ist.',
          'Kein spürbarer Einfluss auf die Geschwindigkeit: Dank einer intelligenten internen Zwischenberechnung verbraucht diese Live-Messung weniger als 0,1 % eigene Rechenleistung des Computers. Kassiervorgänge und Bestellungen laufen völlig unbeeinflusst und ohne jede Verzögerung weiter.',
          'Automatischer Stromsparmodus: Wechselt man zu einem anderen Programm oder minimiert den Browser, pausiert die Live-Abfrage automatisch, um Netzwerk und Akku zu schonen.',
          'Schnellübersicht im Dashboard: Auch in der oberen Kopfleiste des Admin-Dashboards (/admin/dashboard) zeigt eine kompakte Live-Anzeige jederzeit die aktuelle Prozessor- und Speicherauslastung an und führt mit einem Klick direkt zur Diagnose.',
        ],
        image: {
          src: '/docs/images/38_admin_system_update.png',
          alt: 'System-Update Manager',
          caption: '1-Klick-Update-Manager mit Speicheranzeige und Release-Filter',
        },
      },
      {
        id: '9.6',
        heading: '9.6 Aufgeräumtes Hauptmenü & kompakte Menüführung',
        paragraphs: [
          'Das Hauptmenü (Seitenleiste) im Admin-Bereich ist übersichtlich in 4 logische Hauptkategorien unterteilt:',
          '1. Sortiment & Warenwirtschaft: Artikel & Speisekarte, Warenbestände, Lagerposten & Verbrauch, Fass- & Schankmonitor sowie Einkaufs-Bestellvorschlag.',
          '2. Kasse, Abrechnung & Finanzen: Berichte & Z-Bons, GoBD-Kassenbuch, Schichtabrechnung, DATEV-Export, TSE-Archiv und Wertmarken.',
          '3. Geräte, Tische & Hardware: Tischplan-Designer, Drucker & Druckgruppen, Virtueller Drucker, Kundendisplay, Geräte-Manager und QR-Beitritt.',
          '4. System & Verwaltung: Admin Command Center, Grundeinstellungen, Datensicherung & Backup, System-Update, Testbetrieb & Hardware-Diagnose, Revisions-Logs, Team-Funk und Handbuch.',
          'Keine doppelten Verkaufsreiter: Die operativen Stationen "Bonkasse" und "Bedienung" sind oben im Menü über die 4 großen Kacheln "Station wechseln" erreichbar und wurden aus den Admin-Listen entfernt.',
          'Kassen-Uhrzeit in der oberen Leiste: Direkt in der oberen Kopfleiste des Adminbereichs läuft dauerhaft eine gut sichtbare Digitaluhr mit Sekundenanzeige mit (z. B. 14:23:05). Diese Uhr zeigt exakt die Systemzeit des Kassenrechners an. Sie ist der maßgebliche Taktgeber für die zeitgesteuerte Verfügbarkeit von Speisen und Getränken (Artikel-Zeitfenster) sowie für alle Buchungs- und Schichtzeitstempel.',
          'Kompakte Kopfleiste & Status-Anzeige: Die obere Menüleiste ist besonders platzsparend gestaltet. Ein dezenter Internet-Globus mit Signalpunkt zeigt sofort an, ob E-Bon und Webanbindung online sind. Über kompakte Schnellwahltasten für Vollbild, Farbschema und Bildschirmanpassung sowie den Kassenverbindungs-Status bleibt die Leiste auf jedem Tablet und Smartphone aufgeräumt und übersichtlich.',
        ],
      },
    ],
  },
];
