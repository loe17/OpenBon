# OpenBon – Master-Changelog & Systemgedächtnis

> **Wichtiger Hinweis für Entwickler & KI-Assistenten:**  
> Dieses Dokument fungiert als das zentrale **Systemgedächtnis** von OpenBon. Es dokumentiert alle Spezifikationen, Architektur- und Sicherheitsentscheidungen, Bugfixes und den aktuellen Umsetzungsgrad.  
> **Pflicht-Regel:** Vor jeder Änderung am Code muss dieses Dokument konsultiert werden. Nach jeder Änderung ist dieses Dokument chronologisch mit Datum, Uhrzeit, Begründung (Weshalb) und technischer Umsetzung (Wie) zu erweitern!

---

## Mandatorische Release-Checkliste & Test-Katalog für jede Version

> **Verbindliche Prüfvorschrift:** Vor jedem Tagging, Release oder Push einer neuen Version auf GitHub **MÜSSEN** folgende Prüfungen vollständig ohne Warnungen oder Fehler durchlaufen:

### 1. Automatisierte Test-Suiten (`npm test`)
Befehl: `npm test` (führt `tsc --noEmit && vitest run` aus).
Folgende 50 Kern-Testsuiten müssen ausnahmslos **GRÜN** sein:
1. `src/__tests__/setup_wizard_v0427.test.ts` – Erststart-Assistent Lifecycle, Tisch-/Artikel-Daten-Erkennung, PIN-Validierung & nahtlose Admin-Session-Ausstellung.
2. `src/__tests__/waiter_payment_pricing_v0426.test.ts` – Cent-Präzision (450 Cent), Varianten/Optionen-Aufpreise, Zahlungs-Payload-Validierung, Rückgeldrechner (20€ auf 5,70€) & E-Bon-Bypass bei fehlendem Secret.
3. `src/__tests__/build_and_schema.test.ts` – Schema-Defaults (@default(0)), Stations-PIN-Defaults, Version-Sanity.
4. `src/__tests__/version_backup.test.ts` – Versionsabgleich & selektive Backup-Integrität.
5. `src/__tests__/version_compare.test.ts` – SemVer-Vergleich für automatische Update-Erkennung.
6. `src/__tests__/atomic_checkout.test.ts` – Kassen-Volltransaktion (Bestellung + Zahlung atomar in einem Request).
7. `src/__tests__/pricing.test.ts` – Zentrale Preis-Engine, Cent-Umrechnung, Happy-Hour-Regeln & Steuersplits.
8. `src/__tests__/all_order_variants.test.ts` – Tisch, Theke, Wertmarke, Kiosk, Mitnahme & Storno.
9. `src/__tests__/e2e_full_lifecycle.test.ts` – Kompletter Kassenlebenszyklus (Tisch -> Bestellen -> Umbuchen -> Bezahlen -> Beleg).
10. `src/__tests__/card_payment.test.ts` – Kartenzahlungs-Workflow (SumUp, VR Pay, Sparkasse, Barcode/QR).
11. `src/__tests__/tray_split.test.ts` – Kellner-Tablett-Splitting & Teilabrechnungen.
12. `src/__tests__/ha.test.ts` – High-Availability-Engine, Split-Brain-Schutz & Primary-Leases.
13. `src/__tests__/splitbrain_rooms_pin_v0421.test.ts` – Standby-Write-Schutz (409 Readonly), Funk-Räume & PIN-Härtung.
14. `src/__tests__/initial_pin.test.ts` – Ersteinrichtungs-Zwang bei ungesicherten Standard-PINs.
15. `src/__tests__/auth.test.ts` – Session-Tokens, Rollenberechtigungen & Cookie-Sicherheit.
16. `src/__tests__/security_hardening_v0418.test.ts` – PIN-Brute-Force-Sperren, Rate-Limiting & SQL-Injection-Schutz.
17. `src/__tests__/n11_n2_security.test.ts` – Audit-Vorgaben für Kartenzahlungs-Signaturen und Kellner-Authentifizierung.
18. `src/__tests__/audit_fixes_v0420.test.ts` – Stunden-Rate-Limits & E-Bon Kryptoverifikation.
19. `src/__tests__/tse_zip_ack_v0419.test.ts` – TSE-Anbindung & Druck-Quittierungslogik.
20. `src/__tests__/fiscal_export.test.ts` – Fiskal-Exporte & GoBD-Datenstrukturen.
21. `src/__tests__/compliance.test.ts` – KassenSichV §146a / DSFinV-K Konformität.
22. `src/__tests__/register_period.test.ts` – Z-Bon Kassenabschluss, Zählprotokoll & Kassensturz.
23. `src/__tests__/tips.test.ts` – Trinkgeld-Verteilung & Kellner-Profile.
24. `src/__tests__/recommendations_hardening.test.ts` – KI-gestützte Bon-Empfehlungen & Upselling-Sanity.
25. `src/__tests__/theme_contrast_validation.test.ts` – WCAG-Kontrastprüfung für Outdoor-/Sonnenlichtmodus.
26. `src/__tests__/payment_adapters.test.ts` – Zahlungsarten-Mapping & Transaktionsstatus.
27. `src/__tests__/hardening_sanity.test.ts` – Systemstabilität & Speicherleck-Vorbeugung.
28. `src/__tests__/integration.test.ts` – Endpunkt-Zusammenspiel zwischen Kasse, KDS und Schankbalken.
29. `src/__tests__/receipt.test.ts` – Belegformatierung, QR-Code-Generierung & Archivierung.
30. `src/__tests__/forecast.test.ts` – Prognose-Engine für Bestandsbedarfe.
31. `src/__tests__/escpos.test.ts` – ESC/POS-Befehlsgenerierung für Bondrucker.
32. `src/__tests__/inventory_recipes.test.ts` – Rezeptur-Abbuchung vom Schank- und Lagerbestand.
33. `src/__tests__/extensions_v3.test.ts` – Plugin- und Erweiterungsschnittstellen.
34. `src/__tests__/waiter_ui_and_system_metrics_v0436.test.ts` – CPU/RAM-Metriken & Zählerkacheln.
35. `src/__tests__/cash_ergonomics_and_metrics_v0437.test.ts` – Hardware-Polling-Entkopplung & Kassen-Inkrementierung.
36. `src/__tests__/order_delay_and_cash_ergonomics_v0438.test.ts` – Druckverzögerung & Storno-Countdown.
37. `src/__tests__/waiter_ergonomics_and_storno_v0439.test.ts` – Volle Artikelbreite, Long-Press & Schubladen-Ergonomie.
38. `src/__tests__/order_resilience_multi_order_v0440.test.ts` – Multi-Order-Payable-Items & Kassenresilienz.
39. `src/__tests__/order_delay_storno_fix_v0442.test.ts` – Serverseitige Timer-Berechnung & Storno-Countdown-Resilienz.
40. `src/__tests__/realtime_config_and_delay.test.ts` – Echtzeit-Synchronisation für Konfiguration und Verzögerungen.
41. `src/__tests__/waiter_delay_storno_cash_refund_v0444.test.ts` – Verzögertes Storno mit Barauszahlung nach Sofort-Kassieren.
42. `src/__tests__/ui_enhancements_v0445.test.ts` – Touch-Numpad, Schicht-Storno-Historie & A4-Tischplandruck.
43. `src/__tests__/guest_and_tokens_crash_prevention_v0448.test.ts` – Fehlertolerante Preisformatierung im Gastmenü.
44. `src/__tests__/webhosting_bridge_and_kiosk.test.ts` – Webhosting-Brücke für digitale E-Bons & PDF-Speisekarte.
45. `src/__tests__/kassenlade_ebon_and_https_v0450.test.ts` – Kassenladen-Priorisierung, universeller E-Bon & Festzelt-HTTPS.
46. `src/__tests__/companion_terminal_vrpay_v0451.test.ts` – SoftPOS Smartphone-Terminal (VR Pay:Me Deep-Links).
47. `src/__tests__/event_summary_and_receipt_sync.test.ts` – Veranstaltungs-Abschlussbericht (PDF/CSV) & Bon-Synchronisation.
48. `src/__tests__/report_buttons_and_resilience.test.ts` – Resiliente Berichte, automatische Datenkorrektur bei gelöschten Artikeln & Fehler-Handling.
49. `src/__tests__/handbook_images_exist.test.ts` – Vollständigkeit aller 40 Handbuch-Grafiken auf dem Dateisystem.
50. `src/__tests__/https_cert_and_menu_expiration_v0454.test.ts` – Lebenslanges 100-Jahre-HTTPS-Zertifikat, PHP-Speisekarten-Selbstlöschung & Menü-Konsolidierung.
51. `src/__tests__/table_markers_and_nav_cleanup.test.ts` – Tischmarken-Druckerweiterung (Kopien je Tisch, Vollbreite auf Stufe 10, Divider-Wegfall) & 4-Kategorien-Admin-Menü.
52. `src/__tests__/ui_fixes_v0456.test.ts` – Menüzustand-Persistenz, Tischmarken-Vollbreite & QR-Code-Tools.
53. `src/__tests__/device_waiter_name_sync.test.ts` – Kellnernamens-Synchronisation, Akku-Warnung & KDS-Ausverkauf.
54. `src/__tests__/shift_pause_kds_cert_v0458.test.ts` – Schicht-Pause vs. Logout, Schichtzeiten-Erfassung, vertikales KDS-Scrollen & reines Android Root-CA.
55. `src/__tests__/timewindows_and_pdf_import_v0459.test.ts` – Artikel-Zeitfenster, PDF-Speisekarten-Import, Kassen-Uhrzeit & 400ms-Echtzeit-Metriken.
56. `src/__tests__/crash_prevention_and_resilience_v0461.test.ts` – Dauerbetrieb-Stabilität, Crash-Schutz & Anfrage-Überlastungsschutz.
57. `src/__tests__/compact_navbar_and_smooth_uptime_v0462.test.ts` – Schlanke Kopfleiste, kompakter Status-Globus & ruckelfreie Uptime.
58. `src/__tests__/paper_consumption_and_landmarks_v0463.test.ts` – Bonverbrauchsrechner, ESC/POS-Längenberechnung, geräuschloser Stopp-Bon, Web-Relay & Tischplan-Randleisten.

### 2. Produktions-Build (`npm run build`)
Befehl: `npm run build`
- Prüft `prisma generate` und Next.js Produktionskompilierung.
- Alle statischen und dynamischen Seiten müssen fehlerfrei gebaut werden.

### 3. Versions-Konsistenz
Vor dem Release müssen folgende Dateien auf die identische neue Versionsnummer angehoben werden:
- `package.json` (`version`)
- `src/lib/version.ts` (`APP_VERSION`, `APP_BUILD_DATE`, `APP_RELEASE_DATE`, `APP_CODENAME`)
- `src/__tests__/build_and_schema.test.ts` (Versions-Assert)

## v0.4.72 – Hochverfügbarkeit: Vollautomatisches Auto-Failback, sanfte Kassenübergabe & Kellner-Offline-Puffer (29.09.2026)

> Vollautomatisches Auto-Failback für unterbrechungsfreien Kassenbetrieb: Startet der Haupt-Laptop nach einem Stromausfall oder Neustart wieder, synchronisiert er sich zunächst als stiller Zuhörer im Hintergrund, prüft die Netzwerkstabilität für 20 Sekunden ohne Buchungsrückstand und übernimmt die Kassenführung danach vollautomatisch vom Ersatzrechner zurück. Inklusive 3-fachem Schutz beim Kassieren während der Übergabe (Handy-Ausgangskorb, 200ms Drain-Phase und globale UUID-Deduplizierung), Ein-Klick-Netzwerksuche (Discover API & In-App-Pairing) und nahtlosem Rückschwenk aller Kellner-Smartphones ohne Neuanmeldung oder QR-Scan.

### Weshalb
1. **Vollautomatisches Auto-Failback ohne manuelle Umschaltung:** Bislang musste nach dem Neustart der Hauptkasse manuell im Adminbereich umgestellt werden. Nun erkennt das System die Rückkehr des Hauptrechners, wartet 20 Sekunden stabile Verbindung ab (Schutz vor Wackelkontakten) und führt eine sanfte, geordnete Übergabe durch.
2. **Unterbrechungsfreier Kassenbetrieb beim Übergang:** Bedienungen können selbst während der Übergabesekunde ununterbrochen weiterkassieren. Der 3-Stufen-Schutz garantiert, dass keine Buchung verloren geht und niemals ein Bon doppelt abgerechnet wird.
3. **Nahtloses Umschwenken der Mobilgeräte:** Kellner-Smartphones, Tablets und POS-Stationen schwenken via WebSocket-Signal ohne Unterbrechung oder Re-Login automatisch wieder auf den Hauptrechner um.

### Wie (Technik)
- **Geordneter Handshake-Endpunkt (`/api/system/ha/handover`):**
  - Authentifizierung über HA-Sync-Secret oder Admin-Session.
  - 200 ms Drain-Phase zum sauberen Abschluss aller im Flug befindlichen Buchungen.
  - Ermittlung der letzten Journal-Sequenznummer und geordneter Rücktritt auf `STANDBY` via `haService.demoteToStandby()`.
- **Echtzeit-Synchronisation & Stabilität (`src/lib/ha/ha-service.ts`):**
  - Bevorzugter Hauptrechner (`isPreferredPrimary`) wartet nach dem Hochfahren 20 Sekunden fehlerfreie Synchronisation ohne Rückstände ab (`applied === 0`).
  - Löst danach `executeFailbackHandover()` aus: Partner wird zu Standby degradiert, finale Deltas werden gezogen, Primary-Lease übernommen und die Rolle auf `PRIMARY` gesetzt.
- **Client-Reaktion (`src/components/providers/socket-provider.tsx`):**
  - Hört auf `ha:role_changed` (`STANDBY` mit Partner-URL), leert den lokalen Handy-Ausgangskorb und schwenkt nach 1,5 Sekunden sanft auf die Haupt-URL um.
- **Admin-Konfiguration (`src/app/admin/settings/tabs/GeneralTab.tsx`):**
  - Neuer Schalter für „Automatische Rückkehr zum Hauptrechner (Auto-Failback)“, abgesichert über `haAutoFailback` in `EventConfig` und Config-Whitelist.
- **Bedienungsanleitung (`docs/ANLEITUNG.md`):**
  - Kapitel 15 um die Funktionsweise von Auto-Failback und den 3-Stufen-Schutz beim Kassieren erweitert.
- **Automatisierte Tests (`src/__tests__/ha_auto_failback.test.ts`):**
  - 8 neue Unittests für Handover, Secret-Schutz, Demote-Logik und Konfiguration (444 Tests in 63 Suiten ausnahmslos bestanden).

## v0.4.71 – KDS FIFO-Sortierung von links nach rechts & automatische Warengruppen-Platzersparnis (28.09.2026)

> Ergonomische Tisch-Sortierung im Küchen- und Ausschankmonitor nach natürlicher Leserichtung von links nach rechts (am längsten wartende, dringendste Tische stehen auf Platz 1 ganz links im Direktblick ohne Scrollen, neue Bestellungen reihen sich nach rechts an), automatisches Ausblenden überflüssiger Warengruppen-Trennbalken bei Einzelfiltern oder reinen Speisen-/Getränketischen zur maximalen vertikalen Platzersparnis auf Tablets und Bildschirmen sowie erweiterte Unit- und Integrationstests.

### Weshalb
1. **Ergonomische FIFO-Sortierung von links nach rechts:** Wenn mehr Tische aktiv sind als auf die Monitorbreite passen, startet der Bildschirm standardmäßig ganz links (Scrollposition 0). Bei der bisherigen Rechts-Platzierung der ältesten Tische sah die Küchen- oder Schankkraft beim ersten Blick nur die allerneuesten Bestellungen, während die ältesten, dringendsten Tische rechts aus dem Bildschirm herausgeschoben waren und erst durch mühsames horizontales Scrollen gesucht werden mussten. Die natürliche und ergonomische Lösung platziert die am längsten wartenden Tische ganz links auf Index 0, sodass sie sofort im Blickfeld liegen.
2. **Automatische Platzersparnis bei Warengruppen:** Wenn im Filter oben nur eine einzige Warengruppe ausgewählt ist (z. B. Grill-Tablet nur für Speisen, Schank-Tablet nur für Getränke) oder wenn ein Tisch ohnehin nur Artikel aus einer einzigen Gruppe enthält, ist eine Zwischenüberschrift wie `[ KÜCHE – 2 offen ]` auf jeder einzelnen Tischkarte doppelt gemoppelt. Durch das automatische Ausblenden dieser Leiste schließen die Artikel direkt oben an, was wertvollen vertikalen Platz spart und unnötiges Scrollen innerhalb der Tischkarte verhindert.

### Wie (Technik)
- **Tisch-Sortierung (`src/app/kitchen/page.tsx`):**
  - In `tableGroups` wird die Liste aufsteigend nach `oldestTimestamp` sortiert: `list.sort((a, b) => a.oldestTimestamp - b.oldestTimestamp)`. Der älteste Tisch steht damit verlässlich an Position 0 (ganz links).
  - Neu eintreffende Tische reihen sich rechts an. Wird der älteste Tisch fertig gemeldet und abgehakt, rücken die nächsten Tische automatisch von rechts nach links nach.
- **Warengruppen-Trennbalken (`src/app/kitchen/page.tsx`):**
  - Ermittlung von `isSingleCategoryFilter = selectedCategoryIds.length === 1 || categories.length <= 1`.
  - Bedingung für die Anzeige des Trennbalkens: `showCategoryHeader = !isSingleCategoryFilter && categoryGroups.length > 1`.
  - Bei Einzelfiltern oder Tischen mit nur einer Warengruppe wird der Trennbalken ausgeblendet; bei Tischen mit gemischten Warengruppen (z. B. Speisen UND Getränke) bleibt die übersichtliche Farb-Trennung aktiv.
- **Bedienungsanleitung (`docs/ANLEITUNG.md`):**
  - Kapitel 3 um die ergonomische Sortierung von links nach rechts und die automatische Platzersparnis erweitert.
- **Automatisierte Tests (`src/__tests__/kds_table_flow_and_delay_ticket.test.ts`, `src/__tests__/kds_ergonomics_history_v0470.test.ts`):**
  - Tests an die neue FIFO-Reihenfolge (ältester Tisch links auf Index 0) angepasst.
  - Neuer Testfall für die Bedingungslogik der Warengruppen-Trennleisten.
  - 61 Test-Dateien mit 431 Tests ausnahmslos grün (100% bestanden).

## v0.4.70 – KDS Doppel-Druckschutz, Tages-Historie mit Wiederherstellung, Vollbild per Kochmütze, ergonomischer Haken & dynamische Warengruppen-Farben (28.09.2026)

> Zuverlässiger Doppel-Druckschutz für alle Betriebsmodi und Storno-Verzögerungstimer, sauberes automatisches Abräumen erledigter Tische im Küchenmonitor, neue Tages-Historie aller fertiggestellten Tische mit vollständigen Detailinformationen und Ein-Klick-Wiederherstellung, Touch-Vollbildmodus per Fingertipp auf die Kochmütze (analog zur Bonkasse), ergonomischer Haken-Button im Tisch-Kopf zur schnellen Gesamtauswahl/Abwahl neben einer statischen (nicht-pulsierenden) Wartezeit-Anzeige, kompaktere Tischspalten (4–5 Tische nebeneinander), dynamische Übernahme der im Artikelstamm angelegten Warengruppen-Farben mit Ausblendung leerer Gruppen sowie ein neuer Konfigurationsschalter für Kellner-Fertigmeldungsbenachrichtigungen (Standard: Aus).

### Weshalb
1. **Garantierter Doppel-Druckschutz:** Beim Umschalten zwischen „Reine Überwachung“ und „Monitor steuert Druck“ konnten Bons unter bestimmten Bedingungen doppelt gedruckt werden, wenn zuvor eine Bestellverzögerung für Tisch-Stornos aktiv war und der Hintergrund-Timer nach der Freigabe auf dem KDS auslöste. Das Druck- und Warteschlangensystem muss atomar garantieren, dass jede Position genau einmal gedruckt wird.
2. **Sauberes Abräumen im Küchenmonitor:** In der Betriebsart „Reine Überwachung“ blieben Tische nach dem Antippen von „Tisch komplett fertig“ mit 0 offenen Positionen und durchgestrichenen Zeilen dauerhaft auf dem Monitor stehen, da die Bestellung im Kassensystem bis zur Bezahlung des Gastes noch aktiv geführt wurde.
3. **Tages-Historie mit Wiederherstellung:** Falls das Küchenteam einen Tisch im Eifer des Gefechts versehentlich fertigmeldet oder nachvollziehen möchte, was wann zubereitet wurde, soll eine übersichtliche Tages-Historie bereitstehen, aus der Tische oder einzelne Positionen mit einem Klick sofort wieder auf den aktiven Monitor zurückgeholt werden können.
4. **Touch-Ergonomie & Vollbild:** Die Kochmütze im KDS-Kopf soll wie in der Bonkasse den Vollbildmodus aktivieren/beenden. Die Wartezeit soll nicht mehr unruhig blinken/pulsieren. Ein ergonomischer Haken-Button im Tischkopf ersetzt den redundanten Textlink am unteren Rand. Zudem sorgen schlankere Spalten dafür, dass mehr Tische gleichzeitig auf Tablets Platz finden.
5. **Warengruppen-Farben & Ausblenden:** Die Trennbalken der Warengruppen sollen exakt die Farben widerspiegeln, die im Artikelstamm hinterlegt sind. Gruppen ohne Positionen (z. B. keine Getränke) sollen nicht dargestellt werden.
6. **Optionale Kellner-Benachrichtigung:** Signalton und Benachrichtigungsbanner beim Kellner bei Fertigmeldung sollen optional zuschaltbar sein, standardmäßig aber ausgeschaltet bleiben, um Unruhe im Service zu vermeiden.

### Wie (Technik)
- **Doppel-Druckschutz (`src/lib/order-delay-manager.ts`, `src/app/api/kds/print/route.ts`, `src/lib/printer/ticket-splitter.ts`, `src/lib/printer/network-spooler.ts`):**
  - `cancelDelayedPrint(orderId)` bricht anstehende Hintergrund-Timer für verspäteten Bondruck bei Freigabe oder Moduswechsel sofort ab.
  - `executeDelayedPrint` filtert Positionen auf `printStatus: { not: 'PRINTED' }`. Sind alle Positionen bereits gedruckt, wird kein Druckjob erzeugt.
  - `TicketSplitter.routeAndPrintOrder` ignoriert Positionen mit `printStatus === 'PRINTED'` (außer bei explizitem `forceReprint: true`).
  - `/api/kds/print` schickt nur noch Positionen an den Druckerspooler, die noch nicht gedruckt wurden.
- **Abräum-Logik & KDS-Historie (`src/app/kitchen/page.tsx`, `src/app/api/orders/route.ts`, `src/app/api/kds/undo/route.ts`):**
  - `activeTableGroups` und `activeOrders` filtern erledigte Einheiten (`openItems.length === 0`) sofort aus der Live-Arbeitsfläche aus.
  - `/api/orders?kdsHistory=true` liefert alle heute fertiggestellten Bestellungen.
  - Neuer Button `Historie` im KDS-Kopf mit Zählerplakette; modales Fenster zeigt alle erledigten Tische mit Tischnummer, Bedienung, Bon-Nummern, Uhrzeit und allen zubereiteten Artikeln samt Varianten und Notizen.
  - Integrierte Wiederherstellungsfunktion über `/api/kds/undo` bzw. Status-PUT holt versehentlich fertiggemeldete Tische mit einem Fingertipp wieder auf den Monitor zurück.
- **KDS Layout & Ergonomie (`src/app/kitchen/page.tsx`):**
  - ChefHat-Icon als Vollbild-Umschalter mit Web-Fullscreen-API (`requestFullscreen` / `exitFullscreen`).
  - Entfernung von `animate-pulse` aus den Wartezeit-Plaketten.
  - Wartezeit-Plakette nach links gerückt; rechts daneben neuer Haken-Button zur Tisch-Gesamtauswahl/Abwahl (`toggleSelectTableItems`).
  - Tischspaltenbreite auf `min-w-[260px] max-w-[290px]` optimiert.
  - Dynamische Warengruppen-Farbcodierung (`ProductCategory.color`) an den linken Akzenträndern und Zählern.
- **Optionale Kellner-Benachrichtigung (`prisma/schema.prisma`, `src/app/admin/settings/tabs/PrintersTab.tsx`, `src/app/api/kds/mode/route.ts`, `src/app/api/orders/[id]/status/route.ts`):**
  - Neues Feld `kdsNotifyWaitersOnReady` (Boolean, Default `false`) in `EventConfig`.
  - Whitelist- und Endpunkt-Registrierung.
  - Umschalter in den Druckereinstellungen unter *Küchenmonitor*.
  - `order:ready` Socket-Event wird nur noch ausgelöst, wenn `kdsNotifyWaitersOnReady === true` ist.
- **Bedienungsanleitung (`docs/ANLEITUNG.md`):**
  - Kapitel 3 um alle neuen KDS-Funktionen, Vollbild, Historie und Druckschutz-Details erweitert.
- **Automatisierte Tests & Verifikation:**
  - `src/__tests__/kds_ergonomics_history_v0470.test.ts` neu angelegt.
  - 61 Testsuiten mit 429 Tests ausnahmslos bestanden (100% grün).
  - Next.js Produktions-Build (`npm run build`) fehlerfrei abgeschlossen.

## v0.4.64 – Konfigurierbare Papierrollen-Erkennung & Stopp-Bon Schalter (23.09.2026)

> Einführung eines zentralen Schalters in den Admin-Einstellungen (`/admin/settings` → Reiter *Drucker*), mit dem die Papierrollen-Erkennung und der automatische geräuschlose Stopp-Bon bei fast leerer Rolle flexibel aktiviert oder deaktiviert werden können. Bei deaktivierter Überwachung druckt der Drucker ohne Vorwarnung oder Stopp-Bons ganz normal bis zum physischen Ende durch; in der Druckerverwaltung (`/admin/printers`) wird der Deaktivierungsstatus transparent angezeigt.

### Weshalb
Auf manchen Veranstaltungen oder bei bestimmten Druckermodellen (z. B. wenn nicht-originale Rollen mit abweichendem Innendurchmesser verwendet werden oder der Sensorhebel dejustiert ist) kann es erwünscht sein, die automatische Hebelabfrage und den Warnbon abzuschalten, damit der Druckbetrieb ohne Unterbrechung bis zum letzten Zentimeter weiterläuft.

### Wie (Technik)
- **Schema & Whitelist (`prisma/schema.prisma`, `src/lib/config-whitelist.ts`, `src/types/domain.ts`):**
  - Neues Feld `enablePaperNearEndWarning` (Boolean, Default `true`) zu `EventConfig` hinzugefügt.
  - Whitelist-Registrierung in `ALLOWED_CONFIG_FIELDS` und `CONFIG_BOOLEAN_FIELDS`.
- **Drucker-Spooler (`src/lib/printer/network-spooler.ts`):**
  - In `handlePrinterSensorUpdate` und `checkNearEndCountdownAndTriggerStop` wird geprüft, ob `enablePaperNearEndWarning !== false` ist. Ist die Option deaktiviert, werden aktive Tracker verworfen und kein Stopp-Bon generiert.
- **Admin-Benutzeroberflächen (`src/app/admin/settings/tabs/PrintersTab.tsx`, `src/app/admin/printers/page.tsx`):**
  - Eigener Ein-/Aus-Schalter mit Erläuterungskasten im Reiter *Drucker* der Einstellungen.
  - In der Druckerverwaltung zeigt die Sensor-Statusplakette bei Deaktivierung: `⚪ Rollen-Überwachung deaktiviert (in Einstellungen)`.
- **Bedienungsanleitung & Handbuch (`docs/ANLEITUNG.md`, `src/app/docs/handbook-data.ts`):**
  - Kapitel 13 in `docs/ANLEITUNG.md` und Kapitel 6.2 in `handbook-data.ts` um die Schalterfunktion ergänzt.
- **Automatisierte Tests & Verifikation:**
  - 58 Testsuiten mit 397 Tests ausnahmslos grün (100% bestanden).

## v0.4.63 – Bonverbrauchsrechner, Rollen-Vorwarnung mit geräuschlosem Stopp-Bon, USB-Drucker-Relay & Orientierungs-Randleisten im Tischplan (23.09.2026)

> Einführung eines millimetergenauen Bonverbrauchsrechners für alle Belegarten (Standardbon, Küchen-Einzelbon, Storno, X- und Z-Berichte), Erfassung und manuelle Korrektur des Papierverbrauchs in Metern pro Drucker im Festbetrieb und im Abschlussbericht, Live-Statusanzeige des Papierrollen-Vorwarnhebels mit automatischem geräuschlosem Stopp-Bon vor Rollenende, Freigabe lokaler USB-Drucker für alle mobilen Endgeräte über ein browserbasiertes Web-Relay (WebSerial + WebSockets) sowie frei beschriftbare Orientierungs-Randleisten an allen 4 Seiten des grafischen Tischplans (sichtbar ausschließlich im Plan-Designer und im Raumplan-Ausdruck).

