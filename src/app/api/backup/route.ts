import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    const categories = await prisma.productCategory.findMany({ include: { products: { include: { variants: true, options: true } } } });
    const wordGroups = await prisma.customizationWordGroup.findMany();
    const tables = await prisma.diningTable.findMany();
    const printers = await prisma.printer.findMany();
    const printGroups = await prisma.printGroup.findMany();

    const backupData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      config,
      categories,
      wordGroups,
      tables,
      printers,
      printGroups,
    };

    return new Response(JSON.stringify(backupData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="Veranstaltung_Backup_${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const backupData = await req.json();
    if (!backupData.categories || !backupData.tables) {
      return NextResponse.json({ error: 'Ungültige Backup-Datei' }, { status: 400 });
    }

    // 1. Restore Config
    if (backupData.config) {
      await prisma.eventConfig.upsert({
        where: { id: 'default' },
        update: backupData.config,
        create: backupData.config,
      });
    }

    // 2. Restore Word Groups
    if (backupData.wordGroups) {
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
    if (backupData.printers) {
      for (const p of backupData.printers) {
        await prisma.printer.upsert({
          where: { id: p.id },
          update: p,
          create: p,
        });
      }
    }

    if (backupData.printGroups) {
      for (const pg of backupData.printGroups) {
        await prisma.printGroup.upsert({
          where: { id: pg.id },
          update: { name: pg.name, printerId: pg.printerId, maxItemsPerTicket: pg.maxItemsPerTicket, autoCut: pg.autoCut },
          create: { id: pg.id, name: pg.name, printerId: pg.printerId, maxItemsPerTicket: pg.maxItemsPerTicket, autoCut: pg.autoCut },
        });
      }
    }

    // 4. Restore Categories & Products
    if (backupData.categories) {
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
    if (backupData.tables) {
      for (const t of backupData.tables) {
        await prisma.diningTable.upsert({
          where: { id: t.id },
          update: { tableNumber: t.tableNumber, label: t.label, gridX: t.gridX, gridY: t.gridY, status: t.status },
          create: { id: t.id, tableNumber: t.tableNumber, label: t.label, gridX: t.gridX, gridY: t.gridY, status: t.status },
        });
      }
    }

    return NextResponse.json({ success: true, message: 'Veranstaltungsdaten erfolgreich wiederhergestellt!' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
