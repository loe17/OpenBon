import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';

/**
 * Lagerposten mit Verbrauchszuordnung.
 *
 * GET ist stationsoffen: Bedienung und Bonkasse zeigen an, wovon nur noch
 * wenig da ist. Schreibend ist die Verwaltung zuständig.
 *
 * Siehe `src/lib/stock.ts` für die Begründung, warum es das zusätzlich zu
 * `StockItem` gibt.
 */

export async function GET(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const units = await prisma.stockUnit.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: {
        consumptions: {
          include: {
            product: { select: { id: true, name: true } },
            variant: { select: { id: true, name: true, productId: true } },
            option: { select: { id: true, name: true, productId: true } },
          },
        },
      },
    });

    return NextResponse.json(
      units.map((u) => ({
        ...u,
        isLow: u.currentQuantity <= u.alertThreshold,
        isEmpty: u.currentQuantity <= 0,
      }))
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json()) as {
      name?: string;
      unitLabel?: string;
      initialQuantity?: number;
      currentQuantity?: number;
      alertThreshold?: number;
      blockWhenEmpty?: boolean;
      note?: string;
    };

    const name = String(body.name || '').trim();
    if (name.length < 2) {
      return NextResponse.json(
        { error: 'Der Name des Lagerpostens muss mindestens 2 Zeichen haben.' },
        { status: 400 }
      );
    }

    const existing = await prisma.stockUnit.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json(
        { error: `Ein Lagerposten mit dem Namen „${name}" besteht bereits.` },
        { status: 400 }
      );
    }

    const initial = Math.max(0, Number(body.initialQuantity) || 0);

    const unit = await prisma.stockUnit.create({
      data: {
        name,
        unitLabel: String(body.unitLabel || 'Stück').trim() || 'Stück',
        initialQuantity: initial,
        // Beim Anlegen entspricht der aktuelle Bestand dem Anfangsbestand,
        // sofern nichts anderes angegeben wurde.
        currentQuantity:
          body.currentQuantity === undefined ? initial : Math.max(0, Number(body.currentQuantity) || 0),
        alertThreshold: Math.max(0, Number(body.alertThreshold) || 0),
        blockWhenEmpty: body.blockWhenEmpty !== false,
        note: body.note ? String(body.note) : null,
      },
    });

    await logSystemActionSafe(() => ({
      action: 'STOCK_UNIT_CREATED',
      category: 'ADMIN',
      actor: auth.session.waiterName || auth.session.role,
      details: `Lagerposten „${unit.name}" angelegt (${unit.initialQuantity} ${unit.unitLabel}).`,
      metadata: { stockUnitId: unit.id },
    }));

    if (global.io) global.io.emit('stock:updated', { stockUnitId: unit.id });

    return NextResponse.json(unit);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json()) as {
      id?: string;
      name?: string;
      unitLabel?: string;
      initialQuantity?: number;
      currentQuantity?: number;
      alertThreshold?: number;
      isActive?: boolean;
      blockWhenEmpty?: boolean;
      note?: string | null;
    };

    if (!body.id) {
      return NextResponse.json({ error: 'Kennung des Lagerpostens fehlt.' }, { status: 400 });
    }

    const before = await prisma.stockUnit.findUnique({ where: { id: body.id } });
    if (!before) {
      return NextResponse.json({ error: 'Lagerposten nicht gefunden.' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (name.length < 2) {
        return NextResponse.json({ error: 'Der Name muss mindestens 2 Zeichen haben.' }, { status: 400 });
      }
      data.name = name;
    }
    if (body.unitLabel !== undefined) data.unitLabel = String(body.unitLabel).trim() || 'Stück';
    if (body.initialQuantity !== undefined) data.initialQuantity = Math.max(0, Number(body.initialQuantity) || 0);
    if (body.currentQuantity !== undefined) data.currentQuantity = Math.max(0, Number(body.currentQuantity) || 0);
    if (body.alertThreshold !== undefined) data.alertThreshold = Math.max(0, Number(body.alertThreshold) || 0);
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body.blockWhenEmpty !== undefined) data.blockWhenEmpty = Boolean(body.blockWhenEmpty);
    if (body.note !== undefined) data.note = body.note ? String(body.note) : null;

    const unit = await prisma.stockUnit.update({ where: { id: body.id }, data });

    // Wird nachgelegt, sind die betroffenen Artikel wieder bestellbar.
    // Ohne das bliebe ein Artikel gesperrt, obwohl wieder Vorrat da ist.
    if (before.currentQuantity <= 0 && unit.currentQuantity > 0) {
      const affected = await prisma.stockConsumption.findMany({
        where: { stockUnitId: unit.id },
        select: {
          productId: true,
          variant: { select: { productId: true } },
          option: { select: { productId: true } },
        },
      });
      const productIds = Array.from(
        new Set(
          affected
            .map((a) => a.productId || a.variant?.productId || a.option?.productId)
            .filter((id): id is string => Boolean(id))
        )
      );
      if (productIds.length > 0) {
        await prisma.product.updateMany({
          where: { id: { in: productIds } },
          data: { isSoldOut: false },
        });
      }
    }

    await logSystemActionSafe(() => ({
      action: 'STOCK_UNIT_UPDATED',
      category: 'ADMIN',
      actor: auth.session.waiterName || auth.session.role,
      details: `Lagerposten „${unit.name}": Bestand ${before.currentQuantity} → ${unit.currentQuantity} ${unit.unitLabel}.`,
      metadata: { stockUnitId: unit.id, before: before.currentQuantity, after: unit.currentQuantity },
    }));

    if (global.io) global.io.emit('stock:updated', { stockUnitId: unit.id });

    return NextResponse.json(unit);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Kennung fehlt.' }, { status: 400 });

    const unit = await prisma.stockUnit.findUnique({ where: { id } });
    if (!unit) return NextResponse.json({ error: 'Lagerposten nicht gefunden.' }, { status: 404 });

    // Die Verbrauchszuordnungen hängen per Cascade daran und verschwinden mit.
    await prisma.stockUnit.delete({ where: { id } });

    await logSystemActionSafe(() => ({
      action: 'STOCK_UNIT_DELETED',
      category: 'ADMIN',
      actor: auth.session.waiterName || auth.session.role,
      details: `Lagerposten „${unit.name}" gelöscht.`,
      metadata: { stockUnitId: id },
    }));

    if (global.io) global.io.emit('stock:updated', { stockUnitId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
