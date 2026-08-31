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
  const auth = await requireApiAuth(req, ['ADMIN', 'POS_CASHIER', 'WAITER', 'KITCHEN']);
  if (!auth.ok) {
    // Unauthentifizierte Clients (z. B. vor PIN-Eingabe) erhalten neutralen Standalone-Status ohne 401-Konsolenfehler
    const heartbeat = haService.getHeartbeatInfo();
    return NextResponse.json({
      role: heartbeat.role || 'STANDALONE',
      instanceId: heartbeat.instanceId || 'default',
      missedHeartbeats: 0,
      partnerUrl: null,
      secret: { hasSecret: true, isWeak: false, source: 'default', enforceMode: 'OFF' },
      pairingRequired: false,
      enforceBlocked: false,
    });
  }

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
