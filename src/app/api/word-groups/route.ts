import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const groups = await prisma.customizationWordGroup.findMany({
      orderBy: { sortIndex: 'asc' },
    });
    const seenNames = new Set<string>();
    const uniqueGroups: any[] = [];
    for (const g of groups) {
      const key = g.name.toLowerCase().trim();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        uniqueGroups.push({
          ...g,
          words: typeof g.words === 'string' ? JSON.parse(g.words || '[]') : g.words,
        });
      }
    }
    return NextResponse.json(uniqueGroups);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
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
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
