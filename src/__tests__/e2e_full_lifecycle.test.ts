import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../lib/db';
import { getEffectiveProductPrice } from '../lib/pricing';
import { calculateMinBirthdate, EU_ALLERGENS, filterProductsByExcludedAllergens } from '../lib/compliance';
import { calculateTipDistribution } from '../lib/tips';
import { generateDigitalReceiptCode, buildReceiptUrl } from '../lib/digital-receipt';
import { generateDatevCsv, type DatevBookingLine } from '../lib/datev-exporter';
import { generateDsfinvkTables } from '../lib/dsfinvk-exporter';
import { checkAndTriggerLowStockAlert } from '../lib/low-stock-notifier';
import { getOrCreateOpenPeriod, computePeriodTotals } from '../lib/register-period';
import { runDiagnostics } from '../lib/diagnostics';

describe('OpenBon v0.2.1: Vollständiger E2E-Lebenszyklus- & Systemtest', () => {
  let testCategoryId: string;
  let testBeerProductId: string;
  let testSchnapsProductId: string;
  let testTableId: string;
  let testTipProfileId: string;
  let testWaiterId: string;

  beforeAll(async () => {
    // 0. Alte Testdaten bereinigen
    await prisma.orderItem.deleteMany({ where: { productName: { startsWith: 'E2E ' } } });
    await prisma.paymentItem.deleteMany({ where: { productName: { startsWith: 'E2E ' } } });
    await prisma.payment.deleteMany({ where: { waiterName: 'E2E Max Kellner' } });
    await prisma.order.deleteMany({ where: { waiterName: 'E2E Max Kellner' } });
    await prisma.diningTable.deleteMany({ where: { tableNumber: 888 } });
    await prisma.waiterProfile.deleteMany({ where: { name: 'E2E Max Kellner' } });
    await prisma.tipProfile.deleteMany({ where: { name: 'E2E Gastro Pool 70/15/15' } });
    await prisma.product.deleteMany({ where: { name: { startsWith: 'E2E ' } } });
    await prisma.productCategory.deleteMany({ where: { name: 'E2E Getränke' } });

    // 1. Initialisiere / verifiziere Event-Konfiguration
    await prisma.eventConfig.upsert({
      where: { id: 'default' },
      update: {
        name: 'OpenBon E2E Festival 2026',
        trainingMode: false,
        enableGuestSelfOrder: true,
        enableKioskMode: true,
        enableAgeVerificationAlerts: true,
        enableDigitalReceiptQr: true,
        datevConsultantNumber: '12345',
        datevClientNumber: '67890',
        datevCashAccount: '1000',
      },
      create: {
        id: 'default',
        name: 'OpenBon E2E Festival 2026',
        trainingMode: false,
        enableGuestSelfOrder: true,
        enableKioskMode: true,
        enableAgeVerificationAlerts: true,
        enableDigitalReceiptQr: true,
        datevConsultantNumber: '12345',
        datevClientNumber: '67890',
        datevCashAccount: '1000',
      },
    });

    // 2. Kategorie anlegen
    const category = await prisma.productCategory.create({
      data: {
        name: 'E2E Getränke',
        sortIndex: 1,
        color: '#3b82f6',
      },
    });
    testCategoryId = category.id;

    // 3. Artikel mit V2-Attributen anlegen (Allergene, Jugendschutz 16/18, Happy Hour, Meldebestand)
    const beerProduct = await prisma.product.create({
      data: {
        name: 'E2E Festbier 0,5l',
        price: 4.5,
        deposit: 1.0,
        taxRate: 19.0,
        categoryId: testCategoryId,
        hasAgeRestriction: true,
        minAge: 16,
        allergens: JSON.stringify(['GLUTEN']),
        happyHourPrice: 3.5,
        happyHourStart: '17:00',
        happyHourEnd: '19:00',
        happyHourDays: '[1,2,3,4,5,6,0]',
        trackStock: true,
        stockQuantity: 10,
        minStockAlert: 4,
      },
    });
    testBeerProductId = beerProduct.id;

    const schnapsProduct = await prisma.product.create({
      data: {
        name: 'E2E Obstler 2cl',
        price: 3.0,
        deposit: 0.0,
        taxRate: 19.0,
        categoryId: testCategoryId,
        hasAgeRestriction: true,
        minAge: 18,
        allergens: '[]',
        trackStock: true,
        stockQuantity: 20,
        minStockAlert: 5,
      },
    });
    testSchnapsProductId = schnapsProduct.id;

    // 4. Tisch anlegen
    const table = await prisma.diningTable.create({
      data: {
        tableNumber: 888,
        label: 'E2E VIP Tisch 888',
        section: 'VIP',
        status: 'FREE',
      },
    });
    testTableId = table.id;

    // 5. Trinkgeld-Profil und Kellner anlegen
    const tipProfile = await prisma.tipProfile.create({
      data: {
        name: 'E2E Gastro Pool 70/15/15',
        waiterPercent: 70.0,
        barPoolPercent: 15.0,
        kitchenPoolPercent: 15.0,
        servicePoolPercent: 0.0,
        isDefault: false,
      },
    });
    testTipProfileId = tipProfile.id;

    const waiter = await prisma.waiterProfile.create({
      data: {
        name: 'E2E Max Kellner',
        pin: '5555',
        tipProfileId: testTipProfileId,
      },
    });
    testWaiterId = waiter.id;
  });

  // TEST 1: Einstellungs- & Konfigurations-Update
  it('1. sollte Konfigurationseinstellungen fehlerfrei lesen und aktualisieren', async () => {
    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    expect(config).toBeDefined();
    expect(config?.name).toBe('OpenBon E2E Festival 2026');
    expect(config?.enableGuestSelfOrder).toBe(true);
    expect(config?.enableDigitalReceiptQr).toBe(true);
  });

  // TEST 2: Compliance & Jugendschutz & Allergen-Matrix
  it('2. sollte Jugendschutz-Geburtsdaten und Allergenfilter korrekt berechnen', async () => {
    const refDate = new Date('2026-08-24T12:00:00Z');
    const age16 = calculateMinBirthdate(16, refDate);
    const age18 = calculateMinBirthdate(18, refDate);

    expect(age16.formattedDate).toBe('24.08.2010');
    expect(age18.formattedDate).toBe('24.08.2008');

    // Allergen-Exklusionsfilter
    const allProducts = await prisma.product.findMany({ where: { categoryId: testCategoryId } });
    const noGluten = filterProductsByExcludedAllergens(allProducts, ['GLUTEN']);
    
    // Festbier enthält Gluten -> wird gefiltert, Obstler bleibt
    expect(noGluten.some((p) => p.id === testBeerProductId)).toBe(false);
    expect(noGluten.some((p) => p.id === testSchnapsProductId)).toBe(true);
  });

  // TEST 3: Happy-Hour Aktionspreis-Auflösung
  it('3. sollte Happy-Hour Preise innerhalb des Zeitfensters auflösen', async () => {
    const product = await prisma.product.findUnique({ where: { id: testBeerProductId } });
    expect(product).toBeDefined();

    // 18:00 Uhr -> Happy Hour aktiv
    const activeDate = new Date('2026-08-24T18:00:00');
    const resActive = getEffectiveProductPrice(product!, activeDate);
    expect(resActive.isHappyHour).toBe(true);
    expect(resActive.price).toBe(3.5);

    // 21:00 Uhr -> Standardpreis
    const inactiveDate = new Date('2026-08-24T21:00:00');
    const resInactive = getEffectiveProductPrice(product!, inactiveDate);
    expect(resInactive.isHappyHour).toBe(false);
    expect(resInactive.price).toBe(4.5);
  });

  // TEST 4: Trinkgeld-Verteilung & Pool-Berechnung
  it('4. sollte Trinkgeld exakt auf Kellner und Pools aufteilen', async () => {
    const profile = await prisma.tipProfile.findUnique({ where: { id: testTipProfileId } });
    expect(profile).toBeDefined();

    const tipDistribution = calculateTipDistribution(10.0, profile);
    expect(tipDistribution.totalTip).toBe(10.0);
    expect(tipDistribution.waiterShare).toBe(7.0);
    expect(tipDistribution.barShare).toBe(1.5);
    expect(tipDistribution.kitchenShare).toBe(1.5);
    expect(tipDistribution.poolShare).toBe(3.0);
  });

  // TEST 5: Bestellungsanlage (Kellner-Tischbestellung) mit Lagerabzug
  it('5. sollte eine Tischbestellung anlegen und den Lagerbestand aktualisieren', async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: 9991,
        tableId: testTableId,
        waiterName: 'E2E Max Kellner',
        orderType: 'TABLE',
        source: 'WAITER',
        status: 'OPEN',
        items: {
          create: [
            {
              productId: testBeerProductId,
              productName: 'E2E Festbier 0,5l',
              quantity: 2,
              unitPrice: 4.5,
              deposit: 1.0,
              taxRate: 19.0,
              courseNumber: 1,
              kdsStatus: 'PENDING',
              printStatus: 'PENDING',
            },
            {
              productId: testSchnapsProductId,
              productName: 'E2E Obstler 2cl',
              quantity: 1,
              unitPrice: 3.0,
              deposit: 0.0,
              taxRate: 19.0,
              courseNumber: 2,
              kdsStatus: 'PENDING',
              printStatus: 'PENDING',
            },
          ],
        },
      },
      include: { items: true },
    });

    expect(order.id).toBeDefined();
    expect(order.items.length).toBe(2);

    // Lagerbestand reduzieren & Meldebestand prüfen
    await prisma.product.update({
      where: { id: testBeerProductId },
      data: { stockQuantity: 3 }, // Unterschreitet minStockAlert 4
    });

    const alertResult = await checkAndTriggerLowStockAlert(testBeerProductId, 3);
    expect(alertResult?.alertTriggered).toBe(true);
    expect(alertResult?.currentQuantity).toBe(3);
  });

  // TEST 6: Bezahlvorgang mit digitalem Beleg (E-Bon)
  it('6. sollte einen Kassiervorgang buchen und den E-Bon Code erzeugen', async () => {
    const period = await getOrCreateOpenPeriod();
    const order = await prisma.order.findFirst({
      where: { tableId: testTableId, status: 'OPEN' },
      include: { items: true },
    });
    expect(order).toBeDefined();

    const receiptCode = generateDigitalReceiptCode(`E2E-BELEG-${order!.id}`);
    const receiptUrl = buildReceiptUrl('http://openbon.local', receiptCode);

    const payment = await prisma.payment.create({
      data: {
        order: { connect: { id: order!.id } },
        period: { connect: { id: period.id } },
        table: { connect: { id: testTableId } },
        waiter: { connect: { id: testWaiterId } },
        invoiceNumber: 'RE-9991',
        waiterName: 'E2E Max Kellner',
        paymentMethod: 'CASH',
        totalGross: 14.0, // (2 * 5.50) + 3.00 = 14.00
        totalNet: 11.76,
        totalTax: 2.24,
        totalDeposit: 2.0,
        tipAmount: 2.0,
        tipWaiterShare: 1.4,
        tipPoolShare: 0.6,
        givenAmount: 20.0,
        changeAmount: 4.0,
        digitalReceiptCode: receiptCode,
        items: {
          create: order!.items.map((i) => ({
            productName: i.productName,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            deposit: i.deposit,
            taxRate: i.taxRate,
          })),
        },
      },
    });

    expect(payment.id).toBeDefined();
    expect(payment.digitalReceiptCode).toBe(receiptCode);
    expect(receiptUrl).toContain('http://openbon.local/receipt/EBON-');

    // Tisch freigeben & Order abschließen
    await prisma.order.update({
      where: { id: order!.id },
      data: { status: 'COMPLETED' },
    });
    await prisma.diningTable.update({
      where: { id: testTableId },
      data: { status: 'FREE' },
    });
  });

  // TEST 7: X-Bon und Kassenperioden-Statistiken
  it('7. sollte Kassenabschluss- und X-Bon Totals ohne Fehler aggregieren', async () => {
    const period = await getOrCreateOpenPeriod();
    const totals = await computePeriodTotals({
      periodId: period.id,
      includeUnassigned: true,
    });

    expect(totals).toBeDefined();
    expect(totals.totalGross).toBeGreaterThanOrEqual(14.0);
    expect(totals.totalCash).toBeGreaterThanOrEqual(14.0);
    expect(totals.totalTips).toBeGreaterThanOrEqual(2.0);
  });

  // TEST 8: DATEV & DSFinV-K Export-Erzeugung
  it('8. sollte DATEV EXTF 700 und DSFinV-K 2.3 Tabellen mit SHA-256 generieren', async () => {
    // DATEV
    const bookingLines: DatevBookingLine[] = [
      {
        amountGross: 14.0,
        isDebit: true,
        account: '1000',
        contraAccount: '8400',
        bookingDate: new Date('2026-08-24T18:00:00'),
        documentNumber: 'Z-E2E-01',
        text: 'E2E Tagesumsatz 19%',
      },
    ];
    const datevCsv = generateDatevCsv(bookingLines, {
      consultantNumber: '12345',
      clientNumber: '67890',
      cashAccount: '1000',
    });
    expect(datevCsv).toContain('"EXTF";700;21;"Buchungsstapel"');
    expect(datevCsv).toContain('14,00;"S";"EUR"');

    // DSFinV-K
    const dsfinvk = generateDsfinvkTables(
      [
        {
          bonId: 'e2e-bon-1',
          bonNr: 'BELEG-E2E-001',
          bonTyp: 'BELEG',
          bonStatus: 'ABGESCHLOSSEN',
          zeitBeginn: '2026-08-24T18:00:00Z',
          zeitEnde: '2026-08-24T18:02:00Z',
          kassenId: 'POS-E2E',
          bedienerName: 'E2E Max Kellner',
        },
      ],
      [
        {
          bonId: 'e2e-bon-1',
          posZeile: 1,
          artikeltext: 'E2E Festbier 0,5l',
          menge: 2,
          einzelpreisGross: 4.5,
          gesamtGross: 9.0,
          ustSatz: 19.0,
        },
      ],
      [
        {
          bonId: 'e2e-bon-1',
          ustSatz: 19.0,
          netto: 7.56,
          ust: 1.44,
          brutto: 9.0,
        },
      ]
    );

    expect(dsfinvk.bonkopfCsv).toContain('BON_ID;BON_NR;BON_TYP;BON_STATUS');
    expect(dsfinvk.bonposCsv).toContain('e2e-bon-1;1;"E2E Festbier 0,5l";2;4,50;9,00;19,0');
    expect(dsfinvk.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  // TEST 9: System-Selbstdiagnose (Self-Healing)
  it('9. sollte die Systemdiagnose erfolgreich ausführen', async () => {
    const diag = await runDiagnostics(false);
    expect(diag).toBeDefined();
    expect(Array.isArray(diag.checks)).toBe(true);
    expect(diag.checks.some((c) => c.id === 'database')).toBe(true);
  });
});
