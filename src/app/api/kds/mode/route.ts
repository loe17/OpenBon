import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';
import { logSystemActionSafe } from '@/lib/action-logger';

export async function GET(req: Request) {
  try {
    const config = await prisma.eventConfig.findUnique({
      where: { id: 'default' },
      select: { kdsControlsPrinting: true, kdsPrintDelayTicket: true, kdsNotifyWaitersOnReady: true },
    });
    return NextResponse.json({
      kdsControlsPrinting: config?.kdsControlsPrinting ?? false,
      kdsPrintDelayTicket: config?.kdsPrintDelayTicket ?? true,
      kdsNotifyWaitersOnReady: config?.kdsNotifyWaitersOnReady ?? false,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const dataToUpdate: { kdsControlsPrinting?: boolean; kdsPrintDelayTicket?: boolean; kdsNotifyWaitersOnReady?: boolean } = {};

    if (typeof body.kdsControlsPrinting === 'boolean') {
      dataToUpdate.kdsControlsPrinting = body.kdsControlsPrinting;
    }
    if (typeof body.kdsPrintDelayTicket === 'boolean') {
      dataToUpdate.kdsPrintDelayTicket = body.kdsPrintDelayTicket;
    }
    if (typeof body.kdsNotifyWaitersOnReady === 'boolean') {
      dataToUpdate.kdsNotifyWaitersOnReady = body.kdsNotifyWaitersOnReady;
    }

    const updated = await prisma.eventConfig.update({
      where: { id: 'default' },
      data: dataToUpdate,
      select: { kdsControlsPrinting: true, kdsPrintDelayTicket: true, kdsNotifyWaitersOnReady: true },
    });

    // Wenn auf "Monitor steuert Druck" umgeschaltet wird:
    // Noch offene, ungedruckte Positionen auf HELD setzen, damit sie nicht versehentlich im Hintergrund drucken
    if (body.kdsControlsPrinting === true) {
      await prisma.orderItem.updateMany({
        where: {
          printStatus: 'PENDING',
          order: { status: { in: ['OPEN', 'IN_PREPARATION'] } },
        },
        data: { printStatus: 'HELD' },
      });
    }

    await logSystemActionSafe(() => ({
      action: 'KDS_MODE_CHANGE',
      category: 'ADMIN',
      actor: auth.session.waiterName || auth.session.role,
      details: `Küchenmonitor-Modus geändert: Drucksteuerung=${updated.kdsControlsPrinting}, WarteBon=${updated.kdsPrintDelayTicket}, KellnerBenachrichtigung=${updated.kdsNotifyWaitersOnReady}`,
      metadata: updated,
    }));

    if (global.io) {
      global.io.emit('kds:mode_updated', updated);
      global.io.emit('config:updated', updated);
    }

    return NextResponse.json({ success: true, ...updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
