import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import networkSpooler from '@/lib/printer/network-spooler';
import { EscPosBuilder, type ZBonReport } from '@/lib/printer/escpos-builder';
import { computePeriodTotals, getOrCreateOpenPeriod, signFiscalBlock } from '@/lib/register-period';
import haService from '@/lib/ha/ha-service';
import { requireApiAuth } from '@/lib/api-guard';

/**
 * Spec 6.7: Z-Bon (offizieller Kassenabschluss).
 * Schließt die Kassenperiode ab, speichert den signierten Fiskalblock,
 * druckt den Z-Bon mit MwSt-Splits und setzt die Zähler zurück.
 */

/** Vorschau des Z-Bons ohne Abschluss */
export async function GET(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const period = await getOrCreateOpenPeriod();
    const totals = await computePeriodTotals({ periodId: period.id, includeUnassigned: true });
    return NextResponse.json({
      periodId: period.id,
      periodNumber: period.periodNumber,
      openedAt: period.openedAt,
      status: period.status,
      ...totals,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Führt den Tagesabschluss durch */
export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      pin?: string;
      closedBy?: string;
      cashCounted?: number;
      printerId?: string;
      print?: boolean;
    };

    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      return NextResponse.json({ error: 'Keine Konfiguration gefunden' }, { status: 500 });
    }

    if ((body.pin || '').trim() !== config.adminPin) {
      return NextResponse.json(
        { error: 'Der Tagesabschluss ist nur mit dem Admin-PIN möglich.' },
        { status: 403 }
      );
    }

    if (config.trainingMode) {
      return NextResponse.json(
        { error: 'Im Übungsmodus kann kein Z-Bon erstellt werden. Bitte zuerst den Echtbetrieb aktivieren.' },
        { status: 400 }
      );
    }

    const period = await getOrCreateOpenPeriod();

    // Offene Tische blockieren den Abschluss – sonst gehen Buchungen verloren
    const openTables = await prisma.diningTable.count({ where: { status: 'OCCUPIED' } });
    const openItems = await prisma.orderItem.count({
      where: {
        isCancelled: false,
        order: { status: { in: ['OPEN', 'IN_PREPARATION', 'READY'] }, isTraining: false },
      },
    });
    if (openItems > 0) {
      return NextResponse.json(
        {
          error: `Es sind noch ${openItems} unbezahlte Positionen auf ${openTables} Tisch(en) offen. Bitte zuerst kassieren oder stornieren.`,
          openItems,
          openTables,
        },
        { status: 409 }
      );
    }

    const totals = await computePeriodTotals({ periodId: period.id, includeUnassigned: true });

    const previous = await prisma.registerPeriod.findFirst({
      where: { status: 'CLOSED' },
      orderBy: { periodNumber: 'desc' },
    });

    const closedAt = new Date();
    const cashCounted =
      body.cashCounted !== undefined && body.cashCounted !== null
        ? Math.round(Number(body.cashCounted) * 100) / 100
        : null;
    const cashDifference =
      cashCounted !== null ? Math.round((cashCounted - totals.cashExpected) * 100) / 100 : null;

    const fiscalSignature = signFiscalBlock({
      periodNumber: period.periodNumber,
      closedAt: closedAt.toISOString(),
      totalGross: totals.totalGross,
      totalNet: totals.totalNet,
      transactionCount: totals.transactionCount,
      previousSignature: previous?.fiscalSignature ?? null,
    });

    const reportSnapshot = {
      periodNumber: period.periodNumber,
      openedAt: period.openedAt,
      closedAt,
      ...totals,
      cashCounted,
      cashDifference,
      fiscalSignature,
    };

    // Periode abschließen, Zahlungen zuordnen und neue Periode eröffnen
    const closedPeriod = await prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { periodId: null, isTraining: false },
        data: { periodId: period.id },
      });
      await tx.cashMovement.updateMany({
        where: { periodId: null, isTraining: false },
        data: { periodId: period.id },
      });

      const closed = await tx.registerPeriod.update({
        where: { id: period.id },
        data: {
          status: 'CLOSED',
          closedAt,
          closedBy: body.closedBy || 'Admin',
          totalGross: totals.totalGross,
          totalNet: totals.totalNet,
          taxAmount19: totals.taxAmount19,
          taxAmount7: totals.taxAmount7,
          taxBase0: totals.taxBase0,
          totalCash: totals.totalCash,
          totalCard: totals.totalCard,
          totalTips: totals.totalTips,
          totalDepositOut: totals.totalDepositReturned,
          cashIn: totals.cashIn,
          cashOut: totals.cashOut,
          cashExpected: totals.cashExpected,
          cashCounted,
          cashDifference,
          transactionCount: totals.transactionCount,
          fiscalSignature,
          reportJson: JSON.stringify(reportSnapshot),
        },
      });

      // Spec 6.7: Zähler zurücksetzen und neue Periode eröffnen
      await tx.eventConfig.update({
        where: { id: 'default' },
        data: { orderSequence: 1, tokenSequence: 100 },
      });
      await tx.registerPeriod.create({
        data: { periodNumber: period.periodNumber + 1 },
      });

      return closed;
    });

    // Z-Bon drucken
    let printed = false;
    if (body.print !== false) {
      const printer = body.printerId
        ? await prisma.printer.findUnique({ where: { id: body.printerId } })
        : await prisma.printer.findFirst({ where: { isActive: true } });

      if (printer) {
        const zReport: ZBonReport = {
          periodNumber: period.periodNumber,
          openedAt: period.openedAt,
          closedAt,
          totalGross: totals.totalGross,
          totalNet: totals.totalNet,
          totalTax19: totals.taxAmount19,
          totalTax7: totals.taxAmount7,
          taxBase0: totals.taxBase0,
          taxSplits: totals.taxSplits,
          totalCash: totals.totalCash,
          totalCard: totals.totalCard,
          paymentSplit: {
            cardSumUp: totals.cardSumUp,
            cardVrPay: totals.cardVrPay,
            cardSparkasse: totals.cardSparkasse,
            cardTerminal: totals.cardTerminal,
          },
          totalStaff: totals.totalStaff,
          totalSurcharges: totals.totalSurcharges,
          totalDepositReturned: totals.totalDepositReturned,
          totalTips: totals.totalTips,
          transactionCount: totals.transactionCount,
          cashIn: totals.cashIn,
          cashOut: totals.cashOut,
          cashExpected: totals.cashExpected,
          cashCounted,
          cashDifference,
          fiscalSignature,
          waiters: totals.waiters,
        };

        const { rawBuffer, textRepresentation } = EscPosBuilder.buildZBonTicket(
          zReport,
          printer.paperWidth
        );
        const result = await networkSpooler.sendRawBuffer(printer, rawBuffer, textRepresentation);
        printed = result.success;
      }
    }

    await haService.logMutation('REGISTER_PERIOD', closedPeriod.id, 'UPDATE', closedPeriod);

    if (global.io) {
      global.io.emit('register:closed', {
        periodNumber: closedPeriod.periodNumber,
        totalGross: closedPeriod.totalGross,
      });
    }

    return NextResponse.json({
      success: true,
      printed,
      period: closedPeriod,
      report: reportSnapshot,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('Z-Bon fehlgeschlagen:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
