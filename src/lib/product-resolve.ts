import { parseSelectedOptions, type SelectedOption } from './stock';
import { toCents, toEuro } from './pricing';

/**
 * Auflösung von Artikel, Untereintrag und Optionen an EINER Stelle.
 *
 * Zwei Dinge werden hier zusammengeführt:
 *
 * 1. **Vererbung der Untereinträge.** Ein Untereintrag darf eigene Werte
 *    tragen (Bontext, Farbe, Druckgruppe, Pfand, Steuersatz). Bleibt ein Feld
 *    leer, gilt der Wert des Hauptartikels. Vorher waren Untereinträge flach
 *    und kannten nur einen Preisunterschied.
 *
 * 2. **Optionen mit Anzahl.** Eine Option kann mehrfach gewählt werden
 *    (Beispiel Schlachtplatte: 2× Bratwurst, 1× Leberwurst). Der Aufpreis
 *    zählt entsprechend mehrfach. `maxQuantity = 1` verhält sich wie bisher.
 *
 * Preise werden ausschließlich serverseitig berechnet — die Oberfläche zeigt
 * sie nur an. Deshalb liegt diese Logik in einer Bibliothek und nicht in den
 * Routen, damit /api/orders, /api/orders/checkout und /api/guest/orders
 * garantiert dasselbe rechnen.
 *
 * Harter Cent-Cut: Alle Geldbetraege sind Int-Cent (*Cents).
 */

export interface ResolvableVariant {
  id: string;
  name: string;
  priceDeltaCents: number;
  /** @deprecated Legacy Euro-Delta */
  priceDelta?: number;
  alternativeTicketName?: string | null;
  color?: string | null;
  printGroupId?: string | null;
  depositCents?: number | null;
  /** @deprecated Legacy Euro-Pfand */
  deposit?: number | null;
  taxRate?: number | null;
}

export interface ResolvableOption {
  id: string;
  name: string;
  priceDeltaCents: number;
  /** @deprecated Legacy Euro-Delta */
  priceDelta?: number;
  defaultQuantity?: number;
  maxQuantity?: number;
}

export interface ResolvableProduct {
  id: string;
  name: string;
  depositCents?: number | null;
  /** @deprecated Legacy Euro-Pfand */
  deposit?: number | null;
  taxRate?: number | null;
  alternativeTicketName?: string | null;
  color?: string | null;
  printGroupId?: string | null;
  variants?: ResolvableVariant[];
  options?: ResolvableOption[];
}

export interface ResolvedItem {
  /** Preis einer Einheit in Cent inklusive Untereintrag und aller gewählten Optionen. */
  unitPriceCents: number;
  depositCents: number;
  taxRate: number;
  /** Text, der auf dem Bon steht (Untereintrag hat Vorrang). */
  ticketName: string;
  color: string | null;
  printGroupId: string | null;
  variantName: string | null;
  /** Normalisierte Optionen mit Anzahl - so werden sie gespeichert. */
  options: SelectedOption[];
  /** @deprecated Anzeige-Euro, abgeleitet aus unitPriceCents */
  unitPrice: number;
  /** @deprecated Anzeige-Euro, abgeleitet aus depositCents */
  deposit: number;
}

/**
 * Begrenzt die gewählte Anzahl einer Option auf das erlaubte Höchstmaß.
 * Ein `maxQuantity` von 0 oder darunter gilt als „unbegrenzt“.
 */
function clampOptionQuantity(chosen: number, option: ResolvableOption): number {
  const max = Number(option.maxQuantity ?? 1);
  const wanted = Math.max(1, Math.floor(chosen));
  if (!Number.isFinite(max) || max <= 0) return wanted;
  return Math.min(wanted, Math.floor(max));
}

function deltaCentsOf(o: { priceDeltaCents?: number | null; priceDelta?: number | null }): number {
  if (typeof o.priceDeltaCents === 'number') return Math.round(o.priceDeltaCents);
  if (typeof o.priceDelta === 'number') return toCents(o.priceDelta);
  return 0;
}

function depositCentsOf(o: { depositCents?: number | null; deposit?: number | null }): number | null {
  if (typeof o.depositCents === 'number') return Math.round(o.depositCents);
  if (typeof o.deposit === 'number') return toCents(o.deposit);
  return null;
}

/**
 * Löst eine Bestellposition vollständig auf.
 *
 * @param basePriceCents Grundpreis des Artikels in Cent zum Bestellzeitpunkt
 *   (Happy Hour etc. wird vorher über getEffectiveProductPrice ermittelt und
 *   liefert priceCents).
 */
export function resolveOrderItem(
  product: ResolvableProduct,
  basePriceCents: number,
  input: { variantName?: string | null; selectedOptions?: unknown }
): ResolvedItem {
  const variant = input.variantName
    ? (product.variants || []).find((v) => v.name === input.variantName) || null
    : null;

  let unitPriceCents = Math.round(basePriceCents);
  if (variant) unitPriceCents += deltaCentsOf(variant);

  // Gewählte Optionen normalisieren und mit der Stammdatendefinition abgleichen.
  const requested = parseSelectedOptions(input.selectedOptions);
  const options: SelectedOption[] = [];

  for (const req of requested) {
    const def = (product.options || []).find((o) => o.name === req.name);
    if (!def) {
      // Freitext-Zusatzwunsch ohne hinterlegte Option: ohne Aufpreis übernehmen.
      options.push({ name: req.name, quantity: 1 });
      continue;
    }
    const quantity = clampOptionQuantity(req.quantity, def);
    unitPriceCents += deltaCentsOf(def) * quantity;
    options.push({ name: def.name, quantity });
  }

  // Vererbung: Der Untereintrag gewinnt, wenn er einen eigenen Wert trägt.
  const pick = <T>(own: T | null | undefined, inherited: T | null | undefined): T | null => {
    if (own !== null && own !== undefined && own !== ('' as unknown as T)) return own;
    return inherited === undefined ? null : (inherited as T | null);
  };

  const ticketName =
    pick(variant?.alternativeTicketName, product.alternativeTicketName) ||
    (variant ? `${product.name} ${variant.name}` : product.name);

  const depositCents = Number(pick(depositCentsOf(variant ?? {}), depositCentsOf(product)) ?? 0);

  return {
    unitPriceCents,
    depositCents,
    taxRate: Number(pick(variant?.taxRate, product.taxRate) ?? 19),
    ticketName,
    color: pick(variant?.color, product.color),
    printGroupId: pick(variant?.printGroupId, product.printGroupId),
    variantName: variant ? variant.name : null,
    options,
    unitPrice: toEuro(unitPriceCents),
    deposit: toEuro(depositCents),
  };
}

/**
 * Voreingestellte Optionen eines Artikels — die Bestelloberfläche startet damit,
 * damit häufige Zusammenstellungen nicht jedes Mal angetippt werden müssen.
 */
export function defaultOptionsFor(product: ResolvableProduct): SelectedOption[] {
  return (product.options || [])
    .filter((o) => Number(o.defaultQuantity ?? 0) > 0)
    .map((o) => ({ name: o.name, quantity: clampOptionQuantity(Number(o.defaultQuantity), o) }));
}
