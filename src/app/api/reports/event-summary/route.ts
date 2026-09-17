import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';
import {
  generateEventSummaryPdf,
  EventSummaryData,
  DailySummaryRow,
  WaiterSummaryRow,
  ProductSummaryRow,
} from '@/lib/event-summary-pdf';

function classifyItem(item: {
  productName: string;
  product?: {
    subCategory?: string | null;
    tokenType?: string | null;
    category?: { name: string } | null;
  } | null;
}): 'GETRÄNK' | 'SPEISE' {
  const p = item.product;
  if (p) {
    const tt = (p.tokenType || '').toUpperCase();
    const sc = (p.subCategory || '').toUpperCase();
    const catName = (p.category?.name || '').toLowerCase();
    if (
      tt === 'DRINK' ||
      ['BIER', 'WEIN', 'ALKOHOLFREI', 'HEISS', 'BAR'].includes(sc) ||
      catName.includes('getränk') ||
      catName.includes('drink') ||
      catName.includes('bar') ||
      catName.includes('bier') ||
      catName.includes('wein')
    ) {
      return 'GETRÄNK';
    }
    if (
      tt === 'FOOD' ||
      sc === 'SPEISE' ||
      catName.includes('speise') ||
      catName.includes('essen') ||
      catName.includes('küche') ||
      catName.includes('food')
    ) {
      return 'SPEISE';
    }
  }
  const lower = item.productName.toLowerCase();
  if (
    lower.includes('bier') ||
    lower.includes('cola') ||
    lower.includes('wasser') ||
    lower.includes('schorle') ||
    lower.includes('wein') ||
    lower.includes('radler') ||
    lower.includes('spezi') ||
    lower.includes('kaffee') ||
    lower.includes('tee') ||
    lower.includes('schnaps') ||
    lower.includes('shot') ||
    lower.includes('limo') ||
    lower.includes('saft') ||
    lower.includes('spritz') ||
    lower.includes('apfel')
  ) {
    return 'GETRÄNK';
  }
  return 'SPEISE';
}

