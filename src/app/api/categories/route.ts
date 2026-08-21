import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const categories = await prisma.productCategory.findMany({
      orderBy: { sortIndex: 'asc' },
      include: {
        products: {
          where: { status: { not: 'HIDDEN' } },
          orderBy: { sortIndex: 'asc' },
          include: {
            variants: { orderBy: { sortIndex: 'asc' } },
            options: { orderBy: { sortIndex: 'asc' } },
            stockItem: true,
            printGroup: {
              include: { printer: true },
            },
          },
        },
      },
    });
    return NextResponse.json(categories);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const created = await prisma.productCategory.create({
      data: {
        name: body.name,
        sortIndex: body.sortIndex ?? 0,
        color: body.color || '#3b82f6',
        icon: body.icon || 'Utensils',
      },
    });
    return NextResponse.json(created);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
