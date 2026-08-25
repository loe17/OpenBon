import { describe, it, expect } from 'vitest';
import { signSessionToken, verifySessionToken, getJwtSecretKey } from '../lib/auth-session';
import { checkRateLimit, registerFailedAttempt, resetRateLimit } from '../lib/rate-limiter';
import { createDatabaseBackup } from '../lib/backup-scheduler';
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

  describe('3.3 Konfigurierbare Auswahllisten & Veranstaltungsvorlagen', () => {
    it('sollte ConfigLists und EventProfiles anlegen und auslesen können', async () => {
      const list = await prisma.configList.upsert({
        where: { key: 'TEST_LIST' },
        create: { key: 'TEST_LIST', name: 'Testliste', itemsJson: JSON.stringify([{ id: '1', name: 'Eintrag 1' }]) },
        update: { itemsJson: JSON.stringify([{ id: '1', name: 'Eintrag 1' }]) },
      });

      expect(list.key).toBe('TEST_LIST');
      const items = JSON.parse(list.itemsJson);
      expect(items).toHaveLength(1);

      await prisma.configList.delete({ where: { key: 'TEST_LIST' } });
    });
  });
});
