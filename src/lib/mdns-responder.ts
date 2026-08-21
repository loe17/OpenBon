import dgram from 'dgram';
import os from 'os';

/**
 * Lightweight Zero-Dependency Multicast DNS (mDNS) Responder
 * Responds to `openbon.local` queries on 224.0.0.251:5353
 * Allows all LAN devices (iOS, Android 12+, Windows 10/11, macOS, Linux)
 * to open http://openbon.local:3000 without router DNS configuration.
 */

const MDNS_MULTICAST_ADDR = '224.0.0.251';
const MDNS_PORT = 5353;
const TARGET_HOST = 'openbon.local';

function getLocalIPv4(): string | null {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const ifaceList = interfaces[name];
    if (!ifaceList) continue;
    for (const iface of ifaceList) {
      if (!iface.internal && iface.family === 'IPv4') {
        return iface.address;
      }
    }
  }
  return null;
}

export function startMdnsResponder(): () => void {
  const localIp = getLocalIPv4();
  if (!localIp) {
    console.log('[mDNS] Keine aktive Netzwerkverbindung gefunden.');
    return () => {};
  }

  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  socket.on('error', (err) => {
    // Port 5353 may be bound by Windows or Avahi, which is fine as OS handles mDNS
    console.log(`[mDNS Info] Port 5353 geteilt oder vom OS verwaltet (${err.message}).`);
  });

  socket.on('message', (msg, rinfo) => {
    try {
      const msgStr = msg.toString('binary');
      if (msgStr.toLowerCase().includes('openbon') && msgStr.toLowerCase().includes('local')) {
        const ipParts = localIp.split('.').map((p) => parseInt(p, 10));
        if (ipParts.length !== 4) return;

        // Build DNS A-Record Response
        const response = Buffer.from([
          // Transaction ID
          0x00, 0x00,
          // Flags: Standard query response, No error
          0x84, 0x00,
          // Questions: 0, Answer RRs: 1, Authority RRs: 0, Additional RRs: 0
          0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
          // Name: 7openbon5local0
          0x07, 0x6f, 0x70, 0x65, 0x6e, 0x62, 0x6f, 0x6e, 0x05, 0x6c, 0x6f, 0x63, 0x61, 0x6c, 0x00,
          // Type: A (0x0001)
          0x00, 0x01,
          // Class: IN (0x0001) + Cache Flush (0x8000) = 0x8001
          0x80, 0x01,
          // TTL: 120 seconds
          0x00, 0x00, 0x00, 0x78,
          // Data length: 4 bytes
          0x00, 0x04,
          // IP Address bytes
          ipParts[0], ipParts[1], ipParts[2], ipParts[3],
        ]);

        socket.send(response, 0, response.length, MDNS_PORT, MDNS_MULTICAST_ADDR);
      }
    } catch {
      // Ignore malformed packets
    }
  });

  socket.bind(MDNS_PORT, () => {
    try {
      socket.addMembership(MDNS_MULTICAST_ADDR);
      console.log(`[mDNS] openbon.local wird im lokalen WLAN für ${localIp} angekündigt.`);
    } catch {
      // Membership already added by OS or socket
    }
  });

  return () => {
    try {
      socket.close();
    } catch {}
  };
}