### Weshalb
1. **Bonverbrauchsrechner in Metern je Drucker:** Auf Festen und Großveranstaltungen war bisher unklar, wie viel Papierrollen verbraucht wurden und wann eine Rolle vorausschauend getauscht werden sollte. Durch millimetergenaue Längenberechnung jedes Druckjobs (Zeilenvorschub, Text, Barcodes, Logos, Papierschnitt) und Summierung in Metern je Drucker lässt sich der Verbrauch exakt planen. Zudem können die Zählerstände manuell angepasst oder bei Rollenwechsel genullt werden.
2. **Erkennung „Rolle fast leer“ & Stopp-Bon:** Thermobondrucker verfügen über einen mechanischen Fühlerhebel, der den Rollendurchmesser abtastet und bei ca. 1,5 bis 2,5 m Restpapier auslöst. Dieser Status wird nun via DLE EOT 4 abgefragt. Droht das Papier auszugehen, schützt ein automatischer, geräuschloser Stopp-Bon („STOPP - LETZTER BON AUF DIESER ROLLE!“) davor, dass nachfolgende Bestellungen unvollständig abreißen. Auf ausdrücklichen Wunsch ertönt kein schriller Warnton.
3. **USB-Drucker an Arbeitsstationen netzwerkweit erreichbar (Web-Relay):** An stationären Kassen (z. B. Theken-Laptop) hängen Drucker oft per USB-Kabel. Ohne Netzwerkkarte oder komplexe Betriebssystem-Druckerfreigaben (Lösung C) können diese nun per WebSerial direkt im Browser gekoppelt und über einen WebSocket-Relay-Kanal allen Kellner-Handys und Tablets im Netz zur Verfügung gestellt werden.
4. **Tischplan-Randleisten für Raumorientierung:** Helfer und Servicekräfte benötigen auf dem Raumplan feste Orientierungspunkte (Eingänge, Notausgänge, Küche, Ausschank, WC, Bühne). Am Rand des Tischplan-Gitters wurden Leisten mit halbhohen/halbreiten Feldern geschaffen, die sich flexibel beschriften, einfärben und über mehrere Tische strecken lassen. Um die Kellner-Oberfläche am Smartphone nicht zu überladen, sind diese Randleisten strikt auf den Designer (`/admin/tables`) und den Ausdruck (`/admin/tables/print`) beschränkt.

### Wie (Technik)
- **Datenbank & Schema (`prisma/schema.prisma`):**
  - `EventConfig.tablePlanLandmarks`: JSON-Feld für Orientierungsmarkierungen.
  - `Printer`: Felder `connectionType` (`NETWORK`, `SERVER_USB`, `WEB_RELAY`, `VIRTUAL`), `relayStation`, `totalPaperMm`, `rollLengthM`, `sensorNearEndActive`, `paperSensorState`, `calibLineMm`, `calibFeedMm`.
  - `PrintJob`: Felder `lengthMm` und `ticketType`.
- **Drucker-Logik & ESC/POS-Builder (`src/lib/printer/escpos-builder.ts`, `src/lib/printer/network-spooler.ts`, `server.js`):**
  - `EscPosBuilder`: Akkumuliert physische Beleglänge (`lengthMm`) über alle Befehle (Zeilenvorschub, Zeichenhöhe, Bildzeilen, QR-Codes, Header/Cutter-Abstand).
  - Neuer Stopp-Bon `buildPaperEmptyStopTicket()` und Vorwarn-Bon `buildPaperNearEndTicket()` – garantiert ohne Summer-Befehl (`\x1b\x1e`).
  - Spooler fragt DLE EOT 4 (`0x10, 0x04, 0x04`) ab und zählt bei aktivem Vorwarnhebel Restpapier herunter; löst bei <= 250 mm automatisch den Stopp-Bon aus.
  - Web-Relay: Server vermittelt Druckjobs an gekoppelte Kassenstationen via `printer:relay_job` und quittiert mit `printer:relay_ack`.
- **Benutzeroberflächen (`src/app/admin/printers/page.tsx`, `src/app/admin/reports/page.tsx`, `src/app/admin/tables/page.tsx`, `src/app/admin/tables/print/page.tsx`):**
  - Druckerverwaltung: Anzeige der Verbindungsarten, Hebel-Sensorstatus („🟢 Sensorhebel ruht“ vs. „⚠️ Vorwarnhebel aktiv“), Papierverbrauchs-Fortschrittsbalken, Rollenwechsel-Reset und modales Fenster zur manuellen Meter-Korrektur.
  - Kassenbericht: Neue Karte „Bon- & Papierverbrauch der Veranstaltung“ mit verbrauchten Metern je Drucker und Gesamtverbrauch.
  - Tischplan-Designer: 4 umlaufende Randleisten (Nord, Süd, West, Ost) mit Hinzufügen/Bearbeiten/Löschen von Orientierungsfeldern (Presets: Tür, Notausgang, Küche, Bar, WC, Bühne, Garderobe, freier Text, Farbpaletten, Span).
  - Tischplan-Druckansicht: Renderung der Randleisten um das Tischnetz mit klaren Rändern und zentriertem Text.
  - Waiter-View (`/waiter`): Unverändert frei von Randleisten zur maximalen Touch-Ergonomie.
- **Bedienungsanleitung & Handbuch (`docs/ANLEITUNG.md`, `src/app/docs/handbook-data.ts`):**
  - Kapitel 13 & 14 in `docs/ANLEITUNG.md` sowie Kapitel 6.1, 6.2, 6.5 und 6.6 im In-App-Handbuch in einfacher, verständlicher Sprache ergänzt.
- **Automatisierte Tests & Verifikation:**
  - `src/__tests__/paper_consumption_and_landmarks_v0463.test.ts` (10 Tests) neu angelegt.
  - Gesamter Testkatalog: 58 Testsuiten, 396 Tests ausnahmslos bestanden (100% grün).

## v0.4.62 – Kompakte Menüleiste (Option A), ruckelfreie Server-Uptime & Aktualisierung der GitHub-README Screenshots (21.09.2026)

> Schlankes, platzsparendes Redesign der oberen Menüleiste (Option A mit kompaktem Internet-Globus und Statuspunkt, icon-basiertem Vollbild-Knopf, bereinigter Kassen-Uhr ohne Textüberhang sowie Zusammenführung der Server- und Hochverfügbarkeits-Statusanzeige), Behebung des Sekunden-Hin-und-Her-Springens der Server-Uptime durch Beseitigung des konkurrierenden 1000ms-Client-Tickers und Einführung einer monoton steigenden, glatt abgeschnittenen Uptime-Erfassung (Math.floor & Math.max) sowie vollständige Neuaufnahme aller 58 Screenshots der Benutzeroberfläche und Aktualisierung der GitHub-README.

### Weshalb
1. **Kompaktere obere Leiste (Option A):** Die Kopfleiste im Admin-Bereich war mit rund 670 Pixeln Breite überfrachtet. Insbesondere drei nebeneinanderliegende Statusplaketten (Internet online, Lokal (Aktiv), Online) sowie der ausgeschriebene Text „Vollbild“ führten auf Tablets und schmaleren Fenstern zu Zeilenumbrüchen oder Quetschungen. Mit Option A wird der Internet-Status zu einem eleganten Globus-Symbol mit farbigem Signalpunkt, der Vollbild-Knopf wird wie der Theme-Schalter ein reines Icon, die Kassen-Uhr verzichtet auf das Wort „Uhr“ und die Server-/HA-Verbindung wird in einer einzigen klaren Pille vereint. Die Breite schrumpft um ca. 50 % auf ~340 Pixel.
2. **Server-Uptime springt im Sekundenbereich hin und her:** Im System-Update (`/admin/system-update`) liefen zwei konkurrierende Zähler: Ein lokaler `setInterval(..., 1000)`-Ticker zählte jede Sekunde hoch, während gleichzeitig das 400ms-Polling bei jeder Antwort `data.uptime` mit gerundetem `Math.round(process.uptime())` setzte. Bei minimalen Netzwerkverzögerungen oder Taktphasenunterschieden überschrieb die Antwort des Servers den lokalen Zähler mit dem noch abgerundeten Vorsekunden-Wert, was zu einem sichtbaren Hin- und Herspringen der Sekunde führte.
3. **Screenshots in der README auf GitHub veraltet:** Die zentralen Bildschirmfotos in `README.md` und `public/docs/images/` stammten teilweise noch von Ende August oder Mitte September und zeigten weder die Kassen-Uhr noch die 400ms-Prozessormessung, den PDF-Speisekarten-Import, die Artikel-Zeitfenster oder die neue kompakte Menüleiste.

### Wie (Technik)
- **Kompakte Menüleiste (`src/components/navigation/navbar.tsx`, `src/components/ui/fullscreen-button.tsx`):**
  - Option A: Internet-Status als kompaktes `Globe`-Icon mit absolut positioniertem Statuspunkt (grün/gelb) und erklärendem Tooltip realisiert.
  - `FullscreenButton`: Textlabels („Vollbild“ / „Fenster“) entfernt, auf standardisiertes Icon-Design (`p-2 rounded-xl border`) mit `aria-label` und Tooltip umgestellt.
  - Kassen-Uhr: Textzusatz „Uhr“ entfernt, kompaktes Monospace-Format `12:07:52`.
  - Server- & HA-Status: Die beiden separaten Boxen `Lokal (Aktiv)` und `Online` zu einem einzigen Status-Element zusammengeführt (`Kasse`, bzw. `HA OK` / `HA Offline` bei Verbundbetrieb).
  - Rollenplakette (`ADMIN`): Ränder und Innenabstände harmonisiert (`px-2.5 py-1 text-[10px]`).
- **Harmonische & ruckelfreie Server-Uptime (`src/app/api/system/update/route.ts`, `src/app/admin/system-update/page.tsx`):**
  - `/api/system/update`: Uptime wird mit `Math.floor(process.uptime())` statt `Math.round()` ausgeliefert, um Rundungssprünge an der 0,5s-Grenze zu verhindern.
  - `SystemUpdatePage`: Konkurrierenden 1-Sekunden-`setInterval`-Effekt entfernt. `setLiveUptime` aktualisiert nun streng monoton (`Math.max(prev, data.uptime)`). Ein Zurückspringen der Sekunde ist mathematisch ausgeschlossen.
- **Aktualisierung aller Screenshots & GitHub README (`public/docs/images/`, `README.md`):**
  - Sämtliche 58 Screenshots über `capture-all-detailed-screenshots.js` und Puppeteer mit dem neuen Stand der Benutzeroberfläche (kompakte Leiste, Kassen-Uhr, PDF-Import, Artikel-Zeitfenster) neu aufgenommen.
  - `03_pos_counter.png`, `05_waiter_order.png` und `06_waiter_payment.png` auf den aktuellen Stand aktualisiert.
  - Badges und Beschreibungen in `README.md` auf Version `v0.4.62` und 57 Testsuiten / 386 Tests aktualisiert.
- **Handbuch (`src/app/docs/handbook-data.ts`):**
  - Als allerletzter Schritt Kapitel 9.6 um die kompakte Menüleiste und den Status-Globus ergänzt.
- **Automatisierte Tests & Verifikation:**
  - `src/__tests__/compact_navbar_and_smooth_uptime_v0462.test.ts` (5 Tests) neu angelegt.
  - Gesamter Testkatalog: 57 Testsuiten, 386 Tests ausnahmslos grün (100% Bestanden).

## v0.4.61 – Dauerbetrieb-Stabilität, Crash-Schutz & Anfrage-Überlastungsschutz (18.09.2026)

> Behebung von Instabilitäten im 24/7-Dauerbetrieb: Implementierung eines globalen Crash-Schutzes (Abfangen unvollständiger Client-Abbrüche und unbehandelter Fehler), Verhinderung von HTTP-Header-Abstürzen (ERR_HTTP_HEADERS_SENT), Überlastungsschutz für das 400ms-Echtzeit-Polling im Adminbereich (Verhinderung von Request-Stau durch In-Flight-Locks und Timeout), 3-Sekunden-Zwischenspeicher für die Sitzungsprüfung zur Schonung von SQLite sowie fehlerresistente mDNS-UDP-Sockets bei DHCP-Lease-Erneuerungen.

### Weshalb
1. **Server nach ca. 30 Minuten nicht mehr erreichbar:** Beim schnellen 400ms-Polling konnten sich bei kurzen Verzögerungen (z. B. während des zyklischen 5-Minuten-Datenbank-Backups) unvollständige Anfragen im Browser aufstauen. Wurde eine Anfrage abgebrochen oder riss die Verbindung ab, versuchte der Fehlerhandler in `server.js` den HTTP-Status 500 zu setzen, obwohl die Verbindung bereits beendet war. Dies führte zu `ERR_HTTP_HEADERS_SENT` und mangels globaler Absturzsicherung zum Beenden des Node.js-Prozesses.
2. **mDNS-Socket bei Router-IP-Erneuerung:** Alle 30 bis 60 Minuten erneuern WLAN-Router typischerweise die IP-Lease (DHCP). Dabei flappt kurz die Multicast-Route. Da der mDNS-UDP-Socket in `server.js` keinen Fehler-Listener hatte, führte dies zum harten Prozess-Crash.
3. **SQLite-Entlastung bei 400ms-Takt:** Bei 2,5 Abfragen pro Sekunde wurden pro Minute Hunderte identische Token-Prüfungen und synchrone Festplatten-I/O-Aufrufe (`statfsSync`) ausgeführt. Dies wurde durch Kurzzeit-Caching (3s für Session, 10s für Festplattenplatz) drastisch reduziert.

### Wie (Technik)
- **`server.js` (Absturzsicherung & Server-Härtung):**
  - Globale Absturzfänger `process.on('uncaughtException')` und `process.on('unhandledRejection')` implementiert.
  - Fehlerhandler in `server` und `httpsServer` prüfen vor dem Schreiben auf `!res.headersSent && !res.writableEnded`.
  - `clientError`- und `error`-Listener für HTTP- und HTTPS-Server registriert.
  - `mdnsSocket.on('error')` ergänzt und `mdnsSocket.send` mit Fehler-Callback abgesichert.
- **Client-Polling (`src/app/admin/dashboard/page.tsx`, `src/app/admin/system-update/page.tsx`):**
  - `isFetching`-Sperre und `AbortSignal.timeout(3000)` verhindern, dass sich überlappende Anfragen aufstauen können.
- **API & Session-Cache (`src/app/api/system/update/route.ts`, `src/lib/auth-session.ts`, `src/lib/db.ts`):**
  - Redundante zweite `requireAdmin`-Prüfung in `/api/system/update` entfernt.
  - 10-Sekunden-Cache für `getDiskSpace` integriert.
  - 3-Sekunden-In-Memory-Cache `sessionVerifyCache` in `auth-session.ts` implementiert.
  - `globalForPrisma.prisma = prisma` auch für Produktivumgebung sichergestellt.
- **Automatisierte Tests & Verifikation:**
  - `src/__tests__/crash_prevention_and_resilience_v0461.test.ts` (4 Tests) hinzugefügt.
  - Gesamter Testkatalog: 56 Testsuiten, 381 Tests vollständig grün.

## v0.4.60 – 400ms-Echtzeit-Systemmetriken, PDF-Worker Bundle-Fix & Kassen-Uhr im Adminbereich (18.09.2026)

> Verkürzung des Aktualisierungsintervalls für Prozessor- und Speicherauslastung auf ultrageschmeidige 400 ms (~2,5 Messungen pro Sekunde), Behebung des PDF-Worker-Ladefehlers in Next.js Server-Bundles durch direkte Registrierung und Ausklammerung aus dem Server-Bundling mit zusätzlichem Textstream-Fallback, dauerhafte Kassen-Uhr in der oberen Kopfleiste des Administrationsbereichs zur sekundengenauen Kontrolle der Artikel-Zeitfenster sowie entsprechende Dokumentation im Handbuch als allerletzter Schritt.

### Weshalb
1. **Verkürzung der Aktualisierungszeit auf 400 ms:** Die bisherigen 750 ms wurden auf Wunsch des Anwenders auf 400 ms verkürzt, um CPU- und RAM-Änderungen noch feiner und flüssiger im Dashboard und im System-Update abzubilden. Da die Messung über Schnappschuss-Deltas erfolgt, erzeugt auch dieser schnellere Takt weniger als 0,1 % Eigenlast.
2. **PDF-Erkennungsfehler beheben:** Beim Import von Speisekarten auf dem Produktionsserver kam es zum Fehler `Setting up fake worker failed: "Cannot find module .../pdf.worker.mjs"`. Next.js bündelte die Abhängigkeit `pdf-parse` in `.next/server/app/api/...`, wobei der relative Pfad zum Worker verloren ging. Dies wurde durch Eintrag in `serverComponentsExternalPackages` in `next.config.mjs`, absoluter Pfadregistrierung in `pdf-menu-extractor.ts` und resilientem Rohdaten-Fallback behoben.
3. **Kassen-Uhr in der Admin-Leiste:** Da Artikel-Zeitfenster (z. B. Mittagstisch 11:30 - 14:00 Uhr) auf der Systemzeit des zentralen Kassenrechners basieren, muss im Adminbereich jederzeit auf einen Blick ersichtlich sein, welche Uhrzeit der Server hat – unabhängig von der lokalen Uhrzeit des aufrufenden Client-Geräts.
4. **Handbuchanpassung als allerletzter Schritt:** Gemäß Vorgabe wurden die Kapitel 9.5 (400ms-Takt) und 9.6 (Kassen-Uhrzeit & Synchronisation) im Handbuch erst nach allen Code- und Testarbeiten erweitert.

### Wie (Technik)
- **Next.js Konfiguration & PDF-Worker (`next.config.mjs`, `src/lib/pdf-menu-extractor.ts`, `src/components/admin/pdf-menu-import-modal.tsx`):**
  - `next.config.mjs`: `"pdf-parse"` zu `serverComponentsExternalPackages` hinzugefügt, damit das Modul nativ aus `node_modules` importiert wird und keine relativen Asset-Pfade im Server-Build verliert.
  - `pdf-menu-extractor.ts`: `ensurePdfWorker()` ermittelt den absoluten Pfad zur `pdf.worker.mjs` im Dateisystem und registriert ihn als Datei-URL mit `PDFParse.setWorker()`. Zusätzlich robuster Fallback-Parser für Roh-Textströme integriert.
  - `PdfMenuImportModal`: Benutzerfreundliche Fehlerbehandlung mit Hinweistext und direkter Umschaltung auf das manuelle Textfeld bei unerwarteten Fehlern.
- **400ms-Echtzeit-Metriken (`src/app/api/system/update/route.ts`, `src/app/admin/system-update/page.tsx`, `src/app/admin/dashboard/page.tsx`):**
  - `system/update/route.ts`: Minimales Cache-Delta von 300 ms auf 150 ms reduziert; liefert zusätzlich `serverTimestamp` und `serverTime`.
  - `SystemUpdatePage` und `AdminDashboard`: Polling-Intervall von 750 ms auf 400 ms gesenkt.
- **Kassen-Uhr in Admin-Kopfleiste (`src/app/api/config/public/route.ts`, `src/components/navigation/navbar.tsx`):**
  - `/api/config/public`: Liefert `serverTimestamp` (`Date.now()`) und `serverTime` (ISO-String).
  - `Navbar`: Berechnet die Differenz zur lokalen Client-Uhr (`serverTimeOffset = serverTimestamp - Date.now()`), tickt sekundengenau und blendet im Adminbereich (`/admin`) ein dezentes, bernsteinfarben akzentuiertes Uhren-Badge (`Clock`-Icon mit pulsierender Animation und Tooltip für das Gesamtdatum) ein.
- **Handbuch (`src/app/docs/handbook-data.ts`):**
  - Kapitel 9.5 aktualisiert: 400 ms Taktzeit (~2,5 Messungen/Sekunde) dokumentiert.
  - Kapitel 9.6 ergänzt: Kassen-Uhr in der Admin-Leiste, Bedeutung für Artikel-Zeitfenster und automatische Synchronisation.
- **Automatisierte Tests & Verifikation:**
  - `src/__tests__/timewindows_and_pdf_import_v0459.test.ts` um Tests für `serverTimestamp` und `serverTime` im Public-Config-Endpunkt sowie 400ms-Snapshot-Taktung erweitert (10 von 10 Tests grün).
  - Gesamter Testkatalog: 55 Testsuiten, 377 Tests vollständig grün.

## v0.4.59 – Echtzeit-Systemmetriken (< 1s), Hardware-Kapazitätsplanung mit Prozessor-Generationen, PDF-Speisekarten-Import & Artikel-Zeitfenster (18.09.2026)

> Einführung von Sub-Sekunden-Systemmetriken (CPU- und RAM-Last alle 750 ms live im Admin-Dashboard und System-Update ohne Performanceverlust durch Snapshot-Delta-Caching), umfassende Hardware-Empfehlungen und Kapazitätsplanung nach Festgröße mit konkreten Prozessor-Generationen im Handbuch, intelligenter PDF-Speisekarten-Import mit automatischer Erkennung von Speisen, Getränken, Preisen und Steuersätzen inklusive interaktiver, editierbarer Vorschlags-Tabelle, zeitgesteuerte Artikel-Sichtbarkeit über flexible Zeitfenster (mit Wochentagen und Mitternachtsübergang) sowie automatische Ausblendung inaktiver Artikel auf Kasse und Kellnergeräten.

### Weshalb
1. **Echtzeit-CPU- und RAM-Last (< 1s):** Die Kassenleitung benötigt während des Festes bei Lastspitzen sofortige Rückmeldung über die Systemauslastung des Kassenrechners, ohne 10 Sekunden auf den nächsten Poll warten zu müssen. Durch ein Snapshot-Delta-Caching liefert das System die CPU- und Speicherauslastung alle 750 Millisekunden in unter 1 ms ab, verbraucht weniger als 0,1 % eigene CPU-Leistung und schont durch automatisches Pausieren bei minimiertem Tab die Ressourcen.
2. **Hardware-Kapazitätsplanung & Prozessor-Generationen im Handbuch:** Vereine und Festveranstalter müssen genau wissen, wie viele Geräte (Kellner-Handys, Bonkassen, KDS-Bildschirme) an ihren Hauptrechner angebunden werden können. Im Handbuch wurden konkrete Hardware-Empfehlungen nach Festgröße (klein, mittel, groß) mit genauen Mindest-Prozessorgenerationen (z. B. mind. Core i3-2350M, Intel N95/N100, i5 ab 6. bzw. 10. Generation, AMD Ryzen, Raspberry Pi 4/5) hinterlegt.
3. **PDF-Speisekarten-Import mit interaktiver Vorschlagstabelle:** Das manuelle Eintippen dutzender Artikel und Preise vor dem Fest ist zeitraubend. Der neue PDF-Import analysiert Speisekarten-PDFs oder Flyer automatisch, ordnet Gerichte und Getränke den Warengruppen zu, ermittelt die passenden Steuersätze (7 % Speisen, 19 % Getränke) und stellt die Vorschläge in einer interaktiven Tabelle bereit, in der jeder Wert vor der 1-Klick-Übernahme korrigiert werden kann.
4. **Artikel-Zeitfenster (zeitgesteuerte Sichtbarkeit):** Speisen und Getränke wie Mittagstisch, Kaffee & Kuchen oder Bar-Drinks dürfen nur zu bestimmten Zeiten bestellbar sein. Artikel können nun per Checkbox mit Zeitfenstern (Uhrzeit von/bis, Wochentagsfilter, Mitternachtsübergang) versehen werden. Außerhalb dieser Zeiten werden sie an der Kasse und auf Kellnergeräten automatisch ausgeblendet, bleiben im Admin-Bereich jedoch mit Status-Badge sichtbar.
5. **Handbuchanpassung als allerletzter Schritt:** Wie vereinbart erfolgte die Handbuchanpassung streng als allerletzter Schritt nach vollständiger Implementierung und Verifikation aller Funktionen.

### Wie (Technik)
- **Sub-Sekunden-Systemmetriken (`src/app/api/system/update/route.ts`, `src/app/admin/dashboard/page.tsx`, `src/app/admin/system-update/page.tsx`):**
  - In-Memory-Snapshot `lastCpuSnapshot = { times: cpus, timestamp: Date.now() }` implementiert: Folgerequests berechnen das CPU-Delta direkt aus der Differenz zum vorherigen Poll, wodurch der blockierende 120ms-Timeout entfällt.
  - Abfrageintervall in `SystemUpdatePage` und Live-Badge in `AdminDashboard` auf 750 ms umgestellt.
  - `document.visibilityState`-Listener pausiert Polling bei inaktivem oder minimiertem Tab.
- **Datenbankschema & Zeitfenster-Engine (`prisma/schema.prisma`, `src/lib/time-window.ts`, `src/types/domain.ts`):**
  - Modell `Product` um `hasTimeWindows Boolean @default(false)` und `timeWindows String? @default("[]")` erweitert; DB synchronisiert mit `prisma db push`.
  - `src/lib/time-window.ts` mit `isProductActiveNow()`, `parseTimeWindows()`, `getTimeWindowSummary()` und Wochentags-Unterstützung (inkl. Mitternachtsübergang z. B. 21:00 bis 02:00 Uhr) implementiert.
  - POS (`src/app/pos/page.tsx`) und Kellneransicht (`src/app/waiter/order/page.tsx`) filtern inaktive Artikel automatisch aus.
  - Artikelverwaltung (`src/app/admin/products/page.tsx`): Checkbox "Zeitfenster aktivieren", dynamische Zeitfenster-Liste (Name, Von, Bis, Wochentagstoggles, Löschen) und optisches Aktiv-/Inaktiv-Statusbadge in der Produktkarte integriert.
- **PDF-Speisekarten Extraktor & Batch-Import (`src/lib/pdf-menu-extractor.ts`, `src/app/api/products/pdf-preview/route.ts`, `src/app/api/products/batch-import/route.ts`, `src/components/admin/pdf-menu-import-modal.tsx`):**
  - `pdf-menu-extractor.ts`: Liest PDF-Buffer via `pdf-parse` v2 aus, erkennt Artikelzeilen und Preise via Regex, unterscheidet Speisen/Getränke anhand von Schlüsselwörtern und weist 7 % bzw. 19 % MwSt. zu.
  - `/api/products/pdf-preview`: Liefert geparste Artikelvorschläge mit Konfidenzwert und gleicht bestehende Warengruppen ab.
  - `/api/products/batch-import`: Übernimmt ausgewählte Artikel, legt fehlende Kategorien automatisch mit `sortIndex` an und aktualisiert bestehende Artikel.
  - `PdfMenuImportModal`: Modal mit Drag & Drop / Dateiauswahl, Textfeld-Alternative, Such- und Kategoriefilter, editierbarer Tabelle (Name, Preis, Warengruppe, MwSt.), Zeilen-Hinzufügen/Löschen und 1-Klick-Übernahme. Button "PDF-Karte importieren" in der Toolbar verankert.
- **Handbuch (`src/app/docs/handbook-data.ts`):**
  - Kapitel 1.8 hinzugefügt: Hardware-Empfehlungen & Kapazitätsplanung nach Festgröße mit konkreten CPU-Generationen (i3-2350M, Celeron N4100, N95/N100, Core i5 ab 6./10. Generation, Ryzen, Pi 4/5) und LAN-Kabel-Empfehlung.
  - Kapitel 5.7 & 5.8 hinzugefügt: PDF-Speisekarten-Import (Auto-Erkennung & Vorschlagstabelle) und Artikel-Zeitfenster (zeitgesteuerte Sichtbarkeit).
  - Kapitel 9.5 erweitert: Echtzeit-Auslastung (< 1s Intervall, 750 ms) mit Erklärung zu vernachlässigbarem Performance-Einfluss (< 0,1 %) und Stromsparmodus.
- **Automatisierte Tests & Verifikation:**
  - `src/__tests__/timewindows_and_pdf_import_v0459.test.ts` angelegt (9 Tests).
  - Gesamter Testkatalog: 55 Testsuiten, 376 Tests vollständig grün.
  - Next.js Produktions-Build (`npm run build`) fehlerfrei.

## v0.4.58 – KDS-Vertikal-Scrollen, Schicht-Pausen vs. Schichtende, Zeiterfassung auf Abrechnungsbeleg, PIN-Overlay & reines Android Root-CA (18.09.2026)

> Vollständige Umstellung des Küchen- und Ausschankmonitors auf vertikales Scrollen mit dauerhaft fixierter oberer Filterleiste, intelligenter Abmeldedialog mit Unterscheidung zwischen "Kurze Pause (Nur sperren)" und "Schicht beenden (Ganz abmelden)", automatische Neuvergabe der Kellner-Kennnummer bei neuem Schichtstart, lückenlose Erfassung von An- und Abmeldedatum inklusive Uhrzeit in Personal & Abrechnung sowie auf dem Thermobon- und A4-Beleg, sofortiges Schließen des Hauptmenüs beim Stationswechsel mit z-Index-Anhebung des PIN-Zahlenfelds und Bereitstellung eines reinen Android Root-CA-Zertifikats ohne Private-Key-Anforderung.

