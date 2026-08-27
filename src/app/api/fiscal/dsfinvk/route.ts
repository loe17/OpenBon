import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  generateDsfinvkTables,
  DsfinvkBonkopf,
  DsfinvkBonpos,
  DsfinvkBonposPreise,
} from '@/lib/dsfinvk-exporter';
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

    const payments = await prisma.payment.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // M6.5 Ehrliche TSE-Kennzeichnung: Ohne echte, konfigurierte und
    // implementierte TSE duerfen die Export-Spalten KEINE Suggestiv-Werte
    // fuehren (frueher: Zaehler=1, "Signatur" = Kartenterminal-AUTH-Code).
    const hasRealTse =
      Boolean(config?.tseSerialNumber?.trim()) &&
      config?.tseProvider !== undefined &&
      String(config.tseProvider).toUpperCase() !== 'NONE';

    const tseSerial = hasRealTse ? config!.tseSerialNumber!.trim() : null;

    const bonkoepfe: DsfinvkBonkopf[] = [];
    const bonpos: DsfinvkBonpos[] = [];
    const bonposPreise: DsfinvkBonposPreise[] = [];

    for (const p of payments) {
      bonkoepfe.push({
        bonId: p.id,
        bonNr: p.invoiceNumber,
        bonTyp: p.isTraining ? 'TRAINING' : p.isCancelled ? 'STORNO' : 'BELEG',
        bonStatus: p.isCancelled ? 'ABGEBROCHEN' : 'ABGESCHLOSSEN',
        zeitBeginn: p.createdAt.toISOString(),
        zeitEnde: p.createdAt.toISOString(),
        kassenId: config?.id || 'POS-01',
        bedienerName: p.waiterName,
        // Ohne echte TSE bleiben die Felder LEER -> DSFinV-K-Prueftools
        // kennzeichnen die Kasse korrekt als NO_TSE statt gueltige Signatur
        // vorzuspiegeln.
        tseSeriennr: tseSerial,
        tseSignaturzaehler: hasRealTse ? 1 : 0,
        tseSignatur: hasRealTse ? p.cardAuthCode || null : null,
      });

      let posZeile = 1;
      for (const item of p.items) {
        bonpos.push({
          bonId: p.id,
          posZeile: posZeile++,
          artikeltext: item.productName,
          menge: item.quantity,
          einzelpreisGross: item.unitPrice,
          gesamtGross: item.unitPrice * item.quantity,
          ustSatz: item.taxRate,
        });
      }

      if (p.taxAmount19 > 0 || p.taxBase19 > 0) {
        bonposPreise.push({
          bonId: p.id,
          ustSatz: 19.0,
          netto: p.taxBase19,
          ust: p.taxAmount19,
          brutto: p.taxBase19 + p.taxAmount19,
        });
      }

      if (p.taxAmount7 > 0 || p.taxBase7 > 0) {
        bonposPreise.push({
          bonId: p.id,
          ustSatz: 7.0,
          netto: p.taxBase7,
          ust: p.taxAmount7,
          brutto: p.taxBase7 + p.taxAmount7,
        });
      }
    }

    const result = generateDsfinvkTables(bonkoepfe, bonpos, bonposPreise);

    return NextResponse.json({
      success: true,
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
      checksumSha256: result.checksumSha256,
      // M6.5: Transparenz fuer den Operator - der Export wurde ohne echte
      // TSE-Kennzeichnung erzeugt.
      tseState: hasRealTse ? 'CONFIGURED' : 'NO_TSE',
      tseNotice:
        hasRealTse
          ? null
          : 'Keine echte TSE konfiguriert/angeschlossen. TSE-Felder im Export sind absichtlich leer (DSFinV-K NO_TSE).',
      tables: {
        bonkopfCsv: result.bonkopfCsv,
        bonposCsv: result.bonposCsv,
        bonposPreiseCsv: result.bonposPreiseCsv,
        tseTransaktionenCsv: result.tseTransaktionenCsv,
      },
    });
  } catch (error) {
    console.error('GET /api/fiscal/dsfinvk error:', error);
    return NextResponse.json({ error: 'Fehler beim Generieren des DSFinV-K Exports' }, { status: 500 });
  }
}
