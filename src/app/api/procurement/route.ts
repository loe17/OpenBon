import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';

export const dynamic = 'force-dynamic';

/**
 * GET /api/procurement
 * Berechnet automatische Nachbestellvorschläge für Lieferanten basierend auf Meldebeständen.
 */
export async function GET(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const products = await prisma.product.findMany({
      where: {
        trackStock: true,
        status: { not: 'HIDDEN' },
      },
      include: {
        stockItem: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ categoryId: 'asc' }, { name: 'asc' }],
    });

    const suggestions = products.map((prod) => {
      const minStock = prod.minStockAlert || prod.stockAlertThreshold || 5;
      const targetStock = minStock * 3; // Zielbestand = 3x Meldebestand
      const currentStock = prod.stockItem?.currentQuantity ?? prod.stockQuantity ?? 0;
      const neededQty = Math.max(0, targetStock - currentStock);
      const isUrgent = currentStock <= minStock;

      return {
        id: prod.id,
        name: prod.name,
        categoryName: prod.category?.name || 'Allgemein',
        currentStock,
        minStock,
        targetStock,
        suggestedQty: neededQty,
        isUrgent,
        unitPrice: prod.price,
      };
    });

    // Gruppierung nach Warengruppe / Lieferant
    const grouped: Record<string, typeof suggestions> = {};
    for (const s of suggestions) {
      if (!grouped[s.categoryName]) {
        grouped[s.categoryName] = [];
      }
      grouped[s.categoryName].push(s);
    }

    return NextResponse.json({
      totalProductsTracked: products.length,
      urgentCount: suggestions.filter((s) => s.isUrgent).length,
      suggestions,
      grouped,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Fehler bei der Berechnung des Bestellvorschlags.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/procurement
 * Bucht Wareneingang für ausgewählte Artikel (Bestandserhöhung).
 */
export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { items } = body; // items: [{ productId, receivedQty }]

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Keine Artikel übergeben.' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (!item.productId || !item.receivedQty || item.receivedQty <= 0) continue;

        const qty = Number(item.receivedQty);
        // 1. StockItem erhöhen
        const stock = await tx.stockItem.upsert({
          where: { productId: item.productId },
          create: {
            productId: item.productId,
            currentQuantity: qty,
            initialQuantity: qty,
            isAutoDeactivate: true,
          },
          update: {
            currentQuantity: { increment: qty },
          },
        });

        // 2. Product-Status bei Wiederverfügbarkeit reaktivieren
        if (stock.currentQuantity > 0) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: stock.currentQuantity,
              isSoldOut: false,
            },
          });
        }
      }
    });

    if (global.io) {
      global.io.emit('stock:updated');
    }

    return NextResponse.json({
      success: true,
      message: `${items.length} Artikel erfolgreich im Bestand eingebucht.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Fehler beim Einbuchen des Wareneingangs.' },
      { status: 500 }
    );
  }
}
