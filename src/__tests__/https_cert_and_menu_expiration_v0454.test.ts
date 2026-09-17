import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { generateIndexPhp, generateApiPhp } from '../lib/webhosting-bridge-template';

describe('OpenBon v0.4.54: 100-Year HTTPS Certificate & Menu Expiration Tests', () => {
  it('should verify server.js and cert route configure 100 years (36500 days) validity', () => {
    const serverJs = fs.readFileSync(path.join(process.cwd(), 'server.js'), 'utf-8');
    expect(serverJs).toContain('days: 36500');

    const certRoute = fs.readFileSync(
      path.join(process.cwd(), 'src', 'app', 'api', 'system', 'cert', 'route.ts'),
      'utf-8'
    );
    expect(certRoute).toContain('days: 36500');
    expect(certRoute).toContain('export async function POST');
  });

  it('should verify network-ip route provides HTTPS ports and URLs', () => {
    const networkIpRoute = fs.readFileSync(
      path.join(process.cwd(), 'src', 'app', 'api', 'network-ip', 'route.ts'),
      'utf-8'
    );
    expect(networkIpRoute).toContain('httpsPort');
    expect(networkIpRoute).toContain('httpsBaseUrl');
    expect(networkIpRoute).toContain('httpsDomainUrl');
  });

  it('should verify webhosting bridge index.php contains 7-day auto-cleaning and expiresAt handling', () => {
    const indexPhp = generateIndexPhp({
      syncToken: 'TEST_TOKEN_XYZ',
      eventName: 'Sommerfest 2026',
      defaultBaseUrl: 'https://bon.mein-verein.de',
    });

    expect(indexPhp).toContain('menu-meta.json');
    expect(indexPhp).toContain('expiresAt');
    expect(indexPhp).toContain('604800'); // 7 days in seconds
    expect(indexPhp).toContain('application/pdf');
    expect(indexPhp).toContain('Content-Disposition: inline; filename="Speisekarte.pdf"');
  });

  it('should verify webhosting bridge api.php supports expiresAt upon upload_menu', () => {
    const apiPhp = generateApiPhp({ syncToken: 'TEST_TOKEN_XYZ' });
    expect(apiPhp).toContain("action === 'upload_menu'");
    expect(apiPhp).toContain('expiresAt');
    expect(apiPhp).toContain('menu-meta.json');
  });

  it('should verify navigation consolidation in navbar.tsx has 4 clear groups without redundant operational tabs', () => {
    const navbarSrc = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'navigation', 'navbar.tsx'),
      'utf-8'
    );
    expect(navbarSrc).not.toContain("id: 'operations'");
    expect(navbarSrc).not.toContain('Verkauf & Live-Betrieb');
    expect(navbarSrc).toContain("id: 'inventory'");
    expect(navbarSrc).toContain('Sortiment & Warenwirtschaft');
    expect(navbarSrc).toContain("id: 'finance'");
    expect(navbarSrc).toContain('Kasse, Abrechnung & Finanzen');
    expect(navbarSrc).toContain("id: 'hardware'");
    expect(navbarSrc).toContain('Geräte, Tische & Hardware');
    expect(navbarSrc).toContain("id: 'system'");
    expect(navbarSrc).toContain('System & Verwaltung');

    // Bonkasse & Bedienung are accessible via the Station tiles, not inside adminGroups
    const adminGroupsSection = navbarSrc.substring(
      navbarSrc.indexOf('const adminGroups: NavGroup[]'),
      navbarSrc.indexOf('const nonAdminLinks:')
    );
    expect(adminGroupsSection).not.toContain('Bonkasse (Thekenverkauf)');
    expect(adminGroupsSection).not.toContain('Bedienung (Tischaufnahme)');
  });
});
