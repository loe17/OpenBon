import { describe, it, expect } from 'vitest';
import { verifyAdminPin, setAdminPin } from '../lib/auth-pin';
import QRCode from 'qrcode';

describe('OpenBon Security & QR Integration', () => {
  it('should verify standard admin PIN', async () => {
    await setAdminPin('1234');
    const valid = await verifyAdminPin('1234');
    expect(valid).toBe(true);

    const invalid = await verifyAdminPin('0000');
    expect(invalid).toBe(false);
  });

  it('should generate QR code Data URLs for station join URLs', async () => {
    const url = 'http://192.168.1.100:3000/waiter?role=WAITER';
    const qrDataUrl = await QRCode.toDataURL(url);

    expect(qrDataUrl).toBeDefined();
    expect(qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);
  });
});
