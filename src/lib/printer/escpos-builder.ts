import iconv from 'iconv-lite';
import { TicketData, PrintItem } from './types';
import type { TaxSplit } from '@/types/domain';

// ESC/POS Command Constants
const ESC = 0x1b;
const GS = 0x1d;

/**
 * Cent-Helfer fuer die Drucker-Schicht: gerechnet wird in Int-Cent,
 * formatiert wird erst beim Druck (cents/100, de-DE mit EUR-Suffix).
 */
function centsOf(cents: number | null | undefined, legacyEuro: number | null | undefined): number {
  if (typeof cents === 'number') return Math.round(cents);
  if (typeof legacyEuro === 'number') return Math.round((legacyEuro + Number.EPSILON) * 100);
  return 0;
}

function fmtCents(cents: number | null | undefined, legacyEuro?: number | null | undefined): string {
  return `${(centsOf(cents, legacyEuro) / 100).toFixed(2)} EUR`;
}

function itemUnitCents(item: PrintItem): number {
  return centsOf(item.unitPriceCents, item.unitPrice);
}

function itemDepositCents(item: PrintItem): number {
  return centsOf(item.depositCents, item.deposit);
}

function splitBaseCents(s: TaxSplit): number {
  return Math.round(s.baseCents ?? Math.round(((s.base ?? 0) + Number.EPSILON) * 100));
}

function splitTaxCents(s: TaxSplit): number {
  return Math.round(s.taxCents ?? Math.round(((s.tax ?? 0) + Number.EPSILON) * 100));
}

export interface ZBonWaiterLine {
  waiterName: string;
  totalGrossCents?: number;
  cashGrossCents?: number;
  cardGrossCents?: number;
  tipsCents?: number;
  transactionCount?: number;
  /** @deprecated Legacy Euro */
  totalGross?: number;
  /** @deprecated Legacy Euro */
  cashGross?: number;
  /** @deprecated Legacy Euro */
  cardGross?: number;
  /** @deprecated Legacy Euro */
  tips?: number;
}

export interface ZBonReport {
  periodNumber?: number;
  openedAt?: string | Date;
  closedAt?: string | Date;
  totalGrossCents?: number;
  totalNetCents?: number;
  totalTax19Cents?: number;
  totalTax7Cents?: number;
  taxBase0Cents?: number;
  taxSplits?: TaxSplit[];
  totalCashCents?: number;
  totalCardCents?: number;
  paymentSplit?: {
    cardSumUpCents?: number;
    cardVrPayCents?: number;
    cardSparkasseCents?: number;
    cardTerminalCents?: number;
    /** @deprecated Legacy Euro */
    cardSumUp?: number;
    /** @deprecated Legacy Euro */
    cardVrPay?: number;
    /** @deprecated Legacy Euro */
    cardSparkasse?: number;
    /** @deprecated Legacy Euro */
    cardTerminal?: number;
  };
  totalStaffCents?: number;
  totalSurchargesCents?: number;
  totalDepositReturnedCents?: number;
  totalTipsCents?: number;
  transactionCount?: number;
  cashInCents?: number;
  cashOutCents?: number;
  cashExpectedCents?: number;
  cashCountedCents?: number | null;
  cashDifferenceCents?: number | null;
  /** @deprecated Legacy Euro */
  totalGross?: number;
  /** @deprecated Legacy Euro */
  totalNet?: number;
  /** @deprecated Legacy Euro */
  totalTax19?: number;
  /** @deprecated Legacy Euro */
  totalTax7?: number;
  /** @deprecated Legacy Euro */
  taxBase0?: number;
  /** @deprecated Legacy Euro */
  totalCash?: number;
  /** @deprecated Legacy Euro */
  totalCard?: number;
  /** @deprecated Legacy Euro */
  totalStaff?: number;
  /** @deprecated Legacy Euro */
  totalSurcharges?: number;
  /** @deprecated Legacy Euro */
  totalDepositReturned?: number;
  /** @deprecated Legacy Euro */
  totalTips?: number;
  /** @deprecated Legacy Euro */
  cashIn?: number;
  /** @deprecated Legacy Euro */
  cashOut?: number;
  /** @deprecated Legacy Euro */
  cashExpected?: number;
  /** @deprecated Legacy Euro */
  cashCounted?: number | null;
  /** @deprecated Legacy Euro */
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

