import { describe, it, expect } from 'vitest';
import { HighAvailabilityService } from '../lib/ha/ha-service';

describe('High Availability & Replikation Engine', () => {
  it('should initialize with default PRIMARY role', () => {
    const ha = new HighAvailabilityService();
    expect(ha.getRole()).toBe('PRIMARY');
  });

  it('should allow role switching', () => {
    const ha = new HighAvailabilityService();
    ha.setRole('STANDBY');
    expect(ha.getRole()).toBe('STANDBY');

    ha.setRole('PRIMARY');
    expect(ha.getRole()).toBe('PRIMARY');
  });
});
