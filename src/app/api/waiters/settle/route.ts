import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { logSystemActionSafe } from '@/lib/action-logger';
import { requireApiAuth } from '@/lib/api-guard';
import networkSpooler from '@/lib/printer/network-spooler';
import { EscPosBuilder } from '@/lib/printer/escpos-builder';

/**
 * Schliesst die Schicht einer Bedienung ab.
 *
 * Nur fuer Administratoren: Die Abrechnung entscheidet ueber Bargeldabgabe und
 * Trinkgeldverteilung. Frueher konnte jede Station diesen Aufruf ausloesen -
 * eine Bedienung haette ihre eigene Schicht abrechnen koennen.
 */
export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;
  const { denyStandbyWrite } = await import('@/lib/ha/ha-guard');
  const denied = denyStandbyWrite();
  if (denied) return denied;

  try {
    const body = await req.json();
    const {
      waiterName,
      waiterId,
      totalGross,
      cashGross,
      tips,
      handoverAmount,
      notes,
      // Neu: Kassensturz-Werte und Beleg-Ausgabe
      cashExpected,
      cashCounted,
      tipWaiterShare,
      tipPoolShare,
      tipProfileName,
      byMethod,
      transactionCount,
      printReceipt,
      printerId,
    } = body;

    if (!waiterName && !waiterId) {
      return NextResponse.json({ error: 'Bedienungsname oder ID erforderlich' }, { status: 400 });
    }

    const name = waiterName || 'Bedienung';

    // 1. Audit Log der Abrechnung
    await logSystemActionSafe(() => ({
      action: 'WAITER_SETTLED',
      category: 'AUTH',
      actor: name,
      details:
        `Schichtabrechnung für ${name} abgeschlossen. ` +
        `Umsatz: ${Number(totalGross || 0).toFixed(2)} €, ` +
        `Soll-Bar: ${Number(cashExpected ?? cashGross ?? 0).toFixed(2)} €, ` +
        `gezählt: ${Number(cashCounted ?? handoverAmount ?? 0).toFixed(2)} €, ` +
        `Differenz: ${(Number(cashCounted ?? handoverAmount ?? 0) - Number(cashExpected ?? cashGross ?? 0)).toFixed(2)} €, ` +
        `Trinkgeld: ${Number(tips || 0).toFixed(2)} €`,
      metadata: {
        totalGross,
        cashGross,
        cashExpected,
        cashCounted,
        tips,
        tipWaiterShare,
        tipPoolShare,
        handoverAmount,
        transactionCount,
        byMethod,
        notes,
        settledBy: auth.session.waiterName || auth.session.role,
      },
    }));

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
      const { getOrAssignWaiterNumber } = await import('@/lib/waiter-number');
      const waiterNumber = await getOrAssignWaiterNumber(name);
      await prisma.waiterProfile
        .upsert({
          where: { name },
          update: { isActive: false },
          create: { name, waiterNumber, pin: '3333', isActive: false },
        })
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
      (global as any).io.emit('waiters:settled', { waiterName: name });
      (global as any).io.emit('table:updated');
    }

    // 5. Abrechnungsbeleg drucken (optional).
    //    Die Zahlen kommen unveraendert aus /api/waiters/settle/report - so
    //    zeigen Bildschirm, Papier und PDF garantiert dasselbe.
    let printed = false;
    let printError: string | null = null;
    if (printReceipt) {
      try {
        const [config, printer] = await Promise.all([
          prisma.eventConfig.findUnique({ where: { id: 'default' } }),
          printerId
            ? prisma.printer.findUnique({ where: { id: printerId } })
            : prisma.printer.findFirst({ where: { isActive: true } }),
        ]);

        if (!printer) {
          printError = 'Kein aktiver Drucker konfiguriert.';
        } else {
          const expected = Number(cashExpected ?? cashGross ?? 0);
          const counted = Number(cashCounted ?? handoverAmount ?? 0);
          const { rawBuffer, textRepresentation } = EscPosBuilder.buildSettlementTicket(
            {
              waiterName: name,
              eventName: config?.name || undefined,
              isTraining: config?.trainingMode ?? false,
              settledAt: new Date(),
              settledBy: auth.session.waiterName || auth.session.role,
              totalGrossCents: Math.round(Number(totalGross || 0)),
              transactionCount: Number(transactionCount || 0),
              byMethod: Array.isArray(byMethod)
                ? byMethod.map((m: any) => ({
                    label: String(m.label || m.method || 'Zahlart'),
                    amountCents: Math.round(Number(m.amountCents ?? m.amount ?? 0)),
                  }))
                : [],
              tipsTotalCents: Math.round(Number((tips as any)?.totalCents ?? tips ?? 0)),
              tipWaiterShareCents: Math.round(Number(tipWaiterShare || 0)),
              tipPoolShareCents: Math.round(Number(tipPoolShare || 0)),
              tipProfileName: tipProfileName || null,
              cashExpectedCents: Math.round(expected),
              cashCountedCents: Math.round(counted),
              cashDifferenceCents: Math.round(counted - expected),
              notes: notes || undefined,
            },
            printer.paperWidth
          );
          const result = await networkSpooler.sendRawBuffer(printer, rawBuffer, textRepresentation);
          printed = result.success;
        }
      } catch (printErr) {
        printError = printErr instanceof Error ? printErr.message : String(printErr);
        console.error('[ABRECHNUNG] Beleg konnte nicht gedruckt werden:', printError);
      }
    }

    return NextResponse.json({
      success: true,
      printed,
      printError,
      message: `Schicht für ${name} erfolgreich abgerechnet und abgemeldet.`,
    });
  } catch (error: any) {
    console.error('Fehler bei Schichtabrechnung:', error);
    return NextResponse.json({ error: error.message || 'Fehler bei der Schichtabrechnung' }, { status: 500 });
  }
}
