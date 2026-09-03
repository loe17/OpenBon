import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import networkSpooler from '@/lib/printer/network-spooler';
import { getPaymentLabel } from '@/lib/payment/methods';
import type { TicketData } from '@/lib/printer/types';
import { requireApiAuth } from '@/lib/api-guard';

/**
 * Spec 5.4: Beleg-Option "Beleg drucken" nach Abschluss der Zahlung.
 * Druckt den Kassenbeleg zu einem bereits verbuchten Zahlvorgang nach.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json().catch(() => ({}))) as { printerId?: string };

    const [payment, config] = await Promise.all([
      prisma.payment.findUnique({
        where: { id: params.id },
        include: { items: true, table: true },
      }),
      prisma.eventConfig.findUnique({ where: { id: 'default' } }),
    ]);

    if (!payment) {
      return NextResponse.json({ error: 'Beleg nicht gefunden' }, { status: 404 });
    }

    const printer = body.printerId
      ? await prisma.printer.findUnique({ where: { id: body.printerId } })
      : await prisma.printer.findFirst({ where: { isActive: true } });

    if (!printer) {
      return NextResponse.json({ error: 'Kein aktiver Drucker konfiguriert.' }, { status: 400 });
    }

    const taxSplits = [
      { rate: 19, baseCents: payment.taxBase19Cents, taxCents: payment.taxAmount19Cents, grossCents: payment.taxBase19Cents + payment.taxAmount19Cents },
      { rate: 7, baseCents: payment.taxBase7Cents, taxCents: payment.taxAmount7Cents, grossCents: payment.taxBase7Cents + payment.taxAmount7Cents },
      { rate: 0, baseCents: payment.taxBase0Cents, taxCents: 0, grossCents: payment.taxBase0Cents },
    ].filter((s) => s.grossCents > 0);

    const { formatWaiterLabel } = await import('@/lib/waiter-number');
    const ticket: TicketData = {
      title: 'KASSENBELEG / QUITTUNG',
      invoiceNumber: payment.invoiceNumber,
      tableLabel: payment.table?.label || 'Direktverkauf',
      tableFontSize: config?.receiptTableFontSize ?? 3,
      itemFontSize: config?.receiptItemFontSize ?? 2,
      optionsFontSize: config?.receiptOptionsFontSize ?? 1,
      metaFontSize: config?.receiptMetaFontSize ?? 1,
      template: config?.receiptTemplate || 'CLASSIC',
      waiterName: formatWaiterLabel(payment.waiterName),
      createdAt: payment.createdAt,
      items: payment.items.map((i) => ({
        name: i.productName,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
        depositCents: i.depositCents,
        taxRate: i.taxRate,
      })),
      totalGrossCents: payment.totalGrossCents,
      totalNetCents: payment.totalNetCents,
      totalTaxCents: payment.totalTaxCents,
      totalDepositCents: payment.totalDepositCents,
      returnDepositCents: payment.returnDepositCents,
      discountCents: payment.discountAmountCents,
      surchargeAmountCents: payment.surchargeAmountCents,
      surchargeReason: payment.surchargeReason,
      tipCents: payment.tipAmountCents,
      givenCents: payment.givenAmountCents,
      changeCents: payment.changeAmountCents,
      paymentMethod: getPaymentLabel(payment.paymentMethod),
      cardAuthCode: payment.cardAuthCode,
      taxSplits,
      isTraining: payment.isTraining,
      eventName: config?.name,
      subHeader: config?.receiptSubHeader || undefined,
      customHeader: config?.receiptHeader || undefined,
      addressStreet: config?.addressStreet || undefined,
      addressCity: config?.addressCity || undefined,
      taxNumber: config?.taxNumber || undefined,
      vatId: config?.vatId || undefined,
      footerText: config?.receiptFooterText || undefined,
    };

    const result = await networkSpooler.printTicket(printer, ticket);
    await logSystemActionSafe(() => ({
      action: 'RECEIPT_REPRINTED',
      category: 'SALES',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Beleg erneut gedruckt.',
    }));

    return NextResponse.json({ success: result.success, isVirtual: result.isVirtual });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
