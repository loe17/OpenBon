import { NextResponse } from 'next/server';
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

    return NextResponse.json({ success: true, message: 'Zapfhahn gelöscht.' });
  } catch (error) {
    console.error('Error deleting tap:', error);
    return NextResponse.json({ error: 'Fehler beim Löschen des Zapfhahns.' }, { status: 500 });
  }
}
