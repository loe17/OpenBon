import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  try {
    const { code } = params;
    if (!code || code.length < 8) {
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
        totalGross: true,
        totalNet: true,
        totalTax: true,
        taxBase19: true,
        taxAmount19: true,
        taxBase7: true,
        taxAmount7: true,
        taxBase0: true,
        totalDeposit: true,
        returnDeposit: true,
        discountAmount: true,
        tipAmount: true,
        paymentMethod: true,
        givenAmount: true,
        changeAmount: true,
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
            unitPrice: true,
            deposit: true,
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
