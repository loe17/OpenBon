# Erweiterter Implementierungsplan: Modernes, webbasiertes Kassensystem mit Hochverfügbarkeit (OrderAssist-Äquivalent)

Vollständiger Implementierungsplan für das plattformunabhängige, hochmoderne Kassen- und Bestellsystem für Vereinsfeste, Feuerwehrfeste, Schützenfeste und Gastronomie-Events. Das System läuft als eigenständiger Server auf lokaler Hardware, wird per PWA/Weboberfläche von beliebigen Smartphones/Tablets/PCs bedient, bietet eine automatische Zwei-Rechner-Echtzeitsynchronisation (High-Availability Failover), eine **Live-Geräteübersicht (Uptime, Akkustand, Ping, Status)**, wird auf **GitHub** inklusive Dokumentation bereitgestellt und durchläuft eine **massive, praxisnahe Test- und iterative Fehlerbehebungsphase**.

---

## 1. Systemarchitektur & Netzwerk-Topologie (inkl. flexibler Internet-Anbindung)

```
                         ┌─────────────────────────────────────────────────────────┐
                         │   OPTIONALER INTERNET-UPLINK FÜR KARTENZAHLUNG          │
                         │   (LTE-Router / Mobil-Hotspot / Hausanschluss via WAN)  │
                         └────────────────────────────┬────────────────────────────┘
                                                      │ (LAN / WAN Kabel)
                                                      ▼
                  ┌───────────────────────────────────────────────────────────────────────┐
                  │                 LOKALER WLAN-ROUTER / ACCESS POINT                    │
                  │   ● Vergibt feste DHCP-Leases & mDNS (http://kasse.local)             │
                  │   ● 100 % Autark: Funktioniert auch komplett OHNE Internet-Uplink     │
                  │   ● Leitet bei vorhandenem Internet Daten an Zahlungsanbieter weiter  │
                  └───────────────────┬───────────────────────────────┬───────────────────┘
                                      │                               │
                ┌─────────────────────┴─────────────┐   ┌─────────────┴─────────────────────┐
                ▼                                   ▼   ▼                                   ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐   ┌───────────────────────┐
│     SERVER 1 (PRIMARY)        │   │     SERVER 2 (HOT-STANDBY)    │   │  ESC/POS THERMODRUCKER│
│  ● Next.js 14 / Node.js Host  │   │  ● Next.js 14 / Node.js Host  │   │  ● LAN / WLAN (9100)  │
│  ● SQLite (WAL-Modus)         │◄─►│  ● Gespiegelte SQLite-DB      │   │  ● Küche, Theke, Bar  │
│  ● Socket.io Realtime Hub     │   │  ● Heartbeat-Daemon           │   └───────────────────────┘
│  ● ESC/POS Print-Engine       │   │  ● Auto-Failover (<3s)        │
└───────────────┬───────────────┘   └───────────────┬───────────────┘
                │                                   │
                └─────────────────┬─────────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
┌─────────────────────────────────┐               ┌─────────────────────────────────┐
│   BEDIENUNGEN / SERVICE-STAFF   │               │   KÜCHENMONITOR & BONKASSEN     │
│   (Beliebiges Smartphone / PWA) │               │   (Tablets, Touch-PCs, Screens) │
│   ● Keine App-Installation      │               │   ● Live-Abarbeitung (KDS)      │
│   ● Schnelle Tischbestellung    │               │   ● Bonkassen mit Kassenlade    │
│   ● Bar & Kartenzahlung (SumUp) │               │   ● Rückstandsanzeige & Signal  │
│   ● Live Akku- & Status-Melder  │               │   ● Geräte-Verwaltungs-Client   │
└─────────────────────────────────┘               └─────────────────────────────────┘
```

