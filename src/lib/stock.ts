import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Lagerposten mit Verbrauchszuordnung.
 *
 * Warum es das zusätzlich zu `StockItem` gibt
 * -------------------------------------------
 * `StockItem` hängt über `productId @unique` an genau EINEM Artikel. Damit
 * lässt sich nicht abbilden, dass mehrere Artikel denselben Vorrat aufbrauchen
 * — auf einem Fest der Normalfall: Bratwurstsemmel, Steaksemmel und
 * Currywurst greifen alle auf dieselben Brötchen zu. Läuft der Brötchenvorrat
 * leer, müssen alle drei gesperrt werden, nicht nur einer.
 *
 * `StockUnit` ist deshalb der Vorrat als eigenständige Einheit,
 * `StockConsumption` sagt, welcher Artikel, welcher Untereintrag oder welche
 * Option wie viel davon zieht. `StockItem` bleibt unangetastet und läuft
 * parallel weiter — beide Prüfungen greifen.
 */

/** Eine Bestellposition, so wie sie aus der Oberfläche kommt. */
export interface StockRelevantItem {
  productId: string;
  quantity: number;
  variantName?: string | null;
  /** Entweder Namen (alte Form) oder {name, quantity} (mehrfach wählbare Optionen). */
  selectedOptions?: unknown;
}

/** Aufgelöste Option mit Anzahl. */
export interface SelectedOption {
  name: string;
  quantity: number;
}

export interface ConsumptionLine {
  stockUnitId: string;
  stockUnitName: string;
  unitLabel: string;
  required: number;
  available: number;
  blockWhenEmpty: boolean;
}

type TxClient = Prisma.TransactionClient | PrismaClient;

/**
 * Liest die gewählten Optionen in einer einheitlichen Form aus.
 *
 * Historisch war `selectedOptions` ein Array von Namen (`["ohne Senf"]`).
 * Mit mehrfach wählbaren Optionen kommt zusätzlich die Form
 * `[{ name: "Bratwurst", quantity: 2 }]` vor. Beides muss dauerhaft
 * funktionieren, weil in bereits gespeicherten Bestellungen die alte Form steht.
 */
export function parseSelectedOptions(raw: unknown): SelectedOption[] {
  if (!raw) return [];

  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      // Freitext ohne JSON-Struktur: als einzelne Option mit Anzahl 1 werten
      return raw.trim() ? [{ name: raw.trim(), quantity: 1 }] : [];
    }
  }

  if (!Array.isArray(value)) return [];

  const out: SelectedOption[] = [];
  for (const entry of value) {
    if (typeof entry === 'string') {
      if (entry.trim()) out.push({ name: entry.trim(), quantity: 1 });
      continue;
    }
    if (entry && typeof entry === 'object') {
      const name = String((entry as { name?: unknown }).name ?? '').trim();
      if (!name) continue;
      const qtyRaw = Number((entry as { quantity?: unknown }).quantity ?? 1);
      const quantity = Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.floor(qtyRaw) : 1;
      out.push({ name, quantity });
    }
  }
  return out;
}

/**
 * Rechnet aus, wie viel von welchem Lagerposten eine Bestellung verbraucht.
 *
 * Berücksichtigt werden Verbräuche am Artikel selbst, am gewählten
 * Untereintrag und an jeder gewählten Option (jeweils mal deren Anzahl).
 */
export async function computeConsumption(
  tx: TxClient,
  items: StockRelevantItem[]
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (items.length === 0) return totals;

  const productIds = Array.from(new Set(items.map((i) => i.productId).filter(Boolean)));
  if (productIds.length === 0) return totals;

  // Alle Verbräuche laden, die diese Artikel betreffen - inklusive der
  // Verbräuche an ihren Untereinträgen und Optionen.
  const consumptions = await tx.stockConsumption.findMany({
    where: {
      OR: [
        { productId: { in: productIds } },
        { variant: { productId: { in: productIds } } },
        { option: { productId: { in: productIds } } },
      ],
    },
    select: {
      stockUnitId: true,
      amount: true,
      productId: true,
      variant: { select: { id: true, productId: true, name: true } },
      option: { select: { id: true, productId: true, name: true } },
    },
  });

  if (consumptions.length === 0) return totals;

  const add = (stockUnitId: string, amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    totals.set(stockUnitId, (totals.get(stockUnitId) || 0) + amount);
  };

  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) continue;

    const options = parseSelectedOptions(item.selectedOptions);

    for (const c of consumptions) {
      // Verbrauch am Artikel selbst
      if (c.productId && c.productId === item.productId) {
        add(c.stockUnitId, c.amount * qty);
        continue;
      }

      // Verbrauch am gewählten Untereintrag.
      // Abgleich über den Namen, weil in der Bestellposition nur der Name
      // gespeichert wird (OrderItem.variantName), nicht die Kennung.
      if (c.variant && c.variant.productId === item.productId) {
        if (item.variantName && c.variant.name === item.variantName) {
          add(c.stockUnitId, c.amount * qty);
        }
        continue;
      }

      // Verbrauch an einer gewählten Option, mal deren Anzahl
      if (c.option && c.option.productId === item.productId) {
        const chosen = options.find((o) => o.name === c.option!.name);
        if (chosen) {
          add(c.stockUnitId, c.amount * qty * chosen.quantity);
        }
      }
    }
  }

  return totals;
}

