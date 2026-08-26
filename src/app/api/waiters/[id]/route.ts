import { NextRequest, NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import { prisma } from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';
import { getOrAssignWaiterNumber } from '@/lib/waiter-number';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const { id } = params;
    const body = await req.json();
    const { name, pin, tipProfileId, isActive } = body;

    let targetName = name;
    if (id.startsWith('adhoc-')) {
      targetName = id.replace('adhoc-', '').trim();
    }

    let updated;
    if (targetName) {
      const waiterNumber = await getOrAssignWaiterNumber(targetName);
      updated = await prisma.waiterProfile.upsert({
        where: { name: targetName },
        update: {
          pin: pin || undefined,
          tipProfileId: tipProfileId !== undefined ? tipProfileId : undefined,
          isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        },
        create: {
          name: targetName,
          waiterNumber,
          pin: pin || '3333',
          tipProfileId: tipProfileId !== undefined ? tipProfileId : null,
          isActive: isActive !== undefined ? Boolean(isActive) : true,
        },
        include: {
          tipProfile: true,
        },
      });
    } else {
      updated = await prisma.waiterProfile.update({
        where: { id },
        data: {
          pin: pin || undefined,
          tipProfileId: tipProfileId !== undefined ? tipProfileId : undefined,
          isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        },
        include: {
          tipProfile: true,
        },
      });
    }

    await logSystemActionSafe(() => ({
      action: 'WAITER_UPDATED',
      category: 'AUTH',
      actor: auth.session.waiterName || auth.session.role,
      details: `Bedienung ${updated.name} (#${updated.waiterNumber}) geändert.`,
    }));

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT /api/waiters/[id] error:', error);
    return NextResponse.json({ error: 'Fehler beim Aktualisieren des Kellners' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const { id } = params;
    await prisma.waiterProfile.delete({
      where: { id },
    });
    await logSystemActionSafe(() => ({
      action: 'WAITER_DELETED',
      category: 'AUTH',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Bedienung entfernt.',
    }));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/waiters/[id] error:', error);
    return NextResponse.json({ error: 'Fehler beim Löschen des Kellners' }, { status: 500 });
  }
}
