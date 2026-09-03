import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { setAllStationPins, isWeakPin } from '@/lib/auth-pin';
import { logSystemActionSafe } from '@/lib/action-logger';
import { checkSimpleRateLimit, registerSimpleAttempt, getClientKey } from '@/lib/rate-limiter';

export async function POST(req: Request) {
  try {
    const rlKey = getClientKey(req, 'initial-setup');
    const rl = checkSimpleRateLimit(rlKey, 5, 60 * 60 * 1000, 15 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Zu viele Einrichtungsversuche. Bitte in ${rl.remainingSeconds}s erneut versuchen.` },
        { status: 429 }
      );
    }
    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    if (config?.initialPinSet) {
      return NextResponse.json(
        { error: 'Die Ersteinrichtung wurde bereits abgeschlossen. PIN-Änderungen sind nur noch im Admin-Bereich möglich.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { adminPin, posPin, kitchenPin, waiterPin } = body;

    if (!adminPin || !posPin || !kitchenPin || !waiterPin) {
      registerSimpleAttempt(rlKey, 60 * 60 * 1000);
      return NextResponse.json(
        { error: 'Alle 4 Stations-PINs (Admin, POS, Küche, Bedienung) müssen angegeben werden.' },
        { status: 400 }
      );
    }

    const pins = [String(adminPin).trim(), String(posPin).trim(), String(kitchenPin).trim(), String(waiterPin).trim()];
    for (const p of pins) {
      if (!/^\d{6,12}$/.test(p) || isWeakPin(p)) {
        registerSimpleAttempt(rlKey, 60 * 60 * 1000);
        return NextResponse.json(
          { error: 'Jede PIN muss 6–12 Ziffern lang sein, nicht nur Nullen/Einsen und keine triviale Folge (z. B. 123456).' },
          { status: 400 }
        );
      }
    }
    if (new Set(pins).size < 2) {
      registerSimpleAttempt(rlKey, 60 * 60 * 1000);
      return NextResponse.json({ error: 'Bitte unterschiedliche PINs für die Stationen wählen.' }, { status: 400 });
    }

    const success = await setAllStationPins({
      adminPin: String(adminPin).trim(),
      posPin: String(posPin).trim(),
      kitchenPin: String(kitchenPin).trim(),
      waiterPin: String(waiterPin).trim(),
    });

    if (!success) {
      return NextResponse.json(
        { error: 'Fehler beim Speichern der PINs.' },
        { status: 500 }
      );
    }

    await logSystemActionSafe(() => ({
      action: 'CONFIG_CHANGED',
      category: 'AUTH',
      actor: 'Setup-Assistent',
      details: 'Initiale Stations-PINs eingerichtet.',
    }));

    return NextResponse.json({
      success: true,
      message: 'Stations-PINs erfolgreich initial eingerichtet.',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