### Netzwerk- & Internet-Strategie für Kartenzahlung
1. **100 % Offline-Kernbetrieb:** Das interne Bestellen, Drucken, Kassieren mit Bargeld, die Tischübersicht und der Küchenmonitor laufen ausschließlich über das lokale WLAN des Routers – **ohne dass eine Internetverbindung bestehen muss**.
2. **Flexibler Internet-Uplink:** Sobald bargeldlose Zahlung (Kartenzahlung via SumUp, Sparkasse POS, VR-Pay, Stripe Reader oder virtuelles Terminal) gewünscht ist, wird der WAN-/Uplink-Port des WLAN-Routers flexibel per Netzwerkkabel mit einem Internetzugang (LTE-/5G-Router, Smartphone-Tethering oder Hallen-LAN) verbunden.
3. **Automatisches Routing:** Der Router versorgt alle angemeldeten Kassen- und Kellner-Smartphones transparent mit Internet für die Zahlungsabwicklung, während der interne Kassenverkehr mit maximaler lokaler Geschwindigkeit und Zuverlässigkeit weiterläuft.

---

## 2. Hochverfügbarkeits- & Ausfallsicherheitskonzept (Zwei-Rechner-Spiegelung)

### Automatische Master-Standby-Replikation
* **Primary Server (Rechner 1):** Nimmt alle Schreiboperationen entgegen und verarbeitet Druckaufträge.
* **Secondary Server (Rechner 2):** Lauscht im Hintergrund auf Transaktions-Events über einen dedizierten Replikations-Kanal und spiegelt die SQLite-Datenbank in Echtzeit (Continuous WAL Replication).
* **Heartbeat & Leader Election:** Rechner 2 sendet jede Sekunde einen Ping an Rechner 1. Bleibt Rechner 1 für mehr als 3 Sekunden stumm (z. B. Stromausfall, Hardwaredefekt), übernimmt Rechner 2 automatisch die Master-Rolle.
* **Transparenter Hostname:** Über mDNS (`http://kasse.local`) oder Virtual-IP verbindet sich das Personal immer mit derselben Adresse – kein Umkonfigurieren an den Smartphones notwendig.

---

## 3. GitHub-Strategie, Versionierung & Dokumentation

Das gesamte Projekt wird von Beginn an als sauberes Open-Source- / Community-fähiges Repository für GitHub strukturiert:

### Repository-Struktur
```text
Kassensystem/
├── .github/
│   └── workflows/
│       ├── test.yml            # CI: Automatisierte Tests & Linting
│       └── release.yml         # CD: Automatisierter Build & Release
├── docs/                       # Ausführliche Projektdokumentation (Markdown)
│   ├── 01-installation.md      # Schritt-für-Schritt Installationsanleitung (Windows/Linux/Docker)
│   ├── 02-netzwerk-setup.md    # Router-Konfiguration, Offline-WLAN & Internet-Uplink
│   ├── 03-bedienungsanleitung.md # Handbuch für Kellner & Servicepersonal
│   ├── 04-kuechenmonitor.md    # Handbuch für Küchen- & Thekenpersonal
│   ├── 05-drucker-einrichtung.md # ESC/POS Netzwerkdrucker & Druckgruppen
│   ├── 06-hochverfuegbarkeit.md# Einrichtung des redundanten 2-Server-Betriebs
│   ├── 07-geraeteverwaltung.md # Geräte-Dashboard, Akkuüberwachung & Live-Status
│   └── 08-fiskalisierung-tse.md# KassenSichV & TSE-Integration
├── prisma/
│   └── schema.prisma           # Relationales Datenbankschema
├── scripts/
│   ├── start-primary.bat       # 1-Klick Starter für Windows (Hauptserver)
│   ├── start-standby.bat       # 1-Klick Starter für Windows (Ersatzserver)
│   ├── start-primary.sh        # Linux / Raspberry Pi Starter
│   └── start-standby.sh        # Linux / Raspberry Pi Standby Starter
├── src/                        # Quellcode Next.js 14 / Node.js
├── public/                     # Statische Assets & PWA Manifest / Icons
├── docker-compose.yml          # Container-Setup für 1-Befehl-Start
├── README.md                   # Repositor-Landingpage mit Screenshots, Quickstart & Features
├── LICENSE                     # Open-Source-Lizenz (z.B. MIT)
└── package.json
```

