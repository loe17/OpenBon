import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import TicketSplitter from '@/lib/printer/ticket-splitter';
import networkSpooler from '@/lib/printer/network-spooler';
import haService from '@/lib/ha/ha-service';
import { getEffectiveProductPrice } from '@/lib/pricing';
import { computeCheckout, findSplit, round2 } from '@/lib/pricing';
import { checkAndTriggerLowStockAlert } from '@/lib/low-stock-notifier';
import { validateBody, AtomicCheckoutSchema } from '@/lib/validations/schemas';
import { getOrCreateOpenPeriod } from '@/lib/register-period';
import { getPaymentLabel } from '@/lib/payment/methods';
import { generateDigitalReceiptCode, buildReceiptUrl } from '@/lib/digital-receipt';
import { calculateTipDistribution } from '@/lib/tips';
import { deductTapVolumeForItems } from '@/lib/tap-manager';
import type { TicketData } from '@/lib/printer/types';
import { requireApiAuth } from '@/lib/api-guard';

import { assertStockUnitsAvailable, applyStockConsumption } from '@/lib/stock';
import { resolveOrderItem } from '@/lib/product-resolve';
/**
 * Atomic Checkout: legt die Bestellung UND die sofortige Vollzahlung in EINER
 * Datenbank-Transaktion an. Bricht das Netz ab, gibt es weder einen offenen Bon
 * mit Bestandsabzug ohne Zahlung noch eine Zahlung ohne Bon.
 */
