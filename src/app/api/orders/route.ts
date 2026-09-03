import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import TicketSplitter from '@/lib/printer/ticket-splitter';
import haService from '@/lib/ha/ha-service';
import { getEffectiveProductPrice, toCents } from '@/lib/pricing';
import { checkAndTriggerLowStockAlert } from '@/lib/low-stock-notifier';
import { validateBody, CreateOrderSchema } from '@/lib/validations/schemas';
import { requireApiAuth } from '@/lib/api-guard';

import { assertStockUnitsAvailable, applyStockConsumption } from '@/lib/stock';
import { resolveOrderItem } from '@/lib/product-resolve';
export async function GET(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const tableId = searchParams.get('tableId');
    const status = searchParams.get('status');
    const isKds = searchParams.get('kds') === 'true';
    const waiterName = searchParams.get('waiterName');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;
    const sort = searchParams.get('sort') || (waiterName ? 'desc' : 'asc');

    const where: Record<string, unknown> = {};
    if (tableId) where.tableId = tableId;
    if (status) where.status = status;
    if (waiterName) where.waiterName = waiterName;

    if (isKds) {
      where.status = { in: ['OPEN', 'IN_PREPARATION', 'READY'] };
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: sort === 'desc' ? 'desc' : 'asc' },
      take: limit,
      include: {
        table: true,
        items: {
          include: {
            product: {
              include: {
                category: true,
                printGroup: {
                  include: { printer: true },
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json(orders);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;
  const { denyStandbyWrite } = await import('@/lib/ha/ha-guard');
  const denied = denyStandbyWrite();
  if (denied) return denied;

  try {
    const validation = await validateBody(req, CreateOrderSchema);
    if (!validation.success) {
      return validation.response;
    }
    const body = validation.data;
    const idempotencyKey = req.headers.get('x-idempotency-key') || body.idempotencyKey;

    const normalizedOrderType =
      body.orderType === 'DIRECT_SALE'
        ? 'COUNTER_DIRECT'
        : body.orderType === 'VOUCHER'
        ? 'COUNTER_VOUCHER'
        : body.orderType || 'TABLE';

    const isCounterOrKiosk =
      normalizedOrderType === 'COUNTER_VOUCHER' ||
      normalizedOrderType === 'COUNTER_DIRECT' ||
      normalizedOrderType === 'KIOSK';

    const now = new Date();

    // 1. Produkte laden (Preise, Varianten, Optionen, StockItem)
    const productIds = ((body.items || []) as { productId: string }[]).map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        stockItem: true,
        variants: true,
        options: true,
      },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    // 2. Transaktionale Ausführung (Sequenzen, Idempotenz, Bestandsabzug, Order, Table)
    const result = await prisma.$transaction(async (tx) => {
      // 0. Idempotenz-Prüfung innerhalb der Transaktion
      if (idempotencyKey) {
        const existing = await tx.idempotencyKey.findUnique({
          where: { key: String(idempotencyKey) },
        });
        if (existing) {
          return { isReplay: true, response: JSON.parse(existing.responseJson), statusCode: existing.statusCode };
        }
      }

      // EventConfig laden & Sequenzen atomar hochzählen
      const config = await tx.eventConfig.findUnique({ where: { id: 'default' } });
      const isTraining = config?.trainingMode ?? false;

      // Sequenzen zuerst atomar hochzaehlen und anschliessend den Wert VOR dem
      // Inkrement verwenden. Ein vorheriges Lesen mit spaeterem Update konnte
      // dieselbe Nummer zweimal vergeben, sobald parallel ueber
      // /api/orders/checkout oder /api/guest/orders kassiert wurde.
      const bumped = await tx.eventConfig.update({
        where: { id: 'default' },
        data: {
          orderSequence: { increment: 1 },
          ...(isCounterOrKiosk ? { tokenSequence: { increment: 1 } } : {}),
        },
      });

      const nextOrderNum = bumped.orderSequence - 1;
      let tokenNumber: number | null = null;

      if (isCounterOrKiosk) {
        tokenNumber = bumped.tokenSequence - 1;
      }

      // Lagerposten pruefen, BEVOR irgendetwas gebucht wird. Innerhalb
      // derselben Transaktion, damit zwei gleichzeitige Bestellungen denselben
      // Vorrat nicht doppelt verplanen koennen.
      await assertStockUnitsAvailable(tx, body.items || []);

      // Bestände prüfen & OrderItems vorbereiten
      const orderItemsData = [];
      for (const item of body.items || []) {
        const prod = productMap.get(item.productId);
        if (!prod) continue;

        // Bestand prüfen
        if (prod.stockItem && prod.stockItem.currentQuantity < item.quantity) {
          throw new Error(`Artikel "${prod.name}" ist leider ausverkauft oder nicht mehr ausreichend verfügbar!`);
        }

        const { price: effectiveBasePrice } = getEffectiveProductPrice({ price: prod.priceCents / 100, happyHourPrice: prod.happyHourPriceCents != null ? prod.happyHourPriceCents / 100 : null, happyHourStart: prod.happyHourStart, happyHourEnd: prod.happyHourEnd, happyHourDays: prod.happyHourDays, happyHourRules: prod.happyHourRules } as any, now);

        // Untereintrag und Optionen an EINER Stelle aufloesen (src/lib/product-resolve.ts):
        // Vererbung der Untereintrags-Felder, Optionen mit Anzahl, Preis serverseitig.
        // DB liefert Cents, Lib rechnet in Euro -> Shim + toCents zurück.
        const resolved = resolveOrderItem({ id: prod.id, name: prod.name, depositCents: prod.depositCents, taxRate: prod.taxRate, alternativeTicketName: (prod as any).alternativeTicketName, color: (prod as any).buttonColor, printGroupId: (prod as any).printGroupId, variants: (prod.variants || []).map((v: any) => ({ id: v.id, name: v.name, priceDelta: v.priceDeltaCents / 100, alternativeTicketName: v.alternativeTicketName, color: v.color, printGroupId: v.printGroupId, deposit: v.depositCents != null ? v.depositCents / 100 : null, taxRate: v.taxRate })), options: (prod.options || []).map((o: any) => ({ id: o.id, name: o.name, priceDelta: o.priceDeltaCents / 100, defaultQuantity: o.defaultQuantity, maxQuantity: o.maxQuantity })) } as any, effectiveBasePrice, {
          variantName: item.variantName,
          selectedOptions: item.selectedOptions,
        });
        const unitPriceCents = toCents(resolved.unitPrice);

        orderItemsData.push({
          productId: prod.id,
          productName: prod.name,
          quantity: item.quantity,
          unitPriceCents,
          depositCents: toCents(resolved.deposit),
          taxRate: resolved.taxRate,
          variantName: resolved.variantName,
          // Normalisiert als [{name, quantity}] speichern, damit Auswertung,
          // Bondruck und Lagerabbau dieselbe Anzahl sehen.
          selectedOptions: resolved.options.length > 0 ? JSON.stringify(resolved.options) : null,
          customizationText: item.customizationText || null,
          courseNumber: Number(item.courseNumber) > 0 ? Number(item.courseNumber) : 1,
          isHold: Boolean(item.isHold),
          printStatus: item.isHold ? 'HELD' : 'PENDING',
          kdsStatus: 'PENDING',
        });

        // Einmaliger, sauberer Bestandsabzug auf StockItem
        if (prod.stockItem && !isTraining) {
          const newQty = Math.max(0, prod.stockItem.currentQuantity - item.quantity);
          await tx.stockItem.update({
            where: { id: prod.stockItem.id },
            data: { currentQuantity: newQty },
          });

          if (newQty === 0 && prod.stockItem.isAutoDeactivate) {
            await tx.product.update({
              where: { id: prod.id },
              data: { status: 'INACTIVE', isSoldOut: true },
            });
          }
        }
      }

      // Verbrauch der Lagerposten abbuchen und leergelaufene Artikel sperren
      await applyStockConsumption(tx, body.items || [], { isTraining });

      // Order anlegen
      const createdOrder = await tx.order.create({
        data: {
          orderNumber: nextOrderNum,
          tableId: body.tableId || null,
          waiterId: body.waiterId || null,
          waiterName: body.waiterName || 'Bedienung',
          deviceId: body.deviceId || null,
          source: body.source || 'WAITER',
          status: 'OPEN',
          orderType: normalizedOrderType,
          tokenNumber,
          isTraining,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          table: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // Tisch auf OCCUPIED setzen
      if (body.tableId) {
        await tx.diningTable.update({
          where: { id: body.tableId },
          data: {
            status: 'OCCUPIED',
            activeWaiterName: body.waiterName || undefined,
          },
        });
      }

      // Idempotenz-Eintrag speichern
      if (idempotencyKey) {
        await tx.idempotencyKey.create({
          data: {
            key: String(idempotencyKey),
            endpoint: '/api/orders',
            statusCode: 200,
            responseJson: JSON.stringify(createdOrder),
          },
        });
      }

      return { order: createdOrder, tokenNumber };
    });

    if ('isReplay' in result && result.isReplay) {
      return NextResponse.json(result.response, {
        status: result.statusCode || 200,
        headers: { 'X-Idempotent-Replay': 'true' },
      });
    }

    const { order, tokenNumber } = result as { order: any; tokenNumber: number | null };

    // 3. Low-Stock Alerts prüfen
    for (const item of order.items) {
      if (item.product.trackStock) {
        const stock = await prisma.stockItem.findUnique({ where: { productId: item.productId } });
        if (stock) {
          await checkAndTriggerLowStockAlert(item.productId, stock.currentQuantity);
        }
      }
    }

    // 4. Ticket Routing & ESC/POS Printing (async ACK: PENDING bis Spooler-ACK)
    try {
      const { jobIds } = await TicketSplitter.routeAndPrintOrder({
        id: order.id,
        orderNumber: order.orderNumber,
        tableLabel: order.table?.label || (tokenNumber ? `Abholmarke #${tokenNumber}` : 'Theke'),
        waiterName: order.waiterName,
        tokenNumber: order.tokenNumber,
        isTraining: order.isTraining,
        createdAt: order.createdAt,
        items: order.items.map((i: any) => ({
          id: i.id,
          productId: i.productId,
          productName: i.productName,
          alternativeName: i.product?.alternativeTicketName,
          quantity: i.quantity,
          unitPriceCents: i.unitPriceCents,
          depositCents: i.depositCents ?? 0,
          variantName: i.variantName,
          selectedOptions: i.selectedOptions,
          customizationText: i.customizationText,
          courseNumber: i.courseNumber,
          isHold: i.isHold,
        })),
      });
      if (global.io && jobIds.length > 0) {
        global.io.emit('print:queued', { orderId: order.id, jobIds });
      }
    } catch (printErr) {
      console.error('Error during ticket print spooling:', printErr);
    }

    // 5. HA Replikations-Log
    await haService.logMutation('ORDER', order.id, 'INSERT', order);

    // 6. WebSocket Events
    if (global.io) {
      global.io.emit('order:new', order);
      if (body.tableId) {
        global.io.emit('table:updated', { tableId: body.tableId, status: 'OCCUPIED' });
      }
    }

    // 7. Revisionssichere Protokollierung (GoBD): Wer hat wann was erfasst.
    await logSystemActionSafe(() => {
      const itemSummary = ((order.items || []) as any[])
        .map((i: any) => `${i.quantity}x ${i.productName}${i.variantName ? ` (${i.variantName})` : ''}`)
        .join(', ');
      const totalSumCents = ((order.items || []) as any[]).reduce((s: number, i: any) => s + (Number(i.unitPriceCents) || 0) * (Number(i.quantity) || 1), 0);
      const tableInfo = order.tableLabel ? ` (Tisch ${order.tableLabel})` : '';

      return {
        action: 'ORDER_CREATED',
        category: 'ORDERS',
        actor: order.waiterName || auth.session.waiterName || auth.session.role,
        details: `Bestellung #${order.orderNumber}${tableInfo}: ${itemSummary || `${order.items?.length ?? 0} Position(en)`} – Gesamt: ${(totalSumCents / 100).toFixed(2)} €`,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          tableId: order.tableId,
          tableLabel: order.tableLabel,
          totalGrossCents: totalSumCents,
          itemCount: order.items?.length ?? 0,
          orderType: order.orderType,
          source: order.source,
        },
      };
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    const msg = error instanceof Error ? error.message : 'Fehler beim Erstellen der Bestellung';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
