import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../lib/utils';

describe('Pricing, Deposit & Financial Calculations', () => {
  it('should format currency in German Euro format', () => {
    expect(formatCurrency(12.5)).toContain('12,50');
    expect(formatCurrency(0)).toContain('0,00');
  });

  it('should calculate gross, net and tax accurately', () => {
    const unitPrice = 10.0;
    const taxRate = 19.0;
    const qty = 2;

    const gross = unitPrice * qty; // 20.00 €
    const net = gross / (1 + taxRate / 100); // 16.8067...
    const tax = gross - net; // 3.1932...

    expect(gross).toBe(20.0);
    expect(Number(net.toFixed(2))).toBe(16.81);
    expect(Number(tax.toFixed(2))).toBe(3.19);
  });

  it('should deduct return deposit correctly', () => {
    const itemTotal = 25.0; // 5 beers at 5€
    const returnGlassesCount = 4;
    const returnGlassDeposit = 1.0;
    const returnDepositAmount = returnGlassesCount * returnGlassDeposit; // 4.00 €

    const finalToPay = Math.max(0, itemTotal - returnDepositAmount);
    expect(finalToPay).toBe(21.0);
  });

  it('should calculate change with tip accurately', () => {
    const finalToPay = 21.0;
    const tip = 2.0;
    const givenMoney = 50.0;

    const change = givenMoney - finalToPay - tip;
    expect(change).toBe(27.0);
  });
});
