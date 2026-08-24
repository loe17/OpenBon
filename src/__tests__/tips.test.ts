import { describe, it, expect } from 'vitest';
import { calculateTipDistribution } from '../lib/tips';

describe('Flexible Tip Profiles & Pool Distribution (Spec V2 §5.3)', () => {
  it('should allocate 100% of tip to the waiter by default when no profile is provided', () => {
    const result = calculateTipDistribution(5.0);
    expect(result.totalTip).toBe(5.0);
    expect(result.waiterShare).toBe(5.0);
    expect(result.barShare).toBe(0.0);
    expect(result.kitchenShare).toBe(0.0);
    expect(result.serviceShare).toBe(0.0);
    expect(result.poolShare).toBe(0.0);
  });

  it('should allocate 100% of tip to the waiter when profile has waiterPercent: 100', () => {
    const profile = {
      name: 'Standard Bedienung',
      waiterPercent: 100.0,
      barPoolPercent: 0.0,
      kitchenPoolPercent: 0.0,
      servicePoolPercent: 0.0,
    };
    const result = calculateTipDistribution(12.5, profile);
    expect(result.totalTip).toBe(12.5);
    expect(result.waiterShare).toBe(12.5);
    expect(result.poolShare).toBe(0.0);
  });

  it('should accurately split tip across custom pool percentages', () => {
    const profile = {
      name: 'Gastro Pool Mix',
      waiterPercent: 70.0,
      barPoolPercent: 10.0,
      kitchenPoolPercent: 10.0,
      servicePoolPercent: 10.0,
    };
    const result = calculateTipDistribution(10.0, profile);
    expect(result.totalTip).toBe(10.0);
    expect(result.waiterShare).toBe(7.0);
    expect(result.barShare).toBe(1.0);
    expect(result.kitchenShare).toBe(1.0);
    expect(result.serviceShare).toBe(1.0);
    expect(result.poolShare).toBe(3.0);
  });

  it('should ensure cents sum up exactly to total tip without rounding losses', () => {
    const profile = {
      name: 'Odd Percentages',
      waiterPercent: 60.0,
      barPoolPercent: 15.0,
      kitchenPoolPercent: 15.0,
      servicePoolPercent: 10.0,
    };
    // 3.33 € tip
    const result = calculateTipDistribution(3.33, profile);
    expect(result.totalTip).toBe(3.33);
    const sum = result.waiterShare + result.barShare + result.kitchenShare + result.serviceShare;
    expect(Math.round(sum * 100) / 100).toBe(3.33);
  });

  it('should return zeros when tip is 0', () => {
    const result = calculateTipDistribution(0);
    expect(result.totalTip).toBe(0);
    expect(result.waiterShare).toBe(0);
    expect(result.poolShare).toBe(0);
  });
});
