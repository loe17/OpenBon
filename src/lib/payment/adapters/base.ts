import type { PaymentProviderAdapter, PaymentProviderType, ProviderConfiguration, PaymentRequest, InitiateResult, PaymentResult } from '../types';

export function formatAmountDecimal(amountInCents: number): string {
  return (amountInCents / 100).toFixed(2);
}

export function encodeQuery(params: Record<string, string>): string {
  return Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null && v !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

export function buildGenericCallbackUrl(
  baseUrl: string,
  referenceId: string,
  provider: string,
  status: 'success' | 'failed' | 'cancel' = 'success'
): string {
  const normalized = (baseUrl || 'http://openbon.local').replace(/\/+$/, '');
  const params = encodeQuery({
    referenceId,
    provider,
    status,
  });
  return `${normalized}/payment/callback?${params}`;
}

export abstract class BasePaymentAdapter implements PaymentProviderAdapter {
  abstract type: PaymentProviderType;
  platformNote?: string;

  abstract isConfigured(config: ProviderConfiguration): boolean;
  abstract initiatePayment(req: PaymentRequest, config: ProviderConfiguration): Promise<InitiateResult>;
  abstract handleCallback(params: URLSearchParams | Record<string, string>): PaymentResult;
}
