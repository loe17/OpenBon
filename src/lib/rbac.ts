import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, SessionPayload, UserRole } from './auth-session';

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  ADMIN: ['*'],
  POS_CASHIER: [
    'orders:create',
    'orders:read',
    'payments:create',
    'payments:read',
    'products:read',
    'categories:read',
    'tokens:manage',
    'cashbook:read',
  ],
  WAITER: [
    'orders:create',
    'orders:read',
    'payments:create',
    'payments:read',
    'tables:manage',
    'products:read',
    'categories:read',
  ],
  KITCHEN: [
    'orders:read',
    'kitchen:status_update',
  ],
};

/**
 * Prüft, ob eine Rolle in den erlaubten Rollen enthalten ist (ADMIN darf immer alles).
 */
export function hasRequiredRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  if (userRole === 'ADMIN') return true;
  return allowedRoles.includes(userRole);
}

/**
 * Zentrale Autorisierungsprüfung für API-Routen (Defense-in-Depth).
 */
export async function requireAuth(
  req: NextRequest,
  allowedRoles?: UserRole[]
): Promise<{ authorized: true; session: SessionPayload } | { authorized: false; response: NextResponse }> {
  const session = await getSessionFromRequest(req);

  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Nicht autorisiert. Bitte mit gültiger PIN anmelden.', code: 'UNAUTHORIZED' },
        { status: 401 }
      ),
    };
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasRequiredRole(session.role, allowedRoles)) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: `Unzureichende Berechtigung. Erforderliche Rolle: ${allowedRoles.join(', ')} (Ihre Rolle: ${session.role})`,
          code: 'FORBIDDEN',
        },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, session };
}
