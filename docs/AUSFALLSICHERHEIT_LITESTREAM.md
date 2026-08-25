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

---

## 🔁 Warm-Standby mit Lease-Fencing (Stand 3)

Neben dem Kalt-Standby über Litestream-Restore unterstützt OpenBon einen **Warm-Standby**:
Der Standby-Server läuft dauerhaft mit und überwacht den Primary per Heartbeat
(/api/sync/heartbeat, alle 2 s). Bleiben 3 Heartbeats ohne Antwort, promoted er sich zum Primary.

### Split-Brain-Schutz (Leader-Lease)

Damit es bei Netzwerkpartition nie zwei schreibende Knoten gibt, verwaltet OpenBon eine
**PRIMARY-Lease** (HaLease-Tabelle, TTL 10 Sekunden):

- Ein Knoten darf die Rolle PRIMARY nur **mit gültiger Lease** innehaben.
- Der PRIMARY erneuert seine Lease laufend; der STANDBY kann sie bei Ausfall **übernehmen**.
- Hält beim Start einer Instanz noch eine fremde, gültige Lease, startet diese Instanz
  sicherheitshalber als STANDBY statt als zweiter PRIMARY.
- Rollenwechsel über die Admin-Einstellungen werden mit HTTP 409 abgelehnt, solange
  eine fremde Lease läuft.

### Sync-Absicherung

Die Sync-Endpunkte (/api/sync/heartbeat, /api/sync/pull) sind durch ein **Shared Secret**
geschützt: ENV HA_SYNC_SECRET oder DB-Feld haSyncSecret (Header X-HA-Secret).
Primary und Standby müssen dasselbe Secret verwenden.

### Restore-Drill

Ein Backup ohne getesteten Restore ist kein Backup. Nächtlich ausführen:

```bash
/opt/openbon/scripts/litestream-restore-drill.sh
```

Das Skript prüft Replikat-Frische, stellt die DB isoliert wieder her und führt einen
SQLite-Integritätscheck durch. Bei Cron-Einrichtung meldet es Fehler ins Log – idealerweise
zusammen mit dem Preflight-Check im Admin-Bereich vor Festbeginn nutzen.
