import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';
import { validateBody, KdsUndoSchema } from '@/lib/validations/schemas';
import { logSystemActionSafe } from '@/lib/action-logger';

/** KDS-Rückgängig: versehentlich abgehakte Position zurück auf IN_PROGRESS (10-Min-Fenster). */
export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;
  const v = await validateBody(req, KdsUndoSchema);
  if (!v.success) return v.response;
  try {
    const item = await prisma.orderItem.findUnique({ where: { id: v.data.orderItemId } });
    if (!item) return NextResponse.json({ error: 'Position nicht gefunden.' }, { status: 404 });
    if (item.kdsStatus !== 'COMPLETED' && item.kdsStatus !== 'READY') {
      return NextResponse.json({ error: 'Nur fertige Positionen können zurückgeholt werden.' }, { status: 409 });
    }
    if (item.kdsCompletedAt && Date.now() - new Date(item.kdsCompletedAt).getTime() > 10 * 60 * 1000) {
      return NextResponse.json({ error: 'Rückgängig nur 10 Minuten möglich.' }, { status: 409 });
    }
    const updated = await prisma.orderItem.update({
      where: { id: item.id },
      data: { kdsStatus: 'IN_PROGRESS', kdsCompletedAt: null },
    });
    await logSystemActionSafe(() => ({
      action: 'KDS_UNDO',
      category: 'ORDERS',
      actor: auth.session.waiterName || auth.session.role,
      details: `KDS-Rückgängig: ${item.productName} x${item.quantity}`,
      metadata: { orderItemId: item.id, orderId: item.orderId },
    }));
    if (global.io) global.io.emit('kds:updated', { orderItemId: item.id, kdsStatus: 'IN_PROGRESS' });
    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
