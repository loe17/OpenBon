import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import networkSpooler from '@/lib/printer/network-spooler';
import haService from '@/lib/ha/ha-service';
import { computeCheckout, findSplit, round2, toCents } from '@/lib/pricing';
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
  unitPriceCents: number;
  deposit?: number;
  taxRate?: number;
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;
  const { denyStandbyWrite } = await import('@/lib/ha/ha-guard');
  const denied = denyStandbyWrite();
  if (denied) return denied;

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
    const toleranceOk = (clientEuro: number, dbCents: number) =>
      Math.abs(toCents(Number(clientEuro || 0)) - Number(dbCents || 0)) <= PRICE_TOLERANCE_CENTS;

    const linkedIds = Array.from(
      new Set(itemsToPay.map((i) => i.orderItemId).filter(Boolean) as string[])
    );
    const orderItemMap = new Map<string, { productName: string; unitPriceCents: number; depositCents: number; taxRate: number }>();
    if (linkedIds.length > 0) {
      const rows = await prisma.orderItem.findMany({
        where: { id: { in: linkedIds } },
        select: { id: true, productName: true, unitPriceCents: true, depositCents: true, taxRate: true },
      });
      for (const row of rows) {
        orderItemMap.set(row.id, {
          productName: row.productName,
          unitPriceCents: row.unitPriceCents,
          depositCents: row.depositCents,
          taxRate: row.taxRate,
        });
      }
    }

    const pricedLines: Array<{
      orderItemId: string | null;
      productName: string;
      quantity: number;
      unitPriceCents: number;
      depositCents: number;
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
          unitPriceCents: toCents(Number((item as any).unitPrice ?? (item as any).unitPriceCents ?? 0)),
          depositCents: toCents(Number((item as any).deposit ?? (item as any).depositCents ?? 0)),
          taxRate: Number(item.taxRate ?? config.taxRateNormal),
        });
        continue;
      }

      const clientUnitPrice = Number((item as any).unitPrice ?? ((item as any).unitPriceCents ?? 0) / 100);
      if (
        !toleranceOk(clientUnitPrice, linkedRow.unitPriceCents) ||
        !toleranceOk(Number((item as any).deposit ?? ((item as any).depositCents ?? 0) / 100), linkedRow.depositCents)
      ) {
        await logSystemActionSafe(() => ({
          action: 'PAYMENT_PRICE_MISMATCH',
          category: 'SALES',
          actor: auth.session.waiterName || auth.session.role || 'unbekannt',
          details: `Preisabweichung bei "${linkedRow.productName}" abgewiesen: Client sendete ${(clientUnitPrice).toFixed(2)} € / ${Number((item as any).deposit ?? 0).toFixed(2)} € Pfand, Server erwartet ${(linkedRow.unitPriceCents / 100).toFixed(2)} € / ${(linkedRow.depositCents / 100).toFixed(2)} € Pfand.`,
          metadata: {
            orderItemId: item.orderItemId,
            clientUnitPrice: clientUnitPrice,
            clientDeposit: Number((item as any).deposit ?? 0),
            serverUnitPriceCents: linkedRow.unitPriceCents,
            serverDepositCents: linkedRow.depositCents,
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
        unitPriceCents: linkedRow.unitPriceCents,
        depositCents: linkedRow.depositCents,
        taxRate: linkedRow.taxRate,
      });
    }

    // 1. Cent-genaue Berechnung (mit Server-Preisen). Pricing-Lib arbeitet in Euro -> Cents/100 als Brücke.
    const checkout = computeCheckout({
      lines: pricedLines.map((i) => ({
        unitPriceCents: i.unitPriceCents,
        depositCents: i.depositCents,
        quantity: i.quantity,
        taxRate: i.taxRate,
      })),
      returnDepositCents: toCents(Number(returnDepositAmount || 0)),
      discountCents: toCents(Number((body as any).discountAmount || 0)),
      surchargeFixedCents: toCents(Number((body as any).surchargeAmount || 0)),
      surchargePercent: Number((body as any).surchargePercent || 0),
      tipCents: toCents(Number((body as any).tipAmount || 0)),
      givenCents: toCents(Number((body as any).givenAmount || 0)),
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
          totalGrossCents: checkout.amountDueCents ?? toCents(checkout.amountDue ?? 0),
          totalNetCents: checkout.netCents ?? toCents(checkout.netTotal ?? 0),
          totalTaxCents: checkout.taxCents ?? toCents(checkout.taxTotal ?? 0),
          givenAmountCents: checkout.givenCents ?? toCents(checkout.givenAmount ?? 0),
          changeAmountCents: checkout.changeCents ?? toCents(checkout.changeAmount ?? 0),
          taxBase19Cents: findSplit(checkout.splits, 19).baseCents ?? toCents(findSplit(checkout.splits, 19).base ?? 0),
          taxAmount19Cents: findSplit(checkout.splits, 19).taxCents ?? toCents(findSplit(checkout.splits, 19).tax ?? 0),
          taxBase7Cents: findSplit(checkout.splits, 7).baseCents ?? toCents(findSplit(checkout.splits, 7).base ?? 0),
          taxAmount7Cents: findSplit(checkout.splits, 7).taxCents ?? toCents(findSplit(checkout.splits, 7).tax ?? 0),
          taxBase0Cents: findSplit(checkout.splits, 0).baseCents ?? toCents(findSplit(checkout.splits, 0).base ?? 0),
          totalDepositCents: checkout.depositCents ?? toCents(checkout.depositTotal ?? 0),
          returnDepositCents: checkout.returnDepositCents ?? toCents(checkout.returnDeposit ?? 0),
          discountAmountCents: checkout.discountCents ?? toCents(checkout.discountAmount ?? 0),
          tipAmountCents: checkout.tipCents ?? toCents(checkout.tipAmount ?? 0),
          tipWaiterShareCents: toCents(tipDist.waiterShare ?? 0),
          tipPoolShareCents: toCents(tipDist.poolShare ?? 0),
          surchargeAmountCents: checkout.surchargeCents ?? toCents(checkout.surchargeTotal ?? 0),
          surchargePercent: Number(body.surchargePercent ?? 0),
          surchargeReason: body.surchargeReason || null,
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
              unitPriceCents: i.unitPriceCents,
              depositCents: i.depositCents,
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
            unitPriceCents: i.unitPriceCents,
            depositCents: i.depositCents,
            taxRate: i.taxRate,
          })),
          totalGrossCents: payment.totalGrossCents,
          totalNetCents: payment.totalNetCents,
          totalTaxCents: payment.totalTaxCents,
          totalDepositCents: payment.totalDepositCents,
          returnDepositCents: payment.returnDepositCents,
          discountCents: payment.discountAmountCents,
          surchargeAmountCents: payment.surchargeAmountCents,
          surchargeReason: payment.surchargeReason,
          tipCents: payment.tipAmountCents,
          givenCents: payment.givenAmountCents,
          changeCents: payment.changeAmountCents,
          paymentMethod: getPaymentLabel(payment.paymentMethod),
          cardAuthCode: payment.cardAuthCode,
          taxSplits: checkout.splits.filter((s: any) => (s.grossCents ?? s.gross ?? 0) > 0),
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
      const tipText = Number(payment.tipAmountCents ?? 0) > 0 ? `, Trinkgeld: ${((payment.tipAmountCents ?? 0) / 100).toFixed(2)} €` : '';
      const cashText = payment.paymentMethod === 'CASH' && Number(payment.givenAmountCents ?? 0) > 0
        ? ` | Gegeben: ${((payment.givenAmountCents ?? 0) / 100).toFixed(2)} €, Rückgeld: ${((payment.changeAmountCents ?? 0) / 100).toFixed(2)} €`
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
        details: `Zahlung ${payment.invoiceNumber || payment.id}${tableText}: ${((payment.totalGrossCents ?? 0) / 100).toFixed(2)} € [${methodLabel}${cashText}${tipText}] gebucht.`,
        metadata: {
          paymentId: payment.id,
          invoiceNumber: payment.invoiceNumber,
          orderId: payment.orderId,
          tableId: payment.tableId,
          tableLabel: payment.table?.label,
          paymentMethod: payment.paymentMethod,
          totalGrossCents: payment.totalGrossCents,
          givenAmountCents: payment.givenAmountCents,
          changeAmountCents: payment.changeAmountCents,
          tipAmountCents: payment.tipAmountCents,
        },
      };
    });

    return NextResponse.json({
      ...payment,
      changeCents: checkout.changeCents ?? toCents(checkout.changeAmount ?? 0),
      digitalReceiptUrl: receiptUrl,
      tipDistribution: tipDist,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('Error processing payment:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
