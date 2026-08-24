import { describe, it, expect } from 'vitest';
import prisma from '../lib/db';
import { APP_VERSION, APP_IS_BETA } from '../lib/version';
import { parseAndValidateLicense, generateOfflineSignature } from '../lib/license';
import { verifyStationPin } from '../lib/auth-pin';
import { EscPosBuilder } from '../lib/printer/escpos-builder';

describe('OpenBon v0.3.1: Schema, License, PIN & Print Sanity Tests', () => {
  it('should verify v0.3.1 version info', () => {
    expect(APP_VERSION).toBe('0.3.1');
  });

  it('should initialize Prisma DB Client with valid DATABASE_URL fallback', () => {
    expect(prisma).toBeDefined();
    expect(process.env.DATABASE_URL).toBeDefined();
  });

  it('should validate all essential Prisma models and schema structure', () => {
    expect(prisma.eventConfig).toBeDefined();
    expect(prisma.diningTable).toBeDefined();
    expect(prisma.product).toBeDefined();
    expect(prisma.productCategory).toBeDefined();
    expect(prisma.order).toBeDefined();
    expect(prisma.orderItem).toBeDefined();
    expect(prisma.payment).toBeDefined();
    expect(prisma.printer).toBeDefined();
  });

  it('should validate offline cryptographic license engine', () => {
    // 1. Default Community License
    const freeLic = parseAndValidateLicense('');
    expect(freeLic.isValid).toBe(true);
    expect(freeLic.type).toBe('COMMUNITY');

    // 2. Generate valid signed Pro Festival key
    const licensee = 'Feuerwehr Musterstadt e.V.';
    const type = 'PRO_FESTIVAL';
    const maxDevices = 100;
    const expiresAt = '2030-12-31';

    const payload = `${licensee}|${type}|${maxDevices}|${expiresAt}`;
    const signature = generateOfflineSignature(payload);

    const validKey = Buffer.from(
      JSON.stringify({
        licensee,
        type,
        maxDevices,
        expiresAt,
        signature,
      })
    ).toString('base64');

    const verified = parseAndValidateLicense(validKey);
    expect(verified.isValid).toBe(true);
    expect(verified.licensee).toBe('Feuerwehr Musterstadt e.V.');
    expect(verified.maxDevices).toBe(100);

    // 3. Test tampered license key
    const tamperedKey = Buffer.from(
      JSON.stringify({
        licensee: 'Hacker Club',
        type,
        maxDevices: 999,
        expiresAt,
        signature: 'FAKESIG123',
      })
    ).toString('base64');

    const rejected = parseAndValidateLicense(tamperedKey);
    expect(rejected.isValid).toBe(false);
  });

  it('should verify station PIN verification defaults', async () => {
    expect(await verifyStationPin('1234', 'ADMIN')).toBe(true);
    expect(await verifyStationPin('1111', 'POS')).toBe(true);
    expect(await verifyStationPin('2222', 'KITCHEN')).toBe(true);
    expect(await verifyStationPin('3333', 'WAITER')).toBe(true);
    expect(await verifyStationPin('9999', 'ADMIN')).toBe(false);
  });

  it('should build station QR tickets and Z-Bon ESC/POS buffers', () => {
    const stationTicket = EscPosBuilder.buildStationJoinTicket({
      title: 'Bedienung (Kellner-Station)',
      role: 'WAITER',
      description: 'Tischplan & Bestellungen',
      url: 'http://openbon.local/waiter',
      pin: '3333',
    });

    expect(stationTicket.rawBuffer).toBeDefined();
    expect(stationTicket.textRepresentation).toContain('STATIONS-PIN: 3333');
    expect(stationTicket.textRepresentation).toContain('http://openbon.local/waiter');

    const zbonTicket = EscPosBuilder.buildZBonTicket({
      totalGross: 1250.5,
      totalNet: 1050.84,
      totalTax19: 199.66,
      totalCash: 950.0,
      totalCard: 300.5,
      waiters: [{ waiterName: 'Lisa', totalGross: 620.0, cashGross: 500.0, cardGross: 120.0 }],
    });

    expect(zbonTicket.rawBuffer).toBeDefined();
    expect(zbonTicket.textRepresentation).toContain('Z-BON TAGESABSCHLUSS');
  });
});
