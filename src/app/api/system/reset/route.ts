import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const {
      resetOrders,
      resetPayments,
      resetTables,
      resetProducts,
      resetWaiters,
      resetPrinters,
      resetEventMetadata,
      resetConfig,
    } = body;

    const summary: string[] = [];

    // 1. Bestellungen & Bons
    if (resetOrders || resetConfig) {
      await prisma.orderItem.deleteMany({});
      await prisma.order.deleteMany({});
      await prisma.printJob.deleteMany({});
      await prisma.tokenTransaction.deleteMany({});
      await prisma.stockConsumption.deleteMany({});
      await prisma.chatMessage.deleteMany({});
      global.virtualPrinterHistory = [];
      summary.push('Bestellungen, Bons & KDS-Aufträge gelöscht');
    }

    // 2. Umsätze, Zahlungen & Kassenbuch
    if (resetPayments || resetConfig) {
      await prisma.paymentItem.deleteMany({});
      await prisma.payment.deleteMany({});
      await prisma.cashMovement.deleteMany({});
      await prisma.registerPeriod.deleteMany({});
      await prisma.paymentSession.deleteMany({});
      await prisma.fiscalExport.deleteMany({});
      summary.push('Umsätze, Zahlungen & Kassenperioden gelöscht');
    }

    // 3. Tische & Raumplan
    if (resetTables || resetConfig) {
      await prisma.diningTable.deleteMany({});
      await prisma.eventConfig.upsert({
        where: { id: 'default' },
        update: { aisles: '[]' },
        create: { id: 'default', name: 'Veranstaltung 2026', aisles: '[]' },
      }).catch(() => {});
      summary.push('Tische & Raumplan gelöscht');
    }

    // 4. Artikel & Warengruppen
    if (resetProducts || resetConfig) {
      await prisma.productOption.deleteMany({});
      await prisma.productVariant.deleteMany({});
      await prisma.product.deleteMany({});
      await prisma.productCategory.deleteMany({});
      await prisma.customizationWordGroup.deleteMany({});
      await prisma.stockUnit.deleteMany({});
      await prisma.stockItem.deleteMany({});
      await prisma.tapLine.deleteMany({});
      summary.push('Artikel, Warengruppen & Bestände gelöscht');
    }

    // 5. Bedienungen & Trinkgeld
    if (resetWaiters || resetConfig) {
      await prisma.waiterProfile.deleteMany({});
      await prisma.tipProfile.deleteMany({});
      await prisma.staff.deleteMany({});
      summary.push('Bedienungsprofile gelöscht');
    }

    // 6. Drucker & Gruppen
    if (resetPrinters || resetConfig) {
      await prisma.printGroup.deleteMany({});
      await prisma.printer.deleteMany({});
      summary.push('Drucker & Druckgruppen gelöscht');
    }

    // 7. Veranstaltungs-Stammdaten & Belegtexte
    if (resetEventMetadata && !resetConfig) {
      await prisma.eventConfig.upsert({
        where: { id: 'default' },
        update: {
          name: 'Veranstaltung 2026',
          receiptHeader: '',
          receiptSubHeader: '',
          receiptFooterText: '',
          addressStreet: '',
          addressCity: '',
          taxNumber: '',
          vatId: '',
          receiptTableFontSize: 3,
          receiptItemFontSize: 2,
          receiptOptionsFontSize: 1,
          receiptMetaFontSize: 1,
          receiptFoodTableFontSize: 4,
          receiptFoodItemFontSize: 3,
          receiptDrinkTableFontSize: 4,
          receiptDrinkItemFontSize: 3,
        },
        create: {
          id: 'default',
          name: 'Veranstaltung 2026',
          receiptHeader: '',
          receiptSubHeader: '',
          receiptFooterText: '',
        },
      });
      summary.push('Veranstaltungsname, Kopf-/Fußzeilen & Belegtexte zurückgesetzt');
    }

    // 8. Vollständiger Konfigurations- & Werksreset
    if (resetConfig) {
      await prisma.eventConfig.upsert({
        where: { id: 'default' },
        update: {
          name: 'Veranstaltung 2026',
          currency: 'EUR',
          taxRateNormal: 19.0,
          taxRateReduced: 7.0,
          trainingMode: false,
          adminPin: '0000',
          posPin: '1111',
          kitchenPin: '2222',
          waiterPin: '3333',
          receiptHeader: '',
          receiptSubHeader: '',
          receiptFooterText: '',
          addressStreet: '',
          addressCity: '',
          taxNumber: '',
          vatId: '',
          receiptTableFontSize: 3,
          receiptItemFontSize: 2,
          receiptOptionsFontSize: 1,
          receiptMetaFontSize: 1,
          receiptFoodTableFontSize: 4,
          receiptFoodItemFontSize: 3,
          receiptDrinkTableFontSize: 4,
          receiptDrinkItemFontSize: 3,
          tokenSequence: 1,
          invoiceSequence: 1,
          orderSequence: 1,
          aisles: '[]',
        },
        create: {
          id: 'default',
          name: 'Veranstaltung 2026',
          currency: 'EUR',
          taxRateNormal: 19.0,
          taxRateReduced: 7.0,
          trainingMode: false,
          adminPin: '0000',
          posPin: '1111',
          kitchenPin: '2222',
          waiterPin: '3333',
          receiptHeader: '',
          receiptSubHeader: '',
          receiptFooterText: '',
          aisles: '[]',
        },
      });
      summary.push('System-Konfiguration & PINs auf Werkszustand zurückgesetzt');
    }

    if (global.io) {
      global.io.emit('system:reset_performed', { summary });
    }

    await logSystemActionSafe(() => ({
      action: 'SYSTEM_RESET',
      category: 'ADMIN',
      actor: auth.session.waiterName || auth.session.role,
      details: `Selektiver Reset durchgeführt: ${summary.join(', ')}`,
    }));

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error('System reset error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
