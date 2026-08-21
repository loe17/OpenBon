import prisma from './db';

export type StationPinType = 'ADMIN' | 'POS' | 'KITCHEN' | 'WAITER';

export async function verifyStationPin(pin: string, station: StationPinType = 'ADMIN'): Promise<boolean> {
  try {
    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      if (station === 'ADMIN') return pin.trim() === '1234';
      if (station === 'POS') return pin.trim() === '1111';
      if (station === 'KITCHEN') return pin.trim() === '2222';
      return pin.trim() === '3333';
    }

    let expectedPin = '1234';
    if (station === 'ADMIN') expectedPin = config.adminPin || '1234';
    else if (station === 'POS') expectedPin = config.posPin || '1111';
    else if (station === 'KITCHEN') expectedPin = config.kitchenPin || '2222';
    else if (station === 'WAITER') expectedPin = config.waiterPin || '3333';

    return pin.trim() === expectedPin.trim();
  } catch {
    if (station === 'ADMIN') return pin.trim() === '1234';
    if (station === 'POS') return pin.trim() === '1111';
    if (station === 'KITCHEN') return pin.trim() === '2222';
    return pin.trim() === '3333';
  }
}

export async function verifyAdminPin(pin: string): Promise<boolean> {
  return verifyStationPin(pin, 'ADMIN');
}

export async function setAdminPin(newPin: string): Promise<boolean> {
  if (!newPin || newPin.length < 4) return false;
  try {
    await prisma.eventConfig.upsert({
      where: { id: 'default' },
      update: { adminPin: newPin },
      create: { id: 'default', adminPin: newPin },
    });
    return true;
  } catch {
    return false;
  }
}
