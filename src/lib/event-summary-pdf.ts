import { PDFDocument, StandardFonts, rgb, PDFPage } from 'pdf-lib';

export interface DailySummaryRow {
  dateKey: string;
  formattedDate: string;
  foodCount: number;
  drinkCount: number;
  totalItems: number;
  grossEuro: number;
  cashEuro: number;
  cardEuro: number;
  receiptCount: number;
}

export interface WaiterSummaryRow {
  waiterName: string;
  totalGrossEuro: number;
  cashEuro: number;
  cardEuro: number;
  depositReturnedEuro: number;
  tipsEuro: number;
  transactionCount: number;
}

export interface ProductSummaryRow {
  name: string;
  type: 'SPEISE' | 'GETRÄNK';
  unitPriceEuro: number;
  totalQuantity: number;
  totalRevenueEuro: number;
}

export interface EventSummaryData {
  eventName: string;
  eventSubtitle?: string;
  generatedAt: string;
  dateRange: string;
  totals: {
    grossEuro: number;
    netEuro: number;
    tax19Euro: number;
    tax7Euro: number;
    cashEuro: number;
    cardEuro: number;
    tipsEuro: number;
    depositChargedEuro: number;
    depositReturnedEuro: number;
    netDepositBalanceEuro: number;
    receiptCount: number;
    foodCount: number;
    drinkCount: number;
    totalItemCount: number;
  };
  dailyRows: DailySummaryRow[];
  waiterRows: WaiterSummaryRow[];
  productRows: ProductSummaryRow[];
}

function formatEuro(val: number): string {
  return `${val.toFixed(2).replace('.', ',')} €`;
}

function formatNum(val: number): string {
  return new Intl.NumberFormat('de-DE').format(val);
}

