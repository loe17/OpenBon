import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import networkSpooler from '@/lib/printer/network-spooler';
import { requireApiAuth } from '@/lib/api-guard';

export async function GET(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      occupiedTables,
      totalTables,
      openOrders,
      todayPayments,
      todayRevenue,
      failedPrintJobs,
    ] = await Promise.all([
      prisma.diningTable.count({ where: { status: 'OCCUPIED' } }),
      prisma.diningTable.count({ where: { isActive: true } }),
      prisma.order.count({ where: { status: 'OPEN' } }),
      prisma.payment.count({ where: { createdAt: { gte: todayStart }, isCancelled: false } }),
      prisma.payment.aggregate({
        where: { createdAt: { gte: todayStart }, isCancelled: false },
        _sum: { totalGross: true },
      }),
      prisma.printJob.count({ where: { status: 'FAILED' } }),
    ]);

    const connectedDevicesCount = global.connectedDevices ? global.connectedDevices.size : 0;

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      tables: {
        occupied: occupiedTables,
        total: totalTables,
        occupancyRate: totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0,
      },
      orders: {
        open: openOrders,
      },
      salesToday: {
        transactionCount: todayPayments,
        grossRevenue: todayRevenue._sum.totalGross || 0,
      },
      printer: {
        spoolerQueue: networkSpooler.getQueueLength(),
        failedJobs: failedPrintJobs,
      },
      devices: {
        connected: connectedDevicesCount,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
