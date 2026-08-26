import { BasePaymentAdapter, encodeQuery, formatAmountDecimal, buildGenericCallbackUrl } from './base';
import type { PaymentRequest, PaymentResult, ProviderConfiguration, InitiateResult } from '../types';

export class SumUpAdapter extends BasePaymentAdapter {
  type = 'SUMUP' as const;
  platformNote = 'iOS & Android: SumUp App erforderlich';

  isConfigured(config: ProviderConfiguration): boolean {
    return Boolean(
      (config.sumupAppId && config.sumupAppId.trim() !== '') ||
      (config.sumupMerchantCode && config.sumupMerchantCode.trim() !== '')
    );
  }

  async initiatePayment(req: PaymentRequest, config: ProviderConfiguration): Promise<InitiateResult> {
    const ref = req.customerReference || req.orderId || `OB-${Date.now()}`;
    const successCb = buildGenericCallbackUrl(req.baseUrl, ref, 'sumup', 'success');
    const failCb = buildGenericCallbackUrl(req.baseUrl, ref, 'sumup', 'failed');

    const totalStr = formatAmountDecimal(req.amountInCents);

    const params: Record<string, string> = {
      'affiliate-key': config.sumupAppId || config.sumupMerchantCode || '',
      'app-id': config.sumupAppId || config.sumupMerchantCode || '',
      total: totalStr,
      amount: totalStr,
      currency: req.currency || 'EUR',
      title: req.title || 'OpenBon Zahlung',
      'foreign-tx-id': ref,
      callback: successCb,
      callbacksuccess: successCb,
      callbackfail: failCb,
    };

    const url = `sumupmerchant://pay/1.0?${encodeQuery(params)}`;
    return { kind: 'deeplink', url };
  }

  handleCallback(raw: URLSearchParams | Record<string, string>): PaymentResult {
    const get = (key: string) => (raw instanceof URLSearchParams ? raw.get(key) : raw[key]) || '';

    const smpStatus = (get('smp-status') || get('status') || '').toLowerCase();
    const txCode = get('smp-tx-code') || get('tx-code') || get('transactionId') || '';
    const ref = get('foreign-tx-id') || get('referenceId') || get('orderId') || '';
    const receiptNr = get('smp-receipt-number') || '';
    const errorMsg = get('smp-error-message') || get('error') || '';

    if (smpStatus === 'success' || smpStatus === 'ok') {
      return {
        status: 'SUCCESS',
        externalTransactionId: txCode || receiptNr,
        authCode: receiptNr || txCode,
        customerReference: ref,
      };
    } else if (smpStatus === 'cancelled' || smpStatus === 'canceled' || smpStatus === 'cancel') {
      return {
        status: 'CANCELLED',
        customerReference: ref,
        errorMessage: errorMsg || 'Zahlung vom Benutzer abgebrochen',
      };
    } else {
      return {
        status: 'FAILED',
        customerReference: ref,
        errorMessage: errorMsg || 'Zahlung fehlgeschlagen',
      };
    }
  }
}
