import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/procurement
 * Berechnet automatische Nachbestellvorschläge für Lieferanten basierend auf Meldebeständen.
 */
export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: {
        trackStock: true,
      },
      include: {
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
      const minStock = prod.minStockAlert || 5;
      const targetStock = minStock * 3; // Zielbestand = 3x Meldebestand
      const currentStock = prod.stockQuantity || 0;
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
    console.error('Error computing procurement suggestions:', error);
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
  try {
    const body = await req.json();
    const { items, note } = body; // items: [{ productId, receivedQty }]

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Keine Artikel übergeben.' }, { status: 400 });
    }

    const updates = [];
    for (const item of items) {
      if (!item.productId || !item.receivedQty || item.receivedQty <= 0) continue;

      updates.push(
        prisma.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: { increment: Number(item.receivedQty) },
          },
        })
      );
    }

    await prisma.$transaction(updates);

    if (global.io) {
      global.io.emit('inventory:updated');
    }

    return NextResponse.json({
      success: true,
      message: `${updates.length} Artikel erfolgreich im Bestand eingebucht.`,
    });
  } catch (error) {
    console.error('Error applying procurement received stock:', error);
    return NextResponse.json(
      { error: 'Fehler beim Einbuchen des Wareneingangs.' },
      { status: 500 }
    );
  }
}
