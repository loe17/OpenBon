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
      // Neu: Abrechnungskorrektur & Beleg-Details
      isCorrection,
      printDetails,
      itemsSold,
      orders,
    } = body;

    if (!waiterName && !waiterId) {
      return NextResponse.json({ error: 'Bedienungsname oder ID erforderlich' }, { status: 400 });
    }

    const name = waiterName || 'Bedienung';

    const resolvedTotalGrossCents = Number(body.totalGrossCents ?? (typeof totalGross === 'number' ? Math.round(totalGross * 100) : 0));
    const resolvedCashGrossCents = Number(body.cashGrossCents ?? (typeof cashGross === 'number' ? Math.round(cashGross * 100) : 0));
    const resolvedCashExpectedCents = Number(body.cashExpectedCents ?? (typeof cashExpected === 'number' ? Math.round(cashExpected * 100) : resolvedCashGrossCents));
    const resolvedCashCountedCents = Number(body.cashCountedCents ?? (typeof cashCounted === 'number' ? Math.round(cashCounted * 100) : (typeof handoverAmount === 'number' ? Math.round(handoverAmount * 100) : 0)));
    const resolvedTipsTotalCents = Number(body.tipsTotalCents ?? (typeof tips === 'number' ? Math.round(tips * 100) : 0));
    const resolvedTipWaiterShareCents = Number(body.tipWaiterShareCents ?? (typeof tipWaiterShare === 'number' ? Math.round(tipWaiterShare * 100) : 0));
    const resolvedTipPoolShareCents = Number(body.tipPoolShareCents ?? (typeof tipPoolShare === 'number' ? Math.round(tipPoolShare * 100) : 0));

    // 1. Audit Log der Abrechnung
    await logSystemActionSafe(() => ({
      action: isCorrection ? 'WAITER_SETTLEMENT_CORRECTION' : 'WAITER_SETTLED',
      category: 'AUTH',
      actor: name,
      details:
        (isCorrection ? `Abrechnungskorrektur für ${name} durch Admin abgeschlossen. ` : `Schichtabrechnung für ${name} abgeschlossen. `) +
        `Umsatz: ${(resolvedTotalGrossCents / 100).toFixed(2)} €, ` +
        `Soll-Bar: ${(resolvedCashExpectedCents / 100).toFixed(2)} €, ` +
        `gezählt: ${(resolvedCashCountedCents / 100).toFixed(2)} €, ` +
        `Differenz: ${((resolvedCashCountedCents - resolvedCashExpectedCents) / 100).toFixed(2)} €, ` +
        `Trinkgeld: ${(resolvedTipsTotalCents / 100).toFixed(2)} €`,
      metadata: {
        isCorrection: Boolean(isCorrection),
        totalGross: resolvedTotalGrossCents / 100,
        totalGrossCents: resolvedTotalGrossCents,
        cashGross: resolvedCashGrossCents / 100,
        cashGrossCents: resolvedCashGrossCents,
        cashExpected: resolvedCashExpectedCents / 100,
        cashExpectedCents: resolvedCashExpectedCents,
        cashCounted: resolvedCashCountedCents / 100,
        cashCountedCents: resolvedCashCountedCents,
        tips: resolvedTipsTotalCents / 100,
        tipsTotalCents: resolvedTipsTotalCents,
        tipWaiterShare: resolvedTipWaiterShareCents / 100,
        tipWaiterShareCents: resolvedTipWaiterShareCents,
        tipPoolShare: resolvedTipPoolShareCents / 100,
        tipPoolShareCents: resolvedTipPoolShareCents,
        handoverAmount: resolvedCashCountedCents / 100,
        transactionCount,
        byMethod,
        notes,
        settledBy: auth.session.waiterName || auth.session.role,
      },
    }));

    // 2. Schicht beenden – das Profil wird NICHT geloescht.
    //    Frueher wurde hier deleteMany aufgerufen: Damit verschwand die Bedienung
    //    nach der ersten Abrechnung samt PIN und Trinkgeldprofil dauerhaft aus
    //    der Datenbank. Jetzt wird sie nur noch inaktiv gesetzt und kann in der
    //    naechsten Schicht wieder aktiviert werden.
    await prisma.waiterProfile.updateMany({
      where: { name },
      data: {
        isActive: false,
      },
    });

    // 3. Tische der Bedienung freigeben (falls noch aktiv zugeordnet)
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
          const { rawBuffer, textRepresentation } = EscPosBuilder.buildSettlementTicket(
            {
              waiterName: name,
              eventName: config?.name || undefined,
              isTraining: config?.trainingMode ?? false,
              isCorrection: Boolean(isCorrection),
              printDetails: Boolean(printDetails),
              itemsSold: Array.isArray(itemsSold) ? itemsSold : undefined,
              orders: Array.isArray(orders) ? orders : undefined,
              settledAt: new Date(),
              settledBy: auth.session.waiterName || auth.session.role,
              totalGrossCents: resolvedTotalGrossCents,
              transactionCount: Number(transactionCount || 0),
              byMethod: Array.isArray(byMethod)
                ? byMethod.map((m: any) => ({
                    label: String(m.label || m.method || 'Zahlart'),
                    amountCents: Math.round(Number(m.amountCents ?? (typeof m.amount === 'number' ? m.amount * 100 : 0))),
                  }))
                : [],
              tipsTotalCents: resolvedTipsTotalCents,
              tipWaiterShareCents: resolvedTipWaiterShareCents,
              tipPoolShareCents: resolvedTipPoolShareCents,
              tipProfileName: tipProfileName || null,
              cashExpectedCents: resolvedCashExpectedCents,
              cashCountedCents: resolvedCashCountedCents,
              cashDifferenceCents: resolvedCashCountedCents - resolvedCashExpectedCents,
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
      message: isCorrection
        ? `Abrechnungskorrektur für ${name} erfolgreich abgeschlossen.`
        : `Schicht für ${name} erfolgreich abgerechnet und abgemeldet.`,
    });
  } catch (error: any) {
    console.error('Fehler bei Schichtabrechnung:', error);
    return NextResponse.json({ error: error.message || 'Fehler bei der Schichtabrechnung' }, { status: 500 });
  }
}
