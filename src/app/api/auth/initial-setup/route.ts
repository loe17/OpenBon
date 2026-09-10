import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { setAllStationPins, isWeakPin, hasActiveEventData } from '@/lib/auth-pin';
import { logSystemActionSafe } from '@/lib/action-logger';
import { checkSimpleRateLimit, registerSimpleAttempt, getClientKey } from '@/lib/rate-limiter';
import { ensureSessionSecret } from '@/lib/session-secret';
import {
  signSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_LEGACY_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from '@/lib/auth-session';

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
    const [config, hasActiveData] = await Promise.all([
      prisma.eventConfig.findUnique({ where: { id: 'default' } }),
      hasActiveEventData(),
    ]);

    if (config?.initialPinSet || hasActiveData) {
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

    // Grundkonfiguration der Veranstaltung atomar mitspeichern
    const updateData: Record<string, unknown> = {};
    if (body.eventName || body.name) updateData.name = String(body.eventName || body.name).trim();
    if (body.organizer !== undefined || body.receiptSubHeader !== undefined) {
      updateData.receiptSubHeader = String(body.organizer ?? body.receiptSubHeader ?? '').trim();
    }
    if (typeof body.enableTax === 'boolean') updateData.enableTax = body.enableTax;
    if (typeof body.enableVirtualPrinters === 'boolean') updateData.enableVirtualPrinters = body.enableVirtualPrinters;
    if (typeof body.enableVirtual === 'boolean') updateData.enableVirtualPrinters = body.enableVirtual;
    if (Object.keys(updateData).length > 0) {
      await prisma.eventConfig.update({
        where: { id: 'default' },
        data: updateData,
      }).catch(() => {});
    }

    await logSystemActionSafe(() => ({
      action: 'CONFIG_CHANGED',
      category: 'AUTH',
      actor: 'Setup-Assistent',
      details: 'Initiale Stations-PINs & Veranstaltungsdaten eingerichtet.',
    }));

    // Sofortige Admin-Session ausstellen, damit der Benutzer direkt angemeldet weiterarbeiten kann
    await ensureSessionSecret();
    const token = await signSessionToken({
      role: 'ADMIN',
      waiterName: 'Administrator',
    });

    const isHttps =
      req.headers.get('x-forwarded-proto')?.split(',')[0].trim() === 'https' ||
      new URL(req.url).protocol === 'https:';

    const cookieName = isHttps ? SESSION_COOKIE_NAME : SESSION_LEGACY_COOKIE_NAME;
    const res = NextResponse.json({
      success: true,
      role: 'ADMIN',
      token,
      message: 'Stations-PINs & Veranstaltungsdaten erfolgreich initial eingerichtet.',
    });

    res.cookies.set({
      name: cookieName,
      value: token,
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    res.cookies.set({
      name: isHttps ? SESSION_LEGACY_COOKIE_NAME : SESSION_COOKIE_NAME,
      value: '',
      httpOnly: true,
      path: '/',
      maxAge: 0,
    });

    return res;
  } catch (error) {
    console.error('Initial setup route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
