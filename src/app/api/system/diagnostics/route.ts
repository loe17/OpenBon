import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { runDiagnostics, startDiagnosticsCycle } from '@/lib/diagnostics';

/**
 * Spec 7.2: Integrierte Self-Healing Selbstdiagnose.
 *
 * GET  -> letztes Ergebnis + Historie (ohne neuen Lauf)
 * POST -> führt sofort einen vollständigen Selbsttest samt Reparaturen aus
 */
export async function GET() {
  try {
    // Sicherstellen, dass der 60-Sekunden-Zyklus läuft (auch nach Hot-Reload)
    startDiagnosticsCycle();

    const [latest, history] = await Promise.all([
      prisma.diagnosticRun.findFirst({ orderBy: { createdAt: 'desc' } }),
      prisma.diagnosticRun.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, status: true, repairsCount: true, durationMs: true, createdAt: true },
      }),
    ]);

    if (!latest) {
      const fresh = await runDiagnostics();
      return NextResponse.json({ ...fresh, history: [] });
    }

    return NextResponse.json({
      status: latest.status,
      checks: JSON.parse(latest.checksJson),
      repairsCount: latest.repairsCount,
      durationMs: latest.durationMs,
      ranAt: latest.createdAt,
      history,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const result = await runDiagnostics();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
