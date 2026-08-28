import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
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

  // USB / Litestream Backup-Wächter
  const usbReplicaPath = process.env.LITESTREAM_REPLICA_PATH || process.env.OPENBON_BACKUP_PATH || null;
  let usbStatus: 'OK' | 'UNWRITABLE' | 'NOT_CONFIGURED' = 'NOT_CONFIGURED';
  let usbError: string | null = null;

  if (usbReplicaPath) {
    try {
      if (fs.existsSync(usbReplicaPath)) {
        fs.accessSync(usbReplicaPath, fs.constants.W_OK);
        usbStatus = 'OK';
      } else {
        usbStatus = 'UNWRITABLE';
        usbError = 'Pfad nicht gefunden';
      }
    } catch (e: any) {
      usbStatus = 'UNWRITABLE';
      usbError = e.message || 'Kein Schreibzugriff';
    }
  }

  const isHealthy = dbStatus === 'UP' && failedPrintJobs === 0 && usbStatus !== 'UNWRITABLE';
  const isDegraded = dbStatus === 'UP' && (failedPrintJobs > 0 || usbStatus === 'UNWRITABLE');
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
      usbHealth: {
        status: usbStatus,
        path: usbReplicaPath,
        error: usbError,
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
