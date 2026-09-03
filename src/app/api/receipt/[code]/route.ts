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

    return NextResponse.json({
      payment,
      eventConfig: config,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Fehler beim Laden des digitalen Belegs' }, { status: 500 });
  }
}
