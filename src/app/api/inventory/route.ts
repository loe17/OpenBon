import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const stockItems = await prisma.stockItem.findMany({
      include: {
        product: {
          include: { category: true },
        },
      },
    });
    return NextResponse.json(stockItems);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { productId, currentQuantity, alertThreshold, isAutoDeactivate, addQuantity } = body;

    let updated;
    if (addQuantity !== undefined) {
      updated = await prisma.stockItem.upsert({
        where: { productId },
        update: {
          currentQuantity: { increment: parseInt(addQuantity, 10) },
        },
        create: {
          productId,
          initialQuantity: parseInt(addQuantity, 10),
          currentQuantity: parseInt(addQuantity, 10),
          alertThreshold: 10,
        },
        include: { product: true },
      });
    } else {
      updated = await prisma.stockItem.upsert({
        where: { productId },
        update: {
          currentQuantity: parseInt(currentQuantity, 10),
          alertThreshold: parseInt(alertThreshold, 10),
          isAutoDeactivate: isAutoDeactivate ?? true,
        },
        create: {
          productId,
          initialQuantity: parseInt(currentQuantity, 10),
          currentQuantity: parseInt(currentQuantity, 10),
          alertThreshold: parseInt(alertThreshold, 10),
          isAutoDeactivate: isAutoDeactivate ?? true,
        },
        include: { product: true },
      });
    }

    // Re-activate product if quantity > 0
    if (updated.currentQuantity > 0) {
      await prisma.product.update({
        where: { id: productId },
        data: { status: 'ACTIVE' },
      });
    }

    if (global.io) {
      global.io.emit('stock:updated', updated);
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
