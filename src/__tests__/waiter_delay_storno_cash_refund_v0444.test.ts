import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  scheduleDelayedPrint,
  clearAllDelayedPrintTimers,
  getOrderDelayInfo,
} from '../lib/order-delay-manager';
import { getPaymentLabel } from '../lib/payment/methods';

describe('OpenBon v0.4.44: Waiter Order Delay Storno & Cash Refund Logic', () => {
  beforeEach(() => {
    clearAllDelayedPrintTimers();
  });

  afterEach(() => {
    clearAllDelayedPrintTimers();
    vi.restoreAllMocks();
  });

  describe('getOrderDelayInfo calculation with COMPLETED status', () => {
    it('should allow isDelayed true for COMPLETED orders within the delay window', () => {
      const serverNow = 1700000030000;
      const orderCreatedAt = new Date(1700000010000); // 20s ago
      const order = { id: 'ord-completed', createdAt: orderCreatedAt, status: 'COMPLETED' };

      scheduleDelayedPrint('ord-completed', 60);
      const info = getOrderDelayInfo(order, 60, serverNow);
      expect(info.isDelayed).toBe(true);
      expect(info.delayRemainingSeconds).toBe(40);
    });

    it('should return isDelayed false for CANCELLED orders even if within delay window', () => {
      const serverNow = 1700000030000;
      const orderCreatedAt = new Date(1700000010000);
      const order = { id: 'ord-cancelled', createdAt: orderCreatedAt, status: 'CANCELLED' };

      scheduleDelayedPrint('ord-cancelled', 60);
      const info = getOrderDelayInfo(order, 60, serverNow);
      expect(info.isDelayed).toBe(false);
      expect(info.delayRemainingSeconds).toBe(0);
    });

    it('should return isDelayed false when age exceeds delaySeconds even if COMPLETED', () => {
      const serverNow = 1700000100000;
      const orderCreatedAt = new Date(1700000000000); // 100s ago
      const order = { id: 'ord-completed-old', createdAt: orderCreatedAt, status: 'COMPLETED' };

      const info = getOrderDelayInfo(order, 60, serverNow);
      expect(info.isDelayed).toBe(false);
      expect(info.delayRemainingSeconds).toBe(0);
    });
  });

  describe('Payment method labels', () => {
    it('should recognize CASH_REFUND as Bar-Erstattung (Storno)', () => {
      expect(getPaymentLabel('CASH_REFUND')).toBe('Bar-Erstattung (Storno)');
    });
  });

  describe('API Routes Integration', () => {
    it('should fetch COMPLETED orders within delay window in /api/tables', () => {
      const tablesRoute = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'api', 'tables', 'route.ts'),
        'utf-8'
      );
      expect(tablesRoute).toContain("status: 'COMPLETED', createdAt: { gte: delayCutoff }");
      expect(tablesRoute).toContain('getOrderDelayInfo');
    });

    it('should create CASH_REFUND payment and refund records in /api/orders/[id]/void', () => {
      const voidRoute = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'api', 'orders', '[id]', 'void', 'route.ts'),
        'utf-8'
      );
      expect(voidRoute).toContain("paymentMethod: 'CASH_REFUND'");
      expect(voidRoute).toContain('isRefund: true');
      expect(voidRoute).toContain('totalGrossCents: -refundGrossCents');
      expect(voidRoute).toContain("global.io.emit('payment:refunded'");
    });

    it('should deduct CASH_REFUND and refunds from cashGross in /api/waiters/settle/report', () => {
      const reportRoute = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'api', 'waiters', 'settle', 'report', 'route.ts'),
        'utf-8'
      );
      expect(reportRoute).toContain("method === 'CASH_REFUND' || (p as any).isRefund");
    });
  });

  describe('Waiter UI Experience', () => {
    it('should show cash refund prompt and Banknote icon when paid items are selected', () => {
      const waiterPage = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'waiter', 'page.tsx'),
        'utf-8'
      );
      expect(waiterPage).toContain('Banknote');
      expect(waiterPage).toContain('Bar an den Gast auszahlen:');
      expect(waiterPage).toContain('Stornieren &');
      expect(waiterPage).toContain('auszahlen');
      expect(waiterPage).toContain('Bitte');
      expect(waiterPage).toContain('in bar an den Gast auszahlen');
    });

    it('should keep single Bestellen & Kassieren button in waiter/order and NOT have separate Nur Bestellen', () => {
      const waiterOrderPage = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'waiter', 'order', 'page.tsx'),
        'utf-8'
      );
      expect(waiterOrderPage).toContain('Bestellen & Kassieren');
      expect(waiterOrderPage).not.toContain('Nur Bestellen');
    });

    it('should NOT offer Storno on payment done screen (only on table tap in table plan)', () => {
      const waiterPaymentPage = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'waiter', 'payment', 'page.tsx'),
        'utf-8'
      );
      expect(waiterPaymentPage).not.toContain('openVoidModal');
    });
  });
});
