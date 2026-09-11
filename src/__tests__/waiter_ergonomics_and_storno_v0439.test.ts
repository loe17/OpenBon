import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ALLOWED_CONFIG_FIELDS, CONFIG_BOOLEAN_FIELDS } from '../lib/config-whitelist';

describe('Waiter Ergonomics, Drawer, and Storno Fixes (v0.4.39)', () => {
  describe('Removal of Gast-Sicht Option', () => {
    it('should remove enableGuestFacingDisplay from config whitelist', () => {
      expect(ALLOWED_CONFIG_FIELDS).not.toContain('enableGuestFacingDisplay');
      expect(CONFIG_BOOLEAN_FIELDS.has('enableGuestFacingDisplay')).toBe(false);
    });

    it('should not contain Gast-Sicht toggle in GeneralTab.tsx', () => {
      const generalTabPath = path.join(process.cwd(), 'src', 'app', 'admin', 'settings', 'tabs', 'GeneralTab.tsx');
      const content = fs.readFileSync(generalTabPath, 'utf-8');
      expect(content).not.toContain('Gast-Sicht beim Kassieren');
      expect(content).not.toContain('enableGuestFacingDisplay');
    });

    it('should not contain guest-facing display banner in waiter payment page', () => {
      const paymentPath = path.join(process.cwd(), 'src', 'app', 'waiter', 'payment', 'page.tsx');
      const content = fs.readFileSync(paymentPath, 'utf-8');
      expect(content).not.toContain('guestFacingAllowed');
      expect(content).not.toContain('guestFacingMode');
      expect(content).not.toContain('FÜR DEN GAST • ZU ZAHLENDER BETRAG');
    });
  });

  describe('Product Card Layout & Long-Press', () => {
    it('should allow full width for product name and have long-press support in waiter order page', () => {
      const waiterOrderPath = path.join(process.cwd(), 'src', 'app', 'waiter', 'order', 'page.tsx');
      const content = fs.readFileSync(waiterOrderPath, 'utf-8');
      expect(content).toContain('handlePointerDown');
      expect(content).toContain('handlePointerMove');
      expect(content).toContain('handlePointerUp');
      expect(content).toContain('setSelectedProductInfo(product)');
      expect(content).toContain('break-words');
      expect(content).toContain('bottom-2 right-2');
    });

    it('should have long-press support and bottom-right counter in pos page', () => {
      const posPath = path.join(process.cwd(), 'src', 'app', 'pos', 'page.tsx');
      const content = fs.readFileSync(posPath, 'utf-8');
      expect(content).toContain('handlePointerDown');
      expect(content).toContain('setSelectedProductInfo(prod)');
      expect(content).toContain('break-words');
      expect(content).toContain('{inCartCount}x');
    });
  });

  describe('Drawer Header & Sticky Checkout Button', () => {
    it('should have icon-only buttons in drawer header (trash in middle, large chevron on right)', () => {
      const waiterOrderPath = path.join(process.cwd(), 'src', 'app', 'waiter', 'order', 'page.tsx');
      const content = fs.readFileSync(waiterOrderPath, 'utf-8');
      // No "Einklappen" or "Leeren" text in header buttons
      expect(content).not.toContain('<span>Einklappen</span>');
      expect(content).not.toContain('<span>Leeren</span>');
      // Contains Trash2 in middle and large ChevronDown on right
      expect(content).toContain('title="Bestellung leeren"');
      expect(content).toContain('w-12 h-12 rounded-2xl');
      expect(content).toContain('ChevronDown className="w-7 h-7"');
    });

    it('should have a permanently sticky checkout button and scrollable item list', () => {
      const waiterOrderPath = path.join(process.cwd(), 'src', 'app', 'waiter', 'order', 'page.tsx');
      const content = fs.readFileSync(waiterOrderPath, 'utf-8');
      expect(content).toContain('sticky bottom-0 z-10');
      expect(content).toContain('Bestellen & Kassieren');
      expect(content).toContain('overflow-y-auto overscroll-contain');
    });
  });

  describe('Storno & Table Orders Fresh Fetching', () => {
    it('should declare force-dynamic and no-store headers on api/tables and api/orders', () => {
      const tablesPath = path.join(process.cwd(), 'src', 'app', 'api', 'tables', 'route.ts');
      const tablesContent = fs.readFileSync(tablesPath, 'utf-8');
      expect(tablesContent).toContain("export const dynamic = 'force-dynamic'");
      expect(tablesContent).toContain('no-store, no-cache');

      const ordersPath = path.join(process.cwd(), 'src', 'app', 'api', 'orders', 'route.ts');
      const ordersContent = fs.readFileSync(ordersPath, 'utf-8');
      expect(ordersContent).toContain("export const dynamic = 'force-dynamic'");
      expect(ordersContent).toContain('no-store, no-cache');
    });

    it('should fetch fresh table orders when selectedTable changes in waiter page', () => {
      const waiterPath = path.join(process.cwd(), 'src', 'app', 'waiter', 'page.tsx');
      const content = fs.readFileSync(waiterPath, 'utf-8');
      expect(content).toContain('/api/orders?tableId=${selectedTable.id}');
      expect(content).toContain('serverTimeOffset');
      expect(content).toContain("socket.on('order:delayed'");
    });
  });
});
