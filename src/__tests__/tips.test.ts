import { describe, it, expect } from 'vitest';
import { calculateTipDistribution } from '../lib/tips';

describe('Flexible Tip Profiles & Pool Distribution (Cent-hart)', () => {
  it('should allocate 100% of tip to the waiter by default when no profile is provided', () => {
    const result = calculateTipDistribution(500);
    expect(result.totalTipCents).toBe(500);
    expect(result.totalTip).toBe(5.0);
    expect(result.waiterShareCents).toBe(500);
    expect(result.barShareCents).toBe(0);
    expect(result.kitchenShareCents).toBe(0);
    expect(result.serviceShareCents).toBe(0);
    expect(result.poolShareCents).toBe(0);
  });

  it('should allocate 100% of tip to the waiter when profile has waiterPercent: 100', () => {
    const profile = {
      name: 'Standard Bedienung',
      waiterPercent: 100.0,
      barPoolPercent: 0.0,
      kitchenPoolPercent: 0.0,
      servicePoolPercent: 0.0,
    };
    const result = calculateTipDistribution(1250, profile);
    expect(result.totalTipCents).toBe(1250);
    expect(result.waiterShareCents).toBe(1250);
    expect(result.poolShareCents).toBe(0);
  });

  it('should accurately split tip across custom pool percentages', () => {
    const profile = {
      name: 'Gastro Pool Mix',
      waiterPercent: 70.0,
      barPoolPercent: 10.0,
      kitchenPoolPercent: 10.0,
      servicePoolPercent: 10.0,
    };
    const result = calculateTipDistribution(1000, profile);
    expect(result.totalTipCents).toBe(1000);
    expect(result.waiterShareCents).toBe(700);
    expect(result.barShareCents).toBe(100);
    expect(result.kitchenShareCents).toBe(100);
    expect(result.serviceShareCents).toBe(100);
    expect(result.poolShareCents).toBe(300);
  });

  it('should ensure cents sum up exactly to total tip without rounding losses', () => {
    const profile = {
      name: 'Odd Percentages',
      waiterPercent: 60.0,
      barPoolPercent: 15.0,
      kitchenPoolPercent: 15.0,
      servicePoolPercent: 10.0,
    };
    const result = calculateTipDistribution(333, profile);
    expect(result.totalTipCents).toBe(333);
    const sum = result.waiterShareCents + result.barShareCents + result.kitchenShareCents + result.serviceShareCents;
    expect(sum).toBe(333);
  });

  it('should return zeros when tip is 0', () => {
    const result = calculateTipDistribution(0);
    expect(result.totalTipCents).toBe(0);
    expect(result.waiterShareCents).toBe(0);
    expect(result.poolShareCents).toBe(0);
  });
});