### Versionierungs-Strategie
* **Semantic Versioning (SemVer):** `v1.0.0`, `v1.1.0` etc.
* **Conventional Commits:** Aussagekräftige Commit-Nachrichten (`feat:`, `fix:`, `docs:`, `perf:`).
* **Release-Pakete:** Vorkonfigurierte Zip-Dateien mit Start-Skripten für Windows und Linux.

---

## 4. Detaillierte Modul-Übersicht & Implementierungsschritte

### Phase 1: Projekt-Setup, Tooling & Datenbank-Fundament
* Initialisierung eines Next.js 14 TypeScript Projekts mit Tailwind CSS, Lucide Icons, Shadcn UI und Socket.io Server.
* Aufsetzen von SQLite mit WAL-Modus und Prisma ORM.
* Implementierung des relationalen Datenbankschemas:
  * `EventConfig` (Name, Währung EUR/CHF, MwSt-Sätze, Trainingsmodus)
  * `Category`, `Product`, `ProductVariant`, `ProductOption`
  * `CustomizationWordGroup` (Sonderwunsch-Wortgruppen)
  * `DiningTable` (Tischkoordinaten, Status)
  * `Printer`, `PrintGroup`, `PrintAssignment`
  * `Order`, `OrderItem`, `Payment`, `PaymentItem`, `StockItem`, `ChatMessage`
  * `Device` (ID, Name, Rolle, IP, OS/Browser, Akkustand, OnlineSeit, LetzteAktivitaet, Status)
  * `SyncJournal` (Transaktions-Log für HA-Spiegelung)

### Phase 2: ESC/POS Netzwerkdrucker-Engine & Bon-Spooler
* `escpos-builder.ts`: Generierung nativer ESC/POS-Steuerbefehle (Textformatierung, Ausrichtung, Barcodes, QR-Codes, Schnittbefehl, Kassenladen-Öffnungsimpuls `ESC p 0 25 250`).
* Zeichensatz-Konvertierung (CP858 / PC850) für Umlaute (`ä`, `ö`, `ü`, `ß`, `€`).
* `network-spooler.ts`: Direkte TCP Raw Socket Anbindung (Port 9100) mit Warteschlangenverwaltung und automatischem Retry.
* `ticket-splitter.ts`: Automatisches Aufteilen von Bestellungen nach Druckgruppen und Höchstmengen (z. B. max 1 Speise pro Bon für die Küche, max 4 Getränke pro Bon für den Ausschank).
* `virtual-printer.tsx`: Virtueller Bondrucker-Simulator im Browser für Tests ohne physische Drucker-Hardware.

### Phase 3: High-Availability Replikations- & Failover-System
* `ha-service.ts`: Integrierter Replikationsdienst mit Master-Standby-Erkennung.
* Synchronisations-API (`/api/sync/push`, `/api/sync/pull`, `/api/sync/heartbeat`).
* Automatischer Rollenwechsel bei Ausfall des Primärservers.

### Phase 4: Stammdaten, Preislisten- & Raumverwaltung (Admin-UI)
* **Preisliste & Produkte:** Kacheln, Varianten, Optionen-Baukasten, Sonderwunsch-Matrix, Drag & Drop.
* **Tischplan-Designer:** Visueller Raster-Editor mit Gängen, Theken, Tisch-Generator und Tischmarken-Druck.
* **Drucker- & Ausdruckgruppen:** Netzwerk-Suchfunktion, manuelle IP-Konfiguration, Zuweisungs-Matrix.

