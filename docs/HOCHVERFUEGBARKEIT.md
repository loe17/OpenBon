# 🛡️ Hochverfügbarkeit & Replikation (Dual-Server Failover)

OrderAssist Web verfügt über eine integrierte **Echtzeit-Transaktionsreplikation** zwischen zwei Rechnern, damit der Kassenbetrieb selbst bei einem totalen Hardwareausfall oder Stromausfall an einem Laptop niemals stoppt.

---

## 🏗️ Funktionsweise

1. **PC 1 (Primary Master)**:
   - Führt alle Schreibvorgänge aus.
   - Schreibt jeden erzeugten Bon, Tisch-Status und jede Zahlung in das `SyncJournal`.
   - Sendet Heartbeat-Bestätigungen.
2. **PC 2 (Hot-Standby)**:
   - Pollt im Sekundentakt (`/api/sync/heartbeat`) den Zustand von PC 1.
   - Spiegelt kontinuierlich alle neuen Journal-Einträge in seine lokale SQLite-Datenbank.
3. **Automatischer Failover (<3s)**:
   - Antwortet PC 1 dreimal hintereinander nicht (3x 1 Sekunde Timeout), befördert sich PC 2 automatisch zum **PRIMARY MASTER**.
   - Alle Kellner-Smartphones können sofort nahtlos auf PC 2 weiterarbeiten. Kein Datenverlust!

---

## 🚀 Inbetriebnahme

- **Hauptrechner 1**: `start-primary.bat` starten (oder `PORT=3000 HA_ROLE=PRIMARY`).
- **Ersatzrechner 2**: `start-standby.bat` starten (oder `PORT=3001 HA_ROLE=STANDBY HA_PARTNER_URL=http://192.168.1.100:3000`).
