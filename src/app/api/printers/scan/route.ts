import { NextResponse } from 'next/server';
import net from 'net';
import os from 'os';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';
import { isValidSubnetPrefix } from '@/lib/printer/validate';

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
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const customPrefix = searchParams.get('subnet');
    // M4.2: Subnetz-Prefix streng validieren (x.y.z, max. 255) - ohne Pruefung
    // liess sich ein Admin-Scan gegen beliebige fremde Netze richten.
    const subnet =
      customPrefix && isValidSubnetPrefix(customPrefix) ? customPrefix : getLocalSubnetPrefix();

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

    const existingPrinters = await prisma.printer.findMany({ select: { ipAddress: true, name: true } });
    const existingIps = new Set(existingPrinters.map((p) => p.ipAddress));

    return NextResponse.json({
      subnet,
      detectedCount: detectedIps.length,
      printers: detectedIps.map((ip, idx) => ({
        name: `ESC/POS Drucker #${idx + 1} (${ip})`,
        ipAddress: ip,
        port: 9100,
        paperWidth: 80,
        characterSet: 'CP858',
        alreadyExists: existingIps.has(ip),
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