### Phase 5: Live-Geräteverwaltung & Verbindungs-Dashboard (NEU)
* `src/app/admin/devices/page.tsx`:
  * **Live-Status aller verbundenen Geräte:**
    * Gerätename & angemeldete Person (z. B. "iPhone von Lisa", "Thekenkasse 1", "iPad Küche").
    * Zugewiesene Rolle (*Admin, Bedienung, Bonkasse, Küchenmonitor*).
    * Verbindungs-Status (*Grün = Live Online, Gelb = Inaktiv > 2 Min, Rot = Getrennt/Offline*).
    * **Online-Dauer (Uptime):** Zeigt genau an, seit wann das Gerät in der Schicht aktiv ist (z. B. "Aktiv seit 3h 12m").
    * **Letzte Aktivität:** Sekundengenauer Heartbeat ("vor 2 Sekunden").
    * **IP-Adresse & Netzwerk-Info:** Lokale IP im WLAN (z. B. `192.168.1.142`) + Betriebssystem/Browser.
    * **Akkustand & Lade-Erkennung (Battery Status API):** Anzeige von Akkustand in % (z. B. `🔋 24%` mit Warnfarbe Gelb/Rot bei <20%, `⚡ Lädt`), damit der Schichtleiter frühzeitig Powerbanks bereitstellen kann.
    * **Schicht-Umsatz pro Gerät:** Anzeige getätigter Bestellungen & Umsatz des Geräts.
  * **Admin-Aktionen pro Gerät:**
    * **Geräte-Suchton (Find My Device):** Löst einen akustischen Klingelton/Piepen auf dem Kellner-Smartphone aus, um verlegte Geräte im Festzelt sofort wiederzufinden.
    * **Direktnachricht:** Schneller 1:1 Chat mit diesem Gerät.
    * **Rolle wechseln / Zuweisen:** Schnelles Umstellen der Berechtigung.
    * **Sitzung beenden (Force Logout / Kick):** Trennt das Gerät vom Server.

### Phase 6: Bestellaufnahme-Modus (Kellner / Mobile Web-PWA)
* Responsive Mobile-First Benutzeroberfläche mit Touch-Gesten und Vibrationsfeedback.
* Tisch-Auswahl mit visueller Statusanzeige (Frei = Grau, Offen/Bestellt = Orange mit Betrag).
* High-Speed Bestellmaske mit Mengen-Zähler (`+` / `-`) und direktem Sonderwunsch-Popup.
* Sofortiges Abschicken mit automatischer Aufteilung an Küche und Theke.
* Eigene Bestellhistorie mit Druckstatus-Ampel (Grün = gedruckt, Rot = Fehler).

### Phase 7: Kassieren, Rechnungs-Splitting & Zahlungen
* Detailansicht aller offenen Posten eines Tisches.
* **Rechnungs-Splitting:** Antippen einzelner Artikel für getrennte Abrechnung.
* **Pfand-Verrechnung:** Rückpfand-Gutschrift direkt von der Rechnung abziehen.
* **Rückgeld- & Trinkgeldrechner:** Schnelleingabe des gegebenen Betrags.
* **Zahlungsarten:** Barzahlung, Kartenzahlung (SumUp / Terminal / SPOS), Rabatt, Nicht bezahlt (Bewirtung/Personal mit Grund).
* Zahlungsstornierung mit Audit-Log.

### Phase 8: Bonkassen-Modus (Thekenverkauf & Schnellkasse)
* Schnellkassiermaske ohne Tischauswahl.
* Drei Betriebsmodi:
  1. *Nur Kassieren* (kein Druck).
  2. *Gutscheinbon für Gast* (zum Abholen an Ausgabestation).
  3. *Gutschein + Stations-Gegenbon* mit übereinstimmender Abholnummer.
* Automatisches Öffnen der Kassenlade.

### Phase 9: Küchenmonitor (KDS – Kitchen Display System)
* Live-Spaltenansicht offener Bestellungen auf Tablets oder Großbildschirmen.
* Modi: *Tische gruppieren* vs. *FIFO-Reihenfolge*.
* Farbige Zeiterfassung und Dringlichkeits-Ampel.
* Einzelposten abhaken und Bestellung als „Fertig“ markieren (mit optionalem Fertigstellungs-Bondruck).
* Rückstands-Zusammenfassung (z. B. „Aktuell offen: 18x Pommes, 12x Steak“).
* Akustischer Signalton (Web Audio API) bei neuen Bestellungen.

### Phase 10: Lagerverwaltung, Interner Chat & Übungsmodus
* **Lagerbestand:** Live-Verbrauchsberechnung und automatischer Bestellstopp bei Ausverkauf.
* **Chat & Broadcast:** 1:1 Direktnachrichten und Notfall-Sammelankündigungen an alle Bedienungen.
* **Übungsmodus (Trainingsmodus):** Gefahrloses Testen und Schulen neuer Helfer ohne Bondruck und ohne Umsatzverfälschung.

