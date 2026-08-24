import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const taps = await prisma.tapLine.findMany({
      orderBy: { tapNumber: 'asc' },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            stockQuantity: true,
          },
        },
      },
    });

    const enrichedTaps = taps.map((tap) => {
      const percent = tap.kegVolumeLiters > 0
        ? Math.min(100, Math.max(0, (tap.currentVolumeLiters / tap.kegVolumeLiters) * 100))
        : 0;
      
      const effectivePortion = tap.portionSizeLiters * (1 + tap.lossPercentage / 100);
      const portionsRemaining = effectivePortion > 0
        ? Math.floor(tap.currentVolumeLiters / effectivePortion)
        : 0;

      const isWarning = percent <= tap.warningLevelPercent;

      return {
        ...tap,
        fillPercentage: Number(percent.toFixed(1)),
        portionsRemaining,
        isWarning,
      };
    });

    return NextResponse.json(enrichedTaps);
  } catch (error) {
    console.error('Error fetching taps:', error);
    return NextResponse.json({ error: 'Fehler beim Laden der Zapfhähne.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      tapNumber,
      name,
      kegVolumeLiters = 50.0,
      currentVolumeLiters,
      portionSizeLiters = 0.5,
      lossPercentage = 3.0,
      warningLevelPercent = 10.0,
      productId,
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name ist erforderlich.' }, { status: 400 });
    }

    const tap = await prisma.tapLine.create({
      data: {
        tapNumber: Number(tapNumber) || 1,
        name,
        kegVolumeLiters: Number(kegVolumeLiters),
        currentVolumeLiters: currentVolumeLiters !== undefined ? Number(currentVolumeLiters) : Number(kegVolumeLiters),
        portionSizeLiters: Number(portionSizeLiters),
        lossPercentage: Number(lossPercentage),
        warningLevelPercent: Number(warningLevelPercent),
        productId: productId || null,
        kegsTapped: 1,
      },
      include: { product: true },
    });

    if (global.io) {
      global.io.emit('tap:updated', tap);
    }

    return NextResponse.json(tap);
  } catch (error) {
    console.error('Error creating tap:', error);
    return NextResponse.json({ error: 'Fehler beim Anlegen des Zapfhahns.' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, action, kegVolumeLiters, currentVolumeLiters, name, portionSizeLiters, lossPercentage, warningLevelPercent, productId, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID ist erforderlich.' }, { status: 400 });
    }

    const currentTap = await prisma.tapLine.findUnique({ where: { id } });
    if (!currentTap) {
      return NextResponse.json({ error: 'Zapfhahn nicht gefunden.' }, { status: 404 });
    }

    let updateData: Record<string, unknown> = {};

    if (action === 'CHANGE_KEG') {
      const volume = kegVolumeLiters ? Number(kegVolumeLiters) : currentTap.kegVolumeLiters;
      updateData = {
        kegVolumeLiters: volume,
        currentVolumeLiters: volume,
        kegsTapped: currentTap.kegsTapped + 1,
      };
    } else if (action === 'SET_VOLUME') {
      updateData = {
        currentVolumeLiters: Math.max(0, Number(currentVolumeLiters)),
      };
    } else {
      // General update
      if (name !== undefined) updateData.name = name;
      if (kegVolumeLiters !== undefined) updateData.kegVolumeLiters = Number(kegVolumeLiters);
      if (currentVolumeLiters !== undefined) updateData.currentVolumeLiters = Number(currentVolumeLiters);
      if (portionSizeLiters !== undefined) updateData.portionSizeLiters = Number(portionSizeLiters);
      if (lossPercentage !== undefined) updateData.lossPercentage = Number(lossPercentage);
      if (warningLevelPercent !== undefined) updateData.warningLevelPercent = Number(warningLevelPercent);
      if (productId !== undefined) updateData.productId = productId || null;
      if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    }

    const updatedTap = await prisma.tapLine.update({
      where: { id },
      data: updateData,
      include: { product: true },
    });

    if (global.io) {
      global.io.emit('tap:updated', updatedTap);
    }

    return NextResponse.json(updatedTap);
  } catch (error) {
    console.error('Error updating tap:', error);
    return NextResponse.json({ error: 'Fehler beim Aktualisieren des Zapfhahns.' }, { status: 500 });
  }
}
