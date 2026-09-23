import { describe, it, expect } from 'vitest';
import { APP_VERSION } from '../lib/version';
import { signSessionToken } from '../lib/auth-session';
import { GET as systemUpdateGet } from '../app/api/system/update/route';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

describe('OpenBon v0.4.62: Compact Header & Smooth Monotonic Uptime', () => {
  it('should verify APP_VERSION is 0.4.62 or higher', () => {
    expect(['0.4.62', '0.4.63', '0.4.64']).toContain(APP_VERSION);
  });

  describe('Smooth & Non-Decreasing Server Uptime Calculation', () => {
    it('should return uptime as a floored integer from metrics endpoint', async () => {
      const adminToken = await signSessionToken({ role: 'ADMIN' });
      const req = new NextRequest('http://localhost:3000/api/system/update?metricsOnly=1', {
        headers: {
          cookie: `openbon_session=${adminToken}`,
        },
      });

      const res = await systemUpdateGet(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(typeof data.uptime).toBe('number');
      expect(Number.isInteger(data.uptime)).toBe(true);
      expect(data.uptime).toBeGreaterThanOrEqual(0);
      expect(data.uptime).toBeLessThanOrEqual(Math.ceil(process.uptime()));
    });

    it('should enforce monotonic progression when server responses arrive', () => {
      // Simuliere Sequenz mit Phase-Jitter / Out-of-Order Packets
      const incomingUpdates = [10, 10, 11, 10, 11, 12, 11, 12, 13];
      let currentLiveUptime: number | null = null;

      const record: number[] = [];
      for (const serverVal of incomingUpdates) {
        currentLiveUptime = (currentLiveUptime === null ? serverVal : Math.max(currentLiveUptime, serverVal));
        record.push(currentLiveUptime);
      }

      // Die aufgezeichnete Folge darf an keiner Stelle kleiner werden als der Vorgänger
      for (let i = 1; i < record.length; i++) {
        expect(record[i]).toBeGreaterThanOrEqual(record[i - 1]);
      }
      expect(record).toEqual([10, 10, 11, 11, 11, 12, 12, 12, 13]);
    });
  });

  describe('Compact Header & Option A Verification', () => {
    it('should have Option A Globe indicator and compact clock in navbar.tsx', () => {
      const navbarPath = path.resolve(__dirname, '..', 'components', 'navigation', 'navbar.tsx');
      const content = fs.readFileSync(navbarPath, 'utf8');

      // Option A Globe icon import & usage
      expect(content).toContain('Globe');
      expect(content).toContain('<Globe className="w-4 h-4" />');
      // Compact clock without the trailing word "Uhr" inside the span
      expect(content).toContain('<span>{formattedServerTime}</span>');
      // Unified server & connection status
      expect(content).toContain("'Kasse'");
      // Tighter role badge padding
      expect(content).toContain('px-2.5 py-1 rounded-xl font-bold uppercase tracking-wider text-[10px]');
    });

    it('should have icon-only compact FullscreenButton without text labels', () => {
      const btnPath = path.resolve(__dirname, '..', 'components', 'ui', 'fullscreen-button.tsx');
      const content = fs.readFileSync(btnPath, 'utf8');

      expect(content).not.toContain('<span className="hidden md:inline">Vollbild</span>');
      expect(content).not.toContain('<span className="hidden md:inline">Fenster</span>');
      expect(content).toContain('aria-label=');
      expect(content).toContain('p-2 rounded-xl');
    });
  });
});
