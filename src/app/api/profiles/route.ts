import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { requireApiAuth } from '@/lib/api-guard';

export async function GET(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const profiles = await prisma.eventProfile.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json(profiles);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { action, name, description, profileId } = body;

    // 1. Neues Profil aus aktuellem Systemzustand sichern
    if (action === 'SAVE_CURRENT') {
      if (!name || typeof name !== 'string') {
        return NextResponse.json({ error: 'Name für das Profil ist erforderlich' }, { status: 400 });
      }

      const [config, categories, products, tables, printGroups, printers, wordGroups] =
        await Promise.all([
          prisma.eventConfig.findUnique({ where: { id: 'default' } }),
          prisma.productCategory.findMany(),
          prisma.product.findMany({ include: { variants: true, options: true, stockItem: true } }),
          prisma.diningTable.findMany(),
          prisma.printGroup.findMany(),
          prisma.printer.findMany(),
          prisma.customizationWordGroup.findMany(),
        ]);

      const snapshot = {
        config,
        categories,
        products,
        tables,
        printGroups,
        printers,
        wordGroups,
        savedAt: new Date().toISOString(),
      };

      const profile = await prisma.eventProfile.upsert({
        where: { name: name.trim() },
        create: {
          name: name.trim(),
          description: description || null,
          profileJson: JSON.stringify(snapshot),
        },
        update: {
          description: description || undefined,
          profileJson: JSON.stringify(snapshot),
        },
      });

      return NextResponse.json({ success: true, profile: { id: profile.id, name: profile.name } });
    }

    // 2. Gespeichertes Profil wiederherstellen
    if (action === 'RESTORE') {
      if (!profileId) {
        return NextResponse.json({ error: 'Profil-ID ist erforderlich' }, { status: 400 });
      }

      const profile = await prisma.eventProfile.findUnique({ where: { id: profileId } });
      if (!profile) {
        return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 });
      }

      const snapshot = JSON.parse(profile.profileJson);

      await prisma.$transaction(async (tx) => {
        // Kategorien & Produkte wiederherstellen
        if (Array.isArray(snapshot.categories)) {
          for (const cat of snapshot.categories) {
            await tx.productCategory.upsert({
              where: { id: cat.id },
              create: { name: cat.name, sortIndex: cat.sortIndex || 0, color: cat.color, icon: cat.icon },
              update: { name: cat.name, sortIndex: cat.sortIndex || 0, color: cat.color, icon: cat.icon },
            });
          }
        }

        // Tische wiederherstellen
        if (Array.isArray(snapshot.tables)) {
          for (const t of snapshot.tables) {
            await tx.diningTable.upsert({
              where: { tableNumber: t.tableNumber },
              create: {
                tableNumber: t.tableNumber,
                label: t.label,
                section: t.section || 'Hauptbereich',
                gridX: t.gridX || 0,
                gridY: t.gridY || 0,
                status: 'FREE',
                isActive: t.isActive ?? true,
              },
              update: {
                label: t.label,
                section: t.section || 'Hauptbereich',
                gridX: t.gridX || 0,
                gridY: t.gridY || 0,
                isActive: t.isActive ?? true,
              },
            });
          }
        }
      });

      return NextResponse.json({ success: true, message: `Profil "${profile.name}" erfolgreich wiederhergestellt.` });
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
