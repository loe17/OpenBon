import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import { requireApiAuth } from '@/lib/api-guard';
import { requireAdmin } from '@/lib/admin-guard';
import { verifyAdminPin } from '@/lib/auth-pin';
import {
  initiatePairing,
  finalizePairing,
} from '@/lib/ha/ha-pairing';
import {
  setHaSyncSecret,
  getHaSyncSecret,
  getConfiguredPartnerUrl,
} from '@/lib/ha/ha-secret';

export const dynamic = 'force-dynamic';

/** Zentrale PIN- und Session-Schranke fuer jeden Pairing-Schritt (N1: manuelle Bestaetigung). */
async function authorizePairingStep(
  req: Request,
  pin: unknown
): Promise<{ ok: true; actor: string } | { ok: false; response: NextResponse }> {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return { ok: false, response: auth.response };

  const denied = await requireAdmin(req);
  if (denied) return { ok: false, response: denied };

  // N1 User-Entscheidung: Kritische Betriebsaktion verlangt die Admin-PIN erneut.
  if (!(await verifyAdminPin(String(pin ?? '')))) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Falscher Admin-PIN.' }, { status: 403 }),
    };
  }

  return { ok: true, actor: auth.session.waiterName || auth.session.role || 'Admin' };
}

function isValidPeerUrl(raw: string): boolean {
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * N1 HA-Pairing-Assistent - Aktionen (alles ADMIN + PIN):
 *  INITIATE        am initiierenden Knoten (erzeugt Code + Secret intern)
 *  APPLY_FROM_PEER am zweiten Knoten (holt Secret vom Initiator über
 *                  /api/system/ha/pull - den klassischen Sync-Kanal)
 *  FINALIZE        wieder am Initiator (wendet das vorgehaltene Secret an)
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || '').toUpperCase();

  const authorization = await authorizePairingStep(req, body.pin);
  if (!authorization.ok) return authorization.response;
  const actor = authorization.actor;

  try {
    if (action === 'INITIATE') {
      const pending = initiatePairing();
      await logSystemActionSafe(() => ({
        action: 'HA_PAIRING_INITIATED',
        category: 'SYSTEM',
        actor,
        details: `HA-Pairing gestartet. Bestaetigungscode aktiv bis ${new Date(pending.expiresAt).toLocaleTimeString('de-DE')}.`,
        metadata: { pairId: pending.pairId },
      }));
      return NextResponse.json({
        pairId: pending.pairId,
        code: pending.code,
        expiresAt: pending.expiresAt,
        peerUrlHint: await getConfiguredPartnerUrl(),
      });
    }

    if (action === 'APPLY_FROM_PEER') {
      const code = String(body.code || '');
      const peerUrl = String(body.peerUrl || '').trim().replace(/\/+$/, '');

      if (!isValidPeerUrl(peerUrl)) {
        return NextResponse.json(
          { error: 'Ungültige Peer-URL (erwartet http(s)://host[:port]).' },
          { status: 400 }
        );
      }

      // Bestehender Bootstrap-Kanal: eigenes aktuelles Secret als Header.
      const localSecret = await getHaSyncSecret();
      const res = await fetch(`${peerUrl}/api/system/ha/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-HA-Secret': localSecret,
        },
        body: JSON.stringify({ action: 'PULL', code }),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return NextResponse.json(
          {
            error: `Partner antwortete ${res.status}. Code/TTL prüfen oder den Initiator-Knoten direkt erreichen.${
              text ? ` (${text.slice(0, 160)})` : ''
            }`,
          },
          { status: 502 }
        );
      }

      const data = (await res.json()) as { secret?: string };
      const secret = typeof data.secret === 'string' ? data.secret : '';
      if (!secret) {
        return NextResponse.json({ error: 'Partner lieferte kein gültiges Secret.' }, { status: 502 });
      }

      await setHaSyncSecret(secret);

      await logSystemActionSafe(() => ({
        action: 'HA_PAIRING_APPLIED',
        category: 'SYSTEM',
        actor,
        details: `Neues HA-Sync-Secret von ${peerUrl} übernommen (dieser Knoten).`,
        metadata: { peerUrl },
      }));

      return NextResponse.json({
        success: true,
        message:
          'Diesen Knoten gepaart. Öffne nun beim Initiator die HA-Seite und schließe das Pairing dort mit "Übernehmen" ab.',
      });
    }

    if (action === 'FINALIZE') {
      const pairId = String(body.pairId || '');
      const result = finalizePairing(pairId);
      if (!result.ok) {
        return NextResponse.json(
          { error: 'Kein laufendes Pairing gefunden (bereits abgeschlossen oder abgelaufen).' },
          { status: 404 }
        );
      }

      await setHaSyncSecret(result.secret);

      // Direkte Validierung gegen den Partner mit dem NEUEN Secret.
      let partnerValidated: boolean | null = null;
      try {
        const partnerUrl = await getConfiguredPartnerUrl();
        if (partnerUrl) {
          const probe = await fetch(`${partnerUrl.replace(/\/+$/, '')}/api/sync/heartbeat`, {
            headers: { 'X-HA-Secret': result.secret },
            signal: AbortSignal.timeout(5000),
          });
          partnerValidated = probe.ok;
        }
      } catch {
        partnerValidated = false;
      }

      await logSystemActionSafe(() => ({
        action: 'HA_SECRET_FINALIZED',
        category: 'SYSTEM',
        actor,
        details:
          'HA-Pairing abgeschlossen (Initiator). Neues Sync-Secret aktiv.' +
          (partnerValidated === null
            ? ' Kein Partner konfiguriert.'
            : partnerValidated
              ? ' Heartbeat-Validierung erfolgreich.'
              : ' Heartbeat-Validierung fehlgeschlagen - bitte Preflight prüfen.'),
        metadata: { pairId },
      }));

      return NextResponse.json({
        success: true,
        message:
          'Pairing abgeschlossen. Beide Knoten nutzen jetzt ein starkes Sync-Secret.' +
          (partnerValidated === null
            ? ''
            : partnerValidated
              ? ' Heartbeat-Validierung erfolgreich.'
              : ' Warnung: Gegenprobe zum Partner schlug fehl - bitte Preflight öffnen.'),
        partnerValidated,
      });
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (error) {
    console.error('[HA] Pairing-Fehler:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
