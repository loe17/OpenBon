import { describe, it, expect } from 'vitest';
import PaymentAdapterRegistry from '../lib/payment/adapters/registry';
import { SumUpAdapter } from '../lib/payment/adapters/sumup';
import { VrPayMeAdapter } from '../lib/payment/adapters/vr-payme';
import { SparkasseSposAdapter } from '../lib/payment/adapters/sparkasse-spos';
import { ZettleAdapter } from '../lib/payment/adapters/zettle';
import { StripeTerminalAdapter } from '../lib/payment/adapters/stripe-terminal';
import { ZvtAdapter } from '../lib/payment/adapters/zvt';
import { CASH_NOTE_VALUES, CASH_COIN_VALUES } from '../lib/pricing';

describe('Payment Adapters & Multi-Provider Engine', () => {
  it('should resolve all provider adapters via registry', () => {
    expect(PaymentAdapterRegistry.getAdapter('SUMUP')).toBeInstanceOf(SumUpAdapter);
    expect(PaymentAdapterRegistry.getAdapter('CARD_SUMUP')).toBeInstanceOf(SumUpAdapter);
    expect(PaymentAdapterRegistry.getAdapter('VR_PAYME')).toBeInstanceOf(VrPayMeAdapter);
    expect(PaymentAdapterRegistry.getAdapter('CARD_VRPAY')).toBeInstanceOf(VrPayMeAdapter);
    expect(PaymentAdapterRegistry.getAdapter('SPARKASSE_SPOS')).toBeInstanceOf(SparkasseSposAdapter);
    expect(PaymentAdapterRegistry.getAdapter('CARD_SPARKASSE')).toBeInstanceOf(SparkasseSposAdapter);
    expect(PaymentAdapterRegistry.getAdapter('ZETTLE')).toBeInstanceOf(ZettleAdapter);
    expect(PaymentAdapterRegistry.getAdapter('CARD_ZETTLE')).toBeInstanceOf(ZettleAdapter);
    expect(PaymentAdapterRegistry.getAdapter('STRIPE')).toBeInstanceOf(StripeTerminalAdapter);
    expect(PaymentAdapterRegistry.getAdapter('CARD_STRIPE')).toBeInstanceOf(StripeTerminalAdapter);
    expect(PaymentAdapterRegistry.getAdapter('ZVT')).toBeInstanceOf(ZvtAdapter);
    expect(PaymentAdapterRegistry.getAdapter('CARD_TERMINAL')).toBeInstanceOf(ZvtAdapter);
  });

  it('should correctly build SumUp deep link and parse callback', async () => {
    const adapter = new SumUpAdapter();
    const init = await adapter.initiatePayment(
      {
        amountInCents: 2550,
        customerReference: 'TEST-SUMUP-01',
        title: 'Tisch 5',
        baseUrl: 'http://openbon.local',
      },
      { type: 'SUMUP', sumupAppId: 'my-affiliate-key' }
    );

    expect(init.kind).toBe('deeplink');
    if (init.kind === 'deeplink') {
      expect(init.url).toContain('sumupmerchant://pay/1.0');
      expect(init.url).toContain('total=25.50');
      expect(init.url).toContain('affiliate-key=my-affiliate-key');
      expect(init.url).toContain('foreign-tx-id=TEST-SUMUP-01');
    }

    const callbackOk = adapter.handleCallback(
      new URLSearchParams('smp-status=success&smp-tx-code=TX-999&foreign-tx-id=TEST-SUMUP-01')
    );
    expect(callbackOk.status).toBe('SUCCESS');
    expect(callbackOk.externalTransactionId).toBe('TX-999');
    expect(callbackOk.customerReference).toBe('TEST-SUMUP-01');

    const callbackCancel = adapter.handleCallback(
      new URLSearchParams('smp-status=cancelled&foreign-tx-id=TEST-SUMUP-01')
    );
    expect(callbackCancel.status).toBe('CANCELLED');
  });

  it('should correctly build VR-Pay Me deep link and parse callback', async () => {
    const adapter = new VrPayMeAdapter();
    const init = await adapter.initiatePayment(
      {
        amountInCents: 1500,
        customerReference: 'VR-123',
        baseUrl: 'http://openbon.local',
      },
      { type: 'VR_PAYME', vrPayApiKey: 'key-123', vrPayTerminalId: 'term-456' }
    );

    expect(init.kind).toBe('deeplink');
    if (init.kind === 'deeplink') {
      expect(init.url).toContain('vrpayme://payment');
      expect(init.url).toContain('apiKey=key-123');
      expect(init.url).toContain('terminalId=term-456');
      expect(init.url).toContain('userReference=VR-123');
    }

    const callback = adapter.handleCallback({
      status: 'SUCCESS',
      identifier: 'VR-TX-77',
      userReference: 'VR-123',
      cardBrand: 'VISA',
    });
    expect(callback.status).toBe('SUCCESS');
    expect(callback.externalTransactionId).toBe('VR-TX-77');
    expect(callback.cardBrand).toBe('VISA');
  });

  it('should correctly build Sparkasse S-POS deep link and parse callback', async () => {
    const adapter = new SparkasseSposAdapter();
    const init = await adapter.initiatePayment(
      {
        amountInCents: 4200,
        customerReference: 'SPOS-99',
        baseUrl: 'http://openbon.local',
      },
      { type: 'SPARKASSE_SPOS', sparkasseMerchantId: 'MERCH-001' }
    );

    expect(init.kind).toBe('deeplink');
    if (init.kind === 'deeplink') {
      expect(init.url).toContain('spos://pay');
      expect(init.url).toContain('merchantId=MERCH-001');
      expect(init.url).toContain('amount=42.00');
      expect(init.url).toContain('receiptId=SPOS-99');
    }

    const callback = adapter.handleCallback({
      result: 'SUCCESS',
      txId: 'SPOS-TX-88',
      receiptId: 'SPOS-99',
    });
    expect(callback.status).toBe('SUCCESS');
    expect(callback.externalTransactionId).toBe('SPOS-TX-88');
  });

  it('should correctly build Zettle deep link and parse callback', async () => {
    const adapter = new ZettleAdapter();
    const init = await adapter.initiatePayment(
      {
        amountInCents: 3300,
        customerReference: 'ZET-55',
        baseUrl: 'http://openbon.local',
      },
      { type: 'ZETTLE' }
    );

    expect(init.kind).toBe('deeplink');
    if (init.kind === 'deeplink') {
      expect(init.url).toContain('zettle://payment');
      expect(init.url).toContain('amount=33.00');
      expect(init.url).toContain('reference=ZET-55');
    }

    const callback = adapter.handleCallback({
      status: 'success',
      zettleTransactionId: 'ZET-TX-100',
      reference: 'ZET-55',
    });
    expect(callback.status).toBe('SUCCESS');
    expect(callback.externalTransactionId).toBe('ZET-TX-100');
  });

  it('should provide full coin and note values for cash change calculator', () => {
    expect(CASH_NOTE_VALUES).toEqual([100, 50, 20, 10, 5]);
    expect(CASH_COIN_VALUES).toEqual([2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01]);
  });
});
