# OpenBon - Hochverfügbarkeit & Replikation (Dual-Server Failover)

OpenBon verfügt über eine integrierte **Echtzeit-Transaktionsreplikation** zwischen zwei Rechnern, damit der Kassenbetrieb selbst bei einem totalen Hardwareausfall oder Stromausfall an einem Laptop niemals stoppt.

---

## 1. Funktionsweise

1. **PC 1 (Primary Master)**:
   - Führt alle Schreibvorgänge aus.
   - Schreibt jeden erzeugten Bon, Tisch-Status und jede Zahlung in das `SyncJournal`.
   - Sendet Heartbeat-Bestätigungen.
2. **PC 2 (Hot-Standby)**:
   - Pollt im Sekundentakt (`/api/sync/heartbeat`) den Zustand von PC 1.
   - Spiegelt kontinuierlich alle neuen Journal-Einträge in seine lokale SQLite-Datenbank.
3. **Failover (Standard: Kalt-Standby, manuell)**:
    - Standard ist **kein Auto-Promote** (`HA_AUTO_FAILOVER=0`, Schema-Default `false`). Antwortet PC 1 dreimal nicht, meldet PC 2 `ha:manual_failover_required` – Übernahme nur per Admin-Knopf (verhindert Split-Brain bei kurzer Funkstille).
    - Nur mit explizitem Opt-in (`HA_AUTO_FAILOVER=1` + DB `haAutoFailover=true`) erfolgt automatisches Promote nach Lease-Prüfung.
    - Hinweis: Beide Knoten haben getrennte SQLite-Dateien; die Journal-Replikation deckt nur ORDER/PAYMENT-Header ab (keine Positionen) – für Volllast-Stände Kalt-Standby + Litestream-USB + Restore-Drill nutzen (siehe `AUSFALLSICHERHEIT_LITESTREAM.md`, `NOTFALL_RUNBOOK.md`).

---

## 2. Inbetriebnahme

- **Hauptrechner 1**: `start-primary.bat` starten (oder `PORT=3000 HA_ROLE=PRIMARY`).
- **Ersatzrechner 2**: `start-standby.bat` starten (oder `PORT=3001 HA_ROLE=STANDBY HA_PARTNER_URL=http://192.168.1.100:3000`).
