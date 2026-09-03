import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../lib/db';
import { deductTapVolumeForItems } from '../lib/tap-manager';
import { playOrderReadyChime, playKitchenGong, playVoidAlert } from '../lib/audio-feedback';
import { EscPosBuilder } from '../lib/printer/escpos-builder';
import { parseAndValidateLicense } from '../lib/license';

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
    const cat =
      (await prisma.productCategory.findFirst()) ||
      (await prisma.productCategory.create({
        data: { name: 'Test-Getränke', sortIndex: 0 },
      }));
    const product = await prisma.product.create({
      data: {
        name: 'Test Festbier 0,5l',
        priceCents: 450,
        depositCents: 100,
        taxRate: 19.0,
        categoryId: cat.id,
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
              unitPriceCents: 450,
              depositCents: 100,
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
              unitPriceCents: 450,
              depositCents: 100,
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

  // TEST 7: Stufenlose Tischnummerngröße 1..5 in ESC/POS
  it('7. sollte stufenlose Tischnummerngrößen 1 bis 5 in ESC/POS korrekt rendern', () => {
    // Level 1: Normal
    const res1 = EscPosBuilder.buildTicket({
      title: 'KÜCHENBON',
      tableLabel: '42',
      tableFontSize: 1,
      items: [{ name: 'Schnitzel', quantity: 1, unitPriceCents: 1000 }],
    });
    expect(res1.textRepresentation).toContain('Tisch: 42');

    // Level 5: Maximal
    const res5 = EscPosBuilder.buildTicket({
      title: 'KÜCHENBON',
      tableLabel: '42',
      tableFontSize: 5,
      items: [{ name: 'Schnitzel', quantity: 1, unitPriceCents: 1000 }],
    });
    expect(res5.textRepresentation).toContain('Tisch: 42');
    expect(res5.rawBuffer.length).toBeGreaterThan(0);
  });

  // TEST 8: MwSt-Deaktivierung auf Bons
  it('8. sollte MwSt.-Aufschlüsselung ausblenden wenn enableTax false ist', () => {
    // Mit MwSt
    const resTax = EscPosBuilder.buildTicket({
      title: 'BELEG',
      totalGrossCents: 1190,
      totalNetCents: 1000,
      totalTaxCents: 190,
      taxSplits: [{ rate: 19, baseCents: 1000, taxCents: 190, grossCents: 1190, base: 10.00, tax: 1.90, gross: 11.90 }],
      items: [{ name: 'Bier', quantity: 1, unitPriceCents: 1190 }],
      enableTax: true,
    });
    expect(resTax.textRepresentation).toContain('MWST-AUFSCHLUESSELUNG');

    // Ohne MwSt (Kleinunternehmer / Verein)
    const resNoTax = EscPosBuilder.buildTicket({
      title: 'BELEG',
      totalGrossCents: 1190,
      totalNetCents: 1000,
      totalTaxCents: 190,
      taxSplits: [{ rate: 19, baseCents: 1000, taxCents: 190, grossCents: 1190, base: 10.00, tax: 1.90, gross: 11.90 }],
      items: [{ name: 'Bier', quantity: 1, unitPriceCents: 1190 }],
      enableTax: false,
    });
    expect(resNoTax.textRepresentation).not.toContain('MWST-AUFSCHLUESSELUNG');
  });

  // TEST 9: Tischmarken-Druck mit riesiger Tischnummer & optionalem QR-Code
  it('9. sollte saubere Tischmarken mit großer Nummer und optionalem QR generieren', () => {
    const res = EscPosBuilder.buildTableMarkerTicket({
      tableNumber: 14,
      qrUrl: 'http://openbon.local/guest/table/14',
    });
    expect(res.textRepresentation).toContain('TISCH 14');
    expect(res.textRepresentation).toContain('QR-Code: http://openbon.local/guest/table/14');
    expect(res.rawBuffer.length).toBeGreaterThan(0);
  });

  // TEST 10: Community Lizenz: Unbegrenzte Geräte (9999)
  it('10. sollte in der kostenlosen Community-Lizenz unbegrenzte Geräte (9999) zulassen', () => {
    const lic = parseAndValidateLicense('OPENBON-COMMUNITY-FREE');

    expect(lic.isValid).toBe(true);
    expect(lic.maxDevices).toBe(9999);
    expect(lic.type).toBe('COMMUNITY');
  });
});
