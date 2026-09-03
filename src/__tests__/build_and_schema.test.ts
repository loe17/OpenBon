import { describe, it, expect } from 'vitest';
import prisma from '../lib/db';
import { APP_VERSION, APP_IS_BETA } from '../lib/version';
import { parseAndValidateLicense, generateOfflineSignature } from '../lib/license';
import { verifyStationPin, setAllStationPins } from '../lib/auth-pin';
import { EscPosBuilder } from '../lib/printer/escpos-builder';

describe('OpenBon v0.4.24: Schema, License, PIN & Print Sanity Tests', () => {
  it('should verify v0.4.24 version info', () => {
    expect(APP_VERSION).toBe('0.4.24');
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

  it('should validate open-source license engine', () => {
    const lic = parseAndValidateLicense();
    expect(lic.isValid).toBe(true);
    expect(lic.type).toBe('COMMUNITY');
    expect(lic.maxDevices).toBeGreaterThanOrEqual(100);
  });

  it('should verify station PIN verification defaults', async () => {
    await setAllStationPins({
      adminPin: '582914',
      posPin: '619274',
      kitchenPin: '338159',
      waiterPin: '772481',
    });
    expect(await verifyStationPin('582914', 'ADMIN')).toBe(true);
    expect(await verifyStationPin('619274', 'POS')).toBe(true);
    expect(await verifyStationPin('338159', 'KITCHEN')).toBe(true);
    expect(await verifyStationPin('772481', 'WAITER')).toBe(true);
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
      totalGrossCents: 125050,
      totalNetCents: 105084,
      totalTax19Cents: 19966,
      totalCashCents: 95000,
      totalCardCents: 30050,
      waiters: [{ waiterName: 'Lisa', totalGrossCents: 62000, cashGrossCents: 50000, cardGrossCents: 12000 }],
    });

    expect(zbonTicket.rawBuffer).toBeDefined();
    expect(zbonTicket.textRepresentation).toContain('Z-BON TAGESABSCHLUSS');
  });
});
