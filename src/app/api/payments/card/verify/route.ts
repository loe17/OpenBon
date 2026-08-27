import { NextResponse } from 'next/server';
import { verifyCardCallback } from '@/lib/payment/callback-signature';

export const dynamic = 'force-dynamic';

/**
 * N2.1 Serverseitige Verifikation einer Karten-App-Rueckkehr.
 * Die Callback-Seite ruft diesen Endpunkt auf, BEVOR sie ein Ergebnis in den
 * SessionStorage schreibt - unbezeichnete oder gefaelschte Rueckspruenge
 * werden nicht mehr als autorisierte Zahlung durchgereicht.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await verifyCardCallback(body);

    if (!result.verified) {
      return NextResponse.json(
        {
          verified: false,
          reason: result.reason,
          error:
            result.reason === 'EXPIRED'
              ? 'Die Rückkehr ist abgelaufen (>30 Min). Bitte Zahlung erneut starten.'
              : result.reason === 'MISSING_PARAMS'
                ? 'Unvollständige Rückkehr - Signaturprüfung unmöglich.'
                : 'Ungültige Server-Signatur der Rückkehr.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ verified: true });
  } catch (error) {
    return NextResponse.json(
      { verified: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
