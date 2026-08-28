# Implementierungsplan: Vollständige Umsetzung der SPECIFICATION_V2 (v0.2.0+)

Dieser Implementierungsplan beschreibt die schrittweise und lückenlose Umsetzung aller in [`docs/SPECIFICATION_V2.md`](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/docs/SPECIFICATION_V2.md) definierten Funktionen in der Codebase von **OrderBon / OpenBon**.

---

## Übersicht der 11 V2-Erweiterungsbereiche

1. **§4.1 QR-Code Tischbestellung & Direktbezahlung (BYOD Order & Pay)**
   - Dedizierte Gast-Bestellansicht unter `/guest/table/[tableNumber]?token=[qrToken]`
   - Live-Warenkorb gegen Lagerbestand, KDS- & Thekenweiterleitung mit `source = "GUEST_QR"`
2. **§4.2 Self-Service Kiosk Terminal (SB-Bestellstation)**
   - Vollbild-Kiosk-Modus unter `/kiosk` mit Touch-Kacheln, Upsell-Prompts, Abholnummern (`#A-104`), Kartenzahlung & 60s Inaktivitäts-Timer
3. **§5.2 Digitaler Kassenbeleg per QR-Code (E-Bon nach §33 KassenSichV)**
   - Dynamischer QR-Code nach Zahlung am Screen, Web-Belegabruf `/receipt/[digitalReceiptCode]` mit PDF-Download
4. **§5.3 Flexible Trinkgeld-Profile & Bereiche mit individueller Kellner-Zuordnung**
   - Default: **100% an die Bedienung**; konfigurierbare Profile (Bedienung, Bar, Küche, Service) unter `/admin/tips`, Zuordnung je Kellner
5. **§6.1 Jugendschutz-Hinweis mit dynamischem Mindestgeburtsdatum**
   - Checkbox `hasAgeRestriction` + `minAge` im Artikelstamm; automatische taggenaue Berechnung des Mindestgeburtsdatums am Mobilteil & Kasse; Schalter `enableAgeVerificationAlerts`
6. **§6.2 Wertmarken- & Token-System (Bons & Verzehrmarken)**
   - Artikel-Typ `isTokenProduct`, neue Zahlart `TOKEN`, Rückkauf- & Ausgabeverwaltung via `TokenTransaction` unter `/admin/tokens`
7. **§6.3 Mindestmengen-Warnung (Low Stock Alert) mit optionalem Druckerausdruck**
   - Meldebestand `minStockAlert` je Artikel; Warnung ausschließlich in Admin & Bonkasse; optionaler automatischer Warnbeleg-Druck auf `lowStockAlertPrinterId`
8. **§6.4 Allergen- & Zusatzstoff-Hinterlegung im Artikelstamm (LMIV)**
   - 14 EU-Hauptallergene & Zusatzstoffe direkt im Artikelstamm per Checkboxen; Info-Modal & interaktiver Ausschluss-Filter am Kellner-Mobilteil
9. **§6.5 Zeitgesteuerte Aktionspreise & Happy-Hour-Scheduler**
   - Konfigurierbare Zeitfenster & Aktionspreise je Artikel (`happyHourPrice`, `happyHourStart`, `happyHourEnd`, `happyHourDays`); vollautomatischer Wechsel in der Pricing-Engine
10. **§7.1 DATEV Kassenbuch-Export**
    - DATEV ASCII/CSV Buchungsstapel-Generator (`src/lib/datev-exporter.ts`) mit Erlöskonten (19%, 7%, Kasse, Transit) und Download unter `/admin/accounting`
11. **§7.2 DSFinV-K & TSE-Archiv-Export**
    - Standardisierter Prüfer-Export (`src/lib/dsfinvk-exporter.ts`) nach KassenSichV/GoBD (`bonkopf.csv`, `bonpos.csv`, `bonpos_preise.csv`, `tse_transaktionen.csv`) als TAR/ZIP mit SHA-256 Prüfsumme

---

## User Review Required

> [!NOTE]
> Die bestehenden Datenstrukturen und bewährten Funktionen (Tischverwaltung, KDS, Storno-Workflow, Tablett-Splits, Z-Bon, Kassenbuch, SumUp, ZVT) bleiben vollständig erhalten und werden abwärtskompatibel um die V2-Modelle erweitert.

---

## Proposed Changes

### 1. Datenmodell & Schema (`prisma/schema.prisma`)

#### [MODIFY] [schema.prisma](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/prisma/schema.prisma)
- Erweiterung von `EventConfig`:
  - `enableAgeVerificationAlerts`, `enableDigitalReceiptQr`, `enableGuestSelfOrder`, `enableKioskMode`, `lowStockAlertPrinterId`, `datevConsultantNumber`, `datevClientNumber`, `datevCashAccount`.
- Neues Modell `TipProfile`:
  - `id`, `name`, `waiterPercent` (default 100.0), `barPoolPercent`, `kitchenPoolPercent`, `servicePoolPercent`, `isDefault`.