export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const validation = await validateBody(req, AtomicCheckoutSchema);
    if (!validation.success) {
      return validation.response;
    }
    const body = validation.data;

    const normalizedOrderType =
      body.orderType === 'DIRECT_SALE'
        ? 'COUNTER_DIRECT'
        : body.orderType === 'VOUCHER'
        ? 'COUNTER_VOUCHER'
        : body.orderType;

    const isCounterOrKiosk =
      normalizedOrderType === 'COUNTER_VOUCHER' ||
      normalizedOrderType === 'COUNTER_DIRECT' ||
      normalizedOrderType === 'KIOSK';

    const idempotencyKey = req.headers.get('x-idempotency-key') || body.idempotencyKey;
    const now = new Date();

    // Kassenperiode VOR der Transaktion oeffnen (nutzt eigene Connection)
    const period = await getOrCreateOpenPeriod();

    // 1. Produkte ausserhalb der Transaktion laden (nur lesend)
    const productIds = body.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { stockItem: true, variants: true, options: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    // 2. Alles in EINER Transaktion: Sequenzen, Bestand, Order, Payment, Tisch
    const result = await prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const existing = await tx.idempotencyKey.findUnique({
          where: { key: String(idempotencyKey) },
        });
        if (existing) {
          return { isReplay: true, response: JSON.parse(existing.responseJson), statusCode: existing.statusCode };
        }
      }

      const config = await tx.eventConfig.update({
        where: { id: 'default' },
        data: {
          orderSequence: { increment: 1 },
          ...(isCounterOrKiosk ? { tokenSequence: { increment: 1 } } : {}),
          invoiceSequence: { increment: 1 },
        },
      });

      // WICHTIG: Ueberall im System gilt "Wert VOR dem Inkrement" (siehe
      // invoiceSequence/tokenSequence sowie /api/orders). Wurde hier der Wert
      // NACH dem Inkrement verwendet, vergaben /api/orders und /api/orders/checkout
      // im Wechselbetrieb dieselbe Bestellnummer doppelt.
      const nextOrderNum = config.orderSequence - 1;
      let tokenNumber: number | null = null;
      const invoiceSeq = config.invoiceSequence - 1; // konsistent zur /api/payments-Nummerierung

      if (isCounterOrKiosk) {
        tokenNumber = config.tokenSequence - 1; // Wert VOR Inkrement = laufende Marke
      }

      // Lagerposten pruefen, bevor gebucht wird (siehe src/lib/stock.ts)
      await assertStockUnitsAvailable(tx, body.items || []);

      // Positionen vorbereiten: Preise serverseitig autoritativ berechnen
      const orderItemsData: Prisma.OrderItemUncheckedCreateWithoutOrderInput[] = [];
      for (const item of body.items) {
        const prod = productMap.get(item.productId);
        if (!prod) continue;

        if (prod.stockItem && prod.stockItem.currentQuantity < item.quantity) {
          throw new Error(`Artikel "${prod.name}" ist leider ausverkauft oder nicht mehr ausreichend verfügbar!`);
        }

        const { price: effectiveBasePrice } = getEffectiveProductPrice(prod, now);

        // Untereintrag und Optionen an EINER Stelle aufloesen (src/lib/product-resolve.ts):
        // Vererbung der Untereintrags-Felder, Optionen mit Anzahl, Preis serverseitig.
        const resolved = resolveOrderItem(prod, effectiveBasePrice, {
          variantName: item.variantName,
          selectedOptions: item.selectedOptions,
        });
        const unitPrice = resolved.unitPrice;

        orderItemsData.push({
          productId: prod.id,
          productName: prod.name,
          quantity: item.quantity,
          unitPrice,
          deposit: resolved.deposit,
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

        if (prod.stockItem && !config.trainingMode) {
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

      if (orderItemsData.length === 0) {
        throw new Error('Keine gültigen Artikel in der Bestellung gefunden.');
      }

      const invoiceNumber = `BELEG-${new Date().getFullYear()}-${String(invoiceSeq).padStart(5, '0')}`;
      const digitalReceiptCode = generateDigitalReceiptCode(invoiceNumber);

      // Bestellung anlegen (Positionen inklusive)
      // Verbrauch der Lagerposten abbuchen
      await applyStockConsumption(tx, body.items || [], { isTraining: config.trainingMode });

      const createdOrder = await tx.order.create({
        data: {
          orderNumber: nextOrderNum,
          tableId: body.tableId || null,
          waiterId: null,
          waiterName: body.waiterName || 'Bonkasse',
          deviceId: body.deviceId || null,
          source: body.source,
          status: 'COMPLETED', // wird sofort voll bezahlt
          orderType: normalizedOrderType,
          tokenNumber,
          isTraining: config.trainingMode,
          items: { create: orderItemsData },
        },
        include: {
          table: true,
          items: { include: { product: true } },
        },
      });

      // Cent-genau auf Basis der autoritativen Positionen abrechnen
      const checkout = computeCheckout({
        lines: createdOrder.items.map((i) => ({
          unitPrice: i.unitPrice,
          deposit: i.deposit,
          quantity: i.quantity,
          taxRate: i.taxRate,
        })),
        returnDepositAmount: 0,
        discountAmount: body.discountAmount ?? 0,
        surchargeFixed: 0,
        surchargePercent: 0,
        tipAmount: body.tipAmount ?? 0,
        givenAmount: body.givenAmount ?? undefined,
      });

      // Trinkgeld-Aufteilung nach Profil des Kassierers (falls vorhanden)
      const waiterProfile = body.waiterName
        ? await tx.waiterProfile.findFirst({
            where: { name: body.waiterName },
            include: { tipProfile: true },
          })
        : null;
      const tipDist = calculateTipDistribution(checkout.tipAmount, waiterProfile?.tipProfile);

      // Vollzahlung aller Posten verbuchen
      for (const item of createdOrder.items) {
        await tx.orderItem.update({
          where: { id: item.id },
          data: { paidQuantity: { increment: item.quantity } },
        });
      }

      const createdPayment = await tx.payment.create({
        data: {
          invoiceNumber,
          tableId: body.tableId || null,
          orderId: createdOrder.id,
          periodId: period.id,
          waiterId: waiterProfile?.id || null,
          waiterName: body.waiterName || 'Bonkasse',
          deviceId: body.deviceId || null,
          digitalReceiptCode,
          totalGross: checkout.amountDue,
          totalNet: checkout.netTotal,
          totalTax: checkout.taxTotal,
          taxBase19: findSplit(checkout.splits, 19).base,
          taxAmount19: findSplit(checkout.splits, 19).tax,
          taxBase7: findSplit(checkout.splits, 7).base,
          taxAmount7: findSplit(checkout.splits, 7).tax,
          taxBase0: findSplit(checkout.splits, 0).base,
          totalDeposit: checkout.depositTotal,
          returnDeposit: 0,
          discountAmount: checkout.discountAmount,
          tipAmount: checkout.tipAmount,
          tipWaiterShare: tipDist.waiterShare,
          tipPoolShare: tipDist.poolShare,
          givenAmount: checkout.givenAmount,
          changeAmount: checkout.changeAmount,
          paymentMethod: body.paymentMethod,
          isTraining: config.trainingMode,
          items: {
            create: createdOrder.items.map((i) => ({
              orderItemId: i.id,
              productName: i.productName,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              deposit: i.deposit,
              taxRate: i.taxRate,
            })),
          },
        },
        include: { table: true, items: true },
      });

      // Tisch freigeben (Counter-Bons haben i. d. R. keinen Tisch)
      if (body.tableId) {
        await tx.diningTable.update({
          where: { id: body.tableId },
          data: { status: 'FREE', activeWaiterName: null },
        });
      }

      if (idempotencyKey) {
        await tx.idempotencyKey.create({
          data: {
            key: String(idempotencyKey),
            endpoint: '/api/orders/checkout',
            statusCode: 200,
            responseJson: JSON.stringify({ order: createdOrder, payment: createdPayment }),
          },
        }).catch(() => {});
      }

      return { order: createdOrder, payment: createdPayment, checkout, tipDist, tokenNumber };
    });

    if ('isReplay' in result && result.isReplay) {
      return NextResponse.json(result.response, {
        status: result.statusCode || 200,
        headers: { 'X-Idempotent-Replay': 'true' },
      });
    }

    const { order, payment, checkout, tipDist } = result as any;

    // 3. Nachgelagerte, nicht-kritische Effekte (best-effort):
    // Low-Stock-Warnungen
    for (const item of order.items) {
      if (item.product?.trackStock) {
        const stock = await prisma.stockItem.findUnique({ where: { productId: item.productId } });
        if (stock) {
          await checkAndTriggerLowStockAlert(item.productId, stock.currentQuantity);
        }
      }
    }

    // Kuechen-/Schankbons drucken (nicht bei reinem Direktverkauf ohne Gaenge)
    try {
      await TicketSplitter.routeAndPrintOrder({
        id: order.id,
        orderNumber: order.orderNumber,
        tableLabel: order.table?.label || (order.tokenNumber ? `Abholmarke #${order.tokenNumber}` : 'Theke'),
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
          unitPrice: i.unitPrice,
          deposit: i.deposit,
          variantName: i.variantName,
          selectedOptions: i.selectedOptions,
          customizationText: i.customizationText,
          courseNumber: i.courseNumber,
          isHold: i.isHold,
        })),
      });
      // WICHTIG: Positionen als gedruckt kennzeichnen - genau wie in /api/orders.
      // Fehlte das hier, blieb jede Thekenbestellung dauerhaft auf PENDING
      // stehen. Die Selbstdiagnose hielt sie fuer haengende Druckauftraege und
      // startete den (leeren) Spooler im Minutentakt neu.
      const printableIds = order.items
        .filter((i: any) => !i.isHold)
        .map((i: any) => i.id);
      if (printableIds.length > 0) {
        await prisma.orderItem.updateMany({
          where: { id: { in: printableIds } },
          data: { printStatus: 'PRINTED' },
        });
      }
    } catch (printErr) {
      console.error('[CHECKOUT] Fehler beim Bon-Druck:', printErr);
    }

    // Kassenbeleg drucken
    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    if (body.printReceipt) {
      const receiptPrinter = await prisma.printer.findFirst({ where: { isActive: true } });
      if (receiptPrinter && config) {
        const { formatWaiterLabel } = await import('@/lib/waiter-number');
        const ebReceiptUrl =
          config.enableDigitalReceiptQr && payment.digitalReceiptCode && config.baseUrl
            ? buildReceiptUrl(config.baseUrl, payment.digitalReceiptCode)
            : undefined;
        const ticketData: TicketData = {
          title: 'KASSENBELEG / QUITTUNG',
          invoiceNumber: payment.invoiceNumber,
          tableLabel: payment.table?.label || 'Direktverkauf',
          tableFontSize: config.receiptTableFontSize ?? 3,
          itemFontSize: config.receiptItemFontSize ?? 2,
          optionsFontSize: config.receiptOptionsFontSize ?? 1,
          metaFontSize: config.receiptMetaFontSize ?? 1,
          template: config.receiptTemplate || 'CLASSIC',
          waiterName: formatWaiterLabel(payment.waiterName),
          createdAt: payment.createdAt,
          items: payment.items.map((i: any) => ({
            name: i.productName,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            deposit: i.deposit,
            taxRate: i.taxRate,
          })),
          totalGross: payment.totalGross,
          totalNet: payment.totalNet,
          totalTax: payment.totalTax,
          totalDeposit: payment.totalDeposit,
          returnDeposit: payment.returnDeposit,
          discountAmount: payment.discountAmount,
          tipAmount: payment.tipAmount,
          givenAmount: payment.givenAmount,
          changeAmount: payment.changeAmount,
          paymentMethod: getPaymentLabel(payment.paymentMethod),
          cardAuthCode: payment.cardAuthCode,
          taxSplits: checkout.splits.filter((s: any) => s.gross > 0),
          isTraining: payment.isTraining,
          eventName: config.name,
          subHeader: config.receiptSubHeader || undefined,
          customHeader: config.receiptHeader || undefined,
          addressStreet: config.addressStreet || undefined,
          addressCity: config.addressCity || undefined,
          taxNumber: config.taxNumber || undefined,
          vatId: config.vatId || undefined,
          footerText: config.receiptFooterText || undefined,
          showQr: Boolean(config.enableDigitalReceiptQr),
          qrUrl: ebReceiptUrl,
        };
        await networkSpooler.printTicket(receiptPrinter, ticketData).catch(() => undefined);
      }
    }

    // Kassenlade bei Bargeld (nur an Druckern mit angeschlossener Lade)
    if (body.paymentMethod === 'CASH' && body.openDrawer) {
      const posPrinter = await prisma.printer.findFirst({ where: { isActive: true, hasCashDrawer: true } });
      if (posPrinter) {
        await networkSpooler.openDrawer(posPrinter).catch(() => undefined);
      }
    }

    // Zapfhahn-Volumen abbuchen
    await deductTapVolumeForItems(
      order.items.map((i: any) => ({ productId: i.productId, quantity: i.quantity }))
    ).catch(() => undefined);

    // HA-Replikationslog + WebSocket
    await haService.logMutation('ORDER', order.id, 'INSERT', order);
    await haService.logMutation('PAYMENT', payment.id, 'INSERT', payment);

    if (global.io) {
      global.io.emit('order:new', order);
      global.io.emit('payment:completed', payment);
      if (body.tableId) {
        global.io.emit('table:updated', { tableId: body.tableId, status: 'FREE' });
      }
    }

    const receiptUrl =
      payment.digitalReceiptCode && config?.baseUrl
        ? buildReceiptUrl(config.baseUrl, payment.digitalReceiptCode)
        : null;

    await logSystemActionSafe(() => ({
      action: 'CHECKOUT_COMPLETED',
      category: 'SALES',
      actor: order.waiterName || auth.session.waiterName || auth.session.role,
      // Feldnamen laut Datenmodell: totalGross / paymentMethod (siehe /api/payments).
      details: `Direktverkauf #${order.orderNumber} über ${Number(payment.totalGross ?? 0).toFixed(2)} € (${getPaymentLabel(payment.paymentMethod)}) abgeschlossen.`,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        paymentId: payment.id,
        invoiceNumber: payment.invoiceNumber,
        paymentMethod: payment.paymentMethod,
        totalGross: payment.totalGross,
      },
    }));

    return NextResponse.json({
      ...payment,
      orderId: order.id,
      orderNumber: order.orderNumber,
      tokenNumber: order.tokenNumber,
      changeAmount: round2(checkout.changeAmount),
      digitalReceiptUrl: receiptUrl,
      tipDistribution: tipDist,
    });
  } catch (error) {
    console.error('[CHECKOUT] Fehler beim Atomic Checkout:', error);
    const msg = error instanceof Error ? error.message : 'Fehler beim Kassiervorgang';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
