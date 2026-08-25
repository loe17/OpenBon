import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
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
  try {
    const body = await req.json();
    const created = await prisma.printGroup.create({
      data: {
        name: body.name,
        printerId: body.printerId || null,
        maxItemsPerTicket: parseInt(body.maxItemsPerTicket || 0, 10),
        autoCut: body.autoCut ?? true,
      },
    });
    return NextResponse.json(created);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const updated = await prisma.printGroup.update({
      where: { id: body.id },
      data: {
        name: body.name,
        printerId: body.printerId || null,
        maxItemsPerTicket: body.maxItemsPerTicket !== undefined ? parseInt(body.maxItemsPerTicket, 10) : undefined,
        autoCut: body.autoCut,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
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
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
