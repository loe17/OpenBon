import { describe, it, expect } from 'vitest';
import prisma from '../lib/db';
import { APP_VERSION, APP_IS_BETA } from '../lib/version';
import { parseAndValidateLicense, generateOfflineSignature } from '../lib/license';
import { verifyStationPin, setAllStationPins } from '../lib/auth-pin';
import { EscPosBuilder } from '../lib/printer/escpos-builder';

describe('OpenBon v0.4.17: Schema, License, PIN & Print Sanity Tests', () => {
  it('should verify v0.4.17 version info', () => {
    expect(APP_VERSION).toBe('0.4.17');
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
      adminPin: '1234',
      posPin: '1111',
      kitchenPin: '2222',
      waiterPin: '3333',
    });
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