- Neues Modell `WaiterProfile`:
  - `id`, `name`, `pin`, `isActive`, `tipProfileId`, Relationen zu `Order` und `Payment`.
- Erweiterung von `Product`:
  - `hasAgeRestriction`, `minAge`, `allergens`, `additives`, `happyHourPrice`, `happyHourStart`, `happyHourEnd`, `happyHourDays`, `minStockAlert`, `minStockAlertPrinted`, `isTokenProduct`, `tokenType`.
- Erweiterung von `DiningTable`:
  - `qrToken` (UUID/CUID) für gesicherte Gäste-Tischaufrufe.
- Erweiterung von `Order`:
  - `source` (`WAITER`, `GUEST_QR`, `KIOSK`), `waiterId`, `digitalReceiptCode`.
- Erweiterung von `Payment`:
  - `waiterId`, `digitalReceiptCode`, Zahlart `TOKEN`.
- Neues Modell `TokenTransaction`:
  - `tokenType`, `action` (ISSUE, REDEEM, RETURN), `quantity`, `unitValue`, `totalValue`, `waiterName`.
- Neues Modell `FiscalExport`:
  - `exportType` (DATEV_CASHBOOK, DSFINVK_TAR, TSE_AUDIT), `periodStart`, `periodEnd`, `filename`, `checksumSha256`.

---

### 2. Business-Logik, Helfer & Exporter (`src/lib/`)

#### [MODIFY] [pricing.ts](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/lib/pricing.ts)
- Erweiterung um Happy-Hour Zeitfenster-Prüfung (`isHappyHourActive`, `getEffectiveProductPrice`).

#### [NEW] [compliance.ts](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/lib/compliance.ts)
- Dynamischer Jugendschutz-Geburtsdatumsrechner (`calculateMinBirthdate(minAge, targetDate)`).
- 14 EU-Hauptallergene und LMIV-Zusatzstoff-Kataloge und Filterfunktionen.

#### [NEW] [tips.ts](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/lib/tips.ts)
- Trinkgeld-Verteilungsengine: Berechnung von Bedienungsanteil, Bar-, Küchen- und Service-Pool nach Profil.

#### [NEW] [datev-exporter.ts](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/lib/datev-exporter.ts)
- Generierung von DATEV-konformen Buchungsstapeln (Kassenbuch Online / ASCII-CSV Format) mit Kontenrahmen.

#### [NEW] [dsfinvk-exporter.ts](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/lib/dsfinvk-exporter.ts)
- Generierung der DSFinV-K 2.3+ CSV-Dateien (`bonkopf`, `bonpos`, `bonpos_preise`, `tse_transaktionen`) und ZIP-Archivierung mit SHA-256 Prüfsumme.

#### [NEW] [low-stock-notifier.ts](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/lib/low-stock-notifier.ts)
- Prüfung von Meldebeständen bei Bestelleingang und automatisches ESC/POS Spooling an den Warndrucker.

#### [NEW] [digital-receipt.ts](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/lib/digital-receipt.ts)
- Generierung kryptografischer E-Bon Codes und Bereitstellung strukturierter Belegdaten für Web & PDF.

---

### 3. Backend API Endpoints (`src/app/api/`)

#### [NEW] [api/guest/orders/route.ts](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/app/api/guest/orders/route.ts)
- Gast-Bestellübermittlung für QR-Tischbestellungen mit Tokenprüfung und KDS-Routing.

#### [NEW] [api/receipt/[code]/route.ts](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/app/api/receipt/[code]/route.ts)
- Abruf des signierten E-Bons via Beleg-Code.

#### [NEW] [api/tip-profiles/route.ts](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/app/api/tip-profiles/route.ts)
- CRUD-API für Trinkgeld-Verteilungsprofile.

#### [NEW] [api/waiters/route.ts](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/app/api/waiters/route.ts)
- Kellner-Verwaltung mit PIN- und Trinkgeld-Profil-Zuordnung.

#### [NEW] [api/tokens/route.ts](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/app/api/tokens/route.ts)
- Erfassung, Verkauf, Einlösung und Rückkauf von Fest-Wertmarken.

#### [NEW] [api/fiscal/datev/route.ts](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/app/api/fiscal/datev/route.ts)
- Generierung und Download des DATEV-Kassenbuch-Exports.

#### [NEW] [api/fiscal/dsfinvk/route.ts](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/app/api/fiscal/dsfinvk/route.ts)
- Generierung und Download des DSFinV-K Prüfer-Archivs.

#### [MODIFY] Bestehende APIs
- [products/route.ts](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/app/api/products/route.ts) & [products/[id]/route.ts](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/app/api/products/[id]/route.ts): Unterstützung aller neuen Produkt-Felder.
- [config/route.ts](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/app/api/config/route.ts): Speichern neuer Schalter & Druckereinstellungen.
- [payments/route.ts](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/app/api/payments/route.ts): Unterstützung für `TOKEN`, E-Bon Hash und Trinkgeldaufteilung.
- [orders/route.ts](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/app/api/orders/route.ts): Integration von `low-stock-notifier` und `source`.

