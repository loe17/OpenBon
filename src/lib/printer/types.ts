import type { TaxSplit } from '@/types/domain';

export interface PrintItem {
  name: string;
  alternativeName?: string | null;
  quantity: number;
  unitPriceCents: number;
  depositCents?: number;
  taxRate?: number;
  /** @deprecated Legacy Euro, wird via Math.round(x*100) normalisiert */
  unitPrice?: number;
  /** @deprecated Legacy Euro */
  deposit?: number;
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
  totalGrossCents?: number;
  totalNetCents?: number;
  totalTaxCents?: number;
  totalDepositCents?: number;
  returnDepositCents?: number;
  discountCents?: number;
  tipCents?: number;
  givenCents?: number;
  changeCents?: number;
  surchargeAmountCents?: number;
  /** @deprecated Legacy Euro-Aliase (Migration Gruppen 2/3) */
  totalGross?: number;
  /** @deprecated Legacy Euro */
  totalNet?: number;
  /** @deprecated Legacy Euro */
  totalTax?: number;
  /** @deprecated Legacy Euro */
  totalDeposit?: number;
  /** @deprecated Legacy Euro */
  returnDeposit?: number;
  /** @deprecated Legacy Euro */
  discountAmount?: number;
  /** @deprecated Legacy Euro */
  tipAmount?: number;
  /** @deprecated Legacy Euro */
  givenAmount?: number;
  /** @deprecated Legacy Euro */
  changeAmount?: number;
  /** @deprecated Legacy Euro */
  surchargeAmount?: number;
  paymentMethod?: string;
  isTraining?: boolean;
  invoiceNumber?: string;
  eventName?: string;
  footerText?: string;
  /** Spec 6.1: "*** BON 1 von 3 (Tisch 14 - 6x Bier) ***" */
  traySplit?: TraySplitInfo;
  /** Spec 6.10: Zwischenrechnung ist kein Kassenbeleg */
  isPreliminary?: boolean;
  /** Aufschluesselung je Steuersatz fuer den Kassenbeleg (Cent) */
  taxSplits?: TaxSplit[];
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
