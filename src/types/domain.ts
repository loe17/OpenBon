/**
 * Zentrale Domain-Typen (Spec 2: strikte Typisierung, keine `any`-Typen).
 * Die Typen spiegeln die Prisma-Modelle in der Form wider, in der sie
 * ueber die JSON-API an die Clients ausgeliefert werden.
 */

export type PaymentMethod =
  | 'CASH'
  | 'CARD_SUMUP'
  | 'CARD_VRPAY'
  | 'CARD_SPARKASSE'
  | 'CARD_TERMINAL'
  | 'NON_PAID_STAFF'
  | 'NON_PAID_COMPLAINT'
  | 'VOID_UNPAID'
  | 'DISCOUNT';

export type OrderStatus = 'OPEN' | 'IN_PREPARATION' | 'READY' | 'COMPLETED' | 'CANCELLED';
export type OrderType = 'TABLE' | 'COUNTER_VOUCHER' | 'COUNTER_DIRECT';
export type KdsStatus = 'PENDING' | 'IN_PROGRESS' | 'READY' | 'COMPLETED';
export type PrintStatus = 'PENDING' | 'HELD' | 'PRINTED' | 'ERROR';
export type TableStatus = 'FREE' | 'OCCUPIED' | 'HIDDEN' | 'INACTIVE';
export type DeviceRole = 'ADMIN' | 'WAITER' | 'POS_CASHIER' | 'KITCHEN';
export type CashMovementType = 'CASH_IN' | 'CASH_OUT';

/** Spec 6.4: Pflicht-Stornogruende */
export const VOID_REASONS = [
  'Falsch bestellt',
  'Bruch/Verschüttet',
  'Ehrengast',
  'Musiker/Helfer',
  'Reklamation Gast',
  'Sonstiges',
] as const;
export type VoidReason = (typeof VOID_REASONS)[number];

/** Spec 6.5: Gang-Steuerung */
export const COURSES = [
  { number: 1, label: 'Gang 1 · Vorspeise / Sofort' },
  { number: 2, label: 'Gang 2 · Hauptgang' },
  { number: 3, label: 'Gang 3 · Dessert / Später' },
] as const;

export interface EventConfigDTO {
  id: string;
  name: string;
  currency: string;
  taxRateNormal: number;
  taxRateReduced: number;
  trainingMode: boolean;
  trayMaxItems: number;
  adminPin: string;
  posPin: string;
  kitchenPin: string;
  waiterPin: string;
  enableVirtualPrinters: boolean;
  enableCourses?: boolean;
  enableDigitalReceipt?: boolean;
  receiptHeader?: string | null;
  receiptSubHeader?: string | null;
  receiptFooterText?: string | null;
  receiptShowTimestamp?: boolean;
  receiptShowWaiter?: boolean;
  receiptShowTable?: boolean;
  receiptShowTse?: boolean;
  activeTheme?: string;
  enableAgeVerificationAlerts?: boolean;
  enableDigitalReceiptQr?: boolean;
  enableGuestSelfOrder?: boolean;
  enableKioskMode?: boolean;
  lowStockAlertPrinterId?: string | null;
  datevConsultantNumber?: string | null;
  datevClientNumber?: string | null;
  datevCashAccount?: string | null;
  sumupMerchantCode: string | null;
  sumupAppId: string | null;
  vrPayTerminalId: string | null;
  sparkasseMerchantId: string | null;
  zvtHost: string | null;
  zvtPort: number;
  zvtPassword: string;
  baseUrl: string;
  tseProvider: string;
  tseSerialNumber: string | null;
  licenseKey: string;
  haRole: string;
  haPartnerUrl: string | null;
  haAutoFailover: boolean;
  tokenSequence: number;
  invoiceSequence: number;
  orderSequence: number;
}

export interface ProductVariantDTO {
  id: string;
  productId: string;
  name: string;
  priceDelta: number;
  isSoldOut: boolean;
  sortIndex: number;
}

export interface ProductOptionDTO {
  id: string;
  productId: string;
  name: string;
  priceDelta: number;
  sortIndex: number;
}

