export type PaymentProviderType =
  | 'SUMUP'
  | 'VR_PAYME'
  | 'SPARKASSE_SPOS'
  | 'ZETTLE'
  | 'STRIPE'
  | 'ZVT';

export type PaymentStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMEOUT';

export interface PaymentRequest {
  orderId?: string;
  tableId?: string;
  deviceId?: string;
  waiterName?: string;
  amountInCents: number;
  currency?: string;
  taxRate?: number;
  terminalDeviceId?: string;
  cashierId?: string;
  customerReference?: string;
  title?: string;
  baseUrl: string;
  context?: Record<string, unknown>;
}

export interface PaymentResult {
  status: PaymentStatus;
  externalTransactionId?: string;
  cardBrand?: string;
  authCode?: string;
  rawResponse?: Record<string, unknown>;
  errorMessage?: string;
  customerReference?: string;
}

export type InitiateResult =
  | { kind: 'deeplink'; url: string }
  | { kind: 'qr'; url: string; clientSecret?: string }
  | { kind: 'sync'; result: PaymentResult };

export interface ProviderConfiguration {
  type: PaymentProviderType;
  sumupMerchantCode?: string | null;
  sumupAppId?: string | null;
  vrPayApiKey?: string | null;
  vrPayTerminalId?: string | null;
  sparkasseMerchantId?: string | null;
  stripeSecretKey?: string | null;
  stripePublishableKey?: string | null;
  stripeLocationId?: string | null;
  zvtHost?: string | null;
  zvtPort?: number;
  zvtPassword?: string;
}

export interface PaymentProviderAdapter {
  type: PaymentProviderType;
  platformNote?: string;
  isConfigured(config: ProviderConfiguration): boolean;
  initiatePayment(req: PaymentRequest, config: ProviderConfiguration): Promise<InitiateResult>;
  handleCallback(params: URLSearchParams | Record<string, string>): PaymentResult;
  checkStatus?(sessionId: string, config: ProviderConfiguration): Promise<PaymentStatus>;
}
