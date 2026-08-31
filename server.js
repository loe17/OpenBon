try {
  require('dotenv').config();
} catch {}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db';
}

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

/**
 * M4.1 Erlaubte WebSocket-Origins.
 *
 * Vorher galt cors.origin = '*' - jede Website im Internet durfte eine
 * Socket.IO-Verbindung zur Kasse aufbauen und Events senden/empfangen.
 *
 * Neu: Allowlist aus localhost, openbon.local, allen eigenen Netzwerkkarten
 * (damit Stationen via http://<LAN-IP>:<Port> wie gewohnt funktionieren) und
 * optionalen Zusatz-Origin aus OPENBON_EXTRA_ORIGINS (z. B. Reverse Proxy).
 * Mit OPENBON_SOCKET_ORIGIN=* laesst sich das alte Verhalten bewusst
 * reaktivieren (Not-Aus-Hebel, nicht empfohlen).
 */
function buildAllowedSocketOrigins() {
  const os = require('os');
  const ports = new Set(['80', '3000', '3001']);
  ports.add(String(port));
  if (process.env.HA_PARTNER_PORT) ports.add(String(process.env.HA_PARTNER_PORT));

  const origins = new Set();
  for (const p of ports) {
    origins.add(`http://localhost:${p}`);
    origins.add(`http://127.0.0.1:${p}`);
    origins.add(`http://openbon.local:${p}`);
    origins.add(`https://openbon.local:${p}`);

    // Browser lassen den Standard-Port im Origin-Header weg
    if (p === '80') {
      origins.add('http://localhost');
      origins.add('http://127.0.0.1');
      origins.add('http://openbon.local');
      origins.add('https://openbon.local');
    }

    for (const name of Object.keys(os.networkInterfaces())) {
      for (const iface of os.networkInterfaces()[name] || []) {
        if (!iface.internal && iface.family === 'IPv4') {
          origins.add(`http://${iface.address}:${p}`);
          if (p === '80') origins.add(`http://${iface.address}`);
        }
      }
    }
  }

  for (const extra of String(process.env.OPENBON_EXTRA_ORIGINS || '').split(',')) {
    const trimmed = extra.trim().replace(/\/+$/, '');
    if (trimmed) origins.add(trimmed);
  }

  return Array.from(origins);
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// In-Memory store for Virtual Printers so all clients see live printed tickets in browser
global.virtualPrinterHistory = global.virtualPrinterHistory || [];
global.connectedDevices = global.connectedDevices || new Map();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      await handle(req, res);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  const io = new Server(server, {
    cors: {
      // M4.1: Kein '*' mehr - siehe buildAllowedSocketOrigins().
      origin:
        process.env.OPENBON_SOCKET_ORIGIN === '*'
          ? '*'
          : buildAllowedSocketOrigins(),
      methods: ['GET', 'POST'],
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // WICHTIG: Die Instanz global verfuegbar machen. Die Next.js-API-Routen
  // senden ihre Echtzeit-Ereignisse ueber `global.io` (Bestellungen, Zahlungen,
  // KDS-Status, Storno, Tischstatus, Chat, virtueller Drucker, Audit-Log).
  // Ohne diese Zuweisung laufen saemtliche `if (global.io)`-Bloecke still ins Leere.
  global.io = io;

  // Handshake-Authentifizierung für Socket.IO
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie || '';
      const authHeader = socket.handshake.headers.authorization || socket.handshake.auth?.token || '';
      let token = '';

      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      } else if (authHeader) {
        token = authHeader.trim();
      } else {
        const match = cookieHeader.match(/openbon_session=([^;]+)/);
        if (match) token = match[1];
      }

      if (token) {
        try {
          const { jwtVerify } = require('jose');
          const secretStr = process.env.SESSION_SECRET || (global.__OPENBON_JWT_SECRET__ || '');
          if (secretStr) {
            const { payload } = await jwtVerify(token, new TextEncoder().encode(secretStr));
            socket.authenticatedRole = payload.role || 'WAITER';
            socket.authenticatedUser = payload.waiterName || 'Staff';
          }
        } catch {
          socket.authenticatedRole = 'GUEST';
        }
      } else {
        socket.authenticatedRole = 'GUEST';
      }
    } catch {
      socket.authenticatedRole = 'GUEST';
    }
    next();
  });

  io.on('connection', (socket) => {
    const clientIp = socket.handshake.address || socket.conn.remoteAddress;

    // Device Handshake & Status Registration
    socket.on('device:register', (deviceInfo) => {
      const deviceId = deviceInfo.id || socket.id;
      const claimedRole = deviceInfo.role || 'WAITER';
      
      // Nur echte verifizierte Admins dürfen die Rolle ADMIN erhalten
      const role = socket.authenticatedRole === 'ADMIN' 
        ? 'ADMIN' 
        : (claimedRole === 'ADMIN' ? 'WAITER' : claimedRole);

      const data = {
        id: deviceId,
        socketId: socket.id,
        name: deviceInfo.name || 'Unbenanntes Gerät',
        role,
        ipAddress: clientIp.replace(/^.*:/, '') || '127.0.0.1',
        userAgent: deviceInfo.userAgent || '',
        batteryLevel: deviceInfo.batteryLevel !== undefined ? deviceInfo.batteryLevel : 100,
        isCharging: deviceInfo.isCharging || false,
        status: 'ONLINE',
        connectedAt: deviceInfo.connectedAt || new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      };

      global.connectedDevices.set(deviceId, data);
      socket.deviceId = deviceId;
      socket.role = role;

      // In Räume eintragen: Individueller Geräteraum + Rollenraum
      socket.join(deviceId);
      if (role === 'ADMIN') {
        socket.join('admin_room');
      }

      // Geräteliste an alle Admins und Manager senden
      io.emit('device:update', Array.from(global.connectedDevices.values()));
    });

    // Heartbeat & Battery updates
    socket.on('device:heartbeat', (data) => {
      if (socket.deviceId && global.connectedDevices.has(socket.deviceId)) {
        const device = global.connectedDevices.get(socket.deviceId);
        device.lastSeenAt = new Date().toISOString();
        if (data.batteryLevel !== undefined) device.batteryLevel = data.batteryLevel;
        if (data.isCharging !== undefined) device.isCharging = data.isCharging;
        device.status = 'ONLINE';
        global.connectedDevices.set(socket.deviceId, device);
        io.emit('device:update', Array.from(global.connectedDevices.values()));
      }
    });

    // Akustischer Geräte-Ping (Find My Device) gezielt an das Zielgerät
    socket.on('device:ping_target', ({ targetDeviceId }) => {
      if (targetDeviceId) {
        io.to(targetDeviceId).emit('device:play_sound', { targetDeviceId });
      }
    });

    // Force Logout gezielt an das Zielgerät (nur durch ADMIN autorisiert)
    socket.on('device:force_logout', ({ targetDeviceId }) => {
      if (socket.role !== 'ADMIN') {
        return;
      }
      if (targetDeviceId) {
        io.to(targetDeviceId).emit('device:kicked', { targetDeviceId });
        if (global.connectedDevices.has(targetDeviceId)) {
          global.connectedDevices.delete(targetDeviceId);
          io.to('admin_room').emit('device:update', Array.from(global.connectedDevices.values()));
        }
      }
    });

    // Realtime Order & Kitchen events
    // M4.1: Broadcasting ist ab sofort Personal-Sache. Unauthentifizierte
    // GUEST-Verbindungen (ohne JWT, CORS offen) koennen keine Systemereignisse
    // mehr erzeugen - Empfaenger inkl. Gastdisplay bleiben unberuehrt.
    const isStaffSocket = () =>
      Boolean(socket.authenticatedRole && socket.authenticatedRole !== 'GUEST');

    socket.on('order:created', (orderData) => {
      if (!isStaffSocket()) return;
      socket.broadcast.emit('order:new', orderData);
    });

    socket.on('table:updated', (tableData) => {
      if (!isStaffSocket()) return;
      socket.broadcast.emit('table:change', tableData);
    });

    socket.on('chat:message', (messageData) => {
      if (!isStaffSocket()) return;
      io.emit('chat:incoming', messageData);
    });

    socket.on('stock:updated', (stockData) => {
      if (!isStaffSocket()) return;
      io.emit('stock:change', stockData);
    });

    // Kundendisplay / Customer Facing Screen
    socket.on('pos:cart_updated', (payload) => {
      if (!isStaffSocket()) return;
      io.emit('pos:cart_updated', payload);
    });

    socket.on('pos:cart_cleared', (payload) => {
      if (!isStaffSocket()) return;
      io.emit('pos:cart_cleared', payload);
    });

    socket.on('pos:register_station', (payload) => {
      if (!isStaffSocket()) return;
      io.emit('pos:station_online', payload);
    });

    socket.on('pos:request_cart_state', (payload) => {
      if (!isStaffSocket()) return;
      socket.broadcast.emit('pos:request_cart_state', payload);
    });

    socket.on('disconnect', () => {
      if (socket.deviceId && global.connectedDevices.has(socket.deviceId)) {
        const device = global.connectedDevices.get(socket.deviceId);
        device.status = 'OFFLINE';
        device.lastSeenAt = new Date().toISOString();
        global.connectedDevices.set(socket.deviceId, device);
        io.emit('device:update', Array.from(global.connectedDevices.values()));
      }
    });
  });

  server.listen(port, hostname, (err) => {
    if (err) throw err;
    console.log(`\n==================================================`);
    console.log(`[OPENBON] KASSENSYSTEM SERVER GESTARTET`);
    console.log(`[HTTP]    Lokale URL:   http://localhost:${port}`);
    console.log(`[mDNS]    Domain-URL:   http://openbon.local:${port}`);
    console.log(`[NETZ]    Netzwerk-URL: http://${hostname}:${port}`);
    console.log(`[MODE]    Modus:        ${dev ? 'Entwicklung' : 'Produktion'}`);
    console.log(`[HA]      HA-Rolle:     ${process.env.HA_ROLE || 'STANDALONE'}`);
    console.log(`==================================================\n`);

    // Spec 7.2: Self-Healing Selbstdiagnose + Backup- + Retention-Scheduler werden
    // zentral über den Next.js-Instrumentation-Hook (src/instrumentation.ts) beim
    // Serverstart gestartet – kein HTTP-Selbstanruf mehr nötig.

    // Start lightweight Zero-Config mDNS responder for openbon.local
    try {
      const dgram = require('dgram');
      const os = require('os');
      const mdnsSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      
      let localIp = '127.0.0.1';
      const ifaces = os.networkInterfaces();
      for (const name of Object.keys(ifaces)) {
        for (const iface of ifaces[name] || []) {
          if (!iface.internal && iface.family === 'IPv4') {
            localIp = iface.address;
            break;
          }
        }
      }

      mdnsSocket.on('message', (msg) => {
        try {
          const str = msg.toString('binary');
          if (str.includes('openbon') && str.includes('local')) {
            const ipParts = localIp.split('.').map((p) => parseInt(p, 10));
            if (ipParts.length === 4) {
              const resp = Buffer.from([
                0x00, 0x00, 0x84, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
                0x07, 0x6f, 0x70, 0x65, 0x6e, 0x62, 0x6f, 0x6e, 0x05, 0x6c, 0x6f, 0x63, 0x61, 0x6c, 0x00,
                0x00, 0x01, 0x80, 0x01, 0x00, 0x00, 0x00, 0x78, 0x00, 0x04,
                ipParts[0], ipParts[1], ipParts[2], ipParts[3],
              ]);
              mdnsSocket.send(resp, 0, resp.length, 5353, '224.0.0.251');
            }
          }
        } catch {}
      });

      mdnsSocket.bind(5353, () => {
        try {
          mdnsSocket.addMembership('224.0.0.251');
        } catch {}
      });
    } catch {}
  });
});
