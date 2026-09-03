/**
 * Zentrale Domain-Typen (Spec 2: strikte Typisierung, keine `any`-Typen).
 * Die Typen spiegeln die Prisma-Modelle in der Form wider, in der sie
 * ueber die JSON-API an die Clients ausgeliefert werden.
 *
 * Harter Cent-Cut: Alle Geldbetraege sind Int-Cent (*Cents). Prozent- und
 * Mengenangaben bleiben Float. Legacy-Euro-Felder sind als @deprecated
 * markiert und dienen nur der Anzeige bzw. der stufenweisen Migration.
 */

export type PaymentMethod =
  | 'CASH'
  | 'CARD_SUMUP'
  | 'CARD_VRPAY'
  | 'CARD_SPARKASSE'
  | 'CARD_ZETTLE'
  | 'CARD_STRIPE'
  | 'CARD_TERMINAL'
  | 'TOKEN'
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
  enableTax?: boolean;
  enableCourses?: boolean;
  enableDigitalReceipt?: boolean;
  receiptHeader?: string | null;
  receiptSubHeader?: string | null;
  receiptFooterText?: string | null;
  receiptShowTimestamp?: boolean;
  receiptShowWaiter?: boolean;
  receiptShowTable?: boolean;
  receiptShowTse?: boolean;
  receiptTableFontSize?: number | string | null;
  receiptFoodTableFontSize?: number | string | null;
  receiptDrinkTableFontSize?: number | string | null;
  tableMarkerFontSize?: number | string | null;
  receiptItemFontSize?: number | string | null;
  receiptOptionsFontSize?: number | string | null;
  receiptMetaFontSize?: number | string | null;
  receiptFoodItemFontSize?: number | string | null;
  receiptFoodOptionsFontSize?: number | string | null;
  receiptDrinkItemFontSize?: number | string | null;
  receiptDrinkOptionsFontSize?: number | string | null;
  addressStreet?: string | null;
  addressCity?: string | null;
  taxNumber?: string | null;
  vatId?: string | null;
  receiptTemplate?: string;
  receiptFoodTemplate?: string;
  receiptDrinkTemplate?: string;
  autoBackupEnabled?: boolean;
  autoBackupIntervalMinutes?: number;
  receiptSingleItemKitchenSlips?: boolean;
  receiptSingleItemFoodSlips?: boolean;
  receiptSingleItemDrinkSlips?: boolean;
  receiptFoodShowHeader?: boolean;
  receiptFoodShowTable?: boolean;
  receiptFoodShowWaiter?: boolean;
  receiptFoodShowTimestamp?: boolean;
  receiptFoodShowOptions?: boolean;
  receiptDrinkShowHeader?: boolean;
  receiptDrinkShowTable?: boolean;
  receiptDrinkShowWaiter?: boolean;
  receiptDrinkShowTimestamp?: boolean;
  receiptDrinkShowOptions?: boolean;
  receiptKitchenShowHeader?: boolean;
  receiptKitchenShowTable?: boolean;
  receiptKitchenShowWaiter?: boolean;
  receiptKitchenShowTimestamp?: boolean;
  receiptKitchenShowOptions?: boolean;
  activeTheme?: string;
  waiterAutoLockMinutes?: number;
  enableAgeVerificationAlerts?: boolean;
  enableDigitalReceiptQr?: boolean;
  enableNfc?: boolean;
  enableNfcWaiter?: boolean;
  enableNfcPos?: boolean;
  enableGuestSelfOrder?: boolean;
  enableGuestFacingDisplay?: boolean;
  lockStartScreen?: boolean;
  enableKioskMode?: boolean;
  lowStockAlertPrinterId?: string | null;
  datevConsultantNumber?: string | null;
  datevClientNumber?: string | null;
  datevCashAccount?: string | null;
  activeCardProvider?: string;
  sumupMerchantCode: string | null;
  sumupAppId: string | null;
  vrPayApiKey?: string | null;
  vrPayTerminalId: string | null;
  sparkasseMerchantId: string | null;
  stripeSecretKey?: string | null;
  stripePublishableKey?: string | null;
  stripeLocationId?: string | null;
  zvtHost: string | null;
  zvtPort: number;
  zvtPassword: string;
  baseUrl: string;
  initialPinSet?: boolean;
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
  priceDeltaCents: number;
  /** @deprecated Legacy Euro-Delta */
  priceDelta?: number;
  isSoldOut: boolean;
  sortIndex: number;
  /** Eigene Werte des Untereintrags; null = vom Hauptartikel erben. */
  alternativeTicketName?: string | null;
  color?: string | null;
  printGroupId?: string | null;
  depositCents?: number | null;
  /** @deprecated Legacy Euro-Pfand */
  deposit?: number | null;
  taxRate?: number | null;
}

