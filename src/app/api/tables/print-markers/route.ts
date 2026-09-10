import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { EscPosBuilder } from '@/lib/printer/escpos-builder';
import { networkSpooler } from '@/lib/printer/network-spooler';
import { requireApiAuth } from '@/lib/api-guard';

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const {
      printerId,
      start = 1,
      end = 1,
      fontSize = 4,
      qrSize = 5,
      noteText = '',
      includeQr = true,
      numberOnly = false,
    } = body;

    if (!printerId) {
      return NextResponse.json({ error: 'Drucker-ID ist erforderlich' }, { status: 400 });
    }

    const printer = await prisma.printer.findUnique({ where: { id: printerId } });
    if (!printer) {
      return NextResponse.json({ error: 'Drucker nicht gefunden' }, { status: 404 });
    }

    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    const eventName = config?.name || 'OpenBon';
    const baseUrl = config?.baseUrl || 'http://openbon.local';

    const startNum = Math.min(Number(start) || 1, Number(end) || 1);
    const endNum = Math.max(Number(start) || 1, Number(end) || 1);

    let printedCount = 0;

    for (let tableNum = startNum; tableNum <= endNum; tableNum++) {
      const qrUrl = includeQr ? `${baseUrl}/guest/table/${tableNum}` : null;
      const { rawBuffer, textRepresentation } = EscPosBuilder.buildTableMarkerTicket(
        {
          tableNumber: tableNum,
          label: numberOnly ? String(tableNum) : `Tisch ${tableNum}`,
          numberOnly: Boolean(numberOnly),
          qrUrl,
          eventName: numberOnly ? undefined : eventName,
          fontSize: Number(fontSize) || 4,
          qrSize: Number(qrSize) || 5,
          noteText: noteText || undefined,
        },
        printer.paperWidth || 80
      );

      await networkSpooler.sendRawBuffer(
        printer,
        rawBuffer,
        textRepresentation
      );

      printedCount++;
    }

    return NextResponse.json({ success: true, count: printedCount });
  } catch (error) {
    console.error('[PRINT_MARKERS] Fehler:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Fehler beim Drucken der Tischmarken' },
      { status: 500 }
    );
  }
}
