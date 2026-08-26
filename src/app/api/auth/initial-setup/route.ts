import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { setAllStationPins } from '@/lib/auth-pin';
import { logSystemActionSafe } from '@/lib/action-logger';

export async function POST(req: Request) {
  try {
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
      return NextResponse.json(
        { error: 'Alle 4 Stations-PINs (Admin, POS, Küche, Bedienung) müssen angegeben werden.' },
        { status: 400 }
      );
    }

    if (
      String(adminPin).trim().length < 4 ||
      String(posPin).trim().length < 4 ||
      String(kitchenPin).trim().length < 4 ||
      String(waiterPin).trim().length < 4
    ) {
      return NextResponse.json(
        { error: 'Jede PIN muss mindestens 4 Ziffern lang sein.' },
        { status: 400 }
      );
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
