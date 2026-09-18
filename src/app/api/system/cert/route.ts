import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

async function generateCerts() {
  const sslDir = path.join(process.cwd(), 'ssl');
  const certPath = path.join(sslDir, 'server.crt');
  const keyPath = path.join(sslDir, 'server.key');
  const caCertPath = path.join(sslDir, 'ca.crt');
  const caKeyPath = path.join(sslDir, 'ca.key');

  const selfsigned = require('selfsigned');
  if (!fs.existsSync(sslDir)) {
    fs.mkdirSync(sslDir, { recursive: true });
  }

  // 1. Root-CA Stammzertifikat erzeugen (reines CA-Zertifikat ohne serverAuth / keyEncipherment, damit Android keinen privaten Schlüssel anfordert)
  const caAttrs = [{ name: 'commonName', value: 'OpenBon Kassen-Stammzertifikat (CA)' }];
  const caPems = await selfsigned.generate(caAttrs, {
    algorithm: 'sha256',
    days: 36500, // 100 Jahre lebenslang
    keySize: 2048,
    extensions: [
      { name: 'basicConstraints', cA: true, critical: true },
      { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
    ],
  });

  fs.writeFileSync(caCertPath, caPems.cert, 'utf8');
  fs.writeFileSync(caKeyPath, caPems.private, 'utf8');

  // 2. Server-Zertifikat erzeugen, signiert von der Root-CA
  const serverAttrs = [{ name: 'commonName', value: 'OpenBon Kasse' }];
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

  const serverPems = await selfsigned.generate(serverAttrs, {
    algorithm: 'sha256',
    days: 36500,
    keySize: 2048,
    ca: {
      key: caPems.private,
      cert: caPems.cert,
    },
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
      { name: 'subjectAltName', altNames },
    ],
  });

  fs.writeFileSync(certPath, serverPems.cert, 'utf8');
  fs.writeFileSync(keyPath, serverPems.private, 'utf8');
  return { certPath, keyPath, caCertPath, caKeyPath };
}

export async function GET(req: Request) {
  const sslDir = path.join(process.cwd(), 'ssl');
  const caCertPath = path.join(sslDir, 'ca.crt');
  const certPath = path.join(sslDir, 'server.crt');
  const keyPath = path.join(sslDir, 'server.key');

  if (!fs.existsSync(caCertPath) || !fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    try {
      await generateCerts();
    } catch (genErr: any) {
      return NextResponse.json({ error: 'Zertifikat konnte nicht generiert werden: ' + genErr.message }, { status: 500 });
    }
  }

  try {
    const searchParams = req ? new URL(req.url).searchParams : new URLSearchParams();
    const target = searchParams.get('type') === 'server' ? 'server' : 'ca';
    const filePath = target === 'server' ? certPath : caCertPath;
    const fileName = target === 'server' ? 'openbon-server.crt' : 'openbon-ca.crt';

    const certContent = fs.readFileSync(filePath);
    return new NextResponse(certContent, {
      headers: {
        'Content-Type': 'application/x-x509-ca-cert',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const sslDir = path.join(process.cwd(), 'ssl');
    const certPath = path.join(sslDir, 'server.crt');
    const keyPath = path.join(sslDir, 'server.key');
    const caCertPath = path.join(sslDir, 'ca.crt');
    const caKeyPath = path.join(sslDir, 'ca.key');

    if (fs.existsSync(certPath)) fs.unlinkSync(certPath);
    if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath);
    if (fs.existsSync(caCertPath)) fs.unlinkSync(caCertPath);
    if (fs.existsSync(caKeyPath)) fs.unlinkSync(caKeyPath);

    await generateCerts();

    return NextResponse.json({
      success: true,
      message: 'Neues unbegrenztes 100-Jahre Root-CA und Server-Zertifikat erfolgreich generiert!',
      validityDays: 36500,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
