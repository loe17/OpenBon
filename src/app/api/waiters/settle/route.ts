import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { logSystemAction } from '@/lib/action-logger';
import { requireApiAuth } from '@/lib/api-guard';

export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

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

    // 2. Schicht beenden – das Profil wird NICHT geloescht.
    //    Frueher wurde hier deleteMany aufgerufen: Damit verschwand die Bedienung
    //    nach der ersten Abrechnung samt PIN und Trinkgeldprofil dauerhaft aus
    //    allen Listen. Stattdessen wird sie nur auf inaktiv gesetzt und kann zur
    //    naechsten Schicht wieder aktiviert werden.
    const where = waiterId ? { id: waiterId } : { name: waiterName };
    const updated = await prisma.waiterProfile.updateMany({
      where,
      data: { isActive: false },
    });

    if (updated.count === 0) {
      // Bedienung war nur lokal am Geraet angemeldet: Profil nachtraeglich anlegen,
      // damit die Abrechnung nachvollziehbar bleibt.
      await prisma.waiterProfile
        .create({ data: { name, isActive: false } })
        .catch(() => undefined);
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
