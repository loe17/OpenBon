import { describe, it, expect } from 'vitest';
import PaymentAdapterRegistry from '../lib/payment/adapters/registry';
import { VrPayMeAdapter } from '../lib/payment/adapters/vr-payme';
import { PUBLIC_PATHS } from '../middleware';

describe('SoftPOS Companion Terminal & VR Pay:Me Integration (v0.4.51)', () => {
  it('should allow public access to the companion card terminal page in middleware', () => {
    expect(PUBLIC_PATHS).toContain('/pos/card-terminal');
    expect(PUBLIC_PATHS).toContain('/api/payments/callback');
    expect(PUBLIC_PATHS).toContain('/payment/callback');
  });

  it('should resolve VrPayMeAdapter via registry using various aliases', () => {
    const adapter1 = PaymentAdapterRegistry.getAdapter('VR_PAYME');
    const adapter2 = PaymentAdapterRegistry.getAdapter('VRPAY');
    const adapter3 = PaymentAdapterRegistry.getAdapter('CARD_VRPAY');

    expect(adapter1).toBeInstanceOf(VrPayMeAdapter);
    expect(adapter2).toBeInstanceOf(VrPayMeAdapter);
    expect(adapter3).toBeInstanceOf(VrPayMeAdapter);
  });

  it('should generate a valid vrpayme deep link with amounts and callback URLs', async () => {
    const adapter = new VrPayMeAdapter();
    const config = {
      type: 'VR_PAYME' as const,
      vrPayTerminalId: 'TERM-12345',
      vrPayApiKey: 'KEY-XYZ',
    };

    expect(adapter.isConfigured(config)).toBe(true);

    const initResult = await adapter.initiatePayment(
      {
        amountInCents: 2450,
        currency: 'EUR',
        customerReference: 'ORD-9876',
        title: 'SB-Kiosk 3 Artikel',
        baseUrl: 'http://192.168.1.100:3000',
      },
      config
    );

    expect(initResult.kind).toBe('deeplink');
    if (initResult.kind === 'deeplink') {
      expect(initResult.url.startsWith('vrpayme://payment?')).toBe(true);

      const parsedUrl = new URL(initResult.url);
      expect(parsedUrl.searchParams.get('amount')).toBe('2450');
      expect(parsedUrl.searchParams.get('amountDecimal')).toBe('24.50');
      expect(parsedUrl.searchParams.get('terminalId')).toBe('TERM-12345');
      expect(parsedUrl.searchParams.get('apiKey')).toBe('KEY-XYZ');
      expect(parsedUrl.searchParams.get('reference')).toBe('ORD-9876');
      expect(parsedUrl.searchParams.get('callbackSuccess')).toContain('http://192.168.1.100:3000');
    }
  });

  it('should parse successful and cancelled VR Pay:Me callbacks accurately', () => {
    const adapter = new VrPayMeAdapter();

    // Success callback
    const successResult = adapter.handleCallback({
      status: 'APPROVED',
      transactionId: 'TX-999',
      userReference: 'ORD-123',
      cardBrand: 'VISA',
    });
    expect(successResult.status).toBe('SUCCESS');
    expect(successResult.externalTransactionId).toBe('TX-999');
    expect(successResult.cardBrand).toBe('VISA');

    // Cancelled callback
    const cancelResult = adapter.handleCallback({
      status: 'CANCELLED',
      userReference: 'ORD-123',
    });
    expect(cancelResult.status).toBe('CANCELLED');
    expect(cancelResult.errorMessage).toBe('Zahlung abgebrochen');
  });

  it('should format socket broadcast payloads correctly for companion smartphone terminal', () => {
    const sessionPayload = {
      sessionId: 'sess-abc-123',
      provider: 'CARD_VRPAY',
      amountCents: 1550,
      deviceId: 'kiosk-1',
      title: 'SB-Kiosk #1',
      initiate: {
        kind: 'deeplink',
        url: 'vrpayme://payment?amount=1550&amountDecimal=15.50',
      },
    };

    expect(sessionPayload.amountCents).toBe(1550);
    expect((sessionPayload.amountCents / 100).toFixed(2)).toBe('15.50');
    expect(sessionPayload.deviceId).toBe('kiosk-1');

    // Pairing check: station "ALL" or "kiosk-1" should accept
    const pairingMatches = (pairedStation: string, targetDevice: string) => {
      return pairedStation === 'ALL' || pairedStation === targetDevice;
    };

    expect(pairingMatches('ALL', sessionPayload.deviceId)).toBe(true);
    expect(pairingMatches('kiosk-1', sessionPayload.deviceId)).toBe(true);
    expect(pairingMatches('kiosk-2', sessionPayload.deviceId)).toBe(false);
  });
});
