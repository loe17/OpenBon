import { NextRequest, NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import { prisma } from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';
import { toCents } from '@/lib/pricing';

export async function GET(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const transactions = await prisma.tokenTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const products = await prisma.product.findMany({
      where: { isTokenProduct: true },
    });

    // Aggregierte Summen
    const totalsCents = transactions.reduce(
      (acc, t) => {
        if (t.action === 'ISSUE') {
          acc.totalIssuedQty += t.quantity;
          acc.totalIssuedValueCents += t.totalValueCents;
        } else if (t.action === 'REDEEM') {
          acc.totalRedeemedQty += t.quantity;
          acc.totalRedeemedValueCents += t.totalValueCents;
        } else if (t.action === 'RETURN') {
          acc.totalReturnedQty += t.quantity;
          acc.totalReturnedValueCents += t.totalValueCents;
        }
        return acc;
      },
      {
        totalIssuedQty: 0,
        totalIssuedValueCents: 0,
        totalRedeemedQty: 0,
        totalRedeemedValueCents: 0,
        totalReturnedQty: 0,
        totalReturnedValueCents: 0,
      }
    );

    const mappedTransactions = transactions.map((t) => ({
      ...t,
      unitValue: (t.unitValueCents ?? 0) / 100,
      totalValue: (t.totalValueCents ?? 0) / 100,
    }));

    return NextResponse.json({
      transactions: mappedTransactions,
      tokenProducts: products,
      totals: {
        totalIssuedQty: totalsCents.totalIssuedQty,
        totalIssuedValue: (totalsCents.totalIssuedValueCents ?? 0) / 100,
        totalIssuedValueCents: totalsCents.totalIssuedValueCents,
        totalRedeemedQty: totalsCents.totalRedeemedQty,
        totalRedeemedValue: (totalsCents.totalRedeemedValueCents ?? 0) / 100,
        totalRedeemedValueCents: totalsCents.totalRedeemedValueCents,
        totalReturnedQty: totalsCents.totalReturnedQty,
        totalReturnedValue: (totalsCents.totalReturnedValueCents ?? 0) / 100,
        totalReturnedValueCents: totalsCents.totalReturnedValueCents,
      },
    });
  } catch (error) {
    console.error('GET /api/tokens error:', error);
    return NextResponse.json({ error: 'Fehler beim Laden der Wertmarken' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { tokenType, action, quantity, unitValue, waiterName, deviceId } = body;

    if (!action || !quantity || !unitValue) {
      return NextResponse.json({ error: 'Fehlende Pflichtfelder (action, quantity, unitValue)' }, { status: 400 });
    }

    const qty = parseInt(quantity, 10);
    const valCents = toCents(parseFloat(unitValue));
    const totalValCents = qty * valCents;

    const transaction = await prisma.tokenTransaction.create({
      data: {
        tokenType: tokenType || 'GENERAL',
        action, // ISSUE, REDEEM, RETURN
        quantity: qty,
        unitValueCents: valCents,
        totalValueCents: totalValCents,
        waiterName: waiterName || 'Kasse',
        deviceId: deviceId || null,
      },
    });

    await logSystemActionSafe(() => ({
      action: 'TOKEN_ACTION',
      category: 'SALES',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Wertmarken-Vorgang.',
    }));

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error('POST /api/tokens error:', error);
    return NextResponse.json({ error: 'Fehler beim Erfassen der Wertmarken-Transaktion' }, { status: 500 });
  }
}
