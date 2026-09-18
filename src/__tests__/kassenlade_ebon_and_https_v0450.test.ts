import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { generateDigitalReceiptCode, buildReceiptUrl } from '../lib/digital-receipt';
import { GET as getCert } from '../app/api/system/cert/route';
import { HANDBOOK } from '../app/docs/handbook-data';

describe('OpenBon v0.4.50: Kassenlade, E-Bon QR & Festzelt-HTTPS Tests', () => {
  it('E-Bon Code & URL Generierung funktioniert auch ohne vorherigen LICENSE_HMAC_SECRET', () => {
    const code = generateDigitalReceiptCode('test-payment-12345');
    expect(code).toBeDefined();
    expect(typeof code).toBe('string');
    expect(code.length).toBe(24);

    // Externe Webhosting-Brücke nutzt den universellen ?code= Parameter für 100% Serverkompatibilität
    const externalUrl = buildReceiptUrl('https://bon.festzelt.de', code);
    expect(externalUrl).toBe('https://bon.festzelt.de/?code=' + code);

    // Lokaler Kassen-Server nutzt direkte Next.js-Route /receipt/...
    const localUrl = buildReceiptUrl('http://openbon.local', code);
    expect(localUrl).toBe('http://openbon.local/receipt/' + code);

    const relativeUrl = buildReceiptUrl('', code);
    expect(relativeUrl).toBe('/receipt/' + code);
  });

  it('GET /api/system/cert liefert das Kassen-Zertifikat oder generiert ein valides Zertifikat', async () => {
    const res = await getCert(new Request('http://localhost/api/system/cert'));
    expect(res.status).toBe(200);
    const contentType = res.headers.get('content-type');
    expect(contentType).toContain('x-x509-ca-cert');
    const disposition = res.headers.get('content-disposition');
    expect(disposition).toContain('openbon-ca.crt');
    const text = await res.text();
    expect(text).toContain('BEGIN CERTIFICATE');
    expect(text).toContain('END CERTIFICATE');
  });

  it('Handbuch enthaelt detaillierte Abschnitte fuer Kassenlade (3.3), E-Bon QR (3.5), Android HTTPS (3.10) und alle Einstellungsreiter (9.3.1 - 9.3.7)', () => {
    const posChapter = HANDBOOK.find((c) => c.id === 'pos');
    expect(posChapter).toBeDefined();
    
    const section33 = posChapter?.sections.find((s) => s.id === '3.3');
    expect(section33).toBeDefined();
    expect(section33?.heading).toContain('Kassenschublade');
    expect(JSON.stringify(section33?.paragraphs)).toContain('POS_CASHIER');

    const section35 = posChapter?.sections.find((s) => s.id === '3.5');
    expect(section35).toBeDefined();
    expect(section35?.heading).toContain('Digitaler E-Bon');
    expect(JSON.stringify(section35?.paragraphs)).not.toContain('Web-NFC');

    const section310 = posChapter?.sections.find((s) => s.id === '3.10');
    expect(section310).toBeDefined();
    expect(section310?.heading).toContain('Android');
    expect(JSON.stringify(section310?.paragraphs)).toContain('3443');

    const diagChapter = HANDBOOK.find((c) => c.id === 'diagnostics');
    expect(diagChapter).toBeDefined();

    const expectedSectionIds = ['9.3', '9.3.1', '9.3.2', '9.3.3', '9.3.4', '9.3.5', '9.3.6', '9.3.7'];
    for (const secId of expectedSectionIds) {
      const sec = diagChapter?.sections.find((s) => s.id === secId);
      expect(sec).toBeDefined();
      expect(sec?.paragraphs || sec?.table).toBeDefined();
    }
  });

  it('Drucker-API erlaubt Kassenlade-Aktionen fuer POS_CASHIER und WAITER', () => {
    const routeFile = fs.readFileSync(path.join(__dirname, '../app/api/printers/route.ts'), 'utf-8');
    expect(routeFile).toContain("action === 'OPEN_DRAWER'");
    expect(routeFile).toContain("'POS_CASHIER'");
    expect(routeFile).toContain("'WAITER'");
    expect(routeFile).toContain("'ADMIN'");
  });

  it('Checkout-API priorisiert die zugewiesene Kassenstation (targetPrinterId) beim Kassenladen-Impuls', () => {
    const checkoutFile = fs.readFileSync(path.join(__dirname, '../app/api/orders/checkout/route.ts'), 'utf-8');
    expect(checkoutFile).toContain('body.targetPrinterId');
    expect(checkoutFile).toContain('openDrawer(posPrinter)');
  });

  it('Webhosting-Bruecke unterstuetzt ?code=, .htaccess-RewriteBase und receipt/index.php Fallback', () => {
    const bridgeDownload = fs.readFileSync(path.join(__dirname, '../app/api/bridge/download/route.ts'), 'utf-8');
    expect(bridgeDownload).toContain('receipt/index.php');

    const template = fs.readFileSync(path.join(__dirname, '../lib/webhosting-bridge-template.ts'), 'utf-8');
    expect(template).toContain('RewriteBase /');
    expect(template).toContain("$_SERVER['REQUEST_URI']");
  });
});