/**
 * Prüft, ob die Bestellung gedeckt ist. Gibt die Zeilen zurück, die NICHT
 * reichen — eine leere Liste bedeutet: alles verfügbar.
 */
export async function checkStockUnits(
  tx: TxClient,
  items: StockRelevantItem[]
): Promise<ConsumptionLine[]> {
  const totals = await computeConsumption(tx, items);
  if (totals.size === 0) return [];

  const units = await tx.stockUnit.findMany({
    where: { id: { in: Array.from(totals.keys()) }, isActive: true },
  });

  const short: ConsumptionLine[] = [];
  for (const unit of units) {
    const required = totals.get(unit.id) || 0;
    if (!unit.blockWhenEmpty) continue;
    if (required > unit.currentQuantity) {
      short.push({
        stockUnitId: unit.id,
        stockUnitName: unit.name,
        unitLabel: unit.unitLabel,
        required,
        available: unit.currentQuantity,
        blockWhenEmpty: unit.blockWhenEmpty,
      });
    }
  }
  return short;
}

/**
 * Wirft eine sprechende Fehlermeldung, wenn ein Lagerposten nicht reicht.
 * Wird in derselben Transaktion aufgerufen wie das Anlegen der Bestellung,
 * damit zwei gleichzeitige Bestellungen denselben Vorrat nicht doppelt
 * verplanen können.
 */
export async function assertStockUnitsAvailable(
  tx: TxClient,
  items: StockRelevantItem[]
): Promise<void> {
  const short = await checkStockUnits(tx, items);
  if (short.length === 0) return;

  const details = short
    .map(
      (s) =>
        `${s.stockUnitName}: benötigt ${s.required} ${s.unitLabel}, vorhanden ${s.available}`
    )
    .join('; ');
  throw new Error(`Nicht genügend Vorrat vorhanden. ${details}`);
}

/**
 * Bucht den Verbrauch ab und sperrt Artikel, deren Vorrat aufgebraucht ist.
 * Gibt die Kennungen der Lagerposten zurück, die dabei leer gelaufen sind.
 */
export async function applyStockConsumption(
  tx: TxClient,
  items: StockRelevantItem[],
  options?: { isTraining?: boolean }
): Promise<{ depletedUnitIds: string[]; blockedProductIds: string[] }> {
  if (options?.isTraining) return { depletedUnitIds: [], blockedProductIds: [] };

  const totals = await computeConsumption(tx, items);
  if (totals.size === 0) return { depletedUnitIds: [], blockedProductIds: [] };

  const depletedUnitIds: string[] = [];

  for (const [unitId, required] of totals.entries()) {
    const unit = await tx.stockUnit.findUnique({ where: { id: unitId } });
    if (!unit || !unit.isActive) continue;

    const newQty = Math.max(0, unit.currentQuantity - required);
    await tx.stockUnit.update({
      where: { id: unitId },
      data: { currentQuantity: newQty },
    });
    if (newQty <= 0) depletedUnitIds.push(unitId);
  }

  if (depletedUnitIds.length === 0) return { depletedUnitIds, blockedProductIds: [] };

  // Alle Artikel sperren, die von einem leeren Vorrat abhängen - auch die,
  // die nur über einen Untereintrag oder eine Option daran hängen.
  const affected = await tx.stockConsumption.findMany({
    where: { stockUnitId: { in: depletedUnitIds } },
    select: {
      productId: true,
      variant: { select: { productId: true } },
      option: { select: { productId: true } },
      stockUnit: { select: { blockWhenEmpty: true } },
    },
  });

  const blockedProductIds = Array.from(
    new Set(
      affected
        .filter((a) => a.stockUnit.blockWhenEmpty)
        .map((a) => a.productId || a.variant?.productId || a.option?.productId)
        .filter((id): id is string => Boolean(id))
    )
  );

  if (blockedProductIds.length > 0) {
    await tx.product.updateMany({
      where: { id: { in: blockedProductIds } },
      data: { isSoldOut: true },
    });
  }

  return { depletedUnitIds, blockedProductIds };
}
