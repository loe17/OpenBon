import { describe, it, expect } from 'vitest';
import { checkSimpleRateLimit, registerSimpleAttempt } from '../lib/rate-limiter';
import { generateDigitalReceiptCode } from '../lib/digital-receipt';

describe('v0.4.20 Audit-Fixes', () => {
  it('registerSimpleAttempt respektiert windowMs (Stunden-Fenster)', () => {
    const key = `w-${Date.now()}-${Math.random()}`;
    const HOUR = 60 * 60 * 1000;
    expect(checkSimpleRateLimit(key, 1, HOUR, 60000).allowed).toBe(true);
    registerSimpleAttempt(key, HOUR);
    // Zähler steht auf 1, Limit 1 -> blockiert (nicht nach 60s resettet)
    expect(checkSimpleRateLimit(key, 1, HOUR, 60000).allowed).toBe(false);
  });

  it('E-Bon wirft ohne Secret (kein Public-Fallback), Test-Secret ok', async () => {
    const old = process.env.LICENSE_HMAC_SECRET;
    const oldVitest = process.env.VITEST;
    delete process.env.LICENSE_HMAC_SECRET;
    const envRec = process.env as Record<string, string | undefined>;
    const oldNodeEnv = envRec.NODE_ENV;
    delete envRec.VITEST;
    envRec.NODE_ENV = 'production';
    expect(() => generateDigitalReceiptCode('X-1')).toThrow();
    process.env.VITEST = 'true';
    const c1 = generateDigitalReceiptCode('X-1');
    const c2 = generateDigitalReceiptCode('X-1');
    expect(c1).toMatch(/^EBON-/);
    expect(c1).not.toBe(c2);
    if (old !== undefined) process.env.LICENSE_HMAC_SECRET = old;
    if (oldVitest !== undefined) process.env.VITEST = oldVitest;
    if (oldNodeEnv !== undefined) envRec.NODE_ENV = oldNodeEnv;
  });
});
