import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const groups = await prisma.customizationWordGroup.findMany({
      orderBy: { sortIndex: 'asc' },
    });
    return NextResponse.json(
      groups.map((g) => ({
        ...g,
        words: JSON.parse(g.words || '[]'),
      }))
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const created = await prisma.customizationWordGroup.create({
      data: {
        name: body.name,
        words: JSON.stringify(body.words || []),
        sortIndex: body.sortIndex ?? 0,
      },
    });
    return NextResponse.json({
      ...created,
      words: JSON.parse(created.words),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
