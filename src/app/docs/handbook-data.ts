/**
 * Spec 8: Inhalte der integrierten Offline-HTML-Dokumentation.
 * Bewusst als statische Daten im Bundle – kein Internet, kein Dateisystemzugriff nötig.
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
    title: 'Kellner-Handbuch',
    subtitle: 'Bestellen, Sonderwünsche, Tablett-Bons, Pfand, Splitting und Kartenzahlung',
    icon: 'waiter',
    sections: [
      {
        heading: 'Schnellstart am Smartphone',
        steps: [
          'Im Browser http://openbon.local öffnen und über "Zum Home-Bildschirm" als App ablegen.',
          'Beim ersten Start den eigenen Namen eingeben – er erscheint auf jedem Bon und im Schichtbericht.',
          'Kachel "Bedienung (Tische)" wählen. Der Tischplan zeigt freie Tische grün, belegte Tische bernstein.',
        ],
        hints: [
          {
            kind: 'tip',
            text: 'Der Name lässt sich jederzeit über die Kopfzeile ändern – wichtig beim Geräte-Tausch in der Schicht.',
          },
        ],
      },
      {
        heading: 'Tischbestellung aufnehmen',
        steps: [
          'Tisch antippen und "Bestellen" wählen.',
          'Warengruppe oben wählen, danach optional den Getränke-Filter (Bier, Wein, Alkoholfrei, Heiß, Bar).',
          'Artikel antippen – bei Varianten (z. B. 0,3 l / 0,5 l) erscheint eine Auswahl je Größe.',
          'Im Warenkorb rechts Menge ändern, Sonderwunsch ergänzen und mit "Bestellen" abschicken.',
        ],
        hints: [
          {
            kind: 'warn',
            text: 'Ausverkaufte Artikel sind durchgestrichen und lassen sich nicht buchen. Der Bestand wird beim Abschicken automatisch abgezogen.',
          },
        ],
      },
      {
        heading: 'Sonderwünsche',
        paragraphs: [
          'Über "+ Wunsch" öffnet sich der Baukasten aus Vorsatzwörtern (ohne, extra, wenig, viel) und Zutaten. Ein Tipp auf "ohne" und danach auf "Zwiebeln" ergibt "ohne Zwiebeln".',
          'Freitext ist zusätzlich möglich. Der Wunsch wird auf dem Küchenbon fett und mit Ausrufezeichen gedruckt.',
        ],
      },
      {
        heading: 'Gänge und Zurückhalten',
        paragraphs: [
          'Über der Artikelliste wird der Gang gewählt, auf den neue Artikel gebucht werden: Gang 1 (Vorspeise/Sofort), Gang 2 (Hauptgang), Gang 3 (Dessert/Später).',
          'Der Schalter "Zurückhalten" (HOLD) verhindert, dass die Position sofort in der Küche gedruckt wird. Sie wird erst beim manuellen Postenabruf gesendet.',
        ],
        hints: [
          {
            kind: 'tip',
            text: 'Je Position im Warenkorb lassen sich Gang und HOLD auch nachträglich mit den kleinen Schaltflächen G1/G2/G3 ändern.',
          },
        ],
      },
      {
        heading: 'Gleiche Runde noch einmal',
        paragraphs: [
          'Im Tischdialog übernimmt "Gleiche Runde" alle zuletzt bestellten Artikel des Tisches direkt in den Warenkorb. Ausverkaufte Artikel werden dabei automatisch weggelassen und gemeldet.',
        ],
      },
      {
        heading: 'Tablett-Bons',
        paragraphs: [
          'Übersteigt eine Bestellung das Tablett-Limit der Druckgruppe, teilt das System den Druck automatisch auf mehrere Bons auf. Jeder Teilbon trägt eine Kopfzeile wie "*** BON 2 von 3 (Tisch 14 - 6x Bier) ***".',
          'So passt jeder Bon exakt auf ein Tablett und der Ausschank kann Bon für Bon abarbeiten.',
        ],
      },
      {
        heading: 'Kassieren und Splitten',
        steps: [
          'Tisch antippen, "Kassieren" wählen.',
          'Stufe 1: Posten auswählen. "Alles bezahlen" markiert alles, einzelne Kacheln markieren nur die gewünschten Positionen. Mengen lassen sich per + / − teilen.',
          'Rückpfand über den Leergut-Block verrechnen (Anzahl x Pfandwert).',
          'Stufe 2: Zahlart wählen – jede Zahlart hat eine eigene Signalfarbe.',
          'Stufe 3 Bargeld: Betrag über den Ziffernblock oder die Scheintasten eingeben. Das Rückgeld erscheint groß in Bernstein.',
          'Stufe 4: Beleg drucken, keinen Beleg drucken oder Tisch schließen.',
        ],
        hints: [
          {
            kind: 'tip',
            text: 'Sind nach einem Teil-Kassiervorgang noch Posten offen, führt "Nächsten Gast am selben Tisch kassieren" direkt zurück zur Auswahl.',
          },
        ],
      },
      {
        heading: 'Kartenzahlung',
        paragraphs: [
          'SumUp, VR-Pay Me und Sparkasse S-POS öffnen die jeweilige App auf dem Gerät. Nach der Autorisierung kehrt die App zu OpenBon zurück und die Zahlung wird verbucht.',
          'Beim EC-Terminal (ZVT) spricht der Server das Terminal direkt über das Netzwerk an. Der Bildschirm zeigt so lange einen pulsierenden Ring, bis die Autorisierung vorliegt.',
        ],
        hints: [
          {
            kind: 'warn',
            text: 'Bei Abbruch ertönt ein Warnton. Die Zahlung ist dann NICHT gebucht – bitte erneut versuchen oder eine andere Zahlart wählen.',
          },
        ],
      },
      {
        heading: 'Storno',
        paragraphs: [
          'Vor dem Abschicken kann im Warenkorb frei geändert werden. Danach ist ein Storno nur mit Admin- oder Kassen-PIN und mit Pflicht-Stornogrund möglich.',
          'Der Storno erzeugt automatisch einen deutlich markierten Storno-Bon in der betroffenen Station mit dem Hinweis "NICHT ZUBEREITEN". Der Bestand wird zurückgebucht.',
        ],
      },
      {
        heading: 'X-Bon der eigenen Schicht',
        paragraphs: [
          'Über "X-Bon Schicht" im Tischdialog wird jederzeit ein Zwischenbericht gedruckt: Schicht-Umsatz, Bar-Soll, Kartensplits und Trinkgeld. Die Kasse wird dabei NICHT abgeschlossen.',
        ],
      },
    ],
  },
  {
    id: 'kasse',
    title: 'Kassen- & Thekenhandbuch',
    subtitle: 'Wertmarken, Gutscheinbon, Kassenlade, Wechselgeld und Schichtwechsel',
    icon: 'pos',
    sections: [
      {
        heading: 'Bonkasse öffnen & Betriebsmodi',
        steps: [
          'Kachel "Bonkasse (Theke)" wählen und den Kassen-PIN eingeben.',
          'Artikel antippen, um sie in den Bon zu legen. Der Bon wird direkt an der Theke abgerechnet.',
        ],
        paragraphs: [
          'Die Bonkasse unterstützt 3 spezialisierte Betriebsmodi:',
          '• "Nur Kassieren" (Standard / DIRECT): Der klassische Fest- & Thekenmodus. Nach der Bezahlung wird die Bestellung direkt an den Küchen-/Ausschankdruckern oder Monitoren ausgegeben und die Ware an der Theke überreicht.',
          '• "Wertmarken" (VOUCHER): Es werden reine Verzehrbons / Wertmarken gedruckt. Der Gast bezahlt an der Kasse und löst die Wertmarken an den dezentralen Ständen ein.',
          '• "Kombimodus" (DUAL): Mischbetrieb aus Direktverkauf und Wertmarken in einem Kassiervorgang.',
        ],
        hints: [
          {
            kind: 'tip',
            text: 'Standardmäßig startet die Bonkasse im Modus "Nur Kassieren". Über den Modus-Umschalter oben rechts kann jederzeit gewechselt werden.',
          },
        ],
      },
      {
        heading: 'Wertmarken- und Gutscheinverkauf',
        paragraphs: [
          'Direktverkäufe an der Theke erhalten eine fortlaufende Abholmarke. Die Nummer wird groß auf den Bon gedruckt, damit der Gast sie an der Ausgabe vorzeigen kann.',
        ],
      },
      {
        heading: 'Kassenlade',
        paragraphs: [
          'Bei jeder Barzahlung sendet das System automatisch den Öffnungsimpuls an den Bondrucker, an dem die Kassenlade angeschlossen ist.',
          'Ein Öffnungsimpuls wird ebenfalls bei jeder erfassten Geldbewegung ausgelöst.',
        ],
      },
      {
        heading: 'Kassenbuch: Wechselgeld und Entnahmen',
        steps: [
          'Admin-Bereich → "Kassenbuch" öffnen.',
          'Bei Schichtbeginn den Wechselgeld-Vorschuss als Einlage (CASH_IN) erfassen.',
          'Zwischenabgaben in den Tresor als Entnahme (CASH_OUT) erfassen.',
          'Jede Bewegung erfordert Admin- oder Kassen-PIN und wird automatisch quittiert.',
        ],
        hints: [
          {
            kind: 'tip',
            text: 'Das Bar-Soll berechnet sich als Bareinnahmen + Einlagen − Entnahmen − ausgezahlter Rückpfand. Es steht auf X-Bon und Z-Bon.',
          },
        ],
      },
      {
        heading: 'Schichtwechsel',
        steps: [
          'Ausscheidende Bedienung druckt ihren X-Bon.',
          'Bargeld zählen und mit dem Bar-Soll abgleichen.',
          'Übergabe an die neue Bedienung, die den eigenen Namen in der Kopfzeile setzt.',
        ],
      },
      {
        heading: 'Tagesabschluss (Z-Bon)',
        paragraphs: [
          'Der Z-Bon schließt die Kassenperiode ab, speichert einen signierten Fiskalblock, druckt die MwSt-Aufschlüsselung und setzt die Zähler zurück.',
          'Er ist nur mit dem Admin-PIN möglich und wird abgelehnt, solange noch unbezahlte Positionen auf Tischen offen sind.',
        ],
        hints: [
          {
            kind: 'warn',
            text: 'Im Übungsmodus lässt sich kein Z-Bon erstellen. Vor dem echten Abschluss muss der Echtbetrieb aktiv sein.',
          },
        ],
      },
    ],
  },
  {
    id: 'kueche',
    title: 'Küchen-Leitfaden',
    subtitle: 'Küchenmonitor, Gang-Steuerung, Abstreichen, Akustik-Gong und Storno-Bons',
    icon: 'kitchen',
    sections: [
      {
        heading: 'Küchenmonitor bedienen',
        steps: [
          'Kachel "Küchenmonitor" wählen und den Küchen-PIN eingeben.',
          'Jede Bestellung erscheint als Karte mit Tisch, Bonnummer und Wartezeit.',
          'Position antippen, um sie abzustreichen. Sind alle Positionen erledigt, wandert die Karte auf "Fertig".',
        ],
      },
      {
        heading: 'Wartezeit-Ampel',
        table: {
          headers: ['Farbe', 'Bedeutung'],
          rows: [
            ['Blau', 'Neu eingegangen, alles im Zeitrahmen'],
            ['Bernstein', 'Wartezeit überschritten – bevorzugt bearbeiten'],
            ['Rot', 'Kritische Wartezeit – Bedienung informieren'],
          ],
        },
      },
      {
        heading: 'Gang-Steuerung',
        paragraphs: [
          'Bons werden nach Gang gruppiert gedruckt. Ein Zwischentitel "GANG 2" trennt die Blöcke.',
          'Zurückgehaltene Positionen (HOLD) erscheinen erst, wenn die Bedienung sie abruft. So kommt der Hauptgang nicht zeitgleich mit der Vorspeise.',
        ],
      },
      {
        heading: 'Akustik-Gong',
        paragraphs: [
          'Bei neuen Bestellungen ertönt ein Aufmerksamkeitston. Damit Browser den Ton zulassen, muss der Bildschirm nach dem Öffnen einmal angetippt werden.',
        ],
      },
      {
        heading: 'Storno-Bons',
        paragraphs: [
          'Ein Storno-Bon ist invertiert gedruckt und trägt die Zeile "*** STORNO-BON - NICHT ZUBEREITEN ***" sowie den Stornogrund.',
          'Bereits zubereitete Speisen bitte nicht ausgeben und den Bon an der Ausgabe sichtbar ablegen.',
        ],
      },
    ],
  },
  {
    id: 'admin',
    title: 'Admin- & Installations-Guide',
    subtitle: 'Raspberry-Pi-Setup, mDNS, Drucker, Kartenterminals, TSE und Notfall-Wiederherstellung',
    icon: 'admin',
    sections: [
      {
        heading: 'Headless-Installation auf Raspberry Pi / Linux',
        steps: [
          'Raspberry Pi OS Lite installieren und mit dem Netzwerk verbinden.',
          'Repository klonen und im Projektverzeichnis "sudo bash install-headless.sh" ausführen.',
          'Das Skript installiert Node.js, legt den systemd-Dienst an, erteilt CAP_NET_BIND_SERVICE für Port 80 und aktiviert den Autostart.',
          'Nach dem Neustart ist die Kasse unter http://openbon.local erreichbar.',
        ],
        hints: [
          {
            kind: 'tip',
            text: 'Status prüfen mit "systemctl status openbon", Logs mit "journalctl -u openbon -f".',
          },
        ],
      },
      {
        heading: 'Zero-Config-Netzwerk (mDNS)',
        paragraphs: [
          'Der Server beantwortet mDNS-Anfragen für openbon.local selbst. Android-Geräte benötigen teilweise die IP-Adresse; diese steht im Admin-Dashboard und auf jedem QR-Beitritts-Bon.',
          'Empfehlung fürs Fest: eigener WLAN-Router ohne Internet, feste IP für den Server, DHCP-Bereich für die Tablets.',
        ],
      },
      {
        heading: 'Drucker einrichten',
        steps: [
          'Admin → "Drucker & Druckgruppen" öffnen.',
          'Netzwerk scannen lassen oder IP und Port (Standard 9100) direkt eintragen.',
          'Papierbreite (80 mm oder 58 mm) und Zeichensatz CP858 wählen.',
          'Druckgruppen anlegen (z. B. Küche, Ausschank, Kasse) und jedem Artikel eine Gruppe zuordnen.',
          'Tablett-Limit je Druckgruppe setzen – 0 bedeutet unbegrenzt, 1 erzeugt Einzelbons.',
        ],
        hints: [
          {
            kind: 'tip',
            text: 'Ohne physischen Drucker den virtuellen Drucker aktivieren: Bons erscheinen dann unter /virtual-printer im Browser.',
          },
        ],
      },
      {
        heading: 'Kartenzahlung konfigurieren',
        table: {
          headers: ['Dienst', 'Erforderliche Angabe', 'Verfahren'],
          rows: [
            ['SumUp', 'Affiliate-Key', 'App-to-App Deep Link'],
            ['VR-Pay Me', 'Händler-/Terminal-ID', 'App-to-App URL-Intent'],
            ['Sparkasse S-POS', 'Händler-ID', 'App-to-App (SoftPOS)'],
            ['EC-Terminal', 'Terminal-IP, Port, Passwort', 'ZVT-over-IP (TCP)'],
          ],
        },
        paragraphs: [
          'Die Basis-URL muss der Adresse entsprechen, unter der die Tablets den Server erreichen – sonst finden die Karten-Apps beim Rücksprung nicht zurück.',
        ],
      },
      {
        heading: 'TSE aktivieren',
        paragraphs: [
          'Unter "Grundeinstellungen & TSE" wird der TSE-Anbieter gewählt und die Seriennummer hinterlegt. Ohne TSE arbeitet das System im Vereins-/Übungsbetrieb.',
          'Unabhängig von der TSE signiert OpenBon jeden Z-Bon mit einem HMAC-SHA256-Fiskalblock, der auf den vorherigen Abschluss verkettet ist.',
        ],
      },
      {
        heading: 'Hochverfügbarkeit',
        paragraphs: [
          'Ein zweiter Rechner kann als STANDBY konfiguriert werden. Er überwacht den PRIMARY per Heartbeat und übernimmt bei Ausfall.',
          'Alle Mutationen werden ins SyncJournal geschrieben und vom STANDBY nachgezogen.',
        ],
      },
      {
        heading: 'Selbstdiagnose',
        paragraphs: [
          'Beim Start und danach alle 60 Sekunden prüft das System Datenbank-Integrität, Drucker-Sockets und HA-Journal und behebt erkannte Probleme selbstständig.',
          'Das Ergebnis ist im Admin-Dashboard sichtbar und über /api/system/diagnostics abrufbar.',
        ],
      },
      {
        heading: 'Notfall-Wiederherstellung',
        steps: [
          'Regelmäßig über Admin → Backup eine Sicherung herunterladen.',
          'Bei Datenverlust den Dienst stoppen: "sudo systemctl stop openbon".',
          'Die Datei prisma/dev.db durch die Sicherung ersetzen.',
          'Dienst starten: "sudo systemctl start openbon" und die Selbstdiagnose auslösen.',
        ],
        hints: [
          {
            kind: 'warn',
            text: 'Vor dem Fest unbedingt einen kompletten Testlauf im Übungsmodus machen – inklusive Probedruck auf allen Stationen.',
          },
        ],
      },
    ],
  },
];
