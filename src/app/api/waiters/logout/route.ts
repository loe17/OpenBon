import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';

export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json()) as { name?: string; mode?: 'PAUSE' | 'FULL' };
    const name = (body.name || '').trim();
    const mode = body.mode === 'PAUSE' ? 'PAUSE' : 'FULL';

    if (!name) {
      return NextResponse.json(
        { error: 'Name ist erforderlich' },
        { status: 400 }
      );
    }

    const activeShift = await prisma.waiterProfile.findFirst({
      where: {
        name,
        isActive: true,
        loggedOutAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();

    if (activeShift) {
      if (mode === 'PAUSE') {
        await prisma.waiterProfile.update({
          where: { id: activeShift.id },
          data: { isPaused: true },
        });

        await logSystemActionSafe(() => ({
          action: 'WAITER_PAUSE',
          category: 'AUTH',
          actor: name,
          details: `Bedienung ${name} hat eine kurze Pause gestartet (Bildschirm gesperrt).`,
        }));

        return NextResponse.json({ success: true, mode: 'PAUSE' });
      } else {
        await prisma.waiterProfile.update({
          where: { id: activeShift.id },
          data: {
            isActive: false,
            isPaused: false,
            loggedOutAt: now,
          },
        });

        await logSystemActionSafe(() => ({
          action: 'WAITER_LOGOUT',
          category: 'AUTH',
          actor: name,
          details: `Bedienung ${name} hat die Schicht beendet (Abmeldezeit: ${now.toLocaleTimeString('de-DE')}).`,
        }));

        return NextResponse.json({ success: true, mode: 'FULL', loggedOutAt: now });
      }
    }

    return NextResponse.json({ success: true, mode, message: 'Keine aktive Schicht gefunden' });
  } catch (error) {
    console.error('POST /api/waiters/logout error:', error);
    return NextResponse.json(
      { error: 'Fehler beim Abmelden der Bedienung' },
      { status: 500 }
    );
  }
}
