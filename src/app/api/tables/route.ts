import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import networkSpooler from '@/lib/printer/network-spooler';
import { TicketData } from '@/lib/printer/types';

export async function GET() {
  try {
    const tables = await prisma.diningTable.findMany({
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
        activeWaiterName: t.activeWaiterName,
        openGrossAmount,
        openItemCount,
        orders: t.orders,
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Action: Generate Grid
    if (body.action === 'GENERATE_GRID') {
      const rows = parseInt(body.rows || 4, 10);
      const cols = parseInt(body.cols || 6, 10);
      const startNum = parseInt(body.startNumber || 1, 10);

      await prisma.diningTable.deleteMany({});

      let num = startNum;
      const createdTables = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const table = await prisma.diningTable.create({
            data: {
              tableNumber: num,
              label: `Tisch ${num}`,
              gridX: c,
              gridY: r,
              status: 'FREE',
            },
          });
          createdTables.push(table);
          num++;
        }
      }

      if (global.io) {
        global.io.emit('tables:regenerated', createdTables);
      }

      return NextResponse.json({ success: true, count: createdTables.length });
    }

    // Action: Print Table Markers on thermal printer
    if (body.action === 'PRINT_MARKERS') {
      const { printerId, startNumber, endNumber } = body;
      const printer = await prisma.printer.findUnique({ where: { id: printerId } });
      if (!printer) {
        return NextResponse.json({ error: 'Drucker nicht gefunden' }, { status: 404 });
      }

      const start = parseInt(startNumber, 10);
      const end = parseInt(endNumber, 10);

      for (let i = start; i <= end; i++) {
        const ticket: TicketData = {
          title: 'TISCHMARKE',
          tableLabel: `TISCH ${i}`,
          items: [],
          footerText: 'OrderAssist Kassen-System',
        };
        await networkSpooler.printTicket(printer, ticket);
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
      },
    });

    if (global.io) {
      global.io.emit('table:updated', created);
    }

    return NextResponse.json(created);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    // Batch update positions or single table update
    if (Array.isArray(body.tables)) {
      for (const t of body.tables) {
        await prisma.diningTable.update({
          where: { id: t.id },
          data: {
            gridX: t.gridX,
            gridY: t.gridY,
            label: t.label,
            status: t.status,
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
        label: body.label,
        gridX: body.gridX,
        gridY: body.gridY,
        status: body.status,
      },
    });

    if (global.io) {
      global.io.emit('table:updated', updated);
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
