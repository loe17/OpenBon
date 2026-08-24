import { describe, it, expect } from 'vitest';
import {
  buildSumUpDeepLink,
  buildVrPayDeepLink,
  buildSparkasseDeepLink,
  buildDeepLinkFor,
  buildCallbackUrl,
  formatDeepLinkAmount,
  PAYMENT_METHOD_TO_PROVIDER,
} from '../lib/payment/deep-links';
import {
  toBcd,
  fromBcd,
  buildApdu,
  buildRegistration,
  buildAuthorisation,
  buildAck,
  parseFrames,
  isControl,
  extractAuthCode,
  ZVT_CONTROL,
} from '../lib/payment/zvt-client';
import {
  PAYMENT_METHODS,
  getPaymentColor,
  getPaymentLabel,
  isPaymentMethodAvailable,
  hasAnyCardPaymentConfigured,
} from '../lib/payment/methods';

const ctx = {
  amount: 12.5,
  title: 'OrderBon Tisch 14',
  referenceId: 'ord-4711',
  baseUrl: 'http://openbon.local',
};

/** Spec 4.1 / 4.2 / 4.3.1: App-to-App Deep Linking */
describe('Card app deep links (Spec 4.1 - 4.3)', () => {
  it('should format the amount with two decimals and a dot', () => {
    expect(formatDeepLinkAmount(12.5)).toBe('12.50');
    expect(formatDeepLinkAmount(12.005)).toBe('12.01');
    expect(formatDeepLinkAmount(0)).toBe('0.00');
  });

  it('should build the SumUp affiliate scheme with amount, currency and callback', () => {
    const link = buildSumUpDeepLink(ctx, { affiliateKey: 'AFF-123' });

    expect(link.startsWith('sumupaffiliate://pay/v0.1?')).toBe(true);
    expect(link).toContain('affiliate-key=AFF-123');
    expect(link).toContain('amount=12.50');
    expect(link).toContain('currency=EUR');
    expect(link).toContain(encodeURIComponent('OrderBon Tisch 14'));
    expect(link).toContain(encodeURIComponent('http://openbon.local/waiter/payment/callback'));
  });

  it('should build the VR-Pay Me intent with the merchant terminal id', () => {
    const link = buildVrPayDeepLink(ctx, { terminalId: 'VR-889' });

    expect(link.startsWith('vrpayme://pay?')).toBe(true);
    expect(link).toContain('terminalId=VR-889');
    expect(link).toContain('reference=ord-4711');
  });

  it('should build the Sparkasse S-POS link', () => {
    const link = buildSparkasseDeepLink(ctx, { merchantId: 'SPK-4711' });

    expect(link.startsWith('spos://payment?')).toBe(true);
    expect(link).toContain('merchantId=SPK-4711');
    expect(link).toContain('receiptId=ord-4711');
  });

  it('should build a callback url that carries order id, provider and status', () => {
    const url = buildCallbackUrl('http://openbon.local/', 'ord-1', 'sumup');
    expect(url).toBe(
      'http://openbon.local/waiter/payment/callback?orderId=ord-1&provider=sumup&status=success'
    );
  });

  it('should map payment methods to the right provider', () => {
    expect(PAYMENT_METHOD_TO_PROVIDER.CARD_SUMUP).toBe('sumup');
    expect(PAYMENT_METHOD_TO_PROVIDER.CARD_VRPAY).toBe('vrpay');
    expect(PAYMENT_METHOD_TO_PROVIDER.CARD_SPARKASSE).toBe('sparkasse');
    expect(PAYMENT_METHOD_TO_PROVIDER.CARD_TERMINAL).toBe('zvt');
  });

  it('should dispatch to the right builder', () => {
    const config = {
      sumupAppId: 'A',
      sumupMerchantCode: 'M',
      vrPayTerminalId: 'V',
      sparkasseMerchantId: 'S',
    };
    expect(buildDeepLinkFor('sumup', ctx, config)).toContain('sumupaffiliate://');
    expect(buildDeepLinkFor('vrpay', ctx, config)).toContain('vrpayme://');
    expect(buildDeepLinkFor('sparkasse', ctx, config)).toContain('spos://');
  });
});

/** Spec 3.1 / 5.2: Signal-Farbleitsystem */
describe('Payment method colour coding (Spec 3.1 / 5.2)', () => {
  it('should provide every payment method required by the spec', () => {
    const ids = PAYMENT_METHODS.map((m) => m.id);
    expect(ids).toContain('CASH');
    expect(ids).toContain('CARD_SUMUP');
    expect(ids).toContain('CARD_VRPAY');
    expect(ids).toContain('CARD_SPARKASSE');
    expect(ids).toContain('CARD_TERMINAL');
  });

  it('should use the exact signal colours from the design tokens', () => {
    expect(getPaymentColor('CASH')).toBe('#10B981');
    expect(getPaymentColor('CARD_SUMUP')).toBe('#3B82F6');
    expect(getPaymentColor('CARD_VRPAY')).toBe('#1E40AF');
    expect(getPaymentColor('CARD_SPARKASSE')).toBe('#DC2626');
    expect(getPaymentColor('CARD_TERMINAL')).toBe('#7C3AED');
  });

  it('should fall back gracefully for unknown methods', () => {
    expect(getPaymentLabel('SOMETHING_ELSE')).toBe('SOMETHING_ELSE');
    expect(getPaymentColor('SOMETHING_ELSE')).toBe('#64748B');
  });
});

