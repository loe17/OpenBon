import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyHaSecret } from '@/lib/ha/ha-secret';

export async function GET(req: Request) {
  // Shared-Secret-Pruefung: nur der Partner-Knoten darf das SyncJournal ziehen
  if (!(await verifyHaSecret(req))) {
    return NextResponse.json({ error: 'Ungueltiges HA-Sync-Secret' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const sinceSequence = parseInt(searchParams.get('sinceSequence') || '0', 10);

    const entries = await prisma.syncJournal.findMany({
      where: {
        id: { gt: sinceSequence },
      },
      orderBy: { id: 'asc' },
      take: 100,
    });

    return NextResponse.json({ entries });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
