import { describe, it, expect } from 'vitest';
import { signFiscalBlock, verifyFiscalBlock } from '../lib/fiscal';

/** Spec 6.7: Z-Bon speichert die Fiskalblöcke ab */
describe('Fiscal block signature (Spec 6.7)', () => {
  const block = {
    periodNumber: 7,
    closedAt: '2026-08-24T20:00:00.000Z',
    totalGross: 4812.35,
    totalNet: 4043.99,
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
    expect(verifyFiscalBlock(signature, { ...block, totalGross: 4000.0 })).toBe(false);
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

  it('should treat the first period as GENESIS', () => {
    const explicitNull = signFiscalBlock({ ...block, previousSignature: null });
    const undefinedPrev = signFiscalBlock({ ...block, previousSignature: undefined });
    expect(explicitNull).toBe(undefinedPrev);
  });
});
