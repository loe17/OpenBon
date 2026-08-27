import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import {
  checkPairingCode,
  getPendingPairingByCode,
} from '@/lib/ha/ha-pairing';
import { verifyHaSecret } from '@/lib/ha/ha-secret';

export const dynamic = 'force-dynamic';

/**
 * N1 Server-zu-Server-Schritt des Pairings: Der zweite Knoten holt sich hier
 * das neue Sync-Secret vom Initiator.
 *
 * DOPPELTE Absicherung statt Middleware-Admin-Gate (dieser Aufruf kommt vom
 * Partnerknoten und trägt keine Admin-Session):
 *   1. X-HA-Secret == aktuelles (klassisches/klassifiziertes) Sync-Kanal-Secret
 *      -> beweistMembership im bestehenden Primary<->Standby-Vertrauen.
 *   2. Zeitlich befristeter 6-stelliger Manual-Code (TTL 10 min, max. 5 Versuche,
 *      timing-safe), der der Admin am Initiator vorgehalten hat.
 *
 * Die Route ist deshalb in der Middleware explizit als PUBLIC_PATHS-Ausnahme
 * eingetragen - die interne Prüfung oben ist die eigentliche Schranke.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const code = String(body.code || '');

    if (!(await verifyHaSecret(req))) {
      return NextResponse.json({ error: 'Ungültiges Sync-Secret für den Paarungs-Abruf.' }, { status: 401 });
    }

    const codeCheck = checkPairingCode(code);
    if (!codeCheck.ok) {
      const messages: Record<string, string> = {
        NOT_FOUND: 'Kein laufendes Pairing gefunden.',
        EXPIRED: 'Der Bestätigungscode ist abgelaufen. Bitte neu starten.',
        MAX_ATTEMPTS: 'Zu viele Fehlversuche - Pairing verworfen. Bitte neu starten.',
        WRONG_CODE:
          codeCheck.remainingAttempts !== undefined
            ? `Falscher Code. Noch ${codeCheck.remainingAttempts} Versuche.`
            : 'Falscher Code.',
      };
      return NextResponse.json(
        { error: messages[codeCheck.error ?? 'WRONG_CODE'] ?? 'Codeprüfung fehlgeschlagen.' },
        { status: codeCheck.error === 'MAX_ATTEMPTS' ? 429 : 400 }
      );
    }

    const pending = getPendingPairingByCode(code);
    if (!pending) {
      return NextResponse.json({ error: 'Kein laufendes Pairing gefunden.' }, { status: 404 });
    }

    await logSystemActionSafe(() => ({
      action: 'HA_PAIRING_PULL',
      category: 'SYSTEM',
      actor: 'Partner-Knoten',
      details: 'Zweiter Knoten hat das neue HA-Sync-Secret über den klassischen Kanal abgerufen.',
      metadata: { pairId: pending.pairId },
    }));

    return NextResponse.json({ secret: pending.secret });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
