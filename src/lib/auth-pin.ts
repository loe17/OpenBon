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

export const WEAK_PINS = new Set(['0000', '1111', '2222', '3333', '1234', '4321', '000000', '111111', '123456', '654321']);

export function isWeakPin(pin: string): boolean {
  const c = (pin || '').trim();
  if (!/^\d{6,12}$/.test(c)) return true;
  if (WEAK_PINS.has(c)) return true;
  // aufsteigend/absteigend oder gleiche Ziffer
  if (/^(\d)\1+$/.test(c)) return true;
  return false;
}

/**
 * Prüft eine Klartext-PIN gegen einen gespeicherten PBKDF2-Hash.
 * Klartext-Fallback entfernt: nur $pbkdf2$-Hashes werden akzeptiert.
 */
export function verifyPinHash(pin: string, storedHash: string): boolean {
  if (!pin || !storedHash) return false;
  if (!storedHash.startsWith('$pbkdf2$')) {
    return false;
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
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
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

    // 2. EventConfig prüfen (keine Werks-PINs mehr: ohne Config kein Login)
    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      return false;
    }

    let expectedPin = '';
    if (station === 'ADMIN') expectedPin = config.adminPin || '';
    else if (station === 'POS') expectedPin = config.posPin || '';
    else if (station === 'KITCHEN') expectedPin = config.kitchenPin || '';
    else if (station === 'WAITER') {
      expectedPin = config.waiterPin || '';
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
  // Durchgehend 6–12 Ziffern, keine schwachen PINs (gilt für API- UND Lib-Aufrufe)
  if (!/^\d{6,12}$/.test(clean) || isWeakPin(clean)) return false;
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

export interface StationPinsInput {
  adminPin: string;
  posPin: string;
  kitchenPin: string;
  waiterPin: string;
}

/**
 * Setzt alle 4 Stations-PINs gehasht und markiert die Ersteinrichtung als abgeschlossen.
 */
export async function setAllStationPins(pins: StationPinsInput): Promise<boolean> {
  const admin = (pins.adminPin || '').trim();
  const pos = (pins.posPin || '').trim();
  const kitchen = (pins.kitchenPin || '').trim();
  const waiter = (pins.waiterPin || '').trim();

  for (const p of [admin, pos, kitchen, waiter]) {
    if (!/^\d{6,12}$/.test(p) || isWeakPin(p)) return false;
  }
  if (new Set([admin, pos, kitchen, waiter]).size < 2) return false;

  try {
    const hashedAdmin = hashPin(admin);
    const hashedPos = hashPin(pos);
    const hashedKitchen = hashPin(kitchen);
    const hashedWaiter = hashPin(waiter);

    await prisma.eventConfig.upsert({
      where: { id: 'default' },
      update: {
        adminPin: hashedAdmin,
        posPin: hashedPos,
        kitchenPin: hashedKitchen,
        waiterPin: hashedWaiter,
        initialPinSet: true,
      },
      create: {
        id: 'default',
        adminPin: hashedAdmin,
        posPin: hashedPos,
        kitchenPin: hashedKitchen,
        waiterPin: hashedWaiter,
        initialPinSet: true,
      },
    });

    // Staff-Rollen synchronisieren
    await prisma.staff.upsert({
      where: { name: 'Administrator' },
      create: { name: 'Administrator', role: 'ADMIN', pinHash: hashedAdmin, isActive: true },
      update: { pinHash: hashedAdmin, isActive: true },
    });

    return true;
  } catch (err) {
    console.error('Fehler beim Setzen aller Stations-PINs:', err);
    return false;
  }
}

/**
 * M3.1 Migriert historische Klartext-Waiter-PINs einmalig auf PBKDF2-Hashes.
 * Idempotent: Bereits gehashte Eintraege ($pbkdf2$-Praefix) bleiben unberuehrt.
 * Die Anmeldung funktioniert waehrend und nach der Migration identisch, da
 * verifyPinHash() beide Formate akzeptiert.
 */
export async function migratePlaintextWaiterPins(): Promise<number> {
  try {
    const waiters = await prisma.waiterProfile.findMany({
      select: { id: true, pin: true },
    });

    let migrated = 0;
    for (const waiter of waiters) {
      if (waiter.pin && !waiter.pin.startsWith('$pbkdf2$')) {
        await prisma.waiterProfile.update({
          where: { id: waiter.id },
          data: { pin: hashPin(waiter.pin) },
        });
        migrated += 1;
      }
    }

    if (migrated > 0) {
      console.log(`[AUTH] ${migrated} Waiter-PIN(s) von Klartext auf PBKDF2 migriert.`);
    }
    return migrated;
  } catch (err) {
    // Migration ist best-effort: der naechste Start versucht es erneut.
    console.warn('[AUTH] Waiter-PIN-Migration uebersprungen:', err instanceof Error ? err.message : err);
    return 0;
  }
}

/**
 * Prüft, ob noch mindestens eine Standard-Werks-PIN aktiv ist oder die Ersteinrichtung noch aussteht.
 */
export async function hasFactoryPin(): Promise<boolean> {
  try {
    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    if (!config) return true;
    if (!config.initialPinSet) return true;

    // Prüfen, ob Standard-PINs noch matchen (Hash oder historischer Klartext)
    const pairs: Array<[string, string]> = [
      ['1234', config.adminPin],
      ['1111', config.posPin],
      ['2222', config.kitchenPin],
      ['3333', config.waiterPin],
    ];
    for (const [plain, stored] of pairs) {
      if (!stored) return true;
      if (stored === plain) return true;
      if (verifyPinHash(plain, stored)) return true;
    }

    return false;
  } catch {
    return false;
  }
}

