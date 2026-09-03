import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateDatevCsv, generateDatevZipManifest, resolveDatevAccounts, DatevBookingLine } from '@/lib/datev-exporter';
import { requireAdmin } from '@/lib/admin-guard';
import { requireApiAuth } from '@/lib/api-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

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
      // 1. Umsatzerlöse 19% USt (Cent, harter Cut)
      if (p.taxAmount19Cents > 0 || p.totalGrossCents > 0) {
        const gross19Cents = p.taxAmount19Cents > 0 ? Math.round(p.totalGrossCents - (p.taxAmount7Cents ? (p.taxAmount7Cents / 7) * 107 : 0)) : p.totalGrossCents;
        if (gross19Cents > 0) {
          bookingLines.push({
            amountCents: gross19Cents,
            isDebit: true,
            account: config?.datevCashAccount || '1000',
            contraAccount: '8400', // Erlöse 19% USt
            bookingDate: p.closedAt || p.openedAt,
            documentNumber: `Z-${p.periodNumber.toString().padStart(4, '0')}`,
            text: `Tagesumsatz 19% Z-Bon #${p.periodNumber}`,
          });
        }
      }

      // 2. Umsatzerlöse 7% USt
      if (p.taxAmount7Cents > 0) {
        const gross7Cents = Math.round((p.taxAmount7Cents / 7) * 107);
        bookingLines.push({
          amountCents: gross7Cents,
          isDebit: true,
          account: config?.datevCashAccount || '1000',
          contraAccount: '8300', // Erlöse 7% USt
          bookingDate: p.closedAt || p.openedAt,
          documentNumber: `Z-${p.periodNumber.toString().padStart(4, '0')}`,
          text: `Tagesumsatz 7% Z-Bon #${p.periodNumber}`,
        });
      }

      // 3. Unbare Kartenzahlungen (Umbuchung Kasse an Geldtransit)
      if (p.totalCardCents > 0) {
        bookingLines.push({
          amountCents: p.totalCardCents,
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
            amountCents: cm.amountCents,
            isDebit: true,
            account: config?.datevCashAccount || '1000',
            contraAccount: '1360', // Einlage aus Geldtransit / Tresor
            bookingDate: cm.createdAt,
            documentNumber: `EIN-${cm.id.substring(0, 6)}`,
            text: `Einlage: ${cm.reason}`,
          });
        } else if (cm.type === 'CASH_OUT') {
          bookingLines.push({
            amountCents: cm.amountCents,
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

    const accounts = resolveDatevAccounts({
      consultantNumber: config?.datevConsultantNumber,
      clientNumber: config?.datevClientNumber,
      cashAccount: config?.datevCashAccount,
    });
    const csvContent = generateDatevCsv(bookingLines, {
      consultantNumber: config?.datevConsultantNumber,
      clientNumber: config?.datevClientNumber,
      cashAccount: accounts.cashAccount,
    });

    const dateStr = startDate.toISOString().split('T')[0];
    if (new URL(req.url).searchParams.get('format') === 'csv') {
      const filename = `DATEV_Kassenbuch_${dateStr}.csv`;
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    const { buildZBonPdf } = await import('@/lib/zbon-pdf');
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const csvName = `DATEV_Kassenbuch_${dateStr}.csv`;
    zip.file(csvName, csvContent);
    const pdfNames: string[] = [];
    for (const p of periods.slice(0, 50)) {
      const pdf = await buildZBonPdf({
        title: `Z-Bon #${p.periodNumber}`,
        lines: [
          { label: 'Zeitraum', value: `${p.openedAt.toISOString()} - ${(p.closedAt || new Date()).toISOString()}` },
          { label: 'Brutto', value: `${((p.totalGrossCents ?? Math.round(p.totalGrossCents * 100)) / 100).toFixed(2)} EUR` },
          { label: 'Transaktionen', value: String(p.transactionCount) },
        ],
        footer: 'OpenBon DATEV-Beleg (ohne Gewähr, TSE siehe DSFinV-K)',
      });
      const pdfName = `ZBON_${String(p.periodNumber).padStart(4, '0')}.pdf`;
      zip.file(pdfName, pdf);
      pdfNames.push(pdfName);
    }
    zip.file('MANIFEST.txt', generateDatevZipManifest(csvName, pdfNames));
    const buf = Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
    const filename = `DATEV_Kassenbuch_${dateStr}.zip`;
    const checksum = (await import('crypto')).createHash('sha256').update(buf).digest('hex');
    await prisma.fiscalExport
      .create({
        data: {
          exportType: 'DATEV_ZIP',
          periodStart: startDate,
          periodEnd: endDate,
          filename,
          checksumSha256: checksum,
          status: 'COMPLETED',
        },
      })
      .catch(() => null);
    return new Response(buf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('GET /api/fiscal/datev error:', error);
    return NextResponse.json({ error: 'Fehler beim Generieren des DATEV-Exports' }, { status: 500 });
  }
}
