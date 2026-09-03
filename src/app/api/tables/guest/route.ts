import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';
import { validateBody, TableGuestSchema } from '@/lib/validations/schemas';
import { z } from 'zod';

const Schema = TableGuestSchema.extend({ tableId: z.string().min(1) });

/** Deckel/Gastname + Reservierung am Tisch setzen (WAITER+). */
export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;
  const v = await validateBody(req, Schema);
  if (!v.success) return v.response;
  try {
    const updated = await prisma.diningTable.update({
      where: { id: v.data.tableId },
      data: {
        guestName: v.data.guestName ?? undefined,
        reservationName: v.data.reservationName ?? undefined,
        reservedAt: v.data.reservationName ? new Date() : undefined,
        status: v.data.status ?? undefined,
      },
    });
    if (global.io) global.io.emit('table:updated', { tableId: updated.id, status: updated.status });
    return NextResponse.json({ success: true, table: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