  /**
   * M4.3 Entfernt ESC/POS-Steuerbytes aus nutzerkontrollierten Texten.
   * Sonst koennte z. B. ein Produktname Steuersequenzen einschleusen und den
   * Druckerzustand (Schneiden, Farbe, Groesse, Kassenlade) unbefugt schalten.
   * Erlaubt bleibt der Zeilenvorschub (0x0a) innerhalb eines Strings.
   */
  public static sanitizeText(str: string): string {
    return String(str ?? '')
      .replace(/\r\n/g, '\n')
      .replace(/[\u0000-\u0009\u000b-\u001f]/g, '') // alle C0-Steuerzeichen ausser \n
      .replace(/\u007f/g, ''); // DEL
  }

  public text(str: string): this {
    try {
      const encoded = iconv.encode(EscPosBuilder.sanitizeText(str), this.encoding);
      this.buffer.push(encoded);
    } catch {
      this.buffer.push(Buffer.from(EscPosBuilder.sanitizeText(str), 'latin1'));
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
    let clean = (tableLabel || '').trim();
    if (!clean.toLowerCase().startsWith('tisch')) {
      clean = `Tisch ${clean}`;
    }

    builder.align('center');
    // Keine Schwarz-Hinterlegung mehr; echte Skalierung bis zur vollen Bonbreite
    if (fs >= 10) {
      builder.charSize(6, 6).bold(true).textLine(clean).resetCharSize().bold(false);
    } else if (fs >= 9) {
      builder.charSize(5, 5).bold(true).textLine(clean).resetCharSize().bold(false);
    } else if (fs >= 8) {
      builder.charSize(4, 4).bold(true).textLine(clean).resetCharSize().bold(false);
    } else if (fs >= 7) {
      builder.charSize(3, 4).bold(true).textLine(clean).resetCharSize().bold(false);
    } else if (fs >= 6) {
      builder.charSize(3, 3).bold(true).textLine(clean).resetCharSize().bold(false);
    } else if (fs >= 5) {
      builder.charSize(2, 3).bold(true).textLine(clean).resetCharSize().bold(false);
    } else if (fs >= 4) {
      builder.charSize(2, 2).bold(true).textLine(clean).resetCharSize().bold(false);
    } else if (fs >= 3 || fontSize === 'EXTRA_LARGE') {
      builder.charSize(1, 2).bold(true).textLine(clean).resetCharSize().bold(false);
    } else if (fs >= 2 || fontSize === 'LARGE') {
      builder.charSize(1, 1).bold(true).textLine(clean).resetCharSize().bold(false);
    } else {
      builder.charSize(1, 1).textLine(clean).resetCharSize();
    }
    builder.align('left');
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

    // Küche / Ausschank Überschrift wird nicht auf Speisen/Getränkebons gedruckt
    const isKitchenOrDrinkHeader = /kueche|küche|ausschank|theke|grill/i.test(data.title || '');
    if (data.title && !isKitchenOrDrinkHeader) {
      builder.align('center').size(true, true).bold(true).textLine(data.title).size(false, false).bold(false);
      addText(`[ ${data.title} ]`);
    }

    // Spec 6.1: Kopfzeile des Tablett-Splits
    if (data.traySplit) {
      const header = `*** BON ${data.traySplit.index} von ${data.traySplit.total} (${data.traySplit.summary}) ***`;
      builder.align('center').bold(true).textLine(header).bold(false);
      addText(header);
    }

    if (data.eventName) {
      builder.align('center').bold(true).textLine(data.eventName).bold(false);
      addText(data.eventName);
    }
    if (data.subHeader) {
      builder.align('center').textLine(data.subHeader);
      addText(data.subHeader);
    }
    if (data.customHeader) {
      builder.align('center').textLine(data.customHeader);
      addText(data.customHeader);
    }
    if (data.template === 'GASTRO') {
      if (data.addressStreet && data.addressCity) {
        const addr = `${data.addressStreet} · ${data.addressCity}`;
        builder.align('center').textLine(addr);
        addText(addr);
      }
      const taxLine = [data.taxNumber ? `St.-Nr: ${data.taxNumber}` : '', data.vatId ? `USt-ID: ${data.vatId}` : ''].filter(Boolean).join(' · ');
      if (taxLine) {
        builder.align('center').textLine(taxLine);
        addText(taxLine);
      }
    }

    const isEco = data.template === 'ECO';
    if (!isEco) {
      builder.doubleDivider();
      addText('='.repeat(paperWidth === 58 ? 32 : 42));
    }

    builder.align('left');
    if (data.tokenNumber) {
      builder.size(true, true).bold(true).align('center').textLine(`ABHOL-NR: #${data.tokenNumber}`).size(false, false).bold(false).align('left');
      addText(`ABHOL-NR: #${data.tokenNumber}`);
    }

    if (data.tableLabel) {
      const parsedSize = Number(data.tableFontSize) || 2;
      EscPosBuilder.formatTableNumber(builder, data.tableLabel, isEco ? Math.min(3, parsedSize) : parsedSize);
      addText(`Tisch: ${data.tableLabel}`);
    }

    const dateStr = data.createdAt ? new Date(data.createdAt).toLocaleString('de-DE') : new Date().toLocaleString('de-DE');
    if (isEco) {
      // Kompakte Einzeilen-Metadaten für minimale Papierlänge
      builder.twoColumn(`${data.waiterName || 'Kasse'}`, dateStr);
      addText(`${data.waiterName || 'Kasse'} · ${dateStr}`);
      if (data.invoiceNumber || data.orderNumber) {
        builder.twoColumn(data.orderNumber ? `Bon #${data.orderNumber}` : '', data.invoiceNumber ? `Nr: ${data.invoiceNumber}` : '');
      }
    } else {
      builder.bold(true).twoColumn(`Bedienung: ${data.waiterName || 'Kasse'}`, data.orderNumber ? `Bon #${data.orderNumber}` : '').bold(false);
      addText(`Bedienung: ${data.waiterName || 'Kasse'} ${data.orderNumber ? `| Bon #${data.orderNumber}` : ''}`);

      builder.textLine(`Datum: ${dateStr}`);
      addText(`Datum: ${dateStr}`);

      if (data.invoiceNumber) {
        builder.textLine(`Beleg-Nr: ${data.invoiceNumber}`);
        addText(`Beleg-Nr: ${data.invoiceNumber}`);
      }
    }

    builder.divider();
    addText('-'.repeat(paperWidth === 58 ? 32 : 42));

    // Spec 6.5: Positionen nach Gang gruppiert drucken
    const hasCourses = data.items.some((i) => (i.courseNumber ?? 1) > 1);
    const sortedItems = hasCourses
      ? [...data.items].sort((a, b) => (a.courseNumber ?? 1) - (b.courseNumber ?? 1))
      : data.items;
    let lastCourse = 0;

    const itemFs = typeof data.itemFontSize === 'number' ? data.itemFontSize : parseInt(String(data.itemFontSize || 2), 10) || 2;
    const optFs = typeof data.optionsFontSize === 'number' ? data.optionsFontSize : parseInt(String(data.optionsFontSize || 1), 10) || 1;
    // Optionen wachsen relativ mit der Artikelgröße mit
    const effectiveOptFs = Math.max(optFs, Math.min(8, Math.floor(itemFs * 0.8)));

    for (const item of sortedItems) {
      if (hasCourses && (item.courseNumber ?? 1) !== lastCourse) {
        lastCourse = item.courseNumber ?? 1;
        builder.bold(true).invert(true).textLine(` GANG ${lastCourse} `).invert(false).bold(false);
        addText(`--- GANG ${lastCourse} ---`);
      }

      const displayName = item.alternativeName || item.name;
      const unitCents = itemUnitCents(item);
      const priceStr = `${((unitCents * item.quantity) / 100).toFixed(2)} EUR`;

      // Item Size scaling (Stufen 1-10)
      if (itemFs >= 8) {
        builder.charSize(3, 3).bold(true);
      } else if (itemFs >= 6) {
        builder.charSize(2, 2).bold(true);
      } else if (itemFs >= 4) {
        builder.charSize(1, 2).bold(true);
      } else if (itemFs >= 2) {
        builder.bold(true);
      }

      builder.twoColumn(`${item.quantity}x ${displayName}`, priceStr);
      builder.resetCharSize().bold(false);
      addText(`${item.quantity}x ${displayName}   ${priceStr}`);

      // Options & Details scaling (relativ zur Artikelgröße)
      if (effectiveOptFs >= 6) {
        builder.charSize(2, 2).bold(true);
      } else if (effectiveOptFs >= 4) {
        builder.charSize(1, 2).bold(true);
      } else if (effectiveOptFs >= 2) {
        builder.bold(true);
      }

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

      if (effectiveOptFs >= 2) {
        builder.resetCharSize().bold(false);
      }

      const depCents = itemDepositCents(item);
      if (depCents > 0) {
        builder.textLine(`   inkl. Pfand: ${((depCents * item.quantity) / 100).toFixed(2)} EUR`);
        addText(`   inkl. Pfand: ${((depCents * item.quantity) / 100).toFixed(2)} EUR`);
      }
    }

    builder.divider();
    addText('-'.repeat(paperWidth === 58 ? 32 : 42));

    const hasTotal = data.totalGrossCents !== undefined || data.totalGross !== undefined;
    if (hasTotal) {
      builder.size(true, false).bold(true).twoColumn('GESAMTBETRAG:', fmtCents(data.totalGrossCents, data.totalGross)).size(false, false).bold(false);
      addText(`GESAMTBETRAG: ${fmtCents(data.totalGrossCents, data.totalGross)}`);

      const returnDepCents = centsOf(data.returnDepositCents, data.returnDeposit);
      if (returnDepCents > 0) {
        builder.twoColumn('abzgl. Rueckpfand:', `-${(returnDepCents / 100).toFixed(2)} EUR`);
        addText(`abzgl. Rueckpfand: -${(returnDepCents / 100).toFixed(2)} EUR`);
      }

      const discountCentsVal = centsOf(data.discountCents, data.discountAmount);
      if (discountCentsVal > 0) {
        builder.twoColumn('abzgl. Rabatt:', `-${(discountCentsVal / 100).toFixed(2)} EUR`);
        addText(`abzgl. Rabatt: -${(discountCentsVal / 100).toFixed(2)} EUR`);
      }

      const surchargeCentsVal = centsOf(data.surchargeAmountCents, data.surchargeAmount);
      if (surchargeCentsVal > 0) {
        builder.twoColumn(`zzgl. ${data.surchargeReason || 'Aufschlag'}:`, `+${(surchargeCentsVal / 100).toFixed(2)} EUR`);
        addText(`zzgl. ${data.surchargeReason || 'Aufschlag'}: +${(surchargeCentsVal / 100).toFixed(2)} EUR`);
      }

      if (data.paymentMethod) {
        builder.twoColumn('Zahlart:', data.paymentMethod);
        addText(`Zahlart: ${data.paymentMethod}`);
      }

      if (data.cardAuthCode) {
        builder.twoColumn('Autorisierung:', data.cardAuthCode);
        addText(`Autorisierung: ${data.cardAuthCode}`);
      }

      const givenCentsVal = centsOf(data.givenCents, data.givenAmount);
      if (givenCentsVal > 0) {
        const changeCentsVal = centsOf(data.changeCents, data.changeAmount);
        builder.twoColumn('Gegeben:', `${(givenCentsVal / 100).toFixed(2)} EUR`);
        builder.twoColumn('Rueckgeld:', `${(changeCentsVal / 100).toFixed(2)} EUR`);
        addText(`Gegeben: ${(givenCentsVal / 100).toFixed(2)} EUR  |  Rueckgeld: ${(changeCentsVal / 100).toFixed(2)} EUR`);
      }

      const tipCentsVal = centsOf(data.tipCents, data.tipAmount);
      if (tipCentsVal > 0) {
        builder.twoColumn('davon Trinkgeld:', `${(tipCentsVal / 100).toFixed(2)} EUR`);
        addText(`davon Trinkgeld: ${(tipCentsVal / 100).toFixed(2)} EUR`);
      }

      // Spec 6.7: MwSt-Splits (19 % / 7 % / 0 %) statt pauschaler 19 % (nur wenn enableTax aktiv)
      if (data.enableTax !== false) {
        if (data.taxSplits && data.taxSplits.length > 0) {
          builder.divider('.');
          addText('.'.repeat(paperWidth === 58 ? 32 : 42));
          builder.bold(true).textLine('MWST-AUFSCHLUESSELUNG').bold(false);
          addText('MWST-AUFSCHLUESSELUNG');
          for (const split of data.taxSplits) {
            const baseC = splitBaseCents(split);
            const taxC = splitTaxCents(split);
            const label = `${split.rate.toFixed(0)}% auf ${(baseC / 100).toFixed(2)}`;
            builder.twoColumn(label, `${(taxC / 100).toFixed(2)} EUR`);
            addText(`${label}  ${(taxC / 100).toFixed(2)} EUR`);
          }
          builder.twoColumn('Netto gesamt:', fmtCents(data.totalNetCents, data.totalNet));
          addText(`Netto gesamt: ${fmtCents(data.totalNetCents, data.totalNet)}`);
        } else if (data.totalNetCents !== undefined || data.totalNet !== undefined || data.totalTaxCents !== undefined || data.totalTax !== undefined) {
          builder.divider('.');
          builder.twoColumn('Netto:', fmtCents(data.totalNetCents, data.totalNet));
          builder.twoColumn('MwSt (enthalten):', fmtCents(data.totalTaxCents, data.totalTax));
        }
      }
    }

    // M6.6: E-Bon-QR auf dem Papierbon (nur wenn Server den Link mitschickt)
    if (data.qrUrl && data.showQr !== false && hasTotal) {
      builder.lineFeed(1);
      builder.align('center').qrCode(data.qrUrl, paperWidth === 58 ? 5 : 7);
      builder.align('center').bold(true).textLine('E-BON ONLINE ABRUFBAR').bold(false);
      builder.textLine('QR-Code scannen und Beleg auf dem Handy ansehen');
      addText(`[QR] E-Bon: ${data.qrUrl}`);
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
      fontSize?: number;
      qrSize?: number;
      noteText?: string;
    },
    paperWidth = 80
  ): { rawBuffer: Buffer; textRepresentation: string } {
    const builder = new EscPosBuilder(paperWidth);
    const label = data.label || `Tisch ${data.tableNumber}`;
    const textLines: string[] = [];

    builder.align('center');
    if (data.eventName) {
      builder.bold(true).textLine(data.eventName).bold(false);
      textLines.push(data.eventName);
    }

    builder.doubleDivider();
    textLines.push('='.repeat(paperWidth === 58 ? 32 : 42));

    const fs = data.fontSize ?? 4;
    // Tischbeschriftung ohne Schwarz-Hinterlegung, skalierbar bis zur vollen Breite
    if (fs >= 10) {
      builder.charSize(6, 6).bold(true).textLine(label.toUpperCase()).resetCharSize().bold(false);
    } else if (fs >= 8) {
      builder.charSize(5, 5).bold(true).textLine(label.toUpperCase()).resetCharSize().bold(false);
    } else if (fs >= 6) {
      builder.charSize(4, 4).bold(true).textLine(label.toUpperCase()).resetCharSize().bold(false);
    } else if (fs >= 4) {
      builder.charSize(3, 3).bold(true).textLine(label.toUpperCase()).resetCharSize().bold(false);
    } else if (fs >= 2) {
      builder.charSize(2, 2).bold(true).textLine(label.toUpperCase()).resetCharSize().bold(false);
    } else {
      builder.charSize(1, 1).bold(true).textLine(label.toUpperCase()).resetCharSize().bold(false);
    }
    textLines.push(`[ ${label.toUpperCase()} ]`);

    builder.doubleDivider();
    textLines.push('='.repeat(paperWidth === 58 ? 32 : 42));

    if (data.qrUrl) {
      const qrModule = Math.max(2, Math.min(paperWidth === 58 ? 8 : 12, Math.round((data.qrSize ?? 5) * (paperWidth === 58 ? 0.8 : 1.1))));
      builder.lineFeed(1);
      builder.align('center').qrCode(data.qrUrl, qrModule);
      builder.lineFeed(1);
      textLines.push(`QR-Code: ${data.qrUrl}`);
    }

    if (data.noteText) {
      builder.align('center').textLine(data.noteText);
      textLines.push(data.noteText);
    } else if (data.qrUrl) {
      builder.align('center').bold(true).textLine('HIER MIT DEM HANDY SCANNEN').bold(false);
      builder.textLine('und direkt am Tisch bestellen');
      textLines.push('HIER MIT DEM HANDY SCANNEN und direkt am Tisch bestellen');
    }

    builder.lineFeed(2);
    builder.cut();

    return {
      rawBuffer: builder.build(),
      textRepresentation: textLines.join('\n'),
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
      totalGrossCents?: number;
      totalCashCents?: number;
      totalCardCents?: number;
      cardSumUpCents?: number;
      cardVrPayCents?: number;
      cardSparkasseCents?: number;
      cardTerminalCents?: number;
      totalTipsCents?: number;
      totalDepositReturnedCents?: number;
      totalStaffCents?: number;
      cashInCents?: number;
      cashOutCents?: number;
      cashExpectedCents?: number;
      transactionCount: number;
      isTraining?: boolean;
      /** @deprecated Legacy Euro */
      totalGross?: number;
      /** @deprecated Legacy Euro */
      totalCash?: number;
      /** @deprecated Legacy Euro */
      totalCard?: number;
      /** @deprecated Legacy Euro */
      cardSumUp?: number;
      /** @deprecated Legacy Euro */
      cardVrPay?: number;
      /** @deprecated Legacy Euro */
      cardSparkasse?: number;
      /** @deprecated Legacy Euro */
      cardTerminal?: number;
      /** @deprecated Legacy Euro */
      totalTips?: number;
      /** @deprecated Legacy Euro */
      totalDepositReturned?: number;
      /** @deprecated Legacy Euro */
      totalStaff?: number;
      /** @deprecated Legacy Euro */
      cashIn?: number;
      /** @deprecated Legacy Euro */
      cashOut?: number;
      /** @deprecated Legacy Euro */
      cashExpected?: number;
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
    builder.size(true, false).bold(true).twoColumn('SCHICHT-UMSATZ:', fmtCents(report.totalGrossCents, report.totalGross)).size(false, false).bold(false);
    add(`SCHICHT-UMSATZ: ${fmtCents(report.totalGrossCents, report.totalGross)}`);
    builder.divider();

    builder.bold(true).textLine('BAR-SOLL').bold(false);
    builder.twoColumn('Bareinnahmen:', fmtCents(report.totalCashCents, report.totalCash));
    add(`Bareinnahmen: ${fmtCents(report.totalCashCents, report.totalCash)}`);
    if (report.cashInCents !== undefined || report.cashIn !== undefined) {
      const ci = centsOf(report.cashInCents, report.cashIn);
      builder.twoColumn('Wechselgeld-Einlage:', `+${(ci / 100).toFixed(2)} EUR`);
      add(`Wechselgeld-Einlage: +${(ci / 100).toFixed(2)} EUR`);
    }
    if (report.cashOutCents !== undefined || report.cashOut !== undefined) {
      const co = centsOf(report.cashOutCents, report.cashOut);
      builder.twoColumn('Entnahmen (Tresor):', `-${(co / 100).toFixed(2)} EUR`);
      add(`Entnahmen (Tresor): -${(co / 100).toFixed(2)} EUR`);
    }
    if (report.cashExpectedCents !== undefined || report.cashExpected !== undefined) {
      builder.bold(true).twoColumn('BAR-SOLL IN KASSE:', fmtCents(report.cashExpectedCents, report.cashExpected)).bold(false);
      add(`BAR-SOLL IN KASSE: ${fmtCents(report.cashExpectedCents, report.cashExpected)}`);
    }
    builder.divider();

    builder.bold(true).textLine('KARTENSPLITS').bold(false);
    builder.twoColumn('Karte gesamt:', fmtCents(report.totalCardCents, report.totalCard));
    add(`Karte gesamt: ${fmtCents(report.totalCardCents, report.totalCard)}`);
    builder.twoColumn(' - SumUp:', fmtCents(report.cardSumUpCents, report.cardSumUp));
    builder.twoColumn(' - VR-Pay Me:', fmtCents(report.cardVrPayCents, report.cardVrPay));
    builder.twoColumn(' - Sparkasse / S-POS:', fmtCents(report.cardSparkasseCents, report.cardSparkasse));
    builder.twoColumn(' - EC-Terminal (ZVT):', fmtCents(report.cardTerminalCents, report.cardTerminal));
    builder.divider();

    builder.bold(true).twoColumn('TRINKGELD:', fmtCents(report.totalTipsCents, report.totalTips)).bold(false);
    add(`TRINKGELD: ${fmtCents(report.totalTipsCents, report.totalTips)}`);
    if (report.totalStaffCents !== undefined || report.totalStaff !== undefined) {
      builder.twoColumn('Freiverzehr / Personal:', fmtCents(report.totalStaffCents, report.totalStaff));
    }
    if (report.totalDepositReturnedCents !== undefined || report.totalDepositReturned !== undefined) {
      const dr = centsOf(report.totalDepositReturnedCents, report.totalDepositReturned);
      builder.twoColumn('Ausgezahlter Rueckpfand:', `-${(dr / 100).toFixed(2)} EUR`);
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
      amountCents: number;
      reason: string;
      waiterName: string;
      eventName?: string;
      isTraining?: boolean;
      createdAt?: string | Date;
      /** @deprecated Legacy Euro */
      amount?: number;
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
    const moveCents = centsOf(data.amountCents, data.amount);
    builder.twoColumn('', `${data.type === 'CASH_IN' ? '+' : '-'}${(moveCents / 100).toFixed(2)} EUR`);
    builder.size(false, false).bold(false);
    add(`Betrag: ${data.type === 'CASH_IN' ? '+' : '-'}${(moveCents / 100).toFixed(2)} EUR`);

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
      totalGrossCents: number;
      transactionCount: number;
      byMethod: { label: string; amountCents: number; amount?: number }[];
      tipsTotalCents: number;
      tipWaiterShareCents: number;
      tipPoolShareCents: number;
      tipProfileName?: string | null;
      cashExpectedCents: number;
      cashCountedCents: number;
      cashDifferenceCents: number;
      notes?: string;
      /** @deprecated Legacy Euro */
      totalGross?: number;
      /** @deprecated Legacy Euro */
      tipsTotal?: number;
      /** @deprecated Legacy Euro */
      tipWaiterShare?: number;
      /** @deprecated Legacy Euro */
      tipPoolShare?: number;
      /** @deprecated Legacy Euro */
      cashExpected?: number;
      /** @deprecated Legacy Euro */
      cashCounted?: number;
      /** @deprecated Legacy Euro */
      cashDifference?: number;
    },
    paperWidth = 80
  ): { rawBuffer: Buffer; textRepresentation: string } {
    const builder = new EscPosBuilder(paperWidth);
    const lines: string[] = [];
    const add = (t: string) => lines.push(t);
    const money = (cents: number | undefined, legacy?: number) => fmtCents(cents, legacy);

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
      builder.twoColumn(m.label, money(m.amountCents, m.amount));
      add(`${m.label}: ${money(m.amountCents, m.amount)}`);
    }
    builder.divider();
    builder.bold(true);
    builder.twoColumn('GESAMTUMSATZ', money(data.totalGrossCents, data.totalGross));
    builder.bold(false);
    add(`GESAMTUMSATZ: ${money(data.totalGrossCents, data.totalGross)}`);
    builder.twoColumn('Vorgaenge', String(data.transactionCount));
    add(`Vorgaenge: ${data.transactionCount}`);

    // --- Trinkgeld
    builder.divider();
    builder.bold(true).textLine('TRINKGELD').bold(false);
    add('-- Trinkgeld --');
    builder.twoColumn('Gesamt', money(data.tipsTotalCents, data.tipsTotal));
    add(`Trinkgeld gesamt: ${money(data.tipsTotalCents, data.tipsTotal)}`);
    builder.twoColumn('davon Bedienung', money(data.tipWaiterShareCents, data.tipWaiterShare));
    add(`davon Bedienung: ${money(data.tipWaiterShareCents, data.tipWaiterShare)}`);
    builder.twoColumn('davon Team-Pool', money(data.tipPoolShareCents, data.tipPoolShare));
    add(`davon Team-Pool: ${money(data.tipPoolShareCents, data.tipPoolShare)}`);
    if (data.tipProfileName) {
      builder.textLine(`Verteilung nach: ${data.tipProfileName}`);
      add(`Verteilung nach: ${data.tipProfileName}`);
    }

    // --- Kassensturz
    builder.doubleDivider();
    builder.bold(true).textLine('KASSENSTURZ').bold(false);
    add('== Kassensturz ==');
    builder.twoColumn('Soll-Barbestand', money(data.cashExpectedCents, data.cashExpected));
    add(`Soll-Barbestand: ${money(data.cashExpectedCents, data.cashExpected)}`);
    builder.twoColumn('Gezaehlt', money(data.cashCountedCents, data.cashCounted));
    add(`Gezaehlt: ${money(data.cashCountedCents, data.cashCounted)}`);
    builder.size(true, true).bold(true);
    const diffCents = centsOf(data.cashDifferenceCents, data.cashDifference);
    const diffLabel = diffCents >= 0 ? 'UEBERSCHUSS' : 'FEHLBETRAG';
    builder.twoColumn('', `${diffCents >= 0 ? '+' : ''}${(diffCents / 100).toFixed(2)}`);
    builder.size(false, false).bold(false);
    builder.textLine(diffLabel);
    add(`DIFFERENZ: ${diffCents >= 0 ? '+' : ''}${money(data.cashDifferenceCents, data.cashDifference)} (${diffLabel})`);

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
    builder.size(true, false).bold(true).twoColumn('GESAMTUMSATZ BRUTTO:', fmtCents(report.totalGrossCents, report.totalGross)).size(false, false).bold(false);
    builder.twoColumn('Gesamtumsatz Netto:', fmtCents(report.totalNetCents, report.totalNet));
    builder.divider('.');
    builder.bold(true).textLine('MWST-AUFSCHLUESSELUNG:').bold(false);
    if (Array.isArray(report.taxSplits) && report.taxSplits.length > 0) {
      for (const split of report.taxSplits) {
        builder.twoColumn(
          `${Number(split.rate).toFixed(0)}% auf ${(splitBaseCents(split) / 100).toFixed(2)}`,
          `${(splitTaxCents(split) / 100).toFixed(2)} EUR`
        );
      }
    } else {
      builder.twoColumn('MwSt 19%:', fmtCents(report.totalTax19Cents, report.totalTax19));
      builder.twoColumn('MwSt 7%:', fmtCents(report.totalTax7Cents, report.totalTax7));
      builder.twoColumn('Steuerfrei (Pfand):', fmtCents(report.taxBase0Cents, report.taxBase0));
    }
    builder.divider();

    builder.bold(true).textLine('ZAHLUNGSARTEN:').bold(false);
    builder.twoColumn('Bargeld (Kassenbestand):', fmtCents(report.totalCashCents, report.totalCash));
    builder.twoColumn('Kartenzahlung Gesamt:', fmtCents(report.totalCardCents, report.totalCard));
    if (report.paymentSplit) {
      builder.twoColumn(' - davon SumUp:', fmtCents(report.paymentSplit.cardSumUpCents, report.paymentSplit.cardSumUp));
      builder.twoColumn(' - davon VR-Pay Me:', fmtCents(report.paymentSplit.cardVrPayCents, report.paymentSplit.cardVrPay));
      builder.twoColumn(' - davon Sparkasse:', fmtCents(report.paymentSplit.cardSparkasseCents, report.paymentSplit.cardSparkasse));
      builder.twoColumn(' - davon EC-Terminal:', fmtCents(report.paymentSplit.cardTerminalCents, report.paymentSplit.cardTerminal));
    }
    builder.twoColumn('Personal / Bewirtung:', fmtCents(report.totalStaffCents, report.totalStaff));
    builder.twoColumn('Aufschlaege (Pauschalen):', fmtCents(report.totalSurchargesCents, report.totalSurcharges));
    {
      const depRet = centsOf(report.totalDepositReturnedCents, report.totalDepositReturned);
      builder.twoColumn('Ausgezahlter Rueckpfand:', `-${(depRet / 100).toFixed(2)} EUR`);
    }
    {
      const tips = centsOf(report.totalTipsCents, report.totalTips);
      builder.twoColumn('Erhaltenes Trinkgeld:', `+${(tips / 100).toFixed(2)} EUR`);
    }
    builder.twoColumn('Anzahl Transaktionen:', `${report.transactionCount || 0}`);
    builder.divider();

    builder.bold(true).textLine('KELLNER-SCHICHTABRECHNUNG:').bold(false);
    for (const w of report.waiters || []) {
      builder.bold(true).twoColumn(`${w.waiterName}:`, fmtCents(w.totalGrossCents, w.totalGross)).bold(false);
      builder.textLine(`  Bar: ${fmtCents(w.cashGrossCents, w.cashGross)} | Karte: ${fmtCents(w.cardGrossCents, w.cardGross)} | Bons: ${w.transactionCount || 0}`);
    }

    // Spec 6.8: Kassenbuch-Block
    builder.divider();
    builder.bold(true).textLine('KASSENBUCH / GELDBEWEGUNGEN:').bold(false);
    {
      const ci = centsOf(report.cashInCents, report.cashIn);
      builder.twoColumn('Wechselgeld-Einlagen:', `+${(ci / 100).toFixed(2)} EUR`);
    }
    {
      const co = centsOf(report.cashOutCents, report.cashOut);
      builder.twoColumn('Entnahmen (Tresor):', `-${(co / 100).toFixed(2)} EUR`);
    }
    builder.bold(true).twoColumn('BAR-SOLL IN KASSE:', fmtCents(report.cashExpectedCents, report.cashExpected)).bold(false);
    if (report.cashCountedCents !== undefined || report.cashCounted !== undefined) {
      const counted = centsOf(report.cashCountedCents ?? null, report.cashCounted ?? null);
      const diff = centsOf(report.cashDifferenceCents ?? null, report.cashDifference ?? null);
      builder.twoColumn('Gezaehlt (Ist):', `${(counted / 100).toFixed(2)} EUR`);
      builder.bold(true).twoColumn('DIFFERENZ:', `${(diff / 100).toFixed(2)} EUR`).bold(false);
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
      textRepresentation: `Z-BON TAGESABSCHLUSS - ${fmtCents(report.totalGrossCents, report.totalGross)}`,
    };
  }
}
