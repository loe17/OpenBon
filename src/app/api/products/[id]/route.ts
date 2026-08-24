import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

interface VariantInput {
  name: string;
  priceDelta?: number;
  isSoldOut?: boolean;
}

interface OptionInput {
  name: string;
  priceDelta?: number;
}

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
        minStockAlert: body.minStockAlert !== undefined ? (body.minStockAlert === null ? null : parseInt(body.minStockAlert, 10)) : undefined,
        stockAlertThreshold: body.stockAlertThreshold !== undefined ? parseInt(body.stockAlertThreshold, 10) : undefined,
        hasAgeRestriction: body.hasAgeRestriction !== undefined ? Boolean(body.hasAgeRestriction) : undefined,
        minAge: body.minAge !== undefined ? (body.minAge === null ? null : parseInt(body.minAge, 10)) : undefined,
        allergens: body.allergens !== undefined ? (typeof body.allergens === 'string' ? body.allergens : JSON.stringify(body.allergens)) : undefined,
        additives: body.additives !== undefined ? (typeof body.additives === 'string' ? body.additives : JSON.stringify(body.additives)) : undefined,
        happyHourPrice: body.happyHourPrice !== undefined ? (body.happyHourPrice === null || body.happyHourPrice === '' ? null : parseFloat(body.happyHourPrice)) : undefined,
        happyHourStart: body.happyHourStart !== undefined ? body.happyHourStart : undefined,
        happyHourEnd: body.happyHourEnd !== undefined ? body.happyHourEnd : undefined,
        happyHourDays: body.happyHourDays !== undefined ? (typeof body.happyHourDays === 'string' ? body.happyHourDays : JSON.stringify(body.happyHourDays)) : undefined,
        isTokenProduct: body.isTokenProduct !== undefined ? Boolean(body.isTokenProduct) : undefined,
        tokenType: body.tokenType !== undefined ? body.tokenType : undefined,
        subCategory: body.subCategory !== undefined ? body.subCategory : undefined,
        sortIndex: body.sortIndex,
        categoryId: body.categoryId,
        printGroupId: body.printGroupId !== undefined ? body.printGroupId : undefined,
        variants: body.variants
          ? {
              create: (body.variants as VariantInput[]).map((v, idx: number) => ({
                name: v.name,
                priceDelta: Number(v.priceDelta ?? 0),
                isSoldOut: v.isSoldOut ?? false,
                sortIndex: idx,
              })),
            }
          : undefined,
        options: body.options
          ? {
              create: (body.options as OptionInput[]).map((o, idx: number) => ({
                name: o.name,
                priceDelta: Number(o.priceDelta ?? 0),
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
      global.io.emit('inventory:updated', { productId: updated.id });
    }

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
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
      global.io.emit('inventory:updated', { productId: params.id });
    }

    return NextResponse.json({ success: true, product: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
