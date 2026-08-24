import type { PrintItem } from './types';

/**
 * Spec 6.1: Reine Aufteilungs-Logik für das Tablett-Limit.
 *
 * Bewusst frei von Datenbank- und Netzwerkabhängigkeiten, damit die Regeln
 * in der Test-Suite ohne Prisma-Client und ohne Drucker geprüft werden können.
 */

/**
 * Erzeugt die Kurzbeschreibung für die Tablett-Kopfzeile,
 * z. B. "Tisch 14 - 6x Bier".
 */
export function buildTraySummary(
  tableLabel: string | null | undefined,
  items: PrintItem[]
): string {
  const place = tableLabel || 'Theke';
  if (items.length === 0) return place;

  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
  if (items.length === 1) {
    return `${place} - ${totalQty}x ${items[0].alternativeName || items[0].name}`;
  }
  return `${place} - ${totalQty} Pos. / ${items.length} Artikel`;
}

/**
 * Teilt die Positionen einer Druckgruppe so auf, dass pro Bon höchstens
 * `maxItems` Einheiten stehen (Tablett-Limit).
 *
 * - `maxItems <= 0` bedeutet "unbegrenzt" (alles auf einem Bon)
 * - `maxItems === 1` erzeugt Einzelbons je Stück
 */
export function splitItemsIntoChunks(items: PrintItem[], maxItems: number): PrintItem[][] {
  if (items.length === 0) return [];

  if (maxItems === 1) {
    const chunks: PrintItem[][] = [];
    for (const item of items) {
      for (let q = 0; q < item.quantity; q++) {
        chunks.push([{ ...item, quantity: 1 }]);
      }
    }
    return chunks;
  }

  if (maxItems <= 0) {
    return [items];
  }

  const chunks: PrintItem[][] = [];
  let current: PrintItem[] = [];
  let count = 0;

  for (const item of items) {
    let remaining = item.quantity;
    while (remaining > 0) {
      const fit = Math.min(remaining, maxItems - count);
      if (fit > 0) {
        current.push({ ...item, quantity: fit });
        count += fit;
        remaining -= fit;
      }
      if (count >= maxItems) {
        chunks.push(current);
        current = [];
        count = 0;
      }
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}