---

### 4. Frontend Benutzeroberflächen (`src/app/`)

#### [NEW] [guest/table/[tableNumber]/page.tsx](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/app/guest/table/[tableNumber]/page.tsx)
- Responsive Gäste-Bestellseite (QR BYOD) mit Allergen-Filtern, Varianten und Direktbezahlung.

#### [NEW] [kiosk/page.tsx](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/app/kiosk/page.tsx)
- SB-Bestellterminal mit großen Kacheln, Upsell-Schritten, Abholmarkenausgabe und 60s Reset.

#### [NEW] [receipt/[code]/page.tsx](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/app/receipt/[code]/page.tsx)
- Öffentliche E-Bon Seite mit Belegansicht, TSE-Block und PDF-Download.

#### [NEW] [admin/tips/page.tsx](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/app/admin/tips/page.tsx)
- Trinkgeld-Profile-Editor und Kellner-Zuordnung.

#### [NEW] [admin/accounting/page.tsx](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/app/admin/accounting/page.tsx)
- DATEV-Kassenbuch Export-Portal mit Datumsbereichswahl und Beraternummer-Konfiguration.

#### [NEW] [admin/fiscal/page.tsx](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/app/admin/fiscal/page.tsx)
- 1-Klick DSFinV-K Prüferexport nach KassenSichV/GoBD.

#### [NEW] [admin/tokens/page.tsx](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/app/admin/tokens/page.tsx)
- Wertmarken-Dashboard & Transaktionsjournal.

#### [MODIFY] Bestehende Oberflächen
- [admin/products/page.tsx](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/app/admin/products/page.tsx): Multi-Select für 14 Allergene, Zusatzstoffe, Altersgrenze-Checkbox, Happy-Hour Zeitfenster und Meldebestand.
- [admin/settings/page.tsx](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/app/admin/settings/page.tsx): Schalter für Jugendschutz, E-Bon, Kiosk, Gast-Order und Warndrucker-Auswahl.
- [waiter/order/page.tsx](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/app/waiter/order/page.tsx) & [pos/page.tsx](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/app/pos/page.tsx):
  - Dynamischer Jugendschutz-Hinweis `<ShieldAlert />` mit berechnetem Mindestgeburtsdatum.
  - Allergen-Info-Icon `<AlertCircle />` und interaktiver Ausschlussfilter.
  - Automatische Happy-Hour Preisanzeige mit `<Sparkles />` Badge.
  - E-Bon QR-Code Anzeige nach erfolgreicher Bezahlung.

---

### 5. Vitest Test-Suite (`src/__tests__/`)

- [pricing.test.ts](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/__tests__/pricing.test.ts): Happy-Hour Tests (Uhrzeit & Wochentage).
- [NEW] [receipt.test.ts](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/__tests__/receipt.test.ts): E-Bon Hash- und Datenvalidierung.
- [NEW] [tips.test.ts](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/__tests__/tips.test.ts): Trinkgeld-Verteilungsprofile und Kellner-Anteile.
- [NEW] [compliance.test.ts](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/__tests__/compliance.test.ts): Dynamische Geburtsdatumsberechnung und Allergenfilterung.
- [NEW] [inventory_alert.test.ts](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/__tests__/inventory_alert.test.ts): Meldebestand-Erkennung und Drucker-Spooling.
- [NEW] [tokens.test.ts](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/__tests__/tokens.test.ts): Wertmarken-Buchungen und Zahlungen.
- [NEW] [fiscal_export.test.ts](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/src/__tests__/fiscal_export.test.ts): Syntaktische Prüfung von DATEV-CSV und DSFinV-K Archiven.

---

## Verification Plan

### Automated Tests
- `npx prisma db push`
- `npx prisma generate`
- `npx tsc --noEmit` (strikte TypeScript-Prüfung ohne Fehler)
- `npx vitest run` (100% erfolgreicher Durchlauf aller Test-Suiten inklusive der 7 neuen Testdateien)

### Manual Verification
- Aufruf der Kiosk-Ansicht (`/kiosk`) und Test des 60s Inaktivitäts-Timers.
- Test der Gast-QR-Bestellung (`/guest/table/1?token=...`) und Überprüfung der Allergen-Filter.
- Überprüfung der dynamischen Geburtsdatumsanzeige beim Auswählen von 16/18-Jahre-Artikeln.
- Durchführung einer Zahlung mit Anzeige des dynamischen E-Bon QR-Codes und Abruf unter `/receipt/...`.
- Download und Prüfung eines generierten DATEV-Kassenbuchs und DSFinV-K Prüfer-Archivs im Adminbereich.
