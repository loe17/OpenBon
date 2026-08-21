import { NextResponse } from 'next/server';
import os from 'os';

export async function GET() {
  try {
    const interfaces = os.networkInterfaces();
    const port = process.env.PORT || '3000';
    let localIp = '127.0.0.1';

    for (const name of Object.keys(interfaces)) {
      const ifaceList = interfaces[name];
      if (!ifaceList) continue;
      for (const iface of ifaceList) {
        if (!iface.internal && iface.family === 'IPv4') {
          localIp = iface.address;
          break;
        }
      }
    }

    return NextResponse.json({
      ip: localIp,
      port,
      ipBaseUrl: `http://${localIp}:${port}`,
      localDomainUrl: `http://openbon.local:${port}`,
      baseUrl: `http://${localIp}:${port}`,
      hostName: os.hostname(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
