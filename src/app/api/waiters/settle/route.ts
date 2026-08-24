import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { logSystemAction } from '@/lib/action-logger';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { waiterName, waiterId, totalGross, cashGross, tips, handoverAmount, notes } = body;

    if (!waiterName && !waiterId) {
      return NextResponse.json({ error: 'Bedienungsname oder ID erforderlich' }, { status: 400 });
    }

    const name = waiterName || 'Bedienung';

    // 1. Audit Log der Abrechnung
    await logSystemAction({
      action: 'WAITER_SETTLED',
      category: 'AUTH',
      actor: name,
      details: `Schichtabrechnung für ${name} abgeschlossen. Umsatz: ${(totalGross || 0).toFixed(2)} €, Bar: ${(cashGross || 0).toFixed(2)} €, Trinkgeld: ${(tips || 0).toFixed(2)} €, Barabgabe: ${(handoverAmount || 0).toFixed(2)} €`,
      metadata: { totalGross, cashGross, tips, handoverAmount, notes },
    });

    // 2. Falls WaiterProfile in der Datenbank existiert, löschen (Schicht beenden)
    if (waiterId) {
      await prisma.waiterProfile.deleteMany({
        where: { id: waiterId },
      });
    } else if (waiterName) {
      await prisma.waiterProfile.deleteMany({
        where: { name: waiterName },
      });
    }

    // 3. Tische freigeben die dieser Bedienung zugewiesen waren und keine offenen Posten haben
    await prisma.diningTable.updateMany({
      where: { activeWaiterName: name },
      data: { activeWaiterName: null },
    });

    // 4. Socket Broadcast
    if (typeof global !== 'undefined' && (global as any).io) {
      (global as any).io.emit('waiter:settled', { waiterName: name });
      (global as any).io.emit('table:updated');
    }

    return NextResponse.json({
      success: true,
      message: `Schicht für ${name} erfolgreich abgerechnet und abgemeldet.`,
    });
  } catch (error: any) {
    console.error('Fehler bei Schichtabrechnung:', error);
    return NextResponse.json({ error: error.message || 'Fehler bei der Schichtabrechnung' }, { status: 500 });
  }
}
