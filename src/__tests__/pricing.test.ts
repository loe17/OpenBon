import { describe, it, expect } from 'vitest';
import { formatCents, formatCurrency } from '../lib/utils';
import {
  computeTaxBreakdown,
  computeCheckout,
  findSplit,
  toCents,
  toEuro,
  round2,
  suggestCashNotes,
  CASH_QUICK_NOTES,
  getEffectiveProductPrice,
} from '../lib/pricing';

describe('Pricing, Deposit & Financial Calculations (Cent-hart)', () => {
  it('should format cents in German Euro format', () => {
    expect(formatCents(1250)).toContain('12,50');
    expect(formatCents(0)).toContain('0,00');
    expect(formatCurrency(12.5)).toContain('12,50');
  });

  it('should convert between euro and cents without drift', () => {
    expect(toCents(12.34)).toBe(1234);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toEuro(1234)).toBe(12.34);
    expect(round2(3.14159)).toBe(3.14);
  });

  it('should calculate gross, net and tax accurately', () => {
    const breakdown = computeTaxBreakdown([{ unitPriceCents: 1000, quantity: 2, taxRate: 19 }]);

    expect(breakdown.grossCents).toBe(2000);
    expect(breakdown.grossTotal).toBe(20.0);
    expect(breakdown.netTotal).toBe(16.81);
    expect(breakdown.taxTotal).toBe(3.19);
  });

  it('should split VAT per rate (19 %, 7 % and deposit at 0 %)', () => {
    const breakdown = computeTaxBreakdown([
      { unitPriceCents: 450, quantity: 2, taxRate: 19, depositCents: 100 },
      { unitPriceCents: 350, quantity: 1, taxRate: 7 },
    ]);

    const rate19 = findSplit(breakdown.splits, 19);
    const rate7 = findSplit(breakdown.splits, 7);
    const rate0 = findSplit(breakdown.splits, 0);

    expect(rate19.gross).toBe(9.0);
    expect(rate19.base).toBe(7.56);
    expect(rate19.tax).toBe(1.44);

    expect(rate7.gross).toBe(3.5);
    expect(rate7.base).toBe(3.27);
    expect(rate7.tax).toBe(0.23);

    expect(rate0.gross).toBe(2.0);
    expect(rate0.tax).toBe(0);

    expect(breakdown.depositCents).toBe(200);
    expect(breakdown.grossCents).toBe(1450);
    expect(round2(breakdown.netTotal + breakdown.taxTotal)).toBe(14.5);
  });

  it('should stay cent-exact across many small lines', () => {
    const lines = Array.from({ length: 333 }, () => ({
      unitPriceCents: 3,
      quantity: 1,
      taxRate: 19,
    }));
    const breakdown = computeTaxBreakdown(lines);

    expect(breakdown.grossCents).toBe(999);
    expect(round2(breakdown.netTotal + breakdown.taxTotal)).toBe(9.99);
  });

  it('should deduct return deposit correctly', () => {
    const result = computeCheckout({
      lines: [{ unitPriceCents: 500, quantity: 5, taxRate: 19 }],
      returnDepositCents: 400,
    });

    expect(result.grossCents).toBe(2500);
    expect(result.amountDueCents).toBe(2100);
  });

  it('should calculate change with tip accurately', () => {
    const result = computeCheckout({
      lines: [{ unitPriceCents: 500, quantity: 5, taxRate: 19 }],
      returnDepositCents: 400,
      tipCents: 200,
      givenCents: 5000,
    });

    expect(result.amountDueWithTipCents).toBe(2300);
    expect(result.changeCents).toBe(2700);
  });

  it('should apply percentage and fixed surcharges', () => {
    const result = computeCheckout({
      lines: [{ unitPriceCents: 1000, quantity: 1, taxRate: 19 }],
      surchargePercent: 10,
      surchargeFixedCents: 100,
    });

    expect(result.surchargeCents).toBe(200);
    expect(result.amountDueCents).toBe(1200);
    expect(findSplit(result.splits, 19).gross).toBe(12.0);
  });

  it('should never produce a negative amount due', () => {
    const result = computeCheckout({
      lines: [{ unitPriceCents: 200, quantity: 1, taxRate: 19 }],
      returnDepositCents: 1000,
    });
    expect(result.amountDueCents).toBe(0);
  });

  it('should not report change when nothing was given', () => {
    const result = computeCheckout({
      lines: [{ unitPriceCents: 800, quantity: 1, taxRate: 19 }],
      givenCents: 0,
    });
    expect(result.changeCents).toBe(0);
  });

  it('should detect active happy hour and return discounted priceCents', () => {
    const product = {
      priceCents: 500,
      happyHourPriceCents: 350,
      happyHourStart: '18:00',
      happyHourEnd: '20:00',
      happyHourDays: '[1, 2, 3, 4, 5]',
    };

    const activeDate = new Date('2026-08-24T18:30:00');
    const activeResult = getEffectiveProductPrice(product, activeDate);
    expect(activeResult.isHappyHour).toBe(true);
    expect(activeResult.priceCents).toBe(350);
    expect(activeResult.price).toBe(3.5);

    const inactiveDate = new Date('2026-08-24T21:00:00');
    const inactiveResult = getEffectiveProductPrice(product, inactiveDate);
    expect(inactiveResult.isHappyHour).toBe(false);
    expect(inactiveResult.priceCents).toBe(500);
  });
});
