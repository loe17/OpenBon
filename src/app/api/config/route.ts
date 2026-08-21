import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import haService from '@/lib/ha/ha-service';

export async function GET() {
  try {
    let config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      config = await prisma.eventConfig.create({
        data: {
          id: 'default',
          name: 'Vereinsfest 2026',
        },
      });
    }
    return NextResponse.json(config);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const updated = await prisma.eventConfig.upsert({
      where: { id: 'default' },
      update: body,
      create: { id: 'default', ...body },
    });

    if (body.haRole) {
      haService.setRole(body.haRole);
    }

    if (global.io) {
      global.io.emit('config:updated', updated);
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
