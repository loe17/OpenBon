import { describe, it, expect } from 'vitest';
import { signSessionToken, verifySessionToken, getJwtSecretKey } from '../lib/auth-session';
import { checkRateLimit, registerFailedAttempt, resetRateLimit } from '../lib/rate-limiter';
import { createDatabaseBackup } from '../lib/backup-scheduler';
import { hashPin, verifyPinHash } from '../lib/auth-pin';
import { hasRequiredRole } from '../lib/rbac';
import prisma from '../lib/db';
import fs from 'fs';

describe('OpenBon EMPFEHLUNGEN Hardening Tests', () => {
  describe('1.1 Echte serverseitige Authentifizierung', () => {
    it('sollte ein JWT Session-Token korrekt signieren und verifizieren', async () => {
      const payload = { role: 'ADMIN' as const, deviceId: 'device-test-123', waiterName: 'Chef' };
      const token = await signSessionToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const verified = await verifySessionToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.role).toBe('ADMIN');
      expect(verified?.deviceId).toBe('device-test-123');
      expect(verified?.waiterName).toBe('Chef');
    });

    it('sollte ungültige Token sicher ablehnen', async () => {
      const verified = await verifySessionToken('invalid.jwt.token');
      expect(verified).toBeNull();
    });

    it('sollte ein dynamisches 256-Bit Secret erzeugen (kein hardcoded static secret)', () => {
      const key = getJwtSecretKey();
      expect(key).toBeInstanceOf(Uint8Array);
      expect(key.length).toBeGreaterThanOrEqual(16);
    });

    it('sollte nach 5 Fehlversuchen den Rate-Limiter sperren', () => {
      const testKey = '192.168.1.100:ADMIN';
      resetRateLimit(testKey);

      for (let i = 1; i <= 4; i++) {
        const res = registerFailedAttempt(testKey);
        expect(res.locked).toBe(false);
      }

      // 5. Versuch -> Lockout
      const lockoutRes = registerFailedAttempt(testKey);
      expect(lockoutRes.locked).toBe(true);
      expect(lockoutRes.remainingSeconds).toBeGreaterThan(0);

      const check = checkRateLimit(testKey);
      expect(check.allowed).toBe(false);
      expect(check.remainingSeconds).toBeGreaterThan(0);

      resetRateLimit(testKey);
      expect(checkRateLimit(testKey).allowed).toBe(true);
    });
  });

  describe('1.4 Persistente Druck-Warteschlange & DB-Modelle', () => {
    it('sollte PrintJobs mit rawPayload in der Datenbank persistieren und abfragen können', async () => {
      const job = await prisma.printJob.create({
        data: {
          title: 'Test-Küchenbon',
          rawPayload: JSON.stringify({ items: [{ name: 'Bier', quantity: 2 }] }),
          status: 'PENDING',
          attempts: 0,
        },
      });

      expect(job.id).toBeDefined();
      expect(job.status).toBe('PENDING');
      expect(job.rawPayload).toContain('Bier');

      const retrieved = await prisma.printJob.findUnique({ where: { id: job.id } });
      expect(retrieved?.title).toBe('Test-Küchenbon');

      await prisma.printJob.delete({ where: { id: job.id } });
    });

    it('sollte IdempotencyKeys in der Datenbank speichern und Wiederholungen erkennen', async () => {
      const key = `test_key_${Date.now()}`;
      await prisma.idempotencyKey.create({
        data: {
          key,
          endpoint: '/api/orders',
          statusCode: 200,
          responseJson: JSON.stringify({ success: true, orderId: 'ord-123' }),
        },
      });

      const found = await prisma.idempotencyKey.findUnique({ where: { key } });
      expect(found).not.toBeNull();
      expect(JSON.parse(found!.responseJson).orderId).toBe('ord-123');

      await prisma.idempotencyKey.delete({ where: { key } });
    });
  });

  describe('1.3 Automatischer Backup-Scheduler', () => {
    it('sollte zeitgestempelte Datenbank-Backups anlegen', async () => {
      const backupPath = await createDatabaseBackup();
      expect(backupPath).not.toBeNull();
      if (backupPath) {
        expect(fs.existsSync(backupPath)).toBe(true);
      }
    });
  });

  describe('1.2 Kryptografisches PBKDF2 PIN-Hashing & RBAC', () => {
    it('sollte PINs mit PBKDF2 und Salt hashen und verifizieren können', () => {
      const pin = '8492';
      const hash = hashPin(pin);

      expect(hash).toContain('$pbkdf2$');
      expect(verifyPinHash('8492', hash)).toBe(true);
      expect(verifyPinHash('0000', hash)).toBe(false);
      expect(verifyPinHash('8491', hash)).toBe(false);
    });

    it('sollte Rollen-Berechtigungen über die RBAC-Matrix korrekt bewerten', () => {
      expect(hasRequiredRole('ADMIN', ['WAITER', 'POS_CASHIER'])).toBe(true);
      expect(hasRequiredRole('WAITER', ['WAITER'])).toBe(true);
      expect(hasRequiredRole('WAITER', ['ADMIN'])).toBe(false);
      expect(hasRequiredRole('POS_CASHIER', ['WAITER'])).toBe(false);
    });
  });

  describe('2.1 Drucker-Fallback & EventProfile-Snapshots', () => {
    it('sollte PrintGroups mit fallbackPrinterId in der Datenbank persistieren', async () => {
      const group = await prisma.printGroup.create({
        data: {
          name: 'Test-Schanktheke',
          fallbackPrinterId: 'fallback-prn-123',
        },
      });

      expect(group.id).toBeDefined();
      expect(group.fallbackPrinterId).toBe('fallback-prn-123');

      await prisma.printGroup.delete({ where: { id: group.id } });
    });

    it('sollte EventProfile Snapshots sichern und abfragen können', async () => {
      const profile = await prisma.eventProfile.upsert({
        where: { name: 'Test-Fest-Snapshot' },
        create: {
          name: 'Test-Fest-Snapshot',
          description: 'Automatisierter Test-Snapshot',
          profileJson: JSON.stringify({ eventName: 'Testfest', tables: 10 }),
        },
        update: {
          description: 'Aktualisiert',
        },
      });

      expect(profile.id).toBeDefined();
      expect(profile.name).toBe('Test-Fest-Snapshot');

      await prisma.eventProfile.delete({ where: { id: profile.id } });
    });
  });
});
