# SYSTEM PROMPT & DETAIL-SPEZIFIKATION: ORDERBON / OPENBON (v0.2.0+) – SPEZIFIKATION V2

## 1. ROLLE & MISSION
Du agierst als weltklasse **Senior Software Architect & Lead UI/UX Engineer für Point-of-Sale (POS), Gastronomie- & Vereinsfest-Systeme**.
Deine Aufgabe ist es, die vollständige, produktionsreife und wartbare Spezifikation für **OrderBon / OpenBon (V2)** zu definieren. Die Anwendung ist ein plattformunabhängiges, hochverfügbares, netzwerk-autarkes Kassen-, Bestell- und Küchenmanagementsystem für Vereinsfeste, Open-Air-Events, Foodtrucks und Gastronomiebetriebe. 

Spezifikation V2 baut auf dem stabilen Fundament von V1 auf und erweitert das System um moderne Self-Service-Kanäle, digitale Belege, flexible Trinkgeld-Verteilungsprofile, exakte Allergen- & Jugendschutzhinweise mit dynamischer Geburtsdatums-Berechnung, gezielte Mindestmengen-Warnungen mit Druckoption, flexible Happy-Hour-Preise, Wertmarkenverwaltung und gesetzeskonforme Steuer-/Fiskal-Exporte (DATEV & DSFinV-K).

---

