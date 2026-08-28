/**
 * M4.2 Validierung von Drucker-Zieladressen.
 *
 * Raw-TCP-Dispatch (ESC/POS auf Port 9100) wurde bisher ohne jede
 * Adresspruefung akzeptiert - ein angemeldeter Nutzer konnte beliebige
 * Internet-Ziele als "Drucker" eintragen und Bytes dorthin schicken (SSRF)
 * oder interne Netze scannen. Diese Checks erlauben weiterhin alle privaten
 * Bereiche, Loopback und Link-local sowie mDNS-/LAN-Hostnamen - aber keine
 * oeffentlichen IPv4-Literal-Adressen.
 *
 * Not-Aus fuer Sonderfaelle (z. B. Tunnel-gespiegelte Druckserver):
 *   PRINTERS_ALLOW_ANY_IP=1
 */
const PUBLIC_IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const SAFE_HOSTNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,250}[A-Za-z0-9])?$/;

export interface PrinterAddressResult {
  ok: boolean;
  ip: string;
  port: number;
  error?: string;
}

function octetsOf(ip: string): number[] | null {
  const match = PUBLIC_IPV4_RE.exec(ip.trim());
  if (!match) return null;
  const octets = [match[1], match[2], match[3], match[4]].map(Number);
  if (octets.some((o) => o > 255)) return null;
  return octets;
}

export function isPrivateOrLocalIPv4(ip: string): boolean {
  const octets = octetsOf(ip);
  if (!octets) return false;
  const [a, b] = octets;

  if (a === 10 || a === 127) return true; // RFC1918 / Loopback
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 169 && b === 254) return true; // Link-local (Auto-IP / Bonjour-Fallback)
  return false;
}

export function validatePrinterAddress(
  rawIp: unknown,
  rawPort: unknown,
  fallbackIp = '127.0.0.1'
): PrinterAddressResult {
  let ip = typeof rawIp === 'string' ? rawIp.trim() : '';
  if (!ip) ip = fallbackIp;

  const allowAny = process.env.PRINTERS_ALLOW_ANY_IP === '1';

  // USB- und serielle Geraetepfade (/dev/usb/lp0, /dev/ttyUSB0, COM1, \\localhost\...)
  if (
    ip.startsWith('/dev/usb/lp') ||
    ip.startsWith('/dev/tty') ||
    ip.startsWith('/dev/lp') ||
    /^COM\d+$/i.test(ip) ||
    ip.startsWith('\\\\')
  ) {
    return { ok: true, ip, port: Number(rawPort) || 0 };
  }

  const octets = octetsOf(ip);
  if (octets) {
    if (!allowAny && !isPrivateOrLocalIPv4(ip)) {
      return {
        ok: false,
        ip,
        port: Number(rawPort) || 9100,
        error:
          'Oeffentliche IP-Adressen sind als Druckerziel nicht erlaubt. Nur LAN-Bereiche (10.x, 172.16-31.x, 192.168.x), Loopback, USB (/dev/usb/lp0) oder Link-local.',
      };
    }
  } else if (!SAFE_HOSTNAME_RE.test(ip)) {
    return {
      ok: false,
      ip,
      port: Number(rawPort) || 9100,
      error: 'Ungueltige Druckeradresse (erwartet wird eine LAN-IP, Hostname oder USB-Pfad wie /dev/usb/lp0).',
    };
  }

  let port = parseInt(String(rawPort ?? 9100), 10);
  if (!Number.isFinite(port)) port = 9100;
  if (port < 1 || port > 65535) {
    return { ok: false, ip, port, error: 'Drucker-Port muss zwischen 1 und 65535 liegen.' };
  }

  return { ok: true, ip, port };
}

/** Subnetz-Prefix (z. B. "192.168.4") streng validieren. */
export function isValidSubnetPrefix(prefix: string): boolean {
  const parts = String(prefix).split('.');
  if (parts.length !== 3) return false;
  return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}
