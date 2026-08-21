import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sinceSequence = parseInt(searchParams.get('sinceSequence') || '0', 10);

    const entries = await prisma.syncJournal.findMany({
      where: {
        sequence: { gt: sinceSequence },
      },
      orderBy: { sequence: 'asc' },
      take: 100,
    });

    return NextResponse.json({ entries });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
