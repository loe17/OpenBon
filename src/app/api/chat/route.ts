import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const messages = await prisma.chatMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json(messages.reverse());
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const created = await prisma.chatMessage.create({
      data: {
        senderName: body.senderName || 'Leitung',
        senderDeviceId: body.senderDeviceId || null,
        targetDeviceId: body.targetDeviceId || null,
        message: body.message,
        isUrgent: body.isUrgent ?? false,
      },
    });

    if (global.io) {
      global.io.emit('chat:incoming', created);
    }

    return NextResponse.json(created);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
