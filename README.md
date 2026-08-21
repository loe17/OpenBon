# OpenBon - Kassen- & Bestellsystem (v0.1.0 Beta)

> **Modernes Kassen-, Bestell- und Küchenmanagementsystem für Vereinsfeste, Gastronomie & Events**  
> *Hinweis: OpenBon v0.1.0 befindet sich im Beta-Status. Die Nutzung erfolgt auf eigene Verantwortung ohne Gewähr.*

---

## 📌 Hauptfunktionen

- **Plattformunabhängig & mDNS-Netzwerkdienst**: Zugriff über **`http://openbon.local`** oder die lokale Netzwerk-IP (iOS Safari, Android Chrome, Windows, Mac, Linux).
- **Helles Design & Darkmode**: Tageslichttaugliche, kontrastreiche helle Ansicht für Festzelte, mit umschaltbarem Darkmode.
- **Admin Command Center (`/admin/dashboard`)**: Zentraler Leitstand für Live-Umsätze, offene Tische, Küchenauslastung und Schnellaktionen.
- **Statistiken & Z-Bon Tagesabschluss (`/admin/reports`)**:
  - Grafiken für stündlichen Umsatzverlauf und Warengruppen-Anteile
  - Automatische Hochrechnung des Tagesumsatzes
  - Offizieller Z-Bon Belegdruck (Thermodrucker & PDF) mit Aufschlüsselung nach Bar, SumUp, VR-Pay Me, Terminal und Steuersätzen
- **Tischplan Designer & PDF-Export (`/admin/tables`)**:
  - Tische im Raster anordnen, einzeln aktivieren oder deaktivieren
  - Druckfertige Tischübersicht und Tischkarten als PDF
- **Warenbestand & 1-Klick Ausverkauft-Sperre (`/admin/products` & `/admin/inventory`)**:
  - Bestandsüberwachung direkt am Artikel mit automatischem Abzug bei jeder Bestellung
  - Automatische Sperre bei Bestand 0 und Schnelltasten für Fasswechsel (`+10`, `+50`, `+100`)
- **Stations-PINs & Sicherheit**: Einstellbarer PIN-Schutz für Admin (`1234`), Kasse (`1111`), Küche (`2222`) und Service (`3333`).
- **QR-Code Beitritts-Center (`/admin/qr-codes`)**: Stationen per QR-Code mit Smartphone scannen, inkl. PIN-Anzeige und Belegdruck.
- **Druckersuche & ESC/POS Routing (`/admin/printers`)**:
  - Automatische Suche nach Netzwerk-Bondruckern im lokalen Subnetz (Port 9100)
  - Bon-Splitting nach Küche und Schenke mit CP858-Umlauten (äöüß€)
  - Deaktivierbare virtuelle Testdrucker
- **Kartenzahlungs-Optionen & TSE**: Konfiguration für SumUp, VR-Pay Me und KassenSichV TSE (Swissbit / Fiskaltrust).
- **Offline-Lizenzsystem**: Lizenzprüfung über kryptografische Signaturen ohne Internetverbindung.
- **2-Server Hochverfügbarkeit (HA Failover)**: Primär- und Standby-Server synchronisieren Bestellungen in Echtzeit mit Verbindungsanzeige.
- **Team-Funk (`/chat`)**: Automatische Erkennung der sendenden Station (z. B. *"Bedienung Lisa"* oder *"Bonkasse"*).
- **[Hardware-Empfehlungen](docs/HARDWARE_EMPFEHLUNGEN.md)**: Empfohlene Server, Tablets, Bondrucker und Netzwerk-Router.

---

## 🚀 Installation & Schnellstart

### 1. Headless Linux / Raspberry Pi (1-Klick Installer)
```bash
curl -fsSL https://raw.githubusercontent.com/loe17/OpenBon/master/install-headless.sh | sudo bash
```
Der Installer richtet Node.js, Avahi-mDNS, die Datenbank und den automatischen Systemdienst auf Port 80 ein.

### 2. Manueller Start (Entwickler / Windows)
```bash
# Abhängigkeiten installieren
npm install

# Datenbank initialisieren
npm run db:push
npm run db:seed

# Tests ausführen
npm test

# Server starten
npm run dev
```

---

## 📄 Lizenz & Haftungsausschluss
OpenBon steht unter der [MIT-Lizenz](LICENSE).  
*Haftungsausschluss: OpenBon v0.1.0 Beta wird ohne Gewähr bereitgestellt. Vor dem produktiven Einsatz im gewerblichen Bereich sind lokale steuerrechtliche Vorgaben (GoBD / KassenSichV) eigenverantwortlich zu prüfen.*
