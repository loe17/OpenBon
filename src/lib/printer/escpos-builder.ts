import iconv from 'iconv-lite';
import { TicketData, PrintItem } from './types';

// ESC/POS Command Constants
const ESC = 0x1b;
const GS = 0x1d;

export interface ZBonWaiterLine {
  waiterName: string;
  totalGross?: number;
  cashGross?: number;
  cardGross?: number;
  tips?: number;
  transactionCount?: number;
}

export interface ZBonReport {
  periodNumber?: number;
  openedAt?: string | Date;
  closedAt?: string | Date;
  totalGross?: number;
  totalNet?: number;
  totalTax19?: number;
  totalTax7?: number;
  taxBase0?: number;
  taxSplits?: { rate: number; base: number; tax: number; gross: number }[];
  totalCash?: number;
  totalCard?: number;
  paymentSplit?: {
    cardSumUp?: number;
    cardVrPay?: number;
    cardSparkasse?: number;
    cardTerminal?: number;
  };
  totalStaff?: number;
  totalSurcharges?: number;
  totalDepositReturned?: number;
  totalTips?: number;
  transactionCount?: number;
  cashIn?: number;
  cashOut?: number;
  cashExpected?: number;
  cashCounted?: number | null;
  cashDifference?: number | null;
  fiscalSignature?: string | null;
  waiters?: ZBonWaiterLine[];
}

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

  public charSize(widthMult = 1, heightMult = 1): this {
    const w = Math.min(8, Math.max(1, Math.round(widthMult))) - 1;
    const h = Math.min(8, Math.max(1, Math.round(heightMult))) - 1;
    const n = (w << 4) | h;
    this.buffer.push(Buffer.from([GS, 0x21, n]));
    return this;
  }

  public resetCharSize(): this {
    return this.charSize(1, 1);
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

  public qrCode(data: string, size = 6): this {
    if (!data) return this;
    const dataBuf = Buffer.from(data, 'utf-8');
    const storeLen = dataBuf.length + 3;
    const pL = storeLen % 256;
    const pH = Math.floor(storeLen / 256);

    // 1. Model: Model 2 (standard)
    this.buffer.push(Buffer.from([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]));
    // 2. Module size (1-16)
    this.buffer.push(Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, Math.min(16, Math.max(1, size))]));
    // 3. Error correction: Level M (49)
    this.buffer.push(Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]));
    // 4. Store data
    this.buffer.push(Buffer.from([GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30]));
    this.buffer.push(dataBuf);
    // 5. Print QR symbol
    this.buffer.push(Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]));
    this.lineFeed(1);
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

  public static formatTableNumber(
    builder: EscPosBuilder,
    tableLabel: string,
    fontSize: number | string = 3
  ): void {
    const fs = typeof fontSize === 'number' ? fontSize : parseInt(String(fontSize), 10) || 3;
    if (fs >= 8) {
      builder.align('center').invert(true).charSize(4, 5).bold(true).textLine(` TISCH ${tableLabel} `).resetCharSize().invert(false).bold(false).align('left');
    } else if (fs >= 7) {
      builder.align('center').invert(true).charSize(4, 4).bold(true).textLine(` TISCH ${tableLabel} `).resetCharSize().invert(false).bold(false).align('left');
    } else if (fs >= 6) {
      builder.align('center').invert(true).charSize(3, 4).bold(true).textLine(` TISCH ${tableLabel} `).resetCharSize().invert(false).bold(false).align('left');
    } else if (fs >= 5) {
      builder.align('center').invert(true).charSize(3, 3).bold(true).textLine(` TISCH ${tableLabel} `).resetCharSize().invert(false).bold(false).align('left');
    } else if (fs >= 4) {
      builder.charSize(2, 3).bold(true).textLine(`TISCH: ${tableLabel}`).resetCharSize().bold(false);
    } else if (fs >= 3 || fontSize === 'EXTRA_LARGE') {
      builder.charSize(2, 2).bold(true).textLine(`TISCH: ${tableLabel}`).resetCharSize().bold(false);
    } else if (fs >= 2 || fontSize === 'LARGE') {
      builder.charSize(1, 2).bold(true).textLine(`TISCH: ${tableLabel}`).resetCharSize().bold(false);
    } else {
      builder.bold(true).textLine(`Tisch: ${tableLabel}`).bold(false);
    }
  }

  // 1. Standard POS Ticket Builder
  public static buildTicket(data: TicketData, paperWidth = 80): { rawBuffer: Buffer; textRepresentation: string } {
    const builder = new EscPosBuilder(paperWidth);
    const textLines: string[] = [];

    const addText = (t: string) => {
      textLines.push(t);
    };

    // Spec 6.11: Aufdruck im Schulungs- / Trainingsmodus
    if (data.isTraining) {
      builder.align('center').bold(true).invert(true).textLine(' UEBUNGSBON - KEINE BEZAHLUNG ').invert(false).bold(false);
      addText('*** UEBUNGSBON - KEINE BEZAHLUNG ***');
    }

    // Spec 6.10: Zwischenrechnung ist ausdruecklich kein Kassenbeleg
    if (data.isPreliminary) {
      builder.align('center').bold(true).invert(true).textLine(' ZWISCHENRECHNUNG - KEIN KASSENBELEG ').invert(false).bold(false);
      addText('*** ZWISCHENRECHNUNG - KEIN KASSENBELEG ***');
    }

    builder.align('center').size(true, true).bold(true).textLine(data.title).size(false, false).bold(false);
    addText(`[ ${data.title} ]`);

    // Spec 6.1: Kopfzeile des Tablett-Splits
    if (data.traySplit) {
      const header = `*** BON ${data.traySplit.index} von ${data.traySplit.total} (${data.traySplit.summary}) ***`;
      builder.align('center').bold(true).textLine(header).bold(false);
      addText(header);
    }

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
      EscPosBuilder.formatTableNumber(builder, data.tableLabel, data.tableFontSize ?? 3);
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

    // Spec 6.5: Positionen nach Gang gruppiert drucken
    const hasCourses = data.items.some((i) => (i.courseNumber ?? 1) > 1);
    const sortedItems = hasCourses
      ? [...data.items].sort((a, b) => (a.courseNumber ?? 1) - (b.courseNumber ?? 1))
      : data.items;
    let lastCourse = 0;

    for (const item of sortedItems) {
      if (hasCourses && (item.courseNumber ?? 1) !== lastCourse) {
        lastCourse = item.courseNumber ?? 1;
        builder.bold(true).invert(true).textLine(` GANG ${lastCourse} `).invert(false).bold(false);
        addText(`--- GANG ${lastCourse} ---`);
      }

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

      if (data.surchargeAmount && data.surchargeAmount > 0) {
        builder.twoColumn(`zzgl. ${data.surchargeReason || 'Aufschlag'}:`, `+${data.surchargeAmount.toFixed(2)} EUR`);
        addText(`zzgl. ${data.surchargeReason || 'Aufschlag'}: +${data.surchargeAmount.toFixed(2)} EUR`);
      }

      if (data.paymentMethod) {
        builder.twoColumn('Zahlart:', data.paymentMethod);
        addText(`Zahlart: ${data.paymentMethod}`);
      }

      if (data.cardAuthCode) {
        builder.twoColumn('Autorisierung:', data.cardAuthCode);
        addText(`Autorisierung: ${data.cardAuthCode}`);
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

      // Spec 6.7: MwSt-Splits (19 % / 7 % / 0 %) statt pauschaler 19 % (nur wenn enableTax aktiv)
      if (data.enableTax !== false) {
        if (data.taxSplits && data.taxSplits.length > 0) {
          builder.divider('.');
          addText('.'.repeat(paperWidth === 58 ? 32 : 42));
          builder.bold(true).textLine('MWST-AUFSCHLUESSELUNG').bold(false);
          addText('MWST-AUFSCHLUESSELUNG');
          for (const split of data.taxSplits) {
            const label = `${split.rate.toFixed(0)}% auf ${split.base.toFixed(2)}`;
            builder.twoColumn(label, `${split.tax.toFixed(2)} EUR`);
            addText(`${label}  ${split.tax.toFixed(2)} EUR`);
          }
          builder.twoColumn('Netto gesamt:', `${(data.totalNet ?? 0).toFixed(2)} EUR`);
          addText(`Netto gesamt: ${(data.totalNet ?? 0).toFixed(2)} EUR`);
        } else if (data.totalNet !== undefined && data.totalTax !== undefined) {
          builder.divider('.');
          builder.twoColumn('Netto:', `${data.totalNet.toFixed(2)} EUR`);
          builder.twoColumn('MwSt (enthalten):', `${data.totalTax.toFixed(2)} EUR`);
        }
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
    builder.align('center').qrCode(station.url, paperWidth === 58 ? 5 : 7);
    builder.align('center').textLine('QR-Code mit Smartphone scannen');
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

  public static buildTableMarkerTicket(
    data: {
      tableNumber: number | string;
      label?: string;
      qrUrl?: string | null;
      eventName?: string;
    },
    paperWidth = 80
  ): { rawBuffer: Buffer; textRepresentation: string } {
    const builder = new EscPosBuilder(paperWidth);
    const label = data.label || `TISCH ${data.tableNumber}`;

    builder.align('center');
    builder.lineFeed(1);
    builder.bold(true).size(true, true).textLine('========================');
    builder.lineFeed(1);
    builder.invert(true).bold(true).size(true, true).textLine(`   ${label.toUpperCase()}   `).size(false, false).invert(false).bold(false);
    builder.lineFeed(1);
    builder.bold(true).size(true, true).textLine('========================').size(false, false).bold(false);

    if (data.qrUrl) {
      builder.lineFeed(1);
      builder.align('center').qrCode(data.qrUrl, paperWidth === 58 ? 5 : 7);
      builder.lineFeed(1);
      builder.bold(true).textLine('HIER MIT DEM HANDY SCANNEN');
      builder.textLine('und direkt am Tisch bestellen');
    }

    builder.lineFeed(2);
    builder.cut();

    return {
      rawBuffer: builder.build(),
      textRepresentation: [
        '========================',
        `   ${label.toUpperCase()}   `,
        '========================',
        data.qrUrl ? `QR-Code: ${data.qrUrl}` : '',
      ].filter(Boolean).join('\n'),
    };
  }

  /**
   * Einzelbon-Druck fuer Speisen & Getraenke an Kuechen-/Ausschank-Stationen
   */
  public static buildSingleItemKitchenTicket(
    item: PrintItem,
    meta: {
      title?: string;
      tableLabel?: string | null;
      orderNumber?: number;
      waiterName?: string;
      createdAt?: string | Date;
      itemIndex?: number;
      totalItems?: number;
      courseNumber?: number;
      isTraining?: boolean;
      tableFontSize?: number | string | null;
      showHeader?: boolean;
      showTable?: boolean;
      showWaiter?: boolean;
      showTimestamp?: boolean;
      showOptions?: boolean;
    },
    paperWidth = 80
  ): { rawBuffer: Buffer; textRepresentation: string } {
    const builder = new EscPosBuilder(paperWidth);
    const lines: string[] = [];
    const add = (t: string) => lines.push(t);

    if (meta.isTraining) {
      builder.align('center').bold(true).invert(true).textLine(' UEBUNGSBON - KEINE BEZAHLUNG ').invert(false).bold(false);
      add('[ ÜBUNGSBON ]');
    }

    if (meta.showHeader !== false && meta.title) {
      builder.align('center').bold(true).textLine(`=== ${meta.title.toUpperCase()} ===`).bold(false);
      add(`=== ${meta.title} ===`);
    }

    if (meta.showTable !== false && meta.tableLabel) {
      EscPosBuilder.formatTableNumber(builder, meta.tableLabel, meta.tableFontSize ?? 4);
      add(`Tisch: ${meta.tableLabel}`);
    }

    builder.align('left');
    const leftInfo = meta.showWaiter !== false ? `Bedienung: ${meta.waiterName || 'Kasse'}` : '';
    const rightInfo = meta.orderNumber ? `Bon #${meta.orderNumber}` : '';
    if (leftInfo || rightInfo) {
      builder.twoColumn(leftInfo, rightInfo);
      add(`${leftInfo} | ${rightInfo}`);
    }

    if (meta.showTimestamp !== false) {
      const dateStr = meta.createdAt ? new Date(meta.createdAt).toLocaleString('de-DE') : new Date().toLocaleString('de-DE');
      builder.textLine(`Uhrzeit: ${dateStr}`);
      add(`Uhrzeit: ${dateStr}`);
    }

    builder.divider();
    add('-'.repeat(paperWidth === 58 ? 32 : 42));

    if (meta.courseNumber && meta.courseNumber > 1) {
      builder.bold(true).invert(true).textLine(` GANG ${meta.courseNumber} `).invert(false).bold(false);
      add(`--- GANG ${meta.courseNumber} ---`);
    }

    // Haupt-Artikelzeile extra groß
    const displayName = item.alternativeName || item.name;
    builder.size(true, true).bold(true).textLine(`${item.quantity}x ${displayName}`).size(false, false).bold(false);
    add(`${item.quantity}x ${displayName}`);

    if (item.variantName) {
      builder.size(false, true).bold(true).textLine(`   ${item.variantName}`).size(false, false).bold(false);
      add(`   Sorte: ${item.variantName}`);
    }

    if (meta.showOptions !== false && item.selectedOptions && item.selectedOptions.length > 0) {
      builder.bold(true).textLine(`   + ${item.selectedOptions.join(', ')}`).bold(false);
      add(`   + ${item.selectedOptions.join(', ')}`);
    }

    if (item.customizationText) {
      builder.lineFeed();
      builder.invert(true).bold(true).textLine(` ! WUNSCH: ${item.customizationText} `).invert(false).bold(false);
      add(` ! WUNSCH: ${item.customizationText}`);
    }

    if (meta.itemIndex && meta.totalItems) {
      builder.lineFeed();
      builder.textLine(`(Position ${meta.itemIndex} von ${meta.totalItems})`);
    }

    builder.lineFeed(2);
    builder.cut();

    return {
      rawBuffer: builder.build(),
      textRepresentation: lines.join('\n'),
    };
  }

  /**
   * Spec 6.4: Roter Storno-Bon fuer die Kueche.
   * Thermopapier kennt kein Rot, daher wird der Bon durchgaengig invertiert
   * gesetzt (weiss auf schwarz) und mit einer unmissverstaendlichen Warnzeile
   * versehen. Bei Zwei-Farb-Papier druckt der Kopf zusaetzlich in Rot.
   */
  public static buildVoidTicket(
    data: {
      title?: string;
      tableLabel?: string | null;
      orderNumber?: number;
      waiterName?: string;
      cancelledBy?: string;
      reason: string;
      items: PrintItem[];
      isTraining?: boolean;
      createdAt?: string | Date;
    },
    paperWidth = 80
  ): { rawBuffer: Buffer; textRepresentation: string } {
    const builder = new EscPosBuilder(paperWidth);
    const lines: string[] = [];
    const add = (t: string) => lines.push(t);

    if (data.isTraining) {
      builder.align('center').bold(true).invert(true).textLine(' *** UEBUNGSBON - KEINE BEZAHLUNG *** ').invert(false).bold(false);
      add('*** UEBUNGSBON - KEINE BEZAHLUNG ***');
    }

    builder.align('center').invert(true).bold(true).size(true, true);
    builder.textLine(' STORNO ');
    builder.size(false, false).invert(false).bold(false);
    add('[ STORNO ]');

    builder.invert(true).bold(true);
    builder.textLine(' *** STORNO-BON - NICHT ZUBEREITEN *** ');
    builder.invert(false).bold(false);
    add('*** STORNO-BON - NICHT ZUBEREITEN ***');

    builder.doubleDivider();
    add('='.repeat(paperWidth === 58 ? 32 : 42));

    builder.align('left');
    if (data.title) {
      builder.bold(true).textLine(`Station: ${data.title}`).bold(false);
      add(`Station: ${data.title}`);
    }
    if (data.tableLabel) {
      builder.bold(true).textLine(`Tisch: ${data.tableLabel}`).bold(false);
      add(`Tisch: ${data.tableLabel}`);
    }
    if (data.orderNumber !== undefined) {
      builder.textLine(`Urspruenglicher Bon: #${data.orderNumber}`);
      add(`Urspruenglicher Bon: #${data.orderNumber}`);
    }
    builder.textLine(`Bedienung: ${data.waiterName || 'Kasse'}`);
    add(`Bedienung: ${data.waiterName || 'Kasse'}`);
    if (data.cancelledBy) {
      builder.textLine(`Storniert durch: ${data.cancelledBy}`);
      add(`Storniert durch: ${data.cancelledBy}`);
    }
    const ts = data.createdAt ? new Date(data.createdAt) : new Date();
    builder.textLine(`Zeitpunkt: ${ts.toLocaleString('de-DE')}`);
    add(`Zeitpunkt: ${ts.toLocaleString('de-DE')}`);

    builder.divider();
    add('-'.repeat(paperWidth === 58 ? 32 : 42));

    for (const item of data.items) {
      const name = item.alternativeName || item.name;
      builder.size(true, false).bold(true).textLine(`${item.quantity}x ${name}`).size(false, false).bold(false);
      add(`${item.quantity}x ${name}`);
      if (item.variantName) {
        builder.textLine(`   Variante: ${item.variantName}`);
        add(`   Variante: ${item.variantName}`);
      }
    }

    builder.divider();
    add('-'.repeat(paperWidth === 58 ? 32 : 42));
    builder.bold(true).textLine(`GRUND: ${data.reason}`).bold(false);
    add(`GRUND: ${data.reason}`);

    builder.doubleDivider();
    builder.align('center').invert(true).textLine(' NICHT ZUBEREITEN - NICHT AUSGEBEN ').invert(false);
    add('NICHT ZUBEREITEN - NICHT AUSGEBEN');
    builder.cut();

    return { rawBuffer: builder.build(), textRepresentation: lines.join('\n') };
  }

  /**
   * Spec 6.7: X-Bon (Kellner-Zwischenstand) – schliesst die Kasse NICHT ab.
   */
  public static buildXBonTicket(
    report: {
      waiterName?: string;
      periodNumber?: number;
      openedAt?: string | Date;
      totalGross: number;
      totalCash: number;
      totalCard: number;
      cardSumUp?: number;
      cardVrPay?: number;
      cardSparkasse?: number;
      cardTerminal?: number;
      totalTips: number;
      totalDepositReturned?: number;
      totalStaff?: number;
      cashIn?: number;
      cashOut?: number;
      cashExpected?: number;
      transactionCount: number;
      isTraining?: boolean;
    },
    paperWidth = 80
  ): { rawBuffer: Buffer; textRepresentation: string } {
    const builder = new EscPosBuilder(paperWidth);
    const lines: string[] = [];
    const add = (t: string) => lines.push(t);

    if (report.isTraining) {
      builder.align('center').bold(true).invert(true).textLine(' *** UEBUNGSBON - KEINE BEZAHLUNG *** ').invert(false).bold(false);
      add('*** UEBUNGSBON - KEINE BEZAHLUNG ***');
    }

    builder.align('center').size(true, true).bold(true).textLine('X-BON').size(false, false);
    builder.textLine('ZWISCHENBERICHT - KEIN ABSCHLUSS').bold(false);
    add('[ X-BON - ZWISCHENBERICHT - KEIN ABSCHLUSS ]');

    builder.textLine(report.waiterName ? `Bedienung: ${report.waiterName}` : 'Alle Bedienungen');
    add(report.waiterName ? `Bedienung: ${report.waiterName}` : 'Alle Bedienungen');
    builder.textLine(`Stand: ${new Date().toLocaleString('de-DE')}`);
    add(`Stand: ${new Date().toLocaleString('de-DE')}`);
    if (report.periodNumber !== undefined) {
      builder.textLine(`Kassenperiode: #${report.periodNumber}`);
      add(`Kassenperiode: #${report.periodNumber}`);
    }
    builder.doubleDivider();
    add('='.repeat(paperWidth === 58 ? 32 : 42));

    builder.align('left');
    builder.size(true, false).bold(true).twoColumn('SCHICHT-UMSATZ:', `${report.totalGross.toFixed(2)} EUR`).size(false, false).bold(false);
    add(`SCHICHT-UMSATZ: ${report.totalGross.toFixed(2)} EUR`);
    builder.divider();

    builder.bold(true).textLine('BAR-SOLL').bold(false);
    builder.twoColumn('Bareinnahmen:', `${report.totalCash.toFixed(2)} EUR`);
    add(`Bareinnahmen: ${report.totalCash.toFixed(2)} EUR`);
    if (report.cashIn !== undefined) {
      builder.twoColumn('Wechselgeld-Einlage:', `+${report.cashIn.toFixed(2)} EUR`);
      add(`Wechselgeld-Einlage: +${report.cashIn.toFixed(2)} EUR`);
    }
    if (report.cashOut !== undefined) {
      builder.twoColumn('Entnahmen (Tresor):', `-${report.cashOut.toFixed(2)} EUR`);
      add(`Entnahmen (Tresor): -${report.cashOut.toFixed(2)} EUR`);
    }
    if (report.cashExpected !== undefined) {
      builder.bold(true).twoColumn('BAR-SOLL IN KASSE:', `${report.cashExpected.toFixed(2)} EUR`).bold(false);
      add(`BAR-SOLL IN KASSE: ${report.cashExpected.toFixed(2)} EUR`);
    }
    builder.divider();

    builder.bold(true).textLine('KARTENSPLITS').bold(false);
    builder.twoColumn('Karte gesamt:', `${report.totalCard.toFixed(2)} EUR`);
    add(`Karte gesamt: ${report.totalCard.toFixed(2)} EUR`);
    builder.twoColumn(' - SumUp:', `${(report.cardSumUp || 0).toFixed(2)} EUR`);
    builder.twoColumn(' - VR-Pay Me:', `${(report.cardVrPay || 0).toFixed(2)} EUR`);
    builder.twoColumn(' - Sparkasse / S-POS:', `${(report.cardSparkasse || 0).toFixed(2)} EUR`);
    builder.twoColumn(' - EC-Terminal (ZVT):', `${(report.cardTerminal || 0).toFixed(2)} EUR`);
    builder.divider();

    builder.bold(true).twoColumn('TRINKGELD:', `${report.totalTips.toFixed(2)} EUR`).bold(false);
    add(`TRINKGELD: ${report.totalTips.toFixed(2)} EUR`);
    if (report.totalStaff !== undefined) {
      builder.twoColumn('Freiverzehr / Personal:', `${report.totalStaff.toFixed(2)} EUR`);
    }
    if (report.totalDepositReturned !== undefined) {
      builder.twoColumn('Ausgezahlter Rueckpfand:', `-${report.totalDepositReturned.toFixed(2)} EUR`);
    }
    builder.twoColumn('Anzahl Belege:', `${report.transactionCount}`);
    add(`Anzahl Belege: ${report.transactionCount}`);

    builder.doubleDivider();
    builder.align('center').bold(true).textLine('*** KASSE BLEIBT GEOEFFNET ***').bold(false);
    add('*** KASSE BLEIBT GEOEFFNET ***');
    builder.cut();

    return { rawBuffer: builder.build(), textRepresentation: lines.join('\n') };
  }

  /**
   * Spec 6.8: Quittung fuer Geldbewegungen (Wechselgeld-Vorschuss / Tresorabgabe).
   */
  public static buildCashMovementTicket(
    data: {
      type: 'CASH_IN' | 'CASH_OUT';
      amount: number;
      reason: string;
      waiterName: string;
      eventName?: string;
      isTraining?: boolean;
      createdAt?: string | Date;
    },
    paperWidth = 80
  ): { rawBuffer: Buffer; textRepresentation: string } {
    const builder = new EscPosBuilder(paperWidth);
    const lines: string[] = [];
    const add = (t: string) => lines.push(t);

    const title = data.type === 'CASH_IN' ? 'WECHSELGELD-EINLAGE' : 'ENTNAHME / TRESORABGABE';

    if (data.isTraining) {
      builder.align('center').bold(true).invert(true).textLine(' *** UEBUNGSBON - KEINE BEZAHLUNG *** ').invert(false).bold(false);
      add('*** UEBUNGSBON - KEINE BEZAHLUNG ***');
    }

    builder.align('center').size(true, true).bold(true).textLine(title).size(false, false).bold(false);
    add(`[ ${title} ]`);
    if (data.eventName) {
      builder.textLine(data.eventName);
      add(data.eventName);
    }
    builder.doubleDivider();
    add('='.repeat(paperWidth === 58 ? 32 : 42));

    builder.align('left');
    builder.size(true, true).bold(true);
    builder.twoColumn('', `${data.type === 'CASH_IN' ? '+' : '-'}${data.amount.toFixed(2)} EUR`);
    builder.size(false, false).bold(false);
    add(`Betrag: ${data.type === 'CASH_IN' ? '+' : '-'}${data.amount.toFixed(2)} EUR`);

    builder.divider();
    builder.textLine(`Grund: ${data.reason}`);
    add(`Grund: ${data.reason}`);
    builder.textLine(`Bedienung: ${data.waiterName}`);
    add(`Bedienung: ${data.waiterName}`);
    const ts = data.createdAt ? new Date(data.createdAt) : new Date();
    builder.textLine(`Zeitpunkt: ${ts.toLocaleString('de-DE')}`);
    add(`Zeitpunkt: ${ts.toLocaleString('de-DE')}`);

    builder.lineFeed(2);
    builder.textLine('Unterschrift: ____________________________');
    builder.cut();

    return { rawBuffer: builder.build(), textRepresentation: lines.join('\n') };
  }

  /**
   * Beleg der Schichtabrechnung einer Bedienung.
   *
   * Die Zahlen kommen ausschliesslich aus der serverseitigen Berechnung
   * (/api/waiters/settle/report), damit Papierbeleg und Bildschirmansicht
   * niemals auseinanderlaufen koennen.
   */
  public static buildSettlementTicket(
    data: {
      waiterName: string;
      eventName?: string;
      isTraining?: boolean;
      settledAt?: string | Date;
      settledBy?: string;
      totalGross: number;
      transactionCount: number;
      byMethod: { label: string; amount: number }[];
      tipsTotal: number;
      tipWaiterShare: number;
      tipPoolShare: number;
      tipProfileName?: string | null;
      cashExpected: number;
      cashCounted: number;
      cashDifference: number;
      notes?: string;
    },
    paperWidth = 80
  ): { rawBuffer: Buffer; textRepresentation: string } {
    const builder = new EscPosBuilder(paperWidth);
    const lines: string[] = [];
    const add = (t: string) => lines.push(t);
    const money = (v: number) => `${v.toFixed(2)} EUR`;

    if (data.isTraining) {
      builder.align('center').bold(true).invert(true).textLine(' *** UEBUNGSBON *** ').invert(false).bold(false);
      add('*** UEBUNGSBON ***');
    }

    builder.align('center').size(true, true).bold(true).textLine('SCHICHTABRECHNUNG').size(false, false).bold(false);
    add('[ SCHICHTABRECHNUNG ]');
    if (data.eventName) {
      builder.textLine(data.eventName);
      add(data.eventName);
    }
    builder.doubleDivider();
    add('='.repeat(paperWidth === 58 ? 32 : 42));

    builder.align('left');
    builder.size(true, true).bold(true).textLine(data.waiterName).size(false, false).bold(false);
    add(`Bedienung: ${data.waiterName}`);
    const ts = data.settledAt ? new Date(data.settledAt) : new Date();
    builder.textLine(`Abgerechnet: ${ts.toLocaleString('de-DE')}`);
    add(`Abgerechnet: ${ts.toLocaleString('de-DE')}`);
    if (data.settledBy) {
      builder.textLine(`Aufgenommen von: ${data.settledBy}`);
      add(`Aufgenommen von: ${data.settledBy}`);
    }

    // --- Umsatz nach Zahlart
    builder.divider();
    builder.bold(true).textLine('UMSATZ NACH ZAHLART').bold(false);
    add('-- Umsatz nach Zahlart --');
    for (const m of data.byMethod) {
      builder.twoColumn(m.label, money(m.amount));
      add(`${m.label}: ${money(m.amount)}`);
    }
    builder.divider();
    builder.bold(true);
    builder.twoColumn('GESAMTUMSATZ', money(data.totalGross));
    builder.bold(false);
    add(`GESAMTUMSATZ: ${money(data.totalGross)}`);
    builder.twoColumn('Vorgaenge', String(data.transactionCount));
    add(`Vorgaenge: ${data.transactionCount}`);

    // --- Trinkgeld
    builder.divider();
    builder.bold(true).textLine('TRINKGELD').bold(false);
    add('-- Trinkgeld --');
    builder.twoColumn('Gesamt', money(data.tipsTotal));
    add(`Trinkgeld gesamt: ${money(data.tipsTotal)}`);
    builder.twoColumn('davon Bedienung', money(data.tipWaiterShare));
    add(`davon Bedienung: ${money(data.tipWaiterShare)}`);
    builder.twoColumn('davon Team-Pool', money(data.tipPoolShare));
    add(`davon Team-Pool: ${money(data.tipPoolShare)}`);
    if (data.tipProfileName) {
      builder.textLine(`Verteilung nach: ${data.tipProfileName}`);
      add(`Verteilung nach: ${data.tipProfileName}`);
    }

    // --- Kassensturz
    builder.doubleDivider();
    builder.bold(true).textLine('KASSENSTURZ').bold(false);
    add('== Kassensturz ==');
    builder.twoColumn('Soll-Barbestand', money(data.cashExpected));
    add(`Soll-Barbestand: ${money(data.cashExpected)}`);
    builder.twoColumn('Gezaehlt', money(data.cashCounted));
    add(`Gezaehlt: ${money(data.cashCounted)}`);
    builder.size(true, true).bold(true);
    const diffLabel = data.cashDifference >= 0 ? 'UEBERSCHUSS' : 'FEHLBETRAG';
    builder.twoColumn('', `${data.cashDifference >= 0 ? '+' : ''}${data.cashDifference.toFixed(2)}`);
    builder.size(false, false).bold(false);
    builder.textLine(diffLabel);
    add(`DIFFERENZ: ${data.cashDifference >= 0 ? '+' : ''}${money(data.cashDifference)} (${diffLabel})`);

    if (data.notes) {
      builder.divider();
      builder.textLine(`Bemerkung: ${data.notes}`);
      add(`Bemerkung: ${data.notes}`);
    }

    builder.lineFeed(2);
    builder.textLine('Bedienung: ____________________________');
    builder.lineFeed(1);
    builder.textLine('Kassenleitung: ________________________');
    builder.cut();

    return { rawBuffer: builder.build(), textRepresentation: lines.join('\n') };
  }

  // 3. Official Z-Bon Tagesabschluss Report Ticket
  public static buildZBonTicket(
    report: ZBonReport,
    paperWidth = 80
  ): { rawBuffer: Buffer; textRepresentation: string } {
    const builder = new EscPosBuilder(paperWidth);

    builder.align('center').bold(true).textLine('========================================');
    builder.size(true, true).bold(true).textLine('Z-BON TAGESABSCHLUSS').size(false, false).bold(false);
    builder.textLine('OpenBon Kassensystem');
    if (report.periodNumber !== undefined) {
      builder.bold(true).textLine(`Kassenperiode Z-${String(report.periodNumber).padStart(4, '0')}`).bold(false);
    }
    if (report.openedAt) {
      builder.textLine(`Eroeffnet: ${new Date(report.openedAt).toLocaleString('de-DE')}`);
    }
    builder.textLine(`Abschluss: ${new Date(report.closedAt || Date.now()).toLocaleString('de-DE')}`);
    builder.doubleDivider();

    builder.align('left');
    builder.size(true, false).bold(true).twoColumn('GESAMTUMSATZ BRUTTO:', `${(report.totalGross || 0).toFixed(2)} EUR`).size(false, false).bold(false);
    builder.twoColumn('Gesamtumsatz Netto:', `${(report.totalNet || 0).toFixed(2)} EUR`);
    builder.divider('.');
    builder.bold(true).textLine('MWST-AUFSCHLUESSELUNG:').bold(false);
    if (Array.isArray(report.taxSplits) && report.taxSplits.length > 0) {
      for (const split of report.taxSplits) {
        builder.twoColumn(
          `${Number(split.rate).toFixed(0)}% auf ${Number(split.base).toFixed(2)}`,
          `${Number(split.tax).toFixed(2)} EUR`
        );
      }
    } else {
      builder.twoColumn('MwSt 19%:', `${(report.totalTax19 || 0).toFixed(2)} EUR`);
      builder.twoColumn('MwSt 7%:', `${(report.totalTax7 || 0).toFixed(2)} EUR`);
      builder.twoColumn('Steuerfrei (Pfand):', `${(report.taxBase0 || 0).toFixed(2)} EUR`);
    }
    builder.divider();

    builder.bold(true).textLine('ZAHLUNGSARTEN:').bold(false);
    builder.twoColumn('Bargeld (Kassenbestand):', `${(report.totalCash || 0).toFixed(2)} EUR`);
    builder.twoColumn('Kartenzahlung Gesamt:', `${(report.totalCard || 0).toFixed(2)} EUR`);
    if (report.paymentSplit) {
      builder.twoColumn(' - davon SumUp:', `${(report.paymentSplit.cardSumUp || 0).toFixed(2)} EUR`);
      builder.twoColumn(' - davon VR-Pay Me:', `${(report.paymentSplit.cardVrPay || 0).toFixed(2)} EUR`);
      builder.twoColumn(' - davon Sparkasse:', `${(report.paymentSplit.cardSparkasse || 0).toFixed(2)} EUR`);
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

    // Spec 6.8: Kassenbuch-Block
    builder.divider();
    builder.bold(true).textLine('KASSENBUCH / GELDBEWEGUNGEN:').bold(false);
    builder.twoColumn('Wechselgeld-Einlagen:', `+${(report.cashIn || 0).toFixed(2)} EUR`);
    builder.twoColumn('Entnahmen (Tresor):', `-${(report.cashOut || 0).toFixed(2)} EUR`);
    builder.bold(true).twoColumn('BAR-SOLL IN KASSE:', `${(report.cashExpected || 0).toFixed(2)} EUR`).bold(false);
    if (report.cashCounted !== undefined && report.cashCounted !== null) {
      builder.twoColumn('Gezaehlt (Ist):', `${Number(report.cashCounted).toFixed(2)} EUR`);
      builder.bold(true).twoColumn('DIFFERENZ:', `${Number(report.cashDifference || 0).toFixed(2)} EUR`).bold(false);
    }

    builder.doubleDivider();
    if (report.fiscalSignature) {
      builder.align('center').textLine('FISKALBLOCK (HMAC-SHA256)');
      const sig = String(report.fiscalSignature);
      for (let i = 0; i < sig.length; i += 32) {
        builder.textLine(sig.slice(i, i + 32));
      }
      builder.doubleDivider();
    }
    builder.align('center').textLine('*** TAGESABSCHLUSS ERFOLGREICH ***');
    builder.textLine('*** ZAEHLER ZURUECKGESETZT ***');
    builder.cut();

    return {
      rawBuffer: builder.build(),
      textRepresentation: `Z-BON TAGESABSCHLUSS - ${(report.totalGross || 0).toFixed(2)} EUR`,
    };
  }
}
