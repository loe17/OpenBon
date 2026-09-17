import { describe, it, expect, vi } from 'vitest';
import prisma from '@/lib/db';
import { signSessionToken } from '@/lib/auth-session';
import { GET as getEventSummary } from '@/app/api/reports/event-summary/route';

describe('Event Summary Resilience & Button Actions', () => {
  it('should generate report successfully even when orders contain items with missing/deleted products', async () => {
    process.env.SESSION_SECRET = 'test-secret-1234567890-resilience-secret';
    const adminToken = await signSessionToken({ role: 'ADMIN', deviceId: 'test-dev-1' });
    const origConfig = prisma.eventConfig.findFirst;
    const origPayment = prisma.payment.findMany;
    const origOrder = prisma.order.findMany;
    const origWaiter = prisma.waiterProfile.findMany;
    const origProduct = prisma.product.findMany;

    prisma.eventConfig.findFirst = vi.fn().mockResolvedValue({
      name: 'Resilience Testfest 2026',
      receiptSubHeader: 'Sicherheits- und Härtungstest',
    });

    prisma.payment.findMany = vi.fn().mockResolvedValue([
      {
        id: 'pay-1',
        invoiceNumber: 'INV-101',
        totalGrossCents: 1500,
        totalNetCents: 1261,
        taxAmount19Cents: 239,
        taxAmount7Cents: 0,
        totalDepositCents: 200,
        returnDepositCents: 100,
        tipAmountCents: 150,
        paymentMethod: 'CASH',
        createdAt: new Date('2026-09-17T12:00:00Z'),
        waiterName: 'Anna',
      },
    ]);

    prisma.order.findMany = vi.fn().mockResolvedValue([
      {
        id: 'ord-1',
        status: 'COMPLETED',
        isTraining: false,
        createdAt: new Date('2026-09-17T12:00:00Z'),
        items: [
          {
            id: 'item-1',
            productId: 'prod-exists',
            productName: 'Bier 0.5l',
            quantity: 2,
            unitPriceCents: 450,
            depositCents: 50,
            isCancelled: false,
          },
          {
            id: 'item-2',
            productId: 'prod-deleted-999',
            productName: 'Historischer Aktions-Burger',
            quantity: 1,
            unitPriceCents: 850,
            depositCents: 0,
            isCancelled: false,
          },
        ],
      },
    ]);

    prisma.waiterProfile.findMany = vi.fn().mockResolvedValue([
      { id: 'w-1', name: 'Anna', isActive: true },
    ]);

    prisma.product.findMany = vi.fn().mockResolvedValue([
      {
        id: 'prod-exists',
        name: 'Bier 0.5l',
        tokenType: 'DRINK',
        subCategory: 'BIER',
        category: { name: 'Getränke' },
      },
    ]);

    try {
      const reqJson = new Request('http://localhost:3000/api/reports/event-summary?format=json', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const resJson = await getEventSummary(reqJson);
      expect(resJson.status).toBe(200);
      const data = await resJson.json();
      expect(data.eventName).toBe('Resilience Testfest 2026');
      expect(data.totals.foodCount).toBe(1);
      expect(data.totals.drinkCount).toBe(2);
      expect(data.productRows.length).toBe(2);

      const reqCsv = new Request('http://localhost:3000/api/reports/event-summary?format=csv', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const resCsv = await getEventSummary(reqCsv);
      expect(resCsv.status).toBe(200);
      const csvText = await resCsv.text();
      expect(csvText).toContain('Resilience Testfest 2026');
      expect(csvText).toContain('Historischer Aktions-Burger');
      expect(csvText).toContain('Bier 0.5l');

      const reqPdf = new Request('http://localhost:3000/api/reports/event-summary?format=pdf', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const resPdf = await getEventSummary(reqPdf);
      expect(resPdf.status).toBe(200);
      const pdfBuffer = await resPdf.arrayBuffer();
      expect(pdfBuffer.byteLength).toBeGreaterThan(100);
    } finally {
      prisma.eventConfig.findFirst = origConfig;
      prisma.payment.findMany = origPayment;
      prisma.order.findMany = origOrder;
      prisma.waiterProfile.findMany = origWaiter;
      prisma.product.findMany = origProduct;
    }
  });
});
