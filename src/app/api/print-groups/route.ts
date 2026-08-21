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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
