import { NextResponse } from 'next/server';
import { getVerifiedSessionFromRequest, SessionPayload, UserRole } from './auth-session';
import { hasRequiredRole } from './rbac';

/**
 * Zentrale Autorisierung für API-Routen mit VOLLSTÄNDIGER Signaturprüfung.
 *
 * Hintergrund: Die Edge-Middleware kann das in der Datenbank hinterlegte
 * Session-Secret nicht lesen und dekodiert das Token deshalb nur (Struktur +
 * Ablaufzeit). Ein selbst gebautes, unsigniertes Token käme dort durch.
 * Die kryptografische Prüfung MUSS daher hier, im Node-Kontext, stattfinden.
 *
 * Verwendung am Anfang jedes Handlers:
 *
 *   const auth = await requireApiAuth(req, ['ADMIN']);
 *   if (!auth.ok) return auth.response;
 *   // ab hier ist auth.session garantiert echt
 */
export type ApiAuthResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; response: NextResponse };

export async function requireApiAuth(
  req: Request,
  allowedRoles?: UserRole[]
): Promise<ApiAuthResult> {
  const session = await getVerifiedSessionFromRequest(req);

  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Nicht angemeldet. Bitte an dieser Station mit PIN anmelden.',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      ),
    };
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasRequiredRole(session.role, allowedRoles)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `Diese Aktion erfordert die Rolle ${allowedRoles.join(' oder ')}. Angemeldet als ${session.role}.`,
          code: 'FORBIDDEN',
        },
        { status: 403 }
      ),
    };
  }

  return { ok: true, session };
}

/** Kurzform für reine Admin-Endpunkte. */
export function requireAdmin(req: Request): Promise<ApiAuthResult> {
  return requireApiAuth(req, ['ADMIN']);
}

/** Kurzform für Endpunkte, die jede angemeldete Station nutzen darf. */
export function requireStation(req: Request): Promise<ApiAuthResult> {
  return requireApiAuth(req);
}
