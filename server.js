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
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // Attach io to global for API routes
  global.io = io;

  io.on('connection', (socket) => {
    const clientIp = socket.handshake.address || socket.conn.remoteAddress;

    // Device Handshake & Status Registration
    socket.on('device:register', (deviceInfo) => {
      const deviceId = deviceInfo.id || socket.id;
      const data = {
        id: deviceId,
        socketId: socket.id,
        name: deviceInfo.name || 'Unbenanntes Gerät',
        role: deviceInfo.role || 'WAITER',
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

      // Broadcast device list update to all connected admins
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

    // Acoustic device ping (Find My Device)
    socket.on('device:ping_target', ({ targetDeviceId }) => {
      io.emit('device:play_sound', { targetDeviceId });
    });

    // Force Logout from Admin
    socket.on('device:force_logout', ({ targetDeviceId }) => {
      io.emit('device:kicked', { targetDeviceId });
    });

    // Realtime Order & Kitchen events
    socket.on('order:created', (orderData) => {
      socket.broadcast.emit('order:new', orderData);
    });

    socket.on('table:updated', (tableData) => {
      socket.broadcast.emit('table:change', tableData);
    });

    socket.on('chat:message', (messageData) => {
      io.emit('chat:incoming', messageData);
    });

    socket.on('stock:updated', (stockData) => {
      io.emit('stock:change', stockData);
    });

    // Kundendisplay / Customer Facing Screen
    socket.on('pos:cart_updated', (payload) => {
      io.emit('pos:cart_updated', payload);
    });

    socket.on('pos:cart_cleared', (payload) => {
      io.emit('pos:cart_cleared', payload);
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
    console.log(`[HA]      HA-Rolle:     ${process.env.HA_ROLE || 'PRIMARY'}`);
    console.log(`==================================================\n`);

    // Spec 7.2: Self-Healing Selbstdiagnose bei Serverstart und danach alle 60 Sekunden.
    // Der Aufruf erfolgt über die eigene HTTP-API, damit exakt dieselbe Logik läuft
    // wie beim manuellen Auslösen aus dem Admin-Bereich.
    const runDiagnostics = () => {
      const req = require('http').request(
        { host: '127.0.0.1', port, path: '/api/system/diagnostics', method: 'POST', timeout: 30000 },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              const result = JSON.parse(body);
              if (result.status && result.status !== 'OK') {
                console.warn(
                  `[DIAGNOSE] Status ${result.status} – ${result.repairsCount} Reparatur(en) durchgeführt.`
                );
                for (const check of result.checks || []) {
                  if (check.status !== 'OK') {
                    console.warn(`[DIAGNOSE]   ${check.label}: ${check.detail}`);
                  }
                }
              }
            } catch {}
          });
        }
      );
      req.on('error', () => {});
      req.on('timeout', () => req.destroy());
      req.end();
    };

    setTimeout(runDiagnostics, 4000);
    const diagnosticsTimer = setInterval(runDiagnostics, 60000);
    diagnosticsTimer.unref?.();

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
