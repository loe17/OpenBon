import { NextRequest, NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import { prisma } from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';
import { getOrAssignWaiterNumber } from '@/lib/waiter-number';
import { hashPin } from '@/lib/auth-pin';

/** M3.1: Uebergebene PIN nur als PBKDF2-Hash persistieren (undefined = unverändert). */
function resolveStoredPin(rawPin: unknown): string | undefined {
  if (typeof rawPin !== 'string') return undefined;
  const clean = rawPin.trim();
  if (clean.length === 0) return undefined;
  return hashPin(clean.length >= 4 ? clean : '3333');
}

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

    const storedPin = resolveStoredPin(pin);

    let updated;
    if (targetName) {
      const waiterNumber = await getOrAssignWaiterNumber(targetName);
      updated = await prisma.waiterProfile.upsert({
        where: { name: targetName },
        update: {
          pin: storedPin,
          tipProfileId: tipProfileId !== undefined ? tipProfileId : undefined,
          isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        },
        create: {
          name: targetName,
          waiterNumber,
          pin: storedPin ?? hashPin('3333'),
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
          pin: storedPin,
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
