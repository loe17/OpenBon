import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
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
    return NextResponse.json(created);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
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
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID fehlt' }, { status: 400 });

    const productCount = await prisma.product.count({ where: { categoryId: id } });
    if (productCount > 0) {
      return NextResponse.json(
        { error: `Diese Warengruppe enthält noch ${productCount} Artikel. Bitte verschiebe oder lösche zuerst die Artikel.` },
        { status: 409 }
      );
    }

    await prisma.productCategory.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
