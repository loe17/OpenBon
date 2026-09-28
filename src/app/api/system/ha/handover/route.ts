import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import haService from '@/lib/ha/ha-service';
import { verifyHaSecret } from '@/lib/ha/ha-secret';
import { requireApiAuth } from '@/lib/api-guard';

export const dynamic = 'force-dynamic';

/**
 * POST /api/system/ha/handover
 *
 * Geordneter 2-Phasen-Handshake für das automatische Failback:
 * Wenn der wiederkehrende Hauptrechner (PRIMARY) vollständig synchron ist,
 * fordert er den temporär eingesprungenen Ersatzrechner auf, die Führung
 * geordnet abzugeben.
 *
 * Ablauf:
 * 1. Authentifizierung via HA-Sync-Secret (oder Admin-Session)
 * 2. Kurze Drain-Pause (200ms), damit laufende Buchungen noch die DB erreichen
 * 3. Ermittlung der allerletzten SyncJournal-Sequenznummer
 * 4. Geordneter Rücktritt auf STANDBY (Freigabe der PRIMARY-Lease)
 * 5. Benachrichtigung aller verbundenen Stationen via WebSocket
 */
export async function POST(req: Request) {
  // 1. Authentifizierung: HA-Sync-Secret oder Administrator
  const isSecretValid = await verifyHaSecret(req);
  if (!isSecretValid) {
    const auth = await requireApiAuth(req, ['ADMIN']);
    if (!auth.ok) {
      return NextResponse.json(
        { error: 'Ungültiges HA-Sync-Secret oder fehlende Admin-Berechtigung' },
        { status: 401 }
      );
    }
  }

  try {
    // 2. Drain-Phase: 200ms warten, damit zeitgleiche Buchungen im Flug sauber abschließen
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 3. Letzte Sequenznummer ermitteln
    const lastEntry = await prisma.syncJournal.findFirst({
      orderBy: { id: 'desc' },
    });
    const lastSequence = lastEntry ? lastEntry.id : 0;

    // 4. Geordnet auf STANDBY zurücktreten
    const success = await haService.demoteToStandby();
    if (!success) {
      return NextResponse.json(
        { error: 'Rücktritt auf STANDBY konnte nicht ausgeführt werden' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Übergabe erfolgreich: Ersatzrechner ist nun wieder STANDBY.',
      lastSequence,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Fehler beim Ausführen der Kassenübergabe' },
      { status: 500 }
    );
  }
}
