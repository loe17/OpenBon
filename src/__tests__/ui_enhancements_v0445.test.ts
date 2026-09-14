import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { HANDBOOK } from '../app/docs/handbook-data';
import { EscPosBuilder } from '../lib/printer/escpos-builder';

describe('OpenBon v0.4.45: UI Enhancements, Storno Reports, Touch-Numpad & Documentation', () => {
  describe('1. Main menu scroll encapsulation (Item 1)', () => {
    it('should lock body scroll when drawer is open and contain overscroll', () => {
      const navbarSrc = fs.readFileSync(
        path.join(process.cwd(), 'src', 'components', 'navigation', 'navbar.tsx'),
        'utf-8'
      );
      expect(navbarSrc).toContain('overscroll-contain');
      expect(navbarSrc).toContain('document.body.style.overflow');
    });
  });

  describe('2. Shift report cancelled items (Item 2)', () => {
    it('should calculate itemsCancelled in settle report route', () => {
      const reportRouteSrc = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'api', 'waiters', 'settle', 'report', 'route.ts'),
        'utf-8'
      );
      expect(reportRouteSrc).toContain('itemsCancelled: SettlementItemSold[];');
      expect(reportRouteSrc).toContain('prisma.orderItem.findMany');
      expect(reportRouteSrc).toContain('isCancelled: true');
      expect(reportRouteSrc).toContain('itemsCancelled,');
    });

    it('should provide CANCELLED_ARTICLES tab in admin settle page', () => {
      const settlePageSrc = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'admin', 'settle', 'page.tsx'),
        'utf-8'
      );
      expect(settlePageSrc).toContain('CANCELLED_ARTICLES');
      expect(settlePageSrc).toContain('Stornierte Artikel');
      expect(settlePageSrc).toContain('itemsCancelled');
    });

    it('should include cancelled items section in ESC/POS settlement ticket when present', () => {
      const mockReport: any = {
        waiterName: 'Max Muster',
        periodStart: new Date().toISOString(),
        periodEnd: new Date().toISOString(),
        orderCount: 5,
        totalGrossCents: 5000,
        cashGrossCents: 3000,
        cardGrossCents: 2000,
        tipTotalCents: 500,
        cashHandedInCents: 3000,
        tipDeclaredCents: 500,
        itemsSold: [{ name: 'Bratwurst', quantity: 2, amountCents: 1000 }],
        itemsCancelled: [{ name: 'Bier 0,5l', quantity: 1, amountCents: 450, reason: 'Kunde vertippt' }],
        byMethod: [{ method: 'CASH', label: 'Bar', amountCents: 3000, count: 3 }],
      };

      const result = EscPosBuilder.buildSettlementTicket(mockReport, 80);

      expect(result).toBeDefined();
      expect(result.rawBuffer.length).toBeGreaterThan(0);
      expect(result.textRepresentation).toContain('Stornierte Artikel');
      expect(result.textRepresentation).toContain('Bier 0,5l');
    });
  });

  describe('3. Cash counting touch-numpad & leading zero fix (Item 3)', () => {
    it('should have TouchNumberInput and TouchNumpadModal component', () => {
      const touchNumpadSrc = fs.readFileSync(
        path.join(process.cwd(), 'src', 'components', 'ui', 'touch-numpad.tsx'),
        'utf-8'
      );
      expect(touchNumpadSrc).toContain('TouchNumberInput');
      expect(touchNumpadSrc).toContain('TouchNumpadModal');
      // Verify quick buttons exist
      expect(touchNumpadSrc).toContain('+5');
      expect(touchNumpadSrc).toContain('+10');
      expect(touchNumpadSrc).toContain('+20');
      expect(touchNumpadSrc).toContain('+50');
    });

    it('should use TouchNumberInput in admin settle step 3', () => {
      const settlePageSrc = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'admin', 'settle', 'page.tsx'),
        'utf-8'
      );
      expect(settlePageSrc).toContain('<TouchNumberInput');
    });
  });

  describe('4. SB-Kiosk "Alles löschen" button (Item 4)', () => {
    it('should have replaced auto-reset timer with Alles löschen button', () => {
      const kioskSrc = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'kiosk', 'page.tsx'),
        'utf-8'
      );
      expect(kioskSrc).not.toContain('resetCountdown');
      expect(kioskSrc).not.toContain('Warenkorb wird in');
      expect(kioskSrc).toContain('Alles löschen');
    });
  });

  describe('5. Table plan print view (Item 5)', () => {
    it('should only show the clean table number in printed cells', () => {
      const printSrc = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'admin', 'tables', 'print', 'page.tsx'),
        'utf-8'
      );
      expect(printSrc).not.toContain('t.label');
      expect(printSrc).not.toContain('(${t.x}, ${t.y})');
      expect(printSrc).toContain('{t.tableNumber}');
    });
  });

  describe('6. POS Bonkasse token banner removal (Item 6)', () => {
    it('should not show "Letzte Abhol-Nr.:" banner above cart', () => {
      const posSrc = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'pos', 'page.tsx'),
        'utf-8'
      );
      expect(posSrc).not.toContain('Letzte Abhol-Nr.:');
    });
  });

  describe('7. Customer display immediate recognition (Item 7)', () => {
    it('should broadcast station online on mount and handle cart request with empty cart', () => {
      const posSrc = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'pos', 'page.tsx'),
        'utf-8'
      );
      expect(posSrc).toContain('pos:station_online');
      const serverSrc = fs.readFileSync(path.join(process.cwd(), 'server.js'), 'utf-8');
      expect(serverSrc).toContain('pos:station_online');
    });
  });

  describe('8. Comprehensive Handbook documentation & screenshots (Item 8)', () => {
    it('should contain all 9 chapters with complete explanations and screenshots', () => {
      expect(HANDBOOK.length).toBe(9);
      const chaptersWithImages = HANDBOOK.filter((ch) =>
        ch.sections.some((sec) => sec.image && sec.image.src.startsWith('/docs/images/'))
      );
      expect(chaptersWithImages.length).toBe(9);

      // Verify key images are referenced
      const allImageSrcs = HANDBOOK.flatMap((ch) =>
        ch.sections.filter((s) => s.image).map((s) => s.image!.src)
      );
      expect(allImageSrcs).toContain('/docs/images/01_home_station_select.png');
      expect(allImageSrcs).toContain('/docs/images/02_setup_wizard.png');
      expect(allImageSrcs).toContain('/docs/images/04a_waiter_tischplan.png');
      expect(allImageSrcs).toContain('/docs/images/08_kitchen_kds.png');
      expect(allImageSrcs).toContain('/docs/images/09_kiosk_self_order.png');
      expect(allImageSrcs).toContain('/docs/images/10_customer_display.png');
      expect(allImageSrcs).toContain('/docs/images/22_admin_settle.png');
    });
  });
});
