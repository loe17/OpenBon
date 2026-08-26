import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';

export const dynamic = 'force-dynamic';

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const { id } = params;
    await prisma.tapLine.delete({ where: { id } });

    if (global.io) {
      global.io.emit('tap:deleted', { id });
    }

    await logSystemActionSafe(() => ({
      action: 'TAP_DELETED',
      category: 'ADMIN',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Zapfstelle geloescht.',
    }));

    return NextResponse.json({ success: true, message: 'Zapfhahn gelöscht.' });
  } catch (error) {
    console.error('Error deleting tap:', error);
    return NextResponse.json({ error: 'Fehler beim Löschen des Zapfhahns.' }, { status: 500 });
  }
}
