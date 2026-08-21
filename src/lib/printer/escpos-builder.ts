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
    // Standard ESC/POS cash drawer kick command: ESC p pin t1 t2
    this.buffer.push(Buffer.from([ESC, 0x70, 0, 25, 250]));
    return this;
  }

  public cut(partial = false): this {
    this.lineFeed(4);
    // GS V 66 0 (partial/full cut with feed)
    this.buffer.push(Buffer.from([GS, 0x56, partial ? 1 : 0]));
    return this;
  }

  public build(): Buffer {
    return Buffer.concat(this.buffer);
  }

  // High-level template builder for all POS ticket types
  public static buildTicket(data: TicketData, paperWidth = 80): { rawBuffer: Buffer; textRepresentation: string } {
    const builder = new EscPosBuilder(paperWidth);
    const textLines: string[] = [];

    const addText = (t: string) => {
      textLines.push(t);
    };

    // Training mode watermark banner
    if (data.isTraining) {
      builder.align('center').bold(true).invert(true).textLine(' *** ÜBUNGSMODUS - KEIN BELEG *** ').invert(false).bold(false);
      addText('*** ÜBUNGSMODUS - KEIN BELEG ***');
    }

    // Header
    builder.align('center').size(true, true).bold(true).textLine(data.title).size(false, false).bold(false);
    addText(`[ ${data.title} ]`);

    if (data.eventName) {
      builder.align('center').textLine(data.eventName);
      addText(data.eventName);
    }

    builder.doubleDivider();
    addText('='.repeat(paperWidth === 58 ? 32 : 42));

    // Order Info / Table / Token
    builder.align('left');
    if (data.tokenNumber) {
      builder.size(true, true).bold(true).align('center').textLine(`ABHOL-NR: #${data.tokenNumber}`).size(false, false).bold(false).align('left');
      addText(`ABHOL-NR: #${data.tokenNumber}`);
    }

    if (data.tableLabel) {
      builder.bold(true).textLine(`Tisch: ${data.tableLabel}`).bold(false);
      addText(`Tisch: ${data.tableLabel}`);
    }

    if (data.orderNumber) {
      builder.twoColumn(`Bestell-Nr: #${data.orderNumber}`, `Bedienung: ${data.waiterName || '-'}`);
      addText(`Bestell-Nr: #${data.orderNumber}  |  Bedienung: ${data.waiterName || '-'}`);
    }

    const dateStr = data.createdAt ? new Date(data.createdAt).toLocaleString('de-DE') : new Date().toLocaleString('de-DE');
    builder.textLine(`Datum/Zeit: ${dateStr}`);
    addText(`Datum/Zeit: ${dateStr}`);

    if (data.invoiceNumber) {
      builder.textLine(`Beleg-Nr: ${data.invoiceNumber}`);
      addText(`Beleg-Nr: ${data.invoiceNumber}`);
    }

    builder.divider();
    addText('-'.repeat(paperWidth === 58 ? 32 : 42));

    // Items List
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

    // Financial totals (for payment receipts)
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
        builder.twoColumn('MwSt (enthalten):', `${data.totalTax.toFixed(2)} EUR`);
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
}
