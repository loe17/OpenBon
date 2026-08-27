import { describe, it, expect } from 'vitest';
import { sanitizeConfigForBroadcast } from '../lib/config-sanitize';
import { sanitizeConfigInput, hashPlaintextConfigPins } from '../lib/config-whitelist';
import { EscPosBuilder } from '../lib/printer/escpos-builder';
import { validatePrinterAddress, isValidSubnetPrefix } from '../lib/printer/validate';

describe('Hardening M4/M5 - Sanitizer & Whitelists', () => {
  it('config:updated-Broadcast enthaelt keine Geheimnisse mehr', () => {
    const cleaned = sanitizeConfigForBroadcast({
      id: 'default',
      name: 'Fest',
      trainingMode: true,
      stripeSecretKey: 'sk_live_supersecret',
      vrPayApiKey: 'topsecret',
      zvtPassword: '000000',
      sessionSecret: 'abc',
      haSyncSecret: 'def',
      haSyncPartnerNote: undefined,
      adminPin: '$pbkdf2$x$y',
      posPin: '1111',
      licenseKey: 'OPENBON-COMMUNITY-FREE',
    });

    expect(cleaned.name).toBe('Fest');
    expect(cleaned.trainingMode).toBe(true);
    expect(cleaned.stripeSecretKey).toBeUndefined();
    expect(cleaned.vrPayApiKey).toBeUndefined();
    expect(cleaned.zvtPassword).toBeUndefined();
    expect(cleaned.sessionSecret).toBeUndefined();
    expect(cleaned.haSyncSecret).toBeUndefined();
    expect(cleaned.adminPin).toBeUndefined();
    expect(cleaned.posPin).toBeUndefined();
    expect(cleaned.licenseKey).toBeUndefined();
  });

  it('Restore-Whitelist akzeptiert erlaubte Felder und blockt Runtime-Secrets', () => {
    const restored = sanitizeConfigInput({
      name: 'Neues Fest',
      taxRateNormal: 19,
      enableTax: true,
      sessionSecret: 'böses-secret-vom-angreifer',
      haSyncSecret: 'erfunden',
      notAllowedField: 42,
    });

    expect(restored.name).toBe('Neues Fest');
    expect(restored.taxRateNormal).toBe(19);
    expect(restored.enableTax).toBe(true);
    expect(restored.sessionSecret).toBeUndefined();
    expect(restored.haSyncSecret).toBeUndefined();
    expect(restored.notAllowedField).toBeUndefined();
  });

  it('Klartext-PINs im Restore werden automatisch gehasht, Hashes bleiben unangetastet', () => {
    const out = hashPlaintextConfigPins({
      adminPin: '4711',
      posPin: '$pbkdf2$deadbeef$c0ffee',
    });

    expect(String(out.adminPin)).toMatch(/^\$pbkdf2\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(out.posPin).toBe('$pbkdf2$deadbeef$c0ffee');
  });

  it('ESC/POS-Sanitizer entfernt Steuerbytes, erhält Text und Zeilenumbrüche', () => {
    const cleaned = EscPosBuilder.sanitizeText('Brat\u001bwurst\u0003 - \u001bBOMG\u007f\nZeile2\r\nEnde');
    expect(cleaned).toContain('Bratwurst - BOMG');
    expect(cleaned).toContain('\n');
    expect(cleaned.endsWith('\nEnde')).toBe(true);
    expect(cleaned.includes('\u001b')).toBe(false);
    expect(cleaned.includes('\u007f')).toBe(false);
  });

  it('Druckeradressen: privat/Loopback erlaubt, oeffentliche IPs blockiert', () => {
    expect(validatePrinterAddress('192.168.4.55', 9100).ok).toBe(true);
    expect(validatePrinterAddress('10.1.2.3', 9100).ok).toBe(true);
    expect(validatePrinterAddress('172.20.5.6', 9100).ok).toBe(true);
    expect(validatePrinterAddress('127.0.0.1', '').ok).toBe(true); // Port-Fallback 9100
    expect(validatePrinterAddress('169.254.10.99', 9100).ok).toBe(true);

    const blocked = validatePrinterAddress('93.184.216.34', 9100);
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toBeTruthy();

    const badPort = validatePrinterAddress('192.168.1.200', 99999);
    expect(badPort.ok).toBe(false);

    const weirdHost = validatePrinterAddress('../etc/passwd', 9100);
    expect(weirdHost.ok).toBe(false);

    const okHostname = validatePrinterAddress('bon-drucker.fritz.box', 9100);
    expect(okHostname.ok).toBe(true);
  });

  it('Subnetz-Prefix für Scan ist streng begrenzt', () => {
    expect(isValidSubnetPrefix('192.168.4')).toBe(true);
    expect(isValidSubnetPrefix('10.0.255')).toBe(true);
    expect(isValidSubnetPrefix('256.1.2')).toBe(false);
    expect(isValidSubnetPrefix('10.1.2.3')).toBe(false); // /24-Scan will genau 3 Oktette
    expect(isValidSubnetPrefix('192.168.x')).toBe(false);
    expect(isValidSubnetPrefix('a.b.c')).toBe(false);
  });
});
