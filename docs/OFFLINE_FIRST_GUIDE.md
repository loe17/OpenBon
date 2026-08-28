# Offline-First & Client-Outbox Leitfaden

Dieser Leitfaden beschreibt das **Offline-First-Konzept** von OpenBon für mobile Bedienungs-Tablets und Thekenkassen bei instabilem oder ausfallendem WLAN.

---

## 📱 Wie funktioniert Offline-First in OpenBon?

1. **Service Worker & PWA Caching (`sw.js`)**:
   - Die gesamte Kassen-Applikation, Speisekarte, Artikelkatalog und Tischpläne werden im Browser des Tablets zwischengespeichert.
   - Wenn das WLAN abbricht, zeigt das Tablet keine weiße Fehlerseite, sondern arbeitet nahtlos weiter.

2. **Lokale Outbox (IndexedDB)**:
   - Jede Bestellung und jede Zahlung erhält einen eindeutigen `idempotencyKey`.
   - Bei fehlender Netzwerkverbindung wandert der Vorgang in die lokale IndexedDB-Warteschlange.
   - Der Kellner erhält die Bestätigung: *„Offline gesichert – wird automatisch übertragen, sobald WLAN verfügbar ist."*

3. **Automatischer Reconnect & Synchronisation**:
   - Sobald das Gerät wieder Empfang hat (`window.addEventListener('online')`), sendet die Outbox alle wartenden Vorgänge in der exakten Reihenfolge an den Server.
   - Durch serverseitige Idempotenz entstehen **niemals doppelte Buchungen oder Bons**.

---

## 📋 Verhalten für Helfer & Bedienungen

### Was tun, wenn das WLAN im Zelt abreißt?
- **Einfach normal weiterkassieren und bestellen!**
- Die Tablets speichern die Bons lokal.
- Sobald man sich wieder in Reichweite des Access Points bewegt, leert sich die Warteschlange von alleine.
- An der Bonkasse und am Küchendrucker werden die Bons in der richtigen Reihenfolge ausgegeben.

---

## 🔍 Technischer Ablauf

```mermaid
sequenceDiagram
    participant W as Kellner-Tablet (UI)
    participant O as IndexedDB Outbox
    participant S as Server (API)
    participant P as Netzwerkdrucker

    W->>O: Bestellung erfassen + Idempotency-Key generieren
    alt WLAN verbunden
        O->>S: POST /api/orders (mit X-Idempotency-Key)
        S->>P: Bon drucken
        S-->>O: 200 OK + Order-ID
        O-->>W: Erfolgreich übertragen
    else WLAN gestört / Offline
        O-->>W: Optimistisches OK (in Outbox eingereiht)
        Note over O,W: Kellner bedient nächsten Tisch
        Note over O,S: WLAN kehrt zurück
        O->>S: Auto-Sync: POST /api/orders (mit selbem Key)
        S->>P: Bon drucken
        S-->>O: 200 OK
        O->>O: Eintrag aus Outbox löschen
    end
```
