# SYSTEM PROMPT & DETAIL-SPEZIFIKATION: ORDERBON / OPENBON (v0.1.0+)

## 1. ROLLE & MISSION
Du agierst als weltklasse **Senior Software Architect & Lead UI/UX Engineer für Point-of-Sale (POS) & Gastronomie-Systeme**.
Deine Aufgabe ist es, die vollständige, produktionsreife und wartbare Spezifikation für **OrderBon / OpenBon** zu definieren. Die Anwendung ist ein plattformunabhängiges, hochverfügbares, netzwerk-autarkes Kassen-, Bestell- und Küchenmanagementsystem für Vereinsfeste, Open-Air-Events und Gastronomiebetriebe. Sämtliche bewährten Gastro- & Vereinsfest-Funktionen (inklusive aller Features aus OrderAssist) sind vollständig integriert.

---

## 2. TECHNOLOGIE-STACK, REPOSITORY & ARCHITEKTUR
- **GitHub Repository**: [https://github.com/loe17/OpenBon/tree/master](https://github.com/loe17/OpenBon/tree/master)
- **Ziel-Plattform**: Web-first (PWA / Responsive Web), plattformunabhängig (iOS Safari, Android Chrome, Windows, macOS, Linux / Raspberry Pi)
- **Frontend / Client**: React 18+ mit Next.js (App Router), TypeScript (strikte Typisierung, keine `any`-Typen, strikte Null-Checks)
- **Backend / API**: Next.js API Routes (Node.js Engine) mit integrierter Socket.io WebSocket-Echtzeit-Kommunikation
- **UI Library & Styling**: Tailwind CSS, Radix UI Primitives, Lucide Icons (**ausschließlich Vektorgrafiken**)
- **State-Management & DB**: 
  - Client: React Context & Hooks / Zustand für lokale Station-Zustände & Warenkorb
  - Server / Persistence: Prisma ORM mit SQLite (Embedded) / PostgreSQL ready, syncfähig via Mutations-Journal
- **Architektur-Muster**: Feature-Sliced & Layered Architecture (Domain Models, Services, API Endpoints, UI Components, Hardware Spooler)
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
- **Warnfarbe (Kritischer Bestand / Wartezeit)**: `#F59E0B` (rgb(245, 158, 11)) – Bernstein / Amber
- **Gefahr / Sperre (Ausverkauft / Notruf)**: `#EF4444` (rgb(239, 68, 68)) – Signalrot
- **Akzentfarbe**: `#8B5CF6` (rgb(139, 92, 246)) – Violett für Sonderfunktionen & KDS
- **Zahlungsfarben (Signal-Farbleitsystem)**:
  - **Bargeld**: `#10B981` (Smaragdgrün)
  - **SumUp**: `#3B82F6` (SumUp Cyan-Blau)
  - **VR-Pay Me**: `#1E40AF` (Volksbanken Blau)
  - **Sparkasse (S-POS)**: `#DC2626` (Sparkassen Rot)
  - **Klassisches EC-Terminal**: `#7C3AED` (Terminal Violett)

### 3.2 Icon- & Symbolik-Richtlinie (Strikt KEINE Emojis)
- **Verbot von Emojis**: Im gesamten System (UI, Buttons, Tabellen, Formularen, Modals und Bon-Ausdrucken) sind Unicode-Emojis (wie 🍺, 🍕, 💵, ⚠️) **ausnahmslos verboten**.
- **Ausschließliche Nutzung von SVG-Icons**: Alle Symbole werden als skalierbare Vektorgrafiken über `lucide-react` gerendert:
  - Bier & Schankgetränke: `<Beer className="w-5 h-5" />`
  - Wein & Spirituosen: `<Wine className="w-5 h-5" />`
  - Alkoholfreie Getränke & Softdrinks: `<CupSoda className="w-5 h-5" />`
  - Heißgetränke (Kaffee/Tee): `<Coffee className="w-5 h-5" />`
  - Speisen & Küche: `<Utensils className="w-5 h-5" />`
  - Bargeld & Kassenlade: `<Banknote className="w-5 h-5" />`, `<DoorOpen className="w-5 h-5" />`
  - Kartenzahlungen: `<CreditCard className="w-5 h-5" />`, `<Smartphone className="w-5 h-5" />`
  - Status & Warnungen: `<CheckCircle2 className="w-5 h-5" />`, `<AlertTriangle className="w-5 h-5" />`, `<Ban className="w-5 h-5" />`

### 3.3 Typografie & Spacing
- **Überschriften & Buttons**: `Plus Jakarta Sans` / `Inter`, font-weight 700 bis 900
- **Fließtext & Labels**: `Inter`, font-weight 500 und 600
- **Beträge, Zähler & Bestellnummern**: `JetBrains Mono` / Monospace, font-weight 800
- **Border-Radius**:
  - Container / Tiles: `16px` (`rounded-2xl`) bis `24px` (`rounded-3xl`)
  - Sub-Elements / Badges: `8px` (`rounded-lg`) bis `12px` (`rounded-xl`)
- **Spacing-Dichte**: POS Optimized (großzügige Abstände für Einhand-Bedienung, haptisches Feedback via Vibration)

---

## 4. KARTENZAHLUNGS-SYSTEME (SUMUP, VR-PAY ME, SPARKASSE & ZVT)

Die Anwendung bietet eine nahtlose, geführte Integration für alle führenden Kartenzahldienste im DACH-Raum:

### 4.1 SumUp Integration (Air, Solo & 3G)
1. **Verfahren**: App-to-App Deep Linking & Web Affiliate Scheme (`sumupaffiliate://pay/v0.1`).
2. **Parameter-Übergabe**:
   - `amount`: Zahlbetrag formatiert (z. B. `12.50`)
   - `currency`: `EUR`
   - `title`: `OrderBon Tisch {Tischlabel}` bzw. `Abholmarke #{Token}`
   - `affiliate-key`: Konfigurierter `sumupAppId`
   - `callback`: `http://openbon.local/waiter/payment/callback?orderId={id}&status=success`
3. **Workflow**: Klick auf *"SumUp"* öffnet automatisch die SumUp App auf dem Smartphone/Tablet. Nach erfolgter Autorisierung kehrt SumUp zu OrderBon zurück, verbucht die Zahlung und gibt den Tisch frei.

### 4.2 VR-Pay Me Integration (Volks- & Raiffeisenbanken)
1. **Verfahren**: App-to-App URL Intent / Custom Scheme (`vrpayme://pay`).
2. **Konfiguration**: Händler-ID (`vrPayTerminalId`) in den Admin-Grundeinstellungen hinterlegt.
3. **Workflow**: Übergabe der Transaktions-Referenz und des Betrags an die VR-Pay Me App. Rückmeldung via URL-Callback mit Autorisierungs-Code.

### 4.3 Sparkassen Kassen- & Kartensystem (S-POS & ZVT-over-IP)
1. **S-POS App-to-App (Sparkasse)**:
   - Direkte Anbindung an die S-POS App (Sparkasse Smartphone als Kartenterminal / SoftPOS).
   - Aufruf via App-Scheme mit Betragsübergabe und Beleg-ID.
2. **Stationäre & Mobile Sparkassen-Terminals (ZVT / OPI Protokoll via TCP/IP)**:
   - Ansteuerung über TCP Port 20002 / 40007 (ZVT-Kassenschnittstelle).
   - Automatischer Versand des ZVT-Zahlungsblocks (`06 01` Registrierung & Betrag).
   - Empfang des Autorisierungs-Status (`06 0F` Zahlung erfolgt) und automatischer Belegdruck über den Bondrucker.

---

## 5. ERGONOMISCHER BEZAHLVORGANG (STEP-BY-STEP UI & KEYPAD)

```
[STUFE 1: SPLIT & AUSWAHL] ➔ [STUFE 2: ZAHLARTEN-WAHL] ➔ [STUFE 3: RECHNER / TERMINAL] ➔ [STUFE 4: ABSCHLUSS]
```

### Stufe 1: Rechnungs-Übersicht & Posten-Splitting (`/waiter/payment`)
- **Visualisierung**: Große, berührungsoptimierte Kacheln für jeden offenen Posten mit Stückzahl, Name, Pfand und Gesamtpreis.
- **Aktionen**:
  - Button *"Alles bezahlen (Gesamt: XX,XX €)"* – Markiert mit 1 Klick alle offenen Positionen.
  - Einzeltippen auf Kacheln – Markiert nur die gewünschten Posten für getrennte Abrechnung (Splitting).
- **Leuchtbalken**: Am unteren Bildschirmrand leuchtet der aktuelle Zwischenbetrag in **JetBrains Mono (32px, Smaragdgrün)** auf.

### Stufe 2: Farbcodierte Zahlarten-Auswahl
Große, unübersehbare Buttons mit unverwechselbarer Signal-Farbcodierung und SVG-Icons:
1. **Bargeld** (`#10B981` Smaragdgrün mit `<Banknote />`)
2. **SumUp** (`#3B82F6` Cyan-Blau mit `<CreditCard />`)
3. **VR-Pay Me** (`#1E40AF` VR-Dunkelblau mit `<CreditCard />`)
4. **Sparkasse / S-POS** (`#DC2626` Sparkassen-Rot mit `<Smartphone />`)
5. **EC-Terminal (ZVT)** (`#7C3AED` Violett mit `<CreditCard />`)

### Stufe 3: Bargeld-Rechencenter mit Riesen-Ziffernblock
Wird **Bargeld** gewählt, schaltet der Screen in den Express-Rechenmodus:
- **Riesiges Touch-Keypad (4x3 Grid)** mit haptischem Vibrations-Feedback bei jedem Tastendruck.
- **Schnellwahltasten für Banknoten**: 
  - `[ 5 € ]`  `[ 10 € ]`  `[ 20 € ]`  `[ 50 € ]`  `[ 100 € ]`  `[ Passend ]`
- **Große Rückgeld-Anzeige**:
  - Sobald der gegebene Betrag den Rechnungsbetrag übersteigt, leuchtet das Rückgeld in **48px Bernstein / Gold (`#F59E0B`)** zentriert auf dem Display auf (*"RÜCKGELD: 13,50 €"*).
- **Automatischer Kassenladen-Impuls**: Sendet zeitgleich das Öffnungssignal an den Bondrucker.

### Stufe 4: Kartenzahlungs-Monitor & Abschluss
- **Kartenzahlungs-Screen**: Zeigt einen pulsierenden Status-Ring mit Text (*"Bitte Karte an das Terminal halten..."*).
- **Akustische Rückmeldung**: Positiver Doppel-Gong bei erfolgreicher Autorisierung; Warn-Ton bei Kartenabbruch.
- **Beleg-Option**: Nach Abschluss 3 Schnell-Optionen:
  - `[ Beleg drucken ]` (ESC/POS Druck startet)
  - `[ Kein Beleg ]` (Umweltschonend)
  - `[ Tisch schließen & Weiter ]` (Tisch wechselt sofort auf `FREE` und leuchtet grün)

---

## 6. GASTRO- & VEREINSFEST-SPEZIFISCHE FUNKTIONEN (INKL. ORDERASSIST FEATURE-SET)

### 6.1 Tablett-Limitierung & Automatisches Bon-Splitting (Tray Capacity)
- **Problemstellung**: Kellner können nur eine begrenzte Anzahl an Getränken auf einem Tablett tragen (z. B. max. 6 oder 8 Maß/Halbe Bier).
- **Lösung**: Konfigurierbares Tablett-Limit pro Druckergruppe. Übersteigt eine Bestellung das Limit (z. B. 14x Bier), splittet das System den Druckauftrag automatisch in mehrere Teil-Bons mit Kopfzeile:
  - `*** BON 1 von 3 (Tisch 14 - 6x Bier) ***`
  - `*** BON 2 von 3 (Tisch 14 - 6x Bier) ***`
  - `*** BON 3 von 3 (Tisch 14 - 2x Bier) ***`

### 6.2 Alternative Artikelbezeichnung für den Bondrucker
- Auf dem Smartphone-Display wird der ausführliche Artikelname angezeigt (z. B. *"Bratwurstsemmel mit Senf"*).
- Für den 80mm/58mm Thermobon kann ein platzsparender, abgekürzter Druckname hinterlegt werden (`alternativeTicketName`, z. B. *"Bratw. Senf"*), um Belege kompakt und schnell lesbar zu halten.

### 6.3 Tischmarken-Drucker (Thermodrucker & PDF)
- Erlaubt das direkte Ausdrucken von nummerierten Tischkarten und Tischaufstellern auf dem Bon-Thermodrucker (oder als PDF-Aushang) für Biertischgarnituren und spontane Zusatztische.

### 6.4 Storno- & Korrektur-Workflow mit "Nicht bezahlt" / Freiverzehr
- **Vor dem Abschicken**: Freies Entfernen und Ändern im Warenkorb.
- **Nach dem Abschicken**: 
  - Admin-/Leitungs-PIN gesicherter Storno-Vorgang mit Pflicht-Stornogrund (*"Falsch bestellt"*, *"Bruch/Verschüttet"*, *"Ehrengast"*, *"Musiker/Helfer"*).
  - Automatischer Druck eines roten Storno-Bons in der Küche (`*** STORNO-BON - NICHT ZUBEREITEN ***`).
  - Kennzeichnung beim Kassieren als *"Nicht bezahlt"* für Buchhaltung und Schwund-Statistik.

### 6.5 Gang-Steuerung & Verzögerte Zubereitung (Courses & Hold)
- Artikel können im Warenkorb mit Gängen versehen werden:
  - `Gang 1` (Vorspeise / Sofort)
  - `Gang 2` (Hauptgang)
  - `Gang 3` (Dessert / Später)
  - `HOLD / Zurückhalten` (Wird erst nach manuellem Postenabruf durch die Bedienung an die Küche gesendet).

### 6.6 Schnell-Nachbestellung (Repeat Order / "Gleiche Runde noch einmal")
- 1-Klick-Schaltfläche in der Tischansicht: *"Gleiche Runde wiederholen"*. Übernimmt alle zuletzt bestellten Getränke des Tisches sofort in den Warenkorb.

### 6.7 X-Bon (Zwischenbericht) vs. Z-Bon (Tagesabschluss)
- **X-Bon (Kellner-Zwischenstand)**: Zeigt jederzeit den aktuellen Schicht-Umsatz, das Bar-Soll, Kartensplits und Trinkgelder einer einzelnen Bedienung, ohne die Kasse abzuschließen.
- **Z-Bon (Offizieller Kassenabschluss)**: Schließt die Kassenperiode ab, speichert die Fiskalblöcke ab, druckt den Z-Bon mit MwSt-Splits und setzt die Zähler zurück.

### 6.8 Kassenbuch & Geldbewegungen (Wechselgeld & Entnahmen)
- Erfassung von Wechselgeld-Vorschuss bei Schichtbeginn (`CASH_IN`) und Zwischenabgaben in den Tresor (`CASH_OUT`) mit Quittungsdruck.

### 6.9 Trinkgeld-Erfassung (Tip Management)
- Getrennte Erfassung von Trinkgeldern bei Bar- und Kartenzahlung mit Ausweisung auf dem Kellner-Schichtbericht.

### 6.10 Gast-Vorabrechnung (Bewirtungsbeleg / Zwischenrechnung)
- 1-Klick-Druck einer Zwischenrechnung für den Gast vor dem eigentlichen Kassiervorgang.

### 6.11 Schulungs- & Trainingsmodus
- Voll funktionsfähiger Übungsmodus für neue Helfer mit deutlichem Wasserzeichen auf dem Screen und Aufdruck auf Bons (`*** ÜBUNGSBON - KEINE BEZAHLUNG ***`), ohne Live-Umsätze zu verfälschen.

---

## 7. AUTOMATISIERTE TEST-SUITE & SELF-HEALING DIAGNOSE

### 7.1 Testabdeckung für jede einzelne Funktion
1. **Pricing & Split-Engine (`src/__tests__/pricing.test.ts`)**: Prüft cent-genaue MwSt-Berechnung (19% / 7% / 0%), Pfandverrechnung, Aufschläge und Teilzahlungen.
2. **ESC/POS Raw Buffer Generator (`src/__tests__/escpos.test.ts`)**: Validiert CP858-Umlautkonvertierung, Z-Bon Layouts, Tablett-Splits, Storno-Bons und Kassenladen-Steuercodes.
3. **Bestandsführung & Ausverkaufsschutz (`src/__tests__/integration.test.ts`)**: Testet automatischen Bestandsabzug bei Mehrfachbestellungen und Auto-Sperre bei 0 Stück.
4. **Offline Krypto-Lizenz (`src/__tests__/build_and_schema.test.ts`)**: Testet HMAC-SHA256 Signatur-Generierung, Gültigkeitsprüfung und Schutz vor Manipulation.
5. **Multi-Station PIN-Sicherheit (`src/__tests__/auth.test.ts`)**: Testet PIN-Prüfungen für Admin (`1234`), Kasse (`1111`), Küche (`2222`) und Kellner (`3333`).
6. **Hochverfügbarkeit & SyncJournal (`src/__tests__/ha.test.ts`)**: Validiert Replikation zwischen Primary und Standby.

### 7.2 Integrierte Self-Healing Selbstdiagnose (`/api/system/diagnostics`)
- **Autonome Prüfung bei Serverstart und zyklisch alle 60 Sekunden**:
  - **Datenbank-Integrität**: Prüft Tabellenstrukturen und behebt verwaiste Bestellzeilen automatisch.
  - **Drucker-Socket-Wächter**: Erkennt hängende Druckaufträge (Timeouts) und startet den Netzwerkspooler neu.
  - **HA-Journal Konsistenz**: Bereinigt fehlerhafte Sync-Locks und stellt Konsistenz zwischen Primary und Secondary wieder her.

---

## 8. INTEGRIERTE OFFLINE-HTML-DOKUMENTATION

Das System stellt eine **vollständige, interaktive HTML-Dokumentation** bereit, die direkt über den Server unter `/docs` bzw. `/admin/docs` abrufbar ist – **100% offline ohne Internet**:
- **Kellner-Handbuch**: Schnellstart, Tischbestellung, Sonderwünsche, Tablett-Bons, Pfandrücknahme, Splitting und Kartenzahlung.
- **Kassen- & Thekenhandbuch**: Wertmarkenverkauf, Gutscheinbon, Kassenladenbedienung, Wechselgeld-Einlagen und Schichtwechsel.
- **Küchen-Leitfaden**: KDS-Bedienung, Gang-Steuerung, Abstreichen von Posten, Akustik-Gong und Storno-Bons.
- **Admin- & Installations-Guide**: Headless Linux Setup auf Raspberry Pi, mDNS-Konfiguration, Drucker-Einrichtung, TSE-Aktivierung und Notfall-Wiederherstellung.

---

## 9. GITHUB-VERSIONIERUNG & RELEASE-PROZESS

- **Repository-Pfad**: `https://github.com/loe17/OpenBon/tree/master`
- **Release-Tags**: Semantische Versionierung (`v0.1.0`, `v0.1.1`, `v0.2.0`...).
- **Automatisierte CI/CD-Pipeline (GitHub Actions)**:
  - Bei jedem Push auf `master`: Automatischer Durchlauf von `npm test` (`tsc --noEmit && vitest run`) und `npm run build`.
- **1-Klick WebUI-Update**: Abgleich mit GitHub Commits via `/admin/system-update`, automatischer Pull, Schema-Push, Rebuild und kontrollierter Prozess-Neustart via systemd.

---

## 10. PRISMA DATENBANK-SCHEMA (VOLLSTÄNDIG)

```prisma
model EventConfig {
  id                    String   @id @default("default")
  name                  String   @default("Vereinsfest 2026")
  currency              String   @default("EUR")
  taxRateNormal         Float    @default(19.0)
  taxRateReduced        Float    @default(7.0)
  adminPin              String   @default("1234")
  posPin                String   @default("1111")
  kitchenPin            String   @default("2222")
  waiterPin             String   @default("3333")
  trayMaxItems          Int      @default(6)      // Tablett-Limit
  trainingMode          Boolean  @default(false)
  enableVirtualPrinters Boolean  @default(true)
  sumupMerchantCode     String?
  sumupAppId            String?
  vrPayTerminalId       String?
  tseProvider           String   @default("NONE")
  tseSerialNumber       String?
  licenseKey            String   @default("OPENBON-COMMUNITY-FREE")
  haRole                String   @default("PRIMARY")
  haPartnerUrl          String?
  updatedAt             DateTime @updatedAt
}

model DiningTable {
  id               String      @id @default(uuid())
  tableNumber      Int         @unique
  label            String
  section          String      @default("Hauptbereich")
  posX             Int         @default(0)
  posY             Int         @default(0)
  status           String      @default("FREE")
  isActive         Boolean     @default(true)
  activeWaiterName String?
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
  id                    String           @id @default(uuid())
  name                  String
  alternativeTicketName String?          // Kompakter Name für Thermobondruck
  price                 Float
  deposit               Float            @default(0.0)
  taxRate               Float            @default(19.0)
  buttonColor           String           @default("#3b82f6")
  status                String           @default("ACTIVE")
  isSoldOut             Boolean          @default(false)
  trackStock            Boolean          @default(false)
  stockQuantity         Int              @default(0)
  stockAlertThreshold   Int              @default(10)
  subCategory           String?          // BIER, WEIN, ALKOHOLFREI, HEISS, BAR
  sortIndex             Int              @default(0)
  categoryId            String
  category              ProductCategory  @relation(fields: [categoryId], references: [id])
  printGroupId          String?
  printGroup            PrintGroup?      @relation(fields: [printGroupId], references: [id])
  variants              ProductVariant[]
  options               ProductOption[]
  orderItems            OrderItem[]
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

model Order {
  id          String       @id @default(uuid())
  orderNumber Int          @default(autoincrement())
  tableId     String?
  table       DiningTable? @relation(fields: [tableId], references: [id])
  waiterName  String       @default("Bedienung")
  deviceId    String?
  status      String       @default("OPEN")
  orderType   String       @default("TABLE")
  tokenNumber Int?
  isTraining  Boolean      @default(false)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  items       OrderItem[]
  payments    Payment[]
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
  id            String   @id @default(uuid())
  orderId       String?
  order         Order?   @relation(fields: [orderId], references: [id])
  paymentNumber Int      @default(autoincrement())
  waiterName    String   @default("Bedienung")
  deviceId      String?
  paymentMethod String   @default("CASH") // CASH, CARD_SUMUP, CARD_VRPAY, CARD_SPARKASSE, CARD_TERMINAL, VOID_UNPAID
  amount        Float
  givenAmount   Float?
  changeAmount  Float?
  tipAmount     Float    @default(0.0)    // Erfasstes Kellner-Trinkgeld
  isTraining    Boolean  @default(false)
  createdAt     DateTime @default(now())
}
```
