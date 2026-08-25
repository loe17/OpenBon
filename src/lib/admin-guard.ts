import { NextResponse } from 'next/server';
import { getVerifiedSessionFromRequest } from './auth-session';

/**
 * Node-seitiger Admin-Schutz fuer sensible API-Routen.
 * Die Edge-Middleware kann JWTs nur decodieren (kein DB-/Secret-Zugriff);
 * diese Pruefung erfolgt mit vollstaendiger Signaturverifikation.
 *
 * Gibt null zurueck, wenn der Zugriff erlaubt ist, sonst eine 401-Antwort.
 */
export async function requireAdmin(req: Request): Promise<NextResponse | null> {
  const session = await getVerifiedSessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Nicht autorisiert. Administrator-Berechtigung erforderlich.' },
      { status: 401 }
    );
  }
  return null;
}

/**
 * Wie requireAdmin, aber mit beliebiger gültiger Session (alle Rollen).
 */
export async function requireSession(req: Request): Promise<NextResponse | null> {
  const session = await getVerifiedSessionFromRequest(req);
  if (!session) {
    return NextResponse.json(
      { error: 'Authentifizierung erforderlich. Bitte an der Kassenstation mit PIN anmelden.' },
      { status: 401 }
    );
  }
  return null;
}
