import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-guard';
import { requireAdmin } from '@/lib/admin-guard';
import haService from '@/lib/ha/ha-service';
import { getHaSecretStatus } from '@/lib/ha/ha-secret';

export const dynamic = 'force-dynamic';

/**
 * N1 Status des Hochverfuegbarkeits-Verbunds fuer Diagnose & HA-Assistent.
 * Antwort enthaelt bewusst KEINE Geheimnisse (nur Booleans/Fingerprint-Ebene).
 */
export async function GET(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const secretStatus = await getHaSecretStatus();
    const heartbeat = haService.getHeartbeatInfo();

    return NextResponse.json({
      role: heartbeat.role,
      instanceId: heartbeat.instanceId,
      missedHeartbeats: heartbeat.missedHeartbeats,
      partnerUrl: heartbeat.partnerUrl || null,
      secret: {
        hasSecret: secretStatus.hasSecret,
        isWeak: secretStatus.isWeak,
        source: secretStatus.source,
        enforceMode: secretStatus.enforceMode,
      },
      // Klartext-Ampel fuer das UI/Banner
      pairingRequired: Boolean(secretStatus.partnerConfigured && (secretStatus.isWeak || !secretStatus.hasSecret)),
      enforceBlocked: Boolean(secretStatus.isWeak && secretStatus.enforceMode && secretStatus.partnerConfigured),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
