import { SignJWT, jwtVerify, decodeJwt } from 'jose';
import type { NextRequest } from 'next/server';

export type UserRole = 'ADMIN' | 'WAITER' | 'POS_CASHIER' | 'KITCHEN';

export interface SessionPayload {
  role: UserRole;
  deviceId?: string;
  waiterName?: string;
  jti?: string;
  iss?: string;
  aud?: string;
  iat?: number;
  exp?: number;
}

/**
 * M2.1 Liefert das JWT-Signatursecret - OHNE oeffentlichen Fallback.
 *
 * Quelle-Reihenfolge:
 *  1. Env-Variablen SESSION_SECRET (vom Startprozess via .env gesetzt)
 *  2. Laufzeit-Secret aus ensureSessionSecret() (globalThis.__OPENBON_JWT_SECRET__)
 *
 * Ist keins vorhanden, wird bewusst eine Ausnahme geworfen:
 *  - verifySessionToken faengt sie ab -> Token werden abgelehnt (fail-closed).
 *  - signSessionToken kann dann keine Session ausstellen statt ein mit einem
 *    oeffentlich bekannten Schlüssel gefaelschbares Token zu erzeugen.
 * Ein vorher hartkodierter Fallback-Key (oefentliche Repo-Konstante) ist
 * abgeschafft - er erlaubte das Faelschen gueltiger Admin-Tokens.
 */
export function getJwtSecretKey(): Uint8Array {
  const envSecret = process.env.SESSION_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    return new TextEncoder().encode(envSecret);
  }

  const runtimeSecret =
    typeof globalThis !== 'undefined'
      ? String((globalThis as any).__OPENBON_JWT_SECRET__ || '').trim()
      : '';
  if (runtimeSecret.length >= 16) {
    return new TextEncoder().encode(runtimeSecret);
  }

  throw new Error(
    '[AUTH] Kein JWT-Session-Secret verfuegbar. Serverstart oder Datenbank pruefen (ensureSessionSecret).'
  );
}

export const SESSION_COOKIE_NAME = '__Host-openbon_session';
export const SESSION_LEGACY_COOKIE_NAME = 'openbon_session';
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 Stunden (gehärtet, vorher 12h)
export const SESSION_ISSUER = 'openbon';
export const SESSION_AUDIENCE = 'station';

function newJti(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const c = require('crypto') as typeof import('crypto');
    return c.randomBytes(12).toString('hex');
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
  }
}

/**
 * Signiert ein Session-Token mit jose (Edge & Node.js kompatibel).
 */
export async function signSessionToken(payload: SessionPayload): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + SESSION_MAX_AGE_SECONDS;

  return new SignJWT({ ...payload, jti: payload.jti || newJti() })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .sign(getJwtSecretKey());
}

/**
 * Verifiziert ein Session-Token und liefert das Payload zurueck.
 * Laeuft NUR im Node-Kontext (API-Routen, Server-Layouts): Hier ist das
 * persistente Secret via globalThis/process.env verfuegbar.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey(), {
      algorithms: ['HS256'],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    });
    const p = payload as unknown as SessionPayload;
    // Revoke-Check (best-effort, DB-Tabelle RevokedSession)
    try {
      const { default: prisma } = await import('./db');
      if (p.jti) {
        const revoked = await prisma.revokedSession.findUnique({ where: { jti: p.jti } }).catch(() => null);
        if (revoked) return null;
      }
    } catch {}
    return p;
  } catch {
    return null;
  }
}

export async function revokeSessionToken(token: string): Promise<boolean> {
  try {
    const { decodeJwt } = await import('jose');
    const p = decodeJwt(token) as unknown as SessionPayload;
    if (!p?.jti || !p?.exp) return false;
    const { default: prisma } = await import('./db');
    await prisma.revokedSession.upsert({
      where: { jti: p.jti },
      update: { expiresAt: new Date(p.exp * 1000) },
      create: { jti: p.jti, expiresAt: new Date(p.exp * 1000) },
    }).catch(() => null);
    return true;
  } catch {
    return false;
  }
}

/**
 * Decodiert ein Session-Token OHNE Signaturpruefung – nur fuer Routing-
 * Entscheidungen in der Edge-Middleware gedacht. Die Edge-Sandbox teilt weder
 * globalThis noch DB-Zugriff mit dem Node-Server und kann daher kein
 * HMAC-Secret kennen; die kryptografische Pruefung erfolgt stattdessen
 * Node-seitig (admin/layout.tsx Gate, API-Routen).
 */
export function decodeSessionToken(token: string): SessionPayload | null {
  try {
    const payload = decodeJwt(token) as unknown as SessionPayload;
    if (!payload || typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extrahiert und validiert die Session aus einem Standard-Request (API-Routen,
 * Node-Kontext) – inklusive vollstaendiger Signaturpruefung mit dem
 * persistenten Secret. Nutzt Cookie UND Bearer-Fallback.
 */
export async function getVerifiedSessionFromRequest(req: Request): Promise<SessionPayload | null> {
  const cookieHeader = req.headers.get('cookie') || '';
  const matchNew = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  const matchLegacy = cookieHeader.match(new RegExp(`${SESSION_LEGACY_COOKIE_NAME}=([^;]+)`));
  const cookieVal = matchNew?.[1] || matchLegacy?.[1];
  if (cookieVal) {
    const session = await verifySessionToken(decodeURIComponent(cookieVal));
    if (session) return session;
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return verifySessionToken(authHeader.substring(7).trim());
  }

  return null;
}

/**
 * Extrahiert und validiert die Session aus einem NextRequest.
 */
export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  // 1. Cookie prüfen
  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookie) {
    const session = await verifySessionToken(cookie);
    if (session) return session;
  }

  // 2. Authorization Header prüfen (Bearer <token>)
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    return verifySessionToken(token);
  }

  return null;
}
