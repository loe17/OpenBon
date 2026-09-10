import { NextRequest, NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import { prisma } from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';
import { getOrAssignWaiterNumber } from '@/lib/waiter-number';
import { hashPin } from '@/lib/auth-pin';

import { getOrCreateOpenPeriod } from '@/lib/register-period';

/** M3.1: Gepinnte Eingabe normalisieren und NUR als PBKDF2-Hash persistieren. */
function resolveStoredPin(rawPin: unknown): string {
  const clean = typeof rawPin === 'string' ? rawPin.trim() : '';
  return hashPin(clean.length >= 4 ? clean : '3333');
}

export async function GET(req: Request) {
  // Lesend fuer jede angemeldete Station: die Schichtabrechnung an der
  // Bedienstation braucht die Liste. Die Antwort enthaelt bewusst keine PINs.
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const period = await getOrCreateOpenPeriod();

    const [profiles, distinctOrders, distinctPayments, recentSettles, latestPayments, latestOrders] = await Promise.all([
      prisma.waiterProfile.findMany({
        select: {
          id: true,
          waiterNumber: true,
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
        where: {
          action: { in: ['WAITER_SETTLED', 'WAITER_SETTLEMENT_CORRECTION'] },
          createdAt: { gte: period.openedAt },
        },
        select: { actor: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.payment.findMany({
        where: {
          isCancelled: false,
          createdAt: { gte: period.openedAt },
        },
        select: { waiterName: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.findMany({
        where: {
          status: { not: 'CANCELLED' },
          createdAt: { gte: period.openedAt },
        },
        select: { waiterName: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const namesMap = new Map<string, { id?: string; waiterNumber?: number | null; name: string; isActive: boolean; isSettled?: boolean; lastSettledAt?: Date | null; tipProfileId?: string | null; tipProfile?: any }>();

    for (const p of profiles) {
      let wNum = p.waiterNumber;
      if (!wNum) {
        wNum = await getOrAssignWaiterNumber(p.name);
      }
      namesMap.set(p.name.trim(), {
        id: p.id,
        waiterNumber: wNum,
        name: p.name.trim(),
        isActive: p.isActive,
        tipProfileId: p.tipProfileId,
        tipProfile: p.tipProfile,
      });
    }

    for (const o of distinctOrders) {
      const name = (o.waiterName || '').trim();
      if (name && !namesMap.has(name)) {
        const wNum = await getOrAssignWaiterNumber(name);
        const prof = await prisma.waiterProfile.findUnique({
          where: { name },
          include: { tipProfile: true },
        });
        namesMap.set(name, {
          id: prof?.id || `adhoc-${name}`,
          waiterNumber: wNum,
          name,
          isActive: prof?.isActive ?? true,
          tipProfileId: prof?.tipProfileId,
          tipProfile: prof?.tipProfile,
        });
      }
    }

    for (const p of distinctPayments) {
      const name = (p.waiterName || '').trim();
      if (name && !namesMap.has(name)) {
        const wNum = await getOrAssignWaiterNumber(name);
        const prof = await prisma.waiterProfile.findUnique({
          where: { name },
          include: { tipProfile: true },
        });
        namesMap.set(name, {
          id: prof?.id || `adhoc-${name}`,
          waiterNumber: wNum,
          name,
          isActive: prof?.isActive ?? true,
          tipProfileId: prof?.tipProfileId,
          tipProfile: prof?.tipProfile,
        });
      }
    }

    const result: any[] = [];

    for (const w of namesMap.values()) {
      const settles = recentSettles.filter((s: any) => s.actor === w.name);
      const latestSettle = settles[0];

      if (!latestSettle) {
        // Noch nie abgerechnet in dieser Kassenperiode
        result.push({
          ...w,
          isSettled: false,
          lastSettledAt: null,
          shiftNumber: 1,
        });
      } else {
        // Wurde bereits mindestens einmal abgerechnet
        const settleTime = new Date(latestSettle.createdAt).getTime();
        const hasPaymentAfter = latestPayments.some(
          (p) => p.waiterName === w.name && new Date(p.createdAt).getTime() > settleTime
        );
        const hasOrderAfter = latestOrders.some(
          (o) => o.waiterName === w.name && new Date(o.createdAt).getTime() > settleTime
        );
        const hasNewActivity = hasPaymentAfter || hasOrderAfter || w.isActive;

        // Wenn nach der Abrechnung neue Aktivität vorliegt: frische, offene Schicht bereitstellen
        if (hasNewActivity) {
          result.push({
            ...w,
            id: w.id,
            name: w.name,
            isSettled: false,
            lastSettledAt: latestSettle.createdAt,
            shiftNumber: settles.length + 1,
          });
        }

        // Bereits abgerechnete Schicht (zur Revisionsansicht / Korrektur)
        result.push({
          ...w,
          id: `${w.id || w.name}-settled-${latestSettle.createdAt}`,
          name: hasNewActivity ? `${w.name} (Schicht ${settles.length})` : w.name,
          originalWaiterName: w.name,
          isSettled: true,
          lastSettledAt: latestSettle.createdAt,
          shiftNumber: settles.length,
        });
      }
    }

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

    const waiterNumber = await getOrAssignWaiterNumber(name);
    const storedPin = resolveStoredPin(pin);

    const waiter = await prisma.waiterProfile.upsert({
      where: { name: name.trim() },
      update: {
        pin: storedPin,
        tipProfileId,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
      create: {
        name: name.trim(),
        waiterNumber,
        pin: storedPin,
        tipProfileId,
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
      details: `Bedienung ${waiter.name} (#${waiter.waiterNumber}) angelegt/aktualisiert.`,
    }));

    return NextResponse.json(waiter);
  } catch (error) {
    console.error('POST /api/waiters error:', error);
    return NextResponse.json({ error: 'Fehler beim Anlegen des Kellners' }, { status: 500 });
  }
}
