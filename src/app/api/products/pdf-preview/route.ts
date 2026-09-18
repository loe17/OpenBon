import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { parsePdfMenu, parseMenuFromText } from '@/lib/pdf-menu-extractor';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let items = [];

    // Vorhandene Kategorien aus der Datenbank laden für bessere Erkennung
    const existingCategories = await prisma.productCategory.findMany({
      select: { name: true },
      orderBy: { sortIndex: 'asc' },
    });
    const categoryNames = existingCategories.map((c) => c.name);

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ error: 'Keine Datei hochgeladen' }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      items = await parsePdfMenu(buffer, categoryNames);
    } else {
      const body = await req.json();
      if (body.text) {
        items = parseMenuFromText(body.text, categoryNames);
      } else {
        return NextResponse.json({ error: 'Weder PDF noch Text übergeben' }, { status: 400 });
      }
    }

    return NextResponse.json({
      success: true,
      items,
      totalFound: items.length,
      existingCategories: categoryNames,
    });
  } catch (err: any) {
    console.error('Fehler bei PDF-Speisekarten Vorschau:', err);
    return NextResponse.json(
      { error: err.message || 'Fehler bei der PDF-Analyse' },
      { status: 500 }
    );
  }
}
