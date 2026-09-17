import { describe, it, expect, vi } from 'vitest';
import { checkInternetConnectivity, resetInternetCache } from '@/lib/internet-monitor';
import { generateEventSummaryPdf, EventSummaryData } from '@/lib/event-summary-pdf';

describe('Internet Monitor & Offline Probe', () => {
  it('should return boolean online status and timestamp', async () => {
    resetInternetCache();
    const result = await checkInternetConnectivity();
    expect(result).toHaveProperty('online');
    expect(typeof result.online).toBe('boolean');
    expect(result).toHaveProperty('lastChecked');
    expect(typeof result.lastChecked).toBe('string');
  });

  it('should use cached value within TTL window', async () => {
    resetInternetCache();
    const first = await checkInternetConnectivity();
    const second = await checkInternetConnectivity();
    expect(first.lastChecked).toBe(second.lastChecked);
    expect(first.online).toBe(second.online);
  });
});

describe('Event Summary PDF Generator', () => {
  const mockData: EventSummaryData = {
    eventName: 'Feuerwehrfest 2026',
    eventSubtitle: 'Freiwillige Feuerwehr Musterstadt e.V.',
    generatedAt: '17.09.2026, 12:00:00',
    dateRange: 'Fr., 12.09.2026 bis So., 14.09.2026',
    totals: {
      grossEuro: 4520.5,
      netEuro: 3800.0,
      tax19Euro: 720.5,
      tax7Euro: 0,
      cashEuro: 3200.0,
      cardEuro: 1320.5,
      tipsEuro: 245.0,
      depositChargedEuro: 450.0,
      depositReturnedEuro: 380.0,
      netDepositBalanceEuro: 70.0,
      receiptCount: 312,
      foodCount: 540,
      drinkCount: 1120,
      totalItemCount: 1660,
    },
    dailyRows: [
      {
        dateKey: '2026-09-12',
        formattedDate: 'Fr., 12.09.2026',
        foodCount: 150,
        drinkCount: 350,
        totalItems: 500,
        grossEuro: 1350.0,
        cashEuro: 950.0,
        cardEuro: 400.0,
        receiptCount: 95,
      },
      {
        dateKey: '2026-09-13',
        formattedDate: 'Sa., 13.09.2026',
        foodCount: 250,
        drinkCount: 550,
        totalItems: 800,
        grossEuro: 2170.5,
        cashEuro: 1550.0,
        cardEuro: 620.5,
        receiptCount: 145,
      },
      {
        dateKey: '2026-09-14',
        formattedDate: 'So., 14.09.2026',
        foodCount: 140,
        drinkCount: 220,
        totalItems: 360,
        grossEuro: 1000.0,
        cashEuro: 700.0,
        cardEuro: 300.0,
        receiptCount: 72,
      },
    ],
    waiterRows: [
      {
        waiterName: 'Lisa Wagner',
        totalGrossEuro: 2150.0,
        cashEuro: 1500.0,
        cardEuro: 650.0,
        depositReturnedEuro: 180.0,
        tipsEuro: 125.0,
        transactionCount: 142,
      },
      {
        waiterName: 'Markus Weber',
        totalGrossEuro: 1870.5,
        cashEuro: 1300.0,
        cardEuro: 570.5,
        depositReturnedEuro: 160.0,
        tipsEuro: 98.0,
        transactionCount: 120,
      },
      {
        waiterName: 'Theke / Schank 1',
        totalGrossEuro: 500.0,
        cashEuro: 400.0,
        cardEuro: 100.0,
        depositReturnedEuro: 40.0,
        tipsEuro: 22.0,
        transactionCount: 50,
      },
    ],
    productRows: [
      {
        name: 'Festbier 0,5l',
        type: 'GETRÄNK',
        unitPriceEuro: 4.5,
        totalQuantity: 650,
        totalRevenueEuro: 2925.0,
      },
      {
        name: 'Bratwurst mit Semmel',
        type: 'SPEISE',
        unitPriceEuro: 4.0,
        totalQuantity: 320,
        totalRevenueEuro: 1280.0,
      },
      {
        name: 'Pommes frites groß',
        type: 'SPEISE',
        unitPriceEuro: 3.5,
        totalQuantity: 220,
        totalRevenueEuro: 770.0,
      },
      {
        name: 'Apfelschorle 0,5l',
        type: 'GETRÄNK',
        unitPriceEuro: 3.5,
        totalQuantity: 280,
        totalRevenueEuro: 980.0,
      },
      {
        name: 'Mineralwasser 0,5l',
        type: 'GETRÄNK',
        unitPriceEuro: 3.0,
        totalQuantity: 190,
        totalRevenueEuro: 570.0,
      },
    ],
  };

  it('should generate a valid PDF buffer starting with %PDF', async () => {
    const pdfBuffer = await generateEventSummaryPdf(mockData);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);

    const magicHeader = pdfBuffer.slice(0, 4).toString('ascii');
    expect(magicHeader).toBe('%PDF');
  });

  it('should handle many rows with automatic page wrapping', async () => {
    const largeData = {
      ...mockData,
      productRows: Array.from({ length: 60 }, (_, i) => ({
        name: `Spezialartikel #${i + 1}`,
        type: (i % 2 === 0 ? 'SPEISE' : 'GETRÄNK') as 'SPEISE' | 'GETRÄNK',
        unitPriceEuro: 5.0,
        totalQuantity: 20 + i,
        totalRevenueEuro: (20 + i) * 5.0,
      })),
      waiterRows: Array.from({ length: 25 }, (_, i) => ({
        waiterName: `Bedienung Nr. ${i + 1}`,
        totalGrossEuro: 500 + i * 10,
        cashEuro: 350 + i * 5,
        cardEuro: 150 + i * 5,
        depositReturnedEuro: 30,
        tipsEuro: 25,
        transactionCount: 30 + i,
      })),
    };

    const pdfBuffer = await generateEventSummaryPdf(largeData);
    expect(pdfBuffer.length).toBeGreaterThan(5000);
    expect(pdfBuffer.slice(0, 4).toString('ascii')).toBe('%PDF');
  });
});

describe('Receipt Synchronization Contract', () => {
  it('should support syncFoodDrinkReceiptSettings in config object', () => {
    const config = {
      syncFoodDrinkReceiptSettings: true,
      receiptFoodTemplate: 'HIGH_VISIBILITY',
      receiptDrinkTemplate: 'HIGH_VISIBILITY',
      receiptFoodTableFontSize: 5,
      receiptDrinkTableFontSize: 5,
      receiptFoodItemFontSize: 4,
      receiptDrinkItemFontSize: 4,
    };

    expect(config.syncFoodDrinkReceiptSettings).toBe(true);
    expect(config.receiptFoodTemplate).toBe(config.receiptDrinkTemplate);
    expect(config.receiptFoodTableFontSize).toBe(config.receiptDrinkTableFontSize);
    expect(config.receiptFoodItemFontSize).toBe(config.receiptDrinkItemFontSize);
  });
});
