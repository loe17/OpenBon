import { NextRequest, NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import { prisma } from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const { id } = params;
    const body = await req.json();
    const { name, waiterPercent, barPoolPercent, kitchenPoolPercent, servicePoolPercent, isDefault } = body;

    if (isDefault) {
      await prisma.tipProfile.updateMany({
        where: { id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.tipProfile.update({
      where: { id },
      data: {
        name,
        waiterPercent: typeof waiterPercent === 'number' ? waiterPercent : undefined,
        barPoolPercent: typeof barPoolPercent === 'number' ? barPoolPercent : undefined,
        kitchenPoolPercent: typeof kitchenPoolPercent === 'number' ? kitchenPoolPercent : undefined,
        servicePoolPercent: typeof servicePoolPercent === 'number' ? servicePoolPercent : undefined,
        isDefault: isDefault !== undefined ? Boolean(isDefault) : undefined,
      },
    });

    await logSystemActionSafe(() => ({
      action: 'TIP_PROFILE_UPDATED',
      category: 'ADMIN',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Trinkgeld-Profil geaendert.',
    }));

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT /api/tip-profiles/[id] error:', error);
    return NextResponse.json({ error: 'Fehler beim Aktualisieren des Profils' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const { id } = params;
    await prisma.tipProfile.delete({
      where: { id },
    });
    await logSystemActionSafe(() => ({
      action: 'TIP_PROFILE_DELETED',
      category: 'ADMIN',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Trinkgeld-Profil geloescht.',
    }));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/tip-profiles/[id] error:', error);
    return NextResponse.json({ error: 'Fehler beim Löschen des Profils' }, { status: 500 });
  }
}
