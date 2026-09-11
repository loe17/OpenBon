import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Order Resilience, Multi-Order Payment & Cleanup (v0.4.40)', () => {
  describe('Multi-Order Payable Items Extraction', () => {
    // Replicate pure extraction logic from waiter/payment/page.tsx
    function extractPayableItems(orders: any[]) {
      const result: any[] = [];
      for (const order of orders) {
        if (!order.items) continue;
        for (const item of order.items) {
          if (item.isCancelled) continue;
          const unpaid = (item.quantity || 0) - (item.paidQuantity || 0);
          if (unpaid > 0) {
            const uPrice = item.unitPriceCents !== undefined && item.unitPriceCents !== null
              ? Number(item.unitPriceCents) / 100
              : Number(item.unitPrice || 0);
            const dep = item.depositCents !== undefined && item.depositCents !== null
              ? Number(item.depositCents) / 100
              : Number(item.deposit || 0);
            result.push({
              orderItemId: item.id,
              productName: item.productName || item.name || 'Artikel',
              variantName: item.variantName || item.variant?.name || null,
              unitPrice: uPrice,
              deposit: dep,
              taxRate: Number(item.taxRate || 19),
              totalUnpaidQty: unpaid,
              selectedQty: 0,
            });
          }
        }
      }
      return result;
    }

    it('should correctly extract open items from multiple orders on the same table', () => {
      const orders = [
        {
          id: 'order-1',
          status: 'OPEN',
          items: [
            {
              id: 'item-1',
              productName: 'Pils 0.5l',
              quantity: 2,
              paidQuantity: 1, // 1 remaining unpaid
              unitPriceCents: 450,
              depositCents: 50,
              isCancelled: false,
            },
            {
              id: 'item-2',
              productName: 'Cola 0.33l',
              quantity: 1,
              paidQuantity: 1, // fully paid
              unitPriceCents: 300,
              depositCents: 0,
              isCancelled: false,
            },
          ],
        },
        {
          id: 'order-2',
          status: 'OPEN',
          items: [
            {
              id: 'item-3',
              productName: 'Schnitzel Wiener Art',
              quantity: 2,
              paidQuantity: 0, // 2 unpaid
              unitPriceCents: 1450,
              depositCents: 0,
              isCancelled: false,
            },
            {
              id: 'item-4',
              productName: 'Salatbeilage',
              quantity: 1,
              paidQuantity: 0,
              unitPriceCents: 400,
              depositCents: 0,
              isCancelled: true, // cancelled, must be ignored
            },
          ],
        },
      ];

      const payables = extractPayableItems(orders);
      expect(payables).toHaveLength(2);

      // First payable item: Pils (1 remaining)
      expect(payables[0].productName).toBe('Pils 0.5l');
      expect(payables[0].totalUnpaidQty).toBe(1);
      expect(payables[0].unitPrice).toBe(4.5);
      expect(payables[0].deposit).toBe(0.5);

      // Second payable item: Schnitzel (2 remaining)
      expect(payables[1].productName).toBe('Schnitzel Wiener Art');
      expect(payables[1].totalUnpaidQty).toBe(2);
      expect(payables[1].unitPrice).toBe(14.5);
    });
  });

  describe('API Order Route Resilience', () => {
    it('should include safe fallback without fragile printer joins in GET /api/orders', () => {
      const routePath = path.join(process.cwd(), 'src', 'app', 'api', 'orders', 'route.ts');
      const content = fs.readFileSync(routePath, 'utf-8');

      // Fragile printGroup.printer join removed from GET handler
      expect(content).not.toContain('printGroup: {\n                  include: { printer: true },\n                }');
      // Fallback query present
      expect(content).toContain('catch (primaryErr)');
      expect(content).toContain('table: true');
      expect(content).toContain('items: true');
    });
  });

  describe('Waiter Payment and Table Fallback', () => {
    it('should fall back to table.orders in fetchTableOrders when /api/orders fails', () => {
      const paymentPath = path.join(process.cwd(), 'src', 'app', 'waiter', 'payment', 'page.tsx');
      const content = fs.readFileSync(paymentPath, 'utf-8');

      expect(content).toContain('if (table?.orders && Array.isArray(table.orders))');
      expect(content).toContain('extractPayableItems(openOrders)');
      expect(content).toContain('setItems(payables)');
    });

    it('should fall back to table.orders in openVoidModal when /api/orders fails', () => {
      const waiterPath = path.join(process.cwd(), 'src', 'app', 'waiter', 'page.tsx');
      const content = fs.readFileSync(waiterPath, 'utf-8');

      expect(content).toContain('if (orders.length === 0 && table.orders && Array.isArray(table.orders))');
      expect(content).toContain('setTableOrders(active)');
      // Storno button remains standard click without long-press
      expect(content).toContain('onClick={() => void openVoidModal(selectedTable)}');
    });
  });

  describe('Tactile Long-Press Adjustments', () => {
    it('should use 750ms long-press delay for product info in waiter order page', () => {
      const waiterOrderPath = path.join(process.cwd(), 'src', 'app', 'waiter', 'order', 'page.tsx');
      const content = fs.readFileSync(waiterOrderPath, 'utf-8');

      expect(content).toContain('}, 750);');
      expect(content).not.toContain('}, 500);');
    });

    it('should use 750ms long-press delay for product info in pos page', () => {
      const posPath = path.join(process.cwd(), 'src', 'app', 'pos', 'page.tsx');
      const content = fs.readFileSync(posPath, 'utf-8');

      expect(content).toContain('}, 750);');
      expect(content).not.toContain('}, 500);');
    });
  });

  describe('Dead Code Cleanup', () => {
    it('should have removed dead allergen filter states from waiter/order/page.tsx', () => {
      const waiterOrderPath = path.join(process.cwd(), 'src', 'app', 'waiter', 'order', 'page.tsx');
      const content = fs.readFileSync(waiterOrderPath, 'utf-8');

      expect(content).not.toContain('selectedAllergens');
      expect(content).not.toContain('showAllergenFilter');
      expect(content).not.toContain('filterProductsByExcludedAllergens');
    });

    it('should have removed dead allergen filter states from pos/page.tsx', () => {
      const posPath = path.join(process.cwd(), 'src', 'app', 'pos', 'page.tsx');
      const content = fs.readFileSync(posPath, 'utf-8');

      expect(content).not.toContain('selectedAllergens');
      expect(content).not.toContain('showAllergenFilter');
      expect(content).not.toContain('filterProductsByExcludedAllergens');
    });

    it('should have removed dead icon imports Eye and RotateCcw from waiter/payment/page.tsx', () => {
      const paymentPath = path.join(process.cwd(), 'src', 'app', 'waiter', 'payment', 'page.tsx');
      const content = fs.readFileSync(paymentPath, 'utf-8');

      expect(content).not.toContain('Eye,');
      expect(content).not.toContain('RotateCcw,');
    });
  });
});
