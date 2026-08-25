import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME, UserRole } from '@/lib/auth-session';

/**
 * Zentrale Autorisierungs-Schranke für OpenBon.
 * Schützt Admin-Oberflächen und schreibende/vertrauliche API-Endpunkte.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Ausnahmen: Statische Ressourcen, Public Config, PIN-Verification, Customer-Display, Manifest, Icons, SW
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth/pin') ||
    pathname.startsWith('/api/config/public') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/customer-display') ||
    pathname === '/favicon.ico' ||
    pathname === '/icon.png' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js'
  ) {
    return NextResponse.next();
  }

  // 2. Session aus Cookie oder Bearer Token prüfen
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

  // 3. Admin Web-Routen (/admin/*)
  if (pathname.startsWith('/admin')) {
    // Wenn keine valide Admin-Session vorhanden ist:
    if (!session || session.role !== 'ADMIN') {
      // Bei HTML-Seitenaufrufen im Browser auf PIN-Eingabe weiterleiten oder zulassen wenn PIN-Modal aktiv
      const url = req.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.set('auth_required', 'admin');
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // 4. Kritische Admin API-Routen
  if (
    pathname.startsWith('/api/system') ||
    pathname.startsWith('/api/backup') ||
    pathname.startsWith('/api/fiscal') ||
    (pathname === '/api/config' && req.method !== 'OPTIONS')
  ) {
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Nicht autorisiert. Administrator-Berechtigung erforderlich.' },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/system/:path*',
    '/api/backup/:path*',
    '/api/fiscal/:path*',
    '/api/config',
    '/api/config/:path*',
  ],
};
