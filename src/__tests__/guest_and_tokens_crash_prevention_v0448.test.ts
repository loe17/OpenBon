import { describe, it, expect } from 'vitest';

describe('Crash-Prävention v0.4.48 (toFixed & Cents-Euro Normalisierung)', () => {
  it('sollte Produkte mit priceCents sicher in Euro umrechnen ohne toFixed Absturz', () => {
    const rawProductsFromDb = [
      { id: '1', name: 'Bier 0.5l', priceCents: 450, depositCents: 100, happyHourPriceCents: 400, variants: [{ name: 'Radler', priceDeltaCents: 50 }] },
      { id: '2', name: 'Brezel', priceCents: 220, depositCents: 0, variants: [] },
      { id: '3', name: 'Sonderposten', priceCents: undefined, depositCents: null }, // edge case: leere Preise
    ];

    const normalized = rawProductsFromDb.map((p: any) => ({
      ...p,
      price: typeof p.price === 'number' ? p.price : (p.priceCents ?? 0) / 100,
      deposit: typeof p.deposit === 'number' ? p.deposit : (p.depositCents ?? 0) / 100,
      happyHourPrice: p.happyHourPrice ?? (p.happyHourPriceCents != null ? p.happyHourPriceCents / 100 : null),
      variants: (p.variants || []).map((v: any) => ({
        ...v,
        priceDelta: typeof v.priceDelta === 'number' ? v.priceDelta : (v.priceDeltaCents ?? 0) / 100,
      })),
    }));

    expect(normalized[0].price).toBe(4.5);
    expect(normalized[0].deposit).toBe(1.0);
    expect(Number(normalized[0].price).toFixed(2)).toBe('4.50');
    expect(Number(normalized[0].deposit).toFixed(2)).toBe('1.00');

    // Sonderposten ohne Preis crasht nicht:
    expect(normalized[2].price).toBe(0);
    expect(Number(normalized[2].price).toFixed(2)).toBe('0.00');
    expect(Number(normalized[2].deposit).toFixed(2)).toBe('0.00');
  });

  it('sollte Wertmarken-Buchungen in Cents sicher als Euro mit toFixed formatieren', () => {
    const tokenTx = {
      id: 'tx-1',
      unitValueCents: 250,
      totalValueCents: 25000,
      quantity: 100,
      type: 'ISSUE',
    };

    const unitEuro = (tokenTx.unitValueCents ?? 0) / 100;
    const totalEuro = (tokenTx.totalValueCents ?? 0) / 100;

    expect(unitEuro.toFixed(2)).toBe('2.50');
    expect(totalEuro.toFixed(2)).toBe('250.00');
  });

  it('sollte digitale Belege sauber gegen NaN und undefined absichern', () => {
    const rawPayment = {
      totalGrossCents: 2450,
      tipAmountCents: 200,
      items: [
        { productName: 'Helles', unitPriceCents: 450, quantity: 2, depositCents: 100 },
      ],
    };

    const totalGross = Number((rawPayment as any).totalGross ?? (rawPayment.totalGrossCents != null ? rawPayment.totalGrossCents / 100 : 0));
    const tipAmount = Number((rawPayment as any).tipAmount ?? (rawPayment.tipAmountCents != null ? rawPayment.tipAmountCents / 100 : 0));
    const formattedTotal = (totalGross + tipAmount).toFixed(2);

    expect(formattedTotal).toBe('26.50');
    expect(formattedTotal).not.toContain('NaN');
  });
});
