import { NextResponse } from 'next/server';
import { getVerifiedSessionFromRequest } from '@/lib/auth-session';

/**
 * Leichtgewichtige Session-Auskunft für die Stationsoberflächen.
 *
 * Jede Station ruft diesen Endpunkt beim Laden auf und zeigt bei fehlender
 * Session sofort das PIN-Pad an – statt wie bisher stillschweigend leere
 * Listen darzustellen, weil alle Datenabrufe mit 401 zurückkamen.
 *
 * Bewusst öffentlich: Der Endpunkt gibt nur preis, OB eine Session besteht.
 */
export async function GET(req: Request) {
  const session = await getVerifiedSessionFromRequest(req);

  if (!session) {
    return NextResponse.json({ authenticated: false, role: null }, { status: 200 });
  }

  return NextResponse.json({
    authenticated: true,
    role: session.role,
    deviceId: session.deviceId ?? null,
    waiterName: session.waiterName ?? null,
    expiresAt: session.exp ? new Date(session.exp * 1000).toISOString() : null,
  });
}
