import prisma from './db';

export async function verifyAdminPin(pin: string): Promise<boolean> {
  try {
    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    const expectedPin = config?.adminPin || '1234';
    return pin.trim() === expectedPin.trim();
  } catch {
    return pin.trim() === '1234';
  }
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
