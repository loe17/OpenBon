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

    const httpsPort = process.env.HTTPS_PORT || '3443';
    const portSuffix = port === '80' ? '' : `:${port}`;
    const httpsPortSuffix = httpsPort === '443' ? '' : `:${httpsPort}`;

    return NextResponse.json({
      ip: localIp,
      port,
      httpsPort,
      ipBaseUrl: `http://${localIp}${portSuffix}`,
      localDomainUrl: `http://openbon.local${portSuffix}`,
      baseUrl: `http://${localIp}${portSuffix}`,
      httpsBaseUrl: `https://${localIp}${httpsPortSuffix}`,
      httpsDomainUrl: `https://openbon.local${httpsPortSuffix}`,
      hostName: os.hostname(),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
