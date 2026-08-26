import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import TicketSplitter from '@/lib/printer/ticket-splitter';
import { requireApiAuth } from '@/lib/api-guard';

/**
 * Spec 6.5: Manueller Postenabruf für zurückgehaltene Positionen (HOLD)
 * bzw. für einen einzelnen Gang.
 *
 * Body: { itemIds?: string[]; courseNumber?: number }
 * Ohne Angabe werden alle noch gehaltenen Positionen der Bestellung abgerufen.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      itemIds?: string[];
      courseNumber?: number;
    };

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: { items: { include: { product: true } }, table: true },
    });
    if (!order) {
      return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
    }

    const toRelease = order.items.filter((item) => {
      if (item.isCancelled) return false;
      if (item.printStatus === 'PRINTED') return false;
      if (body.itemIds && body.itemIds.length > 0) return body.itemIds.includes(item.id);
      if (body.courseNumber !== undefined) return item.courseNumber === body.courseNumber;
      return item.isHold;
    });

    if (toRelease.length === 0) {
      return NextResponse.json(
        { error: 'Keine zurückgehaltenen Positionen zum Abrufen gefunden.' },
        { status: 400 }
      );
    }

    const { ticketsGenerated, printedItemIds } = await TicketSplitter.routeAndPrintOrder(
      {
        id: order.id,
        orderNumber: order.orderNumber,
        tableLabel:
          order.table?.label ?? (order.tokenNumber ? `Abholmarke #${order.tokenNumber}` : 'Theke'),
        waiterName: order.waiterName,
        tokenNumber: order.tokenNumber,
        isTraining: order.isTraining,
        createdAt: order.createdAt,
        items: toRelease.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.productName,
          alternativeName: i.product.alternativeTicketName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          deposit: i.deposit,
          variantName: i.variantName,
          selectedOptions: i.selectedOptions,
          customizationText: i.customizationText,
          courseNumber: i.courseNumber,
          isHold: i.isHold,
        })),
      },
      { onlyItemIds: toRelease.map((i) => i.id), includeHold: true }
    );

    await prisma.orderItem.updateMany({
      where: { id: { in: printedItemIds.length > 0 ? printedItemIds : toRelease.map((i) => i.id) } },
      data: { isHold: false, printStatus: 'PRINTED' },
    });

    if (global.io) {
      global.io.emit('order:course_released', {
        orderId: order.id,
        itemIds: toRelease.map((i) => i.id),
        courseNumber: body.courseNumber ?? null,
      });
    }

    await logSystemActionSafe(() => ({
      action: 'ORDER_RELEASED',
      category: 'ORDERS',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Zurueckgehaltene Positionen freigegeben.',
    }));

    return NextResponse.json({
      success: true,
      releasedItems: toRelease.length,
      ticketsGenerated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
