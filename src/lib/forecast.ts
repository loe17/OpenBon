/**
 * OpenBon Predictive Forecasting & Statistical Analytics Engine
 * Calculates sales velocity, peak rush hour forecasts, EOD revenue projections,
 * and stock depletion alerts based on real-time transaction history.
 *
 * Harter Cent-Cut: Alle Geldbetraege sind Int-Cent (*Cents).
 */

export interface HourlySalesData {
  hour: number;
  label: string;
  grossAmountCents: number;
  /** @deprecated Anzeige-Euro */
  grossAmount?: number;
  orderCount: number;
  itemCount: number;
}

export interface ForecastSummary {
  currentTotalGrossCents: number;
  projectedEodGrossCents: number;
  currentVelocityPerHourCents: number;
  projectedNextHourGrossCents: number;
  peakHourLabel: string;
  peakHourIntensity: 'NORMAL' | 'HIGH' | 'EXTREME';
  confidencePercent: number;
  criticalStockAlerts: {
    productName: string;
    currentStock: number;
    consumptionPerHour: number;
    estimatedMinutesRemaining: number;
    urgency: 'HIGH' | 'MEDIUM';
  }[];
  /** @deprecated Anzeige-Euro */
  currentTotalGross?: number;
  /** @deprecated Anzeige-Euro */
  projectedEodGross?: number;
  /** @deprecated Anzeige-Euro */
  currentVelocityPerHour?: number;
  /** @deprecated Anzeige-Euro */
  projectedNextHourGross?: number;
}

/** Minimal benötigte Form einer Bestellung für die Auswertung (Cent) */
export interface ForecastOrder {
  status: string;
  createdAt: string | Date;
  items: {
    quantity: number;
    unitPriceCents: number;
    depositCents?: number | null;
    isCancelled?: boolean;
    /** @deprecated Legacy Euro */
    unitPrice?: number;
    /** @deprecated Legacy Euro */
    deposit?: number | null;
  }[];
}

/** Minimal benötigte Form eines Artikels für die Bestandsprognose */
export interface ForecastProduct {
  name: string;
  stockItem?: {
    currentQuantity: number;
    alertThreshold: number;
  } | null;
  orderItems?: { quantity: number }[];
}

function unitCentsOf(item: ForecastOrder['items'][number]): number {
  if (typeof item.unitPriceCents === 'number') return Math.round(item.unitPriceCents);
  if (typeof item.unitPrice === 'number') return Math.round((item.unitPrice + Number.EPSILON) * 100);
  return 0;
}

function depositCentsOf(item: ForecastOrder['items'][number]): number {
  if (typeof item.depositCents === 'number') return Math.round(item.depositCents);
  if (typeof item.deposit === 'number') return Math.round((item.deposit + Number.EPSILON) * 100);
  return 0;
}

export function computeHourlySales(orders: ForecastOrder[]): HourlySalesData[] {
  const hoursMap = new Map<number, HourlySalesData>();

  for (let h = 8; h <= 23; h++) {
    hoursMap.set(h, {
      hour: h,
      label: `${h.toString().padStart(2, '0')}:00`,
      grossAmountCents: 0,
      grossAmount: 0,
      orderCount: 0,
      itemCount: 0,
    });
  }

  for (const ord of orders) {
    if (ord.status === 'CANCELLED') continue;
    const date = new Date(ord.createdAt);
    const hour = date.getHours();

    if (hoursMap.has(hour)) {
      const entry = hoursMap.get(hour)!;
      entry.orderCount += 1;

      for (const itm of ord.items || []) {
        if (itm.isCancelled) continue;
        const lineTotalCents = (unitCentsOf(itm) + depositCentsOf(itm)) * itm.quantity;
        entry.grossAmountCents += lineTotalCents;
        entry.itemCount += itm.quantity;
      }
      entry.grossAmount = entry.grossAmountCents / 100;
    }
  }

  return Array.from(hoursMap.values());
}

