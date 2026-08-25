import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import networkSpooler from '@/lib/printer/network-spooler';

export async function GET() {
  const startTime = Date.now();
  let dbStatus = 'DOWN';
  let dbLatencyMs = 0;

  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - t0;
    dbStatus = 'UP';
  } catch (err) {
    dbStatus = 'DOWN';
  }

  const memory = process.memoryUsage();
  const memoryRssMb = Math.round(memory.rss / (1024 * 1024));
  const memoryHeapUsedMb = Math.round(memory.heapUsed / (1024 * 1024));
  const queueLength = networkSpooler.getQueueLength();

  let failedPrintJobs = 0;
  try {
    failedPrintJobs = await prisma.printJob.count({
      where: { status: 'FAILED' },
    });
  } catch {}

  const isHealthy = dbStatus === 'UP' && failedPrintJobs === 0;
  const isDegraded = dbStatus === 'UP' && failedPrintJobs > 0;
  const status = isHealthy ? 'HEALTHY' : isDegraded ? 'DEGRADED' : 'UNHEALTHY';

  const durationMs = Date.now() - startTime;

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      db: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      printerQueue: {
        inMemoryQueueLength: queueLength,
        failedDbJobs: failedPrintJobs,
      },
      memory: {
        rssMb: memoryRssMb,
        heapUsedMb: memoryHeapUsedMb,
      },
      checkDurationMs: durationMs,
    },
    { status: dbStatus === 'UP' ? 200 : 503 }
  );
}