### Weshalb
1. **Küchenmonitor ohne abgeschnittene Bons & feste Filter:** Bei starkem Festbetrieb mit vielen Bestellungen ragten Kacheln bisher nach rechts über den Bildschirmrand hinaus, und die Kopfzeile scrollte mit weg. Die Kopfleiste mit allen Filtern (Ausverkauft, Warengruppen, Sortierung) muss fest im Blickfeld bleiben, während die Bestellkarten in einer responsiven 1- bis 5-Spalten-Matrix nach unten durchscrollen.
2. **Helferauswahl ohne versehentliches Umschalten:** In der Kellneransicht führte das Antippen eines Namens aus der Schnellauswahl bisher zum sofortigen Umschalten. Zur Vermeidung von Fehlbuchungen muss das Antippen den Namen nur ins Eingabefeld übernehmen; der Wechsel wird erst nach Klick auf "Wechseln & Weiter" wirksam.
3. **Schichtpause vs. Schichtende:** Verlässt eine Bedienung kurz das Zelt (WC, Essenspause), soll das Gerät nur gesperrt werden, ohne dass die Schicht beendet wird oder eine neue Kennnummer entsteht. Beim endgültigen Schichtende wird die Schicht abgeschlossen und die genaue Abmeldezeit gespeichert. Meldet sich dieselbe Person später erneut an, wird automatisch eine neue Schicht mit neuer Kennnummer und frischer Schichtzeit begonnen.
4. **Lückenlose Zeiterfassung auf Belegen:** Für Verein und Kassenleitung müssen Beginn (Anmeldedatum und Uhrzeit) und Ende (Abmeldedatum und Uhrzeit) sowie Schicht-ID und Kellner-Kennnummer transparent nachvollziehbar sein – sowohl in der Admin-Abrechnung (`/admin/settle`) als auch auf dem ausgedruckten Abrechnungsbeleg (Bon und A4).
5. **Unterbrechungsfreier Stationswechsel:** Beim Wechseln der Station über das Hauptmenü lag das PIN-Zahlenfeld bisher verdeckt hinter der Menüleiste, sodass man das Menü erst manuell schließen musste. Beim Antippen einer Station muss sich das Menü sofort schließen und das PIN-Feld direkt im Vordergrund erscheinen.
6. **Android-Zertifikatsimport ohne Privaten Schlüssel:** Bei der Installation des Zertifikats forderte Android die Eingabe eines privaten Schlüssels, da das Zertifikat als Serverausweis formatiert war. Ein reines Root-CA Stammzertifikat (`openbon-ca.crt`) löst dieses Problem und lässt sich als reines CA-Vertrauenszertifikat ohne Kennwort oder privaten Schlüssel in Android importieren.
7. **Handbuch als letzter Schritt:** Die Dokumentation wurde als allerletzter Schritt in einfachen Worten ohne Fachbegriffe aktualisiert.

### Wie (Technik)
- **Küchenmonitor-Layout (`src/app/kitchen/page.tsx`):**
  - Kopfleiste auf `shrink-0` gesetzt für dauerhafte Fixierung am oberen Bildschirmrand.
  - KDS-Bestellcontainer auf `flex-1 overflow-y-auto` umgestellt.
  - Kachelmatrix als responsives Grid `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5` definiert, Karten auf `w-full` angepasst und Aktionsknöpfe ergonomisch dimensioniert.
- **Datenbankschema & Schichtstatus (`prisma/schema.prisma`):**
  - Modell `WaiterProfile` um `isPaused Boolean @default(false)`, `loggedInAt DateTime @default(now())` und `loggedOutAt DateTime?` erweitert.
  - Eindeutigkeitseinschränkung `@unique` auf dem Feld `name` entfernt, um historische Mehrfachschichten derselben Bedienung lückenlos zu speichern.
  - Datenbankschema via `prisma db push` synchronisiert.
- **Bediener-Kennnummern & Schichtzuweisung (`src/lib/waiter-number.ts`):**
  - `getOrAssignWaiterNumber` um den Parameter `forceNew = false` erweitert.
  - Prüft zunächst auf eine offene oder pausierte Schicht desselben Namens; bei `forceNew = true` oder beendeter Vorschicht wird die nächste freie Kennnummer (1..99) vergeben.
- **Check-in & Abmelde-Routen (`src/app/api/waiters/checkin/route.ts`, `src/app/api/waiters/logout/route.ts`):**
  - `checkin`: Hebt bei pausierten Schichten die Pausierung auf (`isPaused = false`); startet bei beendeten Schichten eine neue Schicht mit neuer ID und frischem `loggedInAt`.
  - `logout`: Neue dedizierte API-Route für `mode: 'PAUSE'` (setzt `isPaused = true`) und `mode: 'FULL'` (setzt `isActive = false`, `loggedOutAt = new Date()`).
- **Kellneransicht & Dialoge (`src/app/waiter/page.tsx`):**
  - Schnellauswahl trägt Namen nur in das Eingabefeld ein.
  - Abmelde-Knopf öffnet Auswahldialog mit "Kurze Pause (Nur sperren)" vs. "Schicht beenden (Ganz abmelden)".
- **Schichtabrechnung & Belegdruck (`src/app/admin/settle/page.tsx`, `src/lib/printer/escpos-builder.ts`, `src/app/api/waiters/settle/route.ts`, `src/app/api/waiters/settle/report/route.ts`):**
  - In `/admin/settle`: Anzeige von Kellner-Kennnummer, Pausenstatus sowie An- und Abmeldedatum mit Uhrzeit in der Helferauswahl, Bestätigung und Übersichtstabelle.
  - `EscPosBuilder.buildSettlementTicket`: Druckt Kellner-Kennnummer, Schicht-ID sowie Beginn und Ende mit Datum und Uhrzeit auf den Abrechnungs-Bon.
- **Navigation & PIN-Overlay (`src/components/navigation/navbar.tsx`, `src/components/auth/pin-modal.tsx`):**
  - In `handleRoleSelection` wird `setIsOpen(false)` sofort aufgerufen.
  - PIN-Modal z-Index auf `z-[100]` angehoben.
- **Android Root-CA Zertifikat (`server.js`, `src/app/api/system/cert/route.ts`, `src/app/admin/qr-codes/page.tsx`):**
  - Generierung eines reinen Root-CA Zertifikats (`ca.crt`) mit `basicConstraints: { cA: true, critical: true }` und Signierung des Server-Zertifikats damit.
  - Bereitstellung des Downloads als `openbon-ca.crt` und Dokumentation der Android CA-Speicher-Schritte sowie der 2-Sekunden-Methode in Chrome.
- **Handbuch (`src/app/docs/handbook-data.ts`):**
  - Kapitel 1.7 (Stationswechsel & PIN-Dialog), 2.12 (Schichtpausen & Schichtende), 3.10 & 9.3.5 (Android CA-Zertifikat), 4.1 (KDS Vertikales Scrollen & fixierte Kopfleiste) und 7.3 & 7.4 (Schichtzeiten & Kennnummer auf Abrechnungsbeleg) aktualisiert.
- **Automatisierte Tests:**
  - `src/__tests__/shift_pause_kds_cert_v0458.test.ts` (5 Tests).
  - Gesamter Testkatalog: 54 Suiten, 367 Tests ausnahmslos bestanden.

## v0.4.57 – Akku-Warnung, WLAN-Empfangs-Ampel, Küchen-Ausverkauft-Schnellzugriff & Schichtverwaltung (18.09.2026)

> Live-Übertragung des Gerätestatus (Akkustand, Ladezustand und Kellnername) an den Admin-Gerätemanager inklusive akustischem PING-Suchsignal und Akku-Warnung bei unter 20 %, optische WLAN-Empfangs-Ampel auf Kellner-Smartphones, Ausverkauft-Schnellzugriff direkt im Küchen- und Ausschankmonitor mit Echtzeit-Synchronisation sowie Schichtwechsel über das Stift-Symbol in der Kopfzeile.

### Weshalb
1. **Geräteüberwachung & Akku-Schutz:** Auf großen Festen gehen Kellner-Smartphones im Gedränge verloren oder schalten sich wegen leerem Akku unerwartet ab. Die Kassenleitung benötigt einen Live-Überblick über alle Geräte, den aktuellen Batteriestand und den Namen der Bedienung sowie eine Möglichkeit, das Handy per Suchton (PING) akustisch zu orten.
2. **Verbindungsanzeige für Bedienungen:** Im Biergarten oder Randbereiche reißt das WLAN gelegentlich ab. Eine Ampel im Blickfeld der Bedienung signalisiert sofort, ob Bestellungen übertragen werden können oder man sich wieder in Zeltnähe bewegen muss.
3. **Ausverkauft-Meldung direkt aus der Küche:** Wenn ein Gericht oder Fass leer ist, muss die Küche den Artikel mit zwei Klicks sperren können, ohne zur Kasse zu laufen. Die Sperre muss sofort in Echtzeit auf allen Kellner-Handys greifen.
4. **Schichtwechsel über Stift-Symbol:** Bedienungen müssen ihren Namen direkt über ein Stift-Symbol in der Kopfzeile anpassen oder wechseln können.

### Wie (Technik)
- **Geräte-Manager & Akku-Warnung (`src/app/admin/devices/page.tsx`, `src/app/api/devices/route.ts`):**
  - Anzeige des angemeldeten Kellnernamens neben Gerätekennung und IP.
  - Farblich kodierte Akku-Anzeige (Rot bei < 20% mit Warnsymbol, Gelb bei < 50%, Grün bei > 50%) und Blitz-Symbol bei aktivem Ladevorgang.
  - PING-Funktion zur Auslösung eines akustischen Signals auf dem Zielgerät.
- **WLAN-Empfangs-Ampel (`src/app/waiter/page.tsx`):**
  - Live-Statusanzeige mit Ampel-Farbe: Grün ("WLAN OK") vs. Rot blinkend ("Offline / WLAN getrennt") mit Warnbanner bei Verbindungsverlust.
- **Küchen-Ausverkauft-Schnellzugriff (`src/app/kitchen/page.tsx`, `src/app/api/products/[id]/route.ts`):**
  - Button "Ausverkauft" in der KDS-Kopfzeile öffnet Schnelldialog zur Deaktivierung von Produkten (`isSoldOut: true/false`).
  - Socket.IO Event `product:updated` informiert alle Kellner- und Kassenterminals in Echtzeit.
- **Handbuch:** Kapitel 2.12 und 9.8 aktualisiert.
- **Automatisierte Tests:** `src/__tests__/device_waiter_name_sync.test.ts` (11 Tests).

## v0.4.56 – Menüzustand merken, Tischnummer-Vollbreite, QR-Kopierbutton, Android-HTTPS-Hilfe & Bon-Schriftgröße (18.09.2026)

> Dauerhafte Persistenz des Admin-Menüzustands im Browser (localStorage), vollständige Beseitigung von Ziffernabschneidungen bei Tischnummer-Ausdrucken der Stufe 10 auf Bondruckern, 1-Klick-Kopierbutton für Kassenlinks und QR-Code-URLs, erweiterte Android-Hilfestellung bei Chrome-Sicherheitswarnungen und optimierte Bon-Schriftgrößen-Skalierung.

### Weshalb
1. **Menüzustand beibehalten:** Nach Seitenwechseln oder Reloads im Adminbereich klappten alle Menükategorien bisher auf den Standard zurück. Der Benutzerzustand soll gespeichert und beim erneuten Laden wiederhergestellt werden.
2. **Abschneidefreier Tischmarkendruck:** Auf Stufe 10 ragten dreistellige Tischnummern auf manchen Druckern leicht über den Bonrand hinaus. Die Skalierung muss dynamisch an die Ziffernlänge angepasst werden.
3. **Komfortable Link-Verteilung:** Für Helfer, die mit eigenem Smartphone beitreten, soll der Kassenlink neben dem QR-Code mit einem Klick in die Zwischenablage kopiert werden können.
4. **Android-HTTPS-Anleitung:** Klar verständliche Schritt-für-Schritt-Erklärung der 2-Sekunden-Lösung in Google Chrome ("Erweitert" -> "Weiter zu IP (unsicher)") ohne Notwendigkeit manueller Zertifikatsinstallationen.

### Wie (Technik)
- **Menüzustand (`src/components/navigation/navbar.tsx`):**
  - `openGroups` wird im `localStorage` unter `openbon_nav_groups` persistiert und beim Laden initialisiert.
- **Tischmarken-Skalierung (`src/app/admin/tables/page.tsx`, `src/lib/printer/escpos-builder.ts`):**
  - Dynamische Anpassung der Schriftgröße in Abhängigkeit von der Zeichenanzahl der Tischnummer.
- **QR-Code-Seite (`src/app/admin/qr-codes/page.tsx`):**
  - Kopier-Button mit visueller Rückmeldung ("Kopiert!") für alle Kassen- und Stationslinks.
  - Hervorgehobene Info-Box zur 2-Sekunden-Lösung für Android Google Chrome.
- **Handbuch:** Kapitel 3.10 und 6.6 aktualisiert.
- **Automatisierte Tests:** `src/__tests__/ui_fixes_v0456.test.ts` (9 Tests).

## v0.4.55 – Tischmarken-Druckerweiterung (Mehrfachdruck & Vollbreite) & aufgeräumte Admin-Menüführung (18.09.2026)

> Konfigurierbare Anzahl von Ausdrucken je Tischnummer (Standard: 2 Kopien für beide Garniturseiten), Vollbreiten-Skalierung der Tischziffer auf Stufe 10 ohne Zeilenumbruch, vollständige Beseitigung der gestrichelten Trennlinie und des festen Standard-Hinweistextes, Rückkehr zu den 4 klaren Hauptkategorien im Admin-Hauptmenü ohne doppelte Verkaufsreiter sowie kompakte Menüführung (automatisches Zuklappen inaktiver Kategorien).

### Weshalb
1. **Effizienter Tischmarken-Druck für Bierzeltgarnituren:** Auf Festen müssen Tischnummern an beiden Enden der Tische sichtbar sein, damit Kellner und Helfer sie aus jedem Blickwinkel sofort finden. Das vorherige manuelle Anstoßen einzelner Druckaufträge für jede Tischnummer war fehleranfällig. Die Anzahl muss direkt im Druckfenster wählbar sein (Standard: 2 Kopien je Tisch).
2. **Volle Bonbreite auf Stufe 10:** Im Festzelttrubel müssen Tischnummern selbst aus großer Distanz lesbar sein. Die bisherige Skalierung füllte nur rund 25 % der Bonbreite aus. Auf der höchsten Stufe 10 muss die Ziffer die gesamte Papierbreite (Hardware-Skalierung 8x8) einnehmen, ohne abgeschnitten zu werden oder umzubrechen.
3. **Aufgeräumter, sauberer Bon:** Die fest eincodierte gestrichelte Trennlinie und der Standardtext *"Tischnummer bitte bei Bestellung angeben"* störten das Erscheinungsbild von Tischaufstellern. Auf Tischmarken soll standardmäßig nur die große Zahl und ggf. der QR-Code stehen – Hinweistexte dürfen nur erscheinen, wenn der Benutzer selbst explizit einen Text eingibt.
4. **Keine redundanten Kassen- und Kellnerreiter im Adminbereich:** Die Stationen *„Bonkasse“* und *„Bedienung“* wurden fälschlicherweise in den Admin-Listen aufgeführt, obwohl sie bereits oben über die 4 Schnellwahl-Kacheln *„Station wechseln“* erreichbar sind. Die Zwischenkategorie *„Verkauf & Live-Betrieb“* verwässerte die Admin-Struktur.
5. **Kompaktes Menü ohne langes Scrollen:** Wenn alle Menügruppen standardmäßig geöffnet sind, wird die Seitenleiste extrem lang. Das Menü muss beim Öffnen nur die zur aktuellen Seite gehörende Hauptkategorie ausklappen, damit alle Optionen auf einen Bildschirm passen.

### Wie (Technik)
- **Tischmarken-Druck & Konfigurator (`src/app/admin/tables/page.tsx`, `src/app/api/tables/print-markers/route.ts`):**
  - Neuer State `markerCopiesPerTable` (Default: 2, Min: 1, Max: 50) im 3-Spalten-Formular (*Von Tisch*, *Bis Tisch*, *Anzahl je Tisch*).
  - Dynamischer Druckumfang-Hinweiskasten (`X Tische × Y Ausdrucke = Z Tischmarken gesamt`).
  - Standardwert für `markerNoteText` von `'Tischnummer bitte bei Bestellung angeben'` auf `''` (leerer String) geändert.
  - Live-Bonvorschau: Gestrichelte Trennlinie unter der Tischnummer entfernt, Hinweistext nur bei vorhandenem Text gerendert.
  - Dynamische Schriftgrößenberechnung in der Vorschau: Skaliert auf Stufe 10 auf bis zu 145px (80mm) bzw. 110px (58mm) unter Berücksichtigung der Ziffernlänge für randlose Vollbreite.
  - Server-Route `/api/tables/print-markers`: Parameter `copiesPerTable` (bzw. `copies`) empfangen und in verschachtelter Schleife an den Druckspooler übermitteln; Rückgabe der tatsächlichen Gesamtzahl.
- **ESC/POS-Thermodrucker-Formatierung (`src/lib/printer/escpos-builder.ts`):**
  - In `buildTableMarkerTicket`: Trennlinie (`doubleDivider`) unter der Tischnummer entfernt.
  - Bei `numberOnly` und `fontSize >= 10`: Maximale Hardware-Größe `builder.charSize(8, 8).bold(true)` für Vollbreite.
  - Standard-Hinweistext entfernt; `noteText` wird nur gedruckt, wenn `noteText.trim().length > 0`.
- **Admin-Menü-Reorganisation & Kompaktheit (`src/components/navigation/navbar.tsx`):**
  - Auflösung der Gruppe `operations` und vollständige Entfernung von *Bonkasse* und *Bedienung* aus `adminGroups`.
  - 4 saubere Admin-Kategorien:
    1. `inventory`: Sortiment & Warenwirtschaft (Artikel, Bestände, Lagerposten, Fassmonitor, Bestellvorschlag)
    2. `finance`: Kasse, Abrechnung & Finanzen (Berichte, Kassenbuch, Schichtabrechnung, DATEV, TSE, Wertmarken)
    3. `hardware`: Geräte, Tische & Hardware (Tischplan, Drucker, Virtueller Drucker, Kundendisplay, Geräte-Manager, QR-Beitritt)
    4. `system`: System & Verwaltung (Dashboard, Einstellungen, Backup, System-Update, Diagnose, Logs, Team-Funk, Handbuch)
  - Definition von `adminGroups` und `nonAdminLinks` als statische Konstanten außerhalb der Komponente für optimale Render-Performance.
  - Intelligentes `openGroups`-Management: Beim Öffnen der Seitenleiste wird ausschließlich diejenige Gruppe ausgeklappt, die zur aktuellen URL (`pathname`) gehört. Alle anderen Gruppen bleiben eingeklappt.
- **Handbuch (`src/app/docs/handbook-data.ts`):**
  - Kapitel 6, Abschnitt 6.6: *Tischmarken für Biertische drucken (Bondrucker)* hinzugefügt.
  - Kapitel 9, Abschnitt 9.6: *Aufgeräumtes Hauptmenü & kompakte Menüführung* hinzugefügt.
- **Test-Suite:**
  - `src/__tests__/table_markers_and_nav_cleanup.test.ts` (4 Tests).
  - Aktualisierung von `src/__tests__/https_cert_and_menu_expiration_v0454.test.ts` (5 Tests).
  - Gesamter Testkatalog: 51 Suiten, 342 Tests ausnahmslos bestanden.

## v0.4.54 – Abschlussbericht-Resilienz, Vollbild-Speisekarte mit Selbstlöschung, 100-Jahre-HTTPS & Menü-Konsolidierung (17.09.2026)

> Automatische Fehlerkorrektur beim Abschlussbericht-Download (Prisma Inconsistent Query Result Fix), randlose Vollbildauslieferung der Online-Speisekarte mit nativer Zoom-Funktion, automatisches Festende-Ablaufdatum mit serverseitiger PHP-Selbstlöschung (ohne Kassenrechner), lebenslang gültiges 100-Jahre-HTTPS-Zertifikat mit 1-Klick-Erneuerung, vollständige Handbuch-Bebilderung und Konsolidierung der Admin-Navigation in 5 intuitive Themenblöcke.

### Weshalb
1. **Fehlerfreie Abschlussberichte bei veränderten Stammdaten:** Wenn im laufenden Festbetrieb ein Artikel umbenannt, deaktiviert oder gelöscht wurde, brach der Abschlussbericht-Download in Prisma mit einem relationalen Integritätsfehler ab (`Field product is required to return data, got null instead`). Das System muss gelöschte Artikeldaten verzeihen und stets eine saubere PDF- oder Excel-Abrechnung für die Vereinsführung generieren.
2. **Direkte Speisekarten-Ansicht für Gäste:** Bisherige Webhosting-Seiten zeigten beim Klick auf die Speisekarte Navigationsleisten, Textboxen und Download-Knöpfe. Für Festbesucher ist jedoch ein reines, responsives Vollbild-PDF ideal, das direkt auf die Bildschirmbreite skaliert und mit Gesten stufenlos herangezoomt werden kann.
3. **Datensparsamkeit & automatische Server-Bereinigung:** Speisekarten und Festflyer dürfen nach dem Fest nicht dauerhaft auf öffentlichen Webspaces verbleiben. Da Festrechner nach dem Zeltabbau sofort verpackt werden, muss der Webserver die Daten selbstständig löschen – entweder nach 7 Tagen oder zu einem im Kassen-Admin frei wählbaren Festende-Zeitpunkt.
4. **Wartungsfreies Festzelt-WLAN ohne Zertifikatsablauf:** Lokale Netze benötigen HTTPS, damit moderne Browser (Chrome unter Android) Progressive Web Apps ohne Warnungen installieren. Das Zertifikat muss lebenslang (100 Jahre) gültig sein, damit Kassenwarte sich nie wieder um auslaufende Gültigkeitsdaten kümmern müssen.
5. **Ergonomische Hauptmenü-Navigation:** Das wachsende Funktionsspektrum (Fiskal, KDS, Schankanlagen, DATEV, Kiosk) erforderte eine übersichtliche, thematische Bündelung im Hauptmenü, damit Administratoren mit maximal zwei Klicks jedes Werkzeug erreichen.

### Wie (Technik)
- **Berichts-Resilienz (`src/app/api/reports/event-summary/route.ts`):**
  - Entkopplung der Prisma-Relation `product`: Aufträge laden nun mit `include: { items: true }` ohne Zwangskopplung.
  - Separate In-Memory-Katalog-Map (`productCatalogMap`), automatischer Fallback auf gespeicherte `item.productName`-Schlüsselwörter (`Bier`, `Grill`, `Pommes`, `Pfand`) bei gelöschten Artikeln.
- **Webhosting-Brücke & Vollbild-PDF (`src/lib/webhosting-bridge-template.ts`, `src/lib/webhosting-push.ts`):**
  - `renderMenuPage` in `index.php` liefert `menu.pdf` als direkten Stream mit `Content-Type: application/pdf`, `Content-Disposition: inline` und HTTP-Cache-Headern aus.
  - Bild-Fallback mit responsivem Vollbild-HTML (`viewport: user-scalable=yes, maximum-scale=5.0`).
  - Automatische Löschroutine (`@unlink`) aller Menüdateien nach 604.800 Sekunden (7 Tage) oder wenn `time() >= $meta['expiresAt']`.
- **Festende-Auswahl im Adminbereich (`src/app/admin/settings/tabs/ReceiptTab.tsx`, `src/app/api/bridge/sync-menu/route.ts`):**
  - Eingabefeld für `datetime-local` im E-Bon-Reiter. Übermittlung des Ablauf-Zeitstempels an die Webhosting-Brücke zur Speicherung in `menu-meta.json`.
- **100-Jahre-HTTPS-Zertifikat (`server.js`, `src/app/api/system/cert/route.ts`, `SecurityTab.tsx`, `qr-codes/page.tsx`):**
  - Verlängerung der X.509-Gültigkeit auf `days: 36500` (100 Jahre).
  - Neuer `POST`-Endpunkt `/api/system/cert` für 1-Klick-Zertifikatserneuerung.
  - UI-Schalter für HTTPS (Port 3443) im QR Beitritts-Center zur automatischen Ausstellung verschlüsselter Stations-URLs.
- **Menü-Konsolidierung (`src/components/navigation/navbar.tsx`):**
  - Strukturierung von `adminGroups` in: 1. Verkauf & Live-Betrieb (`operations`), 2. Sortiment & Warenwirtschaft (`inventory`), 3. Kasse, Abrechnung & Finanzen (`finance`), 4. Geräte, Drucker & Stationen (`hardware`), 5. System & Verwaltung (`system`).
- **Handbuch-Aktualisierung (`src/app/docs/handbook-data.ts`):**
  - Kapitel 3 (Sofortverkauf, E-Bon, Vollbild-Speisekarte), Kapitel 7 (Prüfroutinen) und Kapitel 9 (100-Jahre-Zertifikat) verständlich ohne Fachbegriffe überarbeitet.
- **Test-Suite:**
  - `src/__tests__/report_buttons_and_resilience.test.ts` (1 Test).
  - `src/__tests__/handbook_images_exist.test.ts` (1 Test für 40 Grafiken).
  - `src/__tests__/https_cert_and_menu_expiration_v0454.test.ts` (5 Tests).
  - Gesamtzahl der Testsuiten steigt von 47 auf 50 (338 Tests grün).

## v0.4.53 – Bon-Layout Kopfzeilen-Priorisierung, Download-Reparatur Abschlussbericht, Admin-Internetstatus & Diagnose-Bereinigung (17.09.2026)

> Verschiebung der universellen Kopf- und Fußzeile an Position 1 im Bon-Layout, Reparatur des Abschlussbericht-Downloads (saubere PDF- und CSV-Dateien statt Text-/JSON-Fehlermeldungen), kompakter Live-Internetstatus in der Admin-Kopfleiste, Ersatz der veralteten Lizenz-Kachel in der Systemdiagnose durch Netzwerk-Metriken und Bereinigung des Menü-Footers.

### Weshalb
1. **Kopf- und Fußzeilen-Ergonomie:** Kopf- und Fußzeile (Festname, Grußformel, Vereinsdaten, Steuernummer) gelten übergreifend für alle gedruckten und digitalen Belege. Indem dieser Bereich an die allererste Stelle im Bon-Layout rückt, können Festwirte diese gemeinsamen Angaben sofort einstellen, bevor sie ins Detail von Küchen- oder Ausschankbons gehen.
2. **Zuverlässiger Dateidownload des Abschlussberichts:** Beim Herunterladen des Veranstaltungs-Abschlussberichts über einfache Browser-Links wurden bei kleineren Netzwerkverzögerungen versehentlich Fehlermeldungen als unlesbare Text- oder JSON-Dateien gespeichert. Ein robuster Download-Mechanismus holt die Datei nun kontrolliert ab, zeigt währenddessen einen Ladekreis an und speichert die Datei verlässlich unter dem richtigen Namen (`Abschlussbericht_JJJJ-MM-TT.pdf` bzw. `.csv`).
3. **Sofortige Internet-Übersicht für Administratoren:** Für moderne Online-Zusatzfunktionen (wie den digitalen Belegabruf über das Internet) muss die Kassenleitung direkt sehen können, ob der Kassen-Router online ist, ohne tief in die Diagnose-Einstellungen abtauchen zu müssen. Eine dezente Status-Pille (🟢 Online / 🟡 Offline) in der Admin-Leiste gibt sofort Klarheit.
4. **Bereinigung veralteter Lizenz-Anzeigen:** OpenBon ist freie Open-Source-Software. Die bisherige Kachel „Lizenz: COMMUNITY“ im Diagnosebereich stiftete Verwirrung, da keine Lizenzschlüssel erforderlich sind. An ihrer Stelle liefert nun ein Live-Netzwerkstatus echten praktischen Nutzen.
5. **Aufgeräumtes Hauptmenü:** Der statische Text „• Offline Kassennetzwerk“ ganz unten im Menü war überholt, da OpenBon je nach Wunsch sowohl komplett autark offline als auch mit gesicherter Internet-Anbindung für Gast-Funktionen betrieben werden kann.

### Wie (Technik)
- **Bon-Layout & Vorschau (`src/app/admin/settings/tabs/ReceiptTab.tsx`):**
  - Reiter-Reihenfolge neu geordnet: 1. Kopf- und Fußzeile (`header_footer`), 2. Speisen-Bon (Küche), 3. Getränke-Bon (Ausschank), 4. Kassenbeleg, 5. Digitaler E-Bon.
- **Abschlussbericht-Download (`src/app/admin/reports/page.tsx`):**
  - Umstellung auf `handleDownloadEventSummary` mit Browser-Blob-API (`window.URL.createObjectURL`), Lade-Indikator auf den Buttons (`downloadingSummary === 'pdf' | 'csv'`), Erfolgs- und Fehler-Toasts und automatischer Dateinamensvergabe.
- **Live-Internet-Indikator (`src/components/navigation/navbar.tsx`):**
  - Kompakte Status-Pille in der Admin-Navigation mit 30-Sekunden-Intervall gegen `/api/system/internet`.
  - Entfernung des statischen Footers `• Offline Kassennetzwerk`.
- **System-Testbetrieb & Diagnose (`src/app/admin/diagnostics/page.tsx`, `src/app/api/diagnostics/route.ts`):**
  - Entfernung der `COMMUNITY`-Lizenzkachel; Integration von Router- und Internetverbindungs-Latenzen (Ping) in die Live-Übersicht.
- **Dokumentation (`src/app/docs/handbook-data.ts`):**
  - Kapitel 9.1 (Bon-Einstellungen) und 9.3.2 (Abschlussbericht-Export) auf den neuesten Stand gebracht.

---

## v0.4.52 – Revisionssicherer Abschlussbericht (PDF & Excel), Internet-Prüfung für E-Bons & Bon-Synchronisation (17.09.2026)

> Großer druckfertiger Veranstaltungs-Abschlussbericht als mehrseitiges PDF und tabellarische CSV/Excel-Tabelle, automatische Internet-Verbindungsprüfung mit intelligentem QR-Code-Fallback für E-Bon und Speisekarte sowie Synchronisations-Schalter für Küchen- und Ausschank-Bonlayouts.

