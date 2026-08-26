import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';

/**
 * Verbrauchszuordnung: welcher Artikel, welcher Untereintrag oder welche
 * Option zieht wie viel von einem Lagerposten ab.
 *
 * Genau EINES der drei Ziele (productId / variantId / optionId) muss gesetzt
 * sein. Wird `amount` auf 0 gesetzt, wird die Zuordnung entfernt — so lässt
 * sich die Pflegeoberfläche mit einem einzigen Aufruf bedienen.
 */

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json()) as {
      stockUnitId?: string;
      productId?: string | null;
      variantId?: string | null;
      optionId?: string | null;
      amount?: number;
    };

    if (!body.stockUnitId) {
      return NextResponse.json({ error: 'Kennung des Lagerpostens fehlt.' }, { status: 400 });
    }

    const targets = [body.productId, body.variantId, body.optionId].filter(Boolean);
    if (targets.length !== 1) {
      return NextResponse.json(
        { error: 'Genau ein Ziel angeben: Artikel, Untereintrag oder Option.' },
        { status: 400 }
      );
    }

    const unit = await prisma.stockUnit.findUnique({ where: { id: body.stockUnitId } });
    if (!unit) {
      return NextResponse.json({ error: 'Lagerposten nicht gefunden.' }, { status: 404 });
    }

    const target = {
      stockUnitId: body.stockUnitId,
      productId: body.productId ?? null,
      variantId: body.variantId ?? null,
      optionId: body.optionId ?? null,
    };

    const amount = Number(body.amount);

    // Verbrauch 0 (oder negativ) bedeutet: Zuordnung aufheben.
    if (!Number.isFinite(amount) || amount <= 0) {
      await prisma.stockConsumption.deleteMany({ where: target });

      await logSystemActionSafe(() => ({
        action: 'STOCK_CONSUMPTION_REMOVED',
        category: 'ADMIN',
        actor: auth.session.waiterName || auth.session.role,
        details: `Verbrauchszuordnung an Lagerposten „${unit.name}" entfernt.`,
        metadata: { stockUnitId: unit.id, ...body },
      }));

      if (global.io) global.io.emit('stock:updated', { stockUnitId: unit.id });
      return NextResponse.json({ success: true, removed: true });
    }

    // Vorhandene Zuordnung ersetzen. Kein upsert, weil ein zusammengesetzter
    // Eindeutigkeitsschluessel mit NULL-Spalten dafuer nicht taugt.
    await prisma.stockConsumption.deleteMany({ where: target });
    const entry = await prisma.stockConsumption.create({
      data: { ...target, amount },
    });

    await logSystemActionSafe(() => ({
      action: 'STOCK_CONSUMPTION_SET',
      category: 'ADMIN',
      actor: auth.session.waiterName || auth.session.role,
      details: `Verbrauch am Lagerposten „${unit.name}" auf ${amount} ${unit.unitLabel} gesetzt.`,
      metadata: { stockUnitId: unit.id, consumptionId: entry.id, amount },
    }));

    if (global.io) global.io.emit('stock:updated', { stockUnitId: unit.id });

    return NextResponse.json(entry);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
