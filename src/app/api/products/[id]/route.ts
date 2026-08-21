import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const productId = params.id;

    if (body.variants) {
      await prisma.productVariant.deleteMany({ where: { productId } });
    }
    if (body.options) {
      await prisma.productOption.deleteMany({ where: { productId } });
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        name: body.name,
        alternativeTicketName: body.alternativeTicketName !== undefined ? body.alternativeTicketName : undefined,
        price: body.price !== undefined ? parseFloat(body.price) : undefined,
        deposit: body.deposit !== undefined ? parseFloat(body.deposit) : undefined,
        taxRate: body.taxRate !== undefined ? parseFloat(body.taxRate) : undefined,
        buttonColor: body.buttonColor,
        status: body.status,
        isSoldOut: body.isSoldOut !== undefined ? body.isSoldOut : undefined,
        trackStock: body.trackStock !== undefined ? body.trackStock : undefined,
        stockQuantity: body.stockQuantity !== undefined ? parseInt(body.stockQuantity, 10) : undefined,
        stockAlertThreshold: body.stockAlertThreshold !== undefined ? parseInt(body.stockAlertThreshold, 10) : undefined,
        subCategory: body.subCategory !== undefined ? body.subCategory : undefined,
        sortIndex: body.sortIndex,
        categoryId: body.categoryId,
        printGroupId: body.printGroupId !== undefined ? body.printGroupId : undefined,
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
      global.io.emit('product:updated', updated);
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const updated = await prisma.product.update({
      where: { id: params.id },
      data: { status: 'HIDDEN' },
    });

    if (global.io) {
      global.io.emit('product:deleted', { id: params.id });
    }

    return NextResponse.json({ success: true, product: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
