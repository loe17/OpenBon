import iconv from 'iconv-lite';
import { TicketData } from './types';

// ESC/POS Command Constants
const ESC = 0x1b;
const GS = 0x1d;

export class EscPosBuilder {
  private buffer: Buffer[] = [];
  private paperWidth: number; // 80 or 58 mm
  private charLimit: number; // 42 or 32 chars per line
  private encoding: string;

  constructor(paperWidth = 80, encoding = 'CP858') {
    this.paperWidth = paperWidth;
    this.charLimit = paperWidth === 58 ? 32 : 42;
    this.encoding = encoding;
    this.init();
  }

  public init(): this {
    this.buffer.push(Buffer.from([ESC, 0x40])); // ESC @ Initialize
    // Select CP858 Code Table (Table 19 on most Epson/Star compatible printers)
    this.buffer.push(Buffer.from([ESC, 0x74, 19]));
    return this;
  }

  public align(alignment: 'left' | 'center' | 'right'): this {
    const code = alignment === 'center' ? 1 : alignment === 'right' ? 2 : 0;
    this.buffer.push(Buffer.from([ESC, 0x61, code]));
    return this;
  }

  public bold(enable: boolean): this {
    this.buffer.push(Buffer.from([ESC, 0x45, enable ? 1 : 0]));
    return this;
  }

  public size(doubleWidth: boolean, doubleHeight: boolean): this {
    let n = 0;
    if (doubleWidth) n |= 0x20;
    if (doubleHeight) n |= 0x01;
    this.buffer.push(Buffer.from([ESC, 0x21, n]));
    return this;
  }

  public invert(enable: boolean): this {
    this.buffer.push(Buffer.from([GS, 0x42, enable ? 1 : 0]));
    return this;
  }

  public lineFeed(count = 1): this {
    for (let i = 0; i < count; i++) {
      this.buffer.push(Buffer.from([0x0a]));
    }
    return this;
  }

  public text(str: string): this {
    try {
      const encoded = iconv.encode(str, this.encoding);
      this.buffer.push(encoded);
    } catch {
      this.buffer.push(Buffer.from(str, 'latin1'));
    }
    return this;
  }

  public textLine(str = ''): this {
    this.text(str);
    this.lineFeed();
    return this;
  }

  public divider(char = '-'): this {
    this.textLine(char.repeat(this.charLimit));
    return this;
  }

  public doubleDivider(): this {
    this.textLine('='.repeat(this.charLimit));
    return this;
  }

  public twoColumn(left: string, right: string): this {
    const spaceCount = Math.max(1, this.charLimit - left.length - right.length);
    const line = left + ' '.repeat(spaceCount) + right;
    this.textLine(line);
    return this;
  }

  public openCashDrawer(): this {
    this.buffer.push(Buffer.from([ESC, 0x70, 0, 25, 250]));
    return this;
  }

  public cut(partial = false): this {
    this.lineFeed(4);
    this.buffer.push(Buffer.from([GS, 0x56, partial ? 1 : 0]));
    return this;
  }

  public build(): Buffer {
    return Buffer.concat(this.buffer);
  }

