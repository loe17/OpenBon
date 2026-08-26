import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import networkSpooler from '@/lib/printer/network-spooler';
import { computeTaxBreakdown } from '@/lib/pricing';
import type { TicketData } from '@/lib/printer/types';
import { requireApiAuth } from '@/lib/api-guard';

/**
 * Spec 6.10: Gast-Vorabrechnung / Bewirtungsbeleg (Zwischenrechnung).
 *
 * Druckt mit einem Klick eine Zwischenrechnung über alle offenen Posten eines
 * Tisches. Die Zwischenrechnung ist ausdrücklich KEIN Kassenbeleg und verändert
 * weder Zahlungen noch Tischstatus.
 *
 * POST { tableId: string, printerId?: string }
 */
export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json()) as { tableId?: string; printerId?: string; waiterName?: string };
    if (!body.tableId) {
      return NextResponse.json({ error: 'tableId ist erforderlich' }, { status: 400 });
    }

    const [config, table, orders] = await Promise.all([
      prisma.eventConfig.findUnique({ where: { id: 'default' } }),
      prisma.diningTable.findUnique({ where: { id: body.tableId } }),
      prisma.order.findMany({
        where: {
          tableId: body.tableId,
          status: { in: ['OPEN', 'IN_PREPARATION', 'READY'] },
        },
        include: { items: { where: { isCancelled: false } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (!table) {
      return NextResponse.json({ error: 'Tisch nicht gefunden' }, { status: 404 });
    }

    const openItems = orders
      .flatMap((o) => o.items)
      .map((i) => ({ ...i, openQty: i.quantity - i.paidQuantity }))
      .filter((i) => i.openQty > 0);

    if (openItems.length === 0) {
      return NextResponse.json({ error: 'Keine offenen Posten auf diesem Tisch.' }, { status: 400 });
    }

    const breakdown = computeTaxBreakdown(
      openItems.map((i) => ({
        unitPrice: i.unitPrice,
        deposit: i.deposit,
        quantity: i.openQty,
        taxRate: i.taxRate,
      }))
    );

    const printer = body.printerId
      ? await prisma.printer.findUnique({ where: { id: body.printerId } })
      : await prisma.printer.findFirst({ where: { isActive: true } });

    if (!printer) {
      return NextResponse.json({ error: 'Kein aktiver Drucker konfiguriert.' }, { status: 400 });
    }

    const ticket: TicketData = {
      title: 'ZWISCHENRECHNUNG',
      isPreliminary: true,
      tableLabel: table.label,
      tableFontSize: config?.receiptTableFontSize ?? 3,
      itemFontSize: config?.receiptItemFontSize ?? 2,
      optionsFontSize: config?.receiptOptionsFontSize ?? 1,
      metaFontSize: config?.receiptMetaFontSize ?? 1,
      template: config?.receiptTemplate || 'CLASSIC',
      waiterName: body.waiterName || table.activeWaiterName || 'Bedienung',
      eventName: config?.name,
      subHeader: config?.receiptSubHeader || undefined,
      customHeader: config?.receiptHeader || undefined,
      createdAt: new Date(),
      items: openItems.map((i) => ({
        name: i.productName,
        quantity: i.openQty,
        unitPrice: i.unitPrice,
        deposit: i.deposit,
        taxRate: i.taxRate,
        variantName: i.variantName,
        courseNumber: i.courseNumber,
      })),
      totalGross: breakdown.grossTotal,
      totalNet: breakdown.netTotal,
      totalTax: breakdown.taxTotal,
      totalDeposit: breakdown.depositTotal,
      taxSplits: breakdown.splits,
      isTraining: config?.trainingMode ?? false,
      footerText: 'Dies ist eine Zwischenrechnung und ersetzt keinen Kassenbeleg.',
    };

    const result = await networkSpooler.printTicket(printer, ticket);

    await logSystemActionSafe(() => ({
      action: 'PREBILL_PRINTED',
      category: 'SALES',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Rechnungsvorschau gedruckt.',
    }));

    return NextResponse.json({
      success: result.success,
      isVirtual: result.isVirtual,
      totalGross: breakdown.grossTotal,
      itemCount: openItems.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