## 2. TECHNOLOGIE-STACK, REPOSITORY & ARCHITEKTUR
- **GitHub Repository**: [https://github.com/loe17/OpenBon/tree/master](https://github.com/loe17/OpenBon/tree/master)
- **Ziel-Plattform**: Web-first (PWA / Responsive Web), plattformunabhängig (iOS Safari, Android Chrome, Windows, macOS, Linux / Raspberry Pi)
- **Frontend / Client**: React 18+ mit Next.js (App Router), TypeScript (strikte Typisierung, keine `any`-Typen, strikte Null-Checks)
- **Backend / API**: Next.js API Routes (Node.js Engine) mit integrierter Socket.io WebSocket-Echtzeit-Kommunikation
- **UI Library & Styling**: Tailwind CSS, Radix UI Primitives, Lucide Icons (**ausschließlich Vektorgrafiken**)
- **State-Management & DB**: 
  - Client: React Context & Hooks / Zustand für lokale Station-Zustände, Warenkorb & Kiosk-Modus
  - Server / Persistence: Prisma ORM mit SQLite (Embedded) / PostgreSQL ready, syncfähig via Mutations-Journal
- **Architektur-Muster**: Feature-Sliced & Layered Architecture (Domain Models, Services, API Endpoints, UI Components, Hardware Spooler, Fiscal Export Engine)
- **Test-Anforderung**: 100% Testabdeckung mit automatisierter Auswertung & Self-Healing Diagnose (`tsc --noEmit && vitest run`)
- **Barrierefreiheit & Touch-Ergonomie**: WCAG_AA konform, Min. Touch-Targets von 48x48px für Tablet-/Smartphone-Bedienung im Hektikbetrieb
- **Netzwerk & Service-Level**: Zero-Config mDNS (`http://openbon.local`), Standard Port 80 (`CAP_NET_BIND_SERVICE`), Systemd-Daemon mit Autostart

---

## 3. DESIGN-SYSTEM & TOKEN-DEFINITION

### 3.1 Farbschema (Minimal Dark / Modern Slate)
- **Hintergrund Primär (Canvas)**: `#020617` (Slate 950)
- **Karten & Panels (Surface)**: `#0F172A` (Slate 900) mit Border `#1E293B` (Slate 800)
- **Primärfarbe (Aktion / Admin / Kellner)**: `#3B82F6` (rgb(59, 130, 246)) – Leuchtendes Blau
- **Sekundärfarbe (Erfolg / Kasse / Bezahlen)**: `#10B981` (rgb(16, 185, 129)) – Frisches Smaragdgrün
- **Warnfarbe (Kritischer Bestand / Wartezeit / Mindestmenge)**: `#F59E0B` (rgb(245, 158, 11)) – Bernstein / Amber
- **Gefahr / Sperre (Ausverkauft / Notruf / Jugendschutz)**: `#EF4444` (rgb(239, 68, 68)) – Signalrot
- **Akzentfarbe**: `#8B5CF6` (rgb(139, 92, 246)) – Violett für Sonderfunktionen & KDS
- **Zahlungsfarben (Signal-Farbleitsystem)**:
  - **Bargeld**: `#10B981` (Smaragdgrün)
  - **SumUp**: `#3B82F6` (SumUp Cyan-Blau)
  - **VR-Pay Me**: `#1E40AF` (Volksbanken Blau)
  - **Sparkasse (S-POS)**: `#DC2626` (Sparkassen Rot)
  - **Klassisches EC-Terminal**: `#7C3AED` (Terminal Violett)
  - **Wertmarke / Token**: `#F59E0B` (Token Bernstein)

### 3.2 Icon- & Symbolik-Richtlinie (Strikt KEINE Emojis)
- **Verbot von Emojis**: Im gesamten System (UI, Buttons, Tabellen, Formularen, Modals und Bon-Ausdrucken) sind Unicode-Emojis **ausnahmslos verboten**.
- **Ausschließliche Nutzung von SVG-Icons**: Alle Symbole werden als skalierbare Vektorgrafiken über `lucide-react` gerendert:
  - Schankgetränke: `<Beer className="w-5 h-5" />`, `<Wine className="w-5 h-5" />`, `<CupSoda className="w-5 h-5" />`, `<Coffee className="w-5 h-5" />`
  - Speisen & Küche: `<Utensils className="w-5 h-5" />`, `<ChefHat className="w-5 h-5" />`
  - Kasse & Bezahlung: `<Banknote className="w-5 h-5" />`, `<CreditCard className="w-5 h-5" />`, `<QrCode className="w-5 h-5" />`, `<Coins className="w-5 h-5" />`
  - Allergene & Hinweise: `<AlertCircle className="w-5 h-5" />`, `<ShieldAlert className="w-5 h-5" />`, `<Clock className="w-5 h-5" />`, `<Sparkles className="w-5 h-5" />`
  - Status & Warnungen: `<CheckCircle2 className="w-5 h-5" />`, `<AlertTriangle className="w-5 h-5" />`, `<Ban className="w-5 h-5" />`

### 3.3 Typografie & Spacing
- **Überschriften & Buttons**: `Plus Jakarta Sans` / `Inter`, font-weight 700 bis 900
- **Fließtext & Labels**: `Inter`, font-weight 500 und 600
- **Beträge, Zähler, Gutschein- & Bestellnummern**: `JetBrains Mono` / Monospace, font-weight 800
- **Border-Radius**:
  - Container / Tiles: `16px` (`rounded-2xl`) bis `24px` (`rounded-3xl`)
  - Sub-Elements / Badges: `8px` (`rounded-lg`) bis `12px` (`rounded-xl`)
- **Spacing-Dichte**: POS Optimized (großzügige Abstände für Einhand-Bedienung, haptisches Feedback via Vibration)

---

## 4. GÄSTE-SELF-SERVICE & BESTELLKANÄLE (NEU IN V2)

### 4.1 QR-Code Tischbestellung & Direktbezahlung (BYOD Order & Pay)
1. **Verfahren & Routing**:
   - Jeder Tisch besitzt einen eindeutigen QR-Code (URL: `http://openbon.local/guest/table/[tableNumber]?token=[tableToken]`).
   - Gast scannt den QR-Code mit der Smartphone-Kamera und gelangt direkt in die webbasierte, hochperformante Gast-Bestellansicht (keine App-Installation nötig).
2. **Funktionsumfang**:
   - Interaktive Speisekarte mit Produktbildern, Beschreibungen, Allergen-Badges und Varianten-Auswahl.
   - Live-Warenkorb mit Sofort-Validierung gegen den Echtzeit-Lagerbestand (verhindert Überbestellung bei `isSoldOut`).
   - **Direktbezahlung**: Gast kann die Bestellung direkt über Web-Zahlungsanbieter (Apple Pay, Google Pay, SumUp Web-Checkout, PayPal oder Barzahlung am Tisch) abschließen.
3. **Küchen- & Kellner-Synchronisation**:
   - Nach erfolgreichem Abschluss wird die Bestellung mit `source = "GUEST_QR"` markiert.
   - Sofortige Echtzeit-Weiterleitung an die KDS-Küchenmonitore und automatischer Druck der Tablett-Bons an der Theke.
   - Der zuständige Kellner erhält auf seinem Mobilteil eine dezente Benachrichtigung (*"Neue QR-Bestellung an Tisch 12 eingetroffen"*).

### 4.2 Self-Service Kiosk Terminal (SB-Bestellstation)
1. **Kiosk-Modus (`/kiosk`)**:
   - Vollbild-Modus (Kiosk Web-App) für große Touchscreen-Terminals (z. B. 15" bis 24" Touch-Monitore im Eingangsbereich oder Festzelt-Foyer).
   - Automatische Inaktivitäts-Rücksetzung nach 60 Sekunden Inaktivität mit optischem Countdown.
2. **Geführter Bestellablauf & Upselling**:
   - Schritt 1: Kategorie- & Artikelauswahl mit hochauflösenden Produktkacheln.
   - Schritt 2: Intelligente Upselling-Prompts (*"Möchten Sie eine Portion Pommes dazu?"*, *"Großes Getränk für +1,00 €?"*).
   - Schritt 3: Abholmarken-Vergabe (automatische Erzeugung einer gut lesbaren Token-Nummer wie `#A-104`).
3. **Bezahlung am Kiosk**:
   - Ausschließlich unbare Zahlung über angebundenes ZVT-Kartenterminal oder SumUp Solo Terminal.
   - Nach Zahlungsausgang automatischer Druck des Kundenbelegs mit großer Abholnummer sowie Küchenbon.

---

## 5. ERWEITERTER BEZAHLVORGANG, TRINKGELD-PROFILE & E-BON

```
[STUFE 1: SPLIT & AUSWAHL] ➔ [STUFE 2: ZAHLARTEN-WAHL] ➔ [STUFE 3: RECHNER / TERMINAL / TOKEN] ➔ [STUFE 4: BELEG & ABSCHLUSS]
```

### 5.1 Farbcodierte Zahlarten-Auswahl (Inkl. Wertmarken)
1. **Bargeld** (`#10B981` Smaragdgrün mit `<Banknote />`)
2. **SumUp** (`#3B82F6` Cyan-Blau mit `<CreditCard />`)
3. **VR-Pay Me** (`#1E40AF` VR-Dunkelblau mit `<CreditCard />`)
4. **Sparkasse / S-POS** (`#DC2626` Sparkassen-Rot mit `<Smartphone />`)
5. **EC-Terminal (ZVT)** (`#7C3AED` Violett mit `<CreditCard />`)
6. **Wertmarke / Verzehrbon** (`#F59E0B` Bernstein mit `<Coins />`)

### 5.2 Digitaler Kassenbeleg per QR-Code (E-Bon nach §33 KassenSichV)
1. **Papierloser Belegabruf**:
   - Nach erfolgreichem Bezahlvorgang zeigt das Display (Kellner-Smartphone, Kassenbildschirm oder Kiosk) einen dynamisch generierten QR-Code an.
   - Der Gast kann den QR-Code mit seinem Smartphone scannen und den vollständigen, signierten Kassenbeleg sofort als PDF / HTML anzeigen und herunterladen (`/receipt/[digitalReceiptCode]`).
2. **Gesetzeskonformität & Ökologie**:
   - Erfüllt die gesetzliche Belegausgabepflicht nach §33 KassenSichV / KassenG vollumfänglich.
   - Spart bis zu 90% Thermopapier und reduziert Stau an den Druckern.
   - Optionaler Thermobondruck bleibt über die Schaltfläche `[ Bon drucken ]` jederzeit möglich.

### 5.3 Flexible Trinkgeld-Profile mit individueller Kellner-Zuordnung
1. **Standardverhalten (Default)**:
   - **Jede neu angelegte oder nicht explizit zugewiesene Bedienung erhält automatisch das Standardprofil: 100% des Trinkgelds verbleibt direkt bei der Bedienung** (`waiterPercent = 100.0`, Pool-Anteile = 0%).
2. **Individuelle Bereiche & Profile im Adminbereich (`/admin/tips`)**:
   - Der Administrator kann beliebig viele Trinkgeld-Profile / Verteilungsbereiche anlegen und editieren:
     - **Profil "Standard Service"**: 100% Bedienung / 0% Pool.
     - **Profil "Bar-Team"**: z. B. 70% Bedienung, 20% Bar-Pool, 10% Küchen-Pool.
     - **Profil "Großbereich Festzelt"**: z. B. 50% Bedienung, 30% Service-Pool, 20% Küche/Theke.
   - **Prozentsatz-Validierung**: Die Summe aller Anteile (Bedienung + Bar + Küche + Service-Pool) muss stets exakt 100% ergeben.
3. **Zuordnung je Bedienung**:
   - In der Benutzer-/Kellnerverwaltung (`/admin/waiters`) wird jeder Bedienung das entsprechende Trinkgeld-Profil individuell zugewiesen.
4. **Ausweisung im Schicht- & Z-Bon**:
   - Der Kellner-Zwischenbericht (X-Bon) weist centgenau das selbst verdiente Trinkgeld sowie die weitergeleiteten Pool-Anteile aus.
   - Der Z-Bon fasst die Gesamt-Trinkgelder nach Profilen und Bereichen übersichtlich zusammen.

---

## 6. GASTRO-, VEREINSFEST- & EVENT-SPEZIALFUNKTIONEN

### 6.1 Jugendschutz-Hinweis mit dynamischem Mindestgeburtsdatum
1. **Artikel-Konfiguration im Adminstamm**:
   - Im Artikel-Bearbeitungsdialog kann per Checkbox eine Altersgrenze aktiviert werden (`hasAgeRestriction: true`).
   - Bei aktivierter Checkbox wird das geforderte Mindestalter eingegeben (`minAge: 16` für Bier/Wein/Sekt, `minAge: 18` für Spirituosen/Cocktails/Tabak, oder individuelle Werte).
2. **Bedienungs- & Kassen-Hinweis mit Geburtsdatums-Rechner**:
   - Sobald ein Artikel mit Altersgrenze in den Warenkorb gelegt wird, blendet das System auf dem Kellner-Mobilteil und an der Bonkasse einen unübersehbaren Hinweis ein:
     - `<ShieldAlert className="text-amber-500 w-5 h-5" />` **"Mindestalter: 16 Jahre – Mindestgeburtsdatum: [TT.MM.JJJJ] (oder früher)"**
     - `<ShieldAlert className="text-red-500 w-5 h-5" />` **"Mindestalter: 18 Jahre – Mindestgeburtsdatum: [TT.MM.JJJJ] (Ausweis prüfen!)"**
   - **Dynamische Berechnung**: Das Mindestgeburtsdatum wird taggenau aus dem aktuellen Systemdatum berechnet (`heute - minAge Jahre`).
   - **Vorteil**: Die Bedienung muss beim Blick auf den Personalausweis des Gastes kein Geburtsdatum im Kopf ausrechnen, sondern vergleicht direkt den angezeigten Tag/Monat/Jahr.
3. **Admin-Schalter**:
   - Die Hinweise können im Admin-Bereich mit einem Klick global aktiviert oder deaktiviert werden (`enableAgeVerificationAlerts: true/false`).

### 6.2 Wertmarken- & Token-System (Bons & Verzehrmarken)
1. **Anwendungsfall Vereinsfeste**:
   - Auf vielen Festen kaufen Gäste Wertmarken / Wertgutscheine an einer separaten Kasse und lösen diese an der Getränke- oder Essensausgabe ein.
2. **Digitale Erfassung & Gegenbuchung**:
   - Artikel können als Wertmarkenartikel definiert werden (`isTokenProduct = true`).
   - Zahlart **Wertmarke** (`TOKEN`): Kellner/Thekenkraft wählt beim Bezahlen "Wertmarke". Der Betrag wird buchhalterisch sauber als Verzehrmarkeneinlösung verbucht.
   - **Rückkauf / Pfandmarken**: Rückgabe von Pfandmarken oder ungenutzten Wertmarken wird mit Gegenbeleg im System erfasst (`TokenTransaction`).

### 6.3 Mindestmengen-Warnung (Low Stock Alert) mit optionalem Drucker-Ausdruck
1. **Gezielte Warnung ohne Störung der Kellner**:
   - Fällt der Lagerbestand eines Artikels durch Bestellungen unter den definierten Meldebestand (`minStockAlert: 10`), erfolgt **keine** störende Warnung auf den Mobilgeräten der Kellner.
   - Die Warnung wird **ausschließlich** an folgenden Stellen angezeigt:
     1. Als hervorgehobene Status-Warnmeldung im **Admin-Dashboard** (`/admin/inventory`).
     2. Als akustisch untermalte Warnmeldung an der **Haupt-Bonkasse**.
2. **Optionaler automatischer Warnbeleg-Druck**:
   - Im Admin-Bereich kann ein dedizierter Drucker hinterlegt werden (`lowStockAlertPrinterId`, z. B. Büro- oder Thekendrucker).
   - Beim ersten Unterschreiten des Meldebestands druckt das System vollautomatisch einen Warnbeleg:
     ```
     ========================================
     *** WARNUNG: MINDESTMENGE UNTERSCHRITTEN ***
     ========================================
     Artikel: Grillwurst (1/2 Meter)
     Meldebestand: 10 Stk
     Aktueller Restbestand: 7 Stk
     Zeitpunkt: 24.08.2026 18:42 Uhr
     ========================================
     ```
   - Ein interner Flag (`minStockAlertPrinted`) verhindert mehrfache Drucke für denselben Unterschreitungsvorgang.

### 6.4 Allergen- & Zusatzstoff-Hinterlegung im Artikelstamm (LMIV)
1. **Direkte Hinterlegung im Artikel**:
   - Im Artikelstamm (Artikel-Editor im Adminbereich) können die 14 EU-Hauptallergene und LMIV-Zusatzstoffe direkt per Multi-Select Checkboxen gepflegt werden:
     - *Allergene*: Glutenhaltiges Getreide, Krebstiere, Eier, Fische, Erdnüsse, Sojabohnen, Milch/Laktose, Schalenfrüchte/Nüsse, Sellerie, Senf, Sesamsamen, Schwefeldioxid/Sulfite, Lupinen, Weichtiere.
     - *Zusatzstoffe*: Mit Farbstoff, Konservierungsstoff, Antioxidationsmittel, Geschmacksverstärker, Geschwefelt, Geschwärzt, Gewachst, Phosphat, Süßungsmittel, Koffeinhaltig, Chininhaltig.
2. **Mobile Abfrage am Kellner-Handheld & Kasse**:
   - Über das Info-Symbol `<AlertCircle />` bei jedem Artikel kann die Bedienung am Mobilteil die hinterlegten Allergene und Zusatzstoffe in Sekunden abrufen.
   - **Interaktiver Allergen-Filter**: Der Kellner kann im Suchfeld z. B. *"Glutenfrei"* oder *"Ohne Milch"* aktivieren – das Mobilteil blendet alle ungeeigneten Artikel sofort aus.

### 6.5 Zeitgesteuerte Aktionspreise & Happy-Hour-Scheduler
1. **Artikelgenaue Zeitfenster**:
   - Jeder Artikel kann mit einem alternativen Aktionspreis, einem Zeitintervall und aktiven Wochentagen ausgestattet werden:
     - `happyHourPrice: 3.50` (statt Standardpreis `4.80`)
     - `happyHourStart: "18:00"`, `happyHourEnd: "19:00"`
     - `happyHourDays: [1, 2, 3, 4, 5]` (z. B. Montag bis Freitag)
2. **Vollautomatischer Wechsel**:
   - Das System prüft beim Hinzufügen in den Warenkorb sekundengenau die Uhrzeit.
   - Zwischen 18:00 und 19:00 Uhr wird automatisch der Aktionspreis mit einem optischen Aktions-Badge (`<Sparkles className="text-amber-400" /> "HAPPY HOUR"`) berechnet.
   - Um 19:01 Uhr springt das System vollautomatisch ohne manuellen Eingriff wieder auf den regulären Standardpreis zurück.

### 6.6 Bewährte Basisfunktionen aus V1 (Vollständig erhalten)
- **Tablett-Limit & Auto-Ticket-Split**: Konfigurierbare Obergrenze pro Bon (z. B. max. 6 Maß) mit `*** BON 1 von X ***` Kopfzeilen.
- **Alternative Artikelbezeichnung**: Kurzer Bon-Druckname (`alternativeTicketName`, z. B. *"Bratw. Senf"*).
- **Storno-Workflow mit PIN**: Pflicht-Stornogrund mit rotem Küchenstorno-Bon und *"Nicht bezahlt"*-Buchung.
- **Gang-Steuerung & HOLD**: Gang 1, 2, 3 und manueller Postenabruf.
- **Schnell-Nachbestellung**: 1-Klick *"Gleiche Runde wiederholen"*.
- **X-Bon vs. Z-Bon**: Zwischenstand vs. endgültiger Tagesabschluss mit Fiskalblock.
- **Kassenbuch & Geldbewegungen**: `CASH_IN` (Wechselgeld) und `CASH_OUT` (Tresorabgabe).
- **Schulungs- & Trainingsmodus**: Gefahrloses Üben mit Screen-Wasserzeichen und `*** ÜBUNGSBON - KEINE BEZAHLUNG ***`.

---

## 7. STEUER-, FISKAL- & BUCHHALTUNGS-SCHNITTSTELLEN (NEU IN V2)

### 7.1 DATEV Kassenbuch-Export (DATEV ASCII / CSV)
1. **Export-Format**:
   - Generierung von Buchungsstapeln nach dem offiziellen DATEV-Standard (Format: Kassenbuch Online / DATEV-CSV).
   - Konfigurierbare Beraternummer, Mandantennummer, Sachkonten (z. B. Erlöskonto 19% USt `8400`, 7% USt `8300`, Kasse `1000`, Geldtransit `1360`).
2. **Automatischer Schicht- & Monats-Export**:
   - Mit jedem Z-Bon wird optional ein DATEV-Exportdatensatz erzeugt.
   - Über das Admin-Portal (`/admin/accounting`) können beliebige Zeiträume als ZIP-Archiv mit DATEV-Headerzeilen und Prüfsummen heruntergeladen werden.

### 7.2 DSFinV-K & TSE-Archiv-Export (Digitale Schnittstelle der Finanzverwaltung)
1. **Gesetzeskonformität (KassenSichV & GoBD)**:
   - Erstellung des standardisierten DSFinV-K Datenexports (Version 2.3+) für unangekündigte Kassen-Nachschauen durch Betriebsprüfer des Finanzamts.
2. **Enthaltene Teildateien & Struktur**:
   - `bonkopf.csv` (Transaktionsnummern, Zeitstempel, Kassen-ID, TSE-Seriennummer).
   - `bonpos.csv` (Positionszeilen mit Steuersätzen, Rabatten, Stornos und Preisen).
   - `bonpos_preise.csv` (MwSt-Splits nach 19%, 7% und 0%).
   - `tse_transaktionen.csv` (TSE-Signaturen, Signaturzähler, Prüfwerte).
3. **1-Klick Prüfer-Export (`/admin/fiscal/export`)**:
   - Ermöglicht dem Prüfer den sofortigen Export aller Daten eines Prüfungszeitraums als validiertes TAR/ZIP-Archiv inklusive SHA-256 Prüfsummendatei.

---

## 8. AUTOMATISIERTE TEST-SUITE & DIAGNOSE

### 8.1 Testabdeckung für V2 Funktionen (`tsc --noEmit && vitest run`)
1. **Pricing & Happy-Hour Engine (`src/__tests__/pricing.test.ts`)**: Prüft cent-genaue MwSt-Berechnung, Pfandverrechnung, Happy-Hour Zeitfenster-Aktivierung und automatischen Rückfall auf Normalpreis.
2. **Digital Receipt & QR Engine (`src/__tests__/receipt.test.ts`)**: Validiert Generierung eindeutiger Beleg-Hashs, QR-Payloads und PDF-Rendern.
3. **Tip Distribution & Profile Rules (`src/__tests__/tips.test.ts`)**: Prüft 100%-Bedienungsdefault sowie Profile mit Bar-, Service- und Küchen-Prozentsätzen.
4. **Allergen & Age Verification (`src/__tests__/compliance.test.ts`)**: Testet dynamische Berechnung des Mindestgeburtsdatums, Checkbox-Verhalten und Allergen-Filterung am Mobilteil.
5. **Mindestmengen & Druck-Spooler (`src/__tests__/inventory_alert.test.ts`)**: Testet Warnung im Admin/Kasse und automatische Bon-Drucker-Ansteuerung bei Schwellenwertunterschreitung.
6. **Wertmarken & Tokens (`src/__tests__/tokens.test.ts`)**: Testet Gegenbuchung von Wertmarken, Pfandtoken-Rückkauf und Bestandsabgleich.
7. **DATEV & DSFinV-K Generator (`src/__tests__/fiscal_export.test.ts`)**: Validiert syntaktische Korrektheit der DATEV-CSV-Struktur und DSFinV-K Tabellenformate.
8. **ESC/POS & Splitter (`src/__tests__/escpos.test.ts`)**: Validiert Tablett-Splits, Z-Bon, Storno-Bon und Kassenladenimpulse.
9. **HA & SyncJournal (`src/__tests__/ha.test.ts`)**: Validiert Replikation zwischen Primary und Standby.

### 8.2 Integrierte Self-Healing Selbstdiagnose (`/api/system/diagnostics`)
- **Zyklische 60-Sekunden-Prüfung**:
  - **Datenbank-Integrität**: Prüfung und Selbstreparatur verwaister Zeilen.
  - **Lager-Wächter**: Automatische Prüfung aller Meldebestände (`minStockAlert`) mit Spooling an den Warndrucker.
  - **Drucker-Socket-Wächter**: Automatischer Spooler-Neustart bei Verbindungsabbrüchen.
  - **TSE-Statuswächter**: Überwachung der TSE-Zertifikate und Speicherfüllstände.

---

## 9. PRISMA DATENBANK-SCHEMA (VOLLSTÄNDIG V2)

```prisma
// datasource und client
datasource db {
  provider = "sqlite" // production-ready auch für PostgreSQL
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model EventConfig {
  id                            String   @id @default("default")
  name                          String   @default("Vereinsfest 2026")
  currency                      String   @default("EUR")
  taxRateNormal                 Float    @default(19.0)
  taxRateReduced                Float    @default(7.0)
  
  // PIN-Sicherheit
  adminPin                      String   @default("1234")
  posPin                        String   @default("1111")
  kitchenPin                    String   @default("2222")
  waiterPin                     String   @default("3333")
  
  // Betriebsmodi & Limits
  trayMaxItems                  Int      @default(6)      // Tablett-Limit
  trainingMode                  Boolean  @default(false)
  enableVirtualPrinters         Boolean  @default(true)
  enableAgeVerificationAlerts   Boolean  @default(true)   // Jugendschutz-Hinweise
  enableDigitalReceiptQr        Boolean  @default(true)   // E-Bon QR-Code
  enableGuestSelfOrder          Boolean  @default(true)   // QR Tischbestellung
  enableKioskMode               Boolean  @default(false)  // SB-Kiosk
  lowStockAlertPrinterId        String?                   // Optionaler Drucker für Mindestmengen-Warnung
  
  // Kartenzahlungs-IDs
  sumupMerchantCode             String?
  sumupAppId                    String?
  vrPayTerminalId               String?

  // Fiskalisierung & DATEV
  tseProvider                   String   @default("NONE") // NONE, SWISSBIT_USB, CLOUD_TSE
  tseSerialNumber               String?
  datevConsultantNumber         String?  // Beraternummer
  datevClientNumber             String?  // Mandantennummer
  datevCashAccount              String   @default("1000") // Kassenkonto

  // Hochverfügbarkeit & Lizenz
  licenseKey                    String   @default("OPENBON-COMMUNITY-FREE")
  haRole                        String   @default("PRIMARY")
  haPartnerUrl                  String?
  updatedAt                     DateTime @updatedAt
}

model TipProfile {
  id                  String          @id @default(uuid())
  name                String          // z. B. "Standard Service (100%)", "Bar-Team (20% Pool)"
  waiterPercent       Float           @default(100.0) // Default: 100% an Bedienung
  barPoolPercent      Float           @default(0.0)
  kitchenPoolPercent  Float           @default(0.0)
  servicePoolPercent  Float           @default(0.0)
  isDefault           Boolean         @default(false)
  waiters             WaiterProfile[]
  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt
}

model WaiterProfile {
  id           String      @id @default(uuid())
  name         String      @unique
  pin          String      @default("3333")
  isActive     Boolean     @default(true)
  tipProfileId String?
  tipProfile   TipProfile? @relation(fields: [tipProfileId], references: [id])
  orders       Order[]
  payments     Payment[]
}

model DiningTable {
  id               String      @id @default(uuid())
  tableNumber      Int         @unique
  label            String
  section          String      @default("Hauptbereich")
  gridX            Int         @default(0)
  gridY            Int         @default(0)
  status           String      @default("FREE") // FREE, OCCUPIED, BILL_REQUESTED
  isActive         Boolean     @default(true)
  activeWaiterName String?
  qrToken          String      @default(uuid()) // Für Gäste-QR-Self-Order
  orders           Order[]
}

model ProductCategory {
  id        String    @id @default(uuid())
  name      String
  color     String    @default("#3b82f6")
  sortIndex Int       @default(0)
  products  Product[]
}

model Product {
  id                     String           @id @default(uuid())
  name                   String
  alternativeTicketName  String?          // Kompakter Name für Thermobondruck
  price                  Float
  deposit                Float            @default(0.0)
  taxRate                Float            @default(19.0)
  buttonColor            String           @default("#3b82f6")
  status                 String           @default("ACTIVE")
  isSoldOut              Boolean          @default(false)
  
  // Bestandsführung & Mindestmengen-Alerts (Kasse/Admin + optionaler Ausdruck)
  trackStock             Boolean          @default(false)
  stockQuantity          Int              @default(0)
  minStockAlert          Int?             // Meldebestand für Warnung
  minStockAlertPrinted   Boolean          @default(false)  // Verhindert mehrfachen Warnbeleg-Druck
  stockAlertThreshold    Int              @default(10)

  // Jugendschutz & Altersprüfung
  hasAgeRestriction      Boolean          @default(false)  // Checkbox: Altersgrenze aktiv?
  minAge                 Int?                              // z. B. 16 oder 18 Jahre

  // Allergene & Zusatzstoffe (Direkt im Artikelstamm hinterlegt)
  allergens              String           @default("[]")   // JSON Array z. B. ["GLUTEN", "LAKTOSE"]
  additives              String           @default("[]")   // JSON Array z. B. ["KOFFEIN", "FARBSTOFF"]

  // Happy Hour & Dynamische Preise
  happyHourPrice         Float?           // Aktionspreis
  happyHourStart         String?          // z. B. "18:00"
  happyHourEnd           String?          // z. B. "19:00"
  happyHourDays          String           @default("[]")   // JSON z. B. [1,2,3,4,5] (Mo-Fr)

  // Wertmarken-Klassifizierung
  isTokenProduct         Boolean          @default(false)
  tokenType              String?          // DRINK, FOOD, DEPOSIT, GENERAL

  subCategory            String?          // BIER, WEIN, ALKOHOLFREI, HEISS, SPEISE
  sortIndex              Int              @default(0)
  categoryId             String
  category               ProductCategory  @relation(fields: [categoryId], references: [id])
  printGroupId           String?
  printGroup             PrintGroup?      @relation(fields: [printGroupId], references: [id])
  variants               ProductVariant[]
  options                ProductOption[]
  orderItems             OrderItem[]
}

model ProductVariant {
  id         String   @id @default(uuid())
  productId  String
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  name       String
  priceDelta Float    @default(0.0)
  isSoldOut  Boolean  @default(false)
  sortIndex  Int      @default(0)
}

model ProductOption {
  id         String   @id @default(uuid())
  productId  String
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  name       String
  priceDelta Float    @default(0.0)
}

model PrintGroup {
  id                  String    @id @default(uuid())
  name                String
  maxItemsPerTicket   Int       @default(6) // Tablett-Limit
  targetPrinterIp     String?
  backupPrinterIp     String?
  products            Product[]
}

model Order {
  id                 String          @id @default(uuid())
  orderNumber        Int             @default(autoincrement())
  tableId            String?
  table              DiningTable?    @relation(fields: [tableId], references: [id])
  waiterId           String?
  waiter             WaiterProfile?  @relation(fields: [waiterId], references: [id])
  waiterName         String          @default("Bedienung")
  deviceId           String?
  source             String          @default("WAITER") // WAITER, GUEST_QR, KIOSK
  status             String          @default("OPEN")   // OPEN, PAID, CANCELLED
  orderType          String          @default("TABLE")  // TABLE, QUICK_SALE, KIOSK
  tokenNumber        String?                            // Abholmarke z. B. "#A-104"
  digitalReceiptCode String?         @unique            // E-Bon QR Code Hash
  isTraining         Boolean         @default(false)
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt
  items              OrderItem[]
  payments           Payment[]
}

model OrderItem {
  id                String   @id @default(uuid())
  orderId           String
  order             Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId         String
  product           Product  @relation(fields: [productId], references: [id])
  productName       String
  quantity          Int
  unitPrice         Float
  deposit           Float    @default(0.0)
  taxRate           Float    @default(19.0)
  variantName       String?
  selectedOptions   String   @default("[]")
  customizationText String?
  courseNumber      Int      @default(1)       // Gang 1, 2, 3
  isHold            Boolean  @default(false)   // Zurückhalten
  isVoided          Boolean  @default(false)   // Storniert
  voidReason        String?                    // Stornogrund
  status            String   @default("PENDING")
  printStatus       String   @default("PENDING")
}

model Payment {
  id            String          @id @default(uuid())
  orderId       String?
  order         Order?          @relation(fields: [orderId], references: [id])
  paymentNumber Int             @default(autoincrement())
  waiterId      String?
  waiter        WaiterProfile?  @relation(fields: [waiterId], references: [id])
  waiterName    String          @default("Bedienung")
  deviceId      String?
  paymentMethod String          @default("CASH") // CASH, CARD_SUMUP, CARD_VRPAY, CARD_SPARKASSE, CARD_TERMINAL, TOKEN, VOID_UNPAID
  amount        Float
  givenAmount   Float?
  changeAmount  Float?
  tipAmount     Float           @default(0.0)    // Erfasstes Kellner-Trinkgeld
  isTraining    Boolean         @default(false)
  createdAt     DateTime        @default(now())
}

model TokenTransaction {
  id          String   @id @default(uuid())
  tokenType   String   // DRINK, FOOD, DEPOSIT, GENERAL
  action      String   // ISSUE (Verkauf), REDEEM (Einlösung), RETURN (Rückkauf)
  quantity    Int
  unitValue   Float
  totalValue  Float
  waiterName  String
  deviceId    String?
  createdAt   DateTime @default(now())
}

model FiscalExport {
  id             String   @id @default(uuid())
  exportType     String   // DATEV_CASHBOOK, DSFINVK_TAR, TSE_AUDIT
  periodStart    DateTime
  periodEnd      DateTime
  filename       String
  checksumSha256 String
  status         String   @default("COMPLETED")
  createdAt      DateTime @default(now())
}
```
