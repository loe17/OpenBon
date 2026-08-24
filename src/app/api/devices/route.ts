import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const now = Date.now();
    const devicesMap = global.connectedDevices || new Map();

    // Stale Filter: Geräte entfernen, die länger als 2 Minuten (120s) inaktiv sind
    for (const [id, dev] of devicesMap.entries()) {
      const lastSeenTime = new Date((dev as any).lastSeen || (dev as any).connectedAt || now).getTime();
      if (now - lastSeenTime > 120 * 1000) {
        devicesMap.delete(id);
      }
    }

    const devicesList = Array.from(devicesMap.values());
    return NextResponse.json(devicesList);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, targetDeviceId, newRole, newName } = body;

    // Action: Play Ping Tone on Waiter Smartphone
    if (action === 'PING') {
      if (global.io) {
        global.io.emit('device:play_sound', { targetDeviceId });
      }
      return NextResponse.json({ success: true, message: 'Suchton gesendet' });
    }

    // Action: Force Logout / Kick Device
    if (action === 'KICK') {
      if (global.io) {
        global.io.emit('device:kicked', { targetDeviceId });
      }
      if (global.connectedDevices) {
        global.connectedDevices.delete(targetDeviceId);
      }
      return NextResponse.json({ success: true, message: 'Gerät abgemeldet' });
    }

    // Action: Rename Device / Waiter Name live on device
    if (action === 'SET_NAME') {
      if (global.connectedDevices && global.connectedDevices.has(targetDeviceId)) {
        const dev = global.connectedDevices.get(targetDeviceId);
        if (dev) {
          dev.name = newName;
          dev.waiterName = newName;
          global.connectedDevices.set(targetDeviceId, dev);
        }
      }
      if (global.io) {
        global.io.emit('device:name_updated', { targetDeviceId, newName });
        global.io.emit('device:update', Array.from((global.connectedDevices || new Map()).values()));
      }
      return NextResponse.json({ success: true, message: 'Bedienungsname live aktualisiert' });
    }

    // Action: Change Device Role
    if (action === 'SET_ROLE') {
      if (global.connectedDevices && global.connectedDevices.has(targetDeviceId)) {
        const dev = global.connectedDevices.get(targetDeviceId);
        if (dev) {
          dev.role = newRole;
          global.connectedDevices.set(targetDeviceId, dev);
        }
      }
      if (global.io) {
        global.io.emit('device:role_changed', { targetDeviceId, newRole });
        global.io.emit('device:update', Array.from((global.connectedDevices || new Map()).values()));
      }
      return NextResponse.json({ success: true, message: 'Rolle aktualisiert' });
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
