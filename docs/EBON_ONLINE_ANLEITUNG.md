# Ausführliche Anleitung: E-Bon Online-Bereitstellung & NFC-Übertragung

**Stand:** 28.08.2026 · OpenBon v0.4.14  
Dieses Handbuch beschreibt Schritt für Schritt, wie digitale Belege (E-Bons nach § 33 KassenSichV) für Gäste bereitgestellt werden, wenn das Kassensystem mit dem Internet verbunden ist, sowie die direkte Übertragung per **NFC (Near Field Communication)**.

---

## Inhaltsverzeichnis
1. [Funktionsweise & Architektur des E-Bons](#1-funktionsweise--architektur-des-e-bons)
2. [Option 1: Cloudflare Tunnel mit Netcup-Domain (Empfohlene Königslösung)](#2-option-1-cloudflare-tunnel-mit-netcup-domain-empfohlene-k%C3%B6nigsl%C3%B6sung)
3. [Option 2: Netcup Webhosting als NGINX/PHP Reverse-Proxy mit DynDNS](#3-option-2-netcup-webhosting-als-nginxphp-reverse-proxy-mit-dyndns)
4. [Option 3: E-Bon per NFC an das Kunden-Smartphone übertragen](#4-option-3-e-bon-per-nfc-an-das-kunden-smartphone-%C3%BCbertragen)
5. [Konfiguration in OpenBon (Admin-Bereich)](#5-konfiguration-in-openbon-admin-bereich)
6. [Sicherheits-Checkliste für den Livebetrieb](#6-sicherheits-checkliste-f%C3%BCr-den-livebetrieb)

---

## 1. Funktionsweise & Architektur des E-Bons

Beim Kassiervorgang erzeugt OpenBon einen kryptografischen 16-Zeichen-Hash (z. B. `EBON-A4F2-99B1-C03E-7182`).  
Der Gast greift über sein Smartphone im Mobilfunknetz (4G/5G) auf folgende URL zu:

$$\text{https://bon.mein-verein.de/receipt/EBON-A4F2-99B1-C03E-7182}$$

### Das Sicherheitsprinzip
* Die Kasse und die SQLite-Datenbank bleiben **lokal im Festzelt** geschützt.
* Aus dem Internet darf **ausschließlich der Pfad `/receipt/*`** erreichbar sein.
* Alle Admin-Bereiche (`/admin`), Kassen-Seiten (`/pos`, `/waiter`) und internen APIs (`/api/system`, `/api/backup`) werden nach außen **vollständig gesperrt (403 Forbidden)**.

---

## 2. Option 1: Cloudflare Tunnel mit Netcup-Domain (Empfohlene Königslösung)

* **Vorteile:** 100 % kostenlos, extrem sicher, funktioniert mit jedem LTE/5G-Router (auch bei CGNAT / ohne öffentliche IPv4), **keine Portweiterleitungen am Router nötig**, automatische SSL-Zertifikate.
* **Voraussetzungen:** 
  1. Ihre Domain bei Netcup (z. B. `mein-verein.de`)
  2. Kostenloses Cloudflare-Konto (Free Plan)
  3. Der lokale OpenBon-Server (Raspberry Pi, Linux oder Windows-PC)

```
[Gast-Smartphone mit 5G]
          │  HTTPS
          ▼
[Cloudflare Edge Network: bon.mein-verein.de]
          │  Verschlüsselter Outbound-Tunnel (QUIC/TLS)
          ▼
[cloudflared-Dienst auf dem OpenBon-Server vor Ort]
          │  HTTP (nur localhost)
          ▼
[OpenBon Port 3000]
```

### Schritt-für-Schritt Einrichtung:

#### Schritt 1: Subdomain bei Cloudflare anlegen
1. Melden Sie sich bei [dash.cloudflare.com](https://dash.cloudflare.com) an.
2. Fügen Sie Ihre Netcup-Domain hinzu (oder delegieren Sie die Nameserver im Netcup Customer Control Panel / CCP auf die von Cloudflare angegebenen Nameserver).
3. Öffnen Sie im Cloudflare Dashboard: **Zero Trust ➔ Networks ➔ Tunnels**.
4. Klicken Sie auf **Add a Tunnel** ➔ Wählen Sie **Cloudflared** ➔ Vergeben Sie einen Namen (z. B. `openbon-festzelt`).

#### Schritt 2: `cloudflared` auf dem Kassenserver installieren

* **Unter Linux / Raspberry Pi:**
  ```bash
  # Cloudflared herunterladen und installieren
  curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
  sudo dpkg -i cloudflared.deb

  # Tunnel-Dienst mit dem Cloudflare-Token registrieren
  sudo cloudflared service install <IHR_CLOUDFLARE_TUNNEL_TOKEN>
  ```
* **Unter Windows:**
  1. Laden Sie `cloudflared-windows-amd64.msi` von GitHub herunter und installieren Sie es.
  2. Öffnen Sie PowerShell als Administrator und führen Sie aus:
     ```powershell
     cloudflared.exe service install <IHR_CLOUDFLARE_TUNNEL_TOKEN>
     ```

#### Schritt 3: Public Hostname & Pfad-Routing konfigurieren
1. Im Cloudflare Zero Trust Dashboard unter **Public Hostnames**:
   * **Subdomain:** `bon` (Domain: `mein-verein.de`)
   * **Path:** leer lassen (oder `/receipt/*`)
   * **Type:** `HTTP`
   * **URL:** `localhost:3000`
2. **Sicherheits-Regel (WAF) bei Cloudflare einrichten:**
   * Gehen Sie im Cloudflare Dashboard zu **Security ➔ WAF ➔ Custom Rules**.
   * Regel erstellen: *„Block Non-Receipt Traffic“*
   * Bedingung: `(http.host eq "bon.mein-verein.de" and not http.request.uri.path starts_with "/receipt/")`
   * Aktion: **Block** (oder **403 Forbidden**)
   * *Ergebnis:* Aus dem Internet kann absolut niemand auf Admin-, Kassen- oder Buchungsseiten zugreifen.

#### Schritt 4: In OpenBon eintragen
* In OpenBon: **Admin ➔ Einstellungen ➔ Allgemein**.
* **Basis-URL / Server-URL:** `https://bon.mein-verein.de`
* Schalter **Digitaler Beleg (E-Bon)**: **Aktivieren**
* Schalter **E-Bon QR-Code auf Beleg**: **Aktivieren**

---

## 3. Option 2: Netcup Webhosting als NGINX/PHP Reverse-Proxy mit DynDNS

Wenn Sie den Traffic über Ihr **Netcup Webhosting 4000** und einen LTE-Router mit DynDNS leiten möchten:

```
[Gast-Smartphone mit 5G] ──HTTPS──▶ [Netcup Webhosting 4000: bon.mein-verein.de]
                                                     │
                                            Reverse-Proxy via DynDNS
                                                     │
                                                     ▼
                            [LTE-Router Festzelt ➔ Port 3000 ➔ OpenBon Server]
```

### Schritt-für-Schritt Einrichtung:

#### Schritt 1: DynDNS für den Festzelt-Router über die Netcup DNS-API
1. Erstellen Sie im Netcup CCP unter **Stammdaten ➔ API-Schlüssel** ein API-Key-Paar.
2. Richten Sie in Ihrer Fritz!Box oder Ihrem LTE-Router die DynDNS-Aktualisierung ein (oder nutzen Sie den Docker-Container `netcup-dyndns` auf dem Server).
   * **DynDNS-Hostname:** `kasse-home.mein-verein.de`

#### Schritt 2: Portweiterleitung am Router
* Leiten Sie im Festzelt-Router den externen Port **443** (oder einen beliebigen High-Port) an die interne IP des OpenBon-Servers (z. B. `192.168.1.100:3000`) weiter.

#### Schritt 3: Reverse-Proxy auf dem Netcup Webhosting 4000 (Plesk)

Legen Sie im Plesk-Adminpanel eine Subdomain `bon.mein-verein.de` an und wählen Sie **Zusätzliche Nginx-Anweisungen**:

```nginx
# Nur /receipt/ an den Festzelt-Kassenserver durchreichen
location /receipt/ {
    proxy_pass http://kasse-home.mein-verein.de:3000/receipt/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_connect_timeout 5s;
    proxy_read_timeout 10s;
}

# Alle anderen Pfade aus dem Internet sofort sperren!
location / {
    return 403 "Zugriff verweigert. Nur Belegabruf autorisiert.";
}
```

*Falls kein direkter Nginx-Zugriff möglich ist (reines PHP-Hosting), erstellen Sie eine `index.php` im Webspace:*

```php
<?php
// Einfacher sicherer PHP-Proxy für Netcup Webhosting
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Nur /receipt/ Codes erlauben
if (!preg_match('#^/receipt/([A-Z0-9\-]+)$#i', $path, $matches)) {
    http_response_code(403);
    die("Zugriff verweigert.");
}

$targetUrl = "http://kasse-home.mein-verein.de:3000" . $path;
$ch = curl_init($targetUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 5);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

http_response_code($httpCode);
echo $response;
?>
```

---

## 4. Option 3: E-Bon per NFC an das Kunden-Smartphone übertragen

Die Übertragung per **NFC (Near Field Communication)** ist die schnellste und modernste Methode zur papierlosen Belegausgabe: Der Gast hält sein Smartphone kurz an das Kellner-Handy oder an das Theken-Terminal.

```
┌──────────────────────────────────────────────────────────┐
│  Gast hält Smartphone an das Kassen-NFC-Feld             │
│                       ▼                                  │
│  [🔔 System-Popup am Kunden-Handy]                       │
│  "Website öffnen: https://bon.mein-verein.de/receipt/..."│
│                       ▼                                  │
│  1 Fingertipp ➔ E-Bon öffnet sich sofort im Browser!    │
└──────────────────────────────────────────────────────────┘
```

### Technische Umsetzung in OpenBon:
1. **Web NFC API (in Google Chrome auf Android):**  
   Kellner-Handhelds mit Android und aktiviertem NFC nutzen direkt die standardisierte `NDEFReader`-Schnittstelle. Es wird keine zusätzliche App benötigt.
2. **USB-NFC-Reader / Theken-Modul (z. B. ACR122U oder PN532):**  
   An der Bonkasse kann ein USB-NFC-Pad an das Kundendisplay angeschlossen werden.
3. **Feste NFC-Tischkarten (NTAG213 / NTAG215):**  
   Gäste können am Tisch den Aufsteller scannen oder ihr Handy an den Tag halten.

---

## 5. Konfiguration in OpenBon (Admin-Bereich)

Navigieren Sie im Admin-Menü zu:  
👉 **Verwaltung ➔ Einstellungen ➔ Allgemein** oder **Belege & Druck**.

| Einstellung | Empfohlener Wert | Erklärung |
|---|---|---|
| **Basis-URL / Server-URL (`baseUrl`)** | `https://bon.mein-verein.de` | Ihre öffentliche HTTPS-Domain für QR-Codes & NFC-Links. |
| **Digitaler Beleg (E-Bon)** | `Aktiviert` | Schaltet den digitalen Belegabruf frei. |
| **E-Bon QR-Code auf Beleg** | `Aktiviert` | Druckt den QR-Code auf den Kassenbon und zeigt ihn im Kundendisplay. |
| **E-Bon per NFC** | `Aktiviert` | Aktiviert die NFC-Übertragungsfunktion. |
| **NFC auf Kellner-Handys** | `Aktiviert` | Kellner können den E-Bon per NFC auf Gast-Smartphones beamen. |
| **NFC an der Bonkasse** | `Aktiviert` | Thekenkasse bietet NFC-Belegübertragung an. |

### Verhalten in der Kellner-Ansicht (`/waiter/payment`):
* **Weder Online noch NFC aktiv:** Der E-Bon-Button wird nach der Zahlung nicht angezeigt (nur Papierbon drucken oder Tisch schließen).
* **Nur Online (QR) aktiv:** Der E-Bon-Button öffnet direkt den QR-Code auf dem Kellner-Display zum Abscannen.
* **Nur NFC aktiv:** Der E-Bon-Button startet sofort den NFC-Übertragungsmodus (*„Smartphone an Rückseite halten...“*).
* **Beide Optionen aktiv:** Der Kellner kann mit einem Klick zwischen **QR-Code anzeigen** und **NFC übertragen** wählen.

---

## 6. Sicherheits-Checkliste für den Livebetrieb

Vor Festbeginn kurz überprüfen:

- [ ] `baseUrl` in den Einstellungen beginnt mit **`https://`** (nicht http).
- [ ] Testaufruf mit eigenem Handy über Mobilfunk: `https://bon.mein-verein.de/receipt/TEST` antwortet.
- [ ] **Sicherheits-Check:** `https://bon.mein-verein.de/admin` liefert von extern **403 Forbidden** (Zugriff gesperrt).
- [ ] NFC im Smartphone der Bedienung eingeschaltet (Android: Einstellungen ➔ Verbindungen ➔ NFC).
