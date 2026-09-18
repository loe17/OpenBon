import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';

/**
 * Selbst-Anmeldung einer Bedienung an einer Station.
 *
 * Bisher wurde der Name beim Schichtbeginn ausschliesslich in den localStorage
 * des Geraets geschrieben. In der Datenbank entstand nie ein WaiterProfile,
 * weshalb die Kellner-Abrechnung dauerhaft eine leere Liste zeigte.
 *
 * Der Endpunkt legt das Profil an bzw. reaktiviert es. Er vergibt bewusst
 * KEINE PIN – das bleibt dem Admin vorbehalten.
 */
import { getOrAssignWaiterNumber } from '@/lib/waiter-number';

export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json()) as { name?: string };
    const name = (body.name || '').trim();

    if (!name || name.length < 2) {
      return NextResponse.json(
        { error: 'Bitte einen Namen mit mindestens zwei Zeichen angeben.' },
        { status: 400 }
      );
    }

    // Prüfen, ob bereits eine aktive / pausierte Schicht existiert, die noch nicht endgültig beendet wurde
    const activeShift = await prisma.waiterProfile.findFirst({
      where: {
        name,
        isActive: true,
        loggedOutAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    let waiter;
    if (activeShift) {
      // Pause beenden / bestehende Schicht fortsetzen
      waiter = await prisma.waiterProfile.update({
        where: { id: activeShift.id },
        data: {
          isPaused: false,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          waiterNumber: true,
          isActive: true,
          isPaused: true,
          loggedInAt: true,
          loggedOutAt: true,
          tipProfileId: true,
        },
      });
    } else {
      // Neue Schicht mit neuer Schicht-ID und neuer Kellner-Nummer
      const waiterNumber = await getOrAssignWaiterNumber(name, true);
      waiter = await prisma.waiterProfile.create({
        data: {
          name,
          waiterNumber,
          isActive: true,
          isPaused: false,
          loggedInAt: new Date(),
          loggedOutAt: null,
        },
        select: {
          id: true,
          name: true,
          waiterNumber: true,
          isActive: true,
          isPaused: true,
          loggedInAt: true,
          loggedOutAt: true,
          tipProfileId: true,
        },
      });
    }

    await logSystemActionSafe(() => ({
      action: 'WAITER_CHECKIN',
      category: 'AUTH',
      actor: auth.session.waiterName || auth.session.role,
      details: `Bedienung ${waiter.name} (#${waiter.waiterNumber}) angemeldet (ID: ${waiter.id}).`,
    }));

    return NextResponse.json({ success: true, waiter });
  } catch (error) {
    console.error('POST /api/waiters/checkin error:', error);
    return NextResponse.json(
      { error: 'Die Bedienung konnte nicht angemeldet werden.' },
      { status: 500 }
    );
  }
}
