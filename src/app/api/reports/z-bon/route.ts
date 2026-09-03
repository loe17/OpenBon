import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import networkSpooler from '@/lib/printer/network-spooler';
import { EscPosBuilder, type ZBonReport } from '@/lib/printer/escpos-builder';
import { computePeriodTotals, getOrCreateOpenPeriod, signFiscalBlock } from '@/lib/register-period';
import haService from '@/lib/ha/ha-service';
import { requireApiAuth } from '@/lib/api-guard';
import { verifyPinHash } from '@/lib/auth-pin';

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

    // M3.2: verifyPinHash statt Direktvergleich - funktioniert mit gehashten
    // und legacy Klartext-Eintraegen identisch.
    if (!verifyPinHash((body.pin || '').trim(), config.adminPin)) {
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
    const cashCountedCents =
      body.cashCounted !== undefined && body.cashCounted !== null
        ? Math.round(Number(body.cashCounted) * 100)
        : null;
    const cashExpectedCents = totals.cashExpectedCents ?? 0;
    const cashDifferenceCents =
      cashCountedCents !== null ? cashCountedCents - cashExpectedCents : null;

    const fiscalSignature = signFiscalBlock({
      periodNumber: period.periodNumber,
      closedAt: closedAt.toISOString(),
      totalGrossCents: totals.totalGrossCents ?? 0,
      totalNetCents: totals.totalNetCents ?? 0,
      transactionCount: totals.transactionCount,
      previousSignature: previous?.fiscalSignature ?? null,
    });

    const reportSnapshot = {
      periodNumber: period.periodNumber,
      openedAt: period.openedAt,
      closedAt,
      ...totals,
      cashCountedCents,
      cashDifferenceCents,
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
          totalGrossCents: totals.totalGrossCents ?? 0,
          totalNetCents: totals.totalNetCents ?? 0,
          taxAmount19Cents: totals.taxAmount19Cents ?? 0,
          taxAmount7Cents: totals.taxAmount7Cents ?? 0,
          taxBase0Cents: totals.taxBase0Cents ?? 0,
          totalCashCents: totals.totalCashCents ?? 0,
          totalCardCents: totals.totalCardCents ?? 0,
          totalTipsCents: totals.totalTipsCents ?? 0,
          totalDepositOutCents: totals.totalDepositReturnedCents ?? 0,
          cashInCents: totals.cashInCents ?? 0,
          cashOutCents: totals.cashOutCents ?? 0,
          cashExpectedCents: totals.cashExpectedCents ?? 0,
          cashCountedCents,
          cashDifferenceCents,
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
          totalGrossCents: totals.totalGrossCents ?? 0,
          totalNetCents: totals.totalNetCents ?? 0,
          totalTax19Cents: totals.taxAmount19Cents ?? 0,
          totalTax7Cents: totals.taxAmount7Cents ?? 0,
          taxBase0Cents: totals.taxBase0Cents ?? 0,
          taxSplits: totals.taxSplits,
          totalCashCents: totals.totalCashCents ?? 0,
          totalCardCents: totals.totalCardCents ?? 0,
          paymentSplit: {
            cardSumUpCents: totals.cardSumUpCents ?? 0,
            cardVrPayCents: totals.cardVrPayCents ?? 0,
            cardSparkasseCents: totals.cardSparkasseCents ?? 0,
            cardTerminalCents: totals.cardTerminalCents ?? 0,
          },
          totalStaffCents: totals.totalStaffCents ?? 0,
          totalSurchargesCents: totals.totalSurchargesCents ?? 0,
          totalDepositReturnedCents: totals.totalDepositReturnedCents ?? 0,
          totalTipsCents: totals.totalTipsCents ?? 0,
          transactionCount: totals.transactionCount,
          cashInCents: totals.cashInCents ?? 0,
          cashOutCents: totals.cashOutCents ?? 0,
          cashExpectedCents: totals.cashExpectedCents ?? 0,
          cashCountedCents,
          cashDifferenceCents,
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
        totalGrossCents: closedPeriod.totalGrossCents,
      });
    }

    await logSystemActionSafe(() => ({
      action: 'Z_BON_CREATED',
      category: 'CASHBOOK',
      actor: auth.session.waiterName || auth.session.role,
      details: `Kassenabschluss Z-${closedPeriod.periodNumber} über ${((closedPeriod.totalGrossCents ?? 0) / 100).toFixed(2)} € erstellt${printed ? ' und gedruckt' : ' (nicht gedruckt)'}.`,
      metadata: {
        periodId: closedPeriod.id,
        periodNumber: closedPeriod.periodNumber,
        totalGrossCents: closedPeriod.totalGrossCents,
        printed,
      },
    }));

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
