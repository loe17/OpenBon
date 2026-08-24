import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../lib/utils';
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

describe('Pricing, Deposit & Financial Calculations', () => {
  it('should format currency in German Euro format', () => {
    expect(formatCurrency(12.5)).toContain('12,50');
    expect(formatCurrency(0)).toContain('0,00');
  });

  it('should convert between euro and cents without drift', () => {
    expect(toCents(12.34)).toBe(1234);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toEuro(1234)).toBe(12.34);
    expect(round2(3.14159)).toBe(3.14);
  });

  it('should calculate gross, net and tax accurately', () => {
    const breakdown = computeTaxBreakdown([{ unitPrice: 10, quantity: 2, taxRate: 19 }]);

    expect(breakdown.grossTotal).toBe(20.0);
    expect(breakdown.netTotal).toBe(16.81);
    expect(breakdown.taxTotal).toBe(3.19);
  });

  // Spec 7.1.1: cent-genaue MwSt-Berechnung 19 % / 7 % / 0 %
  it('should split VAT per rate (19 %, 7 % and deposit at 0 %)', () => {
    const breakdown = computeTaxBreakdown([
      { unitPrice: 4.5, quantity: 2, taxRate: 19, deposit: 1.0 }, // Bier mit Pfand
      { unitPrice: 3.5, quantity: 1, taxRate: 7 }, // Speise ermäßigt
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

    // Pfand ist ein durchlaufender Posten und wird steuerfrei ausgewiesen
    expect(rate0.gross).toBe(2.0);
    expect(rate0.tax).toBe(0);

    expect(breakdown.depositTotal).toBe(2.0);
    expect(breakdown.grossTotal).toBe(14.5);
    expect(round2(breakdown.netTotal + breakdown.taxTotal)).toBe(14.5);
  });

  it('should stay cent-exact across many small lines', () => {
    const lines = Array.from({ length: 333 }, () => ({
      unitPrice: 0.03,
      quantity: 1,
      taxRate: 19,
    }));
    const breakdown = computeTaxBreakdown(lines);

    expect(breakdown.grossTotal).toBe(9.99);
    expect(round2(breakdown.netTotal + breakdown.taxTotal)).toBe(9.99);
  });

  it('should deduct return deposit correctly', () => {
    const result = computeCheckout({
      lines: [{ unitPrice: 5, quantity: 5, taxRate: 19 }],
      returnDepositAmount: 4.0,
    });

    expect(result.grossTotal).toBe(25.0);
    expect(result.amountDue).toBe(21.0);
  });

  it('should calculate change with tip accurately', () => {
    const result = computeCheckout({
      lines: [{ unitPrice: 5, quantity: 5, taxRate: 19 }],
      returnDepositAmount: 4.0,
      tipAmount: 2.0,
      givenAmount: 50.0,
    });

    expect(result.amountDueWithTip).toBe(23.0);
    expect(result.changeAmount).toBe(27.0);
  });

  it('should apply percentage and fixed surcharges', () => {
    const result = computeCheckout({
      lines: [{ unitPrice: 10, quantity: 1, taxRate: 19 }],
      surchargePercent: 10,
      surchargeFixed: 1,
    });

    expect(result.surchargeTotal).toBe(2.0);
    expect(result.amountDue).toBe(12.0);
    // Aufschlag wird mit dem höchsten vorkommenden Satz versteuert
    expect(findSplit(result.splits, 19).gross).toBe(12.0);
  });

  it('should never produce a negative amount due', () => {
    const result = computeCheckout({
      lines: [{ unitPrice: 2, quantity: 1, taxRate: 19 }],
      returnDepositAmount: 10,
    });
    expect(result.amountDue).toBe(0);
  });

  it('should not report change when nothing was given', () => {
    const result = computeCheckout({
      lines: [{ unitPrice: 8, quantity: 1, taxRate: 19 }],
      givenAmount: 0,
    });
    expect(result.changeAmount).toBe(0);
  });

  // Spec V2 §6.5: Zeitgesteuerte Aktionspreise & Happy Hour
  it('should detect active happy hour and return discounted price', () => {
    const product = {
      price: 5.0,
      happyHourPrice: 3.5,
      happyHourStart: '18:00',
      happyHourEnd: '20:00',
      happyHourDays: '[1, 2, 3, 4, 5]', // Mo-Fr
    };

    // Montag 18:30 -> Happy Hour aktiv
    const activeDate = new Date('2026-08-24T18:30:00'); // 2026-08-24 is a Monday (day 1)
    const activeResult = getEffectiveProductPrice(product, activeDate);
    expect(activeResult.isHappyHour).toBe(true);
    expect(activeResult.price).toBe(3.5);

    // Montag 21:00 -> Standardpreis
    const inactiveDate = new Date('2026-08-24T21:00:00');
    const inactiveResult = getEffectiveProductPrice(product, inactiveDate);
    expect(inactiveResult.isHappyHour).toBe(false);
    expect(inactiveResult.price).toBe(5.0);
  });
});
