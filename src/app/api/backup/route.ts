import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import { APP_VERSION } from '@/lib/version';
import { requireAdmin } from '@/lib/admin-guard';
import { requireApiAuth } from '@/lib/api-guard';
import {
  sanitizeConfigInput,
  hashPlaintextConfigPins,
} from '@/lib/config-whitelist';

export async function GET(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const incConfig = searchParams.get('incConfig') !== '0';
    const incProducts = searchParams.get('incProducts') !== '0';
    const incWordGroups = searchParams.get('incWordGroups') !== '0';
    const incTables = searchParams.get('incTables') !== '0';
    const incPrinters = searchParams.get('incPrinters') !== '0';
    const incStock = searchParams.get('incStock') !== '0';
    // Umsatz gehört zur Standard-Sicherung (sonst Datenverlust per Design)
    const incOrders = searchParams.get('incOrders') !== '0';
    const incPayments = searchParams.get('incPayments') !== '0';

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

    const { sessionSecret, haSyncSecret, stripeSecretKey, vrPayApiKey, zvtPassword, adminPin, posPin, kitchenPin, waiterPin, ...safeConfig } = (config as Record<string, unknown>) || {};
    const backupData = {
      system: 'OpenBon',
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      eventName: (config as { name?: string })?.name || 'Veranstaltung',
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
      config: safeConfig,
      categories,
      wordGroups,
      tables,
      printers,
      printGroups,
      stockItems,
      orders,
      payments,
    };

    const fileName = `OpenBon_Backup_${(((config as { name?: string })?.name) || 'Veranstaltung').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;

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
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  const denied = await requireAdmin(req);
  if (denied) return denied;
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
      orders: true,
      payments: true,
    };

    if (!backupData.categories && !backupData.tables && !backupData.config) {
      return NextResponse.json({ error: 'Ungültige OpenBon Backup-Datei' }, { status: 400 });
    }

    // 1. Restore Config
    // M5.3: Kein Mass-Assignment mehr - nur Whitelist-Felder, PINs gehasht,
    // sessionSecret/haSyncSecret sind in der Whitelist gesperrt.
    if (restoreOptions.config && backupData.config) {
      const restoredConfig = hashPlaintextConfigPins(
        sanitizeConfigInput(backupData.config as Record<string, unknown>)
      );
      await prisma.eventConfig.upsert({
        where: { id: 'default' },
        update: restoredConfig,
        create: restoredConfig,
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
                priceCents: prod.priceCents ?? Math.round((prod.price ?? 0) * 100),
                depositCents: prod.depositCents ?? Math.round((prod.deposit ?? 0) * 100),
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
                priceCents: prod.priceCents ?? Math.round((prod.price ?? 0) * 100),
                depositCents: prod.depositCents ?? Math.round((prod.deposit ?? 0) * 100),
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

    // 6. Restore Orders (mit Positionen) & Payments (mit Positionen)
    let restoredOrders = 0;
    let restoredPayments = 0;
    let skippedPayments = 0;
    if (restoreOptions.orders && backupData.orders) {
      for (const ord of backupData.orders) {
        const res = await prisma.order.upsert({
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
            items: ord.items
              ? {
                  create: ord.items.map((i: Record<string, unknown>) => ({
                    productId: String(i.productId || ''),
                    productName: String(i.productName || ''),
                    quantity: Number(i.quantity || 1),
                    unitPriceCents: Number((i as { unitPriceCents?: unknown }).unitPriceCents ?? 0),
                    depositCents: Number((i as { depositCents?: unknown }).depositCents ?? 0),
                    taxRate: Number(i.taxRate ?? 19),
                  })),
                }
              : undefined,
          },
        });
        void res;
        restoredOrders++;
      }
    }
    if (restoreOptions.payments && backupData.payments) {
      for (const pay of backupData.payments) {
        try {
          await prisma.payment.upsert({
            where: { id: pay.id },
            update: {},
            create: {
              id: pay.id,
              invoiceNumber: pay.invoiceNumber,
              tableId: pay.tableId,
              orderId: pay.orderId,
              waiterName: pay.waiterName,
              totalGrossCents: Number(pay.totalGrossCents ?? 0),
              totalNetCents: Number(pay.totalNetCents ?? 0),
              totalTaxCents: Number(pay.totalTaxCents ?? 0),
              paymentMethod: pay.paymentMethod || 'CASH',
              isTraining: Boolean(pay.isTraining),
              createdAt: new Date(pay.createdAt),
              items: pay.items
                ? {
                    create: pay.items.map((i: Record<string, unknown>) => ({
                      productName: String(i.productName || ''),
                      quantity: Number(i.quantity || 1),
                      unitPriceCents: Number((i as { unitPriceCents?: unknown }).unitPriceCents ?? 0),
                      depositCents: Number((i as { depositCents?: unknown }).depositCents ?? 0),
                      taxRate: Number(i.taxRate ?? 19),
                    })),
                  }
                : undefined,
            },
          });
          restoredPayments++;
        } catch {
          // Belegnummer bereits vergeben → überspringen statt Restore abbrechen
          skippedPayments++;
        }
      }
    }

    await logSystemActionSafe(() => ({
      action: 'BACKUP_CREATED',
      category: 'SYSTEM',
      actor: auth.session.waiterName || auth.session.role,
      details: `Datensicherung wiederhergestellt (Orders: ${restoredOrders}, Payments: ${restoredPayments}, übersprungen: ${skippedPayments}).`,
    }));

    return NextResponse.json({
      success: true,
      message: `Ausgewählte Backup-Bereiche erfolgreich wiederhergestellt! (Orders: ${restoredOrders}, Payments: ${restoredPayments}, übersprungen: ${skippedPayments})`,
      restoredOrders,
      restoredPayments,
      skippedPayments,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
