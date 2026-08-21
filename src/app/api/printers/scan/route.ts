import { NextResponse } from 'next/server';
import net from 'net';
import os from 'os';

function testTcpPort(ip: string, port = 9100, timeout = 350): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;

    socket.setTimeout(timeout);

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
      socket.connect(port, ip);
    } catch {
      resolve(false);
    }
  });
}

function getLocalSubnetPrefix(): string {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (!iface.internal && iface.family === 'IPv4') {
        const parts = iface.address.split('.');
        if (parts.length === 4) {
          return `${parts[0]}.${parts[1]}.${parts[2]}`;
        }
      }
    }
  }
  return '192.168.1';
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const customPrefix = searchParams.get('subnet');
    const subnet = customPrefix || getLocalSubnetPrefix();

    const candidates: string[] = [];
    for (let i = 1; i <= 254; i++) {
      candidates.push(`${subnet}.${i}`);
    }

    // Scan in concurrent batches of 30
    const detectedIps: string[] = [];
    const batchSize = 30;

    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (ip) => {
          const isOpen = await testTcpPort(ip, 9100, 350);
          return { ip, isOpen };
        })
      );

      for (const res of results) {
        if (res.isOpen) {
          detectedIps.push(res.ip);
        }
      }
    }

    return NextResponse.json({
      subnet,
      detectedCount: detectedIps.length,
      printers: detectedIps.map((ip, idx) => ({
        name: `ESC/POS Drucker #${idx + 1} (${ip})`,
        ipAddress: ip,
        port: 9100,
        paperWidth: 80,
        characterSet: 'CP858',
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
