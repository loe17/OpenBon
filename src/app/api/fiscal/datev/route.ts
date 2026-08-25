import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateDatevCsv, DatevBookingLine } from '@/lib/datev-exporter';
import { requireAdmin } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const startDate = startDateParam ? new Date(startDateParam) : new Date(new Date().setHours(0, 0, 0, 0));
    const endDate = endDateParam ? new Date(endDateParam) : new Date(new Date().setHours(23, 59, 59, 999));

    const config = await prisma.eventConfig.findUnique({
      where: { id: 'default' },
    });

    // Hole alle Z-Bons / Kassenperioden und Einzelzahlungen im Zeitraum
    const periods = await prisma.registerPeriod.findMany({
      where: {
        openedAt: { gte: startDate, lte: endDate },
        status: 'CLOSED',
      },
      include: {
        payments: true,
        cashMovements: true,
      },
      orderBy: { periodNumber: 'asc' },
    });

    const bookingLines: DatevBookingLine[] = [];

    for (const p of periods) {
      // 1. UmsatzerlÃ¶se 19% USt
      if (p.taxAmount19 > 0 || p.totalGross > 0) {
        const gross19 = p.taxAmount19 > 0 ? (p.totalGross - (p.taxAmount7 ? p.taxAmount7 / 0.07 * 1.07 : 0)) : p.totalGross;
        if (gross19 > 0) {
          bookingLines.push({
            amountGross: gross19,
            isDebit: true,
            account: config?.datevCashAccount || '1000',
            contraAccount: '8400', // ErlÃ¶se 19% USt
            bookingDate: p.closedAt || p.openedAt,
            documentNumber: `Z-${p.periodNumber.toString().padStart(4, '0')}`,
            text: `Tagesumsatz 19% Z-Bon #${p.periodNumber}`,
          });
        }
      }

      // 2. UmsatzerlÃ¶se 7% USt
      if (p.taxAmount7 > 0) {
        const gross7 = (p.taxAmount7 / 0.07) * 1.07;
        bookingLines.push({
          amountGross: gross7,
          isDebit: true,
          account: config?.datevCashAccount || '1000',
          contraAccount: '8300', // ErlÃ¶se 7% USt
          bookingDate: p.closedAt || p.openedAt,
          documentNumber: `Z-${p.periodNumber.toString().padStart(4, '0')}`,
          text: `Tagesumsatz 7% Z-Bon #${p.periodNumber}`,
        });
      }

      // 3. Unbare Kartenzahlungen (Umbuchung Kasse an Geldtransit)
      if (p.totalCard > 0) {
        bookingLines.push({
          amountGross: p.totalCard,
          isDebit: true,
          account: '1360', // Geldtransit / Kartenzahlungen
          contraAccount: config?.datevCashAccount || '1000',
          bookingDate: p.closedAt || p.openedAt,
          documentNumber: `Z-${p.periodNumber.toString().padStart(4, '0')}`,
          text: `Karteneinnahmen Z-Bon #${p.periodNumber}`,
        });
      }

      // 4. Kassenbewegungen (Wechselgeld-Einlagen und Tresorentnahmen)
      for (const cm of p.cashMovements) {
        if (cm.type === 'CASH_IN') {
          bookingLines.push({
            amountGross: cm.amount,
            isDebit: true,
            account: config?.datevCashAccount || '1000',
            contraAccount: '1360', // Einlage aus Geldtransit / Tresor
            bookingDate: cm.createdAt,
            documentNumber: `EIN-${cm.id.substring(0, 6)}`,
            text: `Einlage: ${cm.reason}`,
          });
        } else if (cm.type === 'CASH_OUT') {
          bookingLines.push({
            amountGross: cm.amount,
            isDebit: false,
            account: config?.datevCashAccount || '1000',
            contraAccount: '1360', // Entnahme an Tresor
            bookingDate: cm.createdAt,
            documentNumber: `ENT-${cm.id.substring(0, 6)}`,
            text: `Entnahme: ${cm.reason}`,
          });
        }
      }
    }

    const csvContent = generateDatevCsv(bookingLines, {
      consultantNumber: config?.datevConsultantNumber,
      clientNumber: config?.datevClientNumber,
      cashAccount: config?.datevCashAccount,
    });

    const dateStr = startDate.toISOString().split('T')[0];
    const filename = `DATEV_Kassenbuch_${dateStr}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('GET /api/fiscal/datev error:', error);
    return NextResponse.json({ error: 'Fehler beim Generieren des DATEV-Exports' }, { status: 500 });
  }
}
