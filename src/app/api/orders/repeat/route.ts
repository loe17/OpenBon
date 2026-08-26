import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';

/**
 * Spec 6.6: Schnell-Nachbestellung "Gleiche Runde noch einmal".
 *
 * Liefert die zuletzt bestellten Getränke eines Tisches in einer Form zurück,
 * die der Client direkt in den Warenkorb übernehmen kann. Es wird bewusst
 * KEINE Bestellung angelegt – die Bedienung soll die Runde vor dem Abschicken
 * noch anpassen können.
 *
 * GET /api/orders/repeat?tableId=...&scope=last|all
 */
export async function GET(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const tableId = searchParams.get('tableId');
    const scope = searchParams.get('scope') === 'all' ? 'all' : 'last';

    if (!tableId) {
      return NextResponse.json({ error: 'tableId ist erforderlich' }, { status: 400 });
    }

    const orders = await prisma.order.findMany({
      where: {
        tableId,
        status: { not: 'CANCELLED' },
      },
      orderBy: { createdAt: 'desc' },
      take: scope === 'last' ? 1 : 20,
      include: {
        items: {
          where: { isCancelled: false },
          include: { product: true },
        },
      },
    });

    if (orders.length === 0) {
      return NextResponse.json({ lines: [], sourceOrderNumber: null });
    }

    // Positionen zusammenfassen (gleiche Kombination aus Artikel/Variante/Optionen)
    const merged = new Map<
      string,
      {
        productId: string;
        productName: string;
        alternativeTicketName: string | null;
        quantity: number;
        unitPrice: number;
        deposit: number;
        taxRate: number;
        variantName: string | null;
        selectedOptions: string[];
        customizationText: string | null;
        subCategory: string | null;
        isSoldOut: boolean;
      }
    >();

    for (const order of orders) {
      for (const item of order.items) {
        const key = [item.productId, item.variantName ?? '', item.selectedOptions ?? ''].join('|');
        const existing = merged.get(key);
        if (existing) {
          existing.quantity += item.quantity;
          continue;
        }
        merged.set(key, {
          productId: item.productId,
          productName: item.productName,
          alternativeTicketName: item.product.alternativeTicketName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          deposit: item.deposit,
          taxRate: item.taxRate,
          variantName: item.variantName,
          selectedOptions: item.selectedOptions ? (JSON.parse(item.selectedOptions) as string[]) : [],
          customizationText: item.customizationText,
          subCategory: item.product.subCategory,
          isSoldOut: item.product.isSoldOut || item.product.status !== 'ACTIVE',
        });
      }
    }

    const lines = Array.from(merged.values());

    return NextResponse.json({
      lines,
      sourceOrderNumber: orders[0].orderNumber,
      unavailable: lines.filter((l) => l.isSoldOut).map((l) => l.productName),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
