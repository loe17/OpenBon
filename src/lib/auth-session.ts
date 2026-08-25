import { SignJWT, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';

export type UserRole = 'ADMIN' | 'WAITER' | 'POS_CASHIER' | 'KITCHEN';

export interface SessionPayload {
  role: UserRole;
  deviceId?: string;
  waiterName?: string;
  iat?: number;
  exp?: number;
}

let runtimeSecret: string | null = null;

export function getJwtSecretKey(): Uint8Array {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16) {
    return new TextEncoder().encode(process.env.SESSION_SECRET.trim());
  }

  if (!runtimeSecret) {
    if (typeof globalThis !== 'undefined' && (globalThis as any).__OPENBON_JWT_SECRET__) {
      runtimeSecret = (globalThis as any).__OPENBON_JWT_SECRET__;
    } else {
      // Kryptografisch sicheres 256-Bit Secret generieren
      const array = new Uint8Array(32);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(array);
      } else {
        for (let i = 0; i < 32; i++) array[i] = Math.floor(Math.random() * 256);
      }
      runtimeSecret = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
      if (typeof globalThis !== 'undefined') {
        (globalThis as any).__OPENBON_JWT_SECRET__ = runtimeSecret;
      }
    }
  }

  return new TextEncoder().encode(runtimeSecret!);
}

export const SESSION_COOKIE_NAME = 'openbon_session';
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60; // 12 Stunden

/**
 * Signiert ein Session-Token mit jose (Edge & Node.js kompatibel).
 */
export async function signSessionToken(payload: SessionPayload): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + SESSION_MAX_AGE_SECONDS;

  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(getJwtSecretKey());
}

/**
 * Verifiziert ein Session-Token und liefert das Payload zurueck.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey(), {
      algorithms: ['HS256'],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
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
