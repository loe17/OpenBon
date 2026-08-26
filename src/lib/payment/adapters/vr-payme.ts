import { BasePaymentAdapter, encodeQuery, formatAmountDecimal, buildGenericCallbackUrl } from './base';
import type { PaymentRequest, PaymentResult, ProviderConfiguration, InitiateResult } from '../types';

export class VrPayMeAdapter extends BasePaymentAdapter {
  type = 'VR_PAYME' as const;
  platformNote = 'Android 13+ & iOS mit VR Smart Guide / VR-Pay:Me';

  isConfigured(config: ProviderConfiguration): boolean {
    return Boolean(
      (config.vrPayTerminalId && config.vrPayTerminalId.trim() !== '') ||
      (config.vrPayApiKey && config.vrPayApiKey.trim() !== '')
    );
  }

  async initiatePayment(req: PaymentRequest, config: ProviderConfiguration): Promise<InitiateResult> {
    const ref = req.customerReference || req.orderId || `VR-${Date.now()}`;
    const successCb = buildGenericCallbackUrl(req.baseUrl, ref, 'vrpay', 'success');
    const failCb = buildGenericCallbackUrl(req.baseUrl, ref, 'vrpay', 'failed');

    const params: Record<string, string> = {
      apiKey: config.vrPayApiKey || '',
      terminalId: config.vrPayTerminalId || '',
      amount: String(req.amountInCents),
      amountDecimal: formatAmountDecimal(req.amountInCents),
      currency: req.currency || 'EUR',
      userReference: ref,
      reference: ref,
      purpose: req.title || 'OpenBon Zahlung',
      callbackSuccess: successCb,
      callbackFailure: failCb,
      callback: successCb,
    };

    const url = `vrpayme://payment?${encodeQuery(params)}`;
    return { kind: 'deeplink', url };
  }

  handleCallback(raw: URLSearchParams | Record<string, string>): PaymentResult {
    const get = (key: string) => (raw instanceof URLSearchParams ? raw.get(key) : raw[key]) || '';

    const status = (get('status') || get('result') || '').toUpperCase();
    const identifier = get('identifier') || get('transactionId') || get('txId') || '';
    const userRef = get('userReference') || get('reference') || get('referenceId') || '';
    const cardBrand = get('cardBrand') || get('scheme') || '';
    const errorMsg = get('errorMessage') || get('error') || '';

    if (status === 'SUCCESS' || status === 'OK' || status === 'APPROVED') {
      return {
        status: 'SUCCESS',
        externalTransactionId: identifier,
        cardBrand: cardBrand || undefined,
        authCode: identifier,
        customerReference: userRef,
      };
    } else if (status === 'CANCELLED' || status === 'CANCEL') {
      return {
        status: 'CANCELLED',
        customerReference: userRef,
        errorMessage: errorMsg || 'Zahlung abgebrochen',
      };
    } else {
      return {
        status: 'FAILED',
        customerReference: userRef,
        errorMessage: errorMsg || 'Zahlung fehlgeschlagen',
      };
    }
  }
}
