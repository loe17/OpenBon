import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  decodeSessionToken,
  verifySessionToken,
  SESSION_COOKIE_NAME,
  UserRole,
} from '@/lib/auth-session';

// Öffentliche Pfade, die ohne Authentifizierung erreichbar sein müssen
const PUBLIC_PATHS = [
  '/_next',
  '/api/auth/pin',
  '/api/auth/session',
  '/api/config/public',
  '/api/devices',
  '/api/health',
  // '/api/metrics' ist bewusst NICHT oeffentlich: die Antwort enthaelt den
  // Tagesumsatz. Der Endpunkt verlangt eine Administrator-Session.
  '/api/receipt',
  '/api/guest/orders',
  '/api/sync', // HA-Sync (Heartbeat + Pull) – eigener Schutz über Shared Secret (X-HA-Secret)
  // N1 Pairing-Abruf: Server-zu-Server vom Partnerknoten (keine Admin-Session
  // moeglich). Interne Doppelabsicherung: Shared Secret + 6-stelliger Code.
  '/api/system/ha/pull',
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

/**
 * M2.3 Zusätzlich erlaubte Origins für mutierende Requests (CSRF-Schutz).
 * Standard ist same-origin (gegenüber dem angefragten Host). Hier können
 * z. B. ein umgekehrter Proxy oder Kiosk-Klienten freigegeben werden.
 */
function getTrustedOrigins(): string[] {
  const raw = process.env.TRUSTED_ORIGINS || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * M2.3 Prueft bei schreibenden Anfragen, dass Origin/Referer zum Host passen.
 * Clients ohne Origin-Header (curl, Server-zu-Server, Payment-Apps) bleiben
 * erlaubt - geschuetzt werden Browser-Kontexte mit fremder Herkunft.
 */
function checkCsrfOrigin(req: NextRequest): NextResponse | null {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return null;
  }

  const originHeader = req.headers.get('origin');
  const referer = req.headers.get('referer');
  if (!originHeader && !referer) {
    return null; // Nicht-Browser-Kontext -> Node-seitige Guards greifen weiterhin
  }

  const requestHost = req.headers.get('host');
  let sourceHost = '';
  try {
    const sourceUrl = new URL(originHeader || referer || '');
    sourceHost = sourceUrl.host;
  } catch {
    return null; // Unparsbarer Header - kein belastbarer Verdacht
  }

  if (!requestHost) {
    return null;
  }

  const sameHost = sourceHost === requestHost;
  const trusted = getTrustedOrigins().includes(sourceHost);

  if (!sameHost && !trusted) {
    console.warn(
      `[MIDDLEWARE] Mutierender Request von fremdem Origin abgelehnt: ${sourceHost} -> ${requestHost} ${req.nextUrl.pathname}`
    );
    return NextResponse.json(
      { error: 'Anfrage wurde wegen fremden Ursprungs (CSRF-Schutz) abgelehnt.' },
      { status: 403 }
    );
  }

  return null;
}

/** M2.3 Basissicherheitseigenschaften auf jeder Antwort ergänzen (rein additive Headers). */
function withSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Öffentliche Pfade und statische Dateien direkt durchlassen
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return withSecurityHeaders(NextResponse.next());
  }

  // M2.3 CSRF-Origin-Pruefung fuer alle nicht-oeffentlichen Endpunkte
  const csrfRejection = checkCsrfOrigin(req);
  if (csrfRejection) {
    return csrfRejection;
  }

  // 2. Session aus Cookie oder Bearer Header pruefen.
  //    Liegt SESSION_SECRET als echte Umgebungsvariable vor (wird beim ersten
  //    Start in die .env geschrieben), prueft die Middleware die Signatur voll.
  //    Falls kein Secret bekannt ist (Degradationsfenster, z. B. fehlgeschlagene
  //    Erst-Initialisierung), faellt die Middleware auf das reine Dekodieren als
  //    Vorfilter zurueck. Die verbindliche Signaturpruefung findet dann wie immer
  //    node-seitig in jeder API-Route ueber requireApiAuth() bzw. im
  //    Admin-Layout statt (siehe src/app/admin/layout.tsx).
  const secretKnown = (() => {
    const envSecret = process.env.SESSION_SECRET?.trim();
    if (envSecret && envSecret.length >= 16) return true;
    try {
      const runtimeSecret = String((globalThis as any).__OPENBON_JWT_SECRET__ || '').trim();
      return runtimeSecret.length >= 16;
    } catch {
      return false;
    }
  })();

  const readToken = async (token: string) =>
    secretKnown ? await verifySessionToken(token) : decodeSessionToken(token);

  let session = null;
  const cookieVal = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookieVal) {
    session = await readToken(cookieVal);
  }

  if (!session) {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      session = await readToken(authHeader.substring(7).trim());
    }
  }

  // 3. Admin Web-Oberfläche (/admin/*)
  if (pathname.startsWith('/admin')) {
    if (!session || session.role !== 'ADMIN') {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.set('auth_required', 'admin');
      url.searchParams.set('returnTo', pathname);
      return withSecurityHeaders(NextResponse.redirect(url));
    }
    return withSecurityHeaders(NextResponse.next());
  }

  // 4. Admin API-Endpunkte
  if (ADMIN_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Nicht autorisiert. Administrator-Berechtigung erforderlich.' },
        { status: 401 }
      );
    }
    return withSecurityHeaders(NextResponse.next());
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

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/:path*',
  ],
};
