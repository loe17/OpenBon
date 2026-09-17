import { describe, it, expect } from 'vitest';
import { EscPosBuilder } from '@/lib/printer/escpos-builder';
import fs from 'fs';
import path from 'path';

describe('UI and ESC/POS Fixes v0.4.56', () => {
  describe('EscPosBuilder.formatTableNumber', () => {
    it('should scale to 6x6 on 80mm paper at fontSize 10', () => {
      const builder = new EscPosBuilder(80);
      EscPosBuilder.formatTableNumber(builder, 'Tisch 7', 10);
      const buffer = builder.build();
      const expectedCharSize = Buffer.from([0x1d, 0x21, 0x55]);
      expect(buffer.includes(expectedCharSize)).toBe(true);
    });

    it('should scale to 4x5 on 58mm paper at fontSize 10 to prevent paper overflow', () => {
      const builder = new EscPosBuilder(58);
      EscPosBuilder.formatTableNumber(builder, 'Tisch 7', 10);
      const buffer = builder.build();
      const expectedCharSize = Buffer.from([0x1d, 0x21, 0x34]);
      expect(buffer.includes(expectedCharSize)).toBe(true);
    });

    it('should automatically prepend "Tisch " if only number is given', () => {
      const builder = new EscPosBuilder(80);
      EscPosBuilder.formatTableNumber(builder, '42', 4);
      const buffer = builder.build();
      expect(buffer.toString('binary')).toContain('Tisch 42');
    });
  });

  describe('EscPosBuilder.buildTableMarkerTicket', () => {
    it('should use 8x8 font size for numberOnly on level 10', () => {
      const { rawBuffer, textRepresentation } = EscPosBuilder.buildTableMarkerTicket(
        {
          tableNumber: 10,
          numberOnly: true,
          fontSize: 10,
        },
        80
      );

      const expectedCharSize = Buffer.from([0x1d, 0x21, 0x77]);
      expect(rawBuffer.includes(expectedCharSize)).toBe(true);
      expect(textRepresentation).toContain('[ 10 ]');
    });
  });

  describe('Admin Navigation Menu', () => {
    it('should not contain Kundendisplay in admin navigation groups', () => {
      const navbarSource = fs.readFileSync(
        path.join(process.cwd(), 'src', 'components', 'navigation', 'navbar.tsx'),
        'utf8'
      );
      const adminGroupsMatch = navbarSource.match(/const adminGroups: NavGroup\[\] = \[([\s\S]*?)\];/);
      expect(adminGroupsMatch).not.toBeNull();
      const adminGroupsContent = adminGroupsMatch ? adminGroupsMatch[1] : '';
      expect(adminGroupsContent).not.toContain('/customer-display');
      expect(adminGroupsContent).not.toContain('Kundendisplay');
    });

    it('should persist openGroups to localStorage in toggleGroup', () => {
      const navbarSource = fs.readFileSync(
        path.join(process.cwd(), 'src', 'components', 'navigation', 'navbar.tsx'),
        'utf8'
      );
      expect(navbarSource).toContain('openbon_admin_open_groups');
      expect(navbarSource).toContain('toggleGroup(group.id)');
    });
  });

  describe('QR Code Beitritts-Center Copy and Android HTTPS', () => {
    it('should pass fullUrl first and id second in handleCopy', () => {
      const qrCodeSource = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'admin', 'qr-codes', 'page.tsx'),
        'utf8'
      );
      expect(qrCodeSource).toContain('handleCopy(station.fullUrl || \'\', station.id)');
      expect(qrCodeSource).not.toContain('handleCopy(station.id, station.fullUrl');
    });

    it('should contain Android HTTPS helper and cert download link', () => {
      const qrCodeSource = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'admin', 'qr-codes', 'page.tsx'),
        'utf8'
      );
      expect(qrCodeSource).toContain('/api/system/cert');
      expect(qrCodeSource).toContain('Dies ist keine sichere Verbindung');
      expect(qrCodeSource).toContain('Erweitert');
    });
  });

  describe('SSL Certificate CA Extensions', () => {
    it('server.js and cert route should include basicConstraints cA: true', () => {
      const serverSource = fs.readFileSync(path.join(process.cwd(), 'server.js'), 'utf8');
      const certRouteSource = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'api', 'system', 'cert', 'route.ts'),
        'utf8'
      );
      expect(serverSource).toContain("name: 'basicConstraints', cA: true");
      expect(certRouteSource).toContain("name: 'basicConstraints', cA: true");
    });
  });
});
