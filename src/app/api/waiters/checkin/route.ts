import { NextResponse } from 'next/server';
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

    const existing = await prisma.waiterProfile.findUnique({ where: { name } });

    const waiter = existing
      ? await prisma.waiterProfile.update({
          where: { name },
          data: { isActive: true },
          select: { id: true, name: true, isActive: true, tipProfileId: true },
        })
      : await prisma.waiterProfile.create({
          data: { name },
          select: { id: true, name: true, isActive: true, tipProfileId: true },
        });

    return NextResponse.json({ success: true, waiter });
  } catch (error) {
    console.error('POST /api/waiters/checkin error:', error);
    return NextResponse.json(
      { error: 'Die Bedienung konnte nicht angemeldet werden.' },
      { status: 500 }
    );
  }
}