function formatDateDE(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') || 'json'; // 'json', 'pdf', 'csv'

  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const [config, payments, orders, waiterProfiles, dbProducts] = await Promise.all([
      prisma.eventConfig.findFirst(),
      prisma.payment.findMany({
        where: { isCancelled: false, isTraining: false },
        include: { table: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.order.findMany({
        where: { status: { not: 'CANCELLED' }, isTraining: false },
        include: {
          items: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.waiterProfile.findMany({ where: { isActive: true } }),
      prisma.product.findMany({
        include: { category: true },
      }),
    ]);

    const productCatalogMap = new Map<string, any>(
      dbProducts.map((p) => [p.id, p])
    );

    const eventName = config?.name || 'OpenBon Veranstaltung';
    const eventSubtitle = config?.receiptSubHeader || undefined;

    // 1. Grand Totals
    let totalGrossCents = 0;
    let totalNetCents = 0;
    let totalTax19Cents = 0;
    let totalTax7Cents = 0;
    let totalCashCents = 0;
    let totalCardCents = 0;
    let totalTipsCents = 0;
    let totalDepositChargedCents = 0;
    let totalDepositReturnedCents = 0;

    // Daily breakdown maps
    const dailyDataMap = new Map<
      string,
      {
        foodCount: number;
        drinkCount: number;
        grossCents: number;
        cashCents: number;
        cardCents: number;
        receiptCount: number;
      }
    >();

    const getDailyEntry = (dateKey: string) => {
      if (!dailyDataMap.has(dateKey)) {
        dailyDataMap.set(dateKey, {
          foodCount: 0,
          drinkCount: 0,
          grossCents: 0,
          cashCents: 0,
          cardCents: 0,
          receiptCount: 0,
        });
      }
      return dailyDataMap.get(dateKey)!;
    };

    // Waiter breakdown map
    const waiterMap = new Map<
      string,
      {
        waiterName: string;
        totalGrossCents: number;
        cashCents: number;
        cardCents: number;
        depositReturnedCents: number;
        tipsCents: number;
        transactionCount: number;
      }
    >();

    const getWaiterEntry = (name: string) => {
      const wName = name || 'Kasse / Admin';
      if (!waiterMap.has(wName)) {
        waiterMap.set(wName, {
          waiterName: wName,
          totalGrossCents: 0,
          cashCents: 0,
          cardCents: 0,
          depositReturnedCents: 0,
          tipsCents: 0,
          transactionCount: 0,
        });
      }
      return waiterMap.get(wName)!;
    };

    // Initialize all active waiters
    for (const wp of waiterProfiles) {
      getWaiterEntry(wp.name);
    }

    // Process Payments
    for (const p of payments) {
      totalGrossCents += p.totalGrossCents;
      totalNetCents += p.totalNetCents;
      totalTax19Cents += p.taxAmount19Cents || 0;
      totalTax7Cents += p.taxAmount7Cents || 0;
      totalDepositChargedCents += p.totalDepositCents;
      totalDepositReturnedCents += p.returnDepositCents;
      totalTipsCents += p.tipAmountCents;

      const method = p.paymentMethod || 'CASH';
      const isCash = method === 'CASH';
      const isCard = method.startsWith('CARD') || method === 'CARD_SUMUP' || method === 'CARD_VRPAY';

      if (isCash) totalCashCents += p.totalGrossCents;
      if (isCard) totalCardCents += p.totalGrossCents;

      // Daily stats
      const dateKey = p.createdAt.toISOString().slice(0, 10);
      const day = getDailyEntry(dateKey);
      day.grossCents += p.totalGrossCents;
      day.receiptCount++;
      if (isCash) day.cashCents += p.totalGrossCents;
      if (isCard) day.cardCents += p.totalGrossCents;

      // Waiter stats
      const w = getWaiterEntry(p.waiterName);
      w.totalGrossCents += p.totalGrossCents;
      w.transactionCount++;
      w.tipsCents += p.tipAmountCents;
      w.depositReturnedCents += p.returnDepositCents;
      if (isCash) w.cashCents += p.totalGrossCents;
      if (isCard) w.cardCents += p.totalGrossCents;
    }

    // Process Orders & Items
    let totalFoodCount = 0;
    let totalDrinkCount = 0;

    const productMap = new Map<
      string,
      {
        name: string;
        type: 'SPEISE' | 'GETRÄNK';
        unitPriceCents: number;
        totalQuantity: number;
        totalRevenueCents: number;
      }
    >();

    for (const ord of orders) {
      const dateKey = ord.createdAt.toISOString().slice(0, 10);
      const day = getDailyEntry(dateKey);

      for (const item of ord.items) {
        if (item.isCancelled) continue;
        const dbProd = item.productId ? productCatalogMap.get(item.productId) : null;
        const itemType = classifyItem({
          productName: item.productName || 'Artikel',
          product: dbProd,
        });
        if (itemType === 'SPEISE') {
          totalFoodCount += item.quantity;
          day.foodCount += item.quantity;
        } else {
          totalDrinkCount += item.quantity;
          day.drinkCount += item.quantity;
        }

        const displayName = item.variantName
          ? `${item.productName} (${item.variantName})`
          : item.productName;

        if (!productMap.has(displayName)) {
          productMap.set(displayName, {
            name: displayName,
            type: itemType,
            unitPriceCents: item.unitPriceCents,
            totalQuantity: 0,
            totalRevenueCents: 0,
          });
        }
        const pr = productMap.get(displayName)!;
        pr.totalQuantity += item.quantity;
        pr.totalRevenueCents += (item.unitPriceCents + (item.depositCents || 0)) * item.quantity;
      }
    }

    // Format Daily Rows sorted by date
    const dailyRows: DailySummaryRow[] = Array.from(dailyDataMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, val]) => ({
        dateKey,
        formattedDate: formatDateDE(dateKey),
        foodCount: val.foodCount,
        drinkCount: val.drinkCount,
        totalItems: val.foodCount + val.drinkCount,
        grossEuro: val.grossCents / 100,
        cashEuro: val.cashCents / 100,
        cardEuro: val.cardCents / 100,
        receiptCount: val.receiptCount,
      }));

    // Format Waiter Rows sorted by gross descending
    const waiterRows: WaiterSummaryRow[] = Array.from(waiterMap.values())
      .sort((a, b) => b.totalGrossCents - a.totalGrossCents)
      .map((w) => ({
        waiterName: w.waiterName,
        totalGrossEuro: w.totalGrossCents / 100,
        cashEuro: w.cashCents / 100,
        cardEuro: w.cardCents / 100,
        depositReturnedEuro: w.depositReturnedCents / 100,
        tipsEuro: w.tipsCents / 100,
        transactionCount: w.transactionCount,
      }));

    // Format Product Rows sorted by quantity descending
    const productRows: ProductSummaryRow[] = Array.from(productMap.values())
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .map((p) => ({
        name: p.name,
        type: p.type,
        unitPriceEuro: p.unitPriceCents / 100,
        totalQuantity: p.totalQuantity,
        totalRevenueEuro: p.totalRevenueCents / 100,
      }));

    const dateRange =
      dailyRows.length > 0
        ? `${dailyRows[0].formattedDate} bis ${dailyRows[dailyRows.length - 1].formattedDate}`
        : 'Keine Buchungen';

    const summaryData: EventSummaryData = {
      eventName,
      eventSubtitle,
      generatedAt: new Date().toLocaleString('de-DE'),
      dateRange,
      totals: {
        grossEuro: totalGrossCents / 100,
        netEuro: totalNetCents / 100,
        tax19Euro: totalTax19Cents / 100,
        tax7Euro: totalTax7Cents / 100,
        cashEuro: totalCashCents / 100,
        cardEuro: totalCardCents / 100,
        tipsEuro: totalTipsCents / 100,
        depositChargedEuro: totalDepositChargedCents / 100,
        depositReturnedEuro: totalDepositReturnedCents / 100,
        netDepositBalanceEuro: (totalDepositChargedCents - totalDepositReturnedCents) / 100,
        receiptCount: payments.length,
        foodCount: totalFoodCount,
        drinkCount: totalDrinkCount,
        totalItemCount: totalFoodCount + totalDrinkCount,
      },
      dailyRows,
      waiterRows,
      productRows,
    };

    // Format: PDF
    if (format === 'pdf') {
      const pdfBuffer = await generateEventSummaryPdf(summaryData);
      const safeName = eventName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Abschlussbericht_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`;

      return new Response(new Uint8Array(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // Format: CSV (Excel-tauglich: UTF-8 BOM, ';'-Trennzeichen, deutsche Zahlen)
    if (format === 'csv') {
      const safeNum = (v: number) => v.toFixed(2).replace('.', ',');
      const lines: string[] = [];

      // UTF-8 BOM für Excel
      lines.push(`\uFEFFOpenBon Abschlussbericht & Gesamtauswertung der Veranstaltung;`);
      lines.push(`Veranstaltung;${eventName}`);
      if (eventSubtitle) lines.push(`Veranstalter / Untertitel;${eventSubtitle}`);
      lines.push(`Erstellt am;${summaryData.generatedAt}`);
      lines.push(`Zeitraum;${dateRange}`);
      lines.push('');

      // 1. Gesamtkennzahlen
      lines.push('1. GESAMTKENNZAHLEN DER VERANSTALTUNG;');
      lines.push('KENNZAHL;WERT');
      lines.push(`Gesamtumsatz Brutto;${safeNum(summaryData.totals.grossEuro)} EUR`);
      lines.push(`Gesamtumsatz Netto;${safeNum(summaryData.totals.netEuro)} EUR`);
      lines.push(`MwSt 19%;${safeNum(summaryData.totals.tax19Euro)} EUR`);
      lines.push(`MwSt 7%;${safeNum(summaryData.totals.tax7Euro)} EUR`);
      lines.push(`Bargeld-Umsatz (Ist);${safeNum(summaryData.totals.cashEuro)} EUR`);
      lines.push(`Kartenzahlungen (Gesamt);${safeNum(summaryData.totals.cardEuro)} EUR`);
      lines.push(`Verkaufte Speisen;${summaryData.totals.foodCount} Portionen`);
      lines.push(`Verkaufte Getränke;${summaryData.totals.drinkCount} Gläser/Flaschen`);
      lines.push(`Verkaufte Artikel (Gesamt);${summaryData.totals.totalItemCount} Positionen`);
      lines.push(`Erhobener Pfand;${safeNum(summaryData.totals.depositChargedEuro)} EUR`);
      lines.push(`Ausbezahlter Pfand;${safeNum(summaryData.totals.depositReturnedEuro)} EUR`);
      lines.push(`Pfand-Saldo;${safeNum(summaryData.totals.netDepositBalanceEuro)} EUR`);
      lines.push(`Bedienungs-Trinkgelder;${safeNum(summaryData.totals.tipsEuro)} EUR`);
      lines.push(`Anzahl Kassenbons;${summaryData.totals.receiptCount}`);
      lines.push('');

      // 2. Tagesübersicht (tabellarisch)
      lines.push('2. TAGESÜBERSICHT & VERBRAUCH JE TAG (TABELLARISCH);');
      lines.push('DATUM;WOCHENTAG;SPEISEN (STK);GETRÄNKE (STK);GESAMT (STK);UMSATZ BRUTTO;BAR (IST);KARTE;KASSENBONS');
      for (const d of dailyRows) {
        lines.push(
          `${d.dateKey};${d.formattedDate};${d.foodCount};${d.drinkCount};${d.totalItems};${safeNum(d.grossEuro)};${safeNum(d.cashEuro)};${safeNum(d.cardEuro)};${d.receiptCount}`
        );
      }
      lines.push('');

      // 3. Alle Bedienungsabrechnungen (tabellarisch)
      lines.push('3. ALLE BEDIENUNGSABRECHNUNGEN (TABELLARISCH);');
      lines.push('RANG;BEDIENUNG;GESAMT-UMSATZ;BAR (ABZUGEBEN);KARTE;PFANDRÜCKGABE;TRINKGELD;ANZAHL BONS');
      let wRank = 1;
      for (const w of waiterRows) {
        lines.push(
          `#${wRank};${w.waiterName};${safeNum(w.totalGrossEuro)};${safeNum(w.cashEuro)};${safeNum(w.cardEuro)};${safeNum(w.depositReturnedEuro)};${safeNum(w.tipsEuro)};${w.transactionCount}`
        );
        wRank++;
      }
      lines.push('');

      // 4. Artikel-Verbrauch Speisen & Getränke (tabellarisch)
      lines.push('4. ARTIKEL-VERBRAUCH: SPEISEN & GETRÄNKE (TABELLARISCH);');
      lines.push('ARTIKELNAME;SPARTE;EINZELPREIS BRUTTO;VERKAUFTE MENGE;GESAMTUMSATZ BRUTTO');
      for (const p of productRows) {
        lines.push(
          `${p.name};${p.type};${safeNum(p.unitPriceEuro)};${p.totalQuantity};${safeNum(p.totalRevenueEuro)}`
        );
      }

      const safeName = eventName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Abschlussbericht_${safeName}_${new Date().toISOString().slice(0, 10)}.csv`;

      return new Response(lines.join('\r\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // Default: JSON
    return NextResponse.json(summaryData);
  } catch (err: any) {
    console.error('[EVENT_SUMMARY_ERROR]', err);
    return NextResponse.json(
      { error: err?.message ? `Fehler beim Erstellen des Abschlussberichts: ${err.message}` : 'Fehler beim Erstellen des Abschlussberichts' },
      { status: 500 }
    );
  }
}
