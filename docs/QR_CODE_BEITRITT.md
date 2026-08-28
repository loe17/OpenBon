# QR-Code Beitritts-Center

Mit OpenBon können Helfer und Servicekräfte ohne mühsame URL-Eingabe in Sekundenschnelle eingebunden werden.

---

## 1. Funktionsweise

1. Der OpenBon Server ermittelt beim Start automatisch seine **lokale IP-Adresse im Festzelt-WLAN** (z. B. `http://192.168.1.100:3000`).
2. Unter `/admin/qr-codes` werden dynamische QR-Codes für jede Station generiert:
   - **Bedienung**: `http://192.168.1.100:3000/waiter`
   - **Bonkasse**: `http://192.168.1.100:3000/pos`
   - **Küchenmonitor**: `http://192.168.1.100:3000/kitchen`
   - **Drucker-Monitor**: `http://192.168.1.100:3000/virtual-printer`

---

## 2. Verwendung im Festbetrieb

### Option A: Direkt vom Bildschirm scannen
- Öffne auf dem Kassen-PC das **QR-Code Beitritts-Center** (`/admin/qr-codes`).
- Die Helfer scannen den gewünschten QR-Code einfach mit ihrer Smartphone-Kamera ab und treten der Station sofort bei.

### Option B: Ausdruck auf Thermopapier (1-Klick Bon)
- Klicke im QR-Code Center bei der jeweiligen Station auf **"Auf Bon drucken"**.
- Der ausgewählte ESC/POS Thermobondrucker druckt einen Abreißbon mit dem Stations-Titel und den Zugangsdaten aus.
- Klebe die gedruckten Bons einfach an die Stationen (z. B. an die Schenke, die Kasse oder das Schwarze Brett im Helferraum)!
