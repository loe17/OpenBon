import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { requireApiAuth } from '@/lib/api-guard';
import { toCents } from '@/lib/pricing';

export async function GET(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const products = await prisma.product.findMany({
      where: { status: { not: 'HIDDEN' } },
      include: {
        category: true,
        printGroup: true,
        stockItem: true,
      },
      orderBy: [{ category: { sortIndex: 'asc' } }, { sortIndex: 'asc' }],
    });

    const lines: string[] = [
      'Kategorie;Artikelname;BonKurzname;Preis;Pfand;MwSt;Unterkategorie;Druckgruppe;Bestandstracking;Bestand',
    ];

    for (const p of products) {
      lines.push(
        [
          `"${p.category?.name || 'Allgemein'}"`,
          `"${p.name}"`,
          `"${p.alternativeTicketName || ''}"`,
          (p.priceCents / 100).toFixed(2),
          (p.depositCents / 100).toFixed(2),
          p.taxRate.toFixed(1),
          p.subCategory || 'ALL',
          `"${p.printGroup?.name || ''}"`,
          p.trackStock ? 'JA' : 'NEIN',
          p.stockItem?.currentQuantity ?? 0,
        ].join(';')
      );
    }

    return new Response(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="OpenBon_Speisekarte_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const { csvText } = await req.json();
    if (!csvText || typeof csvText !== 'string') {
      return NextResponse.json({ error: 'Kein CSV-Inhalt übermittelt' }, { status: 400 });
    }

    const lines = csvText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV-Datei ist leer oder enthält nur Kopfzeilen' }, { status: 400 });
    }

    // Kopfzeile überspringen
    const dataLines = lines.slice(1);
    let createdCount = 0;
    let updatedCount = 0;

    for (const line of dataLines) {
      // CSV Semikolon-Split unter Berücksichtigung von Anführungszeichen
      const parts = line.split(';').map((p) => p.replace(/^"|"$/g, '').trim());
      if (parts.length < 4) continue;

      const [
        categoryName,
        productName,
        bonName,
        priceStr,
        depositStr,
        taxRateStr,
        subCategory,
        printGroupName,
        trackStockStr,
        stockStr,
      ] = parts;

      if (!productName || !categoryName) continue;

      const priceCents = toCents(parseFloat(priceStr.replace(',', '.')) || 0);
      const depositCents = toCents(parseFloat((depositStr || '0').replace(',', '.')) || 0);
      const taxRate = parseFloat((taxRateStr || '19').replace(',', '.')) || 19;
      const trackStock = (trackStockStr || '').toUpperCase() === 'JA' || trackStockStr === '1' || trackStockStr === 'true';
      const stockQuantity = parseInt(stockStr || '100', 10) || 100;

      // 1. Warengruppe finden oder anlegen
      let category = await prisma.productCategory.findFirst({
        where: { name: categoryName },
      });
      if (!category) {
        category = await prisma.productCategory.create({
          data: { name: categoryName, sortIndex: 0 },
        });
      }

      // 2. Druckgruppe finden
      let printGroupId: string | null = null;
      if (printGroupName) {
        const pg = await prisma.printGroup.findFirst({ where: { name: printGroupName } });
        if (pg) printGroupId = pg.id;
      }

      // 3. Artikel upsert
      const existingProduct = await prisma.product.findFirst({
        where: { name: productName, categoryId: category.id },
      });

      if (existingProduct) {
        await prisma.product.update({
          where: { id: existingProduct.id },
          data: {
            alternativeTicketName: bonName || existingProduct.alternativeTicketName,
            priceCents,
            depositCents,
            taxRate,
            subCategory: subCategory || existingProduct.subCategory,
            printGroupId: printGroupId || existingProduct.printGroupId,
            trackStock,
          },
        });

        if (trackStock) {
          await prisma.stockItem.upsert({
            where: { productId: existingProduct.id },
            create: { productId: existingProduct.id, currentQuantity: stockQuantity, initialQuantity: stockQuantity },
            update: { currentQuantity: stockQuantity },
          });
        }
        updatedCount++;
      } else {
        const newProd = await prisma.product.create({
          data: {
            name: productName,
            alternativeTicketName: bonName || null,
            categoryId: category.id,
            priceCents,
            depositCents,
            taxRate,
            subCategory: subCategory || 'SPEISE',
            printGroupId,
            trackStock,
          },
        });

        if (trackStock) {
          await prisma.stockItem.create({
            data: {
              productId: newProd.id,
              currentQuantity: stockQuantity,
              initialQuantity: stockQuantity,
            },
          });
        }
        createdCount++;
      }
    }

    if (global.io) {
      global.io.emit('product:updated', {});
    }

    await logSystemActionSafe(() => ({
      action: 'PRODUCTS_IMPORTED',
      category: 'ADMIN',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Artikel per CSV eingelesen.',
    }));

    return NextResponse.json({
      success: true,
      createdCount,
      updatedCount,
      message: `${createdCount} Artikel neu angelegt, ${updatedCount} aktualisiert.`,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
