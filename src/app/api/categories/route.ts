import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';

export async function GET(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const categories = await prisma.productCategory.findMany({
      orderBy: { sortIndex: 'asc' },
      include: {
        products: {
          where: { status: { not: 'HIDDEN' } },
          orderBy: { sortIndex: 'asc' },
          include: {
            variants: { orderBy: { sortIndex: 'asc' } },
            options: { orderBy: { sortIndex: 'asc' } },
            stockItem: true,
            printGroup: {
              include: { printer: true },
            },
          },
        },
      },
    });

    // Deduplizieren nach Name falls durch Seeding/Import Duplikate entstanden sind
    const uniqueMap = new Map<string, (typeof categories)[0]>();
    for (const cat of categories) {
      const key = cat.name.trim().toLowerCase();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, { ...cat, products: [...cat.products] });
      } else {
        const existing = uniqueMap.get(key)!;
        // Produkte zusammenführen ohne Duplikate
        const existingProdIds = new Set(existing.products.map((p) => p.id));
        for (const p of cat.products) {
          if (!existingProdIds.has(p.id)) {
            existing.products.push(p);
            existingProdIds.add(p.id);
          }
        }
      }
    }

    return NextResponse.json(Array.from(uniqueMap.values()));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const created = await prisma.productCategory.create({
      data: {
        name: body.name,
        sortIndex: body.sortIndex ?? 0,
        color: body.color || '#3b82f6',
        icon: body.icon || 'Utensils',
      },
    });
    await logSystemActionSafe(() => ({
      action: 'CATEGORY_CREATED',
      category: 'ADMIN',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Warengruppe angelegt.',
    }));

    return NextResponse.json(created);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'ID fehlt' }, { status: 400 });

    const updated = await prisma.productCategory.update({
      where: { id: body.id },
      data: {
        name: body.name,
        sortIndex: body.sortIndex !== undefined ? body.sortIndex : undefined,
        color: body.color !== undefined ? body.color : undefined,
        icon: body.icon !== undefined ? body.icon : undefined,
      },
    });
    await logSystemActionSafe(() => ({
      action: 'CATEGORY_UPDATED',
      category: 'ADMIN',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Warengruppe geaendert.',
    }));

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const force = searchParams.get('force') === 'true';
    if (!id) return NextResponse.json({ error: 'ID fehlt' }, { status: 400 });

    const productCount = await prisma.product.count({ where: { categoryId: id } });
    if (productCount > 0 && !force) {
      return NextResponse.json(
        { error: `Diese Warengruppe enthält noch ${productCount} Artikel. Bitte verschiebe oder lösche zuerst die Artikel.` },
        { status: 409 }
      );
    }

    if (force && productCount > 0) {
      await prisma.product.deleteMany({ where: { categoryId: id } });
    }

    await prisma.productCategory.delete({ where: { id } });
    await logSystemActionSafe(() => ({
      action: 'CATEGORY_DELETED',
      category: 'ADMIN',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Warengruppe geloescht.',
    }));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
