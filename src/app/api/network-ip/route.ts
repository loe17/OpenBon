import { NextResponse } from 'next/server';
import os from 'os';

export async function GET() {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];

  for (const k in interfaces) {
    for (const k2 in interfaces[k]) {
      const address = interfaces[k]![k2];
      if (address.family === 'IPv4' && !address.internal) {
        addresses.push(address.address);
      }
    }
  }

  const port = process.env.PORT || 3000;
  const primaryIp = addresses[0] || '127.0.0.1';

  return NextResponse.json({
    primaryIp,
    addresses,
    port,
    baseUrl: `http://${primaryIp}:${port}`,
  });
}
