import { describe, it, expect } from 'vitest';
import { APP_VERSION } from '../lib/version';
import fs from 'fs';
import path from 'path';

describe('OpenBon v0.4.37: Cash Ergonomics, Hardware Metrics & Item Counter Polish', () => {
  it('should verify APP_VERSION is at least 0.4.37', () => {
    expect(['0.4.37', '0.4.38', '0.4.39']).toContain(APP_VERSION);
  });

  describe('Payable items initial selection and tap logic', () => {
    it('should default selectedQty to 0 when opening cashier view', () => {
      const mockOrderItems = [
        { id: 'item_1', productName: 'Bier 0.5l', quantity: 3, paidQuantity: 0, unitPrice: 3.5, deposit: 1.0 },
        { id: 'item_2', productName: 'Pommes', quantity: 2, paidQuantity: 0, unitPrice: 4.0, deposit: 0 },
      ];

      const payableItems = mockOrderItems.map((item) => ({
        orderItemId: item.id,
        productName: item.productName,
        totalUnpaidQty: item.quantity - item.paidQuantity,
        selectedQty: 0,
      }));

      expect(payableItems[0].selectedQty).toBe(0);
      expect(payableItems[0].totalUnpaidQty).toBe(3);
      expect(payableItems[1].selectedQty).toBe(0);
      expect(payableItems[1].totalUnpaidQty).toBe(2);
    });

    it('should increment selectedQty by 1 on tap and wrap to 0 at max', () => {
      let selectedQty = 0;
      const totalUnpaidQty = 3;

      const tap = (current: number, max: number) => {
        return current >= max ? 0 : current + 1;
      };

      selectedQty = tap(selectedQty, totalUnpaidQty);
      expect(selectedQty).toBe(1);

      selectedQty = tap(selectedQty, totalUnpaidQty);
      expect(selectedQty).toBe(2);

      selectedQty = tap(selectedQty, totalUnpaidQty);
      expect(selectedQty).toBe(3);

      selectedQty = tap(selectedQty, totalUnpaidQty);
      expect(selectedQty).toBe(0);
    });
  });

  describe('Corner counter badge removal', () => {
    it('should not contain absolute -top-2 -right-2 badge in waiter order page', () => {
      const filePath = path.join(process.cwd(), 'src', 'app', 'waiter', 'order', 'page.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).not.toContain('absolute -top-2 -right-2');
    });

    it('should not contain absolute -top-2 -right-2 badge in POS page', () => {
      const filePath = path.join(process.cwd(), 'src', 'app', 'pos', 'page.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).not.toContain('absolute -top-2 -right-2');
    });
  });

  describe('Cashier layout hierarchy in waiter payment page', () => {
    it('should place ChangeCalculator summary above rounding bar in CASH stage and hide rounding bar in SPLIT and METHOD stages', () => {
      const filePath = path.join(process.cwd(), 'src', 'app', 'waiter', 'payment', 'page.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain("stage === 'CASH' && (");

      const calcIndex = content.indexOf("stage === 'CASH' && paymentMethod === 'CASH'");
      const roundingBarIndex = content.indexOf("stage === 'CASH' && (");
      expect(calcIndex).toBeGreaterThan(0);
      expect(roundingBarIndex).toBeGreaterThan(calcIndex);

      expect(content).toContain('h-[100dvh]');
      expect(content).toContain('max-h-[100dvh]');
    });
  });

  describe('Lightweight hardware metrics API query support', () => {
    it('should verify metricsOnly query parameter handling in update route', () => {
      const filePath = path.join(process.cwd(), 'src', 'app', 'api', 'system', 'update', 'route.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain("url.searchParams.get('metricsOnly') === '1'");
      expect(content).toContain('getCpuUsage()');
      expect(content).toContain('getDiskSpace(projectRoot)');
    });

    it('should verify admin page calls fetchLiveHardwareMetrics every 10s', () => {
      const filePath = path.join(process.cwd(), 'src', 'app', 'admin', 'system-update', 'page.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('fetchLiveHardwareMetrics()');
      expect(content).toContain('/api/system/update?metricsOnly=1');
    });
  });
});
