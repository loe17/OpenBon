import { NextRequest, NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import { prisma } from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';

export async function GET(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    let profiles = await prisma.tipProfile.findMany({
      include: {
        waiters: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Falls noch kein Profil existiert, initiales Default-Profil anlegen
    if (profiles.length === 0) {
      const defaultProfile = await prisma.tipProfile.create({
        data: {
          name: 'Standard Service (100%)',
          waiterPercent: 100.0,
          barPoolPercent: 0.0,
          kitchenPoolPercent: 0.0,
          servicePoolPercent: 0.0,
          isDefault: true,
        },
        include: {
          waiters: { select: { id: true, name: true } },
        },
      });
      profiles = [defaultProfile];
    }

    return NextResponse.json(profiles);
  } catch (error) {
    console.error('GET /api/tip-profiles error:', error);
    return NextResponse.json({ error: 'Fehler beim Laden der Trinkgeld-Profile' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { name, waiterPercent, barPoolPercent, kitchenPoolPercent, servicePoolPercent, isDefault } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 });
    }

    // Wenn als Default markiert, alle anderen Defaults abloesen
    if (isDefault) {
      await prisma.tipProfile.updateMany({
        data: { isDefault: false },
      });
    }

    const profile = await prisma.tipProfile.create({
      data: {
        name,
        waiterPercent: typeof waiterPercent === 'number' ? waiterPercent : 100.0,
        barPoolPercent: typeof barPoolPercent === 'number' ? barPoolPercent : 0.0,
        kitchenPoolPercent: typeof kitchenPoolPercent === 'number' ? kitchenPoolPercent : 0.0,
        servicePoolPercent: typeof servicePoolPercent === 'number' ? servicePoolPercent : 0.0,
        isDefault: Boolean(isDefault),
      },
    });

    await logSystemActionSafe(() => ({
      action: 'TIP_PROFILE_CREATED',
      category: 'ADMIN',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Trinkgeld-Profil angelegt.',
    }));

    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    console.error('POST /api/tip-profiles error:', error);
    return NextResponse.json({ error: 'Fehler beim Erstellen des Profils' }, { status: 500 });
  }
}
