import { NextResponse } from 'next/server';
import net from 'net';
import os from 'os';
import { requireApiAuth } from '@/lib/api-guard';
import { requireAdmin } from '@/lib/admin-guard';
import haService from '@/lib/ha/ha-service';

export const dynamic = 'force-dynamic';

function testTcpPort(ip: string, port = 3000, timeout = 300): Promise<boolean> {
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

function getLocalIpsAndSubnet(): { myIps: string[]; subnetPrefix: string } {
  const ifaces = os.networkInterfaces();
  const myIps: string[] = ['127.0.0.1', 'localhost'];
  let subnetPrefix = '192.168.1';

  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (!iface.internal && iface.family === 'IPv4') {
        myIps.push(iface.address);
        const parts = iface.address.split('.');
        if (parts.length === 4) {
          subnetPrefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
        }
      }
    }
  }

  return { myIps, subnetPrefix };
}

export async function GET(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const port = parseInt(searchParams.get('port') || '3000', 10);
    const { myIps, subnetPrefix } = getLocalIpsAndSubnet();

    const candidates: string[] = [];
    for (let i = 1; i <= 254; i++) {
      const candidateIp = `${subnetPrefix}.${i}`;
      if (!myIps.includes(candidateIp)) {
        candidates.push(candidateIp);
      }
    }

    // Parallel in Blöcken von 35 prüfen
    const openIps: string[] = [];
    const batchSize = 35;
    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (ip) => {
          const isOpen = await testTcpPort(ip, port, 300);
          return { ip, isOpen };
        })
      );
      for (const res of results) {
        if (res.isOpen) {
          openIps.push(res.ip);
        }
      }
    }

    // Für gefundene IPs prüfen, ob dort OpenBon läuft (/api/health)
    const discoveredNodes: Array<{
      ip: string;
      port: number;
      url: string;
      status: string;
      haRole?: string;
      systemName?: string;
    }> = [];

    await Promise.all(
      openIps.map(async (ip) => {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 1500);
          const res = await fetch(`http://${ip}:${port}/api/health`, {
            signal: controller.signal,
          });
          clearTimeout(timer);

          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            // Prüfen ob es eine OpenBon Instanz ist
            if (data?.status && data?.db) {
              discoveredNodes.push({
                ip,
                port,
                url: `http://${ip}:${port}`,
                status: data.status,
                haRole: data.haRole || 'STANDALONE',
                systemName: data.systemName || `OpenBon auf ${ip}`,
              });
            }
          }
        } catch {
          // Kein OpenBon Server auf diesem Port
        }
      })
    );

    return NextResponse.json({
      success: true,
      subnetPrefix,
      nodesCount: discoveredNodes.length,
      nodes: discoveredNodes,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Fehler bei der Netzwerksuche nach Ersatzrechnern' },
      { status: 500 }
    );
  }
}
