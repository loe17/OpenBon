import { NextResponse } from 'next/server';
import haService from '@/lib/ha/ha-service';

export async function GET() {
  return NextResponse.json({
    status: 'HEALTHY',
    role: haService.getRole(),
    timestamp: new Date().toISOString(),
  });
}
