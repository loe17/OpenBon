import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../lib/db';
import { generateDigitalReceiptCode } from '../lib/digital-receipt';
import { isAudioMuted, setAudioMuted } from '../lib/socket-client';

describe('OpenBon: All Order Variants & Lifecycle Integration Tests', () => {
  let catId: string;
  let prodBratwurstId: string;
  let prodBeerId: string;
  let prodCoffeeId: string;
  let table1Id: string;
  let table2Id: string;

  beforeAll(async () => {
    // 0. Clean up previous test data
    await prisma.orderItem.deleteMany({ where: { productName: { startsWith: 'TEST-VAR ' } } });
    await prisma.paymentItem.deleteMany({ where: { productName: { startsWith: 'TEST-VAR ' } } });
    await prisma.payment.deleteMany({ where: { waiterName: { startsWith: 'TEST-WAITER' } } });
    await prisma.order.deleteMany({ where: { waiterName: { startsWith: 'TEST-WAITER' } } });
    await prisma.diningTable.deleteMany({ where: { tableNumber: { in: [901, 902] } } });
    await prisma.product.deleteMany({ where: { name: { startsWith: 'TEST-VAR ' } } });
    await prisma.productCategory.deleteMany({ where: { name: 'TEST-VAR Speisen' } });

    // 1. Create Category
    const category = await prisma.productCategory.create({
      data: {
        name: 'TEST-VAR Speisen',
        sortIndex: 1,
        color: '#f59e0b',
      },
    });
    catId = category.id;

    // 2. Create Products
    const bratwurst = await prisma.product.create({
      data: {
        name: 'TEST-VAR Bratwurst',
        price: 4.5,
        deposit: 0.0,
        taxRate: 7.0,
        categoryId: catId,
        hasAgeRestriction: false,
      },
    });
    prodBratwurstId = bratwurst.id;

    const beer = await prisma.product.create({
      data: {
        name: 'TEST-VAR Festbier 0,5l',
        price: 5.0,
        deposit: 1.0,
        taxRate: 19.0,
        categoryId: catId,
        hasAgeRestriction: true,
        minAge: 16,
      },
    });
    prodBeerId = beer.id;

    const coffee = await prisma.product.create({
      data: {
        name: 'TEST-VAR Kaffee',
        price: 2.5,
        deposit: 0.0,
        taxRate: 19.0,
        categoryId: catId,
      },
    });
    prodCoffeeId = coffee.id;

    // 3. Create Tables
    const t1 = await prisma.diningTable.create({
      data: {
        tableNumber: 901,
        label: 'Tisch 901 (Festzelt)',
        status: 'FREE',
      },
    });
    table1Id = t1.id;

    const t2 = await prisma.diningTable.create({
      data: {
        tableNumber: 902,
        label: 'Tisch 902 (Garten)',
        status: 'FREE',
      },
    });
    table2Id = t2.id;
  });

  // Variant 1: Waiter Table Order (WAITER_TABLE)
  it('Variant 1: Should create and query a Waiter Table Order with correct sums', async () => {
    const createdOrder = await prisma.order.create({
      data: {
        orderType: 'WAITER_TABLE',
        status: 'OPEN',
        tableId: table1Id,
        waiterName: 'TEST-WAITER Anna',
        items: {
          create: [
            {
              productId: prodBratwurstId,
              productName: 'TEST-VAR Bratwurst',
              quantity: 2,
              unitPrice: 4.5,
              taxRate: 7.0,
              customizationText: 'extra Senf, ohne Brot',
            },
            {
              productId: prodCoffeeId,
              productName: 'TEST-VAR Kaffee',
              quantity: 1,
              unitPrice: 2.5,
              taxRate: 19.0,
              customizationText: 'mit Hafermilch',
            },
          ],
        },
      },
      include: { items: true, table: true },
    });

    expect(createdOrder.id).toBeDefined();
    expect(createdOrder.orderType).toBe('WAITER_TABLE');
    expect(createdOrder.items.length).toBe(2);
    expect(createdOrder.items[0].customizationText).toContain('extra Senf');
    const totalGross = createdOrder.items.reduce((s: number, itm: { unitPrice: number; quantity: number }) => s + itm.unitPrice * itm.quantity, 0);
    expect(totalGross).toBe(11.5);
  });

  // Variant 2: POS Counter Direct Sale (COUNTER_DIRECT)
  it('Variant 2: Should process POS Counter Direct Sale with atomic checkout', async () => {
    const invoiceNumber = 'RE-2026-VAR-001';
    const digitalCode = generateDigitalReceiptCode(invoiceNumber);

    const payment = await prisma.payment.create({
      data: {
        invoiceNumber,
        digitalReceiptCode: digitalCode,
        paymentMethod: 'CASH',
        waiterName: 'TEST-WAITER Theke 1',
        totalGross: 6.0,
        totalNet: 5.04,
        totalTax: 0.96,
        taxBase19: 5.04,
        taxAmount19: 0.96,
        taxBase7: 0.0,
        taxAmount7: 0.0,
        taxBase0: 0.0,
        totalDeposit: 1.0,
        givenAmount: 10.0,
        changeAmount: 4.0,
        tipAmount: 0.0,
        items: {
          create: [
            {
              productName: 'TEST-VAR Festbier 0,5l',
              quantity: 1,
              unitPrice: 5.0,
              deposit: 1.0,
              taxRate: 19.0,
            },
          ],
        },
      },
      include: { items: true },
    });

    expect(payment.invoiceNumber).toBe(invoiceNumber);
    expect(payment.changeAmount).toBe(4.0);
    expect(payment.digitalReceiptCode).toBe(digitalCode);
  });

  // Variant 3: POS Voucher / Token Sale (COUNTER_VOUCHER)
  it('Variant 3: Should record Token / Wertmarken transactions', async () => {
    const token = await prisma.tokenTransaction.create({
      data: {
        tokenType: 'GENERAL',
        action: 'ISSUE',
        quantity: 5,
        unitValue: 2.0,
        totalValue: 10.0,
        waiterName: 'TEST-WAITER Wertmarkenkasse',
      },
    });

    expect(token.quantity).toBe(5);
    expect(token.totalValue).toBe(10.0);
    expect(token.action).toBe('ISSUE');
  });

  // Variant 4: Guest Self-Order (GUEST_QR)
  it('Variant 4: Should accept guest self-orders for table', async () => {
    const guestOrder = await prisma.order.create({
      data: {
        orderType: 'GUEST_SELF_ORDER',
        status: 'OPEN',
        tableId: table2Id,
        waiterName: 'Gast (Tisch 902)',
        items: {
          create: [
            {
              productId: prodBratwurstId,
              productName: 'TEST-VAR Bratwurst',
              quantity: 1,
              unitPrice: 4.5,
              taxRate: 7.0,
            },
          ],
        },
      },
      include: { items: true },
    });

    expect(guestOrder.waiterName).toBe('Gast (Tisch 902)');
    expect(guestOrder.items.length).toBe(1);
  });

  // Variant 5: Kiosk Terminal Order (KIOSK)
  it('Variant 5: Should process self-service Kiosk order', async () => {
    const kioskOrder = await prisma.order.create({
      data: {
        orderType: 'KIOSK',
        status: 'OPEN',
        waiterName: 'Terminal Kiosk 1',
        items: {
          create: [
            {
              productId: prodBeerId,
              productName: 'TEST-VAR Festbier 0,5l',
              quantity: 1,
              unitPrice: 5.0,
              taxRate: 19.0,
            },
          ],
        },
      },
      include: { items: true },
    });

    expect(kioskOrder.orderType).toBe('KIOSK');
    expect(kioskOrder.items[0].unitPrice).toBe(5.0);
  });

  // Variant 6: Table Split Payment (Tray Split)
  it('Variant 6: Should support partial item split payments at table', async () => {
    const splitOrder = await prisma.order.create({
      data: {
        orderType: 'WAITER_TABLE',
        status: 'OPEN',
        tableId: table1Id,
        waiterName: 'TEST-WAITER Anna',
        items: {
          create: [
            {
              productId: prodBratwurstId,
              productName: 'TEST-VAR Bratwurst',
              quantity: 3,
              unitPrice: 4.5,
              taxRate: 7.0,
            },
          ],
        },
      },
      include: { items: true },
    });

    // Split 1: Guest 1 pays 1 out of 3 Bratwürste
    const splitPayment1 = await prisma.payment.create({
      data: {
        invoiceNumber: 'RE-2026-SPLIT-1',
        paymentMethod: 'CASH',
        waiterName: 'TEST-WAITER Anna',
        totalGross: 4.5,
        totalNet: 4.21,
        totalTax: 0.29,
        taxBase7: 4.21,
        taxAmount7: 0.29,
        items: {
          create: [
            {
              orderItemId: splitOrder.items[0].id,
              productName: 'TEST-VAR Bratwurst',
              quantity: 1,
              unitPrice: 4.5,
              taxRate: 7.0,
            },
          ],
        },
      },
      include: { items: true },
    });

    expect(splitPayment1.items[0].quantity).toBe(1);
    expect(splitPayment1.totalGross).toBe(4.5);
  });

  // Variant 7: Table Transfer & Table Merge
  it('Variant 7: Should transfer orders from Table 1 to Table 2', async () => {
    const transferOrder = await prisma.order.create({
      data: {
        orderType: 'WAITER_TABLE',
        status: 'OPEN',
        tableId: table1Id,
        waiterName: 'TEST-WAITER Anna',
      },
    });

    // Transfer
    const updated = await prisma.order.update({
      where: { id: transferOrder.id },
      data: { tableId: table2Id },
    });

    expect(updated.tableId).toBe(table2Id);
  });

  // Variant 8: Storno / Cancellation with Reason
  it('Variant 8: Should record cancellation / void with reason', async () => {
    const voidOrder = await prisma.order.create({
      data: {
        orderType: 'WAITER_TABLE',
        status: 'CANCELLED',
        tableId: table1Id,
        waiterName: 'TEST-WAITER Anna',
        items: {
          create: [
            {
              productId: prodBratwurstId,
              productName: 'TEST-VAR Bratwurst',
              quantity: 1,
              unitPrice: 4.5,
              taxRate: 7.0,
              isCancelled: true,
              cancellationReason: 'Falschbonierung',
            },
          ],
        },
      },
      include: { items: true },
    });

    expect(voidOrder.status).toBe('CANCELLED');
    expect(voidOrder.items[0].isCancelled).toBe(true);
    expect(voidOrder.items[0].cancellationReason).toBe('Falschbonierung');
  });

  // Waiter Order History Query Filter Verification
  it('Should query order history filtered specifically by waiterName in descending order', async () => {
    const waiterOrders = await prisma.order.findMany({
      where: { waiterName: 'TEST-WAITER Anna' },
      orderBy: { createdAt: 'desc' },
      include: { items: true, table: true },
    });

    expect(waiterOrders.length).toBeGreaterThanOrEqual(1);
    for (const ord of waiterOrders) {
      expect(ord.waiterName).toBe('TEST-WAITER Anna');
    }
  });

  // Audio Mute Verification
  it('Should correctly set and read audio mute configuration', () => {
    setAudioMuted(true);
    expect(isAudioMuted()).toBe(true);

    setAudioMuted(false);
    expect(isAudioMuted()).toBe(false);
  });
});
