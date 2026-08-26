import { BasePaymentAdapter, encodeQuery, formatAmountDecimal, buildGenericCallbackUrl } from './base';
import type { PaymentRequest, PaymentResult, ProviderConfiguration, InitiateResult } from '../types';

export class SparkasseSposAdapter extends BasePaymentAdapter {
  type = 'SPARKASSE_SPOS' as const;
  platformNote = 'Android Smartphone mit Sparkasse S-POS App';

  isConfigured(config: ProviderConfiguration): boolean {
    return Boolean(config.sparkasseMerchantId && config.sparkasseMerchantId.trim() !== '');
  }

  async initiatePayment(req: PaymentRequest, config: ProviderConfiguration): Promise<InitiateResult> {
    const ref = req.customerReference || req.orderId || `SPOS-${Date.now()}`;
    const callback = buildGenericCallbackUrl(req.baseUrl, ref, 'sparkasse', 'success');

    const params: Record<string, string> = {
      amount: formatAmountDecimal(req.amountInCents),
      amountInCents: String(req.amountInCents),
      currency: req.currency || 'EUR',
      merchantId: config.sparkasseMerchantId || '',
      receiptId: ref,
      reference: ref,
      description: req.title || 'OpenBon Zahlung',
      callbackUrl: callback,
      callback: callback,
    };

    const url = `spos://pay?${encodeQuery(params)}`;
    return { kind: 'deeplink', url };
  }

  handleCallback(raw: URLSearchParams | Record<string, string>): PaymentResult {
    const get = (key: string) => (raw instanceof URLSearchParams ? raw.get(key) : raw[key]) || '';

    const result = (get('result') || get('status') || '').toUpperCase();
    const txId = get('txId') || get('transactionId') || '';
    const authCode = get('authCode') || get('terminalAuth') || txId;
    const ref = get('receiptId') || get('reference') || get('referenceId') || '';
    const errorMsg = get('errorMessage') || get('error') || '';

    if (result === 'SUCCESS' || result === 'OK') {
      return {
        status: 'SUCCESS',
        externalTransactionId: txId,
        authCode,
        customerReference: ref,
      };
    } else if (result === 'CANCEL' || result === 'CANCELLED') {
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
