import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

interface BatchImportItem {
  name: string;
  price: number; // in EUR
  category: string;
  taxRate?: number;
  printGroupId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items: BatchImportItem[] = body.items || [];

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Keine Artikel zum Importieren übergeben' }, { status: 400 });
    }

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    // Cache für gefundene oder neu angelegte Kategorien
    const categoryCache = new Map<string, string>();

    const allCategories = await prisma.productCategory.findMany();
    for (const cat of allCategories) {
      categoryCache.set(cat.name.toLowerCase().trim(), cat.id);
    }

    for (const item of items) {
      const cleanName = (item.name || '').trim();
      const rawCatName = (item.category || 'Allgemein').trim();
      const catKey = rawCatName.toLowerCase();

      if (!cleanName || isNaN(item.price) || item.price < 0) {
        skippedCount++;
        continue;
      }

      // Kategorie ermitteln oder neu anlegen
      let categoryId = categoryCache.get(catKey);
      if (!categoryId) {
        const highestSort = await prisma.productCategory.aggregate({
          _max: { sortIndex: true },
        });
        const nextSort = (highestSort._max.sortIndex ?? 0) + 1;

        const newCat = await prisma.productCategory.create({
          data: {
            name: rawCatName,
            sortIndex: nextSort,
            color: rawCatName.toLowerCase().includes('getränk') ? '#3b82f6' : '#10b981',
          },
        });
        categoryId = newCat.id;
        categoryCache.set(catKey, categoryId);
      }

      const priceCents = Math.round(item.price * 100);
      const taxRate = typeof item.taxRate === 'number' ? item.taxRate : 19.0;

      // Prüfen, ob Artikel bereits in dieser Kategorie existiert
      const existingProduct = await prisma.product.findFirst({
        where: {
          name: cleanName,
          categoryId: categoryId,
        },
      });

      if (existingProduct) {
        // Bestehenden Artikel aktualisieren (Preis / Steuersatz)
        await prisma.product.update({
          where: { id: existingProduct.id },
          data: {
            priceCents,
            taxRate,
            status: 'ACTIVE',
            ...(item.printGroupId ? { printGroupId: item.printGroupId } : {}),
          },
        });
        updatedCount++;
      } else {
        // Neuen Artikel anlegen
        await prisma.product.create({
          data: {
            name: cleanName,
            priceCents,
            taxRate,
            categoryId: categoryId,
            status: 'ACTIVE',
            printGroupId: item.printGroupId || null,
          },
        });
        createdCount++;
      }
    }

    return NextResponse.json({
      success: true,
      createdCount,
      updatedCount,
      skippedCount,
      totalProcessed: items.length,
    });
  } catch (err: any) {
    console.error('Fehler beim Batch-Import von Speisekarten-Artikeln:', err);
    return NextResponse.json(
      { error: err.message || 'Fehler beim Importieren der Artikel' },
      { status: 500 }
    );
  }
}
