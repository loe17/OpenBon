import { round2, toCents, toEuro } from './pricing';

/**
 * Trinkgeld-Verteilungsengine (Spec V2 §5.3).
 *
 * Berechnet die cent-genaue Aufteilung von Trinkgeldern gemaess dem
 * zugewiesenen TipProfile der jeweiligen Bedienung.
 */

export interface TipProfileInput {
  name?: string;
  waiterPercent?: number;      // Default: 100.0 (100% an die Bedienung)
  barPoolPercent?: number;     // z. B. 0.0 bis 100.0
  kitchenPoolPercent?: number; // z. B. 0.0 bis 100.0
  servicePoolPercent?: number; // z. B. 0.0 bis 100.0
}

export interface TipDistributionResult {
  totalTip: number;
  waiterShare: number;
  barShare: number;
  kitchenShare: number;
  serviceShare: number;
  poolShare: number; // Summe aller Pool-Anteile (Bar + Kitchen + Service)
}

/**
 * Berechnet cent-genau die Trinkgeldaufteilung.
 * Standard (ohne Profil oder bei Profil mit waiterPercent=100) verbleibt 100% bei der Bedienung.
 */
export function calculateTipDistribution(
  tipAmount: number,
  profile?: TipProfileInput | null
): TipDistributionResult {
  const totalCents = toCents(Math.max(0, tipAmount));
  if (totalCents === 0) {
    return {
      totalTip: 0,
      waiterShare: 0,
      barShare: 0,
      kitchenShare: 0,
      serviceShare: 0,
      poolShare: 0,
    };
  }

  const waiterPct = typeof profile?.waiterPercent === 'number' ? Math.max(0, profile.waiterPercent) : 100.0;
  const barPct = typeof profile?.barPoolPercent === 'number' ? Math.max(0, profile.barPoolPercent) : 0.0;
  const kitchenPct = typeof profile?.kitchenPoolPercent === 'number' ? Math.max(0, profile.kitchenPoolPercent) : 0.0;
  const servicePct = typeof profile?.servicePoolPercent === 'number' ? Math.max(0, profile.servicePoolPercent) : 0.0;

  const totalPct = waiterPct + barPct + kitchenPct + servicePct;
  const normFactor = totalPct > 0 ? 100.0 / totalPct : 1.0;

  const barCents = Math.round((totalCents * barPct * normFactor) / 100);
  const kitchenCents = Math.round((totalCents * kitchenPct * normFactor) / 100);
  const serviceCents = Math.round((totalCents * servicePct * normFactor) / 100);
  
  // Der Rest verbleibt bei der Bedienung, um Rundungsdifferenzen cent-genau aufzufangen
  const waiterCents = Math.max(0, totalCents - (barCents + kitchenCents + serviceCents));
  const poolCents = barCents + kitchenCents + serviceCents;

  return {
    totalTip: toEuro(totalCents),
    waiterShare: toEuro(waiterCents),
    barShare: toEuro(barCents),
    kitchenShare: toEuro(kitchenCents),
    serviceShare: toEuro(serviceCents),
    poolShare: toEuro(poolCents),
  };
}
