import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';

export async function GET(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const messages = await prisma.chatMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json(messages.reverse());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const { validateBody, ChatMessageSchema } = await import('@/lib/validations/schemas');
    const v = await validateBody(req, ChatMessageSchema);
    if (!v.success) return v.response;
    const body = v.data;
    const created = await prisma.chatMessage.create({
      data: {
        senderName: auth.session.waiterName || body.senderName,
        senderDeviceId: null,
        targetDeviceId: body.targetDeviceId || null,
        message: body.message,
        isUrgent: body.isUrgent ?? false,
      },
    });

    if (global.io) {
      global.io.emit('chat:incoming', created);
      if (body.isUrgent) {
        global.io.emit('broadcast:alert', {
          message: created.message,
          sender: created.senderName,
          timestamp: created.createdAt,
        });
      }
    }

    await logSystemActionSafe(() => ({
      action: 'CHAT_MESSAGE',
      category: 'GENERAL',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Team-Funk Nachricht gesendet.',
    }));

    return NextResponse.json(created);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
