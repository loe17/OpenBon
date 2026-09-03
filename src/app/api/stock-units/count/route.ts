import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';
import { validateBody, StockCountSchema } from '@/lib/validations/schemas';
import { logSystemActionSafe } from '@/lib/action-logger';

/**
 * Inventur-Zählung: Soll/Ist-Vergleich + Differenzbuchung für StockUnit oder Product.stockQuantity.
 */
export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;
  const v = await validateBody(req, StockCountSchema);
  if (!v.success) return v.response;
  const { stockUnitId, productId, countedQuantity, note } = v.data;
  if (!stockUnitId && !productId) {
    return NextResponse.json({ error: 'stockUnitId oder productId erforderlich.' }, { status: 400 });
  }
  try {
    if (stockUnitId) {
      const unit = await prisma.stockUnit.findUnique({ where: { id: stockUnitId } });
      if (!unit) return NextResponse.json({ error: 'Lagerposten nicht gefunden.' }, { status: 404 });
      const soll = unit.currentQuantity;
      const diff = countedQuantity - soll;
      const updated = await prisma.stockUnit.update({
        where: { id: stockUnitId },
        data: { currentQuantity: countedQuantity },
      });
      await logSystemActionSafe(() => ({
        action: 'STOCK_COUNTED',
        category: 'SYSTEM',
        actor: auth.session.waiterName || 'Admin',
        details: `Inventur ${unit.name}: Soll ${soll}, Ist ${countedQuantity}, Diff ${diff}. ${note || ''}`.trim(),
        metadata: { stockUnitId, soll, ist: countedQuantity, diff },
      }));
      return NextResponse.json({ success: true, soll, ist: countedQuantity, diff, unit: updated });
    }
    const product = await prisma.product.findUnique({ where: { id: productId! } });
    if (!product) return NextResponse.json({ error: 'Artikel nicht gefunden.' }, { status: 404 });
    const soll = product.stockQuantity;
    const diff = countedQuantity - soll;
    const updated = await prisma.product.update({
      where: { id: productId! },
      data: { stockQuantity: Math.trunc(countedQuantity) },
    });
    await logSystemActionSafe(() => ({
      action: 'STOCK_COUNTED',
      category: 'SYSTEM',
      actor: auth.session.waiterName || 'Admin',
      details: `Inventur ${product.name}: Soll ${soll}, Ist ${countedQuantity}, Diff ${diff}. ${note || ''}`.trim(),
      metadata: { productId, soll, ist: countedQuantity, diff },
    }));
    return NextResponse.json({ success: true, soll, ist: countedQuantity, diff, product: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
