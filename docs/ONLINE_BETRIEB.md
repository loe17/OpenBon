# OpenBon im Online-Betrieb (Kartenzahlung / E-Bon über das Internet)

**Stand:** 28.08.2026 · OpenBon v0.4.14

Dieses Dokument beschreibt, wie OpenBon gefahrlos für Szenarien geöffnet wird,
in denen ein Internetzugang nötig ist:

- Kartenzahlung über Cloud-Provider (z. B. Stripe Payment Intent / QR)
- Abruf des digitalen Belegs (E-Bon) durch Gäste über Mobilfunk (`/receipt/<code>`)
- Bereitstellung via **Cloudflare Tunnel (mit Netcup-Domain)** oder **Netcup Webhosting DynDNS / NGINX-Proxy**
  👉 *Detaillierte Schritt-für-Schritt-Anleitung:* [EBON_ONLINE_ANLEITUNG.md](file:///c:/Users/Lukas/Documents/GeminiTemp/Kassensystem/docs/EBON_ONLINE_ANLEITUNG.md)

**Grundsatz:** Der Kassenkern bleibt im geschlossenen WLAN. Was ins Internet
geht, ist nur ein kleiner Reverse-Proxy mit TLS – **niemals der Kassenserver direkt.**

---

## 1. Warum kein Direktport

Ohne Proxy wären Session-Cookies, PINs und Belegdaten Plaintext-Traffic im
Internet (kein HTTPS im Kernprozess). Zusätzlich würden Verwaltungs-APIs
(`/api/system`, `/api/backup`, `/api/sync`, Drucker-Verwaltung) global erreichbar.
Mit dem Proxy-Terminierungsmuster entfällt beides.

## 2. Empfohlene Architektur

```
Internet ──TLS(443)──▶ Reverse Proxy ──HTTP──▶ OpenBon (nur lokal/LAN:3000)
                        (Caddy/nginx)           ▲
Fest-WLAN-Geräte nutzen weiterhin http://openbon.local:3000 direkt (offline-first).
```

- Öffentlich zugänglich: **nur** `https://kasse.example.org/receipt/*` und
  – falls benötigt – `https://kasse.example.org/payment/callback*`.
  Alles andere wird am Proxy blockiert (siehe Abschnitt 4).
- Das Cookie `openbon_session` bekommt automatisch `Secure`, sobald der Request
  mit `x-forwarded-proto: https` ankommt (im Login-Handler implementiert).

## 3. Caddy-Beispiel (empfohlen, automatische Let's-Encrypt-Zertifikate)

`Caddyfile` auf dem Gateway/Raspberry Pi mit öffentlicher IP bzw. DNS-Challenge:

```caddyfile
kasse.example.org {
    encode gzip

    # Nur was Gäste wirklich brauchen - der Rest ist im Internet tabu
    @guestsAllowed path /receipt/* /payment/callback /payment/callback/*
    handle @guestsAllowed {
        reverse_proxy 127.0.0.1:3000
    }

    # Alles andere -> hart abweisen (auch die Admin-UI!)
    respond 403
}
```

nginx-Äquivalent (Kurzform):

```nginx
server {
    listen 443 ssl http2;
    server_name kasse.example.org;
    ssl_certificate     /etc/letsencrypt/live/kasse.example.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kasse.example.org/privkey.pem;

    location ~ ^/(receipt|payment/callback)(/.*)?$ {
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_pass http://127.0.0.1:3000;
    }

    location / { return 403; }
}
```

> Wichtig: `Host`/`X-Forwarded-*` durchreichen, damit der CSRF-Origin-Check und
> das Secure-Cookie funktionieren.

## 4. Sperren, die zwingend aktiv bleiben

| Bereich | Regel |
|---|---|
| `/api/system/*`, `/api/backup/*`, `/api/fiscal/*` | Niemals im Proxy freigeben |
| `/api/sync/*` (HA-Heartbeat/Pull) | Nur internes HA-Netz, niemals öffentlich |
| `/api/payments/session/[id]` POST | Interne Stationen aus dem Fest-WLAN |
| Datenbankport (SQLite = Datei), SSH | Nur LAN/VPN |

## 5. Kartenzahlung

| Provider | Weg | Internetbedarf am Server |
|---|---|---|
| SumUp/VrPayMe/S-POS/Zettle (Deep-Link) | Handyalmostatnehmer-App → Rückruf der Station im Fest-WLAN | Keiner |
| Stripe QR | Server fragt `api.stripe.com`; Callback wird **API-verifiziert** (v0.4.10+) | Ja |
| ZVT-Terminal | Direkt TCP zum Terminal im LAN | Keiner |

Deep-Link-Ergebnisse können nicht kryptografisch verifiziert werden → seit
v0.4.10 enden sie im Zustand `REPORTED_SUCCESS` und werden vom Personal mit
„Zahlung übernehmen“ bestätigt (Stripe entfällt dank API-Prüfung).

## 6. E-Bon-Datenschutz

- Zugriff erfolgt ausschließlich über den zufälligen Code in der URL
  (`EBON-XXXX-...`); ohne Code ist der Beleg nicht findbar.
- Auf dem öffentlichen Beleg erscheint bewusst nur der Bedienername –
  keine Kundendaten, keine Mailadresse (Mailversand ist nicht implementiert).
- Wenn `baseUrl` eine öffentliche Domain enthält, trägt der Papierbon-QR genau
  diese URL; prüfen, dass sie HTTPS erzwingt (Abschnitt 2).

## 7. Checkliste vor dem Livebetrieb mit Internet

1. Proxy-Caddy/nginx aktiviert und `/api/*`-Ausnahmen wie in Abschnitt 4 gesetzt
2. `TRUSTED_ORIGINS` nicht nötig bei obiger Konfiguration (same-origin bleibt erhalten)
3. Firewall: Port 3000 nur im LAN, Proxy-Ports 80/443 öffnen
4. HA-Paarung ausgeführt (`scripts/ha-pair.mjs`) + `HA_ENFORCE_SECRET=1`
5. Backup-Export einmal manuell heruntergeladen und extern verwahrt
6. Probe: Handynachbar kann `https://…/receipt/CODE` öffnen, aber
   `https://…/admin` liefert **403**