export interface ProductOptionDTO {
  id: string;
  productId: string;
  name: string;
  priceDeltaCents: number;
  /** @deprecated Legacy Euro-Delta */
  priceDelta?: number;
  sortIndex: number;
  /** Voreingestellte Anzahl beim Öffnen der Auswahl. */
  defaultQuantity?: number;
  /** Höchstens wählbare Anzahl. 1 = einfacher Umschalter. */
  maxQuantity?: number;
}

export interface ProductDTO {
  id: string;
  name: string;
  alternativeTicketName: string | null;
  priceCents: number;
  /** @deprecated Anzeige-Euro */
  price?: number;
  depositCents: number;
  /** @deprecated Anzeige-Euro */
  deposit?: number;
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
  happyHourPriceCents?: number | null;
  /** @deprecated Anzeige-Euro */
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
  /** N3.2: Aktueller Lagerbestand aus dem verbindlichen StockItem-Pfad. */
  stockItem?: {
    productId: string;
    initialQuantity: number;
    currentQuantity: number;
    alertThreshold: number;
    isAutoDeactivate: boolean;
  } | null;
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
  openTotalCents?: number;
  /** @deprecated Anzeige-Euro */
  openTotal?: number;
  openItemCount?: number;
}

export interface OrderItemDTO {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  /** @deprecated Anzeige-Euro */
  unitPrice?: number;
  depositCents: number;
  /** @deprecated Anzeige-Euro */
  deposit?: number;
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
  unitPriceCents: number;
  /** @deprecated Anzeige-Euro */
  unitPrice?: number;
  depositCents: number;
  /** @deprecated Anzeige-Euro */
  deposit?: number;
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
  totalGrossCents: number;
  totalNetCents: number;
  totalTaxCents: number;
  taxBase19Cents: number;
  taxAmount19Cents: number;
  taxBase7Cents: number;
  taxAmount7Cents: number;
  taxBase0Cents: number;
  totalDepositCents: number;
  returnDepositCents: number;
  discountAmountCents: number;
  tipAmountCents: number;
  tipWaiterShareCents?: number;
  tipPoolShareCents?: number;
  surchargeAmountCents: number;
  surchargePercent: number;
  surchargeReason: string | null;
  givenAmountCents: number;
  changeAmountCents: number;
  paymentMethod: PaymentMethod;
  cardAuthCode: string | null;
  cardTerminalId: string | null;
  nonPaidReason: string | null;
  isCancelled: boolean;
  isTraining: boolean;
  createdAt: string;
  items?: PaymentItemDTO[];
  table?: DiningTableDTO | null;
  /** @deprecated Anzeige-Euro, abgeleitet aus *Cents */
  totalGross?: number;
  /** @deprecated Anzeige-Euro */
  totalNet?: number;
  /** @deprecated Anzeige-Euro */
  totalTax?: number;
  /** @deprecated Anzeige-Euro */
  taxBase19?: number;
  /** @deprecated Anzeige-Euro */
  taxAmount19?: number;
  /** @deprecated Anzeige-Euro */
  taxBase7?: number;
  /** @deprecated Anzeige-Euro */
  taxAmount7?: number;
  /** @deprecated Anzeige-Euro */
  taxBase0?: number;
  /** @deprecated Anzeige-Euro */
  totalDeposit?: number;
  /** @deprecated Anzeige-Euro */
  returnDeposit?: number;
  /** @deprecated Anzeige-Euro */
  discountAmount?: number;
  /** @deprecated Anzeige-Euro */
  tipAmount?: number;
  /** @deprecated Anzeige-Euro */
  surchargeAmount?: number;
  /** @deprecated Anzeige-Euro */
  givenAmount?: number;
  /** @deprecated Anzeige-Euro */
  changeAmount?: number;
}