### Phase 11: Berichte, Abrechnungen & Datenexport
* Kellner-Schichtabrechnung (Z-Bon pro Kellner: Bargeld, Karte, Trinkgeld, offene Tische).
* Gesamtabrechnung & Tagesabschluss der Veranstaltung.
* Renner-/Penner-Statistik verkaufter Artikel.
* CSV- & Excel-Export aller Geschäftsvorfälle.
* Komplett-Backup der Veranstaltung (Export/Import als JSON).

### Phase 12: GitHub-Veröffentlichung, Setup-Skripte & Dokumentation
* Erstellung der vollständigen Dokumentationsdateien in `/docs`.
* Erstellung der 1-Klick-Starter `.bat` und `.sh` Skripte für einfache Inbetriebnahme.
* Ausführliches `README.md` mit Schnellstart-Anleitung und Architekturübersicht.
* Git Repository Initialisierung und sauberer Commit-Aufbau.

---

## 5. Massive, praxisnahe Test-Suite & Iterativer Fehlerbehebungs-Zyklus

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          PRAXISNAHE TEST-MATRIX (9 TESTKATALOGE)                       │
├────────────────────────────┬────────────────────────────┬──────────────────────────────┤
│ 1. Bestell- & Splitting    │ 2. Kassieren & Pfand       │ 3. Drucker-Stresstests       │
│    (Sonderwünsche, Multi)  │    (Splits, Cash/Card, Tip)│    (Offline, Retry, Reroute) │
├────────────────────────────┼────────────────────────────┼──────────────────────────────┤
│ 4. Theken- & Bonkasse      │ 5. Küchenmonitor (KDS)     │ 6. Lager-Ausverkauf          │
│    (Gutschein/Gegenbon)    │    (FIFO, Live-Rückstand)  │    (Live-Sperre & Restock)   │
├────────────────────────────┼────────────────────────────┼──────────────────────────────┤
│ 7. Hochverfügbarkeit (HA)  │ 8. Offline & PWA           │ 9. Geräteverwaltung & Status │
│    (Failover unter Last)   │    (WLAN-Loch & Reconnect) │    (Akku, Uptime, Suchton)   │
└────────────────────────────┴────────────────────────────┴──────────────────────────────┘
```

### Testkatalog 1: Reale Bestell-Szenarien & Sonderwünsche
* Großbestellungs-Split (12x Bier, 6x Schnitzel, 4x Pommes -> automatische Aufteilung).
* Mehrdimensionale Sonderwunsch-Kombination (*ohne Zwiebeln + extra Soße*).
* Produktvarianten & Baukasten-Optionen mit Aufpreisen.
* Gleichzeitiger Tischzugriff ohne Race Conditions.

### Testkatalog 2: Komplexe Abrechnungen, Rechnungs-Splits & Pfand
* 10-Personen-Tisch mit getrennter Zahlung (Bar mit Rückgeldrechner, Pfandrückgabe mit Auszahlung, Kartenzahlung).
* Stornierung mit Audit-Log und Korrektur des Küchenmonitors.
* Bewirtung & Personalverpflegungs-Buchung mit Pflichtgrund.

### Testkatalog 3: Drucker-Fehlerzustände, Rerouting & ESC/POS
* Papierstau / Rollenende mitten im Auftrag -> automatischer Nachdruck ohne Duplikate nach Rollenwechsel.
* 1-Klick Rerouting auf Ersatzdrucker bei Hardware-Ausfall.
* Vollständiger CP858-Umlaute-Check (`äöüÄÖÜß€`).
* Kassenladen-Öffnungsimpuls (`ESC p 0 25 250`).

### Testkatalog 4: Bonkassen-Expressverkauf (Theke)
* Sekundenschneller Wertmarkenverkauf mit fortlaufender Bon-ID.
* Synchroner Doppelbon (Gastbon + Grill-Gegenbon mit identischer Abholnummer `#101`).

