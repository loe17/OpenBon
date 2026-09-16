import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const sslDir = path.join(process.cwd(), 'ssl');
  const certPath = path.join(sslDir, 'server.crt');
  const keyPath = path.join(sslDir, 'server.key');

  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    try {
      const selfsigned = require('selfsigned');
      if (!fs.existsSync(sslDir)) {
        fs.mkdirSync(sslDir, { recursive: true });
      }

      const attrs = [{ name: 'commonName', value: 'OpenBon Kasse' }];
      const altNames: any[] = [
        { type: 2, value: 'localhost' },
        { type: 2, value: 'openbon.local' },
        { type: 7, ip: '127.0.0.1' },
      ];

      const os = require('os');
      const ifaces = os.networkInterfaces();
      for (const name of Object.keys(ifaces)) {
        for (const iface of ifaces[name] || []) {
          if (!iface.internal && iface.family === 'IPv4') {
            altNames.push({ type: 7, ip: iface.address });
          }
        }
      }

      const pems = await selfsigned.generate(attrs, {
        algorithm: 'sha256',
        days: 3650,
        keySize: 2048,
        extensions: [{ name: 'subjectAltName', altNames }],
      });

      fs.writeFileSync(certPath, pems.cert, 'utf8');
      fs.writeFileSync(keyPath, pems.private, 'utf8');
    } catch (genErr: any) {
      return NextResponse.json({ error: 'Zertifikat konnte nicht generiert werden: ' + genErr.message }, { status: 500 });
    }
  }

  try {
    const certContent = fs.readFileSync(certPath);
    return new NextResponse(certContent, {
      headers: {
        'Content-Type': 'application/x-x509-ca-cert',
        'Content-Disposition': 'attachment; filename="openbon-kasse.crt"',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
