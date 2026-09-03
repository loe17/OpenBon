import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import networkSpooler from '@/lib/printer/network-spooler';
import { requireApiAuth } from '@/lib/api-guard';
import { logSystemActionSafe } from '@/lib/action-logger';

/**
 * GET /api/printers/queue
 * Liefert die Liste aller Druckaufträge mit Filter nach Status und Statistiken.
 */
export async function GET(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status') || 'ALL'; // ALL, PENDING, PRINTING, FAILED, PRINTED
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const whereClause: any = {};
    if (statusFilter !== 'ALL') {
      whereClause.status = statusFilter;
    }

    const [total, pending, failed, printed, confirmed, items, allPrinters] = await Promise.all([
      prisma.printJob.count(),
      prisma.printJob.count({ where: { status: 'PENDING' } }),
      prisma.printJob.count({ where: { status: 'FAILED' } }),
      prisma.printJob.count({ where: { status: 'PRINTED' } }),
      prisma.printJob.count({ where: { status: 'CONFIRMED' } }),
      prisma.printJob.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.printer.findMany({
        select: { id: true, name: true, ipAddress: true, isVirtual: true, port: true, paperWidth: true },
      }),
    ]);

    const printerMap = new Map(allPrinters.map((p) => [p.id, p]));

    const enrichedItems = items.map((job) => {
      const printer = job.printerId ? printerMap.get(job.printerId) : null;
      let parsedPayload: any = null;
      try {
        if (job.rawPayload) {
          parsedPayload = JSON.parse(job.rawPayload);
        }
      } catch {
        parsedPayload = { text: job.rawPayload };
      }

      return {
        id: job.id,
        printerId: job.printerId,
        printerName: printer?.name || 'Unbekannter Drucker',
        printerIp: printer?.ipAddress || null,
        isVirtual: printer?.isVirtual || false,
        orderId: job.orderId,
        title: job.title || 'Druckauftrag',
        status: job.status,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        lastError: job.lastError,
        createdAt: job.createdAt,
        printedAt: job.printedAt,
        confirmedAt: (job as { confirmedAt?: Date | null }).confirmedAt ?? null,
        confirmedBy: (job as { confirmedBy?: string | null }).confirmedBy ?? null,
        payload: parsedPayload,
      };
    });

    return NextResponse.json({
      counts: {
        total,
        pending,
        failed,
        printed,
        confirmed,
      },
      items: enrichedItems,
    });
  } catch (error: any) {
    console.error('[PRINT_QUEUE_GET_ERROR]', error);
    return NextResponse.json({ error: 'Fehler beim Laden der Druckwarteschlange' }, { status: 500 });
  }
}

/**
 * POST /api/printers/queue
 * Aktionen auf der Druckwarteschlange:
 * - RETRY: Druckauftrag erneut senden
 * - REROUTE: Drucker-ID ändern und erneut senden
 * - DELETE: Auftrag aus Warteschlange löschen
 * - CLEAR_COMPLETED: Abgeschlossene Aufträge aufräumen
 */
export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { action, jobId, targetPrinterId } = body;

    if (!action) {
      return NextResponse.json({ error: 'Aktion erforderlich' }, { status: 400 });
    }

    if (action === 'CLEAR_COMPLETED') {
      const deleted = await prisma.printJob.deleteMany({
        where: { status: 'PRINTED' },
      });
      await logSystemActionSafe(() => ({
        action: 'PRINT_QUEUE_CLEARED',
        details: `${deleted.count} gedruckte Aufträge aus Warteschlange gelöscht`,
        actor: 'Admin',
      }));
      return NextResponse.json({ success: true, count: deleted.count });
    }

    if (!jobId) {
      return NextResponse.json({ error: 'Job-ID erforderlich' }, { status: 400 });
    }

    const job = await prisma.printJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json({ error: 'Druckauftrag nicht gefunden' }, { status: 404 });
    }

    if (action === 'DELETE') {
      await prisma.printJob.delete({
        where: { id: jobId },
      });
      await logSystemActionSafe(() => ({
        action: 'PRINT_JOB_DELETED',
        details: `Druckauftrag ${jobId} gelöscht`,
        actor: 'Admin',
      }));
      return NextResponse.json({ success: true });
    }

    if (action === 'RETRY' || action === 'REROUTE') {
      const printerIdToUse = action === 'REROUTE' && targetPrinterId ? targetPrinterId : job.printerId;

      if (!printerIdToUse) {
        return NextResponse.json({ error: 'Kein Ziel-Drucker vorhanden' }, { status: 400 });
      }

      const targetPrinter = await prisma.printer.findUnique({
        where: { id: printerIdToUse },
      });

      if (!targetPrinter) {
        return NextResponse.json({ error: 'Zieldrucker existiert nicht' }, { status: 404 });
      }

      // Payload parsen
      let ticketData: any = null;
      try {
        ticketData = job.rawPayload ? JSON.parse(job.rawPayload) : null;
      } catch {
        ticketData = null;
      }

      if (!ticketData) {
        return NextResponse.json({ error: 'Ungültiger Bon-Payload' }, { status: 400 });
      }

      // Status in DB aktualisieren (kein Duplikat-Job: gleiche ID wieder einreihen)
      const updated = await prisma.printJob.update({
        where: { id: jobId },
        data: {
          printerId: targetPrinter.id,
          status: 'PENDING',
          attempts: { increment: 1 },
          lastError: null,
        },
      });

      // Erneut durch den Spooler jagen (gleiche DB-ID, kein neuer PrintJob)
      await networkSpooler.requeueExistingJob(
        { id: updated.id, printerId: updated.printerId, rawPayload: updated.rawPayload, attempts: updated.attempts, createdAt: updated.createdAt },
        {
          id: targetPrinter.id,
          name: targetPrinter.name,
          ipAddress: targetPrinter.ipAddress,
          port: targetPrinter.port,
          isVirtual: targetPrinter.isVirtual,
          paperWidth: targetPrinter.paperWidth,
        }
      );

      await logSystemActionSafe(() => ({
        action: action === 'RETRY' ? 'PRINT_JOB_RETRY' : 'PRINT_JOB_REROUTE',
        details: `Auftrag ${job.id} -> Drucker ${targetPrinter.name} (${targetPrinter.ipAddress})`,
        actor: 'Admin',
      }));

      return NextResponse.json({ success: true, printerName: targetPrinter.name });
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (error: any) {
    console.error('[PRINT_QUEUE_POST_ERROR]', error);
    return NextResponse.json({ error: error.message || 'Fehler bei der Warteschlangen-Aktion' }, { status: 500 });
  }
}
