import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import networkSpooler from '@/lib/printer/network-spooler';
import haService from '@/lib/ha/ha-service';
import { computeCheckout, findSplit, round2 } from '@/lib/pricing';
import { getOrCreateOpenPeriod } from '@/lib/register-period';
import { getPaymentLabel } from '@/lib/payment/methods';
import { generateDigitalReceiptCode, buildReceiptUrl } from '@/lib/digital-receipt';
import { calculateTipDistribution } from '@/lib/tips';
import { deductTapVolumeForItems } from '@/lib/tap-manager';
import { validateBody, CreatePaymentSchema } from '@/lib/validations/schemas';
import type { TicketData } from '@/lib/printer/types';
import { requireApiAuth } from '@/lib/api-guard';

export async function GET(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const tableId = searchParams.get('tableId');
    const waiterName = searchParams.get('waiterName');
    const periodId = searchParams.get('periodId');

    const where: Record<string, unknown> = {};
    if (tableId) where.tableId = tableId;
    if (waiterName) where.waiterName = waiterName;
    if (periodId) where.periodId = periodId;

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { table: true, items: true, waiter: true },
    });

    return NextResponse.json(payments);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface PayableItemInput {
  orderItemId?: string | null;
  productName: string;
  quantityToPay: number;
  unitPrice: number;
  deposit?: number;
  taxRate?: number;
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    // Zod-Validierung: verhindert stillschweigend falsche Betraege durch Type-Cast + Number()-Zwangsumwandlung
    const validation = await validateBody(req, CreatePaymentSchema);
    if (!validation.success) {
      return validation.response;
    }
    const body = validation.data;

    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      return NextResponse.json({ error: 'Keine Konfiguration gefunden' }, { status: 500 });
    }
    const isTraining = config.trainingMode;

    const itemsToPay = Array.isArray(body.itemsToPay) ? body.itemsToPay : [];
    const returnDepositAmount = Number(body.returnDepositAmount ?? 0);

    if (itemsToPay.length === 0 && returnDepositAmount === 0) {
      return NextResponse.json(
        { error: 'Es wurden weder Artikel noch Rückpfand übergeben.' },
        { status: 400 }
      );
    }

    const idempotencyKey =
      req.headers.get('x-idempotency-key') ||
      body.requestId ||
      (body as any).idempotencyKey;

    // M1.1 Serverseitige Preisautoritaet: unitPrice/deposit/taxRate werden IMMER
    // aus dem OrderItem-Snapshot (DB) uebernommen, nie vom Client uebernommen.
    // Verknuepfte Positionen, die in der DB fehlen, fuehren zu 409 statt zum
    // bisherigen stillen Ueberspringen. Abweichung > 1 Cent = Manipulationsversuch.
    const PRICE_TOLERANCE_CENTS = 1;
    const toleranceOk = (clientValue: number, dbValue: number) =>
      Math.abs(Number(clientValue || 0) - Number(dbValue || 0)) * 100 <= PRICE_TOLERANCE_CENTS + 1e-9;

    const linkedIds = Array.from(
      new Set(itemsToPay.map((i) => i.orderItemId).filter(Boolean) as string[])
    );
    const orderItemMap = new Map<string, { productName: string; unitPrice: number; deposit: number; taxRate: number }>();
    if (linkedIds.length > 0) {
      const rows = await prisma.orderItem.findMany({
        where: { id: { in: linkedIds } },
        select: { id: true, productName: true, unitPrice: true, deposit: true, taxRate: true },
      });
      for (const row of rows) {
        orderItemMap.set(row.id, {
          productName: row.productName,
          unitPrice: row.unitPrice,
          deposit: row.deposit,
          taxRate: row.taxRate,
        });
      }
    }

    const pricedLines: Array<{
      orderItemId: string | null;
      productName: string;
      quantity: number;
      unitPrice: number;
      deposit: number;
      taxRate: number;
    }> = [];

    for (const item of itemsToPay) {
      const quantity = Math.max(0, Math.floor(Number(item.quantityToPay)));
      const linkedRow = item.orderItemId ? orderItemMap.get(item.orderItemId) : undefined;

      if (!linkedRow) {
        if (item.orderItemId) {
          return NextResponse.json(
            { error: `Position "${item.productName}" wurde zwischenzeitlich geloescht oder ist unbekannt.` },
            { status: 409 }
          );
        }
        // Legacy-Durchlass fuer nicht verknuepfte Posten (bestehende Flows).
        pricedLines.push({
          orderItemId: item.orderItemId ?? null,
          productName: item.productName,
          quantity,
          unitPrice: round2(Number(item.unitPrice)),
          deposit: round2(Number(item.deposit ?? 0)),
          taxRate: Number(item.taxRate ?? config.taxRateNormal),
        });
        continue;
      }

      const clientUnitPrice = Number(item.unitPrice);
      if (
        !toleranceOk(clientUnitPrice, linkedRow.unitPrice) ||
        !toleranceOk(Number(item.deposit ?? 0), linkedRow.deposit)
      ) {
        await logSystemActionSafe(() => ({
          action: 'PAYMENT_PRICE_MISMATCH',
          category: 'SALES',
          actor: auth.session.waiterName || auth.session.role || 'unbekannt',
          details: `Preisabweichung bei "${linkedRow.productName}" abgewiesen: Client sendete ${round2(clientUnitPrice).toFixed(2)} € / ${Number(item.deposit ?? 0).toFixed(2)} € Pfand, Server erwartet ${round2(linkedRow.unitPrice).toFixed(2)} € / ${linkedRow.deposit.toFixed(2)} € Pfand.`,
          metadata: {
            orderItemId: item.orderItemId,
            clientUnitPrice: clientUnitPrice,
            clientDeposit: Number(item.deposit ?? 0),
            serverUnitPrice: linkedRow.unitPrice,
            serverDeposit: linkedRow.deposit,
            waiterName: body.waiterName || null,
            deviceId: body.deviceId || null,
          },
        }));
        return NextResponse.json(
          {
            error: `Preisabweichung bei Position "${linkedRow.productName}". Der Vorgang wurde verworfen - bitte Kassenseite neu laden.`,
          },
          { status: 409 }
        );
      }

      pricedLines.push({
        orderItemId: item.orderItemId ?? null,
        productName: linkedRow.productName,
        quantity,
        unitPrice: round2(linkedRow.unitPrice),
        deposit: round2(linkedRow.deposit),
        taxRate: linkedRow.taxRate,
      });
    }

    // 1. Cent-genaue Berechnung (mit Server-Preisen)
    const checkout = computeCheckout({
      lines: pricedLines.map((i) => ({
        unitPrice: i.unitPrice,
        deposit: i.deposit,
        quantity: i.quantity,
        taxRate: i.taxRate,
      })),
      returnDepositAmount,
      discountAmount: Number(body.discountAmount ?? 0),
      surchargeFixed: Number(body.surchargeAmount ?? 0),
      surchargePercent: Number(body.surchargePercent ?? 0),
      tipAmount: Number(body.tipAmount ?? 0),
      givenAmount: Number(body.givenAmount ?? 0),
    });

    // Finde oder ermittle Kellner-Profil fuer Trinkgeld-Aufteilung
    let waiterProfile = null;
    if (body.waiterId) {
      waiterProfile = await prisma.waiterProfile.findUnique({
        where: { id: body.waiterId },
        include: { tipProfile: true },
      });
    } else if (body.waiterName) {
      waiterProfile = await prisma.waiterProfile.findFirst({
        where: { name: body.waiterName },
        include: { tipProfile: true },
      });
    }

    const tipDist = calculateTipDistribution(checkout.tipAmount, waiterProfile?.tipProfile);

    const period = await getOrCreateOpenPeriod();
    const paymentMethod = body.paymentMethod || 'CASH';

    // 2. Beleg + Positionen + Zähler + Idempotenz in EINER Transaktion
    const paymentResult = await prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const existing = await tx.idempotencyKey.findUnique({
          where: { key: String(idempotencyKey) },
        });
        if (existing) {
          return { isReplay: true, response: JSON.parse(existing.responseJson), statusCode: existing.statusCode };
        }
      }

      const current = await tx.eventConfig.update({
        where: { id: 'default' },
        data: { invoiceSequence: { increment: 1 } },
      });
      const seq = current.invoiceSequence - 1;
      const invoiceNumber = body.requestId
        ? `BELEG-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}-${body.requestId.slice(0, 8)}`
        : `BELEG-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`;

      const digitalReceiptCode = generateDigitalReceiptCode(invoiceNumber);

      for (const item of itemsToPay) {
        if (!item.orderItemId) continue;
        const orderItem = await tx.orderItem.findUnique({ where: { id: item.orderItemId } });
        // M1.1: Verknuepfte Position muss existieren - kein stiller Skip mehr,
        // sonst wuerde ein Preis-POST ohne DB-Bezug gebucht.
        if (!orderItem) {
          throw new Error(
            `Position "${item.productName}" wurde zwischenzeitlich geloescht. Zahlung abgebrochen.`
          );
        }
        const open = orderItem.quantity - orderItem.paidQuantity;
        if (item.quantityToPay > open) {
          throw new Error(
            `Position "${orderItem.productName}" wurde zwischenzeitlich bereits kassiert (offen: ${open}).`
          );
        }
        await tx.orderItem.update({
          where: { id: item.orderItemId },
          data: { paidQuantity: { increment: item.quantityToPay } },
        });
      }

      const createdPayment = await tx.payment.create({
        data: {
          invoiceNumber,
          tableId: body.tableId || null,
          orderId: body.orderId || null,
          periodId: period.id,
          waiterId: waiterProfile?.id || null,
          waiterName: body.waiterName || 'Bedienung',
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
          returnDeposit: checkout.returnDeposit,
          discountAmount: checkout.discountAmount,
          tipAmount: checkout.tipAmount,
          tipWaiterShare: tipDist.waiterShare,
          tipPoolShare: tipDist.poolShare,
          surchargeAmount: checkout.surchargeTotal,
          surchargePercent: Number(body.surchargePercent ?? 0),
          surchargeReason: body.surchargeReason || null,
          givenAmount: checkout.givenAmount,
          changeAmount: checkout.changeAmount,
          paymentMethod,
          cardAuthCode: body.cardAuthCode || null,
          cardTerminalId: body.cardTerminalId || null,
          nonPaidReason: paymentMethod.startsWith('NON_PAID') ? body.nonPaidReason || null : null,
          isTraining,
          items: {
            create: pricedLines.map((i) => ({
              orderItemId: i.orderItemId || null,
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

      if (idempotencyKey) {
        await tx.idempotencyKey.create({
          data: {
            key: String(idempotencyKey),
            endpoint: '/api/payments',
            statusCode: 200,
            responseJson: JSON.stringify(createdPayment),
          },
        }).catch(() => {});
      }

      return createdPayment;
    });

    if ('isReplay' in paymentResult && paymentResult.isReplay) {
      return NextResponse.json(paymentResult.response, {
        status: paymentResult.statusCode || 200,
        headers: { 'X-Idempotent-Replay': 'true' },
      });
    }

    const payment = paymentResult as any;

    // 3. Tisch freigeben, wenn nichts mehr offen ist
    if (body.tableId) {
      const openOrders = await prisma.order.findMany({
        where: { tableId: body.tableId, status: { in: ['OPEN', 'IN_PREPARATION', 'READY'] } },
        include: { items: { where: { isCancelled: false } } },
      });

      const remaining = openOrders.reduce(
        (sum, o) => sum + o.items.reduce((s, i) => s + Math.max(0, i.quantity - i.paidQuantity), 0),
        0
      );

      if (remaining === 0) {
        await prisma.order.updateMany({
          where: { tableId: body.tableId, status: { in: ['OPEN', 'IN_PREPARATION', 'READY'] } },
          data: { status: 'COMPLETED' },
        });
        await prisma.diningTable.update({
          where: { id: body.tableId },
          data: { status: 'FREE', activeWaiterName: null },
        });
        if (global.io) {
          global.io.emit('table:updated', { tableId: body.tableId, status: 'FREE' });
        }
      }
    }

    // 4. Kassenladen-Impuls bei Bargeld
    if (paymentMethod === 'CASH' && body.openDrawer !== false) {
      const posPrinter = await prisma.printer.findFirst({ where: { isActive: true } });
      if (posPrinter) {
        await networkSpooler.openDrawer(posPrinter).catch(() => undefined);
      }
    }

    // 5. Kassenbeleg drucken
    if (body.printReceipt) {
      const receiptPrinter = await prisma.printer.findFirst({ where: { isActive: true } });
      if (receiptPrinter) {
        // M6.6: E-Bon-URL auch aufs Papier bringen (wenn Schalter aktiv)
        const ebReceiptUrl = payment.digitalReceiptCode
          ? buildReceiptUrl(config.baseUrl || 'http://openbon.local', payment.digitalReceiptCode)
          : null;

        const ticketData: TicketData = {
          title: 'KASSENBELEG / QUITTUNG',
          invoiceNumber: payment.invoiceNumber,
          tableLabel: payment.table?.label || 'Direktverkauf',
          tableFontSize: config.receiptTableFontSize ?? 3,
          itemFontSize: config.receiptItemFontSize ?? 2,
          optionsFontSize: config.receiptOptionsFontSize ?? 1,
          metaFontSize: config.receiptMetaFontSize ?? 1,
          template: config.receiptTemplate || 'CLASSIC',
          waiterName: payment.waiterName,
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
          surchargeAmount: payment.surchargeAmount,
          surchargeReason: payment.surchargeReason,
          tipAmount: payment.tipAmount,
          givenAmount: payment.givenAmount,
          changeAmount: payment.changeAmount,
          paymentMethod: getPaymentLabel(payment.paymentMethod),
          cardAuthCode: payment.cardAuthCode,
          taxSplits: checkout.splits.filter((s) => s.gross > 0),
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
          qrUrl: config.enableDigitalReceiptQr ? ebReceiptUrl ?? undefined : undefined,
        };

        await networkSpooler.printTicket(receiptPrinter, ticketData);
      }
    }

    // 6. Schankvolumen von Zapfhähnen abziehen (Fassüberwachung)
    const paidOrderItemIds = itemsToPay.map((i) => i.orderItemId).filter(Boolean) as string[];
    if (paidOrderItemIds.length > 0) {
      const orderItems = await prisma.orderItem.findMany({
        where: { id: { in: paidOrderItemIds } },
        select: { id: true, productId: true },
      });
      const prodMap = new Map(orderItems.map((oi) => [oi.id, oi.productId]));
      await deductTapVolumeForItems(
        itemsToPay
          .filter((i) => i.orderItemId && prodMap.has(i.orderItemId))
          .map((i) => ({ productId: prodMap.get(i.orderItemId!)!, quantity: i.quantityToPay }))
      );
    }

    await haService.logMutation('PAYMENT', payment.id, 'INSERT', payment);

    if (global.io) {
      global.io.emit('payment:completed', payment);
    }

    const receiptUrl = payment.digitalReceiptCode
      ? buildReceiptUrl(config.baseUrl || 'http://openbon.local', payment.digitalReceiptCode)
      : null;

    await logSystemActionSafe(() => {
      const methodLabel = getPaymentLabel(payment.paymentMethod);
      const tipText = Number(payment.tipAmount ?? 0) > 0 ? `, Trinkgeld: ${Number(payment.tipAmount).toFixed(2)} €` : '';
      const cashText = payment.paymentMethod === 'CASH' && Number(payment.givenAmount ?? 0) > 0
        ? ` | Gegeben: ${Number(payment.givenAmount).toFixed(2)} €, Rückgeld: ${Number(payment.changeAmount ?? 0).toFixed(2)} €`
        : '';
      const tableText = payment.table?.label ? ` (Tisch ${payment.table.label})` : '';

      return {
        action: 'PAYMENT_COMPLETED',
        category: 'SALES',
        // M2.4: Signierte Session-Identitaet zuerst, gebuchter Name als Fallback
        actor:
          auth.session.waiterName ||
          payment.waiterName ||
          auth.session.role ||
          'unbekannt',
        details: `Zahlung ${payment.invoiceNumber || payment.id}${tableText}: ${Number(payment.totalGross ?? 0).toFixed(2)} € [${methodLabel}${cashText}${tipText}] gebucht.`,
        metadata: {
          paymentId: payment.id,
          invoiceNumber: payment.invoiceNumber,
          orderId: payment.orderId,
          tableId: payment.tableId,
          tableLabel: payment.table?.label,
          paymentMethod: payment.paymentMethod,
          totalGross: payment.totalGross,
          givenAmount: payment.givenAmount,
          changeAmount: payment.changeAmount,
          tipAmount: payment.tipAmount,
        },
      };
    });

    return NextResponse.json({
      ...payment,
      changeAmount: round2(checkout.changeAmount),
      digitalReceiptUrl: receiptUrl,
      tipDistribution: tipDist,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('Error processing payment:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
