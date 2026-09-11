import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { sanitizeConfigForBroadcast } from '../lib/config-sanitize';

describe('Real-Time Config & Delay Synchronization', () => {
  it('sanitizeConfigForBroadcast preserves enableOrderPrintDelay and orderPrintDelaySeconds', () => {
    const broadcastPayload = sanitizeConfigForBroadcast({
      id: 'default',
      enableOrderPrintDelay: true,
      orderPrintDelaySeconds: 90,
      waiterAutoLockMinutes: 5,
      adminPin: 'secret-pin',
      sessionSecret: 'super-secret',
    });

    expect(broadcastPayload.enableOrderPrintDelay).toBe(true);
    expect(broadcastPayload.orderPrintDelaySeconds).toBe(90);
    expect(broadcastPayload.waiterAutoLockMinutes).toBe(5);
    expect(broadcastPayload.adminPin).toBeUndefined();
    expect(broadcastPayload.sessionSecret).toBeUndefined();
  });

  it('waiter/page.tsx registers config:updated, order:delayed, order:delay_completed, and order:voided socket listeners', () => {
    const waiterPath = path.resolve(__dirname, '../app/waiter/page.tsx');
    const content = fs.readFileSync(waiterPath, 'utf8');

    expect(content).toContain("socket.on('config:updated'");
    expect(content).toContain("socket.on('order:delayed'");
    expect(content).toContain("socket.on('order:delay_completed'");
    expect(content).toContain("socket.on('order:voided'");
    expect(content).toContain("window.addEventListener('focus'");
    expect(content).toContain("document.addEventListener('visibilitychange'");
  });

  it('waiter/order/page.tsx registers config:updated and focus listeners', () => {
    const orderPath = path.resolve(__dirname, '../app/waiter/order/page.tsx');
    const content = fs.readFileSync(orderPath, 'utf8');

    expect(content).toContain("socket.on('config:updated'");
    expect(content).toContain("window.addEventListener('focus'");
    expect(content).toContain("document.addEventListener('visibilitychange'");
  });

  it('waiter/payment/page.tsx registers config:updated, table:updated, and focus listeners', () => {
    const paymentPath = path.resolve(__dirname, '../app/waiter/payment/page.tsx');
    const content = fs.readFileSync(paymentPath, 'utf8');

    expect(content).toContain("socket.on('config:updated'");
    expect(content).toContain("socket.on('table:updated'");
    expect(content).toContain("window.addEventListener('focus'");
    expect(content).toContain("document.addEventListener('visibilitychange'");
  });
});
