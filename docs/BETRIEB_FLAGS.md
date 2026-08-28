# OpenBon Betriebs-Flags (ENV-Variablen)

Zentrale Referenz aller betrieblichen Schalter. Alle Flags sind optional –
ohne gesetzte ENV verhält sich OpenBon nach den hier beschriebenen Defaults.
Stand: v0.4.11

| Flag | Default | Wirkung | Sicherheitsimplikation |
|---|---|---|---|
| `SESSION_SECRET` | Auto-generiert (DB + `.env`) | Fixes JWT-Signatursecret für Anmelde-Cookies | Muss ≥16 Zeichen sein; wenn gesetzt hat es Vorrang vor DB-Wert |
| `HA_SYNC_SECRET` | aus `EventConfig.haSyncSecret` | Fixes Shared Secret zwischen Primary/Standby (Vorrang vor DB) | Bei Dualbetrieb MÜSSEN beide Knoten denselben Wert haben |
| `HA_PARTNER_URL` | aus `EventConfig.haPartnerUrl` | Adresse des Partnerknotens | Erzwingung möglich auch ohne Konfig-DB |
| `HA_ENFORCE_SECRET` | aus (off) | `=1`: Sync-Endpunkte lehnen schwache/oeffentliche Secrets hart ab (401) | Erst nach erfolgreichem Pairing aktivieren, sonst bricht der Standby-Sync |
| `TRUSTED_ORIGINS` | leer | Komma-separierte Origin-Hosts zusätzlich zum CSRF-Origin-Check der Middleware | Nur nötig bei Reverse-Proxy mit abweichendem Hostnamen |
| `OPENBON_SOCKET_ORIGIN` | Allowlist | `=*` deaktiviert die WebSocket-Origin-Allowlist (Not-Aus, nicht empfohlen) | Mit `*` darf jede Website Socket-Events senden/empfangen |
| `OPENBON_EXTRA_ORIGINS` | leer | Zusätzliche erlaubte WS-Origin(s), z. B. eigener DNS-Name oder Proxy-Port (`https://kasse.example.org:8443`) | Nur exakte Origins; keine Wildcards |
| `PRINTERS_ALLOW_ANY_IP` | off | `=1`: Druckerziel-Prüfung auf private IP-Bereiche abschalten (Tunnel-Sonderfälle) | Erlaubt SSRF-artige Raw-TCP-Ziele – nur temporär nutzen |
| `REPAIR_DNS` | off | Installer schreibt `/etc/resolv.conf` um (Fallback-DNS 1.1.1.1/8.8.8.8) | Systemweite DNS-Umleitung; nur fürs Setup |
| `OPENBON_ALLOW_DATA_LOSS` | off | Startskripte & Update-Pfad führen `prisma db push --accept-data-loss` trotzdem aus | Explizite Datenvernichtung erlauben – immer erst Backup ziehen! |

## Pairing ohne Terminal-Befehle (ab v0.4.11)

Manuelles Pairing passiert in der App:
1. Admin → **Einstellungen → Allgemein → Hochverfügbarkeit**
2. Karte „Sync-Sicherheit": **Pairing starten** → Admin-PIN → 6-stelliger Code erscheint
3. Am Partner-Server denselben Dialog öffnen, Code + lokale Admin-PIN eingeben → **Übernehmen**
4. Zurück am Initiator: **Übernehmen** (Schritt C) – beidseitige Heartbeat-Probe bestätigt den Erfolg

Das frühere Skript `scripts/ha-pair.mjs` ist veraltet und funktionslos.
Diagnose/Warnhinweise zur Frische kommen automatisch alle 60 s (Selbsttest,
Banner `HA-Hinweis`, Preflight `ha_secret`).