export function computeForecast(
  hourlyData: HourlySalesData[],
  totalCurrentSalesCents: number,
  stockItems: unknown[] = [],
  products: ForecastProduct[] = []
): ForecastSummary {
  void stockItems;
  const activeHours = hourlyData.filter((h) => h.orderCount > 0);
  const nowHour = new Date().getHours();

  const grossOf = (h: HourlySalesData): number =>
    typeof h.grossAmountCents === 'number'
      ? h.grossAmountCents
      : Math.round(((h.grossAmount ?? 0) + Number.EPSILON) * 100);

  let velocityPerHourCents = 0;
  if (activeHours.length > 0) {
    const totalActiveSalesCents = activeHours.reduce((s, h) => s + grossOf(h), 0);
    velocityPerHourCents = Math.round(totalActiveSalesCents / activeHours.length);
  }

  // Linear / Trend projection for remaining hours until 23:00 (Cent, ganzzahlig)
  const remainingHours = Math.max(1, 24 - Math.max(8, nowHour));
  const trendMultiplier = nowHour >= 18 && nowHour <= 22 ? 1.4 : 1.1; // Evening rush multiplier
  const projectedRemainingCents = Math.round(velocityPerHourCents * remainingHours * trendMultiplier);
  const projectedEodGrossCents = Math.round(totalCurrentSalesCents) + projectedRemainingCents;
  const projectedNextHourGrossCents = Math.round(velocityPerHourCents * trendMultiplier);

  // Peak Hour detection
  let maxHour = 19;
  let maxGrossCents = 0;
  for (const h of hourlyData) {
    const g = grossOf(h);
    if (g > maxGrossCents) {
      maxGrossCents = g;
      maxHour = h.hour;
    }
  }

  const peakHourIntensity = maxGrossCents > velocityPerHourCents * 1.8 ? 'EXTREME' : maxGrossCents > velocityPerHourCents * 1.3 ? 'HIGH' : 'NORMAL';

  // Stock Depletion Analysis
  const criticalStockAlerts: ForecastSummary['criticalStockAlerts'] = [];
  const hoursRunning = Math.max(1, activeHours.length);

  for (const p of products) {
    if (p.stockItem) {
      const currentStock = p.stockItem.currentQuantity;
      const consumedQty = p.orderItems?.reduce((sum, itm) => sum + itm.quantity, 0) || 0;
      const consumptionPerHour = consumedQty / hoursRunning;

      if (consumptionPerHour > 0 && currentStock > 0) {
        const hoursLeft = currentStock / consumptionPerHour;
        const minutesLeft = Math.round(hoursLeft * 60);

        if (minutesLeft <= 90 || currentStock <= p.stockItem.alertThreshold) {
          criticalStockAlerts.push({
            productName: p.name,
            currentStock,
            consumptionPerHour: Math.round(consumptionPerHour * 10) / 10,
            estimatedMinutesRemaining: minutesLeft,
            urgency: minutesLeft <= 30 ? 'HIGH' : 'MEDIUM',
          });
        }
      } else if (currentStock <= p.stockItem.alertThreshold) {
        criticalStockAlerts.push({
          productName: p.name,
          currentStock,
          consumptionPerHour: 0,
          estimatedMinutesRemaining: 0,
          urgency: 'HIGH',
        });
      }
    }
  }

  return {
    currentTotalGrossCents: Math.round(totalCurrentSalesCents),
    projectedEodGrossCents,
    currentVelocityPerHourCents: velocityPerHourCents,
    projectedNextHourGrossCents,
    peakHourLabel: `${maxHour.toString().padStart(2, '0')}:00 - ${(maxHour + 1).toString().padStart(2, '0')}:00`,
    peakHourIntensity,
    confidencePercent: activeHours.length >= 3 ? 88 : activeHours.length > 0 ? 65 : 50,
    criticalStockAlerts,
    currentTotalGross: Math.round(totalCurrentSalesCents) / 100,
    projectedEodGross: projectedEodGrossCents / 100,
    currentVelocityPerHour: velocityPerHourCents / 100,
    projectedNextHourGross: projectedNextHourGrossCents / 100,
  };
}
