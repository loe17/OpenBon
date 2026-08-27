import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import { verifyStationPin, setAdminPin, StationPinType } from '@/lib/auth-pin';
import {
  checkRateLimit,
  registerFailedAttempt,
  resetRateLimit,
  checkLayeredRateLimit,
  registerLayeredFailure,
  resetLayeredRateLimit,
} from '@/lib/rate-limiter';
import {
  signSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  UserRole,
} from '@/lib/auth-session';
import { ensureSessionSecret } from '@/lib/session-secret';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, pin, newPin, stationType, deviceId, waiterName } = body;

    // Client-Identifikator für Rate-Limiting ermitteln (nur nach IP und Zielstation, manipulationssicher)
    const clientIp = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'local').split(',')[0].trim();
    const rateLimitKey = `${clientIp}:${stationType || 'ADMIN'}`;

    if (action === 'VERIFY') {
      const targetStation: StationPinType = stationType || 'ADMIN';

      // M2.2 Schicht-Limitierung: IP-Ebene zuerst (bestehendes Verhalten),
      // danach stabile Stationsebene und globaler Instanz-Boden - damit
      // rotierende x-forwarded-for-Werte einen Lockout nicht unwirksam machen.
      const layeredCheck = checkLayeredRateLimit(rateLimitKey, targetStation);
      if (!layeredCheck.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: `Zu viele Fehlversuche. Bitte warte ${layeredCheck.remainingSeconds} Sekunden.`,
            locked: true,
            remainingSeconds: layeredCheck.remainingSeconds,
          },
          { status: 429 }
        );
      }

      // 1. IP-Rate-Limit bleibt erste Defensive (wie bisher)
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
        const attempt = registerLayeredFailure(rateLimitKey, targetStation);
        // Fehlversuche gehoeren ins Protokoll - sonst faellt ein Durchprobieren
        // des PINs niemandem auf. M2.4: Der Actor ist die Station selbst - der
        // vom Client angegebene Name ist VOR der Anmeldung nicht vertrauenswuerdig
        // und wird nur noch als Metadatum protokolliert.
        await logSystemActionSafe(() => ({
          action: 'LOGIN_FAILED',
          category: 'AUTH',
          actor: `Station ${targetStation}`,
          details: `Fehlgeschlagene Anmeldung an Station ${targetStation}${attempt.locked ? ` (gesperrt, Ebene ${attempt.layer})` : ''} (angegebener Name: "${waiterName || '-'}", Gerät: ${deviceId || '-'}).`,
          metadata: {
            station: targetStation,
            claimedWaiterName: waiterName || null,
            deviceId,
            locked: attempt.locked,
            layer: attempt.layer,
          },
        }));
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

      // 3. Erfolgreich -> Rate-Limit zuruecksetzen (alle Ebenen des Vorgangs)
      resetRateLimit(rateLimitKey);
      resetLayeredRateLimit(rateLimitKey, targetStation);

      // 4. Rolle & Session-Token erstellen
      const role: UserRole =
        targetStation === 'ADMIN'
          ? 'ADMIN'
          : targetStation === 'POS'
          ? 'POS_CASHIER'
          : targetStation === 'KITCHEN'
          ? 'KITCHEN'
          : 'WAITER';

      // M2.1: Vor der Signierung sicherstellen, dass ein persistiertes
      // Session-Secret existiert (Selbstheilung nach Ausfall zum Boot-Zeitpunkt).
      await ensureSessionSecret();

      const token = await signSessionToken({
        role,
        deviceId: deviceId || undefined,
        waiterName: waiterName || undefined,
      });

      await logSystemActionSafe(() => ({
        action: 'LOGIN_SUCCESS',
        category: 'AUTH',
        // M2.4: Station statt Client-Angabe als Actor
        actor: `Station ${targetStation}`,
        details: `Anmeldung an Station ${targetStation} als ${role}${waiterName ? ` (angegebener Name: "${waiterName}")` : ''}.`,
        metadata: {
          station: targetStation,
          role,
          deviceId,
          claimedWaiterName: waiterName || null,
        },
      }));

      const res = NextResponse.json({
        success: true,
        role,
        token,
      });

      // 5. HttpOnly Cookie setzen.
      //    Secure-Flag NUR bei tatsaechlichem HTTPS: OpenBon laeuft im Standard
      //    ueber http://openbon.local bzw. LAN-IP – mit Secure wuerde der
      //    Browser das Session-Cookie verwerfen und jede Anmeldung waere sofort
      //    wieder verloren (Redirect zum Startbildschirm).
      const isHttps =
        req.headers.get('x-forwarded-proto')?.split(',')[0].trim() === 'https' ||
        new URL(req.url).protocol === 'https:';

      res.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: token,
        httpOnly: true,
        secure: isHttps,
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
        await logSystemActionSafe(() => ({
          action: 'ADMIN_PIN_CHANGED',
          category: 'AUTH',
          actor: 'Administrator',
          details: 'Der Administrator-PIN wurde geändert.',
        }));
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
