import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import haService from '@/lib/ha/ha-service';
import { requireAdmin } from '@/lib/admin-guard';
import { requireApiAuth } from '@/lib/api-guard';
import {
  sanitizeConfigInput,
  hashPlaintextConfigPins,
} from '@/lib/config-whitelist';

/**
 * M5.3: Die Feld-Whitelist, Typ-Koerzierung und PIN-Hashing wurde in
 * src/lib/config-whitelist.ts ausgelagert und wird von /api/backup (Restore)
 * mit denselben Regeln genutzt. Session-/HA-Secrets sind darin gesperrt.
 */

export async function GET(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    let config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      config = await prisma.eventConfig.create({
        data: { id: 'default', name: 'Vereinsfest 2026' },
      });
    }
    return NextResponse.json(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    // M5.3: gemeinsame Whitelist + automatisches PIN-Hashing (wie im Backup-Restore)
    const data = hashPlaintextConfigPins(sanitizeConfigInput(body));

    if (typeof data.adminPin === 'string' && data.adminPin.trim()) {
      await prisma.staff.upsert({
        where: { name: 'Administrator' },
        create: { name: 'Administrator', role: 'ADMIN', pinHash: data.adminPin as string, isActive: true },
        update: { pinHash: data.adminPin as string, isActive: true },
      });
    }

    const updated = await prisma.eventConfig.upsert({
      where: { id: 'default' },
      update: data,
      create: { id: 'default', ...data },
    });

    if (typeof data.haRole === 'string') {
      const promoted = await haService.setRole(data.haRole as 'PRIMARY' | 'STANDBY');
      if (!promoted) {
        return NextResponse.json(
          {
            error:
              'Rollenwechsel abgelehnt: Eine andere Instanz hÃ¤lt noch eine gÃ¼ltige PRIMARY-Lease (Split-Brain-Schutz).',
          },
          { status: 409 }
        );
      }
    }

    if (global.io) {
      // M4.1: Secrets werden NICHT an die Clients gebroadcastet - nur der
      // entschluesselte Ã¶ffentliche Teil der Konfiguration.
      const { sanitizeConfigForBroadcast } = await import('@/lib/config-sanitize');
      global.io.emit('config:updated', sanitizeConfigForBroadcast(updated));
    }

    await logSystemActionSafe(() => ({
      action: 'CONFIG_UPDATED',
      category: 'ADMIN',
      actor: auth.session.waiterName || auth.session.role,
      details: `Konfiguration geÃ¤ndert: ${Object.keys(data).join(', ') || '(keine Felder)'}`,
      metadata: { changedFields: Object.keys(data) },
    }));

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
