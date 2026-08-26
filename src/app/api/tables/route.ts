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
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('all') === 'true';

    const where: Record<string, unknown> = {};
    if (!includeInactive) {
      where.isActive = true;
    }

    const tables = await prisma.diningTable.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { tableNumber: 'asc' },
      include: {
        orders: {
          where: {
            status: { in: ['OPEN', 'IN_PREPARATION', 'READY'] },
          },
          include: {
            items: {
              where: { isCancelled: false },
            },
          },
        },
      },
    });

    // Calculate unpaid open balance for each table
    const result = tables.map((t) => {
      let openGrossAmount = 0;
      let openItemCount = 0;

      for (const order of t.orders) {
        for (const item of order.items) {
          const unpaidQty = item.quantity - item.paidQuantity;
          if (unpaidQty > 0) {
            openGrossAmount += (item.unitPrice + (item.deposit || 0)) * unpaidQty;
            openItemCount += unpaidQty;
          }
        }
      }

      const status = openItemCount > 0 ? 'OCCUPIED' : t.status;

      return {
        id: t.id,
        tableNumber: t.tableNumber,
        label: t.label,
        gridX: t.gridX,
        gridY: t.gridY,
        status,
        isActive: t.isActive,
        activeWaiterName: t.activeWaiterName,
        openGrossAmount,
        openItemCount,
        orders: t.orders,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();

    // Action: Generate Grid
    if (body.action === 'GENERATE_GRID') {
      const rows = parseInt(body.rows || 4, 10);
      const cols = parseInt(body.cols || 6, 10);
      const startNum = parseInt(body.startNumber || 1, 10);
      const stepNum = parseInt(body.step || body.stepNumber || 1, 10);
      const stepX = Math.max(1, parseInt(body.stepX || 1, 10));
      const stepY = Math.max(1, parseInt(body.stepY || 1, 10));

      await prisma.diningTable.deleteMany({});

      let num = startNum;
      const createdTables = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const posX = 1 + c * stepX;
          const posY = 1 + r * stepY;
          const table = await prisma.diningTable.create({
            data: {
              tableNumber: num,
              label: `Tisch ${num}`,
              gridX: posX,
              gridY: posY,
              status: 'FREE',
              isActive: true,
              qrToken: Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10),
            },
          });
          createdTables.push(table);
          num += stepNum;
        }
      }

      if (global.io) {
        global.io.emit('tables:regenerated', createdTables);
      }

      return NextResponse.json({ success: true, count: createdTables.length });
    }

    // Action: Print Table Markers on thermal printer
    if (body.action === 'PRINT_MARKERS') {
      const { printerId, startNumber, endNumber, includeQr } = body;
      const printer = await prisma.printer.findUnique({ where: { id: printerId } });
      if (!printer) {
        return NextResponse.json({ error: 'Drucker nicht gefunden' }, { status: 404 });
      }

      const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
      const baseUrl = config?.baseUrl || 'http://openbon.local';
      const guestOrderEnabled = Boolean(config?.enableGuestSelfOrder);

      const start = parseInt(startNumber, 10);
      const end = parseInt(endNumber, 10);

      for (let i = start; i <= end; i++) {
        const qrUrl = (includeQr && guestOrderEnabled) ? `${baseUrl}/guest/table/${i}` : null;
        const { rawBuffer, textRepresentation } = EscPosBuilder.buildTableMarkerTicket(
          { tableNumber: i, label: `TISCH ${i}`, qrUrl, eventName: config?.name },
          printer.paperWidth || 80
        );
        await networkSpooler.sendRawBuffer(printer, rawBuffer, textRepresentation);
      }

      return NextResponse.json({ success: true, printedCount: end - start + 1 });
    }

    // Single Table creation
    const created = await prisma.diningTable.create({
      data: {
        tableNumber: parseInt(body.tableNumber, 10),
        label: body.label || `Tisch ${body.tableNumber}`,
        gridX: body.gridX || 0,
        gridY: body.gridY || 0,
        status: body.status || 'FREE',
        isActive: body.isActive ?? true,
        qrToken: Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10),
      },
    });

    if (global.io) {
      global.io.emit('table:updated', created);
    }

    await logSystemActionSafe(() => ({
      action: 'TABLE_CREATED',
      category: 'ADMIN',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Tisch angelegt.',
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

    if (Array.isArray(body.tables)) {
      for (const t of body.tables) {
        await prisma.diningTable.update({
          where: { id: t.id },
          data: {
            gridX: t.gridX,
            gridY: t.gridY,
            label: t.label,
            status: t.status,
            isActive: t.isActive ?? true,
          },
        });
      }
      if (global.io) {
        global.io.emit('tables:updated_all');
      }
      return NextResponse.json({ success: true });
    }

    const updated = await prisma.diningTable.update({
      where: { id: body.id },
      data: {
        tableNumber: body.tableNumber !== undefined ? Number(body.tableNumber) : undefined,
        label: body.label,
        gridX: body.gridX,
        gridY: body.gridY,
        status: body.status,
        isActive: body.isActive !== undefined ? body.isActive : undefined,
      },
    });

    if (global.io) {
      global.io.emit('table:updated', updated);
    }

    await logSystemActionSafe(() => ({
      action: 'TABLE_UPDATED',
      category: 'ADMIN',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Tisch geaendert.',
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
    const deleteAll = searchParams.get('all') === 'true';

    if (deleteAll) {
      await prisma.diningTable.deleteMany({});
      if (global.io) {
        global.io.emit('tables:updated_all');
      }
      await logSystemActionSafe(() => ({
        action: 'TABLES_CLEARED_ALL',
        category: 'ADMIN',
        actor: auth.session.waiterName || auth.session.role,
        details: 'Alle Tische gelöscht.',
      }));
      return NextResponse.json({ success: true, message: 'Alle Tische gelöscht.' });
    }

    if (!id) return NextResponse.json({ error: 'Tisch-ID fehlt' }, { status: 400 });

    await prisma.diningTable.delete({ where: { id } });
    if (global.io) {
      global.io.emit('tables:updated_all');
    }
    await logSystemActionSafe(() => ({
      action: 'TABLE_DELETED',
      category: 'ADMIN',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Tisch geloescht.',
    }));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
