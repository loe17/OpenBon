import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';

export async function GET(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const products = await prisma.product.findMany({
      where: {
        trackStock: true,
        status: { not: 'HIDDEN' },
      },
      include: {
        category: true,
        stockItem: true,
      },
      orderBy: { name: 'asc' },
    });

    const formatted = products.map((p) => ({
      id: p.stockItem?.id || p.id,
      productId: p.id,
      product: p,
      currentQuantity: p.stockItem?.currentQuantity ?? p.stockQuantity ?? 0,
      alertThreshold: p.stockAlertThreshold || 10,
      isSoldOut: p.isSoldOut,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { productId, addQuantity, setQuantity, alertThreshold, isSoldOut } = body;

    const prod = await prisma.product.findUnique({
      where: { id: productId },
      include: { stockItem: true },
    });
    if (!prod) return NextResponse.json({ error: 'Artikel nicht gefunden' }, { status: 404 });

    let currentQty = prod.stockItem?.currentQuantity ?? prod.stockQuantity ?? 0;
    let nextQty = currentQty;

    if (addQuantity !== undefined) {
      nextQty += parseInt(addQuantity, 10);
    } else if (setQuantity !== undefined) {
      nextQty = parseInt(setQuantity, 10);
    }

    const isSoldOutVal = isSoldOut !== undefined ? Boolean(isSoldOut) : nextQty <= 0;

    await prisma.$transaction(async (tx) => {
      // 1. StockItem als Single Source of Truth aktualisieren
      await tx.stockItem.upsert({
        where: { productId },
        create: {
          productId,
          currentQuantity: nextQty,
          initialQuantity: nextQty,
          isAutoDeactivate: true,
        },
        update: {
          currentQuantity: nextQty,
        },
      });

      // 2. Product-Status synchronisieren
      await tx.product.update({
        where: { id: productId },
        data: {
          stockQuantity: nextQty,
          stockAlertThreshold: alertThreshold !== undefined ? parseInt(alertThreshold, 10) : prod.stockAlertThreshold,
          isSoldOut: isSoldOutVal,
        },
      });
    });

    const updated = await prisma.product.findUnique({
      where: { id: productId },
      include: { category: true, stockItem: true },
    });

    if (global.io) {
      global.io.emit('stock:updated', updated);
    }

    await logSystemActionSafe(() => ({
      action: 'STOCK_CHANGED',
      category: 'ADMIN',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Warenbestand geaendert.',
    }));

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
