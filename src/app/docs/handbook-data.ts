/**
 * Umfassendes Handbuch und Referenz-Dokumentation für OpenBon v0.4.2.
 * Offline-fähig direkt im Bundle integriert – keine externe Verbindung nötig.
 */

export interface DocSection {
  id: string;
  heading: string;
  paragraphs?: string[];
  steps?: string[];
  hints?: { kind: 'tip' | 'warn'; text: string }[];
  table?: { headers: string[]; rows: string[][] };
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
    title: 'Systemarchitektur & Erste Schritte',
    subtitle: 'Lokaler Betrieb, Netzwerk, PIN-Sicherheit und Progressive Web App (PWA)',
    icon: 'system',
    sections: [
      {
        id: '1.1',
        heading: '1.1 Grundkonzept: Lokaler Fest-Server & Zero-Cloud',
        paragraphs: [
          'OpenBon ist speziell für Vereinsfeste, Biergärten, Feuerwehrfeste und Gastronomie konzipiert. Das System arbeitet zu 100 % lokal – es ist keine dauerhafte Internetverbindung erforderlich.',
          'Alle Daten (Bestellungen, Zahlungen, TSE-Signaturen und Stammdaten) werden direkt auf dem lokalen Kassenrechner in einer transaktionssicheren SQLite-Datenbank mit WAL-Modus (Write-Ahead-Logging) gespeichert.',
          'Kellner-Smartphones, stationäre Kassen und Küchendrucker kommunizieren ausschließlich über das lokale WLAN-Netzwerk.',
        ],
        hints: [
          {
            kind: 'tip',
            text: 'Fällt während des Festbetriebs das externe Internet aus, läuft OpenBon vollkommen unbeeinträchtigt weiter.',
          },
        ],
      },
      {
        id: '1.2',
        heading: '1.2 Netzwerk-Setup & Verbindung',
        steps: [
          'Verbinden Sie den Kassenrechner (Server) per LAN-Kabel mit dem WLAN-Router (z. B. FRITZ!Box).',
          'Aktivieren Sie im Router die Option "Diesem Netzwerkgerät immer die gleiche IPv4-Adresse zuweisen" (z. B. 192.168.1.100).',
          'Öffnen Sie auf den Mobilgeräten (Smartphones/Tablets) den Webbrowser und rufen Sie "http://openbon.local" oder die Server-IP "http://192.168.1.100:3000" auf.',
        ],
      },
      {
        id: '1.3',
        heading: '1.3 PIN-Sicherheitsarchitektur',
        paragraphs: [
          'OpenBon schützt sensible Bereiche durch separate, rollenbasierte PIN-Codes. Alle PINs werden mittels PBKDF2-Hashing (100.000 Runden mit kryptografischem Salt) und signierten JWT-Cookies geschützt.',
        ],
        table: {
          headers: ['Rolle / Station', 'Standard-PIN', 'Berechtigungen & Aufgaben'],
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
            text: 'Ändern Sie vor dem ersten öffentlichen Festbetrieb die Standard-PINs im Menü "System & Konfiguration".',
          },
        ],
      },
      {
        id: '1.4',
        heading: '1.4 Progressive Web App (PWA) Installation',
        paragraphs: [
          'OpenBon kann ohne App-Store-Installation auf jedem Android- und iOS-Gerät im Vollbildmodus genutzt werden.',
        ],
        steps: [
          'Auf dem Smartphone die Kassen-URL im Browser (Chrome oder Safari) aufrufen.',
          'Auf das Teilen-Symbol (iOS Safari) bzw. das Drei-Punkte-Menü (Android Chrome) tippen.',
          '"Zum Home-Bildschirm hinzufügen" auswählen.',
          'OpenBon öffnet sich fortan als native App ohne Adressleiste und mit optimaler Bildschirmfläche.',
        ],
      },
    ],
  },
  {
    id: 'waiter',
    chapterNumber: 2,
    title: 'Kellner- & Servicehandbuch',
    subtitle: 'Direkteingabe, Bestellen, Wünsche, Gang-Steuerung, Splitting & Rückgeldrechner',
    icon: 'waiter',
    sections: [
      {
        id: '2.1',
        heading: '2.1 Tischnummer-Direkteingabe (Ziffernblock)',
        paragraphs: [
          'Ganz oben in der Kellneransicht befindet sich die Schnell-Eingabeleiste mit virtuellem Ziffernblock.',
          'Tippen Sie die Tischnummer (z. B. "14") ein und drücken Sie "Bestellen". Existiert der Tisch noch nicht, legt das System ihn automatisch und verzögerungsfrei an.',
        ],
        hints: [
          {
            kind: 'tip',
            text: 'Die Ziffernblock-Eingabe spart im Festzelt-Trubel wertvolle Sekunden gegenüber dem Suchen auf großen Tischplänen.',
          },
        ],
      },
      {
        id: '2.2',
        heading: '2.2 Tischplan & Statusfarben',
        paragraphs: [
          'Der Tischplan visualisiert alle Tische in Echtzeit über WebSockets:',
        ],
        table: {
          headers: ['Farbe', 'Bedeutung', 'Aktion'],
          rows: [
            ['Dunkelgrau', 'Freier Tisch', 'Antippen zum Starten einer neuen Bestellung'],
            ['Blau / Bernstein', 'Belegter Tisch (Offene Speisen / Getränke)', 'Zeigt offenen Gesamtbetrag und Verweildauer an'],
            ['Rot blinkend', 'Wartezeit-Alarm (Küche überfällig)', 'Küche benötigt Unterstützung oder Speisen sind abholbereit'],
          ],
        },
      },
      {
        id: '2.3',
        heading: '2.3 Bestellaufnahme, Sorten & Optionen',
        steps: [
          'Warengruppe wählen (z. B. "Getränke", "Grill", "Kaffee & Kuchen").',
          'Artikel antippen. Hat der Artikel Sorten oder Untervarianten (z. B. "0,5 l", "mit Pommes"), öffnet sich der Auswahldialog.',
          'Unten im einklappbaren Warenkorb-Drawer werden Gesamtanzahl und Summe sofort berechnet.',
          'Auf "Bestellen" tippen – die Bons werden sofort an die zuständigen Drucker (Küche, Ausschank) gesendet.',
        ],
      },
      {
        id: '2.4',
        heading: '2.4 Wünsche-Baukasten & Freitext',
        paragraphs: [
          'Über "+ Wunsch" öffnet sich der interaktive Baukasten für Sonderwünsche. Dieser kombiniert Vorsatzwörter ("ohne", "extra", "wenig", "viel") mit Zutaten (z. B. "ohne Zwiebeln", "extra scharf").',
          'Sonderwünsche werden auf dem Küchenbon groß, fett und mit Warnsymbolen hervorgehoben.',
        ],
      },
      {
        id: '2.5',
        heading: '2.5 3-Gänge-Steuerung & HOLD (Zurückhalten)',
        paragraphs: [
          'Unterstützt 3 Gänge: Gang 1 (Vorspeise / Sofort), Gang 2 (Hauptgang), Gang 3 (Dessert).',
          'Mit "Zurückhalten" (HOLD) wird die Zubereitung pausiert. Der Küchenbon wird erst gedruckt, wenn die Bedienung den Gang später manuell abruft.',
        ],
      },
      {
        id: '2.6',
        heading: '2.6 Schnelle Wiederholung: Gleiche Runde',
        paragraphs: [
          'Möchte ein Tisch "nochmal die gleiche Runde", tippen Sie in der Tischübersicht auf "Gleiche Runde". Alle zuvor georderten Posten werden sofort in den Warenkorb geladen.',
        ],
      },
      {
        id: '2.7',
        heading: '2.7 Tisch umbuchen & zusammenlegen',
        steps: [
          'In der Tischdetailansicht auf "Tisch umbuchen" tippen.',
          'Ziel-Tischnummer eingeben.',
          'Wahlweise "Ganzen Tisch umziehen" oder mit einem bestehenden Tisch "Zusammenlegen".',
        ],
      },
      {
        id: '2.8',
        heading: '2.8 Rechnungs-Splitting (Getrennt zahlen)',
        paragraphs: [
          'OpenBon bietet mächtige Splitting-Werkzeuge:',
          '1. Postenweises Splitten: Einzelne Artikel auswählen (z. B. 2 von 5 Bieren).',
          '2. Schnell-Split: Mit den Tasten "1/2", "1/3", "1/4" den Tischbetrag blitzschnell aufteilen.',
          '3. Nach dem Kassieren ermöglicht "Nächsten Gast am selben Tisch kassieren" das direkte Weiterkassieren des Restbetrags.',
        ],
      },
      {
        id: '2.9',
        heading: '2.9 Bezahlvorgang & Stückelungs-Rückgeldrechner',
        paragraphs: [
          'Beim Kassieren steht der interaktive Bargeldrechner bereit:',
          'Tippen Sie auf die Scheine (100, 50, 20, 10, 5 €) und Münzen (2, 1, 0.50, 0.20, 0.10, 0.05 €), die der Gast hingelegt hat. Die Beträge addieren sich automatisch.',
          'Das genaue Rückgeld wird in 48px Bernsteinschrift berechnet und angezeigt.',
        ],
      },
      {
        id: '2.10',
        heading: '2.10 Gastansicht & Display-Drehung',
        paragraphs: [
          'Mit der Gastansicht-Funktion kann das Tablet zum Gast gedreht werden. Der Gast sieht eine aufgeräumte Zusammenfassung seiner Bestellung sowie Zahlungsoptionen (z. B. QR-Code).',
        ],
      },
    ],
  },
  {
    id: 'pos',
    chapterNumber: 3,
    title: 'Stationäre Kasse & Thekenverkauf',
    subtitle: 'Direktverkauf, Bonkasse, Kassenlade, Wertmarken & digitaler E-Bon',
    icon: 'pos',
    sections: [
      {
        id: '3.1',
        heading: '3.1 Sofortverkauf an der Theke',
        paragraphs: [
          'Unter /pos befindet sich die Hochgeschwindigkeits-Kasse für Theken, Festzelteingänge und Bonverkaufsstellen.',
          'Artikel werden mit einem Klick in den Warenkorb gelegt. Die Kasse schließt den Verkauf sofort ab und druckt wahlweise Kassenbelege oder Wertmarken.',
        ],
      },
      {
        id: '3.2',
        heading: '3.2 Automatische Kassenladen-Ansteuerung',
        paragraphs: [
          'Über den ESC/POS-Impulsbefehl (Pin 2 / Pin 5 an der RJ12-Buchse des Bondruckers) öffnet sich die Kassenschublade bei Barzahlung automatisch.',
        ],
        hints: [
          {
            kind: 'tip',
            text: 'Im Adminbereich unter "Drucker" kann die Impulsdauer der Kassenlade eingestellt werden.',
          },
        ],
      },
      {
        id: '3.3',
        heading: '3.3 Wertmarken & Verzehrgutscheine',
        paragraphs: [
          'Artikel können als "Wertmarke / Festbon" deklariert werden. Beim Verkauf druckt OpenBon fälschungssichere Einzelabschnitte mit fortlaufender 3-stelliger Abholnummer aus.',
        ],
      },
      {
        id: '3.4',
        heading: '3.4 Digitaler E-Bon (Papierlos per QR-Code)',
        paragraphs: [
          'Auf Wunsch wird nach der Zahlung ein dynamischer QR-Code angezeigt. Der Gast scannt den Code mit seinem Smartphone und erhält den GoBD- und TSE-konformen digitalen Beleg als PDF.',
        ],
      },
    ],
  },
  {
    id: 'kitchen',
    chapterNumber: 4,
    title: 'Küchen- & Ausschank-Monitor (KDS)',
    subtitle: 'Digitale Bonleiste, Garzeiten, Zeittimer und Abruf-Steuerung',
    icon: 'kitchen',
    sections: [
      {
        id: '4.1',
        heading: '4.1 Digitale Bonleiste & Statusfarben',
        paragraphs: [
          'Der Küchen-Monitor (/kitchen) ersetzt Papierbons in der Küche durch Touch-Monitore:',
        ],
        table: {
          headers: ['Farbe / Zustand', 'Wartezeit', 'Bedeutung'],
          rows: [
            ['Grün', '0 – 5 Minuten', 'Neu eingegangene Bestellung'],
            ['Gelb / Orange', '5 – 12 Minuten', 'In Zubereitung'],
            ['Rot blinkend mit Alarmton', '> 12 Minuten', 'Dringend / Überfällig'],
          ],
        },
      },
      {
        id: '4.2',
        heading: '4.2 Gang-Freigaben & Erledigung',
        steps: [
          'Beim Start der Zubereitung: Bon antippen (Status wechselt auf "In Arbeit").',
          'Wenn das Essen fertig ist: Bon antippen (Status wechselt auf "Fertig / Abholbereit").',
          'Das Serviceteam sieht den Status sofort auf seinen Kellner-Smartphones.',
        ],
      },
      {
        id: '4.3',
        heading: '4.3 Wiederherstellung erledigter Bons',
        paragraphs: [
          'Versehentlich abgehakte Bons können mit einem Klick auf "Erledigte anzeigen" im KDS-Menü wieder reaktiviert werden.',
        ],
      },
    ],
  },
  {
    id: 'products',
    chapterNumber: 5,
    title: 'Stammdaten, Warengruppen & Inventar',
    subtitle: 'Artikel, Rezepturen, Zutatenlager (StockUnit) und LMIV-Allergene',
    icon: 'products',
    sections: [
      {
        id: '5.1',
        heading: '5.1 Warengruppen & Sortierung',
        paragraphs: [
          'Warengruppen strukturieren das Sortiment (z. B. "Biere", "Alkoholfrei", "Grill", "Kuchen"). Jeder Gruppe kann eine eigene Erkennungsfarbe zugewiesen werden.',
        ],
      },
      {
        id: '5.2',
        heading: '5.2 Artikelstammdaten & Steuersätze',
        paragraphs: [
          'Für jeden Artikel werden Preis, Pfand (z. B. 1.00 € Glaspfand) und Steuersatz (19 % Vor-Ort-Verzehr oder 7 % Außerhaus/Speisen) hinterlegt.',
        ],
      },
      {
        id: '5.3',
        heading: '5.3 Zutaten-Lagerbestand (StockUnit) & Rezepturabzug',
        paragraphs: [
          'OpenBon verknüpft Artikel mit echten Lagerposten (z. B. "Brötchen", "Schnitzel", "Bierfass 50l").',
          'Wird eine "Bratwurst mit Semmel" oder ein "Steakbrötchen" verkauft, bucht das System automatisch je 1 Brötchen aus dem gemeinsamen Vorratslager ab.',
        ],
        hints: [
          {
            kind: 'tip',
            text: 'Erreicht ein Lagerbestand den Meldebestand, warnt OpenBon das Kassenpersonal und blockiert auf Wunsch den Verkauf ausverkaufter Posten.',
          },
        ],
      },
      {
        id: '5.4',
        heading: '5.4 LMIV-Allergene & Jugendschutz',
        paragraphs: [
          'Gemäß EU-Lebensmittelinformationsverordnung (LMIV) können Allergene (Gluten, Laktose, Sellerie etc.) hinterlegt werden. Bei alkoholischen Getränken erzwingt das System eine Altersprüfung (ab 16 / ab 18 Jahren).',
        ],
      },
    ],
  },
  {
    id: 'printers',
    chapterNumber: 6,
    title: 'Druckermanagement & Bon-Layouts',
    subtitle: 'ESC/POS-Netzwerkdrucker, Tablett-Splits, Schriftgrößen und Speisekarten',
    icon: 'printers',
    sections: [
      {
        id: '6.1',
        heading: '6.1 Netzwerk-Bondrucker (ESC/POS)',
        paragraphs: [
          'OpenBon steuert Thermodrucker (Epson, Star, Bixolon, Munbyn) direkt über das Netzwerk via TCP Port 9100 an.',
          'Ist kein physischer Drucker angeschlossen, fängt der integrierte "Virtuelle Drucker" alle Belege ab und zeigt sie im Browser an.',
        ],
      },
      {
        id: '6.2',
        heading: '6.2 Druckergruppen & Routing',
        paragraphs: [
          'Jeder Artikel ist einer Druckergruppe zugewiesen (z. B. Küche -> Drucker 1, Ausschank -> Drucker 2, Bar -> Drucker 3). Bei einer gemischten Bestellung werden die Bons automatisch getrennt und parallel ausgedruckt.',
        ],
      },
      {
        id: '6.3',
        heading: '6.3 Tablett-Splitting (Max. Posten je Bon)',
        paragraphs: [
          'Werden z. B. 18 Bier auf einmal bestellt, teilt OpenBon den Auftrag automatisch in handliche Tablett-Bons (z. B. 3 Bons à 6 Bier mit Aufdruck "Bon 1 von 3").',
        ],
      },
      {
        id: '6.4',
        heading: '6.4 Stufenlose Tischnummer-Schriftgröße (1× bis 8×)',
        paragraphs: [
          'Die Tischnummer kann für jede Bon-Art (Kassenbeleg, Speisen-Bon, Getränke-Bon) getrennt von 1× (Standard) bis 8× (Riesig invertiert) skaliert werden.',
        ],
      },
      {
        id: '6.5',
        heading: '6.5 Bon-Vorlagen (Templates)',
        paragraphs: [
          'Vier wählbare Vorlagen stehen bereit:',
          '1. Klassisch: Ausgewogenes Standard-Layout.',
          '2. Kompakt (Eco): Minimaler Papierverbrauch.',
          '3. Großschrift / High-Visibility: Riesige Nummern und Boxen für hektische Küchen.',
          '4. Gastro / Detail: Mit MwSt-Splits und Bewirtungsnachweis (§ 4 Abs. 5 EStG).',
        ],
      },
      {
        id: '6.6',
        heading: '6.6 Druckbare Speisekarte (4 Vorlagen)',
        paragraphs: [
          'Unter /admin/products kann die Speisekarte in 4 Designs als druckfertiges PDF generiert werden (Klassisch ohne Zierrahmen, Modern/Gastro-Grid, Großschrift-Aushang für Kassenhäuschen und A5-Tischaufsteller).',
        ],
      },
    ],
  },
  {
    id: 'payment',
    chapterNumber: 7,
    title: 'Zahlungen, Trinkgeld & Abrechnung',
    subtitle: 'Kartenzahlung, Trinkgeld-Pool, Schichtabschluss und Kassensturz',
    icon: 'payment',
    sections: [
      {
        id: '7.1',
        heading: '7.1 Integrierte Kartenzahlungsanbieter',
        paragraphs: [
          'OpenBon unterstützt führende Kartenterminals und Payment-Apps. In den Einstellungen wird genau ein Anbieter aktiviert:',
        ],
        table: {
          headers: ['Anbieter', 'Schnittstelle', 'Besonderheit'],
          rows: [
            ['SumUp', 'App-to-App & Air/Solo', 'Direkter App-Start am Smartphone'],
            ['VR-Pay:Me', 'Volksbanken / VR-Smart Guide', 'Offizielle Genossenschaftsbanken-Lösung'],
            ['Sparkasse S-POS', 'Sparkassen App-to-App', 'Direkte Verrechnung über Sparkassen-Girokonto'],
            ['Zettle by PayPal', 'App-to-App', 'Zettle Card Reader Integration'],
            ['Stripe Terminal', 'Smart Reader & QR', 'Cloudbasierte Kreditkartenabwicklung'],
            ['ZVT-over-IP', 'Klassisches EC-Terminal (Port 20007)', 'Stationäre Händlerterminals (Ingenico, Verifone, CCV)'],
          ],
        },
      },
      {
        id: '7.2',
        heading: '7.2 Trinkgeld-Modelle',
        paragraphs: [
          '1. Bedienung behält alles: Trinkgeld verbleibt zu 100 % beim Kellner.',
          '2. Team-Pool: Trinkgeld wird an die Hauptkasse abgegeben und anteilig an Küche/Theke verteilt.',
          '3. Mischprofile: Frei definierbare prozentuale Aufteilung.',
        ],
      },
      {
        id: '7.3',
        heading: '7.3 Geführter 5-Stufen-Kassensturz (/admin/settle)',
        paragraphs: [
          'Die Schichtabrechnung erfolgt revisionssicher durch die Kassenleitung in 5 Schritten: Bedienungsauswahl -> Umsatzprüfung -> Zählen -> Differenzbestätigung -> Belegausdruck (inkl. Unterschriftenfeldern).',
        ],
      },
      {
        id: '7.4',
        heading: '7.4 Tagesabschluss (X-Bon und Z-Bon)',
        paragraphs: [
          'X-Bon: Beliebig oft abrufbarer Zwischenstand ohne Schließung der Zähler.',
          'Z-Bon: Endgültiger Tagesabschluss. Setzt Tagesumsätze zurück und speichert die Kassenperiode ab.',
        ],
      },
    ],
  },
  {
    id: 'backup',
    chapterNumber: 8,
    title: 'Ausfallsicherheit, Backups & Datenschutz',
    subtitle: 'Offline-Outbox, SQLite WAL-Modus, Snapshots, USB-Export & § 146a AO',
    icon: 'backup',
    sections: [
      {
        id: '8.1',
        heading: '8.1 Smartphone-Outbox (Unterbrechungsfreier Offline-Betrieb)',
        paragraphs: [
          'Bricht das WLAN im Festzelt kurzzeitig ab, speichern die Handys der Kellner alle Bestellungen lokal in der IndexedDB. Sobald das WLAN wieder verfügbar ist, synchronisieren sich alle Bons automatisch.',
        ],
      },
      {
        id: '8.2',
        heading: '8.2 SQLite WAL-Modus (Crash-Resistenz)',
        paragraphs: [
          'Dank Write-Ahead-Logging (WAL) ist die Datenbank gegen plötzliche Stromausfälle immun. Kein Datensatz geht verloren.',
        ],
      },
      {
        id: '8.3',
        heading: '8.3 Automatische Snapshots & Datensicherung (/admin/backup)',
        paragraphs: [
          'Unter /admin/backup können automatische Snapshots aktiviert werden (z. B. alle 15 Minuten). Zudem steht ein 1-Klick-Backup für USB-Sticks bereit.',
        ],
      },
      {
        id: '8.4',
        heading: '8.4 Gesetzliche Kassenmeldung (§ 146a Abs. 4 AO)',
        paragraphs: [
          'OpenBon generiert unter /admin/fiscal/kassenmeldung das amtliche Meldeformular für das Finanzamt bei Inbetriebnahme, Außerbetriebnahme oder Standortwechsel.',
        ],
      },
    ],
  },
  {
    id: 'diagnostics',
    chapterNumber: 9,
    title: 'Systemdiagnose & Fehlerbehebung',
    subtitle: 'Preflight-Check, Drucker-Socket-Wächter und detailliertes ActionLog',
    icon: 'diagnostics',
    sections: [
      {
        id: '9.1',
        heading: '9.1 Preflight-Check vor Festbeginn',
        paragraphs: [
          'Unter /admin/diagnostics führt der 1-Klick-Preflight-Check alle Tests vor Festbeginn durch: Datenbank-Integrität, Netzwerk-Erreichbarkeit aller Drucker, Speisekarten-Konsistenz und ein simulierter E2E-Bestellzyklus.',
        ],
      },
      {
        id: '9.2',
        heading: '9.2 ActionLog: Revisionssicheres Audit-Protokoll',
        paragraphs: [
          'Jede Buchung, Stornierung, Tischumbuchung und Stammdatenänderung wird mit Zeitstempel, Benutzer, Beträgen und Details protokolliert und kann gefiltert exportiert werden.',
        ],
      },
    ],
  },
];
