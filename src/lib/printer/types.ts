export interface PrintItem {
  name: string;
  alternativeName?: string | null;
  quantity: number;
  unitPrice: number;
  deposit?: number;
  taxRate?: number;
  variantName?: string | null;
  selectedOptions?: string[] | null;
  customizationText?: string | null;
  /** Spec 6.5: Gang-Steuerung */
  courseNumber?: number;
}

/** Spec 6.1: Kopfzeile bei automatischem Tablett-Splitting */
export interface TraySplitInfo {
  index: number;
  total: number;
  /** Kurzbeschreibung des Bon-Inhalts, z. B. "Tisch 14 - 6x Bier" */
  summary: string;
}

export interface TicketData {
  title: string; // e.g. "KÜCHENBON", "AUSSCHANKBON", "RECHNUNG", "GUTSCHEIN", "TISCHMARKE"
  orderNumber?: number;
  tokenNumber?: number; // 3-digit counter token e.g. 101
  tableLabel?: string | null;
  waiterName?: string;
  createdAt?: string | Date;
  items: PrintItem[];
  totalGross?: number;
  totalNet?: number;
  totalTax?: number;
  totalDeposit?: number;
  returnDeposit?: number;
  discountAmount?: number;
  tipAmount?: number;
  givenAmount?: number;
  changeAmount?: number;
  paymentMethod?: string;
  isTraining?: boolean;
  invoiceNumber?: string;
  eventName?: string;
  footerText?: string;
  /** Spec 6.1: "*** BON 1 von 3 (Tisch 14 - 6x Bier) ***" */
  traySplit?: TraySplitInfo;
  /** Spec 6.10: Zwischenrechnung ist kein Kassenbeleg */
  isPreliminary?: boolean;
  /** Aufschluesselung je Steuersatz fuer den Kassenbeleg */
  taxSplits?: { rate: number; base: number; tax: number; gross: number }[];
  surchargeAmount?: number;
  surchargeReason?: string | null;
  cardAuthCode?: string | null;
  tableFontSize?: 'NORMAL' | 'LARGE' | 'EXTRA_LARGE' | number | string;
  itemFontSize?: number | string;
  optionsFontSize?: number | string;
  metaFontSize?: number | string;
  template?: 'CLASSIC' | 'ECO' | 'HIGH_VISIBILITY' | 'GASTRO' | string;
  subHeader?: string;
  customHeader?: string;
  addressStreet?: string;
  addressCity?: string;
  taxNumber?: string;
  vatId?: string;
  enableTax?: boolean;
  showQr?: boolean;
  qrUrl?: string;
}

export interface VirtualTicketRecord {
  id: string;
  printerName: string;
  printerIp: string;
  ticketData: TicketData;
  rawText: string;
  printedAt: string;
}
