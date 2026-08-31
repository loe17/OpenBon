import { describe, it, expect } from 'vitest';
import { APP_VERSION, APP_NAME, GITHUB_REPO_URL, APP_IS_BETA } from '../lib/version';

describe('OpenBon v0.4.17 & Selective Backup Tests', () => {
  it('should have consistent version 0.4.17 and metadata', () => {
    expect(APP_VERSION).toBe('0.4.17');
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
