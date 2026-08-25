import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

const DEFAULT_LISTS: Record<string, { name: string; items: any[] }> = {
  SUB_CATEGORIES: {
    name: 'Unterkategorien (Schnellfilter)',
    items: [
      { id: 'BIER', label: 'Bier', icon: 'Beer' },
      { id: 'WEIN', label: 'Wein & Sekt', icon: 'Wine' },
      { id: 'ALKOHOLFREI', label: 'Alkoholfrei', icon: 'GlassWater' },
      { id: 'HEISS', label: 'Heißgetränke & Kaffee', icon: 'Coffee' },
      { id: 'BAR', label: 'Bar & Spirituosen', icon: 'Sparkles' },
      { id: 'SPEISE', label: 'Speisen & Grill', icon: 'Utensils' },
    ],
  },
  DEPOSIT_TIERS: {
    name: 'Pfandstufen',
    items: [
      { value: 0.0, label: 'Kein Pfand (0,00 €)' },
      { value: 0.5, label: '0,50 € (Flaschen/Dosen)' },
      { value: 1.0, label: '1,00 € (Standard-Becher)' },
      { value: 2.0, label: '2,00 € (Gläser/Krüge)' },
      { value: 5.0, label: '5,00 € (Maßkrug/Krug)' },
    ],
  },
  TIP_PRESETS: {
    name: 'Trinkgeld-Schnellwahl',
    items: [
      { value: 0.0, label: '0 €' },
      { value: 0.5, label: '+0,50 €' },
      { value: 1.0, label: '+1,00 €' },
      { value: 2.0, label: '+2,00 €' },
      { value: 5.0, label: '+5,00 €' },
    ],
  },
  VOID_REASONS: {
    name: 'Stornogründe',
    items: [
      { id: 'FEHLBESTELLUNG', label: 'Fehlbestellung / Vertippt' },
      { id: 'REKLAMATION', label: 'Reklamation / Falscher Artikel' },
      { id: 'GAST_GEGANGEN', label: 'Gast vor Lieferung gegangen' },
      { id: 'SCHWUND', label: 'Schankverlust / Verschüttet' },
      { id: 'QUALITAETSMANGEL', label: 'Qualitätsmangel' },
      { id: 'SONSTIGES', label: 'Sonstiger betrieblicher Grund' },
    ],
  },
  COURSE_NAMES: {
    name: 'Gänge-Bezeichnungen',
    items: [
      { courseNumber: 1, label: 'Vorspeise / 1. Gang' },
      { courseNumber: 2, label: 'Hauptgang / 2. Gang' },
      { courseNumber: 3, label: 'Dessert / 3. Gang' },
    ],
  },
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');

    if (key) {
      const list = await prisma.configList.findUnique({ where: { key } });
      if (list) {
        return NextResponse.json({
          ...list,
          items: JSON.parse(list.itemsJson || '[]'),
        });
      }
      const defaultList = DEFAULT_LISTS[key];
      if (defaultList) {
        return NextResponse.json({
          key,
          name: defaultList.name,
          items: defaultList.items,
        });
      }
      return NextResponse.json({ key, name: key, items: [] });
    }

    const allLists = await prisma.configList.findMany();
    const result: Record<string, any> = { ...DEFAULT_LISTS };
    for (const l of allLists) {
      result[l.key] = {
        id: l.id,
        name: l.name,
        items: JSON.parse(l.itemsJson || '[]'),
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { key, name, items } = body;

    if (!key) return NextResponse.json({ error: 'Key ist erforderlich' }, { status: 400 });

    const itemsJson = JSON.stringify(Array.isArray(items) ? items : []);
    const upserted = await prisma.configList.upsert({
      where: { key },
      create: { key, name: name || key, itemsJson },
      update: { name: name || undefined, itemsJson },
    });

    return NextResponse.json({
      ...upserted,
      items: JSON.parse(upserted.itemsJson),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
