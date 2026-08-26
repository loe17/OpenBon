import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { logSystemAction } from '@/lib/action-logger';
import { requireApiAuth } from '@/lib/api-guard';

export async function GET(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const format = searchParams.get('format');
    const limit = Math.min(1000, parseInt(searchParams.get('limit') || '200', 10));

    const where: any = {};
    if (category && category !== 'ALL') {
      where.category = category;
    }
    if (search) {
      where.OR = [
        { details: { contains: search } },
        { actor: { contains: search } },
        { action: { contains: search } },
      ];
    }

    const logs = await prisma.actionLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // CSV Download
    if (format === 'csv') {
      const header = 'Zeitstempel;Kategorie;Aktion;Akteur;Beschreibung;Metadaten\n';
      const rows = logs
        .map((l) =>
          [
            new Date(l.createdAt).toISOString(),
            `"${l.category}"`,
            `"${l.action}"`,
            `"${l.actor.replace(/"/g, '""')}"`,
            `"${l.details.replace(/"/g, '""')}"`,
            `"${(l.metadata || '').replace(/"/g, '""')}"`,
          ].join(';')
        )
        .join('\n');

      return new Response('\uFEFF' + header + rows, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="openbon_audit_log_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    // TXT Download
    if (format === 'txt') {
      const text = logs
        .map(
          (l) =>
            `[${new Date(l.createdAt).toLocaleString('de-DE')}] [${l.category}] [${l.action}] [${l.actor}]: ${l.details}`
        )
        .join('\n');

      return new Response(text, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="openbon_audit_log_${new Date().toISOString().slice(0, 10)}.txt"`,
        },
      });
    }

    // JSON Download or default JSON response
    if (format === 'json_file') {
      return new Response(JSON.stringify(logs, null, 2), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="openbon_audit_log_${new Date().toISOString().slice(0, 10)}.json"`,
        },
      });
    }

    return NextResponse.json(logs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Fehler beim Laden der Logs' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const entry = await logSystemAction({
      action: body.action || 'CUSTOM_EVENT',
      category: body.category || 'GENERAL',
      actor: body.actor || 'Client',
      details: body.details || 'Benutzeraktion',
      metadata: body.metadata || null,
    });
    return NextResponse.json(entry);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
