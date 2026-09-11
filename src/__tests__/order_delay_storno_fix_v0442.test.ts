import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { APP_VERSION } from '../lib/version';
import fs from 'fs';
import path from 'path';
import {
  scheduleDelayedPrint,
  cancelDelayedPrint,
  isDelayedPrintPending,
  clearAllDelayedPrintTimers,
  getOrderDelayInfo,
} from '../lib/order-delay-manager';

describe('OpenBon v0.4.42: Order Delay & Storno Countdown Resilience', () => {
  beforeEach(() => {
    clearAllDelayedPrintTimers();
  });

  afterEach(() => {
    clearAllDelayedPrintTimers();
    vi.restoreAllMocks();
  });

  it('should verify APP_VERSION is 0.4.42', () => {
    expect(APP_VERSION).toBe('0.4.42');
  });

  describe('getOrderDelayInfo calculation', () => {
    it('should return isDelayed false if delaySeconds is 0 or disabled', () => {
      const order = { id: 'ord-1', createdAt: new Date().toISOString(), status: 'OPEN' };
      const info = getOrderDelayInfo(order, 0);
      expect(info.isDelayed).toBe(false);
      expect(info.delayRemainingSeconds).toBe(0);
    });

    it('should return isDelayed false if order is already CANCELLED or COMPLETED', () => {
      const order = { id: 'ord-2', createdAt: new Date().toISOString(), status: 'CANCELLED' };
      scheduleDelayedPrint('ord-2', 60);
      const info = getOrderDelayInfo(order, 60);
      expect(info.isDelayed).toBe(false);
      expect(info.delayRemainingSeconds).toBe(0);
    });

    it('should accurately calculate remaining seconds based on server now', () => {
      const serverNow = 1700000060000;
      const orderCreatedAt = new Date(1700000040000); // 20s ago
      const order = { id: 'ord-3', createdAt: orderCreatedAt, status: 'OPEN' };

      scheduleDelayedPrint('ord-3', 60);
      const info = getOrderDelayInfo(order, 60, serverNow);
      expect(info.isDelayed).toBe(true);
      expect(info.delayRemainingSeconds).toBe(40); // 60s - 20s = 40s remaining
    });

    it('should return isDelayed false when age exceeds delaySeconds', () => {
      const serverNow = 1700000100000;
      const orderCreatedAt = new Date(1700000000000); // 100s ago
      const order = { id: 'ord-4', createdAt: orderCreatedAt, status: 'OPEN' };

      // No timer pending, 100s > 60s
      const info = getOrderDelayInfo(order, 60, serverNow);
      expect(info.isDelayed).toBe(false);
      expect(info.delayRemainingSeconds).toBe(0);
    });
  });

  describe('API Routes Integration', () => {
    it('should enrich orders with isDelayed and delayRemainingSeconds in /api/tables and /api/orders', () => {
      const tablesRoute = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'api', 'tables', 'route.ts'),
        'utf-8'
      );
      expect(tablesRoute).toContain('getOrderDelayInfo');
      expect(tablesRoute).toContain('delayRemainingSeconds: delayInfo.delayRemainingSeconds');

      const ordersRoute = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'api', 'orders', 'route.ts'),
        'utf-8'
      );
      expect(ordersRoute).toContain('getOrderDelayInfo');
      expect(ordersRoute).toContain('delayRemainingSeconds: delayInfo.delayRemainingSeconds');
    });

    it('should check isDelayedPrintPending in /api/orders/[id]/void route', () => {
      const voidRoute = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'api', 'orders', '[id]', 'void', 'route.ts'),
        'utf-8'
      );
      expect(voidRoute).toContain('isDelayedPrintPending');
      expect(voidRoute).toContain('isDelayedPrintPending(order.id)');
    });
  });

  describe('Waiter UI Logic', () => {
    it('should keep previous logic: disabled when !isStornoEnabled and show countdown when active', () => {
      const waiterPage = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'waiter', 'page.tsx'),
        'utf-8'
      );
      expect(waiterPage).toContain('disabled={busyAction !== null || !isStornoEnabled}');
      expect(waiterPage).toContain('if (isStornoEnabled) {');
      expect(waiterPage).toContain('active = delayedOrders');
    });

  });
});
