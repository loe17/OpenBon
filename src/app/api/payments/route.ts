import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import networkSpooler from '@/lib/printer/network-spooler';
import haService from '@/lib/ha/ha-service';
import { TicketData } from '@/lib/printer/types';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tableId = searchParams.get('tableId');
    const waiterName = searchParams.get('waiterName');

    const where: any = {};
    if (tableId) where.tableId = tableId;
    if (waiterName) where.waiterName = waiterName;

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        table: true,
        items: true,
      },
    });

    return NextResponse.json(payments);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    /*
      body: {
        tableId,
        waiterName,
        deviceId,
        paymentMethod: 'CASH' | 'CARD_SUMUP' | 'CARD_TERMINAL' | 'NON_PAID_STAFF' | 'DISCOUNT',
        nonPaidReason,
        returnDepositCount, // e.g. 5x 1€
        returnDepositAmount,
        discountAmount,
        tipAmount,
        givenAmount,
        printReceipt: boolean,
        itemsToPay: [
          { orderItemId, quantityToPay, productName, unitPrice, deposit, taxRate }
        ]
      }
    */

    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    const isTraining = config?.trainingMode ?? false;
    const invNum = `BELEG-${new Date().getFullYear()}-${String(config?.invoiceSequence || 1).padStart(5, '0')}`;

    await prisma.eventConfig.update({
      where: { id: 'default' },
      data: { invoiceSequence: { increment: 1 } },
    });

    // 1. Calculate Financials
    let grossSum = 0;
    let netSum = 0;
    let taxSum = 0;
    let depositSum = 0;

    const paymentItemsData = [];

    for (const item of body.itemsToPay) {
      const itemGross = (item.unitPrice + (item.deposit || 0)) * item.quantityToPay;
      const itemTaxRate = item.taxRate || 19.0;
      const itemNet = itemGross / (1 + itemTaxRate / 100);
      const itemTax = itemGross - itemNet;

      grossSum += itemGross;
      netSum += itemNet;
      taxSum += itemTax;
      depositSum += (item.deposit || 0) * item.quantityToPay;

      paymentItemsData.push({
        orderItemId: item.orderItemId || null,
        productName: item.productName,
        quantity: item.quantityToPay,
        unitPrice: item.unitPrice,
        deposit: item.deposit || 0,
        taxRate: itemTaxRate,
      });

      // Increment paidQuantity on orderItem
      if (item.orderItemId) {
        await prisma.orderItem.update({
          where: { id: item.orderItemId },
          data: { paidQuantity: { increment: item.quantityToPay } },
        });
      }
    }

    const returnDeposit = parseFloat(body.returnDepositAmount || 0);
    const discount = parseFloat(body.discountAmount || 0);
    const tip = parseFloat(body.tipAmount || 0);
    const surchargeAmount = parseFloat(body.surchargeAmount || 0);
    const surchargePercent = parseFloat(body.surchargePercent || 0);
    const surchargeReason = body.surchargeReason || null;
    const given = parseFloat(body.givenAmount || 0);

    const percentSurchargeValue = grossSum * (surchargePercent / 100);
    const totalSurcharges = surchargeAmount + percentSurchargeValue;

    const finalGrossToPay = Math.max(0, grossSum - returnDeposit - discount + totalSurcharges);
    const change = given > 0 ? Math.max(0, given - finalGrossToPay - tip) : 0;

    // 2. Create Payment Record in DB
    const payment = await prisma.payment.create({
      data: {
        invoiceNumber: invNum,
        tableId: body.tableId || null,
        waiterName: body.waiterName || 'Bedienung',
        deviceId: body.deviceId || null,
        totalGross: finalGrossToPay,
        totalNet: netSum + (totalSurcharges / 1.19),
        totalTax: taxSum + (totalSurcharges - totalSurcharges / 1.19),
        totalDeposit: depositSum,
        returnDeposit,
        discountAmount: discount,
        tipAmount: tip,
        surchargeAmount: totalSurcharges,
        surchargePercent,
        surchargeReason,
        givenAmount: given,
        changeAmount: change,
        paymentMethod: body.paymentMethod || 'CASH',
        nonPaidReason: body.nonPaidReason || null,
        isTraining,
        items: {
          create: paymentItemsData,
        },
      },
      include: {
        table: true,
        items: true,
      },
    });

    // 3. Check if table has any remaining unpaid items
    if (body.tableId) {
      const remainingUnpaidOrders = await prisma.order.findMany({
        where: {
          tableId: body.tableId,
          status: { in: ['OPEN', 'IN_PREPARATION', 'READY'] },
        },
        include: { items: { where: { isCancelled: false } } },
      });

      let totalRemainingUnpaid = 0;
      for (const ord of remainingUnpaidOrders) {
        for (const itm of ord.items) {
          totalRemainingUnpaid += Math.max(0, itm.quantity - itm.paidQuantity);
        }
      }

      if (totalRemainingUnpaid === 0) {
        // Table is fully paid -> mark orders completed and table FREE
        await prisma.order.updateMany({
          where: { tableId: body.tableId },
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

    // 4. Open Cash Drawer if Cash Payment on POS
    if (body.paymentMethod === 'CASH') {
      const posPrinter = await prisma.printer.findFirst({
        where: { isActive: true, isVirtual: false },
      });
      if (posPrinter) {
        networkSpooler.openDrawer(posPrinter);
      }
    }

    // 5. Print Receipt if requested
    if (body.printReceipt) {
      const receiptPrinter = await prisma.printer.findFirst({ where: { isActive: true } });
      if (receiptPrinter) {
        const ticketData: TicketData = {
          title: 'KASSENBELEG / QUITTUNG',
          invoiceNumber: payment.invoiceNumber,
          tableLabel: payment.table?.label || 'Direktverkauf',
          waiterName: payment.waiterName,
          items: payment.items.map((i) => ({
            name: i.productName,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            deposit: i.deposit,
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
          paymentMethod: payment.paymentMethod,
          isTraining: payment.isTraining,
          eventName: config?.name,
          footerText: 'Vielen Dank für Ihren Besuch!',
        };

        await networkSpooler.printTicket(receiptPrinter, ticketData);
      }
    }

    // 6. HA Sync
    await haService.logMutation('PAYMENT', payment.id, 'INSERT', payment);

    if (global.io) {
      global.io.emit('payment:completed', payment);
    }

    return NextResponse.json(payment);
  } catch (error: any) {
    console.error('Error processing payment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
