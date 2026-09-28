import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import prisma from '../lib/db';
import { HighAvailabilityService } from '../lib/ha/ha-service';
import { POST as handoverHandler } from '../app/api/system/ha/handover/route';
import { GET as getPublicConfig } from '../app/api/config/public/route';
import { getHaSyncSecret } from '../lib/ha/ha-secret';
import { ensureSessionSecret } from '../lib/session-secret';
import { signSessionToken, SESSION_COOKIE_NAME } from '../lib/auth-session';

describe('HA Auto-Failback & Handover System', () => {
  beforeEach(async () => {
    await ensureSessionSecret();
    await prisma.haLease.deleteMany().catch(() => {});
    await prisma.eventConfig.upsert({
      where: { id: 'default' },
      update: {
        haRole: 'PRIMARY',
        haPartnerUrl: 'http://192.168.178.60:3000',
        haAutoFailover: true,
        haAutoFailback: true,
      },
      create: {
        id: 'default',
        name: 'Test Event',
        haRole: 'PRIMARY',
        haPartnerUrl: 'http://192.168.178.60:3000',
        haAutoFailover: true,
        haAutoFailback: true,
      },
    }).catch(() => {});
  });

  afterEach(async () => {
    await prisma.haLease.deleteMany().catch(() => {});
    delete process.env.HA_AUTO_FAILBACK;
  });

  describe('Public Config API Auto-Failback', () => {
    it('liefert haAutoFailback: true als Standardwert aus', async () => {
      const res = await getPublicConfig();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.haAutoFailback).toBe(true);
    });

    it('liefert haAutoFailback: false aus, wenn in der Datenbank deaktiviert', async () => {
      await prisma.eventConfig.update({
        where: { id: 'default' },
        data: { haAutoFailback: false },
      });
      const res = await getPublicConfig();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.haAutoFailback).toBe(false);
    });
  });

  describe('HA Handover Endpoint (/api/system/ha/handover)', () => {
    it('verweigert Anfragen ohne Secret oder Admin-Session (401)', async () => {
      const req = new Request('http://localhost:3000/api/system/ha/handover', {
        method: 'POST',
      });
      const res = await handoverHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain('Ungültiges HA-Sync-Secret');
    });

    it('erlaubt Übergabe mit gültigem X-HA-Secret Header', async () => {
      const secret = await getHaSyncSecret();
      const req = new Request('http://localhost:3000/api/system/ha/handover', {
        method: 'POST',
        headers: {
          'X-HA-Secret': secret,
        },
      });
      const res = await handoverHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(typeof json.lastSequence).toBe('number');
      expect(json.message).toContain('STANDBY');
    });

    it('erlaubt Übergabe durch authentifizierten Administrator', async () => {
      const token = await signSessionToken({ role: 'ADMIN' });
      const req = new Request('http://localhost:3000/api/system/ha/handover', {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
      });
      const res = await handoverHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  describe('demoteToStandby & isAutoFailbackEnabled', () => {
    it('demoteToStandby gibt Lease frei und setzt haRole in der Datenbank auf STANDBY', async () => {
      const ha = new HighAvailabilityService();
      await ha.ready;

      // Zunächst als PRIMARY aktiv
      await ha.setRole('PRIMARY');
      expect(ha.getRole()).toBe('PRIMARY');

      // Handover: Demote to STANDBY
      const success = await ha.demoteToStandby();
      expect(success).toBe(true);
      expect(ha.getRole()).toBe('STANDBY');

      const cfg = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
      expect(cfg?.haRole).toBe('STANDBY');

      ha.dispose();
    });

    it('isAutoFailbackEnabled reagiert korrekt auf DB und Umgebungsvariable', async () => {
      const ha = new HighAvailabilityService();
      await ha.ready;

      // DB = true, ENV unberührt -> true
      expect(await ha.isAutoFailbackEnabled()).toBe(true);

      // DB = false -> false
      await prisma.eventConfig.update({
        where: { id: 'default' },
        data: { haAutoFailback: false },
      });
      expect(await ha.isAutoFailbackEnabled()).toBe(false);

      // ENV HA_AUTO_FAILBACK=0 übersteuert DB
      await prisma.eventConfig.update({
        where: { id: 'default' },
        data: { haAutoFailback: true },
      });
      process.env.HA_AUTO_FAILBACK = '0';
      expect(await ha.isAutoFailbackEnabled()).toBe(false);

      ha.dispose();
    });

    it('markiert initiale PRIMARY-Instanz als bevorzugten Hauptrechner', async () => {
      const ha = new HighAvailabilityService();
      await ha.ready;
      await ha.setRole('PRIMARY');
      expect(ha.isPreferred()).toBe(true);
      ha.dispose();
    });
  });
});
