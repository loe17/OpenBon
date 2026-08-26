import { NextResponse } from 'next/server';
import net from 'net';
import fs from 'fs';
import path from 'path';
import prisma from '@/lib/db';
import haService from '@/lib/ha/ha-service';
import { getHaSyncSecret } from '@/lib/ha/ha-secret';
import { requireAdmin } from '@/lib/admin-guard';
import { requireApiAuth } from '@/lib/api-guard';

export const dynamic = 'force-dynamic';

interface PreflightCheck {
  id: string;
  label: string;
  status: 'OK' | 'WARNING' | 'ERROR' | 'SKIPPED';
  detail: string;
}

function probePrinter(ip: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const client = new net.Socket();
    let done = false;
    const finish = (ok: boolean) => {
      if (!done) {
        done = true;
        try { client.destroy(); } catch {}
        resolve(ok);
      }
    };
    client.setTimeout(timeoutMs);
    client.connect(port, ip, () => finish(true));
    client.on('error', () => finish(false));
    client.on('timeout', () => finish(false));
  });
}

async function checkLitestreamReplica(): Promise<{ status: PreflightCheck['status']; detail: string }> {
  try {
    const replicaDir = path.join(process.cwd(), 'prisma', 'backups', 'litestream-replica');
    if (!fs.existsSync(replicaDir)) {
      return { status: 'WARNING', detail: 'Kein Litestream-Replikatverzeichnis gefunden – Replikation aktiv?' };
    }
    const files = fs.readdirSync(replicaDir).filter((f) => f.endsWith('.db'));
    if (files.length === 0) {
      return { status: 'WARNING', detail: 'Replikatverzeichnis ist leer – noch keine Replikation gelaufen.' };
    }
    let newest = 0;
    for (const f of files) {
      try {
        const st = fs.statSync(path.join(replicaDir, f));
        if (st.mtimeMs > newest) newest = st.mtimeMs;
      } catch {}
    }
    if (newest === 0) {
      return { status: 'WARNING', detail: 'Replikatdateien nicht lesbar.' };
    }
    const ageSeconds = Math.round((Date.now() - newest) / 1000);
    if (ageSeconds < 120) {
      return { status: 'OK', detail: `Replikat ist ${ageSeconds}s alt.` };
    }
    if (ageSeconds < 600) {
      return { status: 'WARNING', detail: `Replikat ist ${ageSeconds}s alt – Replikation verzögert?` };
    }
    return { status: 'ERROR', detail: `Replikat ist ${Math.round(ageSeconds / 60)} Minuten alt – Litestream läuft vermutlich nicht!` };
  } catch {
    return { status: 'WARNING', detail: 'Replikat-Prüfung fehlgeschlagen.' };
  }
}

/**
 * Preflight-Check vor Festbeginn: DB, HA-Partner, Drucker und Backup-Replikat.
 * Aufruf: POST/GET /api/system/preflight (nur ADMIN, Middleware schützt /api/system).
 */
export async function GET(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const checks: PreflightCheck[] = [];

  // 1. Datenbank
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    checks.push({ id: 'database', label: 'Datenbank', status: 'OK', detail: 'SQLite erreichbar.' });
  } catch (e) {
    checks.push({
      id: 'database',
      label: 'Datenbank',
      status: 'ERROR',
      detail: e instanceof Error ? e.message : 'DB nicht erreichbar.',
    });
  }

  // 2. HA-Rolle & Partner-Knoten
  const role = haService.getRole();
  checks.push({ id: 'ha_role', label: 'HA-Rolle', status: 'OK', detail: `Diese Instanz: ${role}` });

  try {
    const config = await prisma.eventConfig.findUnique({
      where: { id: 'default' },
      select: { haPartnerUrl: true },
    });
    const partnerUrl = config?.haPartnerUrl;
    if (partnerUrl) {
      try {
        const res = await fetch(`${partnerUrl}/api/sync/heartbeat`, {
          headers: { 'X-HA-Secret': await getHaSyncSecret() },
          signal: AbortSignal.timeout(2500),
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({} as any));
          checks.push({
            id: 'ha_partner',
            label: 'HA-Partner',
            status: data.role === role ? 'WARNING' : 'OK',
            detail:
              data.role === role
                ? `Partner antwortet, hat aber dieselbe Rolle (${role}) – Konfiguration prüfen!`
                : `Partner erreichbar als ${data.role || 'unbekannt'}.`,
          });
        } else {
          checks.push({ id: 'ha_partner', label: 'HA-Partner', status: 'WARNING', detail: `HTTP ${res.status} von ${partnerUrl}.` });
        }
      } catch {
        checks.push({
          id: 'ha_partner',
          label: 'HA-Partner',
          status: 'WARNING',
          detail: `Partner ${partnerUrl} nicht erreichbar${role === 'PRIMARY' ? ' – Failover wäre nötig.' : '.'}`,
        });
      }
    } else {
      checks.push({ id: 'ha_partner', label: 'HA-Partner', status: 'SKIPPED', detail: 'Kein Partner-Server konfiguriert (Einzelbetrieb).' });
    }
  } catch {
    checks.push({ id: 'ha_partner', label: 'HA-Partner', status: 'SKIPPED', detail: 'Konfiguration nicht lesbar.' });
  }

  // 3. Drucker-Erreichbarkeit
  try {
    const printers = await prisma.printer.findMany({ where: { isActive: true } });
    const real = printers.filter((p) => !p.isVirtual);
    for (const printer of real) {
      const ok = await probePrinter(printer.ipAddress, printer.port || 9100);
      checks.push({
        id: `printer_${printer.id}`,
        label: `Drucker: ${printer.name}`,
        status: ok ? 'OK' : 'ERROR',
        detail: ok
          ? `${printer.ipAddress}:${printer.port} erreichbar.`
          : `${printer.ipAddress}:${printer.port} NICHT erreichbar – Bonverlust droht!`,
      });
    }
    if (real.length === 0) {
      checks.push({ id: 'printers', label: 'Drucker', status: 'SKIPPED', detail: 'Nur virtuelle Drucker konfiguriert.' });
    }
  } catch {
    checks.push({ id: 'printers', label: 'Drucker', status: 'WARNING', detail: 'Druckerliste nicht ladbar.' });
  }

  // 4. Fehlgeschlagene Druckjobs der letzten 24h
  try {
    const failedCount = await prisma.printJob.count({
      where: { status: 'FAILED', createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    checks.push({
      id: 'failed_prints',
      label: 'Fehlgeschlagene Druckjobs (24h)',
      status: failedCount === 0 ? 'OK' : failedCount < 5 ? 'WARNING' : 'ERROR',
      detail: failedCount === 0 ? 'Keine Fehler.' : `${failedCount} fehlgeschlagene Jobs.`,
    });
  } catch {
    checks.push({ id: 'failed_prints', label: 'Druckjobs', status: 'SKIPPED', detail: 'Nicht prüfbar.' });
  }

  // 5. Litestream-Replikat-Frische
  const replica = await checkLitestreamReplica();
  checks.push({ id: 'litestream', label: 'Backup-Replikat (Litestream)', status: replica.status, detail: replica.detail });

  const worst = checks.reduce<'OK' | 'WARNING' | 'ERROR' | 'SKIPPED'>((acc, c) => {
    const rank = { OK: 0, SKIPPED: 0, WARNING: 1, ERROR: 2 } as const;
    return rank[c.status] > rank[acc] ? c.status : acc;
  }, 'OK');

  return NextResponse.json({
    status: worst,
    role,
    checkedAt: new Date().toISOString(),
    checks,
  });
}
