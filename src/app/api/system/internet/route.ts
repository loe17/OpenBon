import { NextResponse } from 'next/server';
import { checkInternetConnectivity } from '@/lib/internet-monitor';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const force = searchParams.get('force') === 'true';

  const status = await checkInternetConnectivity(force);
  return NextResponse.json(status);
}
