import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';
import { toCents } from '@/lib/pricing';

interface VariantInput {
  name: string;
  priceDelta?: number;
  isSoldOut?: boolean;
  // Eigene Werte des Untereintrags. Bleibt ein Feld leer, gilt der Wert des
  // Hauptartikels (Vererbung, siehe src/lib/product-resolve.ts).
  alternativeTicketName?: string | null;
  color?: string | null;
  printGroupId?: string | null;
  deposit?: number | null;
  taxRate?: number | null;
}

interface OptionInput {
  name: string;
  priceDelta?: number;
  // Mehrfach waehlbare Optionen: Voreinstellung und Hoechstzahl.
  defaultQuantity?: number;
  maxQuantity?: number;
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
        priceCents: toCents(Number(body.price ?? body.priceCents ?? 0)),
        depositCents: toCents(Number(body.deposit ?? body.depositCents ?? 0)),
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
        happyHourPriceCents: body.happyHourPrice !== undefined && body.happyHourPrice !== null && body.happyHourPrice !== '' ? toCents(Number(body.happyHourPrice)) : body.happyHourPriceCents !== undefined && body.happyHourPriceCents !== null && body.happyHourPriceCents !== '' ? Number(body.happyHourPriceCents) : null,
        happyHourStart: body.happyHourStart || null,
        happyHourEnd: body.happyHourEnd || null,
        happyHourDays: typeof body.happyHourDays === 'string' ? body.happyHourDays : JSON.stringify(body.happyHourDays || []),
        happyHourRules: body.happyHourRules !== undefined && body.happyHourRules !== null ? (typeof body.happyHourRules === 'string' ? body.happyHourRules : JSON.stringify(body.happyHourRules)) : null,
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
                priceDeltaCents: toCents(Number((v as any).priceDelta ?? (v as any).priceDeltaCents ?? 0)),
                isSoldOut: v.isSoldOut ?? false,
                sortIndex: idx,
                alternativeTicketName: v.alternativeTicketName?.trim() || null,
                color: v.color?.trim() || null,
                printGroupId: v.printGroupId || null,
                depositCents: v.deposit === undefined || v.deposit === null ? null : toCents(Number((v as any).deposit ?? (v as any).depositCents ?? 0)),
                taxRate: v.taxRate === undefined || v.taxRate === null ? null : Number(v.taxRate),
              })),
            }
          : undefined,
        options: body.options
          ? {
              create: (body.options as OptionInput[]).map((o, idx: number) => ({
                name: o.name,
                priceDeltaCents: toCents(Number((o as any).priceDelta ?? (o as any).priceDeltaCents ?? 0)),
                sortIndex: idx,
                defaultQuantity: Math.max(0, Number(o.defaultQuantity ?? 0)),
                maxQuantity: Math.max(1, Number(o.maxQuantity ?? 1)),
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

    await logSystemActionSafe(() => ({
      action: 'PRODUCT_CREATED',
      category: 'ADMIN',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Artikel angelegt.',
    }));

    return NextResponse.json(created);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
