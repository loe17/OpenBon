import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME, UserRole } from '@/lib/auth-session';

// Öffentliche Pfade, die ohne Authentifizierung erreichbar sein müssen
const PUBLIC_PATHS = [
  '/_next',
  '/api/auth/pin',
  '/api/config/public',
  '/api/devices',
  '/api/health',
  '/api/metrics',
  '/api/receipt',
  '/api/guest/orders',
  '/api/sync/heartbeat',
  '/customer-display',
  '/receipt',
  '/guest',
  '/favicon.ico',
  '/icon.png',
  '/manifest.json',
  '/sw.js',
];

// Reiner Admin-Bereich (erfordert session.role === 'ADMIN')
const ADMIN_API_PREFIXES = [
  '/api/system',
  '/api/backup',
  '/api/fiscal',
  '/api/config',
  '/api/profiles',
  '/api/products/csv',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Öffentliche Pfade und statische Dateien direkt durchlassen
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 2. Session aus Cookie oder Bearer Header verifizieren
  let session = null;
  const cookieVal = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookieVal) {
    session = await verifySessionToken(cookieVal);
  }

  if (!session) {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      session = await verifySessionToken(authHeader.substring(7).trim());
    }
  }

  // 3. Admin Web-Oberfläche (/admin/*)
  if (pathname.startsWith('/admin')) {
    if (!session || session.role !== 'ADMIN') {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.set('auth_required', 'admin');
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // 4. Admin API-Endpunkte
  if (ADMIN_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Nicht autorisiert. Administrator-Berechtigung erforderlich.' },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // 5. Alle weiteren API-Endpunkte erfordern eine gültige Session (auch GET für Payments, Orders, Reports, Logs)
  if (pathname.startsWith('/api/')) {
    if (req.method !== 'OPTIONS') {
      if (!session) {
        return NextResponse.json(
          { error: 'Authentifizierung erforderlich. Bitte an der Kassenstation mit PIN anmelden.' },
          { status: 401 }
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/:path*',
  ],
};
