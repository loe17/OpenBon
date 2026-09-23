import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import networkSpooler from '@/lib/printer/network-spooler';
import { EscPosBuilder } from '@/lib/printer/escpos-builder';
import { TicketData } from '@/lib/printer/types';
import { validatePrinterAddress } from '@/lib/printer/validate';
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
  try {
    const body = await req.json();

    // Kassenlade öffnen ist für Kassierer an der Theke und Kellner erlaubt
    if (body.action === 'OPEN_DRAWER') {
      const auth = await requireApiAuth(req, ['ADMIN', 'POS_CASHIER', 'WAITER']);
      if (!auth.ok) return auth.response;

      const printer = await prisma.printer.findUnique({ where: { id: body.printerId } });
      if (!printer) return NextResponse.json({ error: 'Drucker nicht gefunden' }, { status: 404 });

      try {
        await networkSpooler.openDrawer(printer);
        return NextResponse.json({ success: true });
      } catch (err: any) {
        console.error('[PRINTER] Fehler beim Kassenladen-Impuls:', err);
        return NextResponse.json({ error: err.message || 'Kassenladen-Impuls fehlgeschlagen' }, { status: 500 });
      }
    }

    // Alle administrativen Aktionen (Drucker anlegen/ändern/löschen, Z-Bons, Stationstickets) erfordern ADMIN
    const auth = await requireApiAuth(req, ['ADMIN']);
    if (!auth.ok) return auth.response;

    // 1. Station QR Joining Ticket Print
    if (body.action === 'PRINT_STATION_TICKET') {
      const printer = await prisma.printer.findUnique({ where: { id: body.printerId } });
      if (!printer) return NextResponse.json({ error: 'Drucker nicht gefunden' }, { status: 404 });

      const { rawBuffer, textRepresentation, lengthMm } = EscPosBuilder.buildStationJoinTicket(
        {
          title: body.title || 'Station',
          role: body.role || 'WAITER',
          description: body.description || '',
          url: body.url || '',
          pin: body.pin || '1234',
        },
        printer.paperWidth
      );

      const result = await networkSpooler.sendRawBuffer(printer, rawBuffer, textRepresentation, {
        lengthMm,
        ticketType: 'STATION_JOIN',
      });
      return NextResponse.json(result);
    }

    // 2. Official Z-Bon Daily Report Ticket Print
    if (body.action === 'PRINT_ZBON') {
      const printer = await prisma.printer.findUnique({ where: { id: body.printerId } });
      if (!printer) return NextResponse.json({ error: 'Drucker nicht gefunden' }, { status: 404 });

      const { rawBuffer, textRepresentation, lengthMm } = EscPosBuilder.buildZBonTicket(body.reportData, printer.paperWidth);
      const result = await networkSpooler.sendRawBuffer(printer, rawBuffer, textRepresentation, {
        lengthMm,
        ticketType: 'Z_BON',
      });
      return NextResponse.json(result);
    }

    // 3. Test print action - jetzt synchron & mit echter Verbindungspruefung
    if (body.action === 'TEST_PRINT') {
      const printer = await prisma.printer.findUnique({ where: { id: body.printerId } });
      if (!printer) return NextResponse.json({ error: 'Drucker nicht gefunden' }, { status: 404 });

      const testTicket: TicketData = {
        title: 'TESTBON / DRUCKERTEST',
        tableLabel: 'TEST-STATION',
        waiterName: 'Administrator',
        items: [
          { name: 'Druckertest erfolgreich', quantity: 1, unitPriceCents: 0 },
          { name: 'Umlaute-Test: ä ö ü Ä Ö Ü ß €', quantity: 1, unitPriceCents: 0 },
        ],
        footerText: `${printer.ipAddress.startsWith('/dev/') ? 'USB-Port: ' : 'IP: '}${printer.ipAddress}${printer.port ? `:${printer.port}` : ''} | Breite: ${printer.paperWidth}mm`,
      };

      const { rawBuffer, textRepresentation, lengthMm } = EscPosBuilder.buildTicket(testTicket, printer.paperWidth);
      const result = await networkSpooler.sendRawBuffer(printer, rawBuffer, textRepresentation, {
        lengthMm,
        ticketType: 'TEST',
      });
      
      if (!result.success) {
        return NextResponse.json(
          { error: `Drucker nicht erreichbar oder ausgeschaltet (${result.error || 'Verbindung fehlgeschlagen'})` },
          { status: 503 }
        );
      }
      return NextResponse.json(result);
    }

    // 4. Manuelle Anpassung von Papierverbrauch / Rollenwerten
    if (body.action === 'ADJUST_PAPER_METERS') {
      const printer = await prisma.printer.findUnique({ where: { id: body.printerId } });
      if (!printer) return NextResponse.json({ error: 'Drucker nicht gefunden' }, { status: 404 });

      const updated = await prisma.printer.update({
        where: { id: body.printerId },
        data: {
          totalPaperMm: typeof body.totalPaperMm === 'number' ? Math.max(0, Math.round(body.totalPaperMm)) : undefined,
          rollLengthM: typeof body.rollLengthM === 'number' ? Math.max(1, Math.round(body.rollLengthM)) : undefined,
          calibLineMm: typeof body.calibLineMm === 'number' ? Number(body.calibLineMm) : undefined,
          calibFeedMm: typeof body.calibFeedMm === 'number' ? Number(body.calibFeedMm) : undefined,
        },
      });
      if (global.io) {
        global.io.emit('printer:paper_updated', { printerId: printer.id, totalPaperMm: updated.totalPaperMm });
      }
      return NextResponse.json({ success: true, printer: updated });
    }

    // 5. Neue Rolle eingelegt (Zähler & Sensorwarnung zurücksetzen)
    if (body.action === 'RESET_ROLL') {
      const printer = await prisma.printer.findUnique({ where: { id: body.printerId } });
      if (!printer) return NextResponse.json({ error: 'Drucker nicht gefunden' }, { status: 404 });

      const updated = await prisma.printer.update({
        where: { id: body.printerId },
        data: {
          totalPaperMm: 0,
          sensorNearEndActive: false,
          paperSensorState: 'OK',
        },
      });
      if (global.io) {
        global.io.emit('printer:paper_updated', { printerId: printer.id, totalPaperMm: 0 });
        global.io.emit('printer:status_update', { printerId: printer.id, sensorNearEndActive: false, paperSensorState: 'OK' });
      }
      return NextResponse.json({ success: true, printer: updated });
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

    // 6. TCP Connection Probe / Ping Check & USB Device Detection
    if (body.action === 'PING_PRINTER' || body.action === 'PING_ALL') {
      const net = await import('net');
      const fs = await import('fs');
      const printers = body.printerId
        ? await prisma.printer.findMany({ where: { id: body.printerId } })
        : await prisma.printer.findMany();

      const results: Record<string, { online: boolean; latencyMs?: number; isVirtual: boolean; hasCashDrawer?: boolean; sensorNearEndActive?: boolean; paperSensorState?: string; totalPaperMm?: number; rollLengthM?: number }> = {};

      await Promise.all(
        printers.map((p) => {
          if (p.isVirtual) {
            results[p.id] = {
              online: true,
              isVirtual: true,
              latencyMs: 0,
              hasCashDrawer: p.hasCashDrawer,
              sensorNearEndActive: p.sensorNearEndActive,
              paperSensorState: p.paperSensorState,
              totalPaperMm: p.totalPaperMm,
              rollLengthM: p.rollLengthM,
            };
            return Promise.resolve();
          }

          if (p.connectionType === 'WEB_RELAY' || p.ipAddress.toUpperCase() === 'WEB_RELAY' || p.ipAddress.startsWith('RELAY')) {
            // Web-Relay: Online wenn Socket.IO aktiv ist
            results[p.id] = {
              online: Boolean(global.io),
              isVirtual: false,
              latencyMs: 1,
              hasCashDrawer: p.hasCashDrawer,
              sensorNearEndActive: p.sensorNearEndActive,
              paperSensorState: p.paperSensorState,
              totalPaperMm: p.totalPaperMm,
              rollLengthM: p.rollLengthM,
            };
            return Promise.resolve();
          }

          if (p.ipAddress.startsWith('/dev/') || p.ipAddress.startsWith('\\\\') || /^COM\d+$/i.test(p.ipAddress)) {
            const exists = p.ipAddress.startsWith('/dev/') ? fs.existsSync(p.ipAddress) : true;
            results[p.id] = {
              online: exists,
              isVirtual: false,
              latencyMs: exists ? 1 : undefined,
              hasCashDrawer: p.hasCashDrawer,
              sensorNearEndActive: p.sensorNearEndActive,
              paperSensorState: p.paperSensorState,
              totalPaperMm: p.totalPaperMm,
              rollLengthM: p.rollLengthM,
            };
            return Promise.resolve();
          }

          return new Promise<void>((resolve) => {
            const start = Date.now();
            const socket = new net.Socket();
            socket.setTimeout(1500);

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
                  sensorNearEndActive: p.sensorNearEndActive,
                  paperSensorState: p.paperSensorState,
                  totalPaperMm: p.totalPaperMm,
                  rollLengthM: p.rollLengthM,
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

    // M4.2 Ziel-Adresse validieren (kein Raw-Socket zu oeffentlichen IPs)
    const target = validatePrinterAddress(body.ipAddress, body.port);
    if (!target.ok) {
      return NextResponse.json({ error: target.error }, { status: 400 });
    }

    const created = await prisma.printer.create({
      data: {
        name: body.name,
        ipAddress: target.ip,
        port: target.port,
        paperWidth: parseInt(body.paperWidth || 80, 10),
        characterSet: body.characterSet || 'CP858',
        isVirtual: body.isVirtual ?? false,
        isActive: body.isActive ?? true,
        hasCashDrawer: Boolean(body.hasCashDrawer),
        connectionType: body.connectionType || 'NETWORK',
        relayStation: body.relayStation || null,
        rollLengthM: parseInt(body.rollLengthM || 80, 10),
        calibLineMm: body.calibLineMm !== undefined ? parseFloat(body.calibLineMm) : 3.75,
        calibFeedMm: body.calibFeedMm !== undefined ? parseFloat(body.calibFeedMm) : 15.0,
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

      // M4.2 Ziel-Adresse validieren, falls sie geaendert wird
      let ipUpdate: string | undefined;
      let portUpdate: number | undefined;
      if (body.ipAddress !== undefined || body.port !== undefined) {
        const existing = await prisma.printer.findUnique({
          where: { id: body.id },
          select: { ipAddress: true, port: true },
        });
        if (!existing) {
          return NextResponse.json({ error: 'Drucker nicht gefunden' }, { status: 404 });
        }
        const target = validatePrinterAddress(
          body.ipAddress !== undefined ? body.ipAddress : existing.ipAddress,
          body.port !== undefined ? body.port : existing.port
        );
        if (!target.ok) {
          return NextResponse.json({ error: target.error }, { status: 400 });
        }
        ipUpdate = body.ipAddress !== undefined ? target.ip : undefined;
        portUpdate = body.port !== undefined ? target.port : undefined;
      }

      const updated = await prisma.printer.update({
        where: { id: body.id },
        data: {
          name: body.name,
          ipAddress: ipUpdate,
          port: portUpdate,
          paperWidth: body.paperWidth !== undefined ? parseInt(body.paperWidth, 10) : undefined,
          characterSet: body.characterSet !== undefined ? body.characterSet : undefined,
          isVirtual: body.isVirtual !== undefined ? body.isVirtual : undefined,
          isActive: body.isActive !== undefined ? body.isActive : undefined,
          hasCashDrawer: body.hasCashDrawer !== undefined ? Boolean(body.hasCashDrawer) : undefined,
          connectionType: body.connectionType !== undefined ? body.connectionType : undefined,
          relayStation: body.relayStation !== undefined ? body.relayStation : undefined,
          rollLengthM: body.rollLengthM !== undefined ? parseInt(body.rollLengthM, 10) : undefined,
          totalPaperMm: body.totalPaperMm !== undefined ? parseInt(body.totalPaperMm, 10) : undefined,
          sensorNearEndActive: body.sensorNearEndActive !== undefined ? Boolean(body.sensorNearEndActive) : undefined,
          paperSensorState: body.paperSensorState !== undefined ? body.paperSensorState : undefined,
          calibLineMm: body.calibLineMm !== undefined ? parseFloat(body.calibLineMm) : undefined,
          calibFeedMm: body.calibFeedMm !== undefined ? parseFloat(body.calibFeedMm) : undefined,
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
