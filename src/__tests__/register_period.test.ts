import { describe, it, expect } from 'vitest';
import { signFiscalBlock, verifyFiscalBlock } from '../lib/fiscal';
import { getOrCreateOpenPeriod, computePeriodTotals } from '../lib/register-period';

/** Spec 6.7: Z-Bon speichert die Fiskalblöcke ab */
describe('Fiscal block signature (Spec 6.7)', () => {
  const block = {
    periodNumber: 7,
    closedAt: '2026-08-24T20:00:00.000Z',
    totalGrossCents: 481235,
    totalNetCents: 404399,
    transactionCount: 512,
    previousSignature: null as string | null,
  };

  it('should produce a stable HMAC-SHA256 signature', () => {
    const a = signFiscalBlock(block);
    const b = signFiscalBlock({ ...block });

    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9A-F]{64}$/);
  });

  it('should verify an untampered block', () => {
    const signature = signFiscalBlock(block);
    expect(verifyFiscalBlock(signature, block)).toBe(true);
  });

  it('should detect a manipulated total', () => {
    const signature = signFiscalBlock(block);
    expect(verifyFiscalBlock(signature, { ...block, totalGrossCents: 400000 })).toBe(false);
  });

  it('should detect a manipulated transaction count', () => {
    const signature = signFiscalBlock(block);
    expect(verifyFiscalBlock(signature, { ...block, transactionCount: 511 })).toBe(false);
  });

  it('should chain to the previous period so a deleted Z-Bon is detectable', () => {
    const first = signFiscalBlock(block);
    const second = signFiscalBlock({
      ...block,
      periodNumber: 8,
      previousSignature: first,
    });
    const forged = signFiscalBlock({
      ...block,
      periodNumber: 8,
      previousSignature: null,
    });

    expect(second).not.toBe(forged);
  });

  it('should compute period totals with includeUnassigned flag cleanly without Prisma errors', async () => {
    const period = await getOrCreateOpenPeriod();
    const totals = await computePeriodTotals({
      periodId: period.id,
      includeUnassigned: true,
    });

    expect(totals).toBeDefined();
    expect(typeof totals.totalGrossCents).toBe('number');
    expect(typeof totals.cashExpectedCents).toBe('number');
    expect(Array.isArray(totals.waiters)).toBe(true);
  });
});