export interface ProductDTO {
  id: string;
  name: string;
  alternativeTicketName: string | null;
  price: number;
  deposit: number;
  taxRate: number;
  buttonColor: string | null;
  status: string;
  isSoldOut: boolean;
  trackStock: boolean;
  stockQuantity: number;
  stockAlertThreshold: number;
  minStockAlert?: number | null;
  minStockAlertPrinted?: boolean;
  hasAgeRestriction?: boolean;
  minAge?: number | null;
  allergens?: string | null;
  additives?: string | null;
  happyHourPrice?: number | null;
  happyHourStart?: string | null;
  happyHourEnd?: string | null;
  happyHourDays?: string | null;
  isTokenProduct?: boolean;
  tokenType?: string | null;
  subCategory: string | null;
  sortIndex: number;
  categoryId: string;
  printGroupId: string | null;
  variants?: ProductVariantDTO[];
  options?: ProductOptionDTO[];
  category?: ProductCategoryDTO;
}

export interface ProductCategoryDTO {
  id: string;
  name: string;
  sortIndex: number;
  color: string | null;
  icon: string | null;
  products?: ProductDTO[];
}

export interface DiningTableDTO {
  id: string;
  tableNumber: number;
  label: string;
  section: string;
  gridX: number;
  gridY: number;
  status: TableStatus;
  isActive: boolean;
  activeWaiterName: string | null;
  openTotal?: number;
  openItemCount?: number;
}

export interface OrderItemDTO {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  deposit: number;
  taxRate: number;
  variantName: string | null;
  selectedOptions: string | null;
  customizationText: string | null;
  courseNumber: number;
  isHold: boolean;
  printStatus: PrintStatus;
  kdsStatus: KdsStatus;
  kdsCompletedAt: string | null;
  paidQuantity: number;
  isCancelled: boolean;
  cancellationReason: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  product?: ProductDTO;
}

export interface OrderDTO {
  id: string;
  orderNumber: number;
  tableId: string | null;
  waiterName: string;
  deviceId: string | null;
  status: OrderStatus;
  orderType: OrderType;
  tokenNumber: number | null;
  isTraining: boolean;
  createdAt: string;
  updatedAt: string;
  items: OrderItemDTO[];
  table?: DiningTableDTO | null;
}

export interface PaymentItemDTO {
  id: string;
  paymentId: string;
  orderItemId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  deposit: number;
  taxRate: number;
}

export interface PaymentDTO {
  id: string;
  invoiceNumber: string;
  tableId: string | null;
  orderId: string | null;
  periodId: string | null;
  waiterName: string;
  deviceId: string | null;
  totalGross: number;
  totalNet: number;
  totalTax: number;
  taxBase19: number;
  taxAmount19: number;
  taxBase7: number;
  taxAmount7: number;
  taxBase0: number;
  totalDeposit: number;
  returnDeposit: number;
  discountAmount: number;
  tipAmount: number;
  surchargeAmount: number;
  surchargePercent: number;
  surchargeReason: string | null;
  givenAmount: number;
  changeAmount: number;
  paymentMethod: PaymentMethod;
  cardAuthCode: string | null;
  cardTerminalId: string | null;
  nonPaidReason: string | null;
  isCancelled: boolean;
  isTraining: boolean;
  createdAt: string;
  items?: PaymentItemDTO[];
  table?: DiningTableDTO | null;
}

export interface CashMovementDTO {
  id: string;
  periodId: string | null;
  type: CashMovementType;
  amount: number;
  reason: string;
  waiterName: string;
  deviceId: string | null;
  isTraining: boolean;
  createdAt: string;
}

export interface RegisterPeriodDTO {
  id: string;
  periodNumber: number;
  openedAt: string;
  closedAt: string | null;
  status: 'OPEN' | 'CLOSED';
  closedBy: string | null;
  totalGross: number;
  totalNet: number;
  taxAmount19: number;
  taxAmount7: number;
  taxBase0: number;
  totalCash: number;
  totalCard: number;
  totalTips: number;
  totalDepositOut: number;
  cashIn: number;
  cashOut: number;
  cashExpected: number;
  cashCounted: number | null;
  cashDifference: number | null;
  transactionCount: number;
  fiscalSignature: string | null;
}