export async function generateEventSummaryPdf(data: EventSummaryData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN_LEFT = 40;
  const MARGIN_RIGHT = 40;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

  const pages: PDFPage[] = [];
  let currentPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(currentPage);
  let y = PAGE_HEIGHT - 45;

  const checkPageBreak = (neededHeight: number): PDFPage => {
    if (y - neededHeight < 45) {
      currentPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pages.push(currentPage);
      y = PAGE_HEIGHT - 45;

      // Running mini-header on subsequent pages
      currentPage.drawText(`${data.eventName} – Abschlussbericht`, {
        x: MARGIN_LEFT,
        y: y,
        size: 8,
        font: fontRegular,
        color: rgb(0.4, 0.4, 0.4),
      });
      currentPage.drawLine({
        start: { x: MARGIN_LEFT, y: y - 4 },
        end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: y - 4 },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });
      y -= 20;
    }
    return currentPage;
  };

  // ------------------------------------------------------------- Header (Page 1)
  currentPage.drawText(data.eventName || 'Veranstaltung', {
    x: MARGIN_LEFT,
    y,
    size: 20,
    font: fontBold,
    color: rgb(0.1, 0.15, 0.25),
  });
  y -= 20;

  currentPage.drawText('Abschlussbericht & Gesamtauswertung der Veranstaltung', {
    x: MARGIN_LEFT,
    y,
    size: 12,
    font: fontBold,
    color: rgb(0.2, 0.4, 0.65),
  });
  y -= 14;

  const subLine = `Erstellt am: ${data.generatedAt} | Zeitraum: ${data.dateRange || 'Gesamte Veranstaltung'}`;
  currentPage.drawText(subLine, {
    x: MARGIN_LEFT,
    y,
    size: 8.5,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 10;

  currentPage.drawLine({
    start: { x: MARGIN_LEFT, y },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y },
    thickness: 1.5,
    color: rgb(0.2, 0.4, 0.65),
  });
  y -= 18;

  // ------------------------------------------------------------- Section 1: Gesamtkennzahlen
  checkPageBreak(120);
  currentPage.drawText('1. Gesamtkennzahlen der Veranstaltung', {
    x: MARGIN_LEFT,
    y,
    size: 12,
    font: fontBold,
    color: rgb(0.15, 0.2, 0.3),
  });
  y -= 14;

  const summaryCards = [
    { label: 'Gesamtumsatz Brutto', value: formatEuro(data.totals.grossEuro), bold: true },
    { label: 'Gesamtumsatz Netto', value: formatEuro(data.totals.netEuro) },
    { label: 'MwSt. 19%', value: formatEuro(data.totals.tax19Euro) },
    { label: 'MwSt. 7%', value: formatEuro(data.totals.tax7Euro) },
    { label: 'Barumsatz (Ist)', value: formatEuro(data.totals.cashEuro) },
    { label: 'Kartenzahlungen', value: formatEuro(data.totals.cardEuro) },
    { label: 'Verkaufte Speisen', value: `${formatNum(data.totals.foodCount)} Portionen` },
    { label: 'Verkaufte Getränke', value: `${formatNum(data.totals.drinkCount)} Gläser/Flaschen` },
    { label: 'Artikel gesamt', value: `${formatNum(data.totals.totalItemCount)} Positionen` },
    { label: 'Ausbezahlter Pfand', value: formatEuro(data.totals.depositReturnedEuro) },
    { label: 'Bedienungs-Trinkgelder', value: formatEuro(data.totals.tipsEuro) },
    { label: 'Anzahl Kassenbons', value: `${formatNum(data.totals.receiptCount)} Belege` },
  ];

  const colWidth = CONTENT_WIDTH / 3;
  let cardIdx = 0;
  for (const card of summaryCards) {
    const col = cardIdx % 3;
    if (col === 0 && cardIdx > 0) y -= 24;
    const xPos = MARGIN_LEFT + col * colWidth;

    currentPage.drawRectangle({
      x: xPos,
      y: y - 18,
      width: colWidth - 6,
      height: 22,
      color: rgb(0.96, 0.97, 0.98),
      borderColor: rgb(0.85, 0.88, 0.92),
      borderWidth: 0.5,
    });

    currentPage.drawText(card.label, {
      x: xPos + 5,
      y: y - 7,
      size: 7,
      font: fontRegular,
      color: rgb(0.4, 0.45, 0.5),
    });

    currentPage.drawText(card.value, {
      x: xPos + 5,
      y: y - 16,
      size: 8.5,
      font: card.bold ? fontBold : fontRegular,
      color: card.bold ? rgb(0.1, 0.4, 0.25) : rgb(0.1, 0.15, 0.2),
    });

    cardIdx++;
  }
  y -= 32;

  // ------------------------------------------------------------- Section 2: Tagesübersicht (Tabelle)
  checkPageBreak(80);
  currentPage.drawText('2. Tagesübersicht & Verbrauch je Tag (tabellarisch)', {
    x: MARGIN_LEFT,
    y,
    size: 12,
    font: fontBold,
    color: rgb(0.15, 0.2, 0.3),
  });
  y -= 14;

  const drawTableHeader = (cols: Array<{ title: string; x: number; width: number; align?: 'left' | 'right' }>) => {
    currentPage.drawRectangle({
      x: MARGIN_LEFT,
      y: y - 13,
      width: CONTENT_WIDTH,
      height: 16,
      color: rgb(0.2, 0.3, 0.45),
    });
    for (const c of cols) {
      currentPage.drawText(c.title, {
        x: c.align === 'right' ? c.x + c.width - fontBold.widthOfTextAtSize(c.title, 7.5) : c.x,
        y: y - 10,
        size: 7.5,
        font: fontBold,
        color: rgb(1, 1, 1),
      });
    }
    y -= 15;
  };

  const dailyCols = [
    { title: 'Datum / Tag', x: MARGIN_LEFT + 4, width: 85, align: 'left' as const },
    { title: 'Speisen', x: MARGIN_LEFT + 95, width: 45, align: 'right' as const },
    { title: 'Getränke', x: MARGIN_LEFT + 145, width: 45, align: 'right' as const },
    { title: 'Gesamt (Stk.)', x: MARGIN_LEFT + 195, width: 55, align: 'right' as const },
    { title: 'Umsatz Brutto', x: MARGIN_LEFT + 255, width: 65, align: 'right' as const },
    { title: 'Bar (Ist)', x: MARGIN_LEFT + 325, width: 60, align: 'right' as const },
    { title: 'Karte', x: MARGIN_LEFT + 390, width: 55, align: 'right' as const },
    { title: 'Bons', x: MARGIN_LEFT + 450, width: 45, align: 'right' as const },
  ];

  drawTableHeader(dailyCols);

  let rowIdx = 0;
  for (const d of data.dailyRows) {
    checkPageBreak(16);
    const isEven = rowIdx % 2 === 0;
    if (isEven) {
      currentPage.drawRectangle({
        x: MARGIN_LEFT,
        y: y - 11,
        width: CONTENT_WIDTH,
        height: 13,
        color: rgb(0.97, 0.98, 0.99),
      });
    }

    const values = [
      { text: d.formattedDate, x: dailyCols[0].x, width: dailyCols[0].width, align: 'left' as const },
      { text: formatNum(d.foodCount), x: dailyCols[1].x, width: dailyCols[1].width, align: 'right' as const },
      { text: formatNum(d.drinkCount), x: dailyCols[2].x, width: dailyCols[2].width, align: 'right' as const },
      { text: formatNum(d.totalItems), x: dailyCols[3].x, width: dailyCols[3].width, align: 'right' as const },
      { text: formatEuro(d.grossEuro), x: dailyCols[4].x, width: dailyCols[4].width, align: 'right' as const, bold: true },
      { text: formatEuro(d.cashEuro), x: dailyCols[5].x, width: dailyCols[5].width, align: 'right' as const },
      { text: formatEuro(d.cardEuro), x: dailyCols[6].x, width: dailyCols[6].width, align: 'right' as const },
      { text: formatNum(d.receiptCount), x: dailyCols[7].x, width: dailyCols[7].width, align: 'right' as const },
    ];

    for (const v of values) {
      const f = v.bold ? fontBold : fontRegular;
      const xPos = v.align === 'right' ? v.x + v.width - f.widthOfTextAtSize(v.text, 7.5) : v.x;
      currentPage.drawText(v.text, {
        x: xPos,
        y: y - 8,
        size: 7.5,
        font: f,
        color: rgb(0.15, 0.15, 0.15),
      });
    }
    y -= 13;
    rowIdx++;
  }
  y -= 16;

  // ------------------------------------------------------------- Section 3: Alle Bedienungsabrechnungen
  checkPageBreak(80);
  currentPage.drawText('3. Alle Bedienungsabrechnungen (tabellarisch)', {
    x: MARGIN_LEFT,
    y,
    size: 12,
    font: fontBold,
    color: rgb(0.15, 0.2, 0.3),
  });
  y -= 14;

  const waiterCols = [
    { title: 'Nr.', x: MARGIN_LEFT + 4, width: 22, align: 'left' as const },
    { title: 'Bedienung', x: MARGIN_LEFT + 28, width: 110, align: 'left' as const },
    { title: 'Umsatz Brutto', x: MARGIN_LEFT + 145, width: 70, align: 'right' as const },
    { title: 'Bar (Abgabe)', x: MARGIN_LEFT + 220, width: 70, align: 'right' as const },
    { title: 'Karte', x: MARGIN_LEFT + 295, width: 60, align: 'right' as const },
    { title: 'Pfandrückgabe', x: MARGIN_LEFT + 360, width: 65, align: 'right' as const },
    { title: 'Trinkgeld', x: MARGIN_LEFT + 430, width: 45, align: 'right' as const },
    { title: 'Bons', x: MARGIN_LEFT + 480, width: 30, align: 'right' as const },
  ];

  drawTableHeader(waiterCols);

  let wIdx = 1;
  for (const w of data.waiterRows) {
    checkPageBreak(16);
    const isEven = wIdx % 2 === 0;
    if (isEven) {
      currentPage.drawRectangle({
        x: MARGIN_LEFT,
        y: y - 11,
        width: CONTENT_WIDTH,
        height: 13,
        color: rgb(0.97, 0.98, 0.99),
      });
    }

    const values = [
      { text: `#${wIdx}`, x: waiterCols[0].x, width: waiterCols[0].width, align: 'left' as const },
      { text: w.waiterName.slice(0, 22), x: waiterCols[1].x, width: waiterCols[1].width, align: 'left' as const },
      { text: formatEuro(w.totalGrossEuro), x: waiterCols[2].x, width: waiterCols[2].width, align: 'right' as const, bold: true },
      { text: formatEuro(w.cashEuro), x: waiterCols[3].x, width: waiterCols[3].width, align: 'right' as const },
      { text: formatEuro(w.cardEuro), x: waiterCols[4].x, width: waiterCols[4].width, align: 'right' as const },
      { text: formatEuro(w.depositReturnedEuro), x: waiterCols[5].x, width: waiterCols[5].width, align: 'right' as const },
      { text: formatEuro(w.tipsEuro), x: waiterCols[6].x, width: waiterCols[6].width, align: 'right' as const },
      { text: formatNum(w.transactionCount), x: waiterCols[7].x, width: waiterCols[7].width, align: 'right' as const },
    ];

    for (const v of values) {
      const f = v.bold ? fontBold : fontRegular;
      const xPos = v.align === 'right' ? v.x + v.width - f.widthOfTextAtSize(v.text, 7.5) : v.x;
      currentPage.drawText(v.text, {
        x: xPos,
        y: y - 8,
        size: 7.5,
        font: f,
        color: rgb(0.15, 0.15, 0.15),
      });
    }
    y -= 13;
    wIdx++;
  }
  y -= 16;

  // ------------------------------------------------------------- Section 4: Artikel-Verbrauch (Speisen & Getränke)
  checkPageBreak(80);
  currentPage.drawText('4. Artikel-Verbrauch: Speisen & Getränke (tabellarisch)', {
    x: MARGIN_LEFT,
    y,
    size: 12,
    font: fontBold,
    color: rgb(0.15, 0.2, 0.3),
  });
  y -= 14;

  const prodCols = [
    { title: 'Artikelname', x: MARGIN_LEFT + 4, width: 220, align: 'left' as const },
    { title: 'Sparte', x: MARGIN_LEFT + 230, width: 70, align: 'left' as const },
    { title: 'Einzelpreis', x: MARGIN_LEFT + 305, width: 65, align: 'right' as const },
    { title: 'Menge (Stk.)', x: MARGIN_LEFT + 375, width: 65, align: 'right' as const },
    { title: 'Umsatz Brutto', x: MARGIN_LEFT + 445, width: 65, align: 'right' as const },
  ];

  drawTableHeader(prodCols);

  let pIdx = 0;
  for (const p of data.productRows) {
    checkPageBreak(15);
    const isEven = pIdx % 2 === 0;
    if (isEven) {
      currentPage.drawRectangle({
        x: MARGIN_LEFT,
        y: y - 11,
        width: CONTENT_WIDTH,
        height: 13,
        color: rgb(0.97, 0.98, 0.99),
      });
    }

    const typeColor = p.type === 'GETRÄNK' ? rgb(0.1, 0.4, 0.7) : rgb(0.7, 0.35, 0.1);
    const values = [
      { text: p.name.slice(0, 38), x: prodCols[0].x, width: prodCols[0].width, align: 'left' as const },
      { text: p.type, x: prodCols[1].x, width: prodCols[1].width, align: 'left' as const, color: typeColor, bold: true },
      { text: formatEuro(p.unitPriceEuro), x: prodCols[2].x, width: prodCols[2].width, align: 'right' as const },
      { text: formatNum(p.totalQuantity), x: prodCols[3].x, width: prodCols[3].width, align: 'right' as const, bold: true },
      { text: formatEuro(p.totalRevenueEuro), x: prodCols[4].x, width: prodCols[4].width, align: 'right' as const },
    ];

    for (const v of values) {
      const f = v.bold ? fontBold : fontRegular;
      const xPos = v.align === 'right' ? v.x + v.width - f.widthOfTextAtSize(v.text, 7.5) : v.x;
      currentPage.drawText(v.text, {
        x: xPos,
        y: y - 8,
        size: 7.5,
        font: f,
        color: v.color || rgb(0.15, 0.15, 0.15),
      });
    }
    y -= 13;
    pIdx++;
  }

  // ------------------------------------------------------------- Footers (all pages)
  const totalPages = pages.length;
  pages.forEach((p, idx) => {
    p.drawLine({
      start: { x: MARGIN_LEFT, y: 30 },
      end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: 30 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });

    p.drawText(`OpenBon Kassensystem – Abschlussbericht ${data.eventName}`, {
      x: MARGIN_LEFT,
      y: 20,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5),
    });

    const pageNumText = `Seite ${idx + 1} von ${totalPages}`;
    const pageNumWidth = fontRegular.widthOfTextAtSize(pageNumText, 7.5);
    p.drawText(pageNumText, {
      x: PAGE_WIDTH - MARGIN_RIGHT - pageNumWidth,
      y: 20,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5),
    });
  });

  return Buffer.from(await doc.save());
}
