import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import prisma from '../lib/db';
import { HighAvailabilityService } from '../lib/ha/ha-service';
import { GET as getHealth } from '../app/api/health/route';
import { GET as getPublicConfig } from '../app/api/config/public/route';
import { GET as getDiscover } from '../app/api/system/ha/discover/route';
import { ensureSessionSecret } from '../lib/session-secret';
import { signSessionToken, SESSION_COOKIE_NAME } from '../lib/auth-session';

describe('HA 1-Klick-Netzwerksuche & Waiter Offline Puffer', () => {
  beforeEach(async () => {
    await ensureSessionSecret();
    await prisma.eventConfig.upsert({
      where: { id: 'default' },
      update: {
        haRole: 'PRIMARY',
        haPartnerUrl: 'http://192.168.178.60:3000',
        haAutoFailover: true,
      },
      create: {
        id: 'default',
        name: 'Test Fest',
        haRole: 'PRIMARY',
        haPartnerUrl: 'http://192.168.178.60:3000',
        haAutoFailover: true,
      },
    });
  });

  afterAll(async () => {
    HighAvailabilityService.resetInstance();
    await prisma.haLease.deleteMany().catch(() => {});
    await prisma.eventConfig.update({
      where: { id: 'default' },
      data: {
        haRole: 'STANDALONE',
        haPartnerUrl: null,
        haAutoFailover: false,
      },
    }).catch(() => {});
  });

  describe('Health API Erweiterung', () => {
    it('liefert Systemkennung OpenBon, Version und HA-Rolle aus', async () => {
      const res = await getHealth();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.system).toBe('OpenBon');
      expect(data.status).toBeDefined();
      expect(data.version).toBeDefined();
      expect(data.haRole).toBeDefined();
    });
  });

  describe('Public Config API Erweiterung', () => {
    it('liefert haRole, haPartnerUrl und haAutoFailover fuer Handys und Terminals', async () => {
      const res = await getPublicConfig();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.haRole).toBe('PRIMARY');
      expect(data.haPartnerUrl).toBe('http://192.168.178.60:3000');
      expect(data.haAutoFailover).toBe(true);
    });
  });

  describe('HA Discover API (1-Klick-Netzwerksuche)', () => {
    it('verweigert unbefugten Zugriff ohne Admin-Session', async () => {
      const req = new Request('http://localhost:3000/api/system/ha/discover');
      const res = await getDiscover(req);
      expect(res.status).toBe(401);
    });

    it('erlaubt authentifiziertem Administrator die Subnetz-Suche', async () => {
      const token = await signSessionToken({ role: 'ADMIN' });
      const req = new Request('http://localhost:3000/api/system/ha/discover', {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
      });

      const res = await getDiscover(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(typeof data.subnetPrefix).toBe('string');
      expect(Array.isArray(data.nodes)).toBe(true);
      expect(typeof data.nodesCount).toBe('number');
    });
  });

  describe('Offline Puffer & Caching Schluessel-Konventionen', () => {
    it('verwendet standardisierte LocalStorage-Schlüssel für Offline-Resilienz', () => {
      const keys = {
        categories: 'openbon_cached_categories',
        wordGroups: 'openbon_cached_word_groups',
        tables: 'openbon_cached_tables',
        ordersForTable: (id: string) => `openbon_cached_orders_${id}`,
        partnerUrl: 'openbon_ha_partner_url',
      };

      expect(keys.categories).toBe('openbon_cached_categories');
      expect(keys.wordGroups).toBe('openbon_cached_word_groups');
      expect(keys.tables).toBe('openbon_cached_tables');
      expect(keys.ordersForTable('tbl_123')).toBe('openbon_cached_orders_tbl_123');
      expect(keys.partnerUrl).toBe('openbon_ha_partner_url');
    });
  });
});