export interface PrinterDTO {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  paperWidth: number;
  characterSet: string;
  isVirtual: boolean;
  isActive: boolean;
}

export interface PrintGroupDTO {
  id: string;
  name: string;
  printerId: string | null;
  maxItemsPerTicket: number;
  autoCut: boolean;
  printer?: PrinterDTO | null;
}

export interface WaiterShiftSummary {
  waiterName: string;
  totalGross: number;
  cashGross: number;
  cardGross: number;
  tips: number;
  depositReturned: number;
  transactionCount: number;
  ordersLastHour: number;
  salesLastHour: number;
  rank?: number;
}

export interface TaxSplit {
  rate: number;
  base: number;
  tax: number;
  gross: number;
}

/* ------------------------------------------------------------------ Reports */

export interface HourlySalesPoint {
  hour: number;
  label: string;
  grossAmount: number;
  orderCount: number;
  itemCount: number;
}

export interface TopProductStat {
  name: string;
  quantity: number;
  revenue: number;
}

export interface CategoryBreakdownEntry {
  id: string;
  name: string;
  color: string;
  revenue: number;
  count: number;
  percent: number;
}

export interface StockAlertEntry {
  productName: string;
  currentStock: number;
  consumptionPerHour: number;
  estimatedMinutesRemaining: number;
  urgency: 'HIGH' | 'MEDIUM';
}

export interface ForecastBlock {
  currentTotalGross: number;
  projectedEodGross: number;
  currentVelocityPerHour: number;
  projectedNextHourGross: number;
  peakHourLabel: string;
  peakHourIntensity: 'NORMAL' | 'HIGH' | 'EXTREME';
  confidencePercent: number;
  criticalStockAlerts: StockAlertEntry[];
}

export interface PaymentSplitBlock {
  cash: { amount: number; percent: number };
  cardAll: { amount: number; percent: number };
  cardSumUp: number;
  cardVrPay: number;
  cardSparkasse: number;
  cardTerminal: number;
  staff: number;
  discounts: number;
  surcharges: number;
}

export interface ReportSummary {
  totalGross: number;
  totalNet: number;
  totalTax19: number;
  totalTax7: number;
  taxBase0: number;
  totalCash: number;
  totalCard: number;
  paymentSplit: PaymentSplitBlock;
  totalStaff: number;
  totalDepositCharged: number;
  totalDepositReturned: number;
  netDepositBalance: number;
  totalTips: number;
  totalDiscounts: number;
  totalSurcharges: number;
  transactionCount: number;
  ordersCount: number;
  waiters: WaiterShiftSummary[];
  topProducts: TopProductStat[];
  hourlySales: HourlySalesPoint[];
  categoryBreakdown: CategoryBreakdownEntry[];
  forecast: ForecastBlock;
  exportedAt: string;
}

/** Vorschau des Z-Bons vor dem Tagesabschluss */
export interface ZBonPreview {
  periodId: string;
  periodNumber: number;
  openedAt: string;
  status: string;
  totalGross: number;
  totalNet: number;
  taxAmount19: number;
  taxAmount7: number;
  taxBase0: number;
  totalCash: number;
  totalCard: number;
  cashIn: number;
  cashOut: number;
  cashExpected: number;
  transactionCount: number;
  error?: string;
}

/** Warenkorb-Position im Client (noch nicht persistiert) */
export interface CartLine {
  lineId: string;
  productId: string;
  productName: string;
  alternativeTicketName?: string | null;
  quantity: number;
  unitPrice: number;
  deposit: number;
  taxRate: number;
  variantName: string | null;
  selectedOptions: string[];
  customizationText: string | null;
  courseNumber: number;
  isHold: boolean;
  subCategory?: string | null;
}
