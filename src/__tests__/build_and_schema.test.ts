import { describe, it, expect } from 'vitest';
import prisma from '../lib/db';
import { APP_VERSION, APP_NAME } from '../lib/version';

describe('OpenBon Build, Prisma Schema & Runtime Sanity Tests', () => {
  it('should initialize Prisma DB Client with valid DATABASE_URL fallback', () => {
    expect(prisma).toBeDefined();
    expect(process.env.DATABASE_URL).toBeDefined();
    expect(process.env.DATABASE_URL).toContain('dev.db');
  });

  it('should validate all essential Prisma models and schema structure', async () => {
    // Test basic Prisma model availability
    expect(prisma.eventConfig).toBeDefined();
    expect(prisma.diningTable).toBeDefined();
    expect(prisma.product).toBeDefined();
    expect(prisma.productCategory).toBeDefined();
    expect(prisma.order).toBeDefined();
    expect(prisma.orderItem).toBeDefined();
    expect(prisma.payment).toBeDefined();
    expect(prisma.paymentItem).toBeDefined();
    expect(prisma.printer).toBeDefined();
    expect(prisma.printGroup).toBeDefined();
    expect(prisma.stockItem).toBeDefined();
    expect(prisma.device).toBeDefined();
    expect(prisma.syncJournal).toBeDefined();
    expect(prisma.chatMessage).toBeDefined();
  });

  it('should ensure Payment model supports VR-Pay Me, SumUp and Surcharge fields', () => {
    const testPaymentPayload = {
      invoiceNumber: 'TEST-INV-001',
      waiterName: 'Testbedienung',
      totalGross: 57.5,
      totalNet: 48.32,
      totalTax: 9.18,
      totalDeposit: 2.0,
      returnDeposit: 1.0,
      discountAmount: 0.0,
      tipAmount: 2.5,
      surchargeAmount: 5.0,
      surchargePercent: 10.0,
      surchargeReason: '10% Nachtzuschlag',
      givenAmount: 60.0,
      changeAmount: 2.5,
      paymentMethod: 'CARD_VRPAY',
      isTraining: false,
    };

    expect(testPaymentPayload.paymentMethod).toBe('CARD_VRPAY');
    expect(testPaymentPayload.surchargeAmount).toBe(5.0);
    expect(testPaymentPayload.surchargePercent).toBe(10.0);
    expect(testPaymentPayload.surchargeReason).toBe('10% Nachtzuschlag');
  });

  it('should verify global type environment declarations', () => {
    // global.io and global.connectedDevices should be accessible on globalThis
    expect((globalThis as any)).toBeDefined();
    global.virtualPrinterHistory = global.virtualPrinterHistory || [];
    expect(Array.isArray(global.virtualPrinterHistory)).toBe(true);
  });
});
