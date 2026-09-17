import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { pushMenuToWebhosting } from '@/lib/webhosting-push';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const config = await prisma.eventConfig.findFirst();

    const baseUrl = (body.baseUrl || config?.baseUrl || '').trim().replace(/\/+$/, '');
    const syncToken = (body.syncToken || (config as any)?.webhostingSyncToken || '').trim();
    const eventName = (body.eventName || config?.name || 'Vereinsfest').trim();

    if (!baseUrl) {
      return NextResponse.json(
        { error: 'Bitte trage zuerst die Öffentliche Basis-URL (z. B. https://bon.mein-verein.de) in den Einstellungen ein.' },
        { status: 400 }
      );
    }

    // Automatisch in der Datenbank absichern
    if (config) {
      const updates: Record<string, any> = {};
      if (baseUrl !== config.baseUrl) updates.baseUrl = baseUrl;
      if (syncToken && syncToken !== (config as any).webhostingSyncToken) updates.webhostingSyncToken = syncToken;
      if (Object.keys(updates).length > 0) {
        await prisma.eventConfig.update({ where: { id: config.id }, data: updates }).catch(() => {});
      }
    }

    const rawExpiresAt = body.expiresAt;
    let expiresAtSec: number | null = null;
    if (rawExpiresAt) {
      if (typeof rawExpiresAt === 'number') {
        expiresAtSec = rawExpiresAt > 10000000000 ? Math.floor(rawExpiresAt / 1000) : rawExpiresAt;
      } else if (typeof rawExpiresAt === 'string') {
        const parsed = new Date(rawExpiresAt).getTime();
        if (!isNaN(parsed)) {
          expiresAtSec = Math.floor(parsed / 1000);
        }
      }
    }

    const result = await pushMenuToWebhosting(baseUrl, syncToken, eventName, expiresAtSec);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
