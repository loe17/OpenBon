import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import networkSpooler from '@/lib/printer/network-spooler';
import { EscPosBuilder } from '@/lib/printer/escpos-builder';
import { TicketData } from '@/lib/printer/types';

export async function GET() {
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
      },
    });
    return NextResponse.json(created);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
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
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
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
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
