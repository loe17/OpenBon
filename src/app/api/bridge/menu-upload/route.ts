import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'menu');

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function getActiveMenuFile(): { fileName: string; fileUrl: string; size: number; ext: string; updatedAt: string } | null {
  if (!fs.existsSync(UPLOAD_DIR)) return null;
  const files = fs.readdirSync(UPLOAD_DIR);
  for (const f of files) {
    if (f.startsWith('menu.') || f.startsWith('speisekarte.')) {
      const fullPath = path.join(UPLOAD_DIR, f);
      const stat = fs.statSync(fullPath);
      const ext = path.extname(f).toLowerCase().replace('.', '');
      return {
        fileName: f,
        fileUrl: `/uploads/menu/${f}`,
        size: stat.size,
        ext,
        updatedAt: stat.mtime.toISOString(),
      };
    }
  }
  return null;
}

export async function GET() {
  try {
    const active = getActiveMenuFile();
    return NextResponse.json({
      exists: Boolean(active),
      menu: active,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    ensureUploadDir();
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Keine Datei ausgewählt.' }, { status: 400 });
    }

    const rawExt = path.extname(file.name).toLowerCase();
    if (!['.pdf', '.jpg', '.jpeg', '.png'].includes(rawExt)) {
      return NextResponse.json(
        { error: 'Nur PDF-Dateien oder Bilder (JPG, PNG) sind als Speisekarte zulässig.' },
        { status: 400 }
      );
    }

    const ext = rawExt === '.jpeg' ? '.jpg' : rawExt;
    const targetFileName = `menu${ext}`;
    const targetPath = path.join(UPLOAD_DIR, targetFileName);

    // Vorherige Menü-Dateien entfernen, um Konflikte zu vermeiden
    const existing = fs.readdirSync(UPLOAD_DIR);
    for (const f of existing) {
      if (f.startsWith('menu.') || f.startsWith('speisekarte.')) {
        try {
          fs.unlinkSync(path.join(UPLOAD_DIR, f));
        } catch (e) {}
      }
    }

    // Neue Datei speichern
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(targetPath, buffer);

    const stat = fs.statSync(targetPath);

    return NextResponse.json({
      success: true,
      fileUrl: `/uploads/menu/${targetFileName}`,
      fileName: file.name,
      ext: ext.replace('.', ''),
      size: stat.size,
      updatedAt: stat.mtime.toISOString(),
    });
  } catch (error: any) {
    console.error('[MENU UPLOAD ERROR]', error);
    return NextResponse.json({ error: 'Fehler beim Speichern der Speisekarte: ' + error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    if (fs.existsSync(UPLOAD_DIR)) {
      const files = fs.readdirSync(UPLOAD_DIR);
      for (const f of files) {
        if (f.startsWith('menu.') || f.startsWith('speisekarte.')) {
          fs.unlinkSync(path.join(UPLOAD_DIR, f));
        }
      }
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
