import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import networkSpooler from '@/lib/printer/network-spooler';
import { EscPosBuilder } from '@/lib/printer/escpos-builder';
import { TicketData } from '@/lib/printer/types';

export async function GET() {
  try {
    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    const enableVirtual = config?.enableVirtualPrinters ?? true;

    const where: any = {};
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
