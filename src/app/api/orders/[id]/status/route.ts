import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
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
        await prisma.order.update({
          where: { id: orderId },
          data: { status: 'READY' },
        });
      }

      if (global.io) {
        global.io.emit('kds:item_updated', { orderId, item: updatedItem, allDone });
      }

      return NextResponse.json({ success: true, item: updatedItem, allDone });
    }

    // Action 2: Mark whole order as READY or COMPLETED
    if (body.orderStatus) {
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: { status: body.orderStatus },
        include: { items: true },
      });

      if (body.orderStatus === 'COMPLETED') {
        await prisma.orderItem.updateMany({
          where: { orderId },
          data: { kdsStatus: 'COMPLETED', kdsCompletedAt: new Date() },
        });
      }

      if (global.io) {
        global.io.emit('kds:order_updated', updatedOrder);
      }

      return NextResponse.json(updatedOrder);
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
