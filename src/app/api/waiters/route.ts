import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const waiters = await prisma.waiterProfile.findMany({
      select: {
        id: true,
        name: true,
        isActive: true,
        tipProfileId: true,
        tipProfile: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(waiters);
  } catch (error) {
    return NextResponse.json({ error: 'Fehler beim Laden der Kellner' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, pin, tipProfileId, isActive } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 });
    }

    const waiter = await prisma.waiterProfile.create({
      data: {
        name,
        pin: pin || '3333',
        tipProfileId: tipProfileId || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
      include: {
        tipProfile: true,
      },
    });

    return NextResponse.json(waiter, { status: 201 });
  } catch (error) {
    console.error('POST /api/waiters error:', error);
    return NextResponse.json({ error: 'Fehler beim Anlegen des Kellners' }, { status: 500 });
  }
}
