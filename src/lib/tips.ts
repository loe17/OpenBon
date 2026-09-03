import { toCents, toEuro } from './pricing';

/**
 * Trinkgeld-Verteilungsengine (Spec V2 §5.3).
 *
 * Berechnet die cent-genaue Aufteilung von Trinkgeldern gemaess dem
 * zugewiesenen TipProfile der jeweiligen Bedienung.
 * Harter Cent-Cut: Ein- und Ausgaben sind Int-Cent.
 */

export interface TipProfileInput {
  name?: string;
  waiterPercent?: number;      // Default: 100.0 (100% an die Bedienung)
  barPoolPercent?: number;     // z. B. 0.0 bis 100.0
  kitchenPoolPercent?: number; // z. B. 0.0 bis 100.0
  servicePoolPercent?: number; // z. B. 0.0 bis 100.0
}

export interface TipDistributionResult {
  totalTipCents: number;
  waiterShareCents: number;
  barShareCents: number;
  kitchenShareCents: number;
  serviceShareCents: number;
  poolShareCents: number; // Summe aller Pool-Anteile (Bar + Kitchen + Service)
  /** @deprecated Anzeige-Euro */
  totalTip: number;
  /** @deprecated Anzeige-Euro */
  waiterShare: number;
  /** @deprecated Anzeige-Euro */
  barShare: number;
  /** @deprecated Anzeige-Euro */
  kitchenShare: number;
  /** @deprecated Anzeige-Euro */
  serviceShare: number;
  /** @deprecated Anzeige-Euro */
  poolShare: number;
}

/**
 * Berechnet cent-genau die Trinkgeldaufteilung.
 * Standard (ohne Profil oder bei Profil mit waiterPercent=100) verbleibt 100% bei der Bedienung.
 *
 * @param tipAmountCents Trinkgeld in Int-Cent. Ein Legacy-Eurobetrag wird erkannt,
 *   wenn zusaetzlich `tipAmountEuro` uebergeben wird – direkte Euro-Uebergabe ohne
 *   Kennzeichnung ist nicht vorgesehen.
 */
export function calculateTipDistribution(
  tipAmountCents: number,
  profile?: TipProfileInput | null
): TipDistributionResult {
  const totalCents = Math.max(0, Math.round(tipAmountCents));
  if (totalCents === 0) {
    return {
      totalTipCents: 0,
      waiterShareCents: 0,
      barShareCents: 0,
      kitchenShareCents: 0,
      serviceShareCents: 0,
      poolShareCents: 0,
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
    totalTipCents: totalCents,
    waiterShareCents: waiterCents,
    barShareCents: barCents,
    kitchenShareCents: kitchenCents,
    serviceShareCents: serviceCents,
    poolShareCents: poolCents,
    totalTip: toEuro(totalCents),
    waiterShare: toEuro(waiterCents),
    barShare: toEuro(barCents),
    kitchenShare: toEuro(kitchenCents),
    serviceShare: toEuro(serviceCents),
    poolShare: toEuro(poolCents),
  };
}

/** @deprecated Legacy-Wrapper: nimmt Euro entgegen, rechnet in Cent um. */
export function calculateTipDistributionFromEuro(
  tipAmountEuro: number,
  profile?: TipProfileInput | null
): TipDistributionResult {
  return calculateTipDistribution(toCents(Math.max(0, tipAmountEuro)), profile);
}
