import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { APP_VERSION } from '../lib/version';
import fs from 'fs';
import path from 'path';
import {
  scheduleDelayedPrint,
  cancelDelayedPrint,
  isDelayedPrintPending,
  clearAllDelayedPrintTimers,
} from '../lib/order-delay-manager';
import {
  ALLOWED_CONFIG_FIELDS,
  CONFIG_BOOLEAN_FIELDS,
  CONFIG_NUMERIC_FIELDS,
  sanitizeConfigInput,
} from '../lib/config-whitelist';

describe('OpenBon v0.4.38: Order Print Delay, Storno Countdown & POS Polish', () => {
  beforeEach(() => {
    clearAllDelayedPrintTimers();
  });

  afterEach(() => {
    clearAllDelayedPrintTimers();
    vi.restoreAllMocks();
  });

  it('should verify APP_VERSION is 0.4.38 or higher', () => {
    expect(['0.4.38', '0.4.39', '0.4.40', '0.4.41']).toContain(APP_VERSION);
  });

  describe('Order Delay Manager', () => {
    it('should schedule and cancel delayed print timers correctly', () => {
      const orderId = 'test-order-123';

      expect(isDelayedPrintPending(orderId)).toBe(false);

      scheduleDelayedPrint(orderId, 60);
      expect(isDelayedPrintPending(orderId)).toBe(true);

      const cancelled = cancelDelayedPrint(orderId);
      expect(cancelled).toBe(true);
      expect(isDelayedPrintPending(orderId)).toBe(false);

      const cancelledAgain = cancelDelayedPrint(orderId);
      expect(cancelledAgain).toBe(false);
    });

    it('should clear all timers on reset', () => {
      scheduleDelayedPrint('order-1', 60);
      scheduleDelayedPrint('order-2', 60);
      expect(isDelayedPrintPending('order-1')).toBe(true);
      expect(isDelayedPrintPending('order-2')).toBe(true);

      clearAllDelayedPrintTimers();
      expect(isDelayedPrintPending('order-1')).toBe(false);
      expect(isDelayedPrintPending('order-2')).toBe(false);
    });
  });

  describe('Configuration Whitelist & Sanitize', () => {
    it('should include order print delay fields in whitelist and sets', () => {
      expect(ALLOWED_CONFIG_FIELDS).toContain('enableOrderPrintDelay');
      expect(ALLOWED_CONFIG_FIELDS).toContain('orderPrintDelaySeconds');
      expect(CONFIG_BOOLEAN_FIELDS.has('enableOrderPrintDelay')).toBe(true);
      expect(CONFIG_NUMERIC_FIELDS.has('orderPrintDelaySeconds')).toBe(true);
    });

    it('should properly sanitize and coerce order delay input', () => {
      const sanitized = sanitizeConfigInput({
        enableOrderPrintDelay: 'true',
        orderPrintDelaySeconds: '90',
        unauthorizedField: 'malicious',
      });

      expect(sanitized.enableOrderPrintDelay).toBe(true);
      expect(sanitized.orderPrintDelaySeconds).toBe(90);
      expect((sanitized as any).unauthorizedField).toBeUndefined();
    });
  });

  describe('Waiter Payment View Polish', () => {
    it('should show top rounding bar ONLY in stage CASH and not in stage METHOD', () => {
      const filePath = path.join(process.cwd(), 'src', 'app', 'waiter', 'payment', 'page.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain("stage === 'CASH' && (");
      expect(content).not.toContain("(stage === 'METHOD' || stage === 'CASH')");
    });

    it('should not contain Betragssplit card in payment view', () => {
      const filePath = path.join(process.cwd(), 'src', 'app', 'waiter', 'payment', 'page.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).not.toContain('Betragssplit („50 € jetzt, Rest später“)');
      expect(content).not.toContain('id="split-amount"');
    });
  });

  describe('Order History Modal Polish', () => {
    it('should remove redundant blue bubble when tableLabel is present', () => {
      const filePath = path.join(process.cwd(), 'src', 'components', 'waiter', 'waiter-order-history-modal.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      // The redundant table bubble rendered "{tableLabel ? `Tisch ${tableLabel}` : ...}"
      expect(content).not.toContain('{tableLabel ? `Tisch ${tableLabel}`');
      expect(content).toContain('{!tableLabel && (');
    });
  });

  describe('Table Action Grid in Waiter View', () => {
    it('should replace X-Bon Schicht with Bestellverlauf and remove row 4 button', () => {
      const filePath = path.join(process.cwd(), 'src', 'app', 'waiter', 'page.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).not.toContain('X-Bon Schicht</span>');
      expect(content).not.toContain('Bestellverlauf an {selectedTable.label}');
      expect(content).toContain('<span>Bestellverlauf</span>');
      expect(content).toContain('Storno (${activeDelayedOrder.remainingSeconds}s)');
    });
  });

  describe('Allergen Filter & Product Card Counter Badge Polish', () => {
    it('should remove allergen filter from waiter order and pos pages', () => {
      const waiterOrderPath = path.join(process.cwd(), 'src', 'app', 'waiter', 'order', 'page.tsx');
      const waiterContent = fs.readFileSync(waiterOrderPath, 'utf-8');
      expect(waiterContent).not.toContain('<span>Allergene {selectedAllergens');

      const posPath = path.join(process.cwd(), 'src', 'app', 'pos', 'page.tsx');
      const posContent = fs.readFileSync(posPath, 'utf-8');
      expect(posContent).not.toContain('<span>Allergene {selectedAllergens');
    });

    it('should place counter badge in bottom right corner and support long press for product info', () => {
      const waiterOrderPath = path.join(process.cwd(), 'src', 'app', 'waiter', 'order', 'page.tsx');
      const waiterContent = fs.readFileSync(waiterOrderPath, 'utf-8');
      expect(waiterContent).toContain('handlePointerDown');
      expect(waiterContent).toContain('bottom-2 right-2');

      const posPath = path.join(process.cwd(), 'src', 'app', 'pos', 'page.tsx');
      const posContent = fs.readFileSync(posPath, 'utf-8');
      expect(posContent).toContain('handlePointerDown');
      expect(posContent).toContain('{inCartCount}x');
    });

    it('should put (x Pos.) on a second line under Tischbestellung in drawer', () => {
      const waiterOrderPath = path.join(process.cwd(), 'src', 'app', 'waiter', 'order', 'page.tsx');
      const content = fs.readFileSync(waiterOrderPath, 'utf-8');
      expect(content.replace(/\r\n/g, '\n')).toContain('Tischbestellung\n                </span>');
      expect(content).toContain('({totalItemCount} Pos.) · Summe:');
    });
  });

  describe('System Update Rate-Limit Gracefulness', () => {
    it('should not mark update check as incomplete when GitHub rate limit 403 occurs with successful git check', () => {
      const filePath = path.join(process.cwd(), 'src', 'app', 'api', 'system', 'update', 'route.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('isRateLimited');
      expect(content).toContain('Online-Prüfung pausiert kurz wegen GitHub-Limit');
    });
  });
});
