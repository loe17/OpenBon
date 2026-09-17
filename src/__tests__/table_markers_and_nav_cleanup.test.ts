import { describe, it, expect } from 'vitest';
import { EscPosBuilder } from '@/lib/printer/escpos-builder';
import fs from 'fs';
import path from 'path';

describe('Table Markers and Navigation Cleanup Tests', () => {
  describe('EscPosBuilder.buildTableMarkerTicket', () => {
    it('should scale to maximum full width on level 10 and not include dashed divider or default note text', () => {
      const { rawBuffer, textRepresentation } = EscPosBuilder.buildTableMarkerTicket({
        tableNumber: 5,
        numberOnly: true,
        fontSize: 10,
        noteText: '',
      });

      // textRepresentation should contain table number
      expect(textRepresentation).toContain('[ 5 ]');
      // Should NOT contain default note text
      expect(textRepresentation).not.toContain('Tischnummer bitte bei Bestellung angeben');
      // Should NOT contain double divider text
      expect(textRepresentation).not.toContain('====');

      // Check buffer has GS ! 0x77 (charSize 8, 8): hex '1d 21 77'
      const hex = rawBuffer.toString('hex');
      expect(hex).toContain('1d2177');
    });

    it('should include custom note text only when explicitly provided', () => {
      const { textRepresentation } = EscPosBuilder.buildTableMarkerTicket({
        tableNumber: 12,
        numberOnly: false,
        fontSize: 5,
        noteText: 'Gartenbereich - Selbstbedienung',
      });

      expect(textRepresentation).toContain('[ TISCH 12 ]');
      expect(textRepresentation).toContain('Gartenbereich - Selbstbedienung');
    });
  });

  describe('Tables Admin Page Source Verification', () => {
    it('should have markerCopiesPerTable defaulting to 2 and markerNoteText defaulting to empty', () => {
      const tablesSrc = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'admin', 'tables', 'page.tsx'),
        'utf-8'
      );

      expect(tablesSrc).toContain('const [markerCopiesPerTable, setMarkerCopiesPerTable] = useState<number>(2);');
      expect(tablesSrc).toContain("const [markerNoteText, setMarkerNoteText] = useState('');");
      expect(tablesSrc).toContain('Anzahl je Tisch');
      expect(tablesSrc).toContain('Druckumfang:');
      expect(tablesSrc).toContain('Tischmarken gesamt');
      expect(tablesSrc).toContain('copiesPerTable: markerCopiesPerTable');

      // Ensure dashed divider under table label in preview was removed
      const previewBlock = tablesSrc.substring(
        tablesSrc.indexOf('Table Label with Scalable Font Size'),
        tablesSrc.indexOf('QR Code Mockup')
      );
      expect(previewBlock).not.toContain('border-dashed');
    });
  });

  describe('Navbar Clean Structure Verification', () => {
    it('should have exactly 4 main groups and exclude POS/Waiter operational duplicates from admin lists', () => {
      const navbarSrc = fs.readFileSync(
        path.join(process.cwd(), 'src', 'components', 'navigation', 'navbar.tsx'),
        'utf-8'
      );

      // Verify groups definition
      expect(navbarSrc).not.toContain("id: 'operations'");
      expect(navbarSrc).toContain("id: 'inventory'");
      expect(navbarSrc).toContain("id: 'finance'");
      expect(navbarSrc).toContain("id: 'hardware'");
      expect(navbarSrc).toContain("id: 'system'");

      // Verify compact drawer logic
      expect(navbarSrc).toContain('const isExpanded = Boolean(openGroups[group.id]);');
    });
  });
});