/** Spec 4.3.2: ZVT-over-IP */
describe('ZVT protocol (Spec 4.3.2)', () => {
  it('should encode numbers as packed BCD', () => {
    expect([...toBcd(1250, 6)]).toEqual([0x00, 0x00, 0x00, 0x00, 0x12, 0x50]);
    expect([...toBcd(0, 3)]).toEqual([0x00, 0x00, 0x00]);
    expect(fromBcd(toBcd(123456, 3))).toBe(123456);
  });

  it('should reject values that do not fit into the BCD field', () => {
    expect(() => toBcd(1234567, 3)).toThrow();
  });

  it('should build a registration APDU (06 00)', () => {
    const apdu = buildRegistration('000000');
    expect(apdu[0]).toBe(0x06);
    expect(apdu[1]).toBe(0x00);
    expect(apdu[2]).toBe(apdu.length - 3); // Längenfeld
    // Währung EUR = 0978
    expect(apdu[apdu.length - 2]).toBe(0x09);
    expect(apdu[apdu.length - 1]).toBe(0x78);
  });

  it('should build an authorisation APDU (06 01) carrying the amount in cents', () => {
    const apdu = buildAuthorisation(1250, 42);
    expect(apdu[0]).toBe(0x06);
    expect(apdu[1]).toBe(0x01);
    // Tag 0x04 leitet den Betrag ein
    expect(apdu[3]).toBe(0x04);
    expect([...apdu.subarray(4, 10)]).toEqual([0x00, 0x00, 0x00, 0x00, 0x12, 0x50]);
  });

  it('should refuse an authorisation without a positive amount', () => {
    expect(() => buildAuthorisation(0)).toThrow();
    expect(() => buildAuthorisation(-100)).toThrow();
  });

  it('should build a positive acknowledgement (80 00)', () => {
    const ack = buildAck();
    expect([...ack]).toEqual([0x80, 0x00, 0x00]);
  });

  it('should parse a stream into individual frames', () => {
    const stream = Buffer.concat([
      buildAck(),
      buildApdu(ZVT_CONTROL.INTERMEDIATE_STATUS, Buffer.from([0x01])),
    ]);

    const frames = parseFrames(stream);
    expect(frames).toHaveLength(2);
    expect(isControl(frames[0], ZVT_CONTROL.ACK)).toBe(true);
    expect(isControl(frames[1], ZVT_CONTROL.INTERMEDIATE_STATUS)).toBe(true);
  });

  it('should ignore an incomplete trailing frame', () => {
    const stream = Buffer.concat([buildAck(), Buffer.from([0x06, 0x0f, 0x08, 0x01])]);
    const frames = parseFrames(stream);
    expect(frames).toHaveLength(1);
  });

  it('should extract the authorisation code from a completion APDU (06 0F)', () => {
    const data = Buffer.concat([Buffer.from([0x60]), toBcd(123456, 3)]);
    expect(extractAuthCode(data)).toBe('123456');
    expect(extractAuthCode(Buffer.from([0x27, 0x00]))).toBeNull();
  });

  it('should support extended length frames', () => {
    const payload = Buffer.alloc(300, 0x01);
    const apdu = buildApdu(ZVT_CONTROL.AUTHORISATION, payload);
    expect(apdu[2]).toBe(0xff);
    const frames = parseFrames(apdu);
    expect(frames).toHaveLength(1);
    expect(frames[0].data.length).toBe(300);
  });

  describe('Payment Method Activation based on Admin Config', () => {
    it('should allow Cash and NonPaid when no terminal config is set', () => {
      const emptyConfig: any = {
        sumupMerchantCode: null,
        sumupAppId: null,
        vrPayTerminalId: null,
        sparkasseMerchantId: null,
        zvtHost: null,
      };

      expect(isPaymentMethodAvailable('CASH', emptyConfig)).toBe(true);
      expect(isPaymentMethodAvailable('NON_PAID_STAFF', emptyConfig)).toBe(true);
      expect(isPaymentMethodAvailable('CARD_SUMUP', emptyConfig)).toBe(false);
      expect(isPaymentMethodAvailable('CARD_VRPAY', emptyConfig)).toBe(false);
      expect(isPaymentMethodAvailable('CARD_SPARKASSE', emptyConfig)).toBe(false);
      expect(isPaymentMethodAvailable('CARD_TERMINAL', emptyConfig)).toBe(false);
      expect(hasAnyCardPaymentConfigured(emptyConfig)).toBe(false);
    });

    it('should activate SumUp only when merchant code or appId is set', () => {
      const sumupConfig: any = {
        sumupMerchantCode: 'SUMUP-1234',
      };
      expect(isPaymentMethodAvailable('CARD_SUMUP', sumupConfig)).toBe(true);
      expect(isPaymentMethodAvailable('CARD_VRPAY', sumupConfig)).toBe(false);
      expect(hasAnyCardPaymentConfigured(sumupConfig)).toBe(true);
    });

    it('should activate ZVT EC-Terminal when zvtHost is set', () => {
      const zvtConfig: any = {
        zvtHost: '192.168.178.50',
      };
      expect(isPaymentMethodAvailable('CARD_TERMINAL', zvtConfig)).toBe(true);
      expect(isPaymentMethodAvailable('CARD_SUMUP', zvtConfig)).toBe(false);
      expect(hasAnyCardPaymentConfigured(zvtConfig)).toBe(true);
    });
  });
});
