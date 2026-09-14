import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  try {
    const { checkSimpleRateLimit, registerSimpleAttempt, getClientKey } = await import('@/lib/rate-limiter');
    const rlKey = getClientKey(req, 'receipt');
    const rl = checkSimpleRateLimit(rlKey, 60, 60 * 60 * 1000, 10 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Zu viele Belegabfragen.' }, { status: 429 });
    }
    registerSimpleAttempt(rlKey, 60 * 60 * 1000);
    const { code } = params;
    if (!code || code.length < 12 || !/^[A-Za-z0-9-]+$/.test(code)) {
      return NextResponse.json({ error: 'Ungültiger Belegcode' }, { status: 400 });
    }

    // Nur über den kryptografisch zufälligen digitalReceiptCode suchen (keine invoiceNumber-Enumeration)
    const payment = await prisma.payment.findFirst({
      where: {
        digitalReceiptCode: code,
      },
      select: {
        id: true,
        invoiceNumber: true,
        digitalReceiptCode: true,
        createdAt: true,
        totalGrossCents: true,
        totalNetCents: true,
        totalTaxCents: true,
        taxBase19Cents: true,
        taxAmount19Cents: true,
        taxBase7Cents: true,
        taxAmount7Cents: true,
        taxBase0Cents: true,
        totalDepositCents: true,
        returnDepositCents: true,
        discountAmountCents: true,
        tipAmountCents: true,
        paymentMethod: true,
        givenAmountCents: true,
        changeAmountCents: true,
        table: {
          select: {
            tableNumber: true,
            label: true,
          },
        },
        items: {
          select: {
            id: true,
            productName: true,
            quantity: true,
            unitPriceCents: true,
            depositCents: true,
            taxRate: true,
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Beleg nicht gefunden oder abgelaufen' }, { status: 404 });
    }

    const config = await prisma.eventConfig.findUnique({
      where: { id: 'default' },
      select: {
        name: true,
        currency: true,
        receiptHeader: true,
        receiptFooterText: true,
      },
    });

    const mappedPayment = {
      ...payment,
      totalGross: (payment.totalGrossCents ?? 0) / 100,
      totalNet: (payment.totalNetCents ?? 0) / 100,
      totalTax: (payment.totalTaxCents ?? 0) / 100,
      taxBase19: (payment.taxBase19Cents ?? 0) / 100,
      taxAmount19: (payment.taxAmount19Cents ?? 0) / 100,
      taxBase7: (payment.taxBase7Cents ?? 0) / 100,
      taxAmount7: (payment.taxAmount7Cents ?? 0) / 100,
      taxBase0: (payment.taxBase0Cents ?? 0) / 100,
      totalDeposit: (payment.totalDepositCents ?? 0) / 100,
      returnDeposit: (payment.returnDepositCents ?? 0) / 100,
      discountAmount: (payment.discountAmountCents ?? 0) / 100,
      tipAmount: (payment.tipAmountCents ?? 0) / 100,
      givenAmount: (payment.givenAmountCents ?? 0) / 100,
      changeAmount: (payment.changeAmountCents ?? 0) / 100,
      items: (payment.items || []).map((item) => ({
        ...item,
        unitPrice: (item.unitPriceCents ?? 0) / 100,
        deposit: (item.depositCents ?? 0) / 100,
      })),
    };

    return NextResponse.json({
      payment: mappedPayment,
      eventConfig: config,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Fehler beim Laden des digitalen Belegs' }, { status: 500 });
  }
}
