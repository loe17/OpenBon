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
      },
      orderBy: { name: 'asc' },
    });

    const formatted = products.map((p) => ({
      id: p.id,
      productId: p.id,
      product: p,
      currentQuantity: p.stockQuantity,
      alertThreshold: p.stockAlertThreshold,
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

    const prod = await prisma.product.findUnique({ where: { id: productId } });
    if (!prod) return NextResponse.json({ error: 'Artikel nicht gefunden' }, { status: 404 });

    let nextQty = prod.stockQuantity;
    if (addQuantity !== undefined) {
      nextQty += parseInt(addQuantity, 10);
    } else if (setQuantity !== undefined) {
      nextQty = parseInt(setQuantity, 10);
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        stockQuantity: nextQty,
        stockAlertThreshold: alertThreshold !== undefined ? parseInt(alertThreshold, 10) : prod.stockAlertThreshold,
        isSoldOut: isSoldOut !== undefined ? isSoldOut : (nextQty <= 0 ? true : false),
      },
      include: {
        category: true,
      },
    });

    if (global.io) {
      global.io.emit('stock:updated', updated);
      global.io.emit('product:updated', updated);
    }

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
