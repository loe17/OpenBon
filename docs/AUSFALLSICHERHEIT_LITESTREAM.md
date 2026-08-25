# Ausfallsicherheits- und Replikations-Leitfaden: Litestream & Kalt-Standby

Dieses Dokument beschreibt das Hochverfügbarkeits- und Desaster-Recovery-Konzept von **OpenBon** für Vereinsfeste und Gastronomiebetriebe.

---

## 🎯 Ausfallsicherheits-Ziele

| Kennzahl | Ziel | Begründung |
|---|---|---|
| **RPO (Recovery Point Objective)** | **< 1 Sekunde** | Keine einzige Bestellung oder Buchung darf bei Hardwareausfall verloren gehen. |
| **RTO (Recovery Time Objective)** | **3 bis 5 Minuten** | Manuelles Kalt-Standby-Umschalten ohne Split-Brain-Gefahr. |
| **WLAN-Ausfall Resilienz** | **Vollständig offlinefähig** | Tablets speichern Bestellungen lokal in IndexedDB und senden automatisch nach. |

---

## 🏗️ Replikations-Architektur mit Litestream

[Litestream](https://litestream.io) überwacht kontinuierlich die SQLite WAL-Datei (`dev.db-wal`) und spiegelt jede geschriebene Transaktion im Sekundentakt auf ein sekundäres Speichermedium:

```
[ Raspberry Pi 5 (Kassen-Server) ]
  ├── SQLite WAL (dev.db-wal)
  │     │
  │     └─── Litestream Service ────► [ USB-Stick / Externe SSD ] (Ziel 1)
  │                                ──► [ Zweiter Pi / NAS Share ] (Ziel 2)
  │
  └── Offline-First Tablets (PWA) ───► [ Lokale Outbox in IndexedDB ]
```

---

## 🚀 Installation & Einrichtung von Litestream

### 1. Litestream installieren (auf Linux / Raspberry Pi OS)

```bash
# ARM64 (Raspberry Pi 4 / 5):
curl -L https://github.com/benbjohnson/litestream/releases/download/v0.3.13/litestream-v0.3.13-linux-arm64.tar.gz -o litestream.tar.gz
sudo tar -C /usr/local/bin -xzf litestream.tar.gz
rm litestream.tar.gz

# AMD64 (x86_64 PC/Server):
curl -L https://github.com/benbjohnson/litestream/releases/download/v0.3.13/litestream-v0.3.13-linux-amd64.tar.gz -o litestream.tar.gz
sudo tar -C /usr/local/bin -xzf litestream.tar.gz
rm litestream.tar.gz
```

### 2. Litestream Konfiguration (`litestream.yml`)

Die Konfigurationsdatei liegt im Projektverzeichnis (`litestream.yml`):

```yaml
dbs:
  - path: ./prisma/dev.db
    replicas:
      - path: /media/usb/openbon-litestream
        sync-interval: 1s
        retention: 72h
      - path: ./prisma/backups/litestream-replica
        sync-interval: 5s
        retention: 48h
```

### 3. Als systemd Service starten

```bash
sudo cp scripts/litestream.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now litestream
sudo systemctl status litestream
```

---

## 🆘 Notfall-Wiederherstellung (Disaster Recovery)

Sollte der primäre Raspberry Pi hardwareseitig ausfallen (z. B. SD-Kartendefekt, Wasserschaden):

### Szenario: Kalt-Standby aktivieren

1. **Ersatz-Gerät einschalten** (Pi mit identischem OpenBon-Image).
2. **USB-Stick mit Litestream-Backup am Ersatz-Gerät einstecken**.
3. **Restore-Skript ausführen**:
   ```bash
   cd /opt/openbon
   sudo ./scripts/litestream-restore.sh /media/usb/openbon-litestream
   ```
4. **OpenBon starten**:
   ```bash
   sudo systemctl start openbon
   ```
5. **Netzwerk**:
   - Entweder dem Ersatz-Pi dieselbe statische IP-Adresse geben oder die Mobilteile verbinden sich automatisch über `http://openbon.local:3000` via mDNS.

---

## 🛡️ Best Practices für den Festbetrieb

1. **Bondrucker immer per LAN-Kabel** an den Netzwerk-Switch anschließen.
2. **Kassen-Server an eine USV oder Powerbank mit Durchladefunktion** hängen.
3. **Zwei getrennte WLAN Access Points** für Kellner-Tablets im Festzelt betreiben.
4. **Litestream-Replikation auf USB-Stick** vor Festbeginn prüfen (`litestream generations /opt/openbon/prisma/dev.db`).
