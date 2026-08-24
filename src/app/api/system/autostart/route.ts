import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';
import os from 'os';

const execPromise = util.promisify(exec);

export async function GET() {
  const isLinux = os.platform() === 'linux';
  let isEnabled = true;

  if (isLinux) {
    try {
      const { stdout } = await execPromise('systemctl is-enabled openbon.service');
      isEnabled = stdout.trim() === 'enabled';
    } catch {
      isEnabled = false;
    }
  }

  return NextResponse.json({
    platform: os.platform(),
    isLinux,
    autostartEnabled: isEnabled,
    serviceName: 'openbon.service',
  });
}

export async function POST(req: Request) {
  try {
    const { enable } = await req.json();
    const isLinux = os.platform() === 'linux';

    if (isLinux) {
      if (enable) {
        await execPromise('sudo systemctl enable openbon.service');
      } else {
        await execPromise('sudo systemctl disable openbon.service');
      }
    }

    return NextResponse.json({
      success: true,
      autostartEnabled: enable,
      message: enable ? 'Autostart bei Serverboot aktiviert' : 'Autostart bei Serverboot deaktiviert',
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