### Weshalb
1. **Kompletter Veranstaltungsabschluss auf Knopfdruck:** Nach einem Festwochenende mussten Organisatoren bisher Z-Bons, Kellnerberichte und Warengruppen mühsam zusammentragen. Der neue Abschlussbericht fasst alles revisionssicher zusammen: Gesamtumsatz, Bar- und Kartensummen, Steuersätze (7% / 19%), Warengruppen-Umsätze, meistverkaufte Artikel, tägliche Verbräuche und alle Kellner-Schichtabrechnungen.
2. **Excel- und CSV-Export:** Für Vereinskassierer und Steuerberater wird die gesamte Artikelliste mit Einzelpreisen, Mengen und Umsätzen sowie die Kellnerabrechnungen als standardisierte Tabellendatei ausgegeben.
3. **Verbindungsprüfung für digitale E-Bons & Speisekarte:** Befindet sich die Kasse im reinen Offline-Netzwerk ohne Internet, führte das Scannen von Cloud-QR-Codes zu Frust beim Gast. Das System prüft nun alle 30 Sekunden im Hintergrund, ob echtes Internet anliegt. Ist Internet verfügbar, erhalten Gäste den weltweiten Cloud-E-Bon; ohne Internet schaltet das System automatisch auf den lokalen Belegabruf im Zelt-WLAN um.
4. **Gleichzeitiger Abgleich von Küchen- und Ausschankbons:** Bisher mussten Layout-Anpassungen (Schriftgröße der Tischnummer, Schriftgröße von Speisen/Getränken, Bon-Vorlage) separat für Küche und Schänke eingestellt werden. Ein Schieberegler synchronisiert diese Einstellungen nun auf Wunsch mit einem einzigen Klick.

### Wie (Technik)
- **PDF- und Tabellen-Generierung (`src/lib/event-summary-pdf.ts`, `src/app/api/reports/event-summary/route.ts`):**
  - PDFKit-gestützte Dokumentenerstellung mit professionellem Deckblatt, Kennzahlen-Kacheln, Zahlarten-Übersicht, Steuersplit, Warengruppen-Charts, Verbrauchsliste und Schichtprotokoll.
  - CSV-Ausgabe mit Semikolon-Trennung und UTF-8-BOM für reibungslosen Import in Microsoft Excel.
- **Internet-Prüfung & Resilienz (`src/lib/internet-monitor.ts`, `src/app/api/system/internet/route.ts`):**
  - Asynchroner Verbindungs-Monitor prüft HTTP/DNS-Gegenstellen (`1.1.1.1`, `8.8.8.8`) mit 2,5 Sekunden Timeout und Cache.
  - Dynamischer QR-Code-Fallback in `src/app/pos/page.tsx` und `src/app/waiter/payment/page.tsx`.
- **Bon-Synchronisation (`src/app/admin/settings/tabs/ReceiptTab.tsx`):**
  - Konfigurationsschalter `syncKitchenBarReceipts` gleicht bei Änderungen an Küche oder Schänke Vorlage, Tischnummer-Schriftgröße und Artikel-Schriftgröße atomar ab.
- **Tests (`src/__tests__/event_summary_and_receipt_sync.test.ts`):**
  - 9 automatisierte Testfälle für Berichts-Payloads, PDFKit-Puffer, CSV-Formatierung und Synchronisations-Logik.

---

## v0.4.51 – Kassenladen-Priorisierung für Bonkasse, universeller E-Bon Direktlink & System-Entkopplung (16.09.2026)

> Schutz vor unerwünschtem Kassenladen-Öffnen an Kellner-Mobilgeräten (Öffnungsimpuls nur noch an stationären Bonkassen), universeller E-Bon Direktlink (`?code=`) für Gäste und strikte Entkopplung von Server-Dateisystemen aus Client-Komponenten.

### Weshalb
1. **Kein Kassenladen-Klappern beim Kellnern:** Wenn mobile Bedienungen am Tisch Barzahlungen abwickelten oder Scheine aufschrieben, wurde fälschlicherweise der Kassenladen-Öffnungsimpuls an Netzwerkdrucker gesendet. Dies gehört ausschließlich an feste Bonkassen mit Bargeldschublade.
2. **Universeller Beleg-Zugriff für Gäste:** Gäste scannen den Beleg-QR-Code teils im Festzelt-WLAN, teils über ihre mobile Datenverbindung. Ein universeller Einstiegspunkt leitet Gäste unabhängig vom gewählten Netz sofort auf ihren Beleg weiter.
3. **Build-Stabilität:** Clientseitige Komponenten dürfen keine internen Server-Dateisystemfunktionen aufrufen, um Build- und Laufzeitfehler in modernen Browsern auszuschließen.

### Wie (Technik)
- **Kassenladen-Filterung (`src/app/api/orders/checkout/route.ts`, `src/lib/printer/network-spooler.ts`):**
  - `openCashDrawer` wird nur ausgelöst, wenn `isMainPos === true` oder `STATION === 'BONKASSE'` aktiv ist.
- **Universelle Beleg-URL (`src/lib/digital-receipt-url.ts`, `src/app/page.tsx`):**
  - Extraktion der Link-Erstellung in ein leichtgewichtiges Modul ohne Node-FS-Abhängigkeiten.
  - Startseiten-Routing für `?code=...` mit automatischer Weiterleitung auf `/receipt/[code]`.
- **Tests (`src/__tests__/companion_terminal_vrpay_v0451.test.ts`):**
  - Überprüfung der Kassenladen-Regeln und Beleg-URL-Auflösung.

---

## v0.4.50 – SoftPOS Smartphone-Terminal (VR Pay:Me Beta), Festzelt-HTTPS & Handbuch (16.09.2026)

> Kartenzahlungsannahme direkt auf dem Kellner-Smartphone über die VR Pay:Me App (SoftPOS), integriertes Festzelt-HTTPS mit automatischer Zertifikatserstellung für NFC und Barcode-Kameras im mobilen Browser sowie Kapitel 10 im Bedienerhandbuch.

### Weshalb
1. **Keine teuren Zusatzgeräte pro Bedienung:** Mit SoftPOS wird jedes handelsübliche NFC-fähige Android-Smartphone zum vollwertigen Kartenterminal. Bedienungen können Girocard-, Debit- und Kreditkarten sowie Apple Pay und Google Pay direkt am Handy des Kellners abrechnen.
2. **Verschlüsseltes Festzelt-WLAN (HTTPS):** Moderne Smartphone-Browser (Chrome, Safari) verweigern den Zugriff auf NFC-Chips und Kameras, wenn eine Seite unverschlüsselt über `http://` geladen wird. Ein integrierter Zertifikats-Generator ermöglicht sicheres HTTPS auch im komplett offline betriebenen Zeltnetzwerk.
3. **Schritt-für-Schritt-Anleitung:** Einführung eines neuen Handbuch-Kapitels für die Einrichtung von SoftPOS und Festzelt-Verschlüsselung.

### Wie (Technik)
- **SoftPOS-Integration (`src/app/pos/card-terminal/page.tsx`, `src/app/api/payments/session/route.ts`):**
  - Bereitstellung des Begleiter-Terminals mit automatischem Deep-Link-Aufruf (`vr-pay-me://payment?...`) und Rücksprung-Handler.
- **Lokales SSL/HTTPS (`server.js`, `src/app/api/system/cert/route.ts`):**
  - Automatisierte Erstellung und Bereitstellung selbstsignierter SSL-Zertifikate für das lokale Festzelt-Netzwerk.
- **Handbuch-Erweiterung (`src/app/docs/handbook-data.ts`):**
  - Neues Kapitel 10 „SoftPOS & Festzelt-HTTPS“ mit bebilderter Einrichtungsanleitung.
- **Tests (`src/__tests__/kassenlade_ebon_and_https_v0450.test.ts`):**
  - Validierung der Zertifikatserstellung und Zahlungs-Sitzungen.

---

## v0.4.49 – Webhosting-Brücke für digitale E-Bons, Speisekarten-Upload & 24h-Autolöschung (15.09.2026)

> Bereitstellung digitaler Belege und PDF-Speisekarten über einen Standard-Webspace (z.B. Vereinswebsite) ohne Router-Portfreigaben, datenschutzkonforme automatische 24h-Löschung und Anleitung für den Android-Kiosk-Modus.

### Weshalb
1. **E-Bon ohne Sicherheitsrisiken am Zelt-Router:** Um Gästen ihren digitalen Kassenbon bereitzustellen, mussten Vereine bisher komplizierte Portweiterleitungen am Zelt-Router einrichten. Mit der Webhosting-Brücke lädt die Kasse Belege per HTTPS auf die bestehende Vereins-Website hoch – vollkommen ohne Freigaben am lokalen Router.
2. **Speisekarte auf Gästeprofilen:** Gäste können am Tisch die offizielle Speisekarte als PDF einsehen.
3. **Datenschutz durch automatische Löschung:** Zur Schonung des Webspaces und Wahrung des Datenschutzes werden alte Belege nach 24 Stunden automatisch vom Webserver entfernt.

### Wie (Technik)
- **Webhosting-Brücke (`src/lib/webhosting-bridge-template.ts`, `src/lib/webhosting-push.ts`):**
  - Downloadbares PHP-Brückenskript mit Token-Authentifizierung und 24h-Bereinigungs-Cron.
- **Speisekarten-Upload (`src/app/api/bridge/menu-upload/route.ts`):**
  - PDF-Upload im Adminbereich mit automatischer Synchronisation an die Web-Brücke.
- **Handbuch (`src/app/docs/handbook-data.ts`):**
  - Anleitung zur Einrichtung des geschützten Android-Kiosk-Modus für Selbstbedienungs-Terminals.
- **Tests (`src/__tests__/webhosting_bridge_and_kiosk.test.ts`):**
  - 8 Unittests für Brücken-Payloads, Menü-Synchronisation und Kiosk-Abläufe.

---

## v0.4.48 – Stabilität im Gastmenü & saubere Belegformatierung (15.09.2026)

> Behebung möglicher Browser-Abstürze bei unvollständigen Artikelpreisen (`toFixed`-Schutz), saubere Ausrichtung von Preisen auf digitalen E-Bons und Aktualisierung aller Handbuch-Screenshots.

### Weshalb
1. **Stabilität bei Preisberechnungen:** Wenn bei Sonderartikeln oder Wertmarken ein Preis nicht als Zahl formatiert war, konnte die digitale Speisekarte auf Mobilgeräten einfrieren. Eine strikte Absicherung verhindert jegliche Abstürze.
2. **Sauberes Belegbild:** Cent-Beträge und Zwischensummen auf dem Gastbeleg wurden teilweise unsauber ausgerichtet.

### Wie (Technik)
- **Fehlerabsicherung (`src/app/guest/table/[tableNumber]/page.tsx`, `src/app/admin/tokens/page.tsx`):**
  - Durchgehende Absicherung über `Number(val || 0).toFixed(2)`.
- **E-Bon Ansicht (`src/app/receipt/[code]/page.tsx`, `src/app/api/receipt/[code]/route.ts`):**
  - Rechtsbündige Formatierung von Preisen und MwSt.-Sätzen.
- **Tests (`src/__tests__/guest_and_tokens_crash_prevention_v0448.test.ts`):**
  - Regressionstests zur Verhinderung von Laufzeitabstürzen bei ungültigen Preiswerten.

---

## v0.4.47 – Fehlerkorrektur für Handbuch-Bildschirmfotos (15.09.2026)

> Beseitigung von leeren (weißen) Bildschirmfotos im Offline-Handbuch durch automatische Bild-Integritätsprüfung und Render-Verzögerungen.

### Weshalb
1. **Lückenlose Bildanleitung:** Durch extrem schnelle Seitenwechsel im automatisierten Screenshot-Skript waren einzelne Ansichten im Handbuch als weiße Flächen gespeichert worden.

### Wie (Technik)
- **Screenshot-Pipeline (`scripts/capture-all-detailed-screenshots.js`):**
  - Einführung eines Blank-Validators, der Farbvarianzen prüft und bei leeren Aufnahmen automatisch wiederholt.
  - Neugenerierung aller 39 Handbuch-Bilddateien in `public/docs/images/`.

---

## v0.4.46 – Vergrößerte Touch-Bedienung, Beta-Transparenz & Handbuch-Schliff (14.09.2026)

> Vergrößerung der Zifferntasten auf Touchscreens für handschuh- und fehlerfreie PIN-Eingabe, transparente Beta-Kennzeichnung für KassenSichV/TSE und Kartenzahlung sowie Neugenerierung aller Handbuch-Fotos.

### Weshalb
1. **Ergonomie bei Hektik im Zelt:** Auf kleinen Smartphones waren die Zifferntasten beim Kassensturz und Login zu klein geraten. Große Touch-Flächen ermöglichen zielsicheres Tippen.
2. **Klarheit bei Spezialmodulen:** Gesetzliche Module wie TSE und KassenSichV sowie externe Kartenzahlungs-APIs sind anspruchsvolle Erweiterungen und tragen nun klare Beta-Hinweise zur Vermeidung von Fehlbedienungen.

### Wie (Technik)
- **Touch-Ziffernblock (`src/components/ui/touch-numpad.tsx`):**
  - Tastenhöhe auf `h-14` bis `h-16` vergrößert, größere Ziffernschriftarten und verbesserte Druckflächen.
- **Hinweisbanner (`src/app/admin/fiscal/page.tsx`, `src/app/admin/settings/tabs/CardPaymentTab.tsx`):**
  - Warn- und Hinweisfelder für Test- und Beta-Betrieb.

---

## v0.4.45 – Großes UI- & Handbuch-Upgrade, Schicht-Storno-Historie & Tischplan-Druck (14.09.2026)

> Vollständig bebildertes Offline-Handbuch mit 39 Bildschirmfotos direkt in der Kasse, neuer Reiter für Schicht-Stornos im Kassensturz, universeller Touch-Ziffernblock, 1-Klick-Leeren im SB-Kiosk und druckfertiger Zelt-Tischplan für das Personal.

### Weshalb
1. **Handbuch direkt vor Ort:** Helfer im Festzelt haben oft keinen Internetzugang. Ein bebildertes Handbuch direkt in der Kassenoberfläche erklärt jeden Arbeitsablauf mit Original-Screenshots.
2. **Storno-Nachvollziehbarkeit bei der Abrechnung:** Schichtleiter müssen beim Kassensturz genau sehen, welche Artikel storniert wurden und wie viel Bargeld erstattet wurde.
3. **Ausdruck des Tischplans:** Für neue Bedienungen im Zelt ist ein ausgedruckter Tischplan auf A4 eine unverzichtbare Orientierungshilfe.

### Wie (Technik)
- **Integriertes Handbuch (`src/app/docs/handbook-data.ts`, `src/app/admin/docs/page.tsx`):**
  - 10 ausführliche Kapitel mit 39 hochauflösenden Screenshots.
- **Schicht-Stornos (`src/app/admin/settle/page.tsx`):**
  - Neuer Reiter mit chronologischer Auflistung aller Stornierungen inklusive Erstattungsbeträgen.
- **Tischplan-Druck (`src/app/admin/tables/print/page.tsx`):**
  - Druckoptimierte Ansicht für Tischübersichten und Laufwege.
- **SB-Kiosk (`src/app/kiosk/page.tsx`):**
  - Große Schaltfläche „Bestellung verwerfen“ zum schnellen Zurücksetzen.
- **Tests (`src/__tests__/ui_enhancements_v0445.test.ts`):**
  - Testfälle für Touch-Numpad, Schicht-Storno-Auswertung und Kiosk-Abläufe.

---

## v0.4.44 – Stornierung mit Barauszahlung nach Sofort-Kassieren (14.09.2026)

> Ermöglichung der Artikel-Stornierung innerhalb der Druckverzögerung auch dann, wenn die Bestellung bereits kassiert wurde – mit automatischer Barauszahlung (Rückgeld) und Korrektur des Kellner-Kassenbestands.

### Weshalb
1. **Schnellzahler am Tisch:** Oft bestellt ein Gast und zahlt sofort passend bar, während die Bon-Druckverzögerung (z.B. 60 Sekunden) noch läuft. Merkt der Gast Sekunden später, dass er einen falschen Artikel genannt hat, war bisher kein Sofort-Storno mehr möglich, weil die Bestellung schon als bezahlt galt. Jetzt kann auch eine bereits bezahlte Bestellung im Zeitfenster storniert werden – das Geld wird bar zurückgegeben und der Bon-Druck in der Küche sofort gestoppt.

### Wie (Technik)
- **Storno-Rückerstattung (`src/app/api/orders/[id]/void/route.ts`):**
  - Unterstützung für Stornos abgeschlossener Bestellungen (`COMPLETED`) im Zeitfenster mit automatischer Erzeugung einer Erstattungsbuchung (`REFUND`).
- **Kellner-Oberfläche (`src/app/waiter/page.tsx`):**
  - Anzeige des Erstattungsdialogs mit Auszahlungsbetrag für die Bedienung.
- **Tests (`src/__tests__/waiter_delay_storno_cash_refund_v0444.test.ts`):**
  - 10 Unittests für Erstattungsberechnungen, Kassenbestandskorrekturen und Storno-Sperren nach Ablauf des Timers.

---

## v0.4.43 – Echtzeit-Synchronisation für Einstellungen, Timer & Bestellungen (11.09.2026)

> Sofortiger Live-Abgleich der Kassen-Konfiguration, der Storno-Countdowns und der Tisch-Bestellungen zwischen allen Geräten ohne manuelles Neuladen der Seite.

### Weshalb
1. **Sofortige Übernahme von Einstellungen:** Ändert die Kassenleitung im Adminbereich die Druckverzögerung, müssen alle Kellner-Handys diese Einstellung sofort aktiv haben, ohne dass die Bedienung den Browser neu laden muss.
2. **Geräteübergreifender Storno-Timer:** Wird an Tisch 5 eine Runde bestellt, sehen alle Bedienungen sofort den herunterzählenden Timer am Tisch.

### Wie (Technik)
- **Echtzeit-Events (`src/app/waiter/page.tsx`, `src/app/waiter/order/page.tsx`, `src/app/waiter/payment/page.tsx`):**
  - WebSocket-Listener für `config:updated`, `order:delayed` und `order:voided`.
- **Tests (`src/__tests__/realtime_config_and_delay.test.ts`):**
  - Unittests für synchrone Zustandsaktualisierungen bei Socket-Ereignissen.

---

## v0.4.42 – Robuster Druckverzögerungs-Manager & Countdown-Resilienz (11.09.2026)

> Präzise, serverseitige Zeitstempel-Berechnung für den Storno-Countdown, Schutz vor Zeitabweichungen auf Kellner-Smartphones und Verhinderung doppelter Druckaufträge.

### Weshalb
1. **Schutz vor falsch gehenden Handy-Uhren:** Ging auf dem Smartphone einer Bedienung die Uhrzeit falsch, war der Storno-Button fälschlicherweise sofort gesperrt. Die Restzeit wird nun strikt über den Kassen-Server berechnet.
2. **Druck-Zuverlässigkeit:** Garantiert, dass jeder Bon nach Ablauf der Zeit exakt einmal gedruckt wird, selbst wenn mehrere Bedienungen gleichzeitig den Tisch geöffnet haben.

### Wie (Technik)
- **Zentraler Timer-Manager (`src/lib/order-delay-manager.ts`):**
  - `getOrderDelayInfo` errechnet die exakte Restlaufzeit strikt anhand der Serverzeit (`serverNow`).
- **API-Erweiterung (`src/app/api/orders/route.ts`, `src/app/api/tables/route.ts`):**
  - Rückgabe von `serverTime` und `delayRemainingSeconds` im Antwort-Header.
- **Tests (`src/__tests__/order_delay_storno_fix_v0442.test.ts`):**
  - 8 Unittests für Timer-Scheduling, Abbruch und Countdown-Berechnung.

---

## v0.4.41 – Behebung einer Endlos-Ladeschleife beim Kellner-Kassieren (11.09.2026)

> Beseitigung eines Fehlers, der in der Kellner-Kassieransicht unter bestimmten Bedingungen zu einem permanenten Neuladen der Seite führte.

### Weshalb
1. **Reibungsloser Kassiervorgang:** Beim Aufrufen der Bezahlansicht für einen Tisch konnte ein fehlerhafter Datenabgleich dazu führen, dass der Bildschirm flackerte oder kontinuierlich Daten nachlud.

### Wie (Technik)
- **Kassier-Komponente (`src/app/waiter/payment/page.tsx`):**
  - Bereinigung der Reaktionszyklen (`useEffect`) und stabile Datenübernahme für Tisch- und Rechnungsbeträge.

---

## v0.4.40 – Behebung von Tischbestellungs-Abbrüchen & Schnell-Zurücksetzen (11.09.2026)

> Schutz vor Server-Fehlern bei Tischbestellungen mit mehreren offenen Runden, Anpassung des langen Tastendrucks (750ms) zur Anzeige von Artikelinfos und Beseitigung ungenutzten Codes.

### Weshalb
1. **Sicheres Kassieren mehrerer Runden:** Hatte ein Tisch mehrere offene Bestellungen hintereinander aufgegeben, konnte es beim Kassieren zu Fehlern kommen, wenn bereits bezahlte Artikel nicht sauber gefiltert wurden.
2. **Optimaler langer Tastendruck:** Beim schnellen Antippen von Artikeln wurde die Artikel-Info zu leicht versehentlich ausgelöst (500ms war zu kurz). Mit 750 Millisekunden lässt sich schnell buchen, ohne ungewollt das Infofenster zu öffnen.

### Wie (Technik)
- **Mehrfach-Bestellungen (`src/app/waiter/payment/page.tsx`):**
  - Robuste Zusammenfassung offener Positionen (`extractPayableItems`) über beliebig viele Bestellungen eines Tisches.
- **Touch-Verzögerung (`src/app/waiter/order/page.tsx`, `src/app/pos/page.tsx`):**
  - Haltezeit für Artikel-Info von 500ms auf 750ms optimiert.
- **Tests (`src/__tests__/order_resilience_multi_order_v0440.test.ts`):**
  - 9 Unittests für Multi-Order-Payable-Items und Zähler-Reset.

---

## v0.4.39 – Kellner-Ergonomie, volle Artikelnamen & aufgeräumte Bestellschublade (11.09.2026)

> Volle Textbreite für lange Produktnamen (wie „Große Weinschorle sauer“), Verlegung des Mengenzählers in die rechte untere Ecke, aufgeräumte Kopfleiste der Tischbestell-Schublade und Entfernung der ungenutzten Gast-Sicht-Option.

### Weshalb
1. **Lesbarkeit von Artikelbezeichnungen:** Längere Artikelnamen wurden früher durch Zähler und Symbole abgeschnitten. Jetzt nutzt der Name die volle Breite der Kachel, und Zeilenumbrüche erfolgen sauber.
2. **Kompaktes Design der Bestellschublade:** Text-Buttons wie „Einklappen“ und „Leeren“ überfrachteten die Kopfleiste auf kleinen Displays. Sie wurden durch selbsterklärende Symbole (Mülleimer und großer Pfeil) ersetzt.
3. **Entfernung überflüssiger Schalter:** Die Einstellung „Gast-Sicht beim Kassieren“ wurde im Festbetrieb nicht benötigt und entfernt, um das Einstellungsmenü übersichtlich zu halten.

### Wie (Technik)
- **Produktkacheln (`src/app/waiter/order/page.tsx`, `src/app/pos/page.tsx`):**
  - Vollflächiges Textlayout mit Wortumbruch (`break-words`), Mengenzähler rechts unten (`bottom-2 right-2`).
- **Einstellungen (`src/app/admin/settings/tabs/GeneralTab.tsx`, `src/lib/config-whitelist.ts`):**
  - Bereinigung des Schalters `enableGuestFacingDisplay`.
- **Tests (`src/__tests__/waiter_ergonomics_and_storno_v0439.test.ts`):**
  - 9 Unittests für Layout, Tastendruck und Schalter-Bereinigung.

---

## v0.4.38 – Konfigurierbare Bestellverzögerung & Storno-Countdown, Barzahlungs-Ergonomie & POS-Bereinigung (11.09.2026)

> Konfigurierbare Druckverzögerung für Küchen-/Ausschank-Bons (`enableOrderPrintDelay`, default: false, mit Storno-Zeitfenster Countdown in Sek.), Storno einzelner Artikel direkt am Tisch vor Druck ohne Admin-PIN, Ausblenden der Rundungsleiste in Stufe 2 (nur noch in der Baransicht), Entfernung von Betragssplit, Entfernung des Allergenfilters in Bedienung & Bonkasse, vertikale Anordnung des Artikelzählers unter dem Infobutton, zweizeiliger Tischbestellungs-Drawer, sauberes 2x2 Raster am Tisch (Bestellverlauf statt X-Bon Schicht) und robuste Behandlung von GitHub API Limits im Versions-Manager.

### Weshalb
1. **Bestellverzögerung für Storno:** Auf Festen kommt es vor, dass eine Bedienung am Tisch einen falschen Artikel antippt oder der Gast sich unmittelbar umentscheidet. Bisher wurde der Bon sofort in Küche/Ausschank gedruckt, was dort Verwirrung stiftete und eine aufwendige Leitungs-Stornierung mit Storno-Bon erforderte. Eine konfigurierbare Verzögerung (z.B. 60s) erlaubt das sofortige Abwählen einzelner Positionen direkt am Tisch, bevor Papier bedruckt wird. Wenn deaktiviert, bleibt die Storno-Schaltfläche dauerhaft deaktiviert.
2. **Auswahl spezifischer Storno-Artikel:** Bei einer Fehleingabe soll nicht zwingend die gesamte Tischbestellung storniert werden, sondern die Bedienung kann gezielt auswählen, welche Positionen der Bestellung storniert werden.
3. **Barzahlungs-Ergonomie:** Die Rundungsleiste mit den 1 €- und 0,50 €-Pfeilen war in Stufe 2 (Zahlart-Auswahl) noch sichtbar, obwohl sie nur bei Barzahlung (Stufe 3) benötigt wird. Zudem war der Betragssplit verwirrend und wird in der schnellen Bedienansicht nicht gebraucht.
4. **Aufgeräumter Tisch-Aktionsbereich:** X-Bon Schicht ist bereits in der Kopfleiste vorhanden; an seiner Stelle im 2x2 Schnellwahl-Raster steht nun der Bestellverlauf, wodurch die redundante 4. Zeile entfällt.
5. **Ergonomie in Artikelauswahl & Bonkasse:** Der Allergenfilter wird im schnellen Festbetrieb an der mobilen Bedienung und Kasse nicht gebraucht. Der Artikelzähler (`1x`, `2x`) engte neben dem Info-Button den Artikelnamen ein und wird nun sauber vertikal unter dem Info-Icon platziert. Im Tischbestellungs-Drawer steht `(x Pos.)` nun auf einer eigenen zweiten Zeile.
6. **Robustheit beim System-Update:** Temporäre Rate-Limits der unauthentifizierten GitHub-API (HTTP 403) führten zu einer beunruhigenden gelben Meldung „Prüfung unvollständig“, obwohl die lokale Git-Prüfung fehlerfrei ergab, dass alles auf dem neuesten Stand ist.

### Wie (Technik)
- **Datenbank & Konfiguration (`prisma/schema.prisma`, `src/types/domain.ts`, `src/lib/config-whitelist.ts`):**
  - Erweiterung von `EventConfig` um `enableOrderPrintDelay` (Boolean, default: false) und `orderPrintDelaySeconds` (Int, default: 60).
  - Aufnahme in die Feld-Whitelist, Typ-Koerzierung und `/api/config/public`.
  - Admin-Einstellungs-Toggle & Sekunden-Auswahl (30s, 45s, 60s, 90s, 120s, 180s, 300s) in `GeneralTab.tsx`.
- **Verzögerter Bondruck (`src/lib/order-delay-manager.ts`, `src/app/api/orders/route.ts`):**
  - Neuer Manager mit Timer-Map: Bei aktiver Verzögerung wird der Bon-Druck über `setTimeout` verzögert.
  - Nach Ablauf lädt der Manager den frischen Stand der Bestellung aus der DB und druckt nur nicht-stornierte Positionen über `TicketSplitter.routeAndPrintOrder`.
- **Storno vor Bondruck (`src/app/api/orders/[id]/void/route.ts`):**
  - Innerhalb des Storno-Zeitfensters ist keine Admin-PIN erforderlich.
  - Die Bedienung wählt spezifische `itemIds` ab.
  - Kein physischer Storno-Bon wird gedruckt (Original wurde noch nicht gedruckt).
  - Bei vollständigem Storno aller Positionen wird der anstehende verzögerte Druck abgebrochen.
- **Bedienoberfläche Tischansicht (`src/app/waiter/page.tsx`):**
  - Storno-Schaltfläche: Wenn Feature deaktiviert -> dauerhaft `disabled`. Wenn aktiv und Bestellung im Zeitfenster -> Anzeige des sekundengenauen Countdowns `Storno (45s)` und klickbar. Nach Ablauf -> `disabled`.
  - Storno-Modal: Auswahlliste aller Positionen zum An-/Abwählen, Anzeige der verbleibenden Sekunden vor Druck, Ausblenden des Admin-PIN-Pads bei Sofort-Storno.
  - Tisch-Raster: 2x2 Anordnung mit Storno, Umbuchen, Zusammenlegen und Bestellverlauf.
- **Kassieransicht (`src/app/waiter/payment/page.tsx`):**
  - Zeile 2 (Rundungsleiste mit 1 € / 0,50 € Pfeilen) wird nur noch in `stage === 'CASH'` gerendert.
  - Betragssplit-Karte vollständig entfernt.
- **Bestellverlauf-Modal (`src/components/waiter/waiter-order-history-modal.tsx`):**
  - Redundantes blaues Badge `Tisch Tisch 15` ausgeblendet, wenn `tableLabel` vorhanden ist.
- **Artikelauswahl & POS (`src/app/waiter/order/page.tsx`, `src/app/pos/page.tsx`):**
  - Allergen-Filter-Button und Dropdown entfernt.
  - Vertikales Stapeln des Info-Icons oben und des Mengenzählers (`1x`) darunter in einer Spalte (`flex flex-col items-end gap-1 shrink-0`).
  - Tischbestellungs-Drawer: `(x Pos.)` steht nun unter `Tischbestellung`.
