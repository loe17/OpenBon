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
      { rate: 19, base: payment.taxBase19, tax: payment.taxAmount19, gross: payment.taxBase19 + payment.taxAmount19 },
      { rate: 7, base: payment.taxBase7, tax: payment.taxAmount7, gross: payment.taxBase7 + payment.taxAmount7 },
      { rate: 0, base: payment.taxBase0, tax: 0, gross: payment.taxBase0 },
    ].filter((s) => s.gross > 0);

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
        unitPrice: i.unitPrice,
        deposit: i.deposit,
        taxRate: i.taxRate,
      })),
      totalGross: payment.totalGross,
      totalNet: payment.totalNet,
      totalTax: payment.totalTax,
      totalDeposit: payment.totalDeposit,
      returnDeposit: payment.returnDeposit,
      discountAmount: payment.discountAmount,
      surchargeAmount: payment.surchargeAmount,
      surchargeReason: payment.surchargeReason,
      tipAmount: payment.tipAmount,
      givenAmount: payment.givenAmount,
      changeAmount: payment.changeAmount,
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
