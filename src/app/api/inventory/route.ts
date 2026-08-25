import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
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

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
