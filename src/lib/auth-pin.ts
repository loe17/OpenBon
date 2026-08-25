import crypto from 'crypto';
import prisma from './db';

export type StationPinType = 'ADMIN' | 'POS' | 'KITCHEN' | 'WAITER';

/**
 * Sicherer Constant-Time String-Vergleich zur Verhinderung von Timing-Attacks.
 */
function secureCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a.padEnd(32, ' '));
  const bufB = Buffer.from(b.padEnd(32, ' '));
  return crypto.timingSafeEqual(bufA, bufB) && a.length === b.length;
}

/**
 * Prueft eine PIN gegen die Datenbank. Kein unsicherer Fail-Open bei Datenbankfehlern.
 */
export async function verifyStationPin(
  pin: string,
  station: StationPinType = 'ADMIN'
): Promise<boolean> {
  const cleanPin = (pin || '').trim();
  if (!cleanPin) return false;

  try {
    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      // Wenn noch keine Config existiert, nur Default-PINs einmalig prüfen
      let defPin = '1234';
      if (station === 'POS') defPin = '1111';
      else if (station === 'KITCHEN') defPin = '2222';
      else if (station === 'WAITER') defPin = '3333';
      return secureCompare(cleanPin, defPin);
    }

    let expectedPin = '1234';
    if (station === 'ADMIN') expectedPin = config.adminPin || '1234';
    else if (station === 'POS') expectedPin = config.posPin || '1111';
    else if (station === 'KITCHEN') expectedPin = config.kitchenPin || '2222';
    else if (station === 'WAITER') {
      expectedPin = config.waiterPin || '3333';
      if (secureCompare(cleanPin, expectedPin)) return true;

      // Auch Kellner-spezifische PINs aus WaiterProfile prüfen
      const waiter = await prisma.waiterProfile.findFirst({
        where: { pin: cleanPin, isActive: true },
      });
      return Boolean(waiter);
    }

    return secureCompare(cleanPin, expectedPin);
  } catch (err) {
    console.error('Fehler bei PIN-Verifikation:', err);
    // Sicherer Fail-Closed Modus: Kein Login bei unklarer DB-Antwort
    return false;
  }
}

export async function verifyAdminPin(pin: string): Promise<boolean> {
  return verifyStationPin(pin, 'ADMIN');
}

export async function setAdminPin(newPin: string): Promise<boolean> {
  const clean = (newPin || '').trim();
  if (!clean || clean.length < 4) return false;
  try {
    await prisma.eventConfig.upsert({
      where: { id: 'default' },
      update: { adminPin: clean },
      create: { id: 'default', adminPin: clean },
    });
    return true;
  } catch {
    return false;
  }
}