export interface CashMovementDTO {
  id: string;
  periodId: string | null;
  type: CashMovementType;
  amountCents: number;
  /** @deprecated Anzeige-Euro */
  amount?: number;
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
  totalGrossCents: number;
  totalNetCents: number;
  taxAmount19Cents: number;
  taxAmount7Cents: number;
  taxBase0Cents: number;
  totalCashCents: number;
  totalCardCents: number;
  totalTipsCents: number;
  totalDepositOutCents: number;
  cashInCents: number;
  cashOutCents: number;
  cashExpectedCents: number;
  cashCountedCents: number | null;
  cashDifferenceCents: number | null;
  transactionCount: number;
  fiscalSignature: string | null;
  /** @deprecated Anzeige-Euro */
  totalGross?: number;
  /** @deprecated Anzeige-Euro */
  totalNet?: number;
  /** @deprecated Anzeige-Euro */
  taxAmount19?: number;
  /** @deprecated Anzeige-Euro */
  taxAmount7?: number;
  /** @deprecated Anzeige-Euro */
  taxBase0?: number;
  /** @deprecated Anzeige-Euro */
  totalCash?: number;
  /** @deprecated Anzeige-Euro */
  totalCard?: number;
  /** @deprecated Anzeige-Euro */
  totalTips?: number;
  /** @deprecated Anzeige-Euro */
  totalDepositOut?: number;
  /** @deprecated Anzeige-Euro */
  cashIn?: number;
  /** @deprecated Anzeige-Euro */
  cashOut?: number;
  /** @deprecated Anzeige-Euro */
  cashExpected?: number;
  /** @deprecated Anzeige-Euro */
  cashCounted?: number | null;
  /** @deprecated Anzeige-Euro */
  cashDifference?: number | null;
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
  totalGrossCents: number;
  cashGrossCents: number;
  cardGrossCents: number;
  tipsCents: number;
  depositReturnedCents: number;
  transactionCount: number;
  ordersLastHour: number;
  salesLastHourCents: number;
  rank?: number;
  /** @deprecated Anzeige-Euro */
  totalGross?: number;
  /** @deprecated Anzeige-Euro */
  cashGross?: number;
  /** @deprecated Anzeige-Euro */
  cardGross?: number;
  /** @deprecated Anzeige-Euro */
  tips?: number;
  /** @deprecated Anzeige-Euro */
  depositReturned?: number;
  /** @deprecated Anzeige-Euro */
  salesLastHour?: number;
}

export interface TaxSplit {
  rate: number;
  baseCents: number;
  taxCents: number;
  grossCents: number;
  /** @deprecated Anzeige-Euro */
  base?: number;
  /** @deprecated Anzeige-Euro */
  tax?: number;
  /** @deprecated Anzeige-Euro */
  gross?: number;
}

/* ------------------------------------------------------------------ Reports */

export interface HourlySalesPoint {
  hour: number;
  label: string;
  grossAmountCents: number;
  /** @deprecated Anzeige-Euro */
  grossAmount?: number;
  orderCount: number;
  itemCount: number;
}

export interface TopProductStat {
  name: string;
  quantity: number;
  revenueCents: number;
  /** @deprecated Anzeige-Euro */
  revenue?: number;
}

export interface CategoryBreakdownEntry {
  id: string;
  name: string;
  color: string;
  revenueCents: number;
  /** @deprecated Anzeige-Euro */
  revenue?: number;
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
  currentTotalGrossCents: number;
  projectedEodGrossCents: number;
  currentVelocityPerHourCents: number;
  projectedNextHourGrossCents: number;
  peakHourLabel: string;
  peakHourIntensity: 'NORMAL' | 'HIGH' | 'EXTREME';
  confidencePercent: number;
  criticalStockAlerts: StockAlertEntry[];
  /** @deprecated Anzeige-Euro */
  currentTotalGross?: number;
  /** @deprecated Anzeige-Euro */
  projectedEodGross?: number;
  /** @deprecated Anzeige-Euro */
  currentVelocityPerHour?: number;
  /** @deprecated Anzeige-Euro */
  projectedNextHourGross?: number;
}

export interface PaymentSplitBlock {
  cash: { amountCents: number; amount?: number; percent: number };
  cardAll: { amountCents: number; amount?: number; percent: number };
  cardSumUpCents: number;
  cardVrPayCents: number;
  cardSparkasseCents: number;
  cardTerminalCents: number;
  staffCents: number;
  discountsCents: number;
  surchargesCents: number;
  /** @deprecated Anzeige-Euro */
  cardSumUp?: number;
  /** @deprecated Anzeige-Euro */
  cardVrPay?: number;
  /** @deprecated Anzeige-Euro */
  cardSparkasse?: number;
  /** @deprecated Anzeige-Euro */
  cardTerminal?: number;
  /** @deprecated Anzeige-Euro */
  staff?: number;
  /** @deprecated Anzeige-Euro */
  discounts?: number;
  /** @deprecated Anzeige-Euro */
  surcharges?: number;
}

