import crypto from 'crypto';
import prisma from './db';

export type StationPinType = 'ADMIN' | 'POS' | 'KITCHEN' | 'WAITER';

/**
 * Erzeugt einen sicheren PBKDF2-Hash mit zufälligem 16-Byte Salt.
 */
export function hashPin(pin: string, saltHex?: string): string {
  const clean = pin.trim();
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const derivedKey = crypto.pbkdf2Sync(clean, salt, 100000, 32, 'sha512');
  return `$pbkdf2$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

/**
 * Prüft eine Klartext-PIN gegen einen gespeicherten PBKDF2-Hash.
 */
export function verifyPinHash(pin: string, storedHash: string): boolean {
  if (!pin || !storedHash) return false;
  if (!storedHash.startsWith('$pbkdf2$')) {
    // Legacy Klartext-Vergleich mit Constant-Time
    return secureCompare(pin, storedHash);
  }

  const parts = storedHash.split('$');
  if (parts.length !== 4) return false;
  const saltHex = parts[2];
  const hashHex = parts[3];

  const targetHash = hashPin(pin, saltHex);
  const targetHashHex = targetHash.split('$')[3];

  const bufA = Buffer.from(hashHex, 'hex');
  const bufB = Buffer.from(targetHashHex, 'hex');
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Sicherer Constant-Time String-Vergleich zur Verhinderung von Timing-Attacks.
 */
export function secureCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a.padEnd(32, ' '));
  const bufB = Buffer.from(b.padEnd(32, ' '));
  return crypto.timingSafeEqual(bufA, bufB) && a.length === b.length;
}

/**
 * Prüft eine PIN gegen die Datenbank (Staff-Profile & EventConfig).
 */
export async function verifyStationPin(
  pin: string,
  station: StationPinType = 'ADMIN'
): Promise<boolean> {
  const cleanPin = (pin || '').trim();
  if (!cleanPin) return false;

  try {
    // 1. Zuerst Staff-Tabelle mit Rollen prüfen
    const staffMembers = await prisma.staff.findMany({
      where: { isActive: true },
    });

    for (const member of staffMembers) {
      if (member.role === station || (member.role === 'ADMIN' && station !== 'ADMIN')) {
        if (verifyPinHash(cleanPin, member.pinHash)) {
          return true;
        }
      }
    }

    // 2. EventConfig Fallback prüfen
    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
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
      if (verifyPinHash(cleanPin, expectedPin)) return true;

      // Auch WaiterProfile prüfen
      const waiters = await prisma.waiterProfile.findMany({
        where: { isActive: true },
        select: { id: true, pin: true },
      });

      for (const w of waiters) {
        if (verifyPinHash(cleanPin, w.pin)) {
          return true;
        }
      }
      return false;
    }

    return verifyPinHash(cleanPin, expectedPin);
  } catch (err) {
    console.error('Fehler bei PIN-Verifikation:', err);
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
    const hashed = hashPin(clean);
    await prisma.eventConfig.upsert({
      where: { id: 'default' },
      update: { adminPin: hashed },
      create: { id: 'default', adminPin: hashed },
    });

    // Auch Staff Admin aktualisieren/anlegen
    await prisma.staff.upsert({
      where: { name: 'Administrator' },
      create: { name: 'Administrator', role: 'ADMIN', pinHash: hashed, isActive: true },
      update: { pinHash: hashed, isActive: true },
    });

    return true;
  } catch {
    return false;
  }
}