- **GitHub Rate-Limit Toleranz (`src/app/api/system/update/route.ts`):**
  - Erkennt HTTP 403/429 von GitHub und setzt bei erfolgreicher Git-Prüfung `checkIncomplete = false` mit informativem Hinweistext.

## v0.4.37 – Entkopplung Hardware-Polling, Kassen-Auswahllogik, Rückgeldrechner ganz oben & Sticky-Buttons (11.09.2026)

> Entkopplung des 10s-Intervalls von GitHub-Netzwerkanfragen (stille CPU/RAM/Speicher-Aktualisierung via `metricsOnly=1`), Bereinigung doppelter Artikelzähler (nur noch in der Kachel), neue Kassierlogik mit Startwert 0 und +1 je Tippen, Ausblenden der Rundungsleiste in Stufe 1, Tausch von Rückgeldrechner (ganz oben) und Pfeilleiste in der Baransicht sowie dauerhafte Sticky-Verankerung des Kassenbuttons auf Mobilgeräten.

### Weshalb
1. **Ruhige Hardware-Aktualisierung:** Das 10-Sekunden-Intervall für CPU/RAM/Speicher im Versions-Manager rief bisher die volle Statusfunktion auf, was alle 10s den Prüfen-Button rotieren ließ, GitHub abfragte und das Protokoll mit „System ist auf dem neuesten Stand“ vollfüllte.
2. **Artikelzähler-Ergonomie:** Auf den Produktkacheln wurde der Zähler doppelt angezeigt (rechts oben am Eck und innen im Kasten). Nur der Zähler im Kasten soll sichtbar sein.
3. **Kassier-Auswahllogik:** In der Kellner-Kassieransicht waren bisher standardmäßig alle offenen Positionen selektiert. Oft zahlt ein Gast jedoch nur einzelne Getränke oder Speisen. Es soll standardmäßig kein Artikel vorausgewählt sein (Start bei 0) und jedes Antippen der Position soll die Menge um 1 erhöhen.
4. **Aufgeräumte Artikelauswahl (Stufe 1):** Die Trinkgeld- und Rundungsleiste mit den 1 €- und 0,50 €-Pfeilen nahm in der Artikelauswahl unnötig vertikalen Platz weg und gehört erst in die Bezahlansichten (ab Stufe 2 / Baransicht).
5. **Rückgeldrechner ganz oben in der Baransicht:** Beim Kassieren von Bargeld ist das Wichtigste, gegebenes Geld und das Rückgeld unmittelbar im Blick zu haben. Der Rückgeldrechner soll an oberster Stelle stehen und die Rundungspfeile direkt darunter.
6. **Sticky-Verankerung auf Mobilgeräten:** Bei langen Bestellungen oder auf Smartphones mit dynamischer Browser-Adressleiste verschwand der grüne Kassenabschluss-Button unter den Bildschirmrand. Er muss dauerhaft am unteren Rand fixiert sein.

### Wie (Technik)
- **Stilles Hardware-Intervall (`src/app/api/system/update/route.ts`, `src/app/admin/system-update/page.tsx`):**
  - Unterstützung des Query-Parameters `?metricsOnly=1`: Liefert blitzschnell nur CPU, Memory, DiskSpace und Uptime zurück. Überspringt alle Git- und GitHub-Aufrufe.
  - Implementierung von `fetchLiveHardwareMetrics()` im Frontend für das 10-Sekunden-Intervall ohne rotierenden Button und ohne Terminal-Log-Einträge.
- **Bereinigung Artikelzähler (`src/app/waiter/order/page.tsx`, `src/app/pos/page.tsx`):**
  - Entfernung des absoluten Eck-Badges (`absolute -top-2 -right-2`). Die Anzeige verbleibt ausschließlich kompakt und aufgeräumt im inneren Artikelkasten.
- **Kassier-Auswahllogik (`src/app/waiter/payment/page.tsx`):**
  - `extractPayableItems()` initialisiert `selectedQty: 0` (Zahlbetrag startet bei 0,00 €).
  - `toggleItem()` inkrementiert bei jedem Klick um `+1` (bis `totalUnpaidQty`; bei Erreichen des Maximums Rücksprung auf 0).
- **Trinkgeld-Rundungsleiste bedingt einblenden (`src/app/waiter/payment/page.tsx`):**
  - Rundungsleiste wird in `stage === 'SPLIT'` ausgeblendet und erst ab `stage === 'METHOD'` bzw. `stage === 'CASH'` gerendert.
- **Tausch Rückgeldrechner & Pfeilleiste (`src/app/waiter/payment/page.tsx`, `src/components/ui/change-calculator.tsx`):**
  - In `stage === 'CASH'`: Rückgeldrechner-Kopf (`Gegeben: X € | Rückgeld: Y €` mit Zurücksetzen-Funktion) wird ganz oben gerendert.
  - Die Rundungs-Pfeilleiste wird direkt darunter platziert.
  - `ChangeCalculator` unterstützt `hideSummary={true}` zur Vermeidung von Doppelanzeigen.
- **Dauerhafte Sticky-Verankerung (`src/app/waiter/payment/page.tsx`):**
  - Bindung des Hauptcontainers an `h-[100dvh] max-h-[100dvh]`.
  - Hinzufügen von `min-h-0` auf Flex-Container und Artikellisten für verlässliches internes Scrollen.
  - Footer-Buttons als `shrink-0 sticky bottom-0 z-20` verankert.

## v0.4.36 – Live-CPU & Hardware-Polling, Strikte Release-Filterung, Artikel-Zähler & Ergonomie-Optimierung (11.09.2026)

> Integration von CPU-Auslastung & automatischem 10s-Intervall im Versions-Manager, kontrastreicher Ladebalken, strikte Filterung von GitHub-Releases (ohne Git-Tags), prominenter QR-E-Bon, Artikel-Zählerkacheln und vergrößerte Tischbestellungen für Bedienung & Bonkasse.

### Weshalb
1. **Hardware-Monitoring & Systemzustand:** Im System-Update & Versions-Manager war neben Arbeitsspeicher und Speicherplatz die CPU-Auslastung nicht ersichtlich. Zudem wurden Hardwaredaten bisher nur einmalig beim Laden abgefragt.
2. **Ladebalken-Kontrast & Release-Filter:** Der Ladebalken beim Systemupdate war auf dunklen Hintergründen schwer erkennbar. Der Schalter „Nur Releases anzeigen“ zeigte bisher alle 40 Git-Tags an, wenn noch keine GitHub-Releases publiziert wurden.
3. **E-Bon & NFC:** Moderne Mobilgeräte (iOS & Android) unterstützen Web-NFC von Handy zu Handy nicht (P2P abgeschafft). Gäste konnten ihren digitalen Beleg nicht per NFC auf ihr Smartphone übertragen. Der QR-Code muss daher direkt und unmissverständlich im Vordergrund stehen.
4. **Bedienoberfläche & Bonkasse:**
   - Beim Tippen auf Artikel war nicht direkt am Artikel ersichtlich, wie oft er ausgewählt wurde.
   - Der Abschnitt „Tischbestellungen“ und die Artikelzeilen waren zu klein und schwer lesbar.
   - Die Buttons „Bestellen“ und „Kassieren“ waren seitenverkehrt (Kassieren gehört nach links, Bestellen nach rechts).
   - Die selten genutzten Schnellbuttons „Gleiche Runde“ und „Zwischenrechnung“ überfrachteten das Menü.
   - „Rabatt / Freiverzehr“ und „Personal / Bewirtung“ sollten in der Standard-Bedienansicht ausgeblendet sein.

### Wie (Technik)
- **CPU-Auslastung & 10-Sekunden-Polling (`src/app/api/system/update/route.ts`, `src/app/admin/system-update/page.tsx`):**
  - CPU-Tick-Delta-Messung (120ms) liefert reale CPU-Auslastung in %, Anzahl der Prozessorkerne und Modell.
  - Automatisches 10-Sekunden-Aktualisierungsintervall (`setInterval`) für CPU, RAM und Festplatte.
  - Ersatz der Umgebungskarte durch „Prozessor (CPU)“-Kachel mit Farbstatus (Grün, Gelb, Rot).
- **Ladebalken & Strikte Release-Filterung (`src/app/admin/system-update/page.tsx`):**
  - Ladebalken-Track mit kontrastreichem Rand (`bg-slate-800/90 border-2 border-slate-600`) und leuchtendem Gradienten (`emerald-400` bis `teal-300` mit Glow-Effekt).
  - Strikte Filterung: `onlyReleases` filtert alle Git-Tags aus und zeigt ausschließlich GitHub-Releases an (oder einen Hinweistext bei Nichtvorhandensein).
- **E-Bon & QR-Code-Fokus (`src/app/waiter/payment/page.tsx`, `src/app/pos/page.tsx`):**
  - Standardanzeige des digitalen E-Bons als sofort scannbarer QR-Code für jedes Smartphone.
  - Eindeutige Hinweise zur NFC-Verwendung (NFC nur für physische NFC-Tags/Karten; Gast-Smartphones scannen den QR-Code).
- **Artikel-Klickzähler (`src/app/waiter/order/page.tsx`, `src/app/pos/page.tsx`):**
  - Berechnung der Artikelanzahl je Produkt im Warenkorb via `productCartCounts`.
  - Direkter Zähler (`1x`, `2x`...) im kleinen Artikelkasten sowie auffälliger Eck-Badge auf jeder Kachel.
- **Tischbestellungen & Typografie (`src/app/waiter/order/page.tsx`, `src/app/pos/page.tsx`):**
  - Vergrößerung des Tischbestellungs-Drawers (`75vh`) und der Kassen-Seitenleiste (`420px`).
  - Deutlich größere Schriftarten für Artikelnamen, Optionen, Preise und größere Plus/Minus-Touch-Schaltflächen.
- **Bedientasten & Zahlarten (`src/app/waiter/page.tsx`, `src/app/waiter/payment/page.tsx`):**
  - Tausch der Hauptbuttons am Tisch: Kassieren links (grün), Bestellen rechts (blau).
  - Entfernung von „Gleiche Runde“ und „Zwischenrechnung“ aus den Schnellfunktionen am Tisch.
  - Ausblenden von `DISCOUNT` und `NON_PAID_STAFF` bei den Bezahlmethoden.

---

## v0.4.35 – Großes System-, Kellner- & Abrechnungs-Upgrade (11.09.2026)

> Zusammenführung von Personal & Abrechnung mit Soll/Ist-Trinkgeldabgleich, RAM-Monitor & Hotfix-Update im Versions-Manager, Vorlagen-Download/Upload, intuitive Touch-Trinkgeldrundung am Kellner-Terminal, Tisch-Bestellhistorie und Optimierung der Bedienoberflächen.

### Weshalb
1. **Getrennte Abrechnungsbereiche:** Die bisherige Trennung von `/admin/settle` (Kassensturz) und `/admin/tips` (Trinkgeld & Kellner-Profile) führte zu doppelter Navigation und Verwirrung. Zudem fehlte beim Kassensturz die Möglichkeit, das tatsächlich abgegebene Ist-Trinkgeld zu erfassen und mit dem errechneten Soll-Trinkgeld abzugleichen.
2. **System-Update & Transparenz:** Im System-Update-Manager fehlte eine direkte Übersicht über die Systemauslastung (RAM). Zudem führte die Anzeige aller Git-Tags bei Laien zu Unklarheiten, und wenn man bereits auf der neuesten Release-Version war, konnte man kürzlich veröffentlichte Hotfixes nicht auf Knopfdruck einspielen.
3. **Vorlagen-Portabilität:** Event-Konfigurationen (Tische, Warengruppen, Artikel, Bon-Layouts) konnten zwar als Snapshot gespeichert werden, ließen sich aber nicht als handliche Datei exportieren, um sie zwischen verschiedenen Festen oder Kassenrechnern auszutauschen.
4. **Kellner-Bedienfluss:** Am Kellner-Terminal beim Kassieren war das Eintragen von Trinkgeld über den Ziffernblock aufwendig. Eine intuitive Touch-Rundung per Pfeiltasten beschleunigt den Vorgang im Festzelt erheblich. Die Kopfzeilen waren zudem mit selten genutzten Buttons überladen, und im Split-Modus stifteten Bruch-Tasten (1/2, 1/3) Verwirrung.
5. **Tisch-Bestellhistorie & Chat:** Es fehlte eine direkte Möglichkeit für Kellner, bisherige Bestellungen an einem Tisch tischbezogen einzusehen. Im Chat führte die Anzeige alter ungelesener Nachrichten aus früheren Schichten zu Fehlalarmen.

### Wie (Technik)
- **Vereintes Menü „Personal & Abrechnung“ (`src/app/admin/settle/page.tsx`, `src/components/navigation/navbar.tsx`):**
  - Zusammenführung unter `/admin/settle` mit drei übersichtlichen Reitern:
    - *Reiter 1: Kassensturz & Schichtabrechnung* (Geldbeutel zählen, Soll/Ist vergleichen, gezähltes Ist-Trinkgeld erfassen, Trinkgeld-Differenz berechnen, Beleg drucken).
    - *Reiter 2: Bedienungen & Trinkgeld-Regeln* (Personal anlegen, PINs vergeben, Profile und Trinkgeld-Pools steuern).
    - *Reiter 3: Live-Umsatzübersicht* (Statistiken aller Kellner auf einen Blick mit Direktsprung zum Kassensturz).
  - Umleitung der alten Route `/admin/tips` auf `/admin/settle?tab=staff` (`src/app/admin/tips/page.tsx`).
- **Erfassung von Ist-Trinkgeld & Differenz:**
  - Im Schritt 3 des Kassensturzes neues Zählfeld für das tatsächlich abgegebene Trinkgeld (`Gezähltes Trinkgeld`).
  - Im Schritt 4 transparente Gegenüberstellung: Soll-Trinkgeld vs. Ist-Trinkgeld = Trinkgeld-Differenz (+/-). Speicherung und Andruck auf dem Abrechnungsbeleg.
- **System-Update & RAM-Monitor (`src/app/api/system/update/route.ts`, `src/app/admin/system-update/page.tsx`):**
  - RAM-Echtzeitmetriken (Gesamt-RAM, belegter RAM in GB und Auslastung in %) über `os.totalmem()` und `os.freemem()`.
  - Neuer Schalter `Nur Releases anzeigen` (standardmäßig aktiv), filtert Tags heraus und zeigt nur verifizierte GitHub-Releases.
  - 1-Klick Hotfix-Aktualisierung: Neuer Banner mit Schnellaktualisierung auf den neuesten Entwicklungsstand (`master`), selbst wenn die Hauptversion aktuell ist.
- **Vorlagen Download & Upload (`src/app/api/profiles/route.ts`, `src/app/admin/settings/tabs/SnapshotsTab.tsx`):**
  - Download von Snapshots als JSON-Datei über Blob-Download im Browser.
  - Upload-Handler (`action: 'IMPORT'`) zur Wiederherstellung von Event-Vorlagen aus JSON-Dateien ohne Überschreiben von Buchungen.
- **Kellner-Zahlungsmaske (`src/app/waiter/payment/page.tsx`, `src/app/api/payments/route.ts`):**
  - 4 Touch-Pfeiltasten zur schnellen Betragsrundung: Linke Pfeile (▲/▼) für 1,00 €, rechte Pfeile (▲/▼) für 0,50 €. Automatische Untergrenzen-Begrenzung auf den fälligen Betrag.
  - Groß zentrierter Zahlbetrag, Tischnummer dezent oben rechts, kleiner Zurück-Pfeil links neben Titel.
  - Entfernung von History- (`↺`) und Stummschalten-Buttons (`🔈x`) in den Kassen-Kopfzeilen.
  - Entfernung der `1/2, 1/3, 1/4` Split-Buttons für einfacheres, fehlerfreies postenweises Kassieren.
  - Fixierter Kassenabschluss-Button am Bildschirmrand (`sticky bottom-0 z-10`) mit flexibler Skalierung auf allen Smartphone-Bildschirmgrößen.
- **Tisch-Bestellhistorie (`src/components/waiter/waiter-order-history-modal.tsx`, `src/app/waiter/page.tsx`, `src/app/waiter/order/page.tsx`):**
  - Neuer Tisch-Verlaufsdialog zur Ansicht aller Bestellungen am Tisch über alle Kellner hinweg.
- **Bedienungswechsel-Bereinigung (`src/app/waiter/page.tsx`):**
  - Textlink `(Wechseln)` entfernt; Wechsel erfolgt sauber über Antippen des Kellnernamens; Schließen-Knopf `[X]` im PIN-Dialog ergänzt.
- **Zahlungsarten-Reihenfolge (`src/lib/payment/methods.ts`):**
  - Tausch der Positionen von `Bargeld` und `Rabatt / Freiverzehr` für schnellere Erreichbarkeit.
- **Chat-Ungelesen-Zähler (`src/components/navigation/navbar.tsx`):**
  - Ungelesen-Badges berücksichtigen nur noch Nachrichten, die nach dem Zeitpunkt der aktuellen Anmeldung eingegangen sind.
- **Bedienungs-Anmeldung vor Tischauswahl (`src/app/waiter/page.tsx`):**
  - Entkopplung des automatischen Tischnummern-Ziffernblocks: Ist noch kein Bedienungsname auf dem Gerät hinterlegt, bleibt der Tischnummern-Block geschlossen und es öffnet sich ausschließlich die Namensabfrage.
  - Anzeige aller im System angelegten Kellner als schnelle Touch-Buttons neben der freien Namenseingabe.
  - Verpflichtende Eingabe (kein leerer Name / reiner Platzhalter möglich; kein versehentliches Wegklicken mit `[X]`, solange man noch nicht angemeldet ist).
  - Nach Bestätigung des Namens öffnet sich der Tischnummern-Ziffernblock automatisch.
- **Top-Seller Produkt-Ranking (`src/app/api/reports/route.ts`):**
  - Differenzierung von Produktvarianten in Berichten (z. B. „Pizza (Groß)“ vs. „Pizza (Klein)“).

---

## v0.4.34 – Fix: Dynamische Bereitstellung & Sichtbarkeit des Papierbon-Knopfs an der Bonkasse (11.09.2026)

> Behebt die fehlende Anzeige des Papierbon-Knopfs an der Bonkasse (`/pos`), wenn die Option in den Einstellungen aktiviert wird. Verhindert statisches Caching der öffentlichen Konfiguration und ergänzt bequeme Umschalter und Druckoptionen direkt auf der Kassenoberfläche sowie im Belegdialog.

### Weshalb
1. **Next.js Prerender-Bug bei `/api/config/public`:** Die Route `/api/config/public/route.ts` verfügte über kein explizites `force-dynamic`. Beim Produktions-Build erzeugte Next.js die Route als statisch (`○ (Static)`), wodurch Änderungen an Einstellungen (wie `enablePosReceiptPrint`) in der Datenbank nicht an die Clients ausgeliefert wurden, sondern der statische Build-Stand ausgeliefert wurde.
2. **Fehlende Echtzeit-Aktualisierung an der Bonkasse:** Die Bonkassen-Seite (`/pos`) hörte bisher nicht auf das WebSocket-Event `config:updated`. Wurden Einstellungen im Admin geändert, blieben sie an bereits geöffneten Bonkassen unbemerkt.
3. **Erweiterte Sichtbarkeit & Bedienbarkeit:** Der Papierbon-Knopf war bisher ausschließlich tief im nachgelagerten Belegdialog nach dem Kassieren verortet. Auf der Hauptmaske der Bonkasse gab es keinerlei sichtbaren Schalter oder Indikator, sodass für den Bediener nicht ersichtlich war, ob der Papierbon-Druck aktiv ist oder direkt gesteuert werden kann.

### Wie (Technik)
- **Dynamische Route & Cache-Control (`src/app/api/config/public/route.ts`):** 
  - `export const dynamic = 'force-dynamic';` und `export const revalidate = 0;` deklariert (im Build jetzt `ƒ (Dynamic)`).
  - Antwortkopf `Cache-Control: no-store, no-cache, must-revalidate` gesetzt, um Browser-/Proxy-Caching vollständig auszuschließen.
- **Echtzeit-Synchronisation (`src/app/pos/page.tsx`):**
  - Socket-Listener für `config:updated` registriert, sodass Konfigurationsänderungen aus dem Admin-Bereich sofort ohne Neuladen der Seite an der Kasse wirksam werden.
  - Fenster-/Tab-Fokus-Listener (`focus`) hinzugefügt, der beim Zurückwechseln aus den Admin-Einstellungen die Konfiguration automatisch auffrischt.
- **Präsenz an der Bonkasse (`src/app/pos/page.tsx`):**
  - **Kopfzeile (Top Bar):** Gut sichtbarer Touch-Button `[ 🖨 Papierbon: AN / AUS ]` neben Bestellhistorie und Kassenlade, wenn die Option in den Einstellungen aktiv ist.
  - **Warenkorb:** Schnellumschalter `[ 🖨 Papierbon drucken: AKTIV / AUS ]` direkt über der Gesamtsumme und dem Kassieren-Button.
  - **Kassiermaske:** Kassenbon-Druck-Schalter nur noch dann eingeblendet, wenn die Funktion in den Einstellungen aktiviert ist.
  - **Belegdialog nach dem Kassieren:** `[ 🖨 Papierbon ]` ist touch-groß verfügbar; bei bereits gedrucktem Bon kann der Beleg jederzeit über `[ 🖨 Erneut drucken ]` ein weiteres Mal ausgegeben werden (z. B. bei Papierstau oder Zweitbeleg-Wunsch).
- **Test-Absicherung (`src/__tests__/build_and_schema.test.ts`):** Prüfung auf `force-dynamic`, `revalidate = 0`, `no-store` Header und korrekte Übertragung des Flags `enablePosReceiptPrint: true`.

---

## v0.4.33 – Hotfix: Boolean-Typisierung der Kartenzahlungs-Schalter beim Speichern der Einstellungen (11.09.2026)

> Behebt einen Prisma-Typfehler (`Argument 'cardSumupEnabled': Invalid value provided. Expected Boolean, provided String`), der beim Speichern der Grundeinstellungen im Admin-Bereich auftrat.

### Weshalb
Beim Absenden des Einstellungs-Formulars wurden die Schalter `cardSumupEnabled`, `cardVrPayEnabled`, `cardSparkasseEnabled`, `cardZvtEnabled`, `cardStripeEnabled` und `cardZettleEnabled` durch `sanitizeConfigInput` in Zeichenketten (`"false"` bzw. `"true"`) statt echte boolesche Werte konvertiert, weil sie in der internen Schalter-Whitelist fehlten. Dies führte zu einem Speicher-Abbruch mit roter Fehlermeldung in der Benutzeroberfläche.

### Wie (Technik)
- **Konfigurations-Whitelist (`src/lib/config-whitelist.ts`):** `cardSumupEnabled`, `cardVrPayEnabled`, `cardSparkasseEnabled`, `cardZvtEnabled`, `cardStripeEnabled` und `cardZettleEnabled` in `CONFIG_BOOLEAN_FIELDS` aufgenommen.
- **Typen-Koerzierung:** `sanitizeConfigInput` konvertiert nun auch String-Darstellungen (`"false"`, `"true"`, `"0"`, `"1"`) verlässlich in echte TypeScript/Prisma-Booleans.
- **Test-Absicherung (`src/__tests__/card_payment.test.ts`, `src/__tests__/build_and_schema.test.ts`):** Unit- und Datenbank-Integrationstests zur Verifikation der fehlerfreien Konfigurationsspeicherung hinzugefügt.

---

## v0.4.32 – Bonkasse E-Bon per NFC & Beleg-Auswahl (Bild 1), Papierbon-Option & Menü-Navigationsschutz bei ungespeicherten Einstellungen (11.09.2026)

> Ergänzt in der Bonkasse nach dem Kassieren eine touch-optimierte Beleg-Auswahl aus E-Bon per NFC, Papierbon (steuerbar per Schalter) und schnellem Belegabschluss (Kein Beleg). Sichert den Admin-Bereich vor Datenverlust durch lückenlose Erfassung aller Menüwechsel und Stationswechsel bei ungespeicherten Einstellungen ab.

### Weshalb
1. **Bonkasse Beleg-Übertragung per NFC & Abschluss:** An der Theke fehlte nach dem Kassieren eine direkte Möglichkeit, dem Gast den digitalen Beleg per Smartphone-NFC zu übertragen oder mit „Kein Beleg“ sofort frei zu machen. Die bisherige Anzeige war nicht intuitiv.
2. **Papierbon-Knopf an der Bonkasse:** Manche Theken drucken standardmäßig keine Papierbelege, möchten aber auf Kundenwunsch nachträglich einen Bon ausdrucken können.
3. **Schutz vor Datenverlust in den Admin-Einstellungen:** Wurden Werte in den Einstellungen editiert (`isDirty`), ging die Eingabe unbemerkt verloren, sobald man im Hauptmenü auf Chat, Artikel, Dashboard oder eine andere Station klickte.

### Wie (Technik)
- **Bonkasse Beleg-Auswahl (`src/app/pos/page.tsx`):** Nach dem Kassieren erscheint die Beleg-Auswahlmaske:
  - `E-Bon per NFC` (grüner Button) mit Web-NFC-Übertragung (`startPosNfcBeam()`), animierter Statusanzeige und QR-Code-Alternative.
  - `Kein Beleg` (dunkler Button) leert die Maske sofort und gibt die Kasse für den nächsten Gast frei.
  - `Papierbon` (blauer Button), falls `enablePosReceiptPrint` aktiviert ist; sendet einen Nachdruck an den Drucker und wechselt auf „Beleg gedruckt“.
  - Prominente bernsteinfarbene Großanzeige für Rückgeld bei Barzahlung.
  - „Tisch schließen“-Button entfernt (Tische existieren an der Thekenkasse nicht).
- **E-Bon-Generierung im Checkout (`src/app/api/orders/checkout/route.ts`):** `digitalReceiptCode` und `digitalReceiptUrl` werden auch bei alleinigem NFC-Betrieb und mit Host-Fallback erzeugt.
- **Papierbon-Konfiguration (`prisma/schema.prisma`, `src/types/domain.ts`, `src/lib/config-whitelist.ts`, `src/app/api/config/public/route.ts`, `src/app/admin/settings/tabs/ReceiptTab.tsx`):** Neues Feld `enablePosReceiptPrint` (Default `false`) für den Schalter „Papierbon-Knopf an der Bonkasse anzeigen“.
- **Lückenlose Navigationsabfangung (`src/app/admin/settings/page.tsx`, `src/components/navigation/navbar.tsx`):**
  - Document-Capture-Listener fängt alle Klicks auf interne `<a>`- und Next.js `<Link>`-Elemente (Navbar-Menüpunkte wie Chat, Dashboard, Produkte etc.) ab, wenn `isDirty` aktiv ist.
  - Globaler Handler `(window as any).__openbon_dirty_handler` sichert Stationswechsel in der Navbar ab.
  - `popstate`-Listener sichert Browser-Zurück-/Vor-Aktionen ab.
  - In-App-Dialog bietet „Speichern & wechseln“, „Verwerfen & wechseln“ und „Hier bleiben“.

---

## v0.4.31 – Bedienung-Workflow, Drucker- & Kartenzahlungs-Optionen, Schicht-Logout, X-Bon-Druckauswahl, Invoice-Collision-Fix & Vorlagen-Inspektion (11.09.2026)

> Optimiert den Bestellabschluss der Bedienung, führt getrennte Druck- und Kartenzahlungsoptionen ein, verhindert Belegnummern-Kollisionen und ergänzt Vorlagen-Inspektor sowie ungespeicherte Änderungsabfragen.

### Weshalb
1. **Bedienansicht Bestellabschluss:** Die zwei Knöpfe „Bestellen & Tisch“ und „Bestellen & Kassieren“ führten zu Verwirrung. Ein einzelner, prominenter Hauptbutton „Bestellen & Kassieren“ genügt; verbleiben die Speisen am Tisch, kehrt die Bedienung einfach per Zurück-Pfeil zurück.
2. **Papierbon-Druck & Standard-Drucker für Quittungen:** Auf vielen Festen drucken Bedienungen keine Papierbelege aus oder es soll ein fester Quittungsdrucker zugewiesen werden.
3. **Schichtabrechnung & Bedienungs-Logout:** Bediente eine Person nach der Abrechnung weiter unter demselben Namen, wurde sie weiterhin als abgerechnet geführt. Zudem blieben offene Bedienungs-Sessions aktiv.
4. **Schichtabrechnung Druckauswahl:** Der Bondruck für Artikel und Bestellungen war gekoppelt; die Kassenleitung möchte flexibel wählen können, ob verkaufte Artikel und/oder die Bestellliste gedruckt werden.
5. **X-Bon (Zwischenstand):** Bisher gab es keine Auswahl, ob der Zwischenbericht als PDF im Browser geöffnet oder direkt an einen Bondrucker im Netzwerk gesendet wird.
6. **Kartenzahlungsanbieter steuerbar:** Bislang konnte nicht pro Anbieter festgelegt werden, ob er aktiv ist. Zudem erschien an der Kasse der Kartenzahlungs-Button auch ohne konfigurierte Anbieter.
7. **Fehler `Unique constraint failed on the fields: (invoiceNumber)`:** Beim schnellen Kassieren oder nach Kassenrücksetzungen konnte es zu Belegnummern-Kollisionen in SQLite kommen, was den Bezahlvorgang abbrach.
8. **Ausgabe-Modus an der Kasse:** Der Zweck der Leiste (Nur Kassieren vs. Wertmarken vs. Gutschein + Gegenbon) war für Helfer nicht selbsterklärend.
9. **Fest-Vorlagen einsehen:** Gespeicherte Vorlagen konnten bisher nur blind geladen, aber nicht vorab eingesehen werden.
10. **Ungespeicherte Einstellungen:** Beim Tab-Wechsel im Admin-Bereich gingen geänderte Konfigurationen verloren oder erforderten Browser-Systemdialoge.

