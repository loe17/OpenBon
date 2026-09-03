import { describe, it, expect } from 'vitest';
import { computeHourlySales, computeForecast } from '../lib/forecast';

describe('Predictive Forecasting & Analytics Engine (Cent-hart)', () => {
  it('should aggregate hourly sales accurately', () => {
    const fakeOrders = [
      {
        id: 'ord1',
        createdAt: '2026-08-21T12:15:00',
        status: 'COMPLETED',
        items: [
          { productName: 'Bier 0.5l', quantity: 2, unitPriceCents: 450, depositCents: 100 },
          { productName: 'Bratwurst', quantity: 1, unitPriceCents: 400, depositCents: 0 },
        ],
      },
      {
        id: 'ord2',
        createdAt: '2026-08-21T12:45:00',
        status: 'COMPLETED',
        items: [
          { productName: 'Pommes', quantity: 1, unitPriceCents: 350, depositCents: 0 },
        ],
      },
    ];

    const hourly = computeHourlySales(fakeOrders);
    expect(hourly).toHaveLength(16);

    const h12 = hourly.find((h) => h.hour === 12);
    expect(h12).toBeDefined();
    expect(h12?.orderCount).toBe(2);
    expect(h12?.grossAmountCents).toBe(1850);
    expect(h12?.grossAmount).toBe(18.5);
  });

  it('should compute valid EOD revenue projection and peak hour forecast', () => {
    const hourlyData = [
      { hour: 12, label: '12:00', grossAmountCents: 20000, grossAmount: 200, orderCount: 20, itemCount: 40 },
      { hour: 13, label: '13:00', grossAmountCents: 35000, grossAmount: 350, orderCount: 35, itemCount: 70 },
      { hour: 14, label: '14:00', grossAmountCents: 15000, grossAmount: 150, orderCount: 15, itemCount: 30 },
    ];

    const forecast = computeForecast(hourlyData, 70000);

    expect(forecast.currentTotalGrossCents).toBe(70000);
    expect(forecast.currentTotalGross).toBe(700);
    expect(forecast.projectedEodGrossCents).toBeGreaterThan(70000);
    expect(forecast.peakHourLabel).toBe('13:00 - 14:00');
    expect(forecast.confidencePercent).toBeGreaterThanOrEqual(50);
  });
});
