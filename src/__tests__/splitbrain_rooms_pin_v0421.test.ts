import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { denyStandbyWrite, isWriteAllowed } from '../lib/ha/ha-guard';
import { setAdminPin, setAllStationPins, verifyAdminPin } from '../lib/auth-pin';
import { resolveDbFile } from '../lib/db';

describe('v0.4.21 Split-Brain/Rooms/PIN-Fixes', () => {
  const oldHaRole = process.env.HA_ROLE;

  beforeEach(() => {
    delete process.env.HA_ROLE;
  });
  afterEach(() => {
    if (oldHaRole !== undefined) process.env.HA_ROLE = oldHaRole;
    else delete process.env.HA_ROLE;
  });

  it('STANDBY lehnt Schreiben ab (409), STANDALONE/PRIMARY dürfen', async () => {
    process.env.HA_ROLE = 'STANDBY';
    const denied = denyStandbyWrite();
    expect(denied).not.toBeNull();
    expect(denied!.status).toBe(409);
    const body = (await denied!.json()) as { code?: string };
    expect(body.code).toBe('HA_STANDBY_READONLY');

    delete process.env.HA_ROLE;
    expect(isWriteAllowed().allowed).toBe(true);
    expect(denyStandbyWrite()).toBeNull();
  });

  it('setAdminPin lehnt Werks-PINs und kurze PINs ab', async () => {
    expect(await setAdminPin('0000')).toBe(false);
    expect(await setAdminPin('1234')).toBe(false);
    expect(await setAdminPin('12345')).toBe(false);
    expect(await setAdminPin('582914')).toBe(true);
    expect(await verifyAdminPin('582914')).toBe(true);
  });

  it('setAllStationPins verlangt 6-stellige, nicht-triviale, diverse PINs', async () => {
    expect(await setAllStationPins({ adminPin: '1234', posPin: '1111', kitchenPin: '2222', waiterPin: '3333' })).toBe(false);
    expect(
      await setAllStationPins({ adminPin: '582914', posPin: '582914', kitchenPin: '582914', waiterPin: '582914' })
    ).toBe(false);
    expect(
      await setAllStationPins({ adminPin: '582914', posPin: '619274', kitchenPin: '338159', waiterPin: '772481' })
    ).toBe(true);
  });

  it('resolveDbFile folgt DATABASE_URL (Test: test.db, Prod: dev.db)', () => {
    const f = resolveDbFile().replace(/\\/g, '/');
    expect(f).toMatch(/prisma\/(test|dev)\.db$/);
  });
});
