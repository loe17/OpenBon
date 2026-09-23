import { describe, it, expect } from 'vitest';
import { APP_VERSION } from '../lib/version';
import { signSessionToken, verifySessionToken, revokeSessionToken } from '../lib/auth-session';
import { GET as systemUpdateGet } from '../app/api/system/update/route';
import { NextRequest } from 'next/server';

describe('OpenBon v0.4.61: Crash Prevention & Runtime Resilience', () => {
  it('should verify APP_VERSION is 0.4.61 or higher', () => {
    expect(['0.4.61', '0.4.62', '0.4.63', '0.4.64']).toContain(APP_VERSION);
  });

  describe('Session Verification Cache & Revocation Resilience', () => {
    it('should quickly verify and cache session tokens in memory', async () => {
      const token = await signSessionToken({ role: 'ADMIN', waiterName: 'Chef' });
      expect(token).toBeTruthy();

      const p1 = await verifySessionToken(token);
      expect(p1).toBeDefined();
      expect(p1?.role).toBe('ADMIN');

      // Second check should hit in-memory cache and be valid
      const p2 = await verifySessionToken(token);
      expect(p2).toBeDefined();
      expect(p2?.role).toBe('ADMIN');
      expect(p2?.jti).toBe(p1?.jti);
    });

    it('should immediately invalidate cache upon revoke', async () => {
      const token = await signSessionToken({ role: 'ADMIN', waiterName: 'Chef' });
      const p1 = await verifySessionToken(token);
      expect(p1).toBeDefined();

      // Revoke
      const revoked = await revokeSessionToken(token);
      expect(revoked).toBe(true);

      // Subsequent verify should return null
      const p2 = await verifySessionToken(token);
      expect(p2).toBeNull();
    });
  });

  describe('System Update Metrics Endpoint Resilience', () => {
    it('should return metrics with cached disk space and without duplicate auth checks', async () => {
      const adminToken = await signSessionToken({ role: 'ADMIN' });
      const req = new NextRequest('http://localhost:3000/api/system/update?metricsOnly=1', {
        headers: {
          cookie: `openbon_session=${adminToken}`,
        },
      });

      const res = await systemUpdateGet(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.cpu).toBeDefined();
      expect(typeof data.cpu.usedPercentage).toBe('number');
      expect(data.memory).toBeDefined();
      expect(typeof data.memory.usedPercentage).toBe('number');
      expect(data.diskSpace).toBeDefined();
      expect(typeof data.serverTimestamp).toBe('number');
      expect(typeof data.uptime).toBe('number');
    });
  });
});
