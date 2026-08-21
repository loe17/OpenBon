# OpenBon - Hardwareempfehlungen & Mindestanforderungen

Dieser Leitfaden bietet eine praxisorientierte Übersicht über bewährte Hardware für den stabilen Betrieb von **OpenBon** auf Vereinsfesten, Festivals und in der Gastronomie.

---

## 1. Übersicht & Mindestanforderungen

| Komponente | Mindestanforderung | Empfohlene Hardware |
|---|---|---|
| **Kassen-Server (Host)** | 2 CPU-Kerne, 2 GB RAM, 10 GB Speicher | **Raspberry Pi 5 (4GB/8GB)** oder **Intel N100 Mini-PC** (16GB RAM, SSD) |
| **Mobilgeräte (Bedienung)** | Smartphone mit aktuellem Browser (iOS 13+, Android 9+) | Beliebige iOS- / Android-Smartphones der Helfer |
| **Thermobondrucker** | ESC/POS kompatibel, 80mm Papierbreite, LAN/Ethernet | **Epson TM-T20III**, **Star TSP143III**, **Munbyn 80mm LAN** |
| **WLAN-Router / APs** | Dual-Band (2.4 GHz + 5 GHz), mind. 50 gleichzeitige Geräte | **AVM FRITZ!Box 4040 / 7590** oder **Ubiquiti UniFi AP** |
| **Kartenterminals** | Standalone oder Smartphone-App fähig | **VR-Pay Me** (Volksbanken) oder **SumUp Air / Solo** |

---

## 2. Der Kassen-Server (Hauptrechner & Standby)

OpenBon ist extrem ressourceneffizient und läuft auf nahezu jeder modernen Hardware.

### Option A: Raspberry Pi 4 oder 5 (Headless / Kompakt)
- **Modell**: Raspberry Pi 4B (4GB) oder Raspberry Pi 5 (4GB/8GB)
- **Speicherkarte**: SanDisk Extreme microSDXC (A2, V30) mit mind. 32 GB
- **Netzteil**: Original Raspberry Pi 27W USB-C Netzteil (für unterbrechungsfreien Dauerbetrieb)
- **Vorteil**: Nahezu geräuschlos, extrem stromsparend (< 10 Watt), ideal für feste Montage im Zählerkasten / Thekenbereich.

### Option B: Intel Mini-PC (Windows oder Ubuntu)
- **Modell**: Beelink Mini S12, Geekom, Intel N100 / N95 / Celeron
- **Vorteil**: Sehr hohe Rechenleistung, schnelle M.2 NVMe SSD, zwei LAN-Ports für redundante Netzwerke.

### Option C: Vorhandener Laptop
- **Vorteil**: Eingebauter Akku dient als automatische **USV (Unterbrechungsfreie Stromversorgung)** bei kurzen Stromschwankungen auf dem Festgelände.

---

## 3. Mobilteile für das Serviceteam (Kellner-Smartphones)

Da OpenBon als Web-App (PWA) im Browser läuft, können Helfer ihre eigenen Smartphones nutzen (**BYOD - Bring Your Own Device**).

- **Apple iPhone / iPad**: Ab iOS 13 mit Safari (Vollbildmodus über *"Zum Home-Bildschirm"*).
- **Android**: Ab Android 9 mit Google Chrome (Vollbildmodus über *"App installieren"*).
- **Praxis-Tipps für den Festbetrieb**:
  1. **Powerbanks**: Lege 2-3 Powerbanks im Kassenbereich für Helfer bereit.
  2. **Displaysperre**: Empfiehlt sich auf 5-10 Minuten zu stellen, damit die Kasse sofort bedienbar bleibt.
  3. **WLAN-Priorität**: Das private Mobilfunknetz ausschalten (Flugmodus + WLAN an), um Akku zu sparen und Verbindungsschwankungen zu vermeiden.

---

## 4. Thermobondrucker (Küche, Schenke, Kasse)

OpenBon steuert alle Drucker über das standardisierte **ESC/POS-Protokoll via TCP/IP (Port 9100)** an.

### Empfohlene Druckermodelle:
1. **Epson TM-T20III (Ethernet)**: Der weltweite Gastronomie-Standard – extrem langlebig, leiser Druck, automatischer Papierschnitt.
2. **Epson TM-T88VI (Ethernet/WLAN)**: High-Speed Thermodrucker (bis zu 350 mm/s) für Hauptausschank und Großküche.
3. **Star Micronics TSP143III LAN**: Robuster Netzwerk-Bondrucker mit zuverlässigem Cutter.
4. **Munbyn 80mm LAN Thermodrucker**: Preisgünstige Alternative für kleinere Vereinsfeste.
5. **Metapace T-3**: Bewährter Thekendrucker mit RJ11-Kassenladenanschluss.

### Kassenladen (Geldkassette):
- Alle Kassenladen mit **RJ11/RJ12 Standard-Impulskabel (24V)**, die an die Rückseite des Bondruckers gesteckt werden, springen bei Barzahlung in OpenBon automatisch auf.

---

## 5. WLAN-Infrastruktur & Festzelt-Netzwerk

Ein stabiles WLAN ist das Rückgrat jedes mobilen Kassensystems.

- **Empfohlene Router**:
  - **AVM FRITZ!Box 4040**: Günstiger, extrem stabiler reiner WLAN-Router (ohne Modem-Zwang).
  - **AVM FRITZ!Box 7590 / 7530**: Ideal, wenn ein DSL- oder LTE-Uplink direkt genutzt werden soll.
  - **Ubiquiti UniFi U6+ / Long Range**: Für sehr große Festzelte mit über 1.000 Gästen.
- **WLAN-Best-Practices**:
  - **Eigenes Kassen-WLAN**: Richte ein eigenes WLAN (z. B. `OpenBon-Kasse`) mit starkem WPA2/WPA3-Passwort ein, das **nicht** an Festgäste herausgegeben wird.
  - **5 GHz Frequenzband bevorzugen**: 5 GHz ist im Festzelt weniger störanfällig gegenüber den Smartphones der Besucher.
  - **Feste IP-Adressen**: Vergib im Router feste IP-Adressen an die Drucker (z. B. `192.168.1.201` Küche, `192.168.1.202` Ausschank).

---

## 6. Kartenzahlungsterminals (SumUp, VR-Pay Me, EC-Terminals)

OpenBon unterstützt alle gängigen Kartenzahlungsarten:

1. **VR-Pay Me (Volksbanken / Raiffeisenbanken)**:
   - Mobiler Kartenleser, der über Bluetooth mit dem Smartphone gekoppelt wird oder als Standalone-Terminal arbeitet.
2. **SumUp (SumUp Air / SumUp Solo / 3G)**:
   - Schnelle Kartenzahlung ohne monatliche Fixkosten, ideal für saisonale Feste.
3. **Stationäre EC-Terminals (ZVT / OPI / Ingenico / Verifone)**:
   - Für Großveranstaltungen mit Miet-Terminals der Hausbank.
