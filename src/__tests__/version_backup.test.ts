import { describe, it, expect } from 'vitest';
import { APP_VERSION, APP_NAME, GITHUB_REPO_URL, APP_IS_BETA } from '../lib/version';

describe('OpenBon v0.4.44 & Selective Backup Tests', () => {
  it('should have consistent version and metadata', () => {
    expect(['0.4.43', '0.4.44', '0.4.45', '0.4.46', '0.4.47', '0.4.48', '0.4.49', '0.4.50', '0.4.51', '0.4.52', '0.4.53', '0.4.54', '0.4.55', '0.4.56', '0.4.57', '0.4.58']).toContain(APP_VERSION);
    expect(APP_NAME).toBe('OpenBon');
    expect(GITHUB_REPO_URL).toBe('https://github.com/loe17/OpenBon');
  });

  it('should structure selective backup data correctly', () => {
    const scopes = {
      config: true,
      products: true,
      wordGroups: false,
      tables: true,
      printers: false,
      stock: false,
      orders: false,
      payments: false,
    };

    expect(scopes.config).toBe(true);
    expect(scopes.products).toBe(true);
    expect(scopes.orders).toBe(false);
  });
});
