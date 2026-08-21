import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { status: { not: 'HIDDEN' } },
      orderBy: { sortIndex: 'asc' },
      include: {
        category: true,
        variants: { orderBy: { sortIndex: 'asc' } },
        options: { orderBy: { sortIndex: 'asc' } },
        stockItem: true,
        printGroup: {
          include: { printer: true },
        },
      },
    });
    return NextResponse.json(products);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const created = await prisma.product.create({
      data: {
        name: body.name,
        alternativeTicketName: body.alternativeTicketName || null,
        price: parseFloat(body.price || 0),
        deposit: parseFloat(body.deposit || 0),
        taxRate: parseFloat(body.taxRate || 19),
        buttonColor: body.buttonColor || '#3b82f6',
        status: body.status || 'ACTIVE',
        isSoldOut: body.isSoldOut ?? false,
        trackStock: body.trackStock ?? false,
        stockQuantity: parseInt(body.stockQuantity || 0, 10),
        stockAlertThreshold: parseInt(body.stockAlertThreshold || 10, 10),
        subCategory: body.subCategory || null,
        sortIndex: body.sortIndex ?? 0,
        categoryId: body.categoryId,
        printGroupId: body.printGroupId || null,
        variants: body.variants
          ? {
              create: body.variants.map((v: any, idx: number) => ({
                name: v.name,
                priceDelta: parseFloat(v.priceDelta || 0),
                isSoldOut: v.isSoldOut ?? false,
                sortIndex: idx,
              })),
            }
          : undefined,
        options: body.options
          ? {
              create: body.options.map((o: any, idx: number) => ({
                name: o.name,
                priceDelta: parseFloat(o.priceDelta || 0),
                sortIndex: idx,
              })),
            }
          : undefined,
      },
      include: {
        variants: true,
        options: true,
        printGroup: true,
        category: true,
      },
    });

    if (global.io) {
      global.io.emit('product:updated', created);
    }

    return NextResponse.json(created);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
