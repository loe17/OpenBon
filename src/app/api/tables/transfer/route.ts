import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tables/transfer
 * Verschiebt alle offenen Bestellungen von Tisch A nach Tisch B (Tischumzug).
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

    // Finde alle offenen Bestellungen des Quelltischs
    const openOrders = await prisma.order.findMany({
      where: {
        tableId: sourceTableId,
        status: { in: ['OPEN', 'IN_PREPARATION', 'READY'] },
      },
    });

    if (openOrders.length === 0) {
      return NextResponse.json(
        { error: 'Keine offenen Bestellungen auf dem Quelltisch vorhanden.' },
        { status: 400 }
      );
    }

    // Verschiebe alle offenen Bestellungen auf den Zieltisch
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
      // Quelltisch freigeben
      prisma.diningTable.update({
        where: { id: sourceTableId },
        data: { status: 'FREE' },
      }),
      // Zieltisch als belegt markieren
      prisma.diningTable.update({
        where: { id: targetTableId },
        data: { status: 'OCCUPIED' },
      }),
    ]);

    // Socket Broadcast
    if (global.io) {
      global.io.emit('table:status_changed', {
        sourceTableId,
        targetTableId,
        action: 'TRANSFER',
        movedOrderCount: openOrders.length,
        waiterName: waiterName || 'Bedienung',
      });
      global.io.emit('order:new');
    }

    return NextResponse.json({
      success: true,
      message: `Bestellungen erfolgreich von Tisch ${sourceTable.tableNumber} nach Tisch ${targetTable.tableNumber} verschoben.`,
      movedOrderCount: openOrders.length,
      sourceTableNumber: sourceTable.tableNumber,
      targetTableNumber: targetTable.tableNumber,
    });
  } catch (error) {
    console.error('Error transferring table orders:', error);
    return NextResponse.json(
      { error: 'Fehler beim Umbuchen des Tisches.' },
      { status: 500 }
    );
  }
}
