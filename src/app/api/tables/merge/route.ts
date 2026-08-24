import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tables/merge
 * Führt zwei Tische zusammen (Tisch A wird in Tisch B integriert).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sourceTableId, targetTableId, waiterName } = body;

    if (!sourceTableId || !targetTableId) {
      return NextResponse.json(
        { error: 'sourceTableId und targetTableId sind erforderlich.' },
        { status: 400 }
      );
    }

    if (sourceTableId === targetTableId) {
      return NextResponse.json(
        { error: 'Quell- und Zieltisch dürfen nicht identisch sein.' },
        { status: 400 }
      );
    }

    const [sourceTable, targetTable] = await Promise.all([
      prisma.diningTable.findUnique({ where: { id: sourceTableId } }),
      prisma.diningTable.findUnique({ where: { id: targetTableId } }),
    ]);

    if (!sourceTable || !targetTable) {
      return NextResponse.json({ error: 'Tisch nicht gefunden.' }, { status: 404 });
    }

    const sourceOrders = await prisma.order.findMany({
      where: {
        tableId: sourceTableId,
        status: { in: ['OPEN', 'IN_PREPARATION', 'READY'] },
      },
    });

    // Verschiebe alle offenen Bestellungen von sourceTableId auf targetTableId
    await prisma.$transaction([
      prisma.order.updateMany({
        where: {
          tableId: sourceTableId,
          status: { in: ['OPEN', 'IN_PREPARATION', 'READY'] },
        },
        data: {
          tableId: targetTableId,
        },
      }),
      prisma.diningTable.update({
        where: { id: sourceTableId },
        data: { status: 'FREE' },
      }),
      prisma.diningTable.update({
        where: { id: targetTableId },
        data: { status: 'OCCUPIED' },
      }),
    ]);

    if (global.io) {
      global.io.emit('table:status_changed', {
        sourceTableId,
        targetTableId,
        action: 'MERGE',
        mergedOrderCount: sourceOrders.length,
        waiterName: waiterName || 'Bedienung',
      });
      global.io.emit('order:new');
    }

    return NextResponse.json({
      success: true,
      message: `Tisch ${sourceTable.tableNumber} erfolgreich mit Tisch ${targetTable.tableNumber} zusammengelegt.`,
      mergedOrderCount: sourceOrders.length,
      sourceTableNumber: sourceTable.tableNumber,
      targetTableNumber: targetTable.tableNumber,
    });
  } catch (error) {
    console.error('Error merging tables:', error);
    return NextResponse.json(
      { error: 'Fehler beim Zusammenlegen der Tische.' },
      { status: 500 }
    );
  }
}
