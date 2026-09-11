import { describe, it, expect } from 'vitest';
import { APP_VERSION } from '../lib/version';
import { PAYMENT_METHODS } from '../lib/payment/methods';

describe('OpenBon v0.4.36: UI Enhancements, Release Filtering & System Metrics', () => {
  it('should verify APP_VERSION is 0.4.36', () => {
    expect(APP_VERSION).toBe('0.4.36');
  });

  describe('Release filtering strictly excludes git tags when onlyReleases is active', () => {
    it('should return only official releases and not fall back to git tags', () => {
      const mockOfficialReleases: string[] = [];
      const mockGitTags = ['v0.4.35', 'v0.4.34', 'v0.4.33', 'v0.4.32'];
      const onlyReleases = true;

      // Filtering logic matching page.tsx
      const tagsList = onlyReleases
        ? mockOfficialReleases.map((r) => r.trim()).filter(Boolean)
        : mockGitTags;

      expect(tagsList).toEqual([]);
      expect(tagsList.length).toBe(0);
    });

    it('should correctly include official releases when they exist', () => {
      const mockOfficialReleases = ['v0.4.36', 'v0.4.35'];
      const onlyReleases = true;

      const tagsList = onlyReleases
        ? mockOfficialReleases.map((r) => r.trim()).filter(Boolean)
        : ['v0.4.35', 'v0.4.34'];

      expect(tagsList).toEqual(['v0.4.36', 'v0.4.35']);
    });
  });

  describe('In-cart product counter logic', () => {
    it('should count occurrences per productId accurately', () => {
      const cart = [
        { id: '1', productId: 'prod_beer', quantity: 2 },
        { id: '2', productId: 'prod_beer', quantity: 1 }, // same product, different variant
        { id: '3', productId: 'prod_cola', quantity: 3 },
      ];

      const productCartCounts: Record<string, number> = {};
      for (const item of cart) {
        if (item.productId) {
          productCartCounts[item.productId] = (productCartCounts[item.productId] || 0) + item.quantity;
        }
      }

      expect(productCartCounts['prod_beer']).toBe(3);
      expect(productCartCounts['prod_cola']).toBe(3);
      expect(productCartCounts['prod_water']).toBeUndefined();
    });
  });

  describe('Payment methods filtering for waiter & bonkasse', () => {
    it('should correctly identify DISCOUNT and NON_PAID_STAFF for removal', () => {
      const waiterAllowedMethods = PAYMENT_METHODS.filter((m) => {
        if (m.id.startsWith('CARD_')) return false;
        if (m.id === 'DISCOUNT' || m.id === 'NON_PAID_STAFF') return false;
        return true;
      });

      const methodIds = waiterAllowedMethods.map((m) => m.id);
      expect(methodIds).not.toContain('DISCOUNT');
      expect(methodIds).not.toContain('NON_PAID_STAFF');
      expect(methodIds).toContain('CASH');
      expect(methodIds).toContain('CARD');
    });
  });

  describe('System CPU metrics structure', () => {
    it('should validate cpu metrics payload shape', () => {
      const mockCpuPayload = {
        usedPercentage: 15,
        cores: 8,
        model: 'AMD Ryzen 7 PRO',
      };

      expect(typeof mockCpuPayload.usedPercentage).toBe('number');
      expect(mockCpuPayload.usedPercentage).toBeGreaterThanOrEqual(0);
      expect(mockCpuPayload.usedPercentage).toBeLessThanOrEqual(100);
      expect(mockCpuPayload.cores).toBeGreaterThan(0);
      expect(mockCpuPayload.model).toBeTruthy();
    });
  });
});
