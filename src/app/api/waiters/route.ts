import { NextRequest, NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import { prisma } from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';

export async function GET(req: Request) {
  // Lesend fuer jede angemeldete Station: die Schichtabrechnung an der
  // Bedienstation braucht die Liste. Die Antwort enthaelt bewusst keine PINs.
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const [profiles, distinctOrders, distinctPayments, recentSettles] = await Promise.all([
      prisma.waiterProfile.findMany({
        select: {
          id: true,
          name: true,
          isActive: true,
          tipProfileId: true,
          tipProfile: true,
          createdAt: true,
        },
        orderBy: { name: 'asc' },
      }),
      prisma.order.findMany({
        select: { waiterName: true },
        distinct: ['waiterName'],
      }),
      prisma.payment.findMany({
        select: { waiterName: true },
        distinct: ['waiterName'],
      }),
      prisma.actionLog.findMany({
        where: { action: 'WAITER_SETTLED' },
        select: { actor: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const namesMap = new Map<string, { id?: string; name: string; isActive: boolean; isSettled?: boolean; lastSettledAt?: Date | null }>();

    profiles.forEach((p: any) => {
      namesMap.set(p.name.trim(), { id: p.id, name: p.name.trim(), isActive: p.isActive });
    });

    distinctOrders.forEach((o: any) => {
      const name = (o.waiterName || '').trim();
      if (name && !namesMap.has(name)) {
        namesMap.set(name, { id: `adhoc-${name}`, name, isActive: true });
      }
    });

    distinctPayments.forEach((p: any) => {
      const name = (p.waiterName || '').trim();
      if (name && !namesMap.has(name)) {
        namesMap.set(name, { id: `adhoc-${name}`, name, isActive: true });
      }
    });

    const result = Array.from(namesMap.values()).map((w) => {
      const settle = recentSettles.find((s: any) => s.actor === w.name);
      return {
        ...w,
        isSettled: Boolean(settle),
        lastSettledAt: settle?.createdAt || null,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Fehler beim Laden der Kellner' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { name, pin, tipProfileId, isActive } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 });
    }

    const waiter = await prisma.waiterProfile.create({
      data: {
        name,
        pin: pin || '3333',
        tipProfileId: tipProfileId || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
      include: {
        tipProfile: true,
      },
    });

    await logSystemActionSafe(() => ({
      action: 'WAITER_CREATED',
      category: 'AUTH',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Bedienung angelegt.',
    }));

    return NextResponse.json(waiter, { status: 201 });
  } catch (error) {
    console.error('POST /api/waiters error:', error);
    return NextResponse.json({ error: 'Fehler beim Anlegen des Kellners' }, { status: 500 });
  }
}
