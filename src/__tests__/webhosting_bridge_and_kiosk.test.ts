import { describe, it, expect } from 'vitest';
import { isExternalBridgeUrl } from '@/lib/webhosting-push';
import {
  generateIndexPhp,
  generateApiPhp,
  generateHtaccess,
  generateReadmeHtml,
} from '@/lib/webhosting-bridge-template';
import { HANDBOOK } from '@/app/docs/handbook-data';

describe('Webhosting Bridge & Kiosk Guide Tests', () => {
  describe('isExternalBridgeUrl', () => {
    it('should return true for valid external URLs', () => {
      expect(isExternalBridgeUrl('https://bon.mein-verein.de')).toBe(true);
      expect(isExternalBridgeUrl('http://bon.feuerwehr-fest.org')).toBe(true);
      expect(isExternalBridgeUrl('https://kasse.stadtfest.de:8443')).toBe(true);
    });

    it('should return false for local, internal, or loopback URLs', () => {
      expect(isExternalBridgeUrl('http://openbon.local')).toBe(false);
      expect(isExternalBridgeUrl('http://openbon.local:3000')).toBe(false);
      expect(isExternalBridgeUrl('http://localhost:3000')).toBe(false);
      expect(isExternalBridgeUrl('http://127.0.0.1:3000')).toBe(false);
      expect(isExternalBridgeUrl('http://0.0.0.0:3000')).toBe(false);
      expect(isExternalBridgeUrl('')).toBe(false);
      expect(isExternalBridgeUrl(null)).toBe(false);
      expect(isExternalBridgeUrl(undefined)).toBe(false);
      expect(isExternalBridgeUrl('invalid-url')).toBe(false);
    });
  });

  describe('Webhosting Templates', () => {
    const testToken = 'TEST-SYNC-TOKEN-12345';
    const testBaseUrl = 'https://bon.mein-verein.de';
    const testEventName = 'Feuerwehrfest 2026';

    it('generateIndexPhp should produce self-cleaning and token-aware PHP code', () => {
      const php = generateIndexPhp({
        syncToken: testToken,
        defaultBaseUrl: testBaseUrl,
        eventName: testEventName,
      });

      expect(php).toContain('<?php');
      expect(php).toContain(testToken);
      expect(php).toContain(testEventName);
      // 24 Stunden automatische Löschung
      expect(php).toContain('86400');
      // Belegabruf & Speisekarte
      expect(php).toContain('$receiptsDir');
      expect(php).toContain('Speisekarte');
      expect(php).toContain('digitaler Kassenbeleg');
    });

    it('generateApiPhp should enforce token authentication and handle push & upload', () => {
      const apiPhp = generateApiPhp({
        syncToken: testToken,
      });

      expect(apiPhp).toContain('<?php');
      expect(apiPhp).toContain(testToken);
      expect(apiPhp).toContain('HTTP_X_BRIDGE_TOKEN');
      expect(apiPhp).toContain('push_receipt');
      expect(apiPhp).toContain('upload_menu');
      expect(apiPhp).toContain('http_response_code(403)');
    });

    it('generateHtaccess should protect directories and rewrite clean URLs', () => {
      const htaccess = generateHtaccess();

      expect(htaccess).toContain('RewriteEngine On');
      expect(htaccess).toContain('Options -Indexes');
      expect(htaccess).toContain('RedirectMatch 403');
      expect(htaccess).toContain('receipt/');
      expect(htaccess).toContain('menu');
    });

    it('generateReadmeHtml should contain a simple setup guide without technical jargon', () => {
      const readme = generateReadmeHtml({
        syncToken: testToken,
        defaultBaseUrl: testBaseUrl,
        eventName: testEventName,
      });

      expect(readme).toContain(testEventName);
      expect(readme).toContain(testToken);
      expect(readme).toContain('Netcup');
      expect(readme).toContain('Plesk');
      expect(readme).toContain('httpdocs');
      expect(readme).toContain('24 Stunden');
      expect(readme).toContain('DynDNS');
    });
  });

  describe('Handbook Documentation', () => {
    it('Chapter 3.5 should contain Webhosting-Brücke and explain why DynDNS is unnecessary', () => {
      const posChapter = HANDBOOK.find((c) => c.id === 'pos');
      expect(posChapter).toBeDefined();

      const sec35 = posChapter?.sections.find((s) => s.id === '3.5');
      expect(sec35).toBeDefined();
      expect(sec35?.heading).toContain('Digitaler E-Bon');
      expect(sec35?.heading).toContain('Webhosting-Brücke');

      const allText = (sec35?.paragraphs || []).join(' ');
      expect(allText).toContain('Webhosting-Brücke');
      expect(allText).toContain('DynDNS');
      expect(allText).toContain('24 Stunden');
      expect(allText).toContain('Speisekarte');
      expect(sec35?.table).toBeDefined();
    });

    it('Chapter 3.9 should describe Fully Kiosk Browser for Android tablets', () => {
      const posChapter = HANDBOOK.find((c) => c.id === 'pos');
      expect(posChapter).toBeDefined();

      const sec39 = posChapter?.sections.find((s) => s.id === '3.9');
      expect(sec39).toBeDefined();
      expect(sec39?.heading).toContain('Android');
      expect(sec39?.heading).toContain('Vollbild');

      const allText = (sec39?.paragraphs || []).join(' ');
      expect(allText).toContain('Fully Kiosk Browser');
      expect(allText).toContain('Google Chrome');
      expect(allText).toContain('Sperren');
      expect(allText).toContain('Auto-Reload');
      expect(sec39?.table).toBeDefined();
    });
  });
});
