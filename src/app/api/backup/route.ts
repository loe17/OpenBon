import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { APP_VERSION } from '@/lib/version';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const incConfig = searchParams.get('incConfig') !== '0';
    const incProducts = searchParams.get('incProducts') !== '0';
    const incWordGroups = searchParams.get('incWordGroups') !== '0';
    const incTables = searchParams.get('incTables') !== '0';
    const incPrinters = searchParams.get('incPrinters') !== '0';
    const incStock = searchParams.get('incStock') !== '0';
    const incOrders = searchParams.get('incOrders') === '1'; // Default off unless requested
    const incPayments = searchParams.get('incPayments') === '1';

    const config = incConfig ? await prisma.eventConfig.findUnique({ where: { id: 'default' } }) : null;
    const categories = incProducts
      ? await prisma.productCategory.findMany({
          include: {
            products: {
              include: {
                variants: true,
                options: true,
                stockItem: incStock,
              },
            },
          },
        })
      : null;

    const wordGroups = incWordGroups ? await prisma.customizationWordGroup.findMany() : null;
    const tables = incTables ? await prisma.diningTable.findMany() : null;
    const printers = incPrinters ? await prisma.printer.findMany() : null;
    const printGroups = incPrinters ? await prisma.printGroup.findMany() : null;
    const stockItems = incStock ? await prisma.stockItem.findMany() : null;
    const orders = incOrders ? await prisma.order.findMany({ include: { items: true } }) : null;
    const payments = incPayments ? await prisma.payment.findMany({ include: { items: true } }) : null;

    const backupData = {
      system: 'OpenBon',
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      eventName: config?.name || 'Veranstaltung',
      scopes: {
        config: incConfig,
        products: incProducts,
        wordGroups: incWordGroups,
        tables: incTables,
        printers: incPrinters,
        stock: incStock,
        orders: incOrders,
        payments: incPayments,
      },
      config,
      categories,
      wordGroups,
      tables,
      printers,
      printGroups,
      stockItems,
      orders,
      payments,
    };

    const fileName = `OpenBon_Backup_${(config?.name || 'Veranstaltung').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;

    return new Response(JSON.stringify(backupData, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const backupData = body.data || body;
    const restoreOptions = body.options || {
      config: true,
      products: true,
      wordGroups: true,
      tables: true,
      printers: true,
      stock: true,
      orders: false,
      payments: false,
    };

    if (!backupData.categories && !backupData.tables && !backupData.config) {
      return NextResponse.json({ error: 'Ungültige OpenBon Backup-Datei' }, { status: 400 });
    }

    // 1. Restore Config
    if (restoreOptions.config && backupData.config) {
      await prisma.eventConfig.upsert({
        where: { id: 'default' },
        update: backupData.config,
        create: backupData.config,
      });
    }

    // 2. Restore Word Groups
    if (restoreOptions.wordGroups && backupData.wordGroups) {
      await prisma.customizationWordGroup.deleteMany({});
      for (const wg of backupData.wordGroups) {
        await prisma.customizationWordGroup.create({
          data: {
            id: wg.id,
            name: wg.name,
            words: typeof wg.words === 'string' ? wg.words : JSON.stringify(wg.words),
            sortIndex: wg.sortIndex || 0,
          },
        });
      }
    }

    // 3. Restore Printers & Groups
    if (restoreOptions.printers && backupData.printers) {
      for (const p of backupData.printers) {
        await prisma.printer.upsert({
          where: { id: p.id },
          update: p,
          create: p,
        });
      }
    }

    if (restoreOptions.printers && backupData.printGroups) {
      for (const pg of backupData.printGroups) {
        await prisma.printGroup.upsert({
          where: { id: pg.id },
          update: { name: pg.name, printerId: pg.printerId, maxItemsPerTicket: pg.maxItemsPerTicket, autoCut: pg.autoCut },
          create: { id: pg.id, name: pg.name, printerId: pg.printerId, maxItemsPerTicket: pg.maxItemsPerTicket, autoCut: pg.autoCut },
        });
      }
    }

    // 4. Restore Categories & Products
    if (restoreOptions.products && backupData.categories) {
      for (const cat of backupData.categories) {
        await prisma.productCategory.upsert({
          where: { id: cat.id },
          update: { name: cat.name, sortIndex: cat.sortIndex, color: cat.color, icon: cat.icon },
          create: { id: cat.id, name: cat.name, sortIndex: cat.sortIndex, color: cat.color, icon: cat.icon },
        });

        if (cat.products) {
          for (const prod of cat.products) {
            await prisma.product.upsert({
              where: { id: prod.id },
              update: {
                name: prod.name,
                alternativeTicketName: prod.alternativeTicketName,
                price: prod.price,
                deposit: prod.deposit,
                taxRate: prod.taxRate,
                buttonColor: prod.buttonColor,
                status: prod.status,
                sortIndex: prod.sortIndex,
                categoryId: cat.id,
                printGroupId: prod.printGroupId,
              },
              create: {
                id: prod.id,
                name: prod.name,
                alternativeTicketName: prod.alternativeTicketName,
                price: prod.price,
                deposit: prod.deposit,
                taxRate: prod.taxRate,
                buttonColor: prod.buttonColor,
                status: prod.status,
                sortIndex: prod.sortIndex,
                categoryId: cat.id,
                printGroupId: prod.printGroupId,
              },
            });
          }
        }
      }
    }

    // 5. Restore Tables
    if (restoreOptions.tables && backupData.tables) {
      for (const t of backupData.tables) {
        await prisma.diningTable.upsert({
          where: { id: t.id },
          update: { tableNumber: t.tableNumber, label: t.label, gridX: t.gridX, gridY: t.gridY, status: t.status },
          create: { id: t.id, tableNumber: t.tableNumber, label: t.label, gridX: t.gridX, gridY: t.gridY, status: t.status },
        });
      }
    }

    // 6. Restore Orders & Payments if selected
    if (restoreOptions.orders && backupData.orders) {
      for (const ord of backupData.orders) {
        await prisma.order.upsert({
          where: { id: ord.id },
          update: { status: ord.status },
          create: {
            id: ord.id,
            orderNumber: ord.orderNumber,
            tableId: ord.tableId,
            waiterName: ord.waiterName,
            deviceId: ord.deviceId,
            status: ord.status,
            orderType: ord.orderType,
            tokenNumber: ord.tokenNumber,
            isTraining: ord.isTraining,
            createdAt: new Date(ord.createdAt),
          },
        });
      }
    }

    return NextResponse.json({ success: true, message: 'Ausgewählte Backup-Bereiche erfolgreich wiederhergestellt!' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
