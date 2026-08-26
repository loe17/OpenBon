import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import networkSpooler from '@/lib/printer/network-spooler';
import { EscPosBuilder } from '@/lib/printer/escpos-builder';
import { TicketData } from '@/lib/printer/types';
import { requireApiAuth } from '@/lib/api-guard';

export async function GET(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    const enableVirtual = config?.enableVirtualPrinters ?? true;

    const where: Record<string, unknown> = {};
    if (!enableVirtual) {
      where.isVirtual = false;
    }

    const printers = await prisma.printer.findMany({
      where,
      include: {
        printGroups: true,
      },
    });
    return NextResponse.json(printers);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();

    // 1. Station QR Joining Ticket Print
    if (body.action === 'PRINT_STATION_TICKET') {
      const printer = await prisma.printer.findUnique({ where: { id: body.printerId } });
      if (!printer) return NextResponse.json({ error: 'Drucker nicht gefunden' }, { status: 404 });

      const { rawBuffer, textRepresentation } = EscPosBuilder.buildStationJoinTicket(
        {
          title: body.title || 'Station',
          role: body.role || 'WAITER',
          description: body.description || '',
          url: body.url || '',
          pin: body.pin || '1234',
        },
        printer.paperWidth
      );

      const result = await networkSpooler.sendRawBuffer(printer, rawBuffer, textRepresentation);
      return NextResponse.json(result);
    }

    // 2. Official Z-Bon Daily Report Ticket Print
    if (body.action === 'PRINT_ZBON') {
      const printer = await prisma.printer.findUnique({ where: { id: body.printerId } });
      if (!printer) return NextResponse.json({ error: 'Drucker nicht gefunden' }, { status: 404 });

      const { rawBuffer, textRepresentation } = EscPosBuilder.buildZBonTicket(body.reportData, printer.paperWidth);
      const result = await networkSpooler.sendRawBuffer(printer, rawBuffer, textRepresentation);
      return NextResponse.json(result);
    }

    // 3. Test print action
    if (body.action === 'TEST_PRINT') {
      const printer = await prisma.printer.findUnique({ where: { id: body.printerId } });
      if (!printer) return NextResponse.json({ error: 'Drucker nicht gefunden' }, { status: 404 });

      const testTicket: TicketData = {
        title: 'TESTBON / DRUCKERTEST',
        tableLabel: 'TEST-STATION',
        waiterName: 'Administrator',
        items: [
          { name: 'Druckertest erfolgreich', quantity: 1, unitPrice: 0.0 },
          { name: 'Umlaute-Test: ä ö ü Ä Ö Ü ß €', quantity: 1, unitPrice: 0.0 },
        ],
        footerText: `IP: ${printer.ipAddress}:${printer.port} | Breite: ${printer.paperWidth}mm`,
      };

      const result = await networkSpooler.printTicket(printer, testTicket);
      return NextResponse.json(result);
    }

    // 4. Open drawer action
    if (body.action === 'OPEN_DRAWER') {
      const printer = await prisma.printer.findUnique({ where: { id: body.printerId } });
      if (!printer) return NextResponse.json({ error: 'Drucker nicht gefunden' }, { status: 404 });

      await networkSpooler.openDrawer(printer);
      return NextResponse.json({ success: true });
    }

    // 5. Retry failed print jobs
    if (body.action === 'RETRY_FAILED_JOBS') {
      const failed = await prisma.printJob.findMany({
        where: { status: 'FAILED' },
        take: 20,
      });

      let retriedCount = 0;
      for (const job of failed) {
        await prisma.printJob.update({
          where: { id: job.id },
          data: { status: 'PENDING', attempts: 0 },
        });
        retriedCount++;
      }

      networkSpooler.restartSpooler();
      return NextResponse.json({ success: true, retriedCount });
    }

    // 6. TCP Connection Probe / Ping Check
    if (body.action === 'PING_PRINTER' || body.action === 'PING_ALL') {
      const net = await import('net');
      const printers = body.printerId
        ? await prisma.printer.findMany({ where: { id: body.printerId } })
        : await prisma.printer.findMany();

      const results: Record<string, { online: boolean; latencyMs?: number; isVirtual: boolean; hasCashDrawer?: boolean }> = {};

      await Promise.all(
        printers.map((p) => {
          if (p.isVirtual) {
            results[p.id] = { online: true, isVirtual: true, latencyMs: 0, hasCashDrawer: p.hasCashDrawer };
            return Promise.resolve();
          }

          return new Promise<void>((resolve) => {
            const start = Date.now();
            const socket = new net.Socket();
            socket.setTimeout(600);

            let finished = false;
            const finish = (online: boolean) => {
              if (!finished) {
                finished = true;
                socket.removeAllListeners();
                socket.destroy();
                results[p.id] = {
                  online,
                  isVirtual: false,
                  hasCashDrawer: p.hasCashDrawer,
                  latencyMs: online ? Date.now() - start : undefined,
                };
                resolve();
              }
            };

            socket.connect(p.port || 9100, p.ipAddress, () => finish(true));
            socket.on('error', () => finish(false));
            socket.on('timeout', () => finish(false));
          });
        })
      );

      return NextResponse.json({ success: true, results });
    }

    if (!body.name) {
      return NextResponse.json({ error: 'Druckername ist erforderlich' }, { status: 400 });
    }

    const created = await prisma.printer.create({
      data: {
        name: body.name,
        ipAddress: body.ipAddress || '127.0.0.1',
        port: parseInt(body.port || 9100, 10),
        paperWidth: parseInt(body.paperWidth || 80, 10),
        characterSet: body.characterSet || 'CP858',
        isVirtual: body.isVirtual ?? false,
        isActive: body.isActive ?? true,
        hasCashDrawer: Boolean(body.hasCashDrawer),
      },
    });
    await logSystemActionSafe(() => ({
      action: 'PRINTER_CREATED',
      category: 'SYSTEM',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Drucker angelegt.',
    }));

    return NextResponse.json(created);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'Drucker-ID fehlt' }, { status: 400 });

    const updated = await prisma.printer.update({
      where: { id: body.id },
      data: {
        name: body.name,
        ipAddress: body.ipAddress !== undefined ? body.ipAddress : undefined,
        port: body.port !== undefined ? parseInt(body.port, 10) : undefined,
        paperWidth: body.paperWidth !== undefined ? parseInt(body.paperWidth, 10) : undefined,
        characterSet: body.characterSet !== undefined ? body.characterSet : undefined,
        isVirtual: body.isVirtual !== undefined ? body.isVirtual : undefined,
        isActive: body.isActive !== undefined ? body.isActive : undefined,
        hasCashDrawer: body.hasCashDrawer !== undefined ? Boolean(body.hasCashDrawer) : undefined,
      },
    });
    await logSystemActionSafe(() => ({
      action: 'PRINTER_UPDATED',
      category: 'SYSTEM',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Drucker geaendert.',
    }));

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Drucker-ID fehlt' }, { status: 400 });

    // PrintGroup Referenzen lösen
    await prisma.printGroup.updateMany({
      where: { printerId: id },
      data: { printerId: null },
    });

    await prisma.printer.delete({ where: { id } });
    await logSystemActionSafe(() => ({
      action: 'PRINTER_DELETED',
      category: 'SYSTEM',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Drucker geloescht.',
    }));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
