import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';

export async function GET(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

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
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const wordsArray = Array.isArray(body.words)
      ? body.words
      : typeof body.words === 'string'
      ? body.words.split(',').map((w: string) => w.trim()).filter(Boolean)
      : [];

    const created = await prisma.customizationWordGroup.create({
      data: {
        name: body.name || 'Wortgruppe',
        words: JSON.stringify(wordsArray),
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

export async function PUT(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'ID fehlt' }, { status: 400 });

    const wordsArray = Array.isArray(body.words)
      ? body.words
      : typeof body.words === 'string'
      ? body.words.split(',').map((w: string) => w.trim()).filter(Boolean)
      : undefined;

    const updated = await prisma.customizationWordGroup.update({
      where: { id: body.id },
      data: {
        name: body.name !== undefined ? body.name : undefined,
        words: wordsArray !== undefined ? JSON.stringify(wordsArray) : undefined,
        sortIndex: body.sortIndex !== undefined ? body.sortIndex : undefined,
      },
    });

    return NextResponse.json({
      ...updated,
      words: JSON.parse(updated.words),
    });
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
    if (!id) return NextResponse.json({ error: 'ID fehlt' }, { status: 400 });

    await prisma.customizationWordGroup.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
