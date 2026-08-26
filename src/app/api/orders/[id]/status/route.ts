import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const orderId = params.id;

    // Action 1: Update individual item KDS status
    if (body.itemId && body.itemKdsStatus) {
      const updatedItem = await prisma.orderItem.update({
        where: { id: body.itemId },
        data: {
          kdsStatus: body.itemKdsStatus,
          kdsCompletedAt: body.itemKdsStatus === 'COMPLETED' ? new Date() : null,
        },
      });

      // Check if all items in the order are completed
      const allItems = await prisma.orderItem.findMany({ where: { orderId } });
      const allDone = allItems.every((i) => i.kdsStatus === 'COMPLETED' || i.isCancelled);

      if (allDone) {
        const order = await prisma.order.update({
          where: { id: orderId },
          data: { status: 'READY' },
          include: { table: true },
        });

        if (global.io) {
          global.io.emit('order:ready', {
            orderId,
            orderNumber: order.orderNumber,
            tableNumber: order.table?.tableNumber,
            tableLabel: order.table?.label,
            waiterName: order.waiterName,
            tokenNumber: order.tokenNumber,
          });
        }
      }

      if (global.io) {
        global.io.emit('kds:item_updated', { orderId, item: updatedItem, allDone });
      }

      await logSystemActionSafe(() => ({
        action: 'ORDER_STATUS_CHANGED',
        category: 'ORDERS',
        actor: auth.session.waiterName || auth.session.role,
        details: 'Bestellstatus geaendert.',
      }));

      return NextResponse.json({ success: true, item: updatedItem, allDone });
    }

    // Action 2: Mark whole order as READY or COMPLETED
    if (body.orderStatus) {
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: { status: body.orderStatus },
        include: { items: true, table: true },
      });

      if (body.orderStatus === 'COMPLETED') {
        await prisma.orderItem.updateMany({
          where: { orderId },
          data: { kdsStatus: 'COMPLETED', kdsCompletedAt: new Date() },
        });
      }

      if (global.io) {
        global.io.emit('kds:order_updated', updatedOrder);
        if (body.orderStatus === 'READY' || body.orderStatus === 'COMPLETED') {
          global.io.emit('order:ready', {
            orderId,
            orderNumber: updatedOrder.orderNumber,
            tableNumber: updatedOrder.table?.tableNumber,
            tableLabel: updatedOrder.table?.label,
            waiterName: updatedOrder.waiterName,
            tokenNumber: updatedOrder.tokenNumber,
          });
        }
      }

      await logSystemActionSafe(() => ({
        action: 'ORDER_STATUS_CHANGED',
        category: 'ORDERS',
        actor: auth.session.waiterName || auth.session.role,
        details: 'Bestellstatus geaendert.',
      }));

      return NextResponse.json(updatedOrder);
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
