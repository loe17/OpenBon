import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import { requireApiAuth } from '@/lib/api-guard';

/**
 * Praesenzliste der verbundenen Geraete.
 *
 * BEWUSST OHNE Anmeldung: die Startseite (Rollenauswahl) und das Kundendisplay
 * rufen sie ohne Session auf, um anzuzeigen welche Stationen online sind.
 * Die Middleware fuehrt `/api/devices` deshalb unter den oeffentlichen Pfaden.
 * Ausgeliefert werden nur Geraetename, Rolle und Zeitpunkt des letzten
 * Lebenszeichens - keine Umsaetze, keine PINs.
 */
export async function GET() {
  try {
    const now = Date.now();
    const devicesMap = global.connectedDevices || new Map();

    // Stale Filter: Geräte entfernen, die länger als 3 Minuten (180s) inaktiv sind
    for (const [id, dev] of devicesMap.entries()) {
      const lastSeenTime = new Date((dev as any).lastSeenAt || (dev as any).lastSeen || (dev as any).connectedAt || now).getTime();
      if (now - lastSeenTime > 180 * 1000) {
        devicesMap.delete(id);
      }
    }

    // Nur Name/Rolle/Zeitpunkt (keine IPs, kein User-Agent) – siehe Kommentar oben
    const devicesList = Array.from(devicesMap.values()).map((d) => {
      const dev = d as Record<string, unknown>;
      return {
        id: dev.id,
        name: dev.name,
        role: dev.role,
        status: dev.status,
        lastSeenAt: dev.lastSeenAt || dev.lastSeen || dev.connectedAt,
      };
    });
    return NextResponse.json(devicesList);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

/**
 * Geraeteverwaltung (Suchton, Abmelden, Umbenennen, Rolle wechseln).
 * Nur fuer Administratoren. Die Anmeldung eines Geraets laeuft NICHT hierueber,
 * sondern ueber das Socket-Ereignis `device:register` in `server.js`.
 */
export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { action, targetDeviceId, newRole, newName } = body;

    // Action: Play Ping Tone on Waiter Smartphone (gezielt, nicht Broadcast)
    if (action === 'PING') {
      if (global.io) {
        global.io.to(targetDeviceId).emit('device:play_sound', { targetDeviceId });
      }
      return NextResponse.json({ success: true, message: 'Suchton gesendet' });
    }

    // Action: Force Logout / Kick Device (gezielt, nicht Broadcast)
    if (action === 'KICK') {
      if (global.io) {
        global.io.to(targetDeviceId).emit('device:kicked', { targetDeviceId });
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
        global.io.to(targetDeviceId).emit('device:name_updated', { targetDeviceId, newName });
        global.io.to('admin_room').emit('device:update', Array.from((global.connectedDevices || new Map()).values()));
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
        global.io.to(targetDeviceId).emit('device:role_changed', { targetDeviceId, newRole });
        global.io.to('admin_room').emit('device:update', Array.from((global.connectedDevices || new Map()).values()));
      }
      await logSystemActionSafe(() => ({
        action: 'DEVICE_ACTION',
        category: 'SYSTEM',
        actor: auth.session.waiterName || auth.session.role,
        details: 'Geraeteverwaltung.',
      }));

      return NextResponse.json({ success: true, message: 'Rolle aktualisiert' });
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