export interface ReportSummary {
  totalGrossCents: number;
  totalNetCents: number;
  totalTax19Cents: number;
  totalTax7Cents: number;
  taxBase0Cents: number;
  totalCashCents: number;
  totalCardCents: number;
  paymentSplit: PaymentSplitBlock;
  totalStaffCents: number;
  totalDepositChargedCents: number;
  totalDepositReturnedCents: number;
  netDepositBalanceCents: number;
  totalTipsCents: number;
  totalDiscountsCents: number;
  totalSurchargesCents: number;
  transactionCount: number;
  ordersCount: number;
  waiters: WaiterShiftSummary[];
  topProducts: TopProductStat[];
  hourlySales: HourlySalesPoint[];
  categoryBreakdown: CategoryBreakdownEntry[];
  forecast: ForecastBlock;
  exportedAt: string;
  /** @deprecated Anzeige-Euro */
  totalGross?: number;
  /** @deprecated Anzeige-Euro */
  totalNet?: number;
  /** @deprecated Anzeige-Euro */
  totalTax19?: number;
  /** @deprecated Anzeige-Euro */
  totalTax7?: number;
  /** @deprecated Anzeige-Euro */
  taxBase0?: number;
  /** @deprecated Anzeige-Euro */
  totalCash?: number;
  /** @deprecated Anzeige-Euro */
  totalCard?: number;
  /** @deprecated Anzeige-Euro */
  totalStaff?: number;
  /** @deprecated Anzeige-Euro */
  totalDepositCharged?: number;
  /** @deprecated Anzeige-Euro */
  totalDepositReturned?: number;
  /** @deprecated Anzeige-Euro */
  netDepositBalance?: number;
  /** @deprecated Anzeige-Euro */
  totalTips?: number;
  /** @deprecated Anzeige-Euro */
  totalDiscounts?: number;
  /** @deprecated Anzeige-Euro */
  totalSurcharges?: number;
}

/** Vorschau des Z-Bons vor dem Tagesabschluss (Cent) */
export interface ZBonPreview {
  periodId: string;
  periodNumber: number;
  openedAt: string;
  status: string;
  totalGrossCents: number;
  totalNetCents: number;
  taxAmount19Cents: number;
  taxAmount7Cents: number;
  taxBase0Cents: number;
  totalCashCents: number;
  totalCardCents: number;
  cashInCents: number;
  cashOutCents: number;
  cashExpectedCents: number;
  transactionCount: number;
  error?: string;
  /** @deprecated Anzeige-Euro */
  totalGross?: number;
  /** @deprecated Anzeige-Euro */
  totalNet?: number;
  /** @deprecated Anzeige-Euro */
  taxAmount19?: number;
  /** @deprecated Anzeige-Euro */
  taxAmount7?: number;
  /** @deprecated Anzeige-Euro */
  taxBase0?: number;
  /** @deprecated Anzeige-Euro */
  totalCash?: number;
  /** @deprecated Anzeige-Euro */
  totalCard?: number;
  /** @deprecated Anzeige-Euro */
  cashIn?: number;
  /** @deprecated Anzeige-Euro */
  cashOut?: number;
  /** @deprecated Anzeige-Euro */
  cashExpected?: number;
}

/** Warenkorb-Position im Client (noch nicht persistiert, Cent) */
export interface CartLine {
  lineId: string;
  productId: string;
  productName: string;
  alternativeTicketName?: string | null;
  quantity: number;
  unitPriceCents: number;
  /** @deprecated Anzeige-Euro */
  unitPrice?: number;
  depositCents: number;
  /** @deprecated Anzeige-Euro */
  deposit?: number;
  taxRate: number;
  variantName: string | null;
  selectedOptions: string[];
  customizationText: string | null;
  courseNumber: number;
  isHold: boolean;
  subCategory?: string | null;
}

export interface ActionLogDTO {
  id: string;
  action: string;
  category: string;
  actor: string;
  details: string;
  metadata?: string | null;
  createdAt: string;
}