### Wie (Technik)
- **Bedienansicht (`src/app/waiter/order/page.tsx`):** „Bestellen & Tisch“ entfernt. Große, durchgehende Schaltfläche „Bestellen & Kassieren“.
- **Quittungsdrucker & Bon-Schalter (`src/app/admin/settings/tabs/ReceiptTab.tsx`, `src/app/waiter/payment/page.tsx`):** `receiptPrinterId` und `enableWaiterReceiptPrint` (Default `false`) im Schema und Whitelist ergänzt. In `payments/route.ts` und `payments/[id]/receipt/route.ts` wird `receiptPrinterId` priorisiert. Bei der Bedienung wird der Papierbon-Knopf nur bei aktivem Flag gerendert.
- **Schichtverwaltung & Echtzeit-Logout (`src/app/api/waiters/route.ts`, `src/app/api/waiters/settle/report/route.ts`, `src/app/waiter/page.tsx`, `src/app/waiter/order/page.tsx`, `src/app/waiter/payment/page.tsx`):** Neuanlage von Schichten (`Schicht 2`, `Schicht 3`) nach Abrechnung. Socket-Event `waiter:settled` meldet die betroffene Bedienung in Echtzeit auf allen Geräten ab und leert den lokalen Speicher.
- **Schichtabrechnung Druckoptionen (`src/lib/printer/escpos-builder.ts`, `src/app/api/waiters/settle/route.ts`, `src/app/admin/settle/page.tsx`):** Getrennte Checkboxen `printItemsSold` und `printOrders` (beide Default `false`) in 80mm- und A4-Belegen.
- **X-Bon Druckauswahl (`src/app/waiter/page.tsx`, `src/app/api/reports/x-bon/route.ts`):** Dropdown zur Zielauswahl (PDF-Browseransicht oder aktiver Netzwerkdrucker). Route akzeptiert `printerId` und gibt `printedOn` zurück.
- **Kartenzahlungsanbieter Checkboxen (`src/app/admin/settings/tabs/CardPaymentTab.tsx`, `src/lib/payment/methods.ts`, `src/app/pos/page.tsx`, `src/app/api/config/public/route.ts`):** Checkboxen für SumUp, VR-Pay, Sparkasse, Zettle, Stripe, ZVT (Default `false`). `getActiveCardPaymentMethod` und `hasAnyCardPaymentConfigured` berücksichtigen die Aktivierungsflags. Kassenknopf für Kartenzahlung wird dynamisch ausgeblendet, wenn kein Anbieter aktiv ist.
- **Belegnummern-Kollisionsschutz (`src/app/api/orders/checkout/route.ts`, `src/app/api/payments/route.ts`):** `while (await tx.payment.findUnique({ where: { invoiceNumber } }))`-Schleife zählt die Belegnummer hoch und synchronisiert die `invoiceSequence` in `EventConfig`.
- **Ausgabe-Modus Kennzeichnung (`src/app/pos/page.tsx`):** Beschriftung „Ausgabe-Modus:“ mit erklärenden Tooltips für Direktverkauf, Wertmarken und Gegenbons.
- **Vorlagen-Inspektor (`src/app/admin/settings/tabs/SnapshotsTab.tsx`, `src/app/api/profiles/route.ts`):** Schnelle Übersichtskarten für Artikel-, Warengruppen-, Tisch- und Druckeranzahl. Neues Inspektions-Modal zeigt alle Speisen (mit Preisen/Pfand), Kategorien, Tische und Druckereinstellungen im Detail. DELETE-Endpunkt zum Entfernen von Vorlagen ergänzt.
- **Ungespeicherte Änderungen (`src/app/admin/settings/page.tsx`):** Interner Bestätigungsdialog beim Tab-Wechsel mit den Aktionen „Speichern & wechseln“, „Verwerfen & wechseln“ und „Hier bleiben“.

### Verifikation
- 33 Test-Suiten (217 Tests) vollständig erfolgreich (`npm test`).
- Next.js Produktions-Build (`npm run build`) kompiliert fehlerfrei (107/107 Seiten).

---

## v0.4.30 – Bezahlansicht-Button, Münzlesbarkeit, Dialog-Ersatz, Schichtabrechnung & Kompakt-Hell-Design (10.09.2026)
- **Bezahlansicht:** Schaltfläche „Alles bezahlen“ entfernt und durch „Weiter zur Zahlart“ ersetzt.
- **Münz-Design:** 1€ und 2€ Münzen im Rechner mit Bimetall-Konturen für perfekte Lesbarkeit in dunklen Designs.
- **Keine Systemdialoge:** Standard-Browser-Alerts und Confirms durch anwendungsinterne Modals ersetzt.
- **Schichtabrechnung Details:** Auswertung und Belegdruck für verkaufte Artikel und Einzelbestellungen.
- **Admin-PIN Korrektur:** Korrektur bereits abgerechneter Bedienungen nur mit Admin-PIN und revisionssicherem Audit-Log.
- **Design Kompakt-Hell:** Neues kontrastreiches Theme für Außen- und Sonnenlichtbetrieb.

---

## v0.4.29 – Chat-Badge-Fix, Warengruppen-Löschung, Reset-Foreign-Key, Bonvorschau & dynamisches Rückpfand (10.09.2026)
- **Rückpfand:** Dynamische Erkennung aktiver Pfandwerte aus der Speisekarte; Ausblendung bei festen ohne Pfandartikel.
- **Warengruppen-Löschung:** Kaskadierendes Löschen mit Bestätigungsabfrage im Adminbereich.
- **System-Reset:** Temporäre Deaktivierung von SQLite Foreign Keys bei Reset von Artikeln und Warengruppen.
- **Chat-Badge:** Synchronisation ungelesener Notrufe über lokale Speicherstände.

---

## v0.4.28 – Behebung von Kassen-, Kellner-, Druck- und Update-Problemen (10.09.2026)
- **Drucker-Routing:** Standardbelegdruck konfigurierbar, USB- und Netzwerkdrucker-Zuordnung.
- **Abrechnung A4:** PDF-Prüfbericht für Kellnerabrechnungen.
- **Bestandsabbau:** Live-Abbuchung von `Product.stockQuantity` beim Sofort-Checkout.

---

## v0.4.27 – Erststart-Assistent Verschlankung, Setup-Lifecycle & Auth-Fix (10.09.2026)

> Entfernt den Tischplan-Schnellgenerator aus der Ersteinrichtung, verhindert das Aufpoppen des Assistenten bei Geräteneustarts mit aktiver Veranstaltung und behebt den Authentifizierungsfehler beim Klick auf „Kassensystem starten“.

### Weshalb
1. **Tischplan-Schnellgenerator im Setup:** Der starre Generator im Assistenten war fehleranfällig und für die meisten Veranstaltungen unpassend, da Tischpläne flexibel im Admin-Bereich gepflegt werden.
2. **Setup poppte bei Neustarts auf:** Die Startseite prüfte ausschließlich `if (cfg.initialPinSet === false)`, wodurch auch bei bestehenden, aktiven Veranstaltungen nach einem Neustart fälschlicherweise der Assistent aufging.
3. **Authentifizierungsfehler beim Klick auf „Kassensystem starten“:** `/api/auth/initial-setup` war in der Middleware nicht freigegeben (401 Unauthorized), und die Einrichtungsseite rief geschützte Konfigurations- und Tisch-Routen ohne bestehende Session auf.

### Wie
- **Assistent verschlankt (`src/app/setup/page.tsx`):** Schritt 3 (Tischplan-Schnellgenerator) entfernt. Assistent führt nun in 3 klaren Schritten durch das Setup: 1) Veranstaltungsdaten, 2) PINs (min. 6 Ziffern), 3) Drucker & Start.
- **Setup-Lifecycle & Daten-Erkennung (`src/lib/auth-pin.ts`, `src/app/api/config/public/route.ts`, `src/app/page.tsx`):** Neue Hilfsfunktion `hasActiveEventData()` erkennt aktive Tische, Produkte oder Bestellungen. Die Konfiguration berechnet `needsSetup = !config.initialPinSet && !hasActiveData`. Bei bestehenden Daten heilt sich die Konfiguration automatisch (`initialPinSet: true`). Die Startseite leitet nur noch bei `needsSetup === true` nach `/setup` weiter.
- **Atomares Setup & Sofort-Login (`src/middleware.ts`, `src/app/api/auth/initial-setup/route.ts`):** `/api/auth/initial-setup` in `PUBLIC_PATHS` aufgenommen. Die Route speichert PINs und Veranstaltungsdaten in einer atomaren Anfrage und stellt direkt ein valides Administrator-Session-Cookie aus. Der Benutzer gelangt ohne Blockade direkt ins Admin-Dashboard. Spätere unbefugte Aufrufe werden mit 403 Forbidden abgewiesen.
- **Neue Test-Suite (`src/__tests__/setup_wizard_v0427.test.ts`):** 6 Tests decken alle Aspekte des Setups, der Daten-Erkennung und der Authentifizierung ab.

### Verifikation
`tsc --noEmit` fehlerfrei, 33 Test-Suiten (217 Tests) vollständig grün, `npm run build` erzeugt 106/106 Seiten erfolgreich.

---

## v0.4.26 – Cent-Auflösung, Zahlungs-Validierung, E-Bon-Bypass & Test-Härtung (09.09.2026)

> Behebt 4,50€ -> 0,05€ Fehler in Bestellungen, 400 Bad Request („Ungültige Eingabedaten“) beim Abkassieren und den E-Bon-Fehler in der Bonkasse.

### Weshalb
1. **Preisanzeige 4,50 € -> 0,05 €:** `api/orders` und `api/orders/checkout` riefen `resolveOrderItem` fälschlicherweise mit dem Euro-Float `effectiveBasePrice` (z. B. `4.5`) statt `effectiveBasePriceCents` (`450`) auf. `resolveOrderItem` rechnete intern `Math.round(4.5) = 5` Cent. Artikel wurden folglich mit `unitPriceCents: 5` (0,05 €) in der Datenbank gespeichert.
2. **Abkassieren scheiterte mit „Ungültige Eingabedaten“ (400 Bad Request):** Im Zod-Schema `PaymentItemInputSchema` war `unitPriceCents` als Pflichtfeld definiert. Die Bedienoberfläche (`waiter/payment/page.tsx`) sendete bisher nur `unitPrice` (Euro-Float). Zod brach sofort mit 400 Bad Request ab.
3. **Bonkasse blockierte mit „[E-BON] LICENSE_HMAC_SECRET fehlt...“:** `generateDigitalReceiptCode()` wurde bedingungslos ausgeführt, auch wenn `enableDigitalReceipt` deaktiviert war. Fehlt in `.env` der Secret-Key, warf die Funktion einen 500-Fehler und verhinderte die Barzahlung.

### Wie
- **Cent-Auflösung (`api/orders`, `api/orders/checkout`):** `effectiveBasePriceCents` wird direkt aus `getEffectiveProductPrice()` entnommen und als Cent-Ganzzahl an `resolveOrderItem` übergeben. `unitPriceCents` und `depositCents` werden direkt ohne Float-Zwischenschritte gespeichert.
- **Resiliente Validierung (`src/lib/validations/schemas.ts`):** `PaymentItemInputSchema` macht `unitPriceCents` und `depositCents` optional und berechnet sie im Schema automatisch aus `unitPrice` / `deposit` via Transform, falls ein Client nur Euro sendet. `CreatePaymentSchema` transformiert `givenAmount` automatisch zu `givenAmountCents`.
- **Bedienung Abkassieren (`src/app/waiter/payment/page.tsx`):** `submitPayment` sendet jetzt explizit `unitPriceCents`, `depositCents` und `givenAmountCents`. Der `ChangeCalculator` erhält Cent-Props.
- **E-Bon Guard (`api/orders/checkout`, `api/payments`, `api/payments/amount-split`):** `generateDigitalReceiptCode()` wird nur aufgerufen, wenn `enableDigitalReceipt` oder `enableDigitalReceiptQr` aktiv ist. Zusätzlich schützt ein `try/catch`-Block: Selbst bei fehlendem Secret schlägt die Barzahlung nicht mehr fehl, sondern verbucht regulär ohne E-Bon.
- **Neue Test-Suite:** `src/__tests__/waiter_payment_pricing_v0426.test.ts` (8 Tests für Cent-Auflösung, Validierung, Rückgeldrechner & E-Bon-Resilienz).

### Verifikation
`tsc --noEmit` fehlerfrei, 32 Test-Suiten (211 Tests) grün, `npm run build` erzeugt 106/106 Seiten erfolgreich.

---

## v0.4.25 – Schema-Defaults, Update-Robustheit, Scheine-Rechner & UI-Fixes (09.09.2026)

> Robuste Datenbank-Defaults, automatische Migration bei Updates, addierender Scheine-Rechner und Berechtigung für Tischerstellung.

### Weshalb
- Nach Update auf v0.4.24 fehlten in SQLite manchen Spalten Defaults (`NOT NULL constraint failed: OrderItem.unitPriceCents`), da SQLite keine automatischen Defaults für neue Spalten nachrüstete.
- Im Kassiervorgang waren Scheine-Knöpfe nicht addierend und absteigend sortiert.
- Kellner erhielten 403 Forbidden beim Anlegen neuer Tische.
- Im Hintergrund lief ein 401 Unauthorized Polling für Home-Assistant auf Nicht-Admin-Seiten.

### Wie
- **Prisma Schema:** `@default(0)` auf allen Cents-Spalten ergänzt (`OrderItem`, `Payment`, `PaymentItem`, `CashMovement`, `TokenTransaction`).
- **Update-Pipeline (`api/system/update`, `install-headless.sh`):** Führt vor `prisma db push` automatisch `scripts/migrate-v0417-cent.js` mit absolutem Datenbankpfad aus.
- **Rückgeld-Rechner (`change-calculator.tsx`):** Scheine 200€ bis 5€ absteigend sortiert; Klick addiert den Betrag wie Münzen.
- **Tisch-Berechtigungen (`api/tables`):** `WAITER` und `POS_CASHIER` dürfen Einzeltische anlegen.
- **HA-Status Polling:** Auf `/admin*` Pfade begrenzt (beseitigt 401 in Kellner- und Kassenansicht).

---

## v0.4.24 – Bugfix-Release: Float-zu-Cent Migration & Headless-Installer (04.09.2026)

> Box mit v0.4.17 fand kein Update, obwohl Tags auf GitHub lagen.

### Weshalb
Erkennung konnte still scheitern (4s-API-Timeout, kein Tag-Fetch, detached HEAD, Rate-Limit) und meldete trotzdem „neuesten Stand".

### Wie
- **API:** 15s-Timeout, `?per_page=100`, Rate-Limit (`403/429` + Freigabe-Zeit) ans Terminal durchgereicht.
- **Git:** `fetch origin --tags` vor Vergleich (sonst nur alte lokale Tags), detached HEAD → Vergleich gegen `origin/master`, lokaler Tag-Fallback wenn API tot.
- **Ehrlich:** statt „neuester Stand" bei unvollständiger Prüfung Warnung + Hinweise (`updateCheckWarning`/`checkNotes`, neuer Status-Text).
- **Refactor:** `compareSemver` nach `src/lib/version-compare.ts` (Next-Routen-Constraint), neuer Test `version_compare.test.ts`.
- **Version:** `0.4.22` → `0.4.23`.

### Verifikation
`tsc` sauber, `vitest` 31/203 grün, Live-Smoke gegen Server: API meldet `latest 0.4.22`, Tags `v0.4.22,v0.4.21,…`, keine Warnung.

## v0.4.22 – CI-DB-Fix: isolierte Test-DB, Actions v5, Pfad-Einheit (04.09.2026)

> GitHub-CI war rot (9 Fehler + DB-unreachable): CI schrieb `./dev.db`, Tests lasen `prisma/dev.db`. Kein Produkt-Code-Change, nur Test-/CI-/Pfad-Hygiene.

### Weshalb
`db.ts`-Default `prisma/dev.db` vs. CI/Seed/Installer `./dev.db` → `Error 14: Unable to open the database file` in 3 Suiten; Folge: alle PIN/HA-Asserts rot. Dazu Node-20-Deprecation-Warnung (checkout/setup-node v4).

### Wie
- **Isolierte Test-DB:** CI-Job-Env `DATABASE_URL=file:./prisma/test.db` + `FISCAL_SALT`/`LICENSE_HMAC_SECRET` (CI-Secrets, je ≥16 Zeichen); `db push --force-reset` + Seed gegen `test.db`; `npm test` + `npm run build` laufen mit derselben Env. `prisma/test.db*` ist git-ignored (`*.db` deckt ab, explizit dokumentiert im Workflow-Kommentar).
- **Pfad-Einheit Prod:** `seed.js`, `ensure-secret.js`, `system/update`-Route (3 Stellen), `install-headless.sh` (7 Stellen: .env-Gerüst, generate/push/seed/build, systemd-Unit) → `file:./prisma/dev.db`. Vitest-DB-Pfad-Test auf `prisma/(test|dev).db` gelockert.
- **CI-Robustheit:** `actions/checkout@v5`, `actions/setup-node@v5` (Node 22 bleibt); Vitest `singleFork` (ein Fork, keine parallelen SQLite-Locks; `fileParallelism: false` bleibt).
- **Kleinfix:** `build_and_schema.test.ts` `cardGross: 120.0` → `cardGrossCents: 12000`.
- **Version:** `0.4.21` → `0.4.22` (package.json, version.ts, Versionstests).

### Verifikation
Lokal mit CI-Env (`prisma/test.db`, frischer Reset): `tsc` sauber, `vitest` 30/201 grün, `next build` erfolgreich.

## v0.4.21 – Echte HA-Sperre, Küchen-Quittung, Funk-Räume, PIN/Sicherung/DB-Pfad (04.09.2026)

