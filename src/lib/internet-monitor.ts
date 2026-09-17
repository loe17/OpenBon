import net from 'net';
import dns from 'dns';

/**
 * Internet-Monitor für OpenBon.
 * Prüft im Hintergrund, ob der Kassen-Computer tatsächlich Zugriff auf das
 * weltweite Internet hat (z. B. für E-Bon-Webhosting, Speisekarten-Upload & Updates).
 * Arbeitet mit 45-Sekunden-Zwischenspeicher (Cache), um den Kassenbetrieb niemals zu blockieren.
 */

interface InternetStatus {
  online: boolean;
  lastChecked: string;
}

let cachedStatus: InternetStatus = {
  online: false,
  lastChecked: new Date(0).toISOString(),
};

let checkPromise: Promise<InternetStatus> | null = null;
const CACHE_TTL_MS = 45 * 1000; // 45 Sekunden Cache

async function probeSocket(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(true);
      }
    });

    socket.on('timeout', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.on('error', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    try {
      socket.connect(port, host);
    } catch {
      if (!isResolved) {
        isResolved = true;
        resolve(false);
      }
    }
  });
}

async function probeDns(timeoutMs = 2000): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    dns.lookup('connectivitycheck.gstatic.com', (err) => {
      clearTimeout(timer);
      resolve(!err);
    });
  });
}

export async function checkInternetConnectivity(force = false): Promise<InternetStatus> {
  const now = Date.now();
  const lastCheckTime = new Date(cachedStatus.lastChecked).getTime();

  if (!force && now - lastCheckTime < CACHE_TTL_MS) {
    return cachedStatus;
  }

  if (checkPromise) {
    return checkPromise;
  }

  checkPromise = (async () => {
    try {
      // 1. Schneller Socket-Probe auf Cloudflare / Google Public DNS (Port 53)
      const socketSuccess =
        (await probeSocket('1.1.1.1', 53, 2000)) ||
        (await probeSocket('8.8.8.8', 53, 2000));

      // 2. DNS-Gegenprobe
      const dnsSuccess = socketSuccess ? true : await probeDns(2000);

      const isOnline = socketSuccess || dnsSuccess;
      cachedStatus = {
        online: isOnline,
        lastChecked: new Date().toISOString(),
      };
    } catch {
      cachedStatus = {
        online: false,
        lastChecked: new Date().toISOString(),
      };
    } finally {
      checkPromise = null;
    }
    return cachedStatus;
  })();

  return checkPromise;
}

export function isInternetOnlineCached(): boolean {
  return cachedStatus.online;
}

export function setCachedInternetStatus(online: boolean): void {
  cachedStatus = {
    online,
    lastChecked: new Date().toISOString(),
  };
}

export function resetInternetCache(): void {
  cachedStatus = {
    online: false,
    lastChecked: new Date(0).toISOString(),
  };
  checkPromise = null;
}

