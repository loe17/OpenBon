import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const transactions = await prisma.tokenTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const products = await prisma.product.findMany({
      where: { isTokenProduct: true },
    });

    // Aggregierte Summen
    const totals = transactions.reduce(
      (acc, t) => {
        if (t.action === 'ISSUE') {
          acc.totalIssuedQty += t.quantity;
          acc.totalIssuedValue += t.totalValue;
        } else if (t.action === 'REDEEM') {
          acc.totalRedeemedQty += t.quantity;
          acc.totalRedeemedValue += t.totalValue;
        } else if (t.action === 'RETURN') {
          acc.totalReturnedQty += t.quantity;
          acc.totalReturnedValue += t.totalValue;
        }
        return acc;
      },
      {
        totalIssuedQty: 0,
        totalIssuedValue: 0,
        totalRedeemedQty: 0,
        totalRedeemedValue: 0,
        totalReturnedQty: 0,
        totalReturnedValue: 0,
      }
    );

    return NextResponse.json({
      transactions,
      tokenProducts: products,
      totals,
    });
  } catch (error) {
    console.error('GET /api/tokens error:', error);
    return NextResponse.json({ error: 'Fehler beim Laden der Wertmarken' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tokenType, action, quantity, unitValue, waiterName, deviceId } = body;

    if (!action || !quantity || !unitValue) {
      return NextResponse.json({ error: 'Fehlende Pflichtfelder (action, quantity, unitValue)' }, { status: 400 });
    }

    const qty = parseInt(quantity, 10);
    const val = parseFloat(unitValue);
    const totalVal = Math.round(qty * val * 100) / 100;

    const transaction = await prisma.tokenTransaction.create({
      data: {
        tokenType: tokenType || 'GENERAL',
        action, // ISSUE, REDEEM, RETURN
        quantity: qty,
        unitValue: val,
        totalValue: totalVal,
        waiterName: waiterName || 'Kasse',
        deviceId: deviceId || null,
      },
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error('POST /api/tokens error:', error);
    return NextResponse.json({ error: 'Fehler beim Erfassen der Wertmarken-Transaktion' }, { status: 500 });
  }
}
