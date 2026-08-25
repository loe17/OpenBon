import { NextResponse } from 'next/server';
import { verifyStationPin, setAdminPin, StationPinType } from '@/lib/auth-pin';
import { checkRateLimit, registerFailedAttempt, resetRateLimit } from '@/lib/rate-limiter';
import {
  signSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  UserRole,
} from '@/lib/auth-session';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, pin, newPin, stationType, deviceId, waiterName } = body;

    // Client-Identifikator für Rate-Limiting ermitteln (nur nach IP und Zielstation, manipulationssicher)
    const clientIp = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'local').split(',')[0].trim();
    const rateLimitKey = `${clientIp}:${stationType || 'ADMIN'}`;

    if (action === 'VERIFY') {
      const targetStation: StationPinType = stationType || 'ADMIN';

      // 1. Rate-Limit prüfen
      const rateCheck = checkRateLimit(rateLimitKey);
      if (!rateCheck.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: `Zu viele Fehlversuche. Bitte warte ${rateCheck.remainingSeconds} Sekunden.`,
            locked: true,
            remainingSeconds: rateCheck.remainingSeconds,
          },
          { status: 429 }
        );
      }

      // 2. PIN prüfen
      const isValid = await verifyStationPin(pin || '', targetStation);
      if (!isValid) {
        const attempt = registerFailedAttempt(rateLimitKey);
        return NextResponse.json(
          {
            success: false,
            error: attempt.locked
              ? `Zu viele Fehlversuche. Gesperrt für ${attempt.remainingSeconds}s.`
              : 'Falscher PIN.',
            locked: attempt.locked,
            remainingSeconds: attempt.remainingSeconds,
          },
          { status: 401 }
        );
      }

      // 3. Erfolgreich -> Rate-Limit zurücksetzen
      resetRateLimit(rateLimitKey);

      // 4. Rolle & Session-Token erstellen
      const role: UserRole =
        targetStation === 'ADMIN'
          ? 'ADMIN'
          : targetStation === 'POS'
          ? 'POS_CASHIER'
          : targetStation === 'KITCHEN'
          ? 'KITCHEN'
          : 'WAITER';

      const token = await signSessionToken({
        role,
        deviceId: deviceId || undefined,
        waiterName: waiterName || undefined,
      });

      const res = NextResponse.json({
        success: true,
        role,
        token,
      });

      // 5. HttpOnly Cookie setzen
      res.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_MAX_AGE_SECONDS,
      });

      return res;
    }

    if (action === 'CHANGE') {
      const changeRateCheck = checkRateLimit(`change:${rateLimitKey}`);
      if (!changeRateCheck.allowed) {
        return NextResponse.json(
          { error: `Zu viele Fehlversuche beim PIN-Ändern. Bitte warte ${changeRateCheck.remainingSeconds} Sekunden.` },
          { status: 429 }
        );
      }

      const isCurrentValid = await verifyStationPin(pin || '', 'ADMIN');
      if (!isCurrentValid) {
        registerFailedAttempt(`change:${rateLimitKey}`);
        return NextResponse.json({ error: 'Aktueller Admin-PIN ist falsch.' }, { status: 403 });
      }
      resetRateLimit(`change:${rateLimitKey}`);

      const changed = await setAdminPin(newPin);
      if (changed) {
        return NextResponse.json({ success: true, message: 'Admin-PIN erfolgreich geändert.' });
      }
      return NextResponse.json({ error: 'PIN muss mindestens 4 Stellen haben.' }, { status: 400 });
    }

    if (action === 'LOGOUT') {
      const res = NextResponse.json({ success: true, message: 'Erfolgreich abgemeldet.' });
      res.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: '',
        httpOnly: true,
        path: '/',
        maxAge: 0,
      });
      return res;
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Interner Authentifizierungsfehler' }, { status: 500 });
  }
}