### Testkatalog 5: Küchenmonitor (KDS) unter Volllast
* 30 offene Bons mit FIFO- und Tischsortierung.
* Dringlichkeits-Farbampel (Gelb nach 5 Min, Rot nach 10 Min).
* Live-Rückstandsanzeige (*„Noch 18x Pommes, 12x Steak offen“*) und Web-Audio Signalton.

### Testkatalog 6: Lagerbestand & Ausverkaufsschutz
* Automatischer Verkaufsstopp bei Bestand 0 (Kachel wird sofort rot/ausgegraut).
* Live-Nachstockung im laufenden Festbetrieb schaltet Buttons in <500ms wieder frei.

### Testkatalog 7: Hochverfügbarkeit (HA), Stromausfall & Split-Brain
* Harter Primärserver-Absturz während aktiver Buchung -> Standby übernimmt in <3 Sekunden ohne Datenverlust.
* Reconnect & Auto-Resync bei Neustart des Primärservers.

### Testkatalog 8: WLAN-Verbindungsabbrüche & Offline-PWA
* Kellner im Funkloch (Biergarten/Keller) -> automatische Pufferung und Übertragung beim Wiederverbinden.
* Trainingsmodus-Sicherheitscheck (kein realer Bon, keine Beeinflussung des Z-Bons).

### Testkatalog 9: Live Geräteverwaltung, Akkustand & Heartbeat-Monitoring (NEU)
1. **Multi-Geräte Live-Tracking:**
   * *Szenario:* 6 verschiedene Testgeräte melden sich an (Smartphones, Tablets, Küchenbildschirm).
   * *Prüfung:* Das Admin-Dashboard zeigt für alle 6 Geräte korrekt Name, IP, Rolle, Uptime und sekundengenauen Heartbeat an.
2. **Live-Akkustandswarnung (Low Battery Alert):**
   * *Szenario:* Smartphone erreicht < 20 % Akkustand.
   * *Prüfung:* Die Batterie-Anzeige im Dashboard wechselt auf Rot, sodass der Schichtleiter sofort informiert ist.
3. **Geräte-Suchton (Find My Device):**
   * *Szenario:* Ein Kellner hat sein Smartphone im Festzelt verlegt. Admin drückt im Dashboard auf "Gerät anpingen".
   * *Prüfung:* Das Smartphone spielt einen lauten Signalton ab und vibriert.
4. **Sitzung trennen (Force Logout):**
   * *Szenario:* Admin beendet die Sitzung eines Geräts.
   * *Prüfung:* Das Zielgerät wird sofort auf den Login-Bildschirm zurückgesetzt.

---

## 6. Iterativer Fehlerbehebungs-Prozess (Zero-Bug-Policy)

Wenn während der 9 Testkataloge ein Fehler auftritt:
1. **Fehler-Isolation:** Exakte Protokollierung (Screenshots, Logs, Request-Payloads).
2. **Direkte Behebung:** Korrektur im Backend, Frontend oder in der State-Machine.
3. **Regressionstest:** Automatisierter Testlauf der gesamten Suite zur Sicherung bestehender Funktionen.
4. **Validierungs-Bestätigung:** Wiederholung des Praxis-Szenarios bis zum fehlerfreien Durchlauf.

---

## 7. Verifizierungs-Checkliste vor GitHub-Freigabe

- [ ] Alle 9 praxisnahen Testkataloge erfolgreich absolviert.
- [ ] Live-Geräteverwaltung zeigt Uptime, Status, IP und Akkustand korrekt an.
- [ ] Geräte-Suchton und Fernabmeldung funktionieren einwandfrei.
- [ ] TypeScript- und Linting-Build fehlerfrei (`npm run build`).
- [ ] PWA-Funktionalität auf iOS Safari und Android Chrome verifiziert.
- [ ] Standby-Echtzeitreplikation mit Failover < 3s verifiziert.
- [ ] ESC/POS Druckausgabe mit deutschem Zeichensatz (CP858) geprüft.
- [ ] Vollständige Markdown-Dokumentation in `/docs` und `README.md` fertiggestellt.
- [ ] 1-Klick-Starter `.bat` und `.sh` Skripte getestet.
