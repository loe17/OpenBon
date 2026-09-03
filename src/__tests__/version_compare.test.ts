import { describe, it, expect } from 'vitest';
import { compareSemver } from '../lib/version-compare';

describe('Update-Check: Semver-Vergleich', () => {
  it('erkennt neuere Tags als Update', () => {
    expect(compareSemver('0.4.22', '0.4.17')).toBe(1);
    expect(compareSemver('0.4.17', '0.4.22')).toBe(-1);
    expect(compareSemver('0.4.22', '0.4.22')).toBe(0);
    expect(compareSemver('0.5.0', '0.4.99')).toBe(1);
  });

  it('toleriert v-Prefix', () => {
    expect(compareSemver('v0.4.22', '0.4.17')).toBe(1);
  });
});
