/**
 * OpenBon Predictive Forecasting & Statistical Analytics Engine
 * Calculates sales velocity, peak rush hour forecasts, EOD revenue projections,
 * and stock depletion alerts based on real-time transaction history.
 */

export interface HourlySalesData {
  hour: number;
  label: string;
  grossAmount: number;
  orderCount: number;
  itemCount: number;
}

export interface ForecastSummary {
  currentTotalGross: number;
  projectedEodGross: number;
  currentVelocityPerHour: number;
  projectedNextHourGross: number;
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
}

export function computeHourlySales(orders: any[]): HourlySalesData[] {
  const hoursMap = new Map<number, HourlySalesData>();

  for (let h = 8; h <= 23; h++) {
    hoursMap.set(h, {
      hour: h,
      label: `${h.toString().padStart(2, '0')}:00`,
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
        const lineTotal = (itm.unitPrice + (itm.deposit || 0)) * itm.quantity;
        entry.grossAmount += lineTotal;
        entry.itemCount += itm.quantity;
      }
    }
  }

  return Array.from(hoursMap.values());
}

export function computeForecast(
  hourlyData: HourlySalesData[],
  totalCurrentSales: number,
  stockItems: any[] = [],
  products: any[] = []
): ForecastSummary {
  const activeHours = hourlyData.filter((h) => h.orderCount > 0);
  const nowHour = new Date().getHours();

  let velocityPerHour = 0;
  if (activeHours.length > 0) {
    const totalActiveSales = activeHours.reduce((s, h) => s + h.grossAmount, 0);
    velocityPerHour = totalActiveSales / activeHours.length;
  }

  // Linear / Trend projection for remaining hours until 23:00
  const remainingHours = Math.max(1, 24 - Math.max(8, nowHour));
  const trendMultiplier = nowHour >= 18 && nowHour <= 22 ? 1.4 : 1.1; // Evening rush multiplier
  const projectedRemaining = velocityPerHour * remainingHours * trendMultiplier;
  const projectedEodGross = Math.round((totalCurrentSales + projectedRemaining) * 100) / 100;
  const projectedNextHourGross = Math.round(velocityPerHour * trendMultiplier * 100) / 100;

  // Peak Hour detection
  let maxHour = 19;
  let maxGross = 0;
  for (const h of hourlyData) {
    if (h.grossAmount > maxGross) {
      maxGross = h.grossAmount;
      maxHour = h.hour;
    }
  }

  const peakHourIntensity = maxGross > velocityPerHour * 1.8 ? 'EXTREME' : maxGross > velocityPerHour * 1.3 ? 'HIGH' : 'NORMAL';

  // Stock Depletion Analysis
  const criticalStockAlerts: ForecastSummary['criticalStockAlerts'] = [];
  const hoursRunning = Math.max(1, activeHours.length);

  for (const p of products) {
    if (p.stockItem) {
      const currentStock = p.stockItem.quantity;
      const consumedQty = p.orderItems?.reduce((sum: number, itm: any) => sum + itm.quantity, 0) || 0;
      const consumptionPerHour = consumedQty / hoursRunning;

      if (consumptionPerHour > 0 && currentStock > 0) {
        const hoursLeft = currentStock / consumptionPerHour;
        const minutesLeft = Math.round(hoursLeft * 60);

        if (minutesLeft <= 90 || currentStock <= p.stockItem.minThreshold) {
          criticalStockAlerts.push({
            productName: p.name,
            currentStock,
            consumptionPerHour: Math.round(consumptionPerHour * 10) / 10,
            estimatedMinutesRemaining: minutesLeft,
            urgency: minutesLeft <= 30 ? 'HIGH' : 'MEDIUM',
          });
        }
      } else if (currentStock <= p.stockItem.minThreshold) {
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
    currentTotalGross: Math.round(totalCurrentSales * 100) / 100,
    projectedEodGross,
    currentVelocityPerHour: Math.round(velocityPerHour * 100) / 100,
    projectedNextHourGross,
    peakHourLabel: `${maxHour.toString().padStart(2, '0')}:00 - ${(maxHour + 1).toString().padStart(2, '0')}:00`,
    peakHourIntensity,
    confidencePercent: activeHours.length >= 3 ? 88 : activeHours.length > 0 ? 65 : 50,
    criticalStockAlerts,
  };
}
