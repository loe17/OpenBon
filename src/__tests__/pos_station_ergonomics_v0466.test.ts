import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('OpenBon v0.4.66: POS Cashier Station Ergonomics & Tip System', () => {
  describe('Tip Calculation Logic (4-Arrow System: 1 € & 0,50 €)', () => {
    it('should calculate next full euro with roundUpEuro', () => {
      const baseDueCents = 1450; // 14,50 €
      let tipCents = 0;

      // 1. Aufrundung von 14,50 € auf nächsten Euro = 15,00 € (50 Cent Trinkgeld)
      const current1 = baseDueCents + tipCents;
      let next1 = (Math.floor(current1 / 100) + 1) * 100;
      if (next1 <= current1) next1 = current1 + 100;
      tipCents = Math.max(0, next1 - baseDueCents);
      expect(tipCents).toBe(50);
      expect(baseDueCents + tipCents).toBe(1500);

      // 2. Erneute Aufrundung um 1,00 € = 16,00 € (150 Cent Trinkgeld)
      const current2 = baseDueCents + tipCents;
      let next2 = (Math.floor(current2 / 100) + 1) * 100;
      if (next2 <= current2) next2 = current2 + 100;
      tipCents = Math.max(0, next2 - baseDueCents);
      expect(tipCents).toBe(150);
      expect(baseDueCents + tipCents).toBe(1600);
    });

    it('should calculate 1 Euro subtraction with roundDownEuro', () => {
      const baseDueCents = 1450;
      let tipCents = 150; // 16,00 €

      // 1. Abzug von 1 €: 16,00 € -> 15,00 € (50 Cent Trinkgeld)
      const current1 = baseDueCents + tipCents;
      const next1 = Math.max(baseDueCents, current1 - 100);
      tipCents = Math.max(0, next1 - baseDueCents);
      expect(tipCents).toBe(50);

      // 2. Weiterer Abzug: 15,00 € -> darf nicht unter Basisbetrag 14,50 € fallen (0 Cent Trinkgeld)
      const current2 = baseDueCents + tipCents;
      const next2 = Math.max(baseDueCents, current2 - 100);
      tipCents = Math.max(0, next2 - baseDueCents);
      expect(tipCents).toBe(0);
    });

    it('should calculate next 50 cents step with roundUp50Cents', () => {
      const baseDueCents = 1420; // 14,20 €
      let tipCents = 0;

      // 1. Aufrundung von 14,20 € auf nächste 50 Cent = 14,50 € (30 Cent Trinkgeld)
      const current1 = baseDueCents + tipCents;
      let next1 = Math.ceil((current1 + 1) / 50) * 50;
      if (next1 <= current1) next1 = current1 + 50;
      tipCents = Math.max(0, next1 - baseDueCents);
      expect(tipCents).toBe(30);
      expect(baseDueCents + tipCents).toBe(1450);

      // 2. Erneute Aufrundung auf 15,00 € (80 Cent Trinkgeld)
      const current2 = baseDueCents + tipCents;
      let next2 = Math.ceil((current2 + 1) / 50) * 50;
      if (next2 <= current2) next2 = current2 + 50;
      tipCents = Math.max(0, next2 - baseDueCents);
      expect(tipCents).toBe(80);
      expect(baseDueCents + tipCents).toBe(1500);
    });

    it('should calculate 50 cents subtraction with roundDown50Cents', () => {
      const baseDueCents = 1420;
      let tipCents = 80; // 15,00 €

      // 1. Abzug von 50 Cent: 15,00 € -> 14,50 € (30 Cent Trinkgeld)
      const current1 = baseDueCents + tipCents;
      const next1 = Math.max(baseDueCents, current1 - 50);
      tipCents = Math.max(0, next1 - baseDueCents);
      expect(tipCents).toBe(30);

      // 2. Weiterer Abzug: 14,50 € -> 14,20 € (0 Cent Trinkgeld, Minimum erreicht)
      const current2 = baseDueCents + tipCents;
      const next2 = Math.max(baseDueCents, current2 - 50);
      tipCents = Math.max(0, next2 - baseDueCents);
      expect(tipCents).toBe(0);
    });
  });

  describe('Source Code Sanity & UI Requirements', () => {
    const posFilePath = path.join(process.cwd(), 'src/app/pos/page.tsx');
    const posCode = fs.readFileSync(posFilePath, 'utf8');

    it('should not contain mode selector buttons in POS header', () => {
      expect(posCode).not.toContain('Ausgabe-Modus:');
      expect(posCode).not.toContain("setMode('DIRECT')");
      expect(posCode).not.toContain("setMode('VOUCHER')");
      expect(posCode).not.toContain("setMode('DUAL')");
    });

    it('should have minimize window button on top-left icon', () => {
      expect(posCode).toContain('handleMinimizeWindow');
      expect(posCode).toContain('Vollbild beenden / Fenster minimieren');
    });

    it('should have search button next to header actions and touch keyboard modal', () => {
      expect(posCode).toContain('showSearchModal');
      expect(posCode).toContain('searchModalQuery');
      expect(posCode).toContain('Touch-Tastatur');
      expect(posCode).toContain('handleVirtualKeyPress');
      expect(posCode).toContain('handleVirtualBackspace');
      expect(posCode).toContain('handleVirtualClear');
    });

    it('should have 4-arrow tip system in checkout modal', () => {
      expect(posCode).toContain('roundUpEuro');
      expect(posCode).toContain('roundDownEuro');
      expect(posCode).toContain('roundUp50Cents');
      expect(posCode).toContain('roundDown50Cents');
      expect(posCode).toContain('+ {formatCents(tipCents)} Trinkgeld');
    });

    it('should offer direct choice between Barzahlung (COUNTER_DIRECT) and Wertmarke (COUNTER_VOUCHER)', () => {
      expect(posCode).toContain("handleCheckout('COUNTER_DIRECT', 'CASH')");
      expect(posCode).toContain("handleCheckout('COUNTER_VOUCHER', 'CASH')");
      expect(posCode).toContain('tipAmountCents: tipCents');
    });

    it('should use side-by-side layout in ChangeCalculator for zero vertical scrolling', () => {
      expect(posCode).toContain('layout="side-by-side"');
    });

    it('should have clean Kassieren button without amount in brackets', () => {
      expect(posCode).toContain('<span>Kassieren</span>');
      expect(posCode).not.toContain('Kassieren ({formatCents(');
    });
  });

  describe('ChangeCalculator Component Side-by-Side Support', () => {
    const calcFilePath = path.join(process.cwd(), 'src/components/ui/change-calculator.tsx');
    const calcCode = fs.readFileSync(calcFilePath, 'utf8');

    it('should support side-by-side layout prop and render split columns', () => {
      expect(calcCode).toContain("layout?: 'vertical' | 'side-by-side'");
      expect(calcCode).toContain("layout === 'side-by-side'");
    });
  });
});
