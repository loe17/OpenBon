const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('[OPENBON] Starte Initialisierung der Demo-Daten...');

  // 1. Event-Konfiguration
  await prisma.eventConfig.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      name: 'Großes Vereins- & Feuerwehrfest 2026',
      currency: 'EUR',
      taxRateNormal: 19.0,
      taxRateReduced: 7.0,
      trainingMode: false,
      haRole: 'PRIMARY',
      tokenSequence: 100,
      invoiceSequence: 1000,
    },
  });

  // 2. Drucker anlegen (Virtuelle Drucker für Tests)
  const kitchenPrinter = await prisma.printer.create({
    data: {
      name: 'Küche (Grill & Warmspeisen)',
      ipAddress: '192.168.1.201',
      port: 9100,
      paperWidth: 80,
      characterSet: 'CP858',
      isVirtual: true,
      isActive: true,
    },
  });

  const barPrinter = await prisma.printer.create({
    data: {
      name: 'Ausschank (Bier & Softdrinks)',
      ipAddress: '192.168.1.202',
      port: 9100,
      paperWidth: 80,
      characterSet: 'CP858',
      isVirtual: true,
      isActive: true,
    },
  });

  const posPrinter = await prisma.printer.create({
    data: {
      name: 'Thekenkasse / Bonkasse',
      ipAddress: '192.168.1.200',
      port: 9100,
      paperWidth: 80,
      characterSet: 'CP858',
      isVirtual: true,
      isActive: true,
    },
  });

  // 3. Druckgruppen anlegen
  const kitchenPrintGroup = await prisma.printGroup.create({
    data: {
      name: 'Küche',
      printerId: kitchenPrinter.id,
      maxItemsPerTicket: 1, // Jede Speise ein eigener Bon für die Küche
      autoCut: true,
    },
  });

  const drinksPrintGroup = await prisma.printGroup.create({
    data: {
      name: 'Ausschank',
      printerId: barPrinter.id,
      maxItemsPerTicket: 4, // Maximal 4 Getränke pro Tablett-Bon
      autoCut: true,
    },
  });

  // 4. Sonderwunsch-Wortgruppen
  await prisma.customizationWordGroup.create({
    data: {
      name: 'Präfixe',
      words: JSON.stringify(['ohne', 'extra', 'wenig', 'viel', 'gut durch']),
      sortIndex: 0,
    },
  });

  await prisma.customizationWordGroup.create({
    data: {
      name: 'Zutaten & Beilagen',
      words: JSON.stringify(['Zwiebeln', 'Ketchup', 'Senf', 'Mayonnaise', 'Eis', 'Zitrone', 'Sauce']),
      sortIndex: 1,
    },
  });

  // 5. Kategorien & Produkte
  const catDrinks = await prisma.productCategory.create({
    data: {
      name: 'Getränke',
      sortIndex: 0,
      color: '#3b82f6',
      icon: 'Beer',
    },
  });

  const catSoftdrinks = await prisma.productCategory.create({
    data: {
      name: 'Alkoholfrei',
      sortIndex: 1,
      color: '#06b6d4',
      icon: 'CupSoda',
    },
  });

  const catFood = await prisma.productCategory.create({
    data: {
      name: 'Speisen & Grill',
      sortIndex: 2,
      color: '#f97316',
      icon: 'Utensils',
    },
  });

  const catSnacks = await prisma.productCategory.create({
    data: {
      name: 'Kaffee & Kuchen',
      sortIndex: 3,
      color: '#eab308',
      icon: 'Coffee',
    },
  });

  // Produkte anlegen
  // 5.1 Getränke
  const bier = await prisma.product.create({
    data: {
      name: 'Festbier / Helles',
      alternativeTicketName: 'Bier 0,5',
      price: 4.50,
      deposit: 1.00, // 1€ Glaspfand
      taxRate: 19.0,
      buttonColor: '#3b82f6',
      sortIndex: 0,
      categoryId: catDrinks.id,
      printGroupId: drinksPrintGroup.id,
      variants: {
        create: [
          { name: '0,5 l (Halbe)', priceDelta: 0.0, sortIndex: 0 },
          { name: '1,0 l (Maß)', priceDelta: 4.50, sortIndex: 1 },
        ],
      },
    },
  });

  await prisma.product.create({
    data: {
      name: 'Radler naturtrüb',
      alternativeTicketName: 'Radler 0,5',
      price: 4.50,
      deposit: 1.00,
      taxRate: 19.0,
      buttonColor: '#60a5fa',
      sortIndex: 1,
      categoryId: catDrinks.id,
      printGroupId: drinksPrintGroup.id,
    },
  });

  await prisma.product.create({
    data: {
      name: 'Weizen / Weißbier',
      alternativeTicketName: 'Weizen 0,5',
      price: 4.80,
      deposit: 1.00,
      taxRate: 19.0,
      buttonColor: '#93c5fd',
      sortIndex: 2,
      categoryId: catDrinks.id,
      printGroupId: drinksPrintGroup.id,
    },
  });

  // 5.2 Softdrinks
  await prisma.product.create({
    data: {
      name: 'Cola / Spezi',
      alternativeTicketName: 'Cola 0,4',
      price: 3.50,
      deposit: 1.00,
      taxRate: 19.0,
      buttonColor: '#06b6d4',
      sortIndex: 0,
      categoryId: catSoftdrinks.id,
      printGroupId: drinksPrintGroup.id,
    },
  });

  await prisma.product.create({
    data: {
      name: 'Mineralwasser',
      alternativeTicketName: 'Wasser 0,5',
      price: 2.80,
      deposit: 1.00,
      taxRate: 19.0,
      buttonColor: '#67e8f9',
      sortIndex: 1,
      categoryId: catSoftdrinks.id,
      printGroupId: drinksPrintGroup.id,
    },
  });

  await prisma.product.create({
    data: {
      name: 'Apfelschorle',
      alternativeTicketName: 'Scho 0,4',
      price: 3.50,
      deposit: 1.00,
      taxRate: 19.0,
      buttonColor: '#22d3ee',
      sortIndex: 2,
      categoryId: catSoftdrinks.id,
      printGroupId: drinksPrintGroup.id,
    },
  });

  // 5.3 Speisen
  const schnitzel = await prisma.product.create({
    data: {
      name: 'Paniertes Schnitzel mit Pommes',
      alternativeTicketName: 'SchniPo',
      price: 11.50,
      deposit: 0.0,
      taxRate: 7.0, // 7% Speisen außer Haus / Verzehr im Zelt ermäßigt
      buttonColor: '#f97316',
      sortIndex: 0,
      categoryId: catFood.id,
      printGroupId: kitchenPrintGroup.id,
      options: {
        create: [
          { name: 'mit Zitrone', priceDelta: 0.0, sortIndex: 0 },
          { name: 'extra Portion Pommes', priceDelta: 2.50, sortIndex: 1 },
          { name: 'mit Bratensauce', priceDelta: 1.00, sortIndex: 2 },
        ],
      },
    },
  });

  const bratwurst = await prisma.product.create({
    data: {
      name: 'Rote Grillwurst im Brötchen',
      alternativeTicketName: 'Rote Wurst',
      price: 4.50,
      deposit: 0.0,
      taxRate: 7.0,
      buttonColor: '#fb923c',
      sortIndex: 1,
      categoryId: catFood.id,
      printGroupId: kitchenPrintGroup.id,
    },
  });

  await prisma.product.create({
    data: {
      name: 'Portion Pommes frites',
      alternativeTicketName: 'Pommes',
      price: 4.00,
      deposit: 0.0,
      taxRate: 7.0,
      buttonColor: '#fdba74',
      sortIndex: 2,
      categoryId: catFood.id,
      printGroupId: kitchenPrintGroup.id,
      options: {
        create: [
          { name: 'mit Ketchup', priceDelta: 0.0, sortIndex: 0 },
          { name: 'mit Mayo', priceDelta: 0.0, sortIndex: 1 },
          { name: 'Ketchup & Mayo (Rot-Weiß)', priceDelta: 0.50, sortIndex: 2 },
        ],
      },
    },
  });

  await prisma.product.create({
    data: {
      name: 'Kaffee Crema',
      alternativeTicketName: 'Kaffee',
      price: 2.50,
      deposit: 1.00,
      taxRate: 19.0,
      buttonColor: '#eab308',
      sortIndex: 0,
      categoryId: catSnacks.id,
    },
  });

  await prisma.product.create({
    data: {
      name: 'Stück Kuchen / Torte',
      alternativeTicketName: 'Kuchen',
      price: 3.00,
      deposit: 0.0,
      taxRate: 7.0,
      buttonColor: '#fde047',
      sortIndex: 1,
      categoryId: catSnacks.id,
    },
  });

  // 6. Lagerbestand anlegen
  await prisma.stockItem.create({
    data: {
      productId: schnitzel.id,
      initialQuantity: 100,
      currentQuantity: 85,
      alertThreshold: 10,
    },
  });

  await prisma.stockItem.create({
    data: {
      productId: bratwurst.id,
      initialQuantity: 150,
      currentQuantity: 120,
      alertThreshold: 15,
    },
  });

  // 7. Tischplan generieren (4 Reihen à 6 Tische = 24 Tische)
  let tableCount = 1;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 6; col++) {
      await prisma.diningTable.create({
        data: {
          tableNumber: tableCount,
          label: `Tisch ${tableCount}`,
          gridX: col,
          gridY: row,
          status: 'FREE',
        },
      });
      tableCount++;
    }
  }

  console.log('[OK] Demo-Stammdaten erfolgreich eingespielt.');
}

main()
  .catch((e) => {
    console.error('[ERROR] Fehler beim Seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