  // 1. Standard POS Ticket Builder
  public static buildTicket(data: TicketData, paperWidth = 80): { rawBuffer: Buffer; textRepresentation: string } {
    const builder = new EscPosBuilder(paperWidth);
    const textLines: string[] = [];

    const addText = (t: string) => {
      textLines.push(t);
    };

    if (data.isTraining) {
      builder.align('center').bold(true).invert(true).textLine(' *** UEBUNGSMODUS - KEIN BELEG *** ').invert(false).bold(false);
      addText('*** UEBUNGSMODUS - KEIN BELEG ***');
    }

    builder.align('center').size(true, true).bold(true).textLine(data.title).size(false, false).bold(false);
    addText(`[ ${data.title} ]`);

    if (data.eventName) {
      builder.align('center').textLine(data.eventName);
      addText(data.eventName);
    }

    builder.doubleDivider();
    addText('='.repeat(paperWidth === 58 ? 32 : 42));

    builder.align('left');
    if (data.tokenNumber) {
      builder.size(true, true).bold(true).align('center').textLine(`ABHOL-NR: #${data.tokenNumber}`).size(false, false).bold(false).align('left');
      addText(`ABHOL-NR: #${data.tokenNumber}`);
    }

    if (data.tableLabel) {
      builder.bold(true).textLine(`Tisch: ${data.tableLabel}`).bold(false);
      addText(`Tisch: ${data.tableLabel}`);
    }

    builder.bold(true).twoColumn(`Bedienung: ${data.waiterName || 'Kasse'}`, data.orderNumber ? `Bon #${data.orderNumber}` : '').bold(false);
    addText(`Bedienung: ${data.waiterName || 'Kasse'} ${data.orderNumber ? `| Bon #${data.orderNumber}` : ''}`);

    const dateStr = data.createdAt ? new Date(data.createdAt).toLocaleString('de-DE') : new Date().toLocaleString('de-DE');
    builder.textLine(`Datum: ${dateStr}`);
    addText(`Datum: ${dateStr}`);

    if (data.invoiceNumber) {
      builder.textLine(`Beleg-Nr: ${data.invoiceNumber}`);
      addText(`Beleg-Nr: ${data.invoiceNumber}`);
    }

    builder.divider();
    addText('-'.repeat(paperWidth === 58 ? 32 : 42));

    for (const item of data.items) {
      const displayName = item.alternativeName || item.name;
      const priceStr = item.unitPrice !== undefined ? `${(item.unitPrice * item.quantity).toFixed(2)} EUR` : '';
      
      builder.bold(true).twoColumn(`${item.quantity}x ${displayName}`, priceStr).bold(false);
      addText(`${item.quantity}x ${displayName}   ${priceStr}`);

      if (item.variantName) {
        builder.textLine(`   Variante: ${item.variantName}`);
        addText(`   Variante: ${item.variantName}`);
      }

      if (item.selectedOptions && item.selectedOptions.length > 0) {
        builder.textLine(`   + ${item.selectedOptions.join(', ')}`);
        addText(`   + ${item.selectedOptions.join(', ')}`);
      }

      if (item.customizationText) {
        builder.bold(true).textLine(`   ! WUNSCH: ${item.customizationText}`).bold(false);
        addText(`   ! WUNSCH: ${item.customizationText}`);
      }

      if (item.deposit && item.deposit > 0) {
        builder.textLine(`   inkl. Pfand: ${(item.deposit * item.quantity).toFixed(2)} EUR`);
        addText(`   inkl. Pfand: ${(item.deposit * item.quantity).toFixed(2)} EUR`);
      }
    }

    builder.divider();
    addText('-'.repeat(paperWidth === 58 ? 32 : 42));

    if (data.totalGross !== undefined) {
      builder.size(true, false).bold(true).twoColumn('GESAMTBETRAG:', `${data.totalGross.toFixed(2)} EUR`).size(false, false).bold(false);
      addText(`GESAMTBETRAG: ${data.totalGross.toFixed(2)} EUR`);

      if (data.returnDeposit && data.returnDeposit > 0) {
        builder.twoColumn('abzgl. Rueckpfand:', `-${data.returnDeposit.toFixed(2)} EUR`);
        addText(`abzgl. Rueckpfand: -${data.returnDeposit.toFixed(2)} EUR`);
      }

      if (data.discountAmount && data.discountAmount > 0) {
        builder.twoColumn('abzgl. Rabatt:', `-${data.discountAmount.toFixed(2)} EUR`);
        addText(`abzgl. Rabatt: -${data.discountAmount.toFixed(2)} EUR`);
      }

      if (data.paymentMethod) {
        builder.twoColumn('Zahlart:', data.paymentMethod);
        addText(`Zahlart: ${data.paymentMethod}`);
      }

      if (data.givenAmount && data.givenAmount > 0) {
        builder.twoColumn('Gegeben:', `${data.givenAmount.toFixed(2)} EUR`);
        builder.twoColumn('Rueckgeld:', `${(data.changeAmount || 0).toFixed(2)} EUR`);
        addText(`Gegeben: ${data.givenAmount.toFixed(2)} EUR  |  Rueckgeld: ${(data.changeAmount || 0).toFixed(2)} EUR`);
      }

      if (data.tipAmount && data.tipAmount > 0) {
        builder.twoColumn('davon Trinkgeld:', `${data.tipAmount.toFixed(2)} EUR`);
        addText(`davon Trinkgeld: ${data.tipAmount.toFixed(2)} EUR`);
      }

      if (data.totalNet !== undefined && data.totalTax !== undefined) {
        builder.divider('.');
        builder.twoColumn('Netto:', `${data.totalNet.toFixed(2)} EUR`);
        builder.twoColumn('MwSt 19% (enthalten):', `${data.totalTax.toFixed(2)} EUR`);
      }
    }

    if (data.footerText) {
      builder.lineFeed();
      builder.align('center').textLine(data.footerText);
      addText(data.footerText);
    }

    builder.cut();

    return {
      rawBuffer: builder.build(),
      textRepresentation: textLines.join('\n'),
    };
  }

  // 2. Station Joining QR-Code Ticket
  public static buildStationJoinTicket(station: { title: string; role: string; description: string; url: string; pin: string }, paperWidth = 80): { rawBuffer: Buffer; textRepresentation: string } {
    const builder = new EscPosBuilder(paperWidth);
    const textLines: string[] = [];

    builder.align('center').bold(true).textLine('=== OPENBON KASSENSYSTEM ===');
    builder.size(true, true).bold(true).textLine(station.title).size(false, false).bold(false);
    builder.lineFeed(1);

    builder.textLine(`Rolle: ${station.role}`);
    builder.textLine(`Beschreibung: ${station.description}`);
    builder.doubleDivider();

    builder.size(true, true).bold(true).textLine(`STATIONS-PIN: ${station.pin}`).size(false, false).bold(false);
    builder.doubleDivider();

    builder.textLine('URL im Smartphone-Browser oeffnen:');
    builder.bold(true).textLine(station.url).bold(false);
    builder.lineFeed(1);
    builder.textLine('Oder scanne den QR-Code auf dem Bildschirm');
    builder.textLine('Tipp: "Zum Home-Bildschirm" fuer Vollbild');
    builder.doubleDivider();
    builder.textLine(`Gedruckt: ${new Date().toLocaleString('de-DE')}`);
    builder.cut();

    return {
      rawBuffer: builder.build(),
      textRepresentation: [
        `[ OPENBON BEITRITTS-BON ]`,
        station.title,
        `STATIONS-PIN: ${station.pin}`,
        `URL: ${station.url}`,
      ].join('\n'),
    };
  }

  // 3. Official Z-Bon Tagesabschluss Report Ticket
  public static buildZBonTicket(report: any, paperWidth = 80): { rawBuffer: Buffer; textRepresentation: string } {
    const builder = new EscPosBuilder(paperWidth);
    const textLines: string[] = [];

    builder.align('center').bold(true).textLine('========================================');
    builder.size(true, true).bold(true).textLine('Z-BON TAGESABSCHLUSS').size(false, false).bold(false);
    builder.textLine('OpenBon Kassensystem');
    builder.textLine(`Abschluss: ${new Date().toLocaleString('de-DE')}`);
    builder.doubleDivider();

    builder.align('left');
    builder.size(true, false).bold(true).twoColumn('GESAMTUMSATZ BRUTTO:', `${(report.totalGross || 0).toFixed(2)} EUR`).size(false, false).bold(false);
    builder.twoColumn('Gesamtumsatz Netto:', `${(report.totalNet || 0).toFixed(2)} EUR`);
    builder.twoColumn('MwSt 19%:', `${(report.totalTax19 || 0).toFixed(2)} EUR`);
    builder.twoColumn('MwSt 7%:', `${(report.totalTax7 || 0).toFixed(2)} EUR`);
    builder.divider();

    builder.bold(true).textLine('ZAHLUNGSARTEN:').bold(false);
    builder.twoColumn('Bargeld (Kassenbestand):', `${(report.totalCash || 0).toFixed(2)} EUR`);
    builder.twoColumn('Kartenzahlung Gesamt:', `${(report.totalCard || 0).toFixed(2)} EUR`);
    if (report.paymentSplit) {
      builder.twoColumn(' - davon SumUp:', `${(report.paymentSplit.cardSumUp || 0).toFixed(2)} EUR`);
      builder.twoColumn(' - davon VR-Pay Me:', `${(report.paymentSplit.cardVrPay || 0).toFixed(2)} EUR`);
      builder.twoColumn(' - davon EC-Terminal:', `${(report.paymentSplit.cardTerminal || 0).toFixed(2)} EUR`);
    }
    builder.twoColumn('Personal / Bewirtung:', `${(report.totalStaff || 0).toFixed(2)} EUR`);
    builder.twoColumn('Aufschlaege (Pauschalen):', `${(report.totalSurcharges || 0).toFixed(2)} EUR`);
    builder.twoColumn('Ausgezahlter Rueckpfand:', `-${(report.totalDepositReturned || 0).toFixed(2)} EUR`);
    builder.twoColumn('Erhaltenes Trinkgeld:', `+${(report.totalTips || 0).toFixed(2)} EUR`);
    builder.twoColumn('Anzahl Transaktionen:', `${report.transactionCount || 0}`);
    builder.divider();

    builder.bold(true).textLine('KELLNER-SCHICHTABRECHNUNG:').bold(false);
    for (const w of report.waiters || []) {
      builder.bold(true).twoColumn(`${w.waiterName}:`, `${(w.totalGross || 0).toFixed(2)} EUR`).bold(false);
      builder.textLine(`  Bar: ${(w.cashGross || 0).toFixed(2)} EUR | Karte: ${(w.cardGross || 0).toFixed(2)} EUR | Bons: ${w.transactionCount || 0}`);
    }

    builder.doubleDivider();
    builder.align('center').textLine('*** TAGESABSCHLUSS ERFOLGREICH ***');
    builder.cut();

    return {
      rawBuffer: builder.build(),
      textRepresentation: `Z-BON TAGESABSCHLUSS - ${(report.totalGross || 0).toFixed(2)} EUR`,
    };
  }
}
