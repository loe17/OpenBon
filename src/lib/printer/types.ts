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
}

export interface VirtualTicketRecord {
  id: string;
  printerName: string;
  printerIp: string;
  ticketData: TicketData;
  rawText: string;
  printedAt: string;
}
