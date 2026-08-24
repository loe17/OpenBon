import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  try {
    const { code } = params;

    const payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { digitalReceiptCode: code },
          { invoiceNumber: code },
        ],
      },
      include: {
        items: true,
        order: {
          include: {
            table: true,
          },
        },
        table: true,
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Beleg nicht gefunden' }, { status: 404 });
    }

    const config = await prisma.eventConfig.findUnique({
      where: { id: 'default' },
    });

    return NextResponse.json({
      payment,
      eventConfig: config ? {
        name: config.name,
        currency: config.currency,
        tseProvider: config.tseProvider,
        tseSerialNumber: config.tseSerialNumber,
      } : null,
    });
  } catch (error) {
    console.error('GET /api/receipt/[code] error:', error);
    return NextResponse.json({ error: 'Fehler beim Laden des digitalen Belegs' }, { status: 500 });
  }
}
