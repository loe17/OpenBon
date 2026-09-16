import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';
import prisma from '@/lib/db';
import {
  generateIndexPhp,
  generateApiPhp,
  generateHtaccess,
  generateReadmeHtml,
} from '@/lib/webhosting-bridge-template';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const config = await prisma.eventConfig.findFirst();

    const syncToken =
      searchParams.get('token')?.trim() ||
      (config as any)?.webhostingSyncToken ||
      'OB-SYNC-' + Math.random().toString(36).substring(2, 12).toUpperCase();

    const baseUrl =
      searchParams.get('baseUrl')?.trim() ||
      config?.baseUrl ||
      'https://bon.mein-verein.de';

    const eventName =
      searchParams.get('eventName')?.trim() ||
      config?.name ||
      'Vereinsfest';

    if (config) {
      const updates: Record<string, any> = {};
      if (baseUrl && baseUrl !== config.baseUrl) updates.baseUrl = baseUrl;
      if (syncToken && syncToken !== (config as any).webhostingSyncToken) updates.webhostingSyncToken = syncToken;
      if (Object.keys(updates).length > 0) {
        await prisma.eventConfig.update({ where: { id: config.id }, data: updates }).catch(() => {});
      }
    }

    const zip = new JSZip();

    // 0. Vorbelegung der Event-Konfiguration
    zip.file(
      'event.json',
      JSON.stringify({ name: eventName, updatedAt: new Date().toISOString() }, null, 2)
    );

    // 1. PHP Frontend für E-Bon & Speisekarte (inkl. 24h Selbstreinigung)
    zip.file(
      'index.php',
      generateIndexPhp({
        syncToken,
        eventName,
        defaultBaseUrl: baseUrl,
      })
    );

    // 2. Empfangs-API für Kassenbons & Speisekarten-Uploads aus dem Festzelt
    zip.file('api.php', generateApiPhp({ syncToken }));

    // 3. Apache .htaccess für saubere Kurz-Links (/receipt/EBON-XXXX) und Schutz des Ordners
    zip.file('.htaccess', generateHtaccess());

    // 4. Einfache Schritt-für-Schritt-Anleitung
    zip.file(
      'ANLEITUNG.html',
      generateReadmeHtml({
        syncToken,
        defaultBaseUrl: baseUrl,
      })
    );

    // 5. Automatisch die hinterlegte Speisekarte beilegen (falls vorhanden)
    const menuUploadDir = path.join(process.cwd(), 'public', 'uploads', 'menu');
    if (fs.existsSync(menuUploadDir)) {
      const menuFiles = fs.readdirSync(menuUploadDir);
      for (const f of menuFiles) {
        if (f.startsWith('menu.') || f.startsWith('speisekarte.')) {
          const filePath = path.join(menuUploadDir, f);
          const ext = path.extname(f).toLowerCase();
          const targetName = ext === '.pdf' ? 'menu.pdf' : ext === '.png' ? 'menu.png' : 'menu.jpg';
          const fileBuf = fs.readFileSync(filePath);
          zip.file(targetName, fileBuf);
          break;
        }
      }
    }

    // 6. JSON-Katalog aller aktiven Produkte beilegen (für optionale interaktive Karte)
    try {
      const products = await prisma.product.findMany({
        where: { isSoldOut: false },
        include: { category: true, variants: true },
      });
      if (products.length > 0) {
        const publicCatalog = products.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category?.name || 'Allgemein',
          price: (p.priceCents ?? 0) / 100,
          deposit: (p.depositCents ?? 0) / 100,
          variants: (p.variants || []).map((v) => ({
            name: v.name,
            priceDelta: (v.priceDeltaCents ?? 0) / 100,
          })),
        }));
        zip.file('products.json', JSON.stringify(publicCatalog, null, 2));
      }
    } catch (e) {
      // Ignorieren falls DB offline oder leer
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="openbon-webhosting-bruecke.zip"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('[BRIDGE DOWNLOAD ERROR]', error);
    return NextResponse.json(
      { error: 'Fehler beim Erstellen des Webhosting-Pakets: ' + error.message },
      { status: 500 }
    );
  }
}
