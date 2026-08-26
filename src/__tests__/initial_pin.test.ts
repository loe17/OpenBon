import { describe, it, expect, afterAll } from 'vitest';
import { hashPin, verifyPinHash, setAllStationPins, hasFactoryPin } from '../lib/auth-pin';
import prisma from '../lib/db';

describe('Station PIN Security & Setup Tests', () => {
  it('should generate secure PBKDF2 hash with constant time verification', () => {
    const rawPin = '5829';
    const hash = hashPin(rawPin);

    expect(hash.startsWith('$pbkdf2$')).toBe(true);
    expect(verifyPinHash('5829', hash)).toBe(true);
    expect(verifyPinHash('1234', hash)).toBe(false);
    expect(verifyPinHash('', hash)).toBe(false);
  });

  it('should update all station pins and set initialPinSet', async () => {
    // 1. Initial-Setup durchführen
    const success = await setAllStationPins({
      adminPin: '9482',
      posPin: '6192',
      kitchenPin: '3381',
      waiterPin: '7721',
    });

    expect(success).toBe(true);

    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    expect(config?.initialPinSet).toBe(true);
    expect(config?.adminPin.startsWith('$pbkdf2$')).toBe(true);
    expect(verifyPinHash('9482', config!.adminPin)).toBe(true);
    expect(verifyPinHash('6192', config!.posPin)).toBe(true);
    expect(verifyPinHash('3381', config!.kitchenPin)).toBe(true);
    expect(verifyPinHash('7721', config!.waiterPin)).toBe(true);

    const hasFactory = await hasFactoryPin();
    expect(hasFactory).toBe(false);

    // 2. Standard-Zustand für andere parallele Tests wiederherstellen
    await setAllStationPins({
      adminPin: '1234',
      posPin: '1111',
      kitchenPin: '2222',
      waiterPin: '3333',
    });
  });
});
