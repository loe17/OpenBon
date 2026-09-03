import { NextResponse } from 'next/server';
import haService from '@/lib/ha/ha-service';
import { verifyHaSecret } from '@/lib/ha/ha-secret';

export async function GET(req: Request) {
  // Shared-Secret-Pruefung: nur der Partner-Knoten darf den Heartbeat abfragen
  if (!(await verifyHaSecret(req))) {
    return NextResponse.json({ error: 'Ungueltiges HA-Sync-Secret' }, { status: 401 });
  }

  return NextResponse.json({
    status: 'HEALTHY',
    role: haService.getRole(),
    leaseExpiresAt: await haService.getLeaseExpiryIso().catch(() => null),
    timestamp: new Date().toISOString(),
  });
}
