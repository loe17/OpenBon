import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';

interface VariantInput {
  name: string;
  priceDelta?: number;
  isSoldOut?: boolean;
}

interface OptionInput {
  name: string;
  priceDelta?: number;
}

export async function GET(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

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
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

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
        minStockAlert: body.minStockAlert !== undefined && body.minStockAlert !== null ? parseInt(body.minStockAlert, 10) : null,
        stockAlertThreshold: parseInt(body.stockAlertThreshold || 10, 10),
        hasAgeRestriction: Boolean(body.hasAgeRestriction),
        minAge: body.minAge ? parseInt(body.minAge, 10) : null,
        allergens: typeof body.allergens === 'string' ? body.allergens : JSON.stringify(body.allergens || []),
        additives: typeof body.additives === 'string' ? body.additives : JSON.stringify(body.additives || []),
        happyHourPrice: body.happyHourPrice !== undefined && body.happyHourPrice !== null && body.happyHourPrice !== '' ? parseFloat(body.happyHourPrice) : null,
        happyHourStart: body.happyHourStart || null,
        happyHourEnd: body.happyHourEnd || null,
        happyHourDays: typeof body.happyHourDays === 'string' ? body.happyHourDays : JSON.stringify(body.happyHourDays || []),
        isTokenProduct: Boolean(body.isTokenProduct),
        tokenType: body.tokenType || null,
        subCategory: body.subCategory || null,
        sortIndex: body.sortIndex ?? 0,
        categoryId: body.categoryId,
        printGroupId: body.printGroupId || null,
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
      global.io.emit('product:updated', created);
      global.io.emit('inventory:updated', { productId: created.id });
    }

    return NextResponse.json(created);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
