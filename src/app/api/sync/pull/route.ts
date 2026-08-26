import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyHaSecret } from '@/lib/ha/ha-secret';
import { requireApiAuth } from '@/lib/api-guard';

export async function GET(req: Request) {
  // Zwei gleichwertige Zugangswege: der Partner-Knoten authentifiziert sich mit
  // dem HA-Shared-Secret, ein Administrator alternativ mit seiner Session.
  if (!(await verifyHaSecret(req))) {
    const auth = await requireApiAuth(req, ['ADMIN']);
    if (!auth.ok) {
      return NextResponse.json(
        { error: 'Ungueltiges HA-Sync-Secret oder fehlende Administrator-Session.' },
        { status: 401 }
      );
    }
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
