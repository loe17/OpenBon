import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';

export async function GET(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const printGroups = await prisma.printGroup.findMany({
      include: {
        printer: true,
        products: {
          select: { id: true, name: true },
        },
      },
    });
    return NextResponse.json(printGroups);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();

    const name = String(body.name || '').trim();
    if (name.length < 2) {
      return NextResponse.json(
        { error: 'Bitte einen Namen mit mindestens zwei Zeichen angeben.' },
        { status: 400 }
      );
    }

    const created = await prisma.printGroup.create({
      data: {
        name,
        printerId: body.printerId || null,
        fallbackPrinterId: body.fallbackPrinterId || null,
        maxItemsPerTicket: Math.max(0, parseInt(body.maxItemsPerTicket || 0, 10) || 0),
        autoCut: body.autoCut ?? true,
      },
    });
    await logSystemActionSafe(() => ({
      action: 'PRINT_GROUP_CREATED',
      category: 'SYSTEM',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Druckgruppe angelegt.',
    }));

    return NextResponse.json(created);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const updated = await prisma.printGroup.update({
      where: { id: body.id },
      data: {
        name: body.name,
        printerId: body.printerId || null,
        fallbackPrinterId: body.fallbackPrinterId || null,
        maxItemsPerTicket: body.maxItemsPerTicket !== undefined ? parseInt(body.maxItemsPerTicket, 10) : undefined,
        autoCut: body.autoCut,
      },
    });
    await logSystemActionSafe(() => ({
      action: 'PRINT_GROUP_UPDATED',
      category: 'SYSTEM',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Druckgruppe geaendert.',
    }));

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Druckgruppen-ID fehlt' }, { status: 400 });

    // Produkte Referenzen lösen
    await prisma.product.updateMany({
      where: { printGroupId: id },
      data: { printGroupId: null },
    });

    await prisma.printGroup.delete({ where: { id } });
    await logSystemActionSafe(() => ({
      action: 'PRINT_GROUP_DELETED',
      category: 'SYSTEM',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Druckgruppe geloescht.',
    }));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
