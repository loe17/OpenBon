import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { name, pin, tipProfileId, isActive } = body;

    const updated = await prisma.waiterProfile.update({
      where: { id },
      data: {
        name,
        pin,
        tipProfileId: tipProfileId !== undefined ? tipProfileId : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
      include: {
        tipProfile: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT /api/waiters/[id] error:', error);
    return NextResponse.json({ error: 'Fehler beim Aktualisieren des Kellners' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    await prisma.waiterProfile.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/waiters/[id] error:', error);
    return NextResponse.json({ error: 'Fehler beim Löschen des Kellners' }, { status: 500 });
  }
}
