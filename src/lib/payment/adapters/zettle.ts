import { BasePaymentAdapter, encodeQuery, formatAmountDecimal, buildGenericCallbackUrl } from './base';
import type { PaymentRequest, PaymentResult, ProviderConfiguration, InitiateResult } from '../types';

export class ZettleAdapter extends BasePaymentAdapter {
  type = 'ZETTLE' as const;
  platformNote = 'iOS & Android mit Zettle by PayPal App';

  isConfigured(_config: ProviderConfiguration): boolean {
    return true; // Zettle App-to-App benoetigt keine statischen API-Keys in der Kassen-URL
  }

  async initiatePayment(req: PaymentRequest, _config: ProviderConfiguration): Promise<InitiateResult> {
    const ref = req.customerReference || req.orderId || `ZET-${Date.now()}`;
    const successCb = buildGenericCallbackUrl(req.baseUrl, ref, 'zettle', 'success');
    const cancelCb = buildGenericCallbackUrl(req.baseUrl, ref, 'zettle', 'cancel');

    const params: Record<string, string> = {
      amount: formatAmountDecimal(req.amountInCents),
      currency: req.currency || 'EUR',
      reference: ref,
      'x-success': successCb,
      'x-cancel': cancelCb,
    };

    const url = `zettle://payment?${encodeQuery(params)}`;
    return { kind: 'deeplink', url };
  }

  handleCallback(raw: URLSearchParams | Record<string, string>): PaymentResult {
    const get = (key: string) => (raw instanceof URLSearchParams ? raw.get(key) : raw[key]) || '';

    const status = (get('status') || get('result') || '').toLowerCase();
    const txId = get('zettleTransactionId') || get('transactionId') || get('txId') || '';
    const ref = get('reference') || get('referenceId') || '';
    const errorMsg = get('errorMessage') || get('error') || '';

    if (status === 'success' || status === 'completed' || (!status && txId)) {
      return {
        status: 'SUCCESS',
        externalTransactionId: txId,
        authCode: txId,
        customerReference: ref,
      };
    } else if (status === 'cancel' || status === 'cancelled') {
      return {
        status: 'CANCELLED',
        customerReference: ref,
        errorMessage: errorMsg || 'Zahlung in Zettle abgebrochen',
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
