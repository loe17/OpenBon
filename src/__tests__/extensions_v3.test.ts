import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../lib/db';
import { deductTapVolumeForItems } from '../lib/tap-manager';
import { playOrderReadyChime, playKitchenGong, playVoidAlert } from '../lib/audio-feedback';

describe('OpenBon Erweiterungs-Paket: Neue Systemfunktionen', () => {
  let tableAId: string;
  let tableBId: string;
  let tableCId: string;
  let testProductId: string;
  let tapLineId: string;

  beforeAll(async () => {
    // 0. Aufräumen alter Testdaten
    await prisma.tapLine.deleteMany({ where: { name: { startsWith: 'Test ' } } });
    await prisma.orderItem.deleteMany({ where: { productName: { startsWith: 'Test ' } } });
    await prisma.order.deleteMany({ where: { waiterName: 'Test Kellner' } });
    await prisma.product.deleteMany({ where: { name: { startsWith: 'Test ' } } });
    await prisma.diningTable.deleteMany({ where: { tableNumber: { in: [901, 902, 903] } } });

    // 1. Tische anlegen
    const tA = await prisma.diningTable.create({
      data: { tableNumber: 901, label: 'Test Tisch 901', status: 'OCCUPIED' },
    });
    tableAId = tA.id;

    const tB = await prisma.diningTable.create({
      data: { tableNumber: 902, label: 'Test Tisch 902', status: 'FREE' },
    });
    tableBId = tB.id;

    const tC = await prisma.diningTable.create({
      data: { tableNumber: 903, label: 'Test Tisch 903', status: 'OCCUPIED' },
    });
    tableCId = tC.id;

    // 2. Kategorie und Test-Artikel anlegen
    const cat = await prisma.productCategory.findFirst();
    const product = await prisma.product.create({
      data: {
        name: 'Test Festbier 0,5l',
        price: 4.5,
        deposit: 1.0,
        taxRate: 19.0,
        categoryId: cat!.id,
        trackStock: true,
        stockQuantity: 3,
        minStockAlert: 8, // Unterschritten -> eilig
      },
    });
    testProductId = product.id;

    // 3. Bestellungen für Tisch A und C anlegen
    await prisma.order.create({
      data: {
        orderNumber: 9001,
        tableId: tableAId,
        waiterName: 'Test Kellner',
        status: 'OPEN',
        items: {
          create: [
            {
              productId: testProductId,
              productName: 'Test Festbier 0,5l',
              quantity: 2,
              unitPrice: 4.5,
              deposit: 1.0,
              taxRate: 19.0,
            },
          ],
        },
      },
    });

    await prisma.order.create({
      data: {
        orderNumber: 9002,
        tableId: tableCId,
        waiterName: 'Test Kellner',
        status: 'OPEN',
        items: {
          create: [
            {
              productId: testProductId,
              productName: 'Test Festbier 0,5l',
              quantity: 1,
              unitPrice: 4.5,
              deposit: 1.0,
              taxRate: 19.0,
            },
          ],
        },
      },
    });

    // 4. Zapfhahn anlegen
    const tap = await prisma.tapLine.create({
      data: {
        tapNumber: 9,
        name: 'Test Zapfhahn 9 - Helles',
        kegVolumeLiters: 50.0,
        currentVolumeLiters: 50.0,
        portionSizeLiters: 0.5,
        lossPercentage: 3.0,
        warningLevelPercent: 10.0,
        productId: testProductId,
        kegsTapped: 1,
      },
    });
    tapLineId = tap.id;
  });

  // TEST 1: Tisch-Umbuchung (Transfer)
  it('1. sollte alle offenen Bestellungen von Tisch A nach Tisch B umbuchen', async () => {
    // Vorher: Tisch A belegt, Tisch B frei
    const ordersA = await prisma.order.findMany({ where: { tableId: tableAId, status: 'OPEN' } });
    expect(ordersA.length).toBe(1);

    // Umbuchung durchführen
    await prisma.$transaction([
      prisma.order.updateMany({
        where: { tableId: tableAId, status: 'OPEN' },
        data: { tableId: tableBId },
      }),
      prisma.diningTable.update({ where: { id: tableAId }, data: { status: 'FREE' } }),
      prisma.diningTable.update({ where: { id: tableBId }, data: { status: 'OCCUPIED' } }),
    ]);

    const updatedA = await prisma.diningTable.findUnique({ where: { id: tableAId } });
    const updatedB = await prisma.diningTable.findUnique({ where: { id: tableBId } });
    const ordersB = await prisma.order.findMany({ where: { tableId: tableBId, status: 'OPEN' } });

    expect(updatedA?.status).toBe('FREE');
    expect(updatedB?.status).toBe('OCCUPIED');
    expect(ordersB.length).toBe(1);
    expect(ordersB[0].orderNumber).toBe(9001);
  });

  // TEST 2: Tisch-Zusammenlegung (Merge)
  it('2. sollte Tisch C in Tisch B integrieren und Tisch C freigeben', async () => {
    // Merge C -> B
    await prisma.$transaction([
      prisma.order.updateMany({
        where: { tableId: tableCId, status: 'OPEN' },
        data: { tableId: tableBId },
      }),
      prisma.diningTable.update({ where: { id: tableCId }, data: { status: 'FREE' } }),
      prisma.diningTable.update({ where: { id: tableBId }, data: { status: 'OCCUPIED' } }),
    ]);

    const updatedC = await prisma.diningTable.findUnique({ where: { id: tableCId } });
    const ordersB = await prisma.order.findMany({ where: { tableId: tableBId, status: 'OPEN' } });

    expect(updatedC?.status).toBe('FREE');
    expect(ordersB.length).toBe(2); // Order 9001 und Order 9002
  });

  // TEST 3: Schank- & Fassüberwachung (Volumenabzug inkl. Schankverlust)
  it('3. sollte Schankvolumen inklusive Schankverlust exakt abziehen', async () => {
    // 4 Bier à 0,5l = 2.0 Liter + 3% Schankverlust = 2.06 Liter
    await deductTapVolumeForItems([{ productId: testProductId, quantity: 4 }]);

    const tap = await prisma.tapLine.findUnique({ where: { id: tapLineId } });
    expect(tap).toBeDefined();
    // 50.0 - 2.06 = 47.94
    expect(tap?.currentVolumeLiters).toBeCloseTo(47.94, 2);
  });

  // TEST 4: Fasswechsel
  it('4. sollte ein neues 30l Fass anschlagen und Zähler erhöhen', async () => {
    const updatedTap = await prisma.tapLine.update({
      where: { id: tapLineId },
      data: {
        kegVolumeLiters: 30.0,
        currentVolumeLiters: 30.0,
        kegsTapped: { increment: 1 },
      },
    });

    expect(updatedTap.currentVolumeLiters).toBe(30.0);
    expect(updatedTap.kegVolumeLiters).toBe(30.0);
    expect(updatedTap.kegsTapped).toBe(2);
  });

  // TEST 5: Lieferanten-Bestellvorschlag Bedarfsanalyse
  it('5. sollte Nachbestellmenge und Eilbedürftigkeit korrekt ermitteln', async () => {
    const product = await prisma.product.findUnique({ where: { id: testProductId } });
    expect(product).toBeDefined();

    const minStock = product!.minStockAlert || 5; // 8
    const targetStock = minStock * 3; // 24
    const currentStock = product!.stockQuantity; // 3
    const needed = Math.max(0, targetStock - currentStock); // 21
    const isUrgent = currentStock <= minStock; // 3 <= 8 -> true

    expect(needed).toBe(21);
    expect(isUrgent).toBe(true);
  });

  // TEST 6: Audio Chimes & Sound Synthesis
  it('6. sollte Audio-Synthesizer-Funktionen ohne Laufzeitfehler ausführen', () => {
    expect(() => playOrderReadyChime()).not.toThrow();
    expect(() => playKitchenGong()).not.toThrow();
    expect(() => playVoidAlert()).not.toThrow();
  });
});
