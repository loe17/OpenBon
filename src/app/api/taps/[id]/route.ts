import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
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