> Antwort auf Re-Audit-Kritik („hätte schon vorher drin sein sollen"). Steuer-Export bewusst ausgenommen.

### Weshalb
Split-Brain-Wurzel (lokale Lease, kein Schreib-Guard, stilles Verwerfen), TCP-Push als falsches „gedruckt", Gäste hörten alle Events mit, Admin-PIN auf `0000` zurücksetzbar, Sicherung ohne Umsatz, DB-Pfad-Rätsel (Runtime vs. Backup/Litestream).

### Wie
- **HA-Sperre:** neu `ha-guard.ts` (`denyStandbyWrite`, 409 `HA_STANDBY_READONLY`), verdrahtet in `orders`, `checkout`, `payments`, `guest/orders`, `void`, `refund`, `amount-split`, `cash-movements`, `settle`. `promoteToPrimary` prüft zusätzlich Partner-Heartbeat (`isPartnerStillPrimary` via `/api/sync/heartbeat` + `getLeaseExpiryIso`); `pullAndApplySyncDelta` paginiert (20×100); `applyJournalEntry` protokolliert Divergenz (`HA_CONFLICT` + `ha:conflict`) statt still + repliziert Order-Positionen; Retention Journal 7d→30d, Idempotenz 24h→14d (`cleanup.ts`).
- **Küchen-Quittung:** `PrintJob` + `confirmedAt/confirmedBy`, Status `CONFIRMED`; neu `POST /api/printers/confirm` (orderId/jobId); KDS-Knopf „Bon erhalten (Druck ok)"; Queue-Manager mit CONFIRMED-Filter + `print:confirmed`-Refresh; `socket-client.ts` mapped Event.
- **Funk-Räume:** `server.js` zentrale Routing-Tabelle (alle Geschäfts-Events → `staff_room`, `device:update` → `admin_room`), `staff_room`-Beitritt nur mit gültiger Session, `kitchen_room`/`admin_room` zusätzlich; Client→Server-Handler auf `staff_room` umgestellt; Handshake mit `iss/aud/HS256` + `__Host-`-Cookie + Decode; `devices`-Route gezielt (`io.to(target)`) + GET nur Name/Rolle/Status/Zeit. `pos:cart_*` bewusst global (Kundendisplay).
- **PIN/Sicherung/DB:** `setAdminPin`/`setAllStationPins` min. 6 + `!isWeakPin` + divers (Tests auf starke PINs umgestellt); `system/reset` setzt `initialPinSet=false` (Setup erzwingt neue PINs); Backup-Export/Restore mit Orders+Payments per Default + Payment-Restore mit Skip-Zähler; `resolveDbFile()` aus `DATABASE_URL`, Default `file:./prisma/dev.db` (`db.ts`, `server.js`, `.env`, `.env.example`, `litestream.yml`-Hinweis), Backup-Fallback nutzt Resolver + Fehler statt Schein-Pfad.
- **Tests:** neu `splitbrain_rooms_pin_v0421.test.ts` (STANDBY-409, PIN-Ablehnung, Cent-Setup, DB-Pfad); e2e-Cleanup gegen artfremde Items in E2E-Kategorien gehärtet. Gesamt grün.
- **Version:** `0.4.20` → `0.4.21`.

### Offen
Fiskaly-`update()` No-Op, DSFinV-Stammdaten, DATEV-Rundung, Drucker-Hardware-Readback (Quittung ist Personal-ACK, kein Sensor), PWA/Skeletons/Bottom-Sheet, Reports-`groupBy`, `pos:cart_*` weiter öffentlich (Display-Betrieb).

## v0.4.20 – Audit-Fixes: Rate-Limit, E-Bon, Kalt-Standby, Druck-Ehrlichkeit, fehlende Knöpfe (04.09.2026)

> Plan aus Re-Audit, Suche nur Theke+Kiosk (kein waiter/order), Refund-Button in Cashbook, Version 0.4.20.

### Weshalb
Rate-Limit zählte Stunden-Fenster als Minuten (Enumeration/Brute-Force), E-Bon mit Public-Fallback + Math.random vorhersagbar, HA-Default widersprüchlich (Compose 0 vs. DB true, ENV ohne Vorrang), Drucker mit stillen Drops + Ganz-Order-ACK + 50er-Recovery-Deckel, 5 Backend-Routen ohne UI-Knopf.

### Wie
- **Rate-Limit:** `rate-limiter.ts` `registerSimpleAttempt(key, windowMs)` (Default 60s), Aufrufer `receipt` (1h), `initial-setup` (1h), `refund` (10min) übergeben Fenster; `checkGlobalFlood` nutzt `GLOBAL_MAX_ATTEMPTS=150/h` + `GLOBAL_WINDOW_MS` statt 5/min.
- **E-Bon:** `digital-receipt.ts` fail-closed ohne `LICENSE_HMAC_SECRET` (Test-Fallback nur Vitest), `crypto.randomBytes(16)` statt `Math.random`, 128 Bit. `.env.example` dokumentiert Pflicht-Key.
- **Kalt-Standby:** Schema `haAutoFailover @default(false)`, `ha-service.ts` ENV-Vorrang (DB nur wenn ENV unset), `docs/HOCHVERFUEGBARKEIT.md` auf manuell + Journal-Lücken + Litestream-Hinweis korrigiert.
- **Drucker:** `ticket-splitter.ts` fehlendes Routing = FAILED-Job + `printer:error`/`print:failed` (statt `continue`); Spooler `printTicket(..., {itemIds})`, ACK/NACK pro Item-Chunk (`__itemIds` in rawPayload, Fallback ganze Order); `recoverPendingJobs` Cursor-Schleife (20×100 statt take:50); Memory-Fallback mit Fehler-Log; `printers/queue` Retry via `requeueExistingJob` (kein Duplikat); `orders`/`checkout`/`guest` ohne optimistisches PRINTED (nur `print:queued`); `release` mit Re-Release nach ERROR/FAILED.
- **UI:** Cashbook mit Bar-Erstattung (`payments/[id]/refund`) + Belegarchiv-Suche/Neudruck (`receipt/archive`); `waiter/payment` Betragssplit (`amount-split`); `inventory` Inventur-Zählung (`stock-units/count`); `kitchen` Rückgängig (`kds/undo`, 10 Min); **Kiosk-Suche** wie Theke (Name enthält, case-insensitive, Timer-Reset); `waiter/order` bewusst ohne Suche.
- **Tests:** neu `audit_fixes_v0420.test.ts` (Window-Fenster bleibt nach 60s gesperrt bei 1h-Fenster; E-Bon wirft ohne Secret, Test-Secret ok + unique). Gesamt grün.
- **Version:** `0.4.19` → `0.4.20`.

### Offen
Fiskaly-Positions-`update()` weiter No-Op (Schein-TSE bei FISKALY), DSFinV-K-Stammdaten/`cashPointClosing`-Folgen, DATEV-Rundung/Konten-Nutzung, `sendToRawSocket` ohne Drucker-Readback, PWA-Precache/Skeletons/Bottom-Sheet, Reports-`groupBy`/Socket-Rooms/Logger-Nutzung.

## v0.4.19 – TSE-Basis, ZIP-Exporte, harter Cent-Cut, async Druck-ACK (04.09.2026)

> Entscheidungen: Deps `jszip+pdf-lib` ok, TSE-Default `NONE`, DB-Neuaufbau ok (nie im Einsatz). Kein Live-Testlauf möglich – daher Mock/File-TSE + Fiskaly-Stub, ehrliches `NO_TSE`.

### Weshalb
Offene Audit-Reste: TSE-echt/DSFinV-ZIP/DATEV-ZIP, Float-Geld, optimistisches `PRINTED`.

### Wie
- **Deps:** `npm i jszip pdf-lib` (reines JS, Pi-sicher).
- **TSE:** neu `src/lib/tse/types.ts`, `mock-file-tse.ts` (JSONL-Log), `fiskaly-tse.ts` (ENV-gated, wirft ohne Keys statt zu fälschen), `registry.ts` (Default `NONE`, ENV>DB, 30s-Cache). `.env.example` mit `TSE_PROVIDER/FISKALY_*/DATEV_CASH_ACCOUNT`.
- **DSFinV-K:** `dsfinvk-exporter.ts` mit Closing-Param (Bugfix `totalGross: bonkoepfe.length` → echte Cent-Summe), neu `dsfinvk-archive.ts` (ZIP mit 6 Dateien+Checksum), `fiscal/dsfinvk/route.ts` liefert ZIP (Default) / `?format=json` (Debug) + `FiscalExport`-Row. Admin `fiscal/page.tsx` mit ZIP-Button.
- **DATEV:** `fiscal/datev/route.ts` nutzt `resolveDatevAccounts`+Manifest, neu `zbon-pdf.ts` (`pdf-lib`), ZIP aus CSV+max. 50 Z-Bon-PDFs+Manifest + `FiscalExport`-Row. `?format=csv` für Einzel-CSV.
- **Verify:** neu `GET /api/fiscal/verify` (Kettenprüfung `verifyFiscalBlock` + TSE-Lückenreport).
- **Cent-Cut (hart, DB `db push --force-reset`):** Schema alle Geld-Felder `Float→Int *Cents` (Product/Variant/Option/OrderItem/Payment/PaymentItem/RegisterPeriod/CashMovement/TokenTransaction); Prozent/Menge bleibt Float. `pricing.ts`/`product-resolve`/`tips`/`register-period`/`validations`/`utils.formatCents`/`printer/types`/`escpos`/`forecast`/`fiscal`/`dsfinvk`/`datev`/`domain.ts`/`seed.js` umgestellt. Alle API-Routen (payments/checkout/void/refund/amount-split/guest/repeat/release/bills/reports/z-bon/x-bon/mine/settle/cash/tokens/products/fiscal/receipt/metrics/diagnostics/ha/stock/tap/backup/printers/procurement/tables) + Frontend (pos/waiter-payment/admin-*/change-calculator/history-modal/waiter-order) + alle Tests auf Cent.
- **Druck-ACK:** `network-spooler.ts` emit `print:acked` (+OrderItems PRINTED) / `print:failed` (+ERROR) / Fallback weiter; neu `requeueExistingJob` (kein Duplikat-Job bei Retry). `ticket-splitter.ts` übergibt `orderId/printGroupId`, gibt `jobIds` zurück; `printVoidTickets` über `printTicket` (sichtbar/retry-fähig). `orders`/`checkout`/`guest` ohne optimistisches PRINTED (nur `print:queued`); `release` löst HOLD, lässt PENDING, erlaubt Re-Release nach ERROR/FAILED; `void` übergibt `orderId`. `socket-client.ts` `onPrintAck/onPrintFailed` + Events. `print-queue-manager` Socket-Refresh (Polling 15s Fallback). KDS-Badge `Druck wartet/fehlgeschlagen`.
- **Tests:** neu `tse_zip_ack_v0419.test.ts` (3 Tests: TSE-NONE ehrlich, ZIP-PK+`19,99` im Closing, PDF-Header). Gesamt grün.
- **Version:** `0.4.18` → `0.4.19`.

### Offen / Hinweise
- Echter TSE-Live-Lauf (fiskaly Keys + TSS) und Prüftool-Lauf DSFinV-K/DATEV-Import stehen aus (keine Möglichkeit vorhanden).
- `sendToRawSocket` bleibt Fire-after-connect (kein ESC/POS-Readback) – ACK = TCP-Push, nicht Drucker-Status.
- PWA-Precache/Bottom-Sheet/Skeletons weiter nächste UI-Stufe.

## 1. Vollständiger System- & Feature-Katalog (Ist-Stand)

| Bereich / Modul | Implementierte Funktionen | Technische Umsetzung & Architektur | Status |
|---|---|---|---|
| **Admin Leitstand & Dashboard (`/admin`)** | Live-Umsatz, Stunden-Forecast, Bon-Historie, Kassenbuch, Z-Bons, Fiskal-Export (DSFinV-K, DATEV, TSE-Logs), Geräte- & Akkumonitor, HA-Pairing, Event-Profile Snapshots. | Next.js 14 App Router, Recharts, `datev-exporter.ts`, `dsfinvk-exporter.ts`, `ha-pairing.ts`, `action-logger.ts`. | `[✓]` |
| **Kellner-Mobilteil (`/waiter`)** | Tischübersicht (Tischplan mit Gängen & Laufwegen), Schnellbestellung, 1-Klick-Sonderwünsche, Gang-Steuerung (HOLD/Release), Rechnungs-Splitting (Teilzahlung), Rückpfand-Verrechnung, Ziffernblock (0,01 € bis 200 €), digitaler E-Bon & NFC, Tischtransfer & Tischzusammenlegung (`TRANSFER`/`MERGE`), Schichtabrechnung (`/waiter/settle`), X-Bon Zwischenstand. | Touch-optimierte PWA, State Machine (SPLIT -> METHOD -> CASH/CARD -> DONE), Web NFC API (`NDEFReader`), IndexedDB Outbox Fallback. | `[✓]` |
| **Bonkasse / Theke (`/pos`)** | High-Speed Kachelverkauf, 3 Modi (Direktverkauf, Wertmarke, Wertmarke + Gegenbon mit Abholnummer), automatische Kassenladen-Öffnung via RJ11, Wechselgeld-Rechner (0,01 € bis 200 €), digitaler E-Bon QR-Code & NFC. | Touch-Target Grid, SubCategory-Icons, `escpos-builder.ts` Drawer-Kick, Barcode/QR-Generierung via `qrcode`. | `[✓]` |
| **Küchenmonitor KDS (`/kitchen`)** | Live-Küchenbons abhaken, Dringlichkeits-Ampel (Grün/Gelb/Rot bei >10 min), Rückstandszähler in Echtzeit, akustischer Gong, Stationen-Filter (Küche, Schenke). | Socket.IO Client mit Auto-Reconnect, Web Audio API Gong, optimistic UI Updates. | `[✓]` |
| **Gäste-Self-Service (`/guest/table/[id]`)** | Kontaktlose Tisch-Selbstbestellung am Smartphone des Gastes ohne App-Download. | QR-Token-Verifikation, Rate-Limiting, Live-Order-Einspeisung. | `[✓]` |
| **SB-Kiosk Terminal (`/kiosk`)** | Autarkes Stand-Tablet für Gäste-Bestellungen mit 60-Sekunden-Inaktivitäts-Reset. | Fullscreen Touch-Katalog, Kiosk-Sicherheitsschranke. | `[✓]` |
| **Digitaler Beleg E-Bon (`/receipt/[code]`)** | Papierloser Kassenbeleg nach § 33 KassenSichV. Bereitstellung via QR-Code oder NFC-Übertragung. Online-Hosting via Cloudflare Tunnel oder Netcup Webhosting DynDNS / NGINX Proxy. | HMAC-SHA256 Beleg-Hash (`EBON-XXXX`), Responsive Beleg-Webansicht, detaillierte Online-Anleitung in `docs/EBON_ONLINE_ANLEITUNG.md`. | `[✓]` |
| **Druckersystem & ESC/POS Spooler** | Multi-Drucker-Routing (Küche, Schenke, Kasse, Gürteldrucker), Netzwerk (TCP/IP), USB/Seriell, Virtueller Druckmonitor (`/virtual-printer`), automatisches Failover auf Ersatzdrucker, Tablett-Limitierung (`ticket-splitter.ts`), Storno-Ausdrucke. | `network-spooler.ts`, `escpos-builder.ts`, `PrintJob` Persistenz in SQLite, SSRF-Schranke (nur RFC 1918 / Loopback). | `[✓]` |
| **Zahlung & Multi-Provider** | Bargeld-Rechencenter mit vollständiger Stückelung, ZVT-Terminal (LAN TCP/IP), SumUp Deep-Link, VR-Pay Me Deep-Link, Sparkasse S-POS Deep-Link, Zettle Deep-Link, Stripe Cloud QR mit Webhook/API-Verifikation. | `payment-service.ts`, `pricing.ts`, serverseitige Preis-Autorität, signierte Callback-Verifikation (`REPORTED_SUCCESS`). | `[!] (Ungetestet)` *(Schnittstellen implementiert; Live-Betrieb mit echten physischen Terminals noch ungetestet)* |
| **Warenwirtschaft & Lager** | Geteilte Lagerposten (Brötchen-Prinzip: mehrere Artikel greifen auf dieselbe Zutat zu), Meldebestands-Warnung, automatische Rezept-Abbuchung, Fass-/Schanküberwachung (`TapLine`). | Relationale Modelle `StockUnit` & `StockConsumption`, atomare DB-Transaktionen in `stock.ts`. | `[✓]` |
| **Preise & Rabatte** | Zeitgesteuerte Aktionspreise & Happy-Hour (mehrere Zeitfenster & Wochentage), Pfandstufen, Rabatt- und Bewirtungsbelege. | `pricing.ts`, `happyHourRules` JSON-Struktur, Preisfindungs-Engine. | `[✓]` |
| **Hochverfügbarkeit & Ausfallsicherheit** | 2-Knoten Active/Passive Failover (HA-Pairing mit 6-stelligem In-App Bestätigungscode), Split-Brain Fencing mit 10s Lease-TTL, Litestream WAL-Replikation auf USB-Stick (RPO < 1s), Offline-First PWA mit Client-Outbox und Idempotenz-Schlüsseln. | `ha-service.ts`, `ha-pairing.ts`, `outbox.ts`, SQLite WAL-Modus, `litestream.yml`. | `[!] (Ungetestet)` *(Failover- & Sync-Logik implementiert; Stresstest mit zwei autonomen Servern im LAN noch ungetestet)* |
| **Sicherheit & Härtung** | PBKDF2-PIN-Hashing (100.000 Runden mit individuellem Salt), signierte JWT-Sessions (`api-guard.ts`), CSRF-Origin-Check, Schicht-Rate-Limiter, Schutz vor versehentlichem Datenverlust (`OPENBON_ALLOW_DATA_LOSS=1`). | `auth-pin.ts`, `jose` JWT, `rate-limiter.ts`, Non-Root Docker Container. | `[✓]` |
| **Dokumentations-Screenshots (58 Zustände)** | Vollautomatische Generierung aller 58 Ansichten & Modal-/Bezahlzustände im Dark-Theme (`screenshots/aktuell`) mit 2,5s Render-Puffer und JWT-Bypass. | `capture-all-detailed-screenshots.js`, `npm run capture:screenshots`, Puppeteer mit Retina-Scale (2x). | `[✓]` |

---

## 2. Status-Legende
- `[✓]` = Vollständig im Code implementiert, verdrahtet und verifiziert.
- `[!]` = Funktional vorhanden, aber mit Einschränkungen, manuellen Schritten oder offenen Restpunkten.
- `[-]` = Spezifiziert oder geplant, jedoch noch nicht umgesetzt bzw. im Backlog.

---

## 3. Chronologische Versions- und Änderungshistorie

### [STAND: 21.08.2026] – Ursprung & v0.1.0 bis v1.3.0

* **2026-08-21 20:43:11 +0200** – *feat: Complete modern POS system with offline LAN, high availability, KDS & ESC/POS*
  * **Status:** `[✓]`
  * **Weshalb:** Ein plattformunabhängiges, netzwerk-autarkes Kassensystem für Vereinsfeste und Gastronomie ohne Cloud-/Internet-Zwang.
  * **Wie:** Next.js 14 App Router, TypeScript, Prisma mit SQLite (WAL-Modus), Socket.IO WebSocket-Server in `server.js`, Tailwind CSS, Radix UI Primitives.
* **2026-08-21 21:11:47 +0200** – *feat: Rebrand to OpenBon, clean emojis to SVGs, PIN protection, QR join center*
  * **Status:** `[✓]`
  * **Weshalb:** Trennung der Rollen Admin (`1234`), Kasse (`1111`), Küche (`2222`) und Kellner (`3333`). Strikte Beseitigung aller Unicode-Emojis zugunsten professioneller Lucide-SVG-Vektorgrafiken.
  * **Wie:** `EventConfig`-Modell, `PinModal`-Komponente, SVG-Renderer `SubCategoryIcon`.
* **2026-08-21 21:50:52 +0200** – *feat: mDNS openbon.local support, Admin Command Center & predictive forecasting*
  * **Status:** `[✓]`
  * **Weshalb:** Zero-Config-Netzwerkzugriff für Helfer (`http://openbon.local:3000`) ohne IP-Eingabe; Live-Umsatzüberwachung.
  * **Wie:** Multicast-DNS Responder auf Port 5353, Recharts Dashboard.
* **2026-08-21 22:11:35 +0200** – *feat: VR-Pay Me, surcharges, waiter hourly performance & autostart*
  * **Status:** `[✓]`
  * **Weshalb:** Mobile Kartenzahlung für Volks- und Raiffeisenbanken und flexible Aufschläge (Pfand, Nachtzuschlag).
  * **Wie:** Custom-Scheme Deep Link Handler (`vrpayme://pay`), Preiskalkulation in `pricing.ts`.

---

### [STAND: 24.08.2026] – Spezifikation V1, V2 & Release v0.2.0 bis v0.3.5

* **24.08.2026 09:49–11:17 – Spezifikation V2 & Festzelt-Spezialfunktionen**
  * **Tablett-Limitierung & Bon-Splitting (Tray Capacity)** `[✓]`:
    * *Weshalb:* Kellner können nur 6–8 Getränke gleichzeitig tragen; Großbestellungen (z. B. 14x Bier) müssen getrennt gedruckt werden (`*** BON 1 von 3 ***`).
    * *Wie:* `ticket-splitter.ts` teilt Positionen nach `PrintGroup.maxItemsPerTicket` auf.
  * **Storno-Workflow mit Stornogrund & rotem Küchen-Stornobon** `[✓]`:
    * *Weshalb:* Fehlbestellungen in der Hektik müssen PIN-gesichert abgebrochen werden, damit die Küche die Zubereitung stoppt (`*** STORNO-BON - NICHT ZUBEREITEN ***`).
    * *Wie:* `POST /api/orders/[id]/void`, Setzen von `isCancelled: true` und Druckauslösung.
  * **Gang-Steuerung & HOLD** `[✓]`:
    * *Weshalb:* Zeitversetzte Zubereitung (Gang 1–3) und manueller Postenabruf für die Küche.
    * *Wie:* `OrderItem.courseNumber`, `isHold: true` blockiert den Küchenausdruck bis zum Release via `POST /api/orders/[id]/release`.
  * **DATEV & DSFinV-K Export-Engine** `[✓]`:
    * *Weshalb:* KassenSichV- und GoBD-Konformität bei Steuerprüfungen.
    * *Wie:* Generatoren `datev-exporter.ts` (ASCII-CSV) und `dsfinvk-exporter.ts` (ZIP mit `bonkopf.csv`, `bonpos.csv`, etc.).
  * **Jugendschutz-Hinweis mit dynamischem Mindestgeburtsdatum** `[✓]`:
    * *Weshalb:* Das Personal soll das Geburtsdatum bei 16er-/18er-Artikeln direkt mit dem Ausweis abgleichen können, ohne im Kopf zu rechnen.
    * *Wie:* `calculateMinBirthdate()` in `compliance.ts`, Anzeige von `<ShieldAlert />` am Handheld.
  * **Gäste-Self-Service QR (BYOD) & SB-Kiosk** `[✓]`:
    * *Weshalb:* Entlastung des Personals durch Tisch-Selbstbestellung am Smartphone oder Steh-Terminals.
    * *Wie:* Routen `/guest/table/[tableNumber]` mit QR-Token und `/kiosk` mit 60-Sekunden-Inaktivitäts-Reset.
  * **Fass- & Schanküberwachung (TapLine)** `[✓]`:
    * *Weshalb:* Überwachung des Füllstands von Bierfässern und Erfassung von Schankverlusten (Schaum).
    * *Wie:* `TapLine`-Modell mit Restvolumen und `lossPercentage`.
* **2026-08-24 15:46:49 +0200** – *release: v0.3.0 - Waiter split view, live device sync, PIN protection for all stations*
  * **Status:** `[✓]`
  * **Weshalb:** 4-Stufen Bezahlflow (Split -> Zahlart -> Ziffernblock -> Belegabschluss) zur maximalen Fehlerminimierung im Hektikbetrieb.
  * **Wie:** Smaragdgrün (`#10B981`) für Bar, Cyan (`#3B82F6`) für SumUp, Rot (`#DC2626`) für Sparkasse/S-POS, Violett (`#7C3AED`) für ZVT.

---

### [STAND: 25.08.2026] – Architektur- und Sicherheitsrevision (v0.3.6 bis v0.3.8)

* **2026-08-25 09:23:07 +0200** – *feat: Implement recommendations - auth middleware, session cookies, persistent queue, outbox*
  * **Entdeckung & Fix der Socket-Echtzeit-Blockade (`global.io = io`)** `[✓]`:
    * *Weshalb:* Alle 96 serverseitigen WebSocket-Events (`order:new`, KDS-Updates) liefen still ins Leere, weil `global.io` nie zugewiesen wurde.
    * *Wie:* Zuweisung in `server.js:43`. Behebt sofort KDS-Updates, Live-Druckmonitor und Team-Funk.
  * **Serverseitige Authentifizierung via Middleware & JWT-Cookies** `[✓]`:
    * *Weshalb:* Bisherige PIN-Prüfung war rein clientseitig; alle API-Routen waren ungeschützt im LAN erreichbar.
    * *Wie:* Einführung von `jose`-basierten JWT-Sessions in `src/middleware.ts` und `src/lib/api-guard.ts`.
  * **Transaktions-Klammerung im Bestell- und Kassiervorgang** `[✓]`:
    * *Weshalb:* Parallele Bestellungen führten zu doppelten Sequenznummern und Bestands-Inkonsistenzen.
    * *Wie:* Kapselung aller Schreiboperationen in atomare `prisma.$transaction([])`.
  * **Lagerposten mit geteiltem Verbrauch (StockUnit & StockConsumption)** `[✓]`:
    * *Weshalb:* Mehrere Artikel (z. B. Steaksemmel, Bratwurstsemmel) greifen auf denselben Vorrat ("Brötchen") zu.
    * *Wie:* Relationale Modelle `StockUnit` und `StockConsumption` mit automatischer Gesamtsperre bei Nullbestand.
* **2026-08-25 21:08:00 +0200** – *fix: Release v0.3.8 - Session-Login repariert*
  * **Status:** `[✓]`
  * **Weshalb:* Nach der Auth-Einführung geriet die Admin-Navigation in einen Redirect-Loop zur Startseite.
  * **Wie:** Korrektur der Hook-Reihenfolge in `PinModal` und Session-Persistenz im Cookie.

---

### [STAND: 26.08.2026] – UI-Refinement, Schichtabrechnung & Resilienz (v0.4.0 bis v0.4.8)

* **2026-08-26 08:57:52 +0200** – *release: v0.4.0 - Theme Klassisch & Formular-Modularisierung*
  * **Status:** `[✓]`
  * **Weshalb:* Bereitstellung eines ruhigen, kontrastoptimierten hellen Themes für Außenbereiche bei direkter Sonneneinstrahlung.
  * **Wie:** Theme-Engine mit CSS-Variablen in `tailwind.config.js` (`#202124` Text, Pastell-Akzente).
* **2026-08-26 14:07:34 +0200** – *feat: Release v0.4.1 - PIN hardening, multi-provider payment, recipe inventory, change calculator*
  * **Status:** `[✓]`
  * **Weshalb:* Blindzählung beim Kassensturz (Kellner sieht Soll-Betrag nicht vorab) verhindert Manipulationen.
  * **Wie:** 5-Stufen-Assistent `/admin/settle` (Bedienung -> Zählen -> Soll/Ist-Vergleich -> Differenzprotokoll -> Unterschriftenbon).
* **2026-08-26 18:24:14 +0200** – *feat: 10-step font size sliders, table designer, bump to v0.4.4*
  * **Status:** `[✓]`
  * **Weshalb:* Unterschiedliche Thermodrucker und Papierbreiten (58mm/80mm) benötigen anpassbare Schriftgrößen; Festzelte benötigen Gänge/Laufwege im Tischplan.
  * **Wie:** Schieberegler im Admin für Fontgrößen (`receiptItemFontSize` 1–10), Gang-Definitionen (`aisles` im Tischplan-Editor).

---

### [STAND: 27.08.2026] – Sicherheits-Härtung & In-App HA-Pairing (v0.4.9 bis v0.4.11)

* **2026-08-27 13:54:10 +0200** – *Release v0.4.10: Sicherheits-Härtung (M1 bis M6)*
  * **M1: Preis-Autorität bei `/api/payments`** `[✓]`:
    * *Weshalb:* Schutz vor manipulierten Client-Preisen. Preise und Steuern werden zwingend aus den DB-Positionen überschrieben.
    * *Wie:* `computeCheckout` liest `orderItems` direkt aus der DB; Diskrepanzen > 1 Cent lösen `409 PRICE_MISMATCH` aus.
  * **M1: Payment-Callback Zustandsmaschine (`REPORTED_SUCCESS`)** `[✓]`:
    * *Weshalb:* Deep-Link-Apps (SumUp, VR-Pay, Zettle) können beim App-Rücksprung URL-Parameter fälschen.
    * *Wie:* Status `REPORTED_SUCCESS` verlangt Bestätigungstap des Personals; Stripe wird serverseitig via API verifiziert.
  * **M2: Schicht-Rate-Limiter & Account-Lockout** `[✓]`:
    * *Weshalb:* Brute-Force-Schutz gegen PIN-Erraten im Fest-WLAN.
    * *Wie:* Kaskadierender Rate-Limiter in `rate-limiter.ts` (IP-basiert, Stations-Lockout, globaler Deckel).
  * **M3: Waiter-PINs gehasht via PBKDF2** `[✓]`:
    * *Weshalb:* Keine Klartext-PINs mehr in der Datenbank.
    * *Wie:* `hashPin()` mit PBKDF2/Salt und automatischer Lazy-Migration beim ersten Login.
  * **M4: Drucker-SSRF-Schranke & ESC/POS-Sanitizer** `[✓]`:
    * *Weshalb:* Verhindert Netzwerk-Scanning externer Netze über das Drucker-Interface und schützt vor ESC/POS-Steuerzeichen-Injektionen.
    * *Wie:* IP-Validierung (nur RFC 1918 / Loopback) und Steuerzeichenfilter (<0x20) in `escpos-builder.ts`.
  * **M6: Schutz vor Datenverlust beim Start** `[✓]`:
    * *Weshalb:* `prisma db push --accept-data-loss` hat bei Schema-Änderungen stillschweigend Tabellen geleert.
    * *Wie:* Entfernung des Flags aus allen Batch- und Shell-Skripten; harter Stopp mit Hinweis auf `OPENBON_ALLOW_DATA_LOSS=1`.
* **2026-08-27 15:56:07 +0200** – *Release v0.4.11: In-App HA-Pairing & Resilienz-Ausbau*
  * **In-App HA-Pairing-Assistent** `[✓]`:
    * *Weshalb:* Terminalfreie Kopplung zweier Raspberry Pis für Ausfallsicherheit im Festzelt.
    * *Wie:* 6-stelliger Bestätigungscode (TTL 10 min, timing-safe) generiert ein gemeinsames kryptografisches Sync-Secret (`src/lib/ha/ha-pairing.ts`).
  * **Karten-Callback HMAC-Signatur** `[✓]`:
    * *Weshalb:* Schutz der Rücksprung-Route gegen SessionStorage-Manipulationen.
    * *Wie:* HMAC-SHA256 Tokengenerierung und Verifikation in `/api/payments/card/verify`.
  * **Offline-Outbox für Zahlungen verdrahtet** `[✓]`:
    * *Weshalb:* Zahlungen können nun auch bei Verbindungsaussetzern lokal in IndexedDB gepuffert und nachgesendet werden.
    * *Wie:* Integration des Typs `PAYMENT` in `outbox.ts` und Anbindung an `/waiter/payment`.
  * **Entfernung toter UI-Codes für Trinkgeld/Rabatt** `[✓]`:
    * *Weshalb:* Im Waiter-Payment-Screen existierten unverbundene UI-Zustände, die Verwirrung stifteten.
    * *Wie:* Bereinigung der toten States; Backend-API bleibt abwärtskompatibel.

---

### [STAND: 28.08.2026] – Release v0.4.12: Ziffernblock-Harmonisierung (0,01 € bis 200 €), E-Bon Cloudflare/Netcup & NFC-Transfer

* **2026-08-28 09:30:00 +0200** – *Release v0.4.12: Unified Cash Numpad (0.01€-200€), Cloudflare/Netcup E-Bon Manual & NFC E-Bon Transfer*
  * **Status:** `[✓]`
  * **Weshalb:** Harmonisierung der Kassen-Ziffernblöcke und lückenlose Stückelung (0,01 € bis 200 €); ausführliche Schritt-für-Schritt-Anleitung für die Internet-Bereitstellung von E-Bons via Cloudflare Tunnels (Netcup-Domain) und Netcup Webhosting Nginx/PHP Reverse-Proxy mit DynDNS; Implementierung der kontaktlosen E-Bon-Übertragung per NFC für Kellner-Handhelds und Bonkasse.
  * **Wie:**
    1. **Ziffernblock & Stückelung**:
       - `pricing.ts`: Erweiterung von `CASH_NOTE_VALUES` und `CASH_QUICK_NOTES` um den 200 € Schein.
       - `change-calculator.tsx`: Scheine-Schnellwahl (5€, 10€, 20€, 50€, 100€, 200€ + Passend), Münzen-Schnellwahl (1ct bis 2€) und 3x4 Touch-Ziffernblock (`0–9`, `00`, `C`, `,`).
       - `/waiter/payment`: Entfernung des redundanten rechten 4x3 Keypads; zentriertes Layout mit `ChangeCalculator`.
       - `/pos`: Saubere Integration des erweiterten `ChangeCalculator` im Warenkorb-Checkout.
    2. **E-Bon Online-Handbuch & Dokumentation**:
       - Neuer Leitfaden `docs/EBON_ONLINE_ANLEITUNG.md` mit Anleitungen für Cloudflare Tunnels (Zero Trust, `cloudflared`-Dienst für Linux/RPi/Windows), Netcup DynDNS API, NGINX-Direktiven und PHP-Proxy Fallback sowie NFC-Best-Practices.
    3. **NFC-Engine & Prisma**:
       - Erweiterung von `EventConfig` um `enableNfc`, `enableNfcWaiter` und `enableNfcPos` in Prisma Schema, Domain-Types, Whitelist und Public-Config Route.
       - Toggles für NFC-Aktivierung und selektive Freigabe auf Kellner-Smartphones und/oder Bonkasse in `GeneralTab.tsx` und `ReceiptTab.tsx`.
    4. **Kellneransicht (`/waiter/payment`)**:
       - E-Bon Button ist nur sichtbar/aktiv, wenn Online- oder NFC-Option im Admin aktiviert ist.
       - Wenn beides aktiv: Umschaltbarer Dialog mit Reitern für **QR-Code anzeigen** und **NFC Beamen**.
       - Web NFC API (`NDEFReader.write`) mit Radar-Puls-Animation, akustischer Rückmeldung und Fehlerbehandlung.
    5. **Bonkasse (`/pos`)**:
       - Integration von NFC-Beamen im E-Bon-Modal mit Umschaltung zwischen QR-Code und direktem NFC-Sendevorgang.

---

---

### [STAND: 28.08.2026] – Release v0.4.13: Modern Themes, Live-Druckerwarteschlange, WCAG 2.1 Testsuite & Handheld-Optimierungen

* **2026-08-28 10:30:00 +0200** – *Release v0.4.13: 5 Modern Themes, Print Queue Spooler, WCAG 2.1 Contrast Suite, X-Bon Modal & Auto-Lock*
  * **Status:** `[✓]`
  * **Weshalb:** Ablösung des veralteten Klassik-Themes durch 5 eigenständige, hochkontrastige Themes; Bereitstellung einer interaktiven Live-Druckerwarteschlange mit Wiederholung, Umleitung und Bon-Vorschau; automatische mathematische WCAG 2.1 Kontrastvalidierung aller Stationen; schneller X-Bon Schichtzwischenstand für Bedienungen; Inaktivitäts-Auto-Lock für Handhelds; adaptive Kachel-Skalierung und USB-Gesundheitswächter.
  * **Wie:**
    1. **5 Moderne, barrierefreie Themes**:
       - `dark` (Modern Deep Slate): Eleganter Mitternachtsmodus (`#020617`).
       - `light` (Klares Tageslicht): Schneeweißer Grund (`#ffffff` / `#f8fafc`) mit sonnenlichttauglichen Kontrasten.
       - `contrast` (Festzelt High-Contrast / OLED): Pures Tiefschwarz (`#000000`) mit signalgelben 2px-Rahmen (`#eab308` / `#facc15`) für blendfreies Arbeiten im Freien.
       - `tradition` (Tradition & Verein): Warme Holz- und Bernsteintöne (`#140d07`, `#78350f`, `#b45309`) für Biergärten und Traditionsvereine.
       - `speed` (High-Speed Tresen): Kompakte Radien, scharfe Kanten (`#2563eb`) und maximale Kacheldichte.
       - Entfernung von `klassisch` und `minimal`; Anpassung von `ThemeProvider`, `globals.css`, `navbar.tsx` und `GeneralTab.tsx`.
    2. **Automatisierte WCAG 2.1 Kontrast- & Lesbarkeits-Testsuite**:
       - Neuer Test `src/__tests__/theme_contrast_validation.test.ts` (28 Tests) mit mathematischer relative-Luminanz- und Kontrastberechnung nach W3C-Standard für alle 5 Themes über alle 7 Kernstationen.
    3. **Live-Druckerwarteschlange (Print Queue Manager)**:
       - API-Route `src/app/api/printers/queue/route.ts` (GET mit Statusfiltern `ALL`, `PENDING`, `FAILED`, `PRINTED`, Statistiken; POST mit Aktionen `RETRY`, `REROUTE`, `DELETE`, `CLEAR_COMPLETED`).
       - Komponente `src/components/admin/print-queue-manager.tsx` mit Live-Statustabelle, Fehlerursachenanzeige, 1-Klick-Wiederholung, Drucker-Umleitung, formatierter Bon-Vorschau und Tab-Integration in `/admin/printers`.
    4. **Kellner-Zwischenstand (X-Bon Modal)**:
       - Schneller 1-Klick-Button in `/waiter` zur Anzeige des aktuellen Schicht-Zwischenstands (Bargeld-Soll im Geldbeutel, Gesamtumsatz Brutto, Kartenzahlungen, erhaltenes Trinkgeld, ausbezahltes Pfand) und Direktdruck via `/api/reports/x-bon`.
    5. **Auto-Lock bei Inaktivität**:
       - Konfigurierbarer Inaktivitäts-Timer (`waiterAutoLockMinutes`: 0 = Deaktiviert, 1, 2, 3, 5, 10 Minuten) in `EventConfig`, Whitelist und Public-Config; automatisches Sperren des Handheld-Displays auf den PIN-Screen bei Inaktivität.
    6. **Adaptive Kachel-Skalierung für Handhelds**:
       - Umstellung der Artikelkacheln in `/pos` und `/waiter/order` auf `grid-cols-[repeat(auto-fill,minmax(125px,1fr))]` für flüssige 2 bis 6 Spalten je nach Bildschirmbreite.
    7. **Haptisches Sound-Routing & USB-Wächter**:
       - `playCashRegisterChime()` und `playWarningBeep()` in `src/lib/audio-feedback.ts`.
       - Integrierter USB-Replikations- und Schreibbereitschafts-Check in `src/app/api/health/route.ts`.

* **28.08.2026 14:50 – Release v0.4.14 Detailverbesserungen, Font-Autarkie & Design-Härtung** `[✓]`
  * **Weshalb:** Vollständig lokaler System-Font-Stack ohne externe Google-Font-Abrufe beim Offline-Build; Bereinigung der Themes auf 4 klare Varianten (`Dunkel`, `Hell`, `Tradition`, `Kompakt`) ohne Klammerzusätze; präzise Ausrichtung des Tischplan-Designers; Freiraum-Option beim Raumplan-Druck; bereinigte PIN-Anzeige im QR-Center; homogenes Versionierungs-Branding; lückenlose 39-View Screenshot-Pipeline mit Versionierungs-Archivierung und vollständige Dokumentation der Design-Token.
  * **Wie:**
    1. **Lokaler Font-Stack & Build-Autarkie:** Umstellung in `src/app/layout.tsx` von `next/font/google` auf einen robusten, lokalen System-Font-Stack (`Plus Jakarta Sans`, `system-ui`, `sans-serif`), wodurch Builds auch ohne Internetverbindung in unter 30s übersetzt werden.
    2. **Theme-Bereinigung (4 saubere Themes):** Entfernung des `contrast`-Themes zugunsten der 4 klaren, optimierten Themes `Dunkel`, `Hell`, `Tradition` und `Kompakt`. Säuberung der Theme-Labels in der UI (Entfernung von Klammern und Zusätzen).
    3. **Tischplan-Designer Ausrichtung:** Spaltenköpfe `S1`–`Sn` und Reihenköpfe `R1`–`Rn` wurden geometrisch fest mit den Grid-Zellen synchronisiert (relative Zwischen-Buttons ohne Flex-Verzerrung).
    4. **Druckansicht Tischplan:** Checkbox `[x] Freie Tische als Freiraum darstellen` blendet leere Rasterfelder als weiße Flächen ohne Rahmen und Text aus.
    5. **QR-Code Center:** Erkennung von PBKDF2-Hashes ersetzt kryptische 100-Zeichen-Strings durch `PIN geschützt (4 Ziffern)`.
    6. **Homogene Versionsanzeige:** `v0.4.14` in der Top-Navbar wurde typografisch in `Plus Jakarta Sans` als dezent elegantes Pill-Badge integriert.
    7. **Jugendschutz-Kontrast:** Helle, kontraststarke Farbgebung für den Jugendschutz- und Allergenbalken im Light-Theme (`#f1f5f9` mit `#991b1b` / `#b45309`).
    8. **Screenshot-Archivierung & .gitignore:** Screenshots werden bei Testläufen automatisch mit Version (`v0.4.14`) und ISO-Zeitstempel nach `screenshots/alt/` archiviert; `/screenshots/` ist in `.gitignore` eingetragen.
    9. **Master-Featurekatalog & Ungetestet-Hinweise:** Vollständige Aktualisierung des Feature-Katalogs in Abschnitt 1 mit Kennzeichnung von Kartenzahlung und HA als `[!] (Ungetestet)`.

* **28.08.2026 16:00 – Release v0.4.15: Node 20 Update-Resilienz & Globaler Skalierungs-Symbolbutton** `[✓]`
  * **Weshalb:** Behebung des `EBADENGINE`-Update-Fehlers bei 1-Klick-WebUI-Updates auf Produktionsservern mit Node.js 20 LTS; Entkopplung von Entwickler-Tools (Puppeteer); Einführung eines reinen Symbol-Toggle-Buttons in der obersten Navigationsleiste zur bildschirmfüllenden Skalierung ohne Scrollen auf allen Terminals & Tablets.
  * **Wie:**
    1. **Puppeteer & Node 20 LTS Entkopplung:** Pinning von `puppeteer` auf `^23.6.0` in `package.json` für Node 20 LTS Kompatibilität; Ausführung von `npm install` mit `--no-engine-strict` und Fallback-Handling auf `--omit=dev` in `/api/system/update/route.ts`.
    2. **Globaler Skalierungs-Symbolbutton in Navbar:** Einbau eines reinen Icon-Buttons (`<Scaling className="w-4 h-4" />` ohne Textbeschriftung) in `src/components/navigation/navbar.tsx` exakt zwischen `<FullscreenButton />` und der Statusanzeige `Lokal (Aktiv)`.
    3. **Dauerhafte Persistenz & Signal-Event:** Speicherung des Bildschirmskalierungs-Status in `localStorage` (`openbon_autofit_screen`) und globales Event-Dispatching (`openbon:autofit_changed`).
    4. **Scrollfreie Bonkassenansicht (`/pos`):** Automatische Viewport-Einpassung (`h-[calc(100vh-4rem)] overflow-hidden`) mit flexiblen Kachel- & Korb-Größen bei aktivierter Bildschirmanpassung, sodass kein vertikaler Scrollbalken mehr entsteht.

* **28.08.2026 18:00 – Release v0.4.16: 18-Punkte Master-Upgrade & Zuverlässigkeits-Härtung** `[✓]`
  * **Weshalb:** Umfassende Optimierung des 2-Schritt-Bestellvorgangs an der Bonkasse, variable Multi-Pfand-Rückgabematrix für Kellner, native USB-Bondrucker-Unterstützung (`/dev/usb/lp0`), synchrone Offline-Drucker-Erkennung, intelligentes Tischplan-Pruning beim Verkleinern von Rastern, automatischer Heartbeat-Monitor für Mobilteile, Behebung von Authentifizierungs- und Zod-Validierungsfehlern bei Bestelloptionen sowie vollständiger UI-Feinschliff für maximalen Durchsatz im Hektikbetrieb.
  * **Wie:**
    1. **Detail-Ausgaben im WebUI-Update (`/admin/system-update`):** Vollständige Erfassung und Ausgabe von stdout/stderr bei Fehlern während npm install, prisma db push und next build; Auto-Scroll im Konsolen-Terminal.
    2. **Bonkasse 2-Schritt-Checkout & Bezahl-Modal (`/pos`):** Rechte Seitenleiste zeigt im Normalzustand nur die Warenkorb-Positionen, Summe und den vollbreiten `[Kassieren]`-Button; Klick öffnet ein aufgeräumtes Bezahl-Modal mit 2-Spalten-Layout (links: Zahlart, Ziffernblock, Scheine 5€–200€, Wechselgeldrechner; rechts: Artikelübersicht, Endbetrag, Rückgeld) und `[ESC]`-Schließen.
    3. **Variable Rückpfand-Matrix für Bedienungen (`/waiter/payment`):** Unterstützung beliebiger Stückelungen gleichzeitig (z. B. 1x 1,00 €, 2x 2,00 €, 0,50 €) mit Plus/Minus-Karten und korrekter Verrechnung im Gesamtabrechnungsbetrag.
    4. **Bonkassen Druck-Feedback:** Sofortiges visuelles Toast-Feedback beim Absenden von Bons und Wertmarken.
    5. **Tischplan Designer & Gänge (`/admin/tables` & `/admin/tables/print`):**
       - Horizontale Gänge werden exakt auf die Rasterbreite begrenzt (kein Überstehen mehr).
       - Kreuzungen zwischen horizontalen und vertikalen Gängen gehen nahtlos mit verrundeten Ecken ineinander über.
       - Gänge werden in der Druckansicht sauber dargestellt und dauerhaft via `/api/config` persistiert (PUT-Alias ergänzt).
    6. **USB-Bondrucker Unterstützung (`network-spooler.ts` & `/admin/printers`):** Direkte Schreibunterstützung auf Gerätedateien (`/dev/usb/lp0`, `/dev/ttyUSB0`, `COM1`) ohne externe Spooler; Direktauswahl in der UI.
    7. **Strenge Offline-Erkennung für Bondrucker:** Synchrone Überprüfung bei Testdrucken mit 1500ms Socket-Timeout und USB-Existenzprüfung – ausgeschaltete Drucker melden sofort einen klaren Fehler statt falscher Erfolgsmeldungen.
    8. **Live Geräte- & Akkumonitor (`/admin/devices` & `socket-client.ts`):** 15-Sekunden periodischer Heartbeat von allen Bedien- und Kassen-Stationen mit Live-Akkustand und Ladestatus.
    9. **Fehlerbehebung 401 HA-Status & 400 Bestell-Optionen:**
       - `/api/system/ha/status`: Freigabe für alle authentifizierten Personalrollen (`ADMIN`, `POS_CASHIER`, `WAITER`, `KITCHEN`), wodurch 401-Konsolenfehler auf Kellner-Mobilteilen eliminiert werden.
       - `OrderItemInputSchema.selectedOptions`: Erweiterung des Zod-Schemas zur Validierung von Options-Objekten mit Mengen (`{ name, quantity }`).
    10. **Fest-Generalprobe & Testdaten-Bereinigung (`/admin/diagnostics`):**
        - 1-Klick-Selbsttest ("Fest-Generalprobe") mit Probeschnitt auf allen Bondruckern und Kassenladen-Kick.
        - 1-Klick-Bereinigung aller Testbestellungen, Zahlungen und Druckjobs vor Festbeginn unter vollständiger Beibehaltung aller Stammdaten (Artikel, Tische, Drucker, Mitarbeiter).
    11. **Team-Chat Benachrichtigungspunkt:** Blauer Benachrichtigungspunkt am Hamburger-Menübutton in `navbar.tsx` bei ungelesenen Team-Nachrichten.
    12. **Live-Sync Warengruppen & Produkte:** Socket-Ereignisse `category:created`, `category:updated`, `category:deleted` aktualisieren Bedienungs- und Kassen-Oberflächen in Echtzeit ohne Seiten-Reload.
    13. **Kompakte Kellner-Kacheln (`/waiter/order`):** Entfernung von Preisen und Plus-Symbolen auf Artikelkacheln zur maximalen Platzausnutzung; Sorten/Varianten werden durch feine Farbverläufe dargestellt; Allergen-Badge (`<AlertCircle />`) oben rechts überdeckt keine langen Artikelnamen mehr.
    14. **Branding & Version:** Entfernung des blauen `[OB]`-Icons; Anzeige der Versions-Pille ausschließlich in Admin-Ansichten.
    15. **Kellner-Header Bereinigung (`/waiter/order`):** Oben links: `[ < Zurück ]` und `Bedienung • Tisch X`; oben rechts: gruppierte Buttons für Verlauf, Stummschaltung und Chat; Entfernung der doppelten Positionszählung aus der Kopfleiste.
    16. **Standard-Stummschaltung:** Akustische Signale standardmäßig deaktiviert (`isAudioMuted = true`), um Kellner-Mobilteile im lauten Festbetrieb nicht zu stören.
    17. **Tischnummern-Schnellwahl unten (`/waiter`):** Prominenter, zentrierter Ziffernblock-Button über die gesamte untere Bildschirmbreite ohne ablenkende Hinweistexte.
    18. **Light-Theme Kontraste:** Tiefschwarze Schrift (`text-slate-950`) für Münzen im Wechselgeldrechner sowie kontraststarke Buttons in hellen Designs.

* **31.08.2026 14:30 – Release v0.4.17: Kassen- & Bedienungs-UX-Upgrade, Scheine/Münzen-Rechencenter & System-Fixes** `[✓]`
  * **Weshalb:** Umfassendes Upgrade des Kassiervorgangs an der Bonkasse mit Euro-Banknoten und Euro-Münzen, Unterstützung von Teilzahlungen per Artikel-Abwahl, automatischer Kassenbon-Druck für Thekenverkäufe, Bestellhistorie an der Kasse, aufgeräumte und kompakte Tischkacheln ohne doppelte Texte, fest fixierter Tischnummern-Button am unteren Bildschirmrand, Auto-Öffnen des Tischnummern-Keypads nach Buchung/Kassieren, Angleich der Bedienungs-Header, scrollbarer Teamfunk mit Auto-Scroll, Behebung des 8x12 Tisch-Raster-Generierungsfehlers sowie Korrektur des Geräte-Managers und der unauthentifizierten 401-Konsolenfehler.
  * **Wie:**
    1. **Kassiervorgang an der Bonkasse (`/pos` & `change-calculator.tsx`):**
       - Euro-Scheine (5€ bis 200€) als farbige Rechteck-Karten zur Direktwahl.
       - Euro-Münzen (1ct bis 2€) als runde Münz-Kreise zum einfachen Aufaddieren.
       - Ziffernblock auf 3x4 (1–9, C, 0, Komma) ohne `00`-Taste bereinigt.
       - Große Aktionsbuttons (`[Abbrechen]`, `[Barzahlung]`, `[Kartenzahlung]`, `[Wertmarke]`).
    2. **Teilzahlung an der Bonkasse:** Checkboxen an allen Warenkorb-Positionen im Kassiermodal; nicht ausgewählte Artikel verbleiben im Korb für die nächste Abrechnung.
    3. **Automatischer Kassenbon-Druck:** Neuer Schalter `[x] Kassenbon drucken` (Standard: Aktiv) an der Bonkasse, sodass auch Theken-Direktverkäufe am Kassendrucker gedruckt werden.
    4. **Bestellhistorie an der Bonkasse:** Neuer Button `[Bestellhistorie]` im Header; Anzeige der „Letzten Abhol-Nr.“ in der Seitenleiste entfernt.
    5. **Chat-Benachrichtigungspunkt:** Socket-Event in `navbar.tsx` auf `chat:incoming` korrigiert – blauer Punkt am Hamburger-Menü leuchtet bei neuen Nachrichten sofort auf.
    6. **Kompakte Tischkacheln (`/waiter`):** Entfernung von `Nr. X` und Entfernung des Textes `Frei` (Status nur noch über den farbigen Punkt); verkleinertes Padding für maximale Tischanzahl auf einem Bildschirm.
    7. **Sticky Tischnummer-Button (`/waiter`):** Feste Fixierung am unteren Bildschirmrand (`fixed bottom-0 z-20`) mit `pb-28` im Scrollbereich.
    8. **Auto-Öffnen des Tischnummern-Keypads (`/waiter`):** Neuer Toggle `[Auto-Öffnen: AN/AUS]` im Keypad; öffnet die Tischnummerneingabe beim Zurückkehren auf die Tischübersicht automatisch.
    9. **Header-Angleich (`/waiter` & `/waiter/order`):** Visuelle Harmonisierung; Chatsymbol aus dem Bestellheader entfernt.
    10. **Team-Funk Scrollbarkeit (`/chat`):** Feste Viewport-Höhe (`h-[calc(100vh-4rem)]`) mit scrollbarem Nachrichtenbereich und automatischem Smooth-Scroll zum neuesten Funkspruch.
    11. **8x12 Tischplan-Raster Fix (`/api/tables`):** Kollisionsfreie Schrittweiten-Berechnung (`effectiveStepY = Math.max(stepY, cols * stepX)`) und sicheres Lösen von Altdaten-Fremdschlüsseln verhindern Unique-Constraint-Fehler bei großen Rastern.
    12. **Tischplan Druckansicht (`/admin/tables/print`):** Gänge werden als durchgehende Laufweg-Korridore gerendert.
    13. **Geräte-Manager Praesenzliste (`/api/devices` & `server.js`):** Stale-Filter Typo (`dev.lastSeen` -> `dev.lastSeenAt`) behoben und Socket-Updates global synchronisiert.
    14. **401 Konsolenfehler eliminiert (`/api/system/ha/status`):** Unauthentifizierte Anfragen erhalten einen sicheren Standalone-Status mit HTTP 200.
    15. **Vollautomatischer 58-Screenshot-Katalog (`npm run capture:screenshots`):** Vollständige Erfassung aller 58 Ansichten und interaktiver Bezahl-/Kassierzustände (Warenkorb gefüllt, Vollzahlung, Teilzahlung, Stückelungsrechner mit 50 €-Schein, Kartenzahlungsmodus, Tisch-Aktionen, X-Bon, Pfandmatrix etc.) im Dark-Theme unter `screenshots/aktuell` mit 2,5 Sekunden Render-Puffer je Screen und JWT-Bypass.


---

## 4. Theme-Spezifikation & Design-Tokens (Master-Referenz)

Um dauerhafte Konsistenz über alle Stationen und Updates hinweg zu gewährleisten, gelten folgende feste Design-Token für die 4 Themes von OpenBon:

| Theme-Eigenschaft | `Dunkel` (`dark`) | `Hell` (`light`) | `Tradition` (`tradition`) | `Kompakt` (`speed`) |
| :--- | :--- | :--- | :--- | :--- |
| **Primär-Hintergrund (`body`)** | `#020617` (Deep Slate) | `#f1f5f9` (Hellgrau/Tageslicht) | `#140d07` (Dunkles Eichenholz) | `#080c14` (Mitternachtsblau) |
| **Karten & Dialoge (`surface`)** | `#0f172a` (`slate-900`) | `#ffffff` (Reines Weiß) | `#1a1008` (Warmes Holz) | `#0f172a` (Technik-Slate) |
| **Header & Navigationsleiste** | `#0f172a` / `#020617` | `#ffffff` (mit Box-Shadow) | `#1a1008` (Border `#92400e`) | `#0d1527` (Border `#2563eb`) |
| **Schriftfarbe Primär** | `#f8fafc` (`slate-50`) | `#000000` (Tiefschwarz) | `#fffbeb` (Warmes Elfenbein) | `#ffffff` (Reinweiß) |
| **Schriftfarbe Sekundär** | `#94a3b8` (`slate-400`) | `#334155` (`slate-700`) | `#fde68a` (Bernstein-Gold) | `#94a3b8` (`slate-400`) |
| **Rahmen & Linien (`border`)** | `#334155` (`slate-700`) | `#cbd5e1` / `#94a3b8` | `#78350f` / `#b45309` | `#334155` / `#2563eb` |
| **Border-Radius Kacheln/Karten** | `1rem` (`rounded-2xl`) | `1rem` (`rounded-2xl`) | `1rem` (`rounded-2xl`) | `0.25rem` (`rounded-sm` 4px) |
| **Ziffernblock (`keypad-key`)** | `#1e293b` (Slate-800) | `#ffffff` (Weiß mit Schatten) | `#26170b` (Holz-Panel) | `#0f172a` (4px Border `#2563eb`) |
| **Einsatz-Schwerpunkt** | Gedimmtes Licht / Abend | Helles Tageslicht / Sonne | Biergarten, Festzelt & Verein | Schneller Thekenverkauf |

---

## 5. Lagerposten & geteilter Verbrauch (Brötchen-Prinzip)

Im Festbetrieb teilen sich oft mehrere Verkaufsartikel eine gemeinsame, begrenzte Zutat:
- Beispiel: **100 Brötchen** im Lager (`StockUnit`).
- Verkaufsartikel:
  - *Steak im Brötchen* (zieht 1x Brötchen ab)
  - *Grillwurst im Brötchen* (zieht 1x Brötchen ab)
  - *Käsebrötchen* (zieht 1x Brötchen ab)

### Funktionsweise in OpenBon:
1. **Lagerposten anlegen:** Unter `/admin/stock-units` wird der Posten `Brötchen` mit Anfangsbestand (z. B. `100 Stück`) und Meldebestand (z. B. `15 Stück`) definiert.
2. **Zuweisung zum Artikel:** Im Artikel-Editor (`/admin/products`) wird dem Artikel die Zutat zugewiesen:
   - Artikel *Steak im Brötchen* -> Verbrauch: `1.0` von `Brötchen`.
   - Artikel *Grillwurst im Brötchen* -> Verbrauch: `1.0` von `Brötchen`.
3. **Automatischer Abbruch bei Nullbestand:**
   - Jeder Verkauf bucht den Lagerposten atomar über `src/lib/stock.ts` ab.
   - Sobald der Vorrat `0` erreicht, werden **alle verknüpften Artikel** automatisch als `isSoldOut: true` markiert und können auf keinem Kellner-Smartphone oder Kiosk mehr bestellt werden.
4. **Meldebestand:** Erreicht der Vorrat den Meldebestand, ertönt ein akustischer Gong und ein Warnbon wird am Küchendrucker gedruckt (*"ACHTUNG: Brötchen fast leer (nur noch 15 Stück)"*).

---

## 6. Backlog & Zukünftige Erweiterungen

- `[-]` **Float zu BigInt/Cents DB-Migration**: Schema nutzt `Float` (Berechnungen laufen in Cents, DB-Spalten noch Float).
- `[-]` **Online-Tischreservierung mit Gästedaten**: Optionale Vorbestellung für Festzelttische.
- `[-]` **Gutschein-Verwaltung mit Barcode-Guthaben**: Verwaltung wiederaufladbarer Festkarten.

---

## 7. Spezifikation & Katalog der 58 automatisierten Screenshots (`screenshots/aktuell`)

Zur lückenlosen Dokumentation und visuellen Regressionstest-Absicherung werden bei jedem Release über `npm run capture:screenshots` (`scripts/capture-all-detailed-screenshots.js`) alle **58 Ansichten und interaktiven Zustände** im **Dark-Theme** mit 2,5 Sekunden Render-Puffer je Screen erzeugt:

### 1. Bonkasse / Theke (`/pos` – 8 Zustände)
- `03a_pos_leer.png`: Standard-Ansicht mit leerem Warenkorb
- `03b_pos_warenkorb_gefuellt.png`: 3 Artikel hinzugefügt, Mengenregler & aktiver `[Kassieren]`-Button
- `03c_pos_kassiermodal_voll.png`: Kassiermodal geöffnet, alle Positionen ausgewählt
- `03d_pos_kassiermodal_teilzahlung.png`: Teilzahlung mit abgewähltem Artikel & Restbetrags-Badge
- `03e_pos_kassiermodal_bar_rueckgeld.png`: 50 €-Schein gewählt, Gegeben & Rückgeld berechnet
- `03f_pos_kassiermodal_karte.png`: Kartenzahlungsmodus aktiv mit Kassenbon-Druckerschalter
- `03g_pos_bestellhistorie.png`: Kassen-Bestellhistorie Modal geöffnet
- `03h_pos_station_modal.png`: Stations- & Kassenladen-Einstellungsdialog geöffnet

### 2. Bedienungsansichten (`/waiter` – 12 Zustände)
- `04a_waiter_tischplan.png`: Tischplan ohne Modal-Overlay mit freiem/belegtem Status & Sticky-Button
- `04b_waiter_tischnummer_keypad.png`: Tischnummern-Keypad Modal geöffnet (mit Auto-Öffnen-Schalter)
- `04c_waiter_tisch_aktionen.png`: Tisch-Aktionsdialog (Bestellen, Kassieren, Umbuchen, Zusammenlegen)
- `04d_waiter_xbon_zwischenstand.png`: X-Bon Zwischenstand (Geldbeutel-Soll & Barbestand)
- `04e_waiter_bestellhistorie.png`: Kellner-Bestellverlauf Modal
- `05a_waiter_order_leer.png`: Artikelauswahl (leerer Warenkorb)
- `05b_waiter_order_warenkorb.png`: Artikelauswahl mit hinzugefügten Artikeln & sichtbarer Bestell-Leiste
- `06a_waiter_payment_splitting.png`: Zahlung Stufe 1 (Rechnungs-Splitting & Artikelauswahl)
- `06d_waiter_payment_pfand_matrix.png`: Zahlung Stufe 1 mit aktiver Leergut-Rückpfandmatrix (+1€/+2€)
- `06b_waiter_payment_method.png`: Zahlung Stufe 2 (Zahlarten-Auswahl: Bar, Karte, Wertmarke)
- `06c_waiter_payment_cash_rechner.png`: Zahlung Stufe 3 (Bargeld-Rechencenter mit Scheinen, Münzen & Rückgeld)
- `07_waiter_settle.png`: Kellner-Schichtabschluss & Kassensturz

### 3. Monitore, Displays & Gäste-Portale (10 Screens)
- `01_home_station_select.png`: Stationsauswahl & PIN-Login
- `02_setup_wizard.png`: Erst-Setup-Assistent
- `08_kitchen_kds.png`: Küchenmonitor KDS mit Live-Bons
- `09_kiosk_self_order.png`: SB-Bestellkiosk Hochformat 1080x1920
- `10_customer_display.png`: Kundendisplay / Thekenmonitor
- `11_guest_table_menu.png`: Gast-Self-Service Speisekarte am Tisch
- `12_receipt_ebon.png`: Digitaler E-Bon mit Artikeln & QR-Code
- `13_team_chat.png`: Team-Funk Chatzentrale mit Verlauf
- `14_taps_flow_monitor.png`: Zapfhahn- & Durchflussüberwachung
- `15_virtual_printer.png`: Virtueller ESC/POS Druckmonitor

### 4. Admin Leitstand & Fachmodule (24 Screens)
- `16_admin_dashboard.png` bis `39_admin_docs.png`: Alle 24 Administrations-Module im Dark-Theme.

---

## 4. v0.4.18 – Sicherheits-Härtung & Audit-Umsetzung (04.09.2026)

> Umsetzung des systematischen Security-/Produkt-Audits. **Nicht umgesetzt (bewusst): Rabatt-/Aufschlag-/Trinkgeld-UI.** **Erstattung nur bar (CASH_REFUND), keine Karten-Rückbuchung.**

### Weshalb
Reports-Leck, unsignierter Middleware-Fallback, Werks-PINs, Body-PIN-Storno, offene Payment-/Guest-/Receipt-Endpunkte, Socket Fail-Open, HA-Legacy-Bypass, Secrets im Backup, EXEC-RCE-Fläche, Float-Geld, fehlender Belegarchiv-/Inventur-/Split-Flow.

### Wie (Technik)
- **Reports:** `src/app/api/reports/route.ts` ADMIN-only; `?waiterName` → 403 + neue `GET /api/reports/mine` (nur eigene Zahlungen). `?days=N` (Default 30) begrenzt Last.
- **Middleware:** `src/middleware.ts` exaktes Public-Matching (`===`/`+ '/'`), fail-closed ohne Secret (500 statt Decode), Security-Header (CSP, Permissions-Policy, COOP).
- **Session:** `src/lib/auth-session.ts` `jti/iss/aud`, 12h→8h, `__Host-`-Cookie, `RevokedSession`-Tabelle + `revokeSessionToken()` beim Logout (`src/app/api/auth/pin/route.ts`).
- **PINs:** `src/lib/auth-pin.ts` Klartext-Fallback entfernt, `secureCompare` ohne PadEnd, keine Werks-Defaults (Schema `@default("")`), `isWeakPin()` (6–12 Ziffern, Blocklist). `POST /api/auth/initial-setup` 6-stellig + Rate-Limit 5/h + Duplikat-Schutz.
- **Storno:** `POST /api/orders/[id]/void` ADMIN-only, kein Body-PIN, Rate-Limit 10/10min.
- **Payments:** `GET /api/payments/session/[id]` Auth + Minimal-Payload; `callback` Rate-Limit 60/min + nur `sessionId` zurück; `POST` CANCEL/CONFIRM/MANUAL unverändert mit Guards.
- **Gast/Beleg:** `guest/orders` Rate-Limit 20/min + QR-Pflicht (oder Gastmodus an) + Input-Sanitizing (280/200 Zeichen, keine `<>"'`); `receipt/[code]` min. 12 Zeichen + 60/h.
- **Rate-Limit:** `src/lib/rate-limiter.ts` + `checkSimpleRateLimit/registerSimpleAttempt/getClientKey` für Receipt/Guest/Callback/Setup/Scan/Refund/Redeem.
- **Socket:** `server.js` `ping_target` nur Staff, `device:update` nur `admin_room`, Heartbeat-Drossel 60s, `device:register` validiert/sanitized. Client `src/lib/socket-client.ts` Heartbeat 15s→60s, `alert()` → `openbon:force-logout`-Event.
- **HA:** `src/lib/ha/ha-secret.ts` Legacy-Bypass entfernt (nur noch `HA_ALLOW_LEGACY=1` als Ausnahme), `docker-compose.yml` `HA_ENFORCE_SECRET=1` + `HA_AUTO_FAILOVER=0`; `ha-service.ts` Kalt-Standby (kein Auto-Promote ohne `haAutoFailover`).
- **Secrets:** `config/public` ohne Provider-IDs; `backup GET` ohne Secrets/PIN-Hashes; `callback-signature.ts` ohne Fallback-Key (fail-closed).
- **Update:** `src/app/api/system/update/route.ts` EXEC nur exakte Read-Only-Liste via `execFile` (kein `diff`-Regex, kein pull/reset/install über EXEC).
- **Chat:** `src/app/api/chat/route.ts` Zod (`ChatMessageSchema` 500 Zeichen), Sender aus Session, kein `broadcastAlert`-Spoof.
- **Scan:** `printers/scan` Rate-Limit 3/min.
- **mDNS:** `server.js` DNS-Query-Check + 1/s-Drossel.
- **DB:** `src/lib/db.ts` Pragmas mit await (`WAL/busy 8000/foreign_keys`, Fehler-Log); Schema `RevokedSession`, `Payment`-Cents (`totalGrossCents/...`), TSE-Felder (`tseSerial/TransactionNo/Signature/...`), `isRefund/refundOfPaymentId/...`, `DiningTable.guestName/reservationName/reservedAt/openTabCents`, PIN-Defaults `""`.
- **Fiskal:** `fiscal.ts` Salt aus `FISCAL_SALT` (Test-Fallback nur Vitest) + `TSE_HINWEIS`; `dsfinvk-exporter.ts` + `cashPointClosingCsv`/`indexXml`; `datev-exporter.ts` + `resolveDatevAccounts`/`DATEV_DEFAULTS`.
- **Geld:** `payments POST` + `amount-split` schreiben Cent-Felder; neue `POST /api/payments/[id]/refund` **nur bar** (`CASH_REFUND`, Karten → 422 mit Hinweis auf manuelle Terminal-Rückbuchung), Gegenbuchung + Audit.
- **Kasse:** `POST /api/payments/amount-split` (Betragssplit), `POST /api/stock-units/count` (Inventur Soll/Ist+Differenz), `POST /api/tokens/redeem` (Code `TYPE:WERT`, z. B. `DRINK:2.50`, Rate-Limit), `POST /api/kds/undo` (10-Min-Fenster), `POST /api/tables/guest` (Deckel/Reservierung), `/api/receipt/archive` (Suche + protokollierter Neudruck).
- **UI:** `README` 5→4 Themes; `next.config.mjs` `reactStrictMode:true`; POS-Suche (`src/app/pos/page.tsx`); Offline-Banner hatte Zähler bereits (verifiziert); `.env.example` (`FISCAL_SALT/BACKUP_DIR/BACKUP_KEEP/HA_*`), `BACKUP_DIR` per ENV + Rotation per `BACKUP_KEEP`, Spooler ehrlich (`PENDING` bis ACK, FAILED persistiert statt still verworfen).
- **Tests:** neu `src/__tests__/security_hardening_v0418.test.ts` (9 Tests: secureCompare, PBKDF2-only, Weak-PIN, DSFinV-K-Arhiv, DATEV, CASH_REFUND, Chat/AmountSplit-Zod, RateLimit). Gesamt **192 Tests grün** (`tsc --noEmit` sauber).
- **Version:** `0.4.17` → `0.4.18` (`package.json`, `src/lib/version.ts`, Test angepasst).

### Offen / Hinweise
- TSE echt (fiskaly/efsta/Swissbit) + DSFinV-K-ZIP/TAR-Bundle + DATEV-ZIP mit Beleg-PDFs noch extern zu auditieren.
- Float→Int Vollmigration: Cent-Spalten parallel befüllt, alte Floats erst in 2 Releases droppen.
- Drucker-ACK→`PRINTED`-Rückschreibung in `orders/checkout/guest` noch auf `PENDING`-Flow umstellen (Spooler meldet ehrlich, Aufrufer setzen noch optimistisch).
- PWA-Precache (`kiosk/customer-display/waiter/payment`), Bottom-Sheet-Numpad, globale Skeletons, Settings-Suche/`?tab=` als nächste UI-Stufe.

