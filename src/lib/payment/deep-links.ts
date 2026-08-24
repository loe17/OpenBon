/**
 * Spec 4.1 / 4.2 / 4.3: App-to-App Deep Linking fuer SumUp, VR-Pay Me und Sparkasse S-POS.
 *
 * Alle Builder sind reine Funktionen ohne Seiteneffekte, damit sie in der
 * Test-Suite ohne Geraet geprueft werden koennen.
 */

export interface DeepLinkContext {
  /** Zahlbetrag in Euro, z. B. 12.5 */
  amount: number;
  /** Beschreibung, z. B. "OrderBon Tisch 14" */
  title: string;
  /** Interne Zahlungs-/Bestell-Referenz fuer den Callback */
  referenceId: string;
  /** Basis-URL des Servers, z. B. http://openbon.local */
  baseUrl: string;
  currency?: string;
}

export interface SumUpConfig {
  affiliateKey: string | null;
  merchantCode?: string | null;
}

export interface VrPayConfig {
  terminalId: string | null;
}

export interface SparkasseConfig {
  merchantId: string | null;
}

/** Betrag im von den Apps erwarteten Format: Punkt als Dezimaltrenner, 2 Nachkommastellen */
export function formatDeepLinkAmount(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2);
}

/**
 * Serialisiert Query-Parameter nach RFC 3986.
 *
 * `URLSearchParams` kodiert Leerzeichen als "+" (application/x-www-form-urlencoded).
 * Die Custom-URI-Schemes der Zahl-Apps interpretieren "+" jedoch nicht zuverlässig
 * als Leerzeichen – ein Titel wie "OrderBon Tisch 14" käme dort als
 * "OrderBon+Tisch+14" an. Deshalb wird durchgängig %20 verwendet.
 */
export function encodeQuery(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

export function buildCallbackUrl(
  baseUrl: string,
  referenceId: string,
  provider: string,
  status: 'success' | 'failed' = 'success'
): string {
  const normalized = baseUrl.replace(/\/+$/, '');
  const params = encodeQuery({
    orderId: referenceId,
    provider,
    status,
  });
  return `${normalized}/waiter/payment/callback?${params}`;
}

/** Spec 4.1: sumupaffiliate://pay/v0.1 */
export function buildSumUpDeepLink(ctx: DeepLinkContext, config: SumUpConfig): string {
  const params = encodeQuery({
    'affiliate-key': config.affiliateKey ?? '',
    'app-id': config.affiliateKey ?? '',
    total: formatDeepLinkAmount(ctx.amount),
    amount: formatDeepLinkAmount(ctx.amount),
    currency: ctx.currency ?? 'EUR',
    title: ctx.title,
    'foreign-tx-id': ctx.referenceId,
    callback: buildCallbackUrl(ctx.baseUrl, ctx.referenceId, 'sumup'),
  });
  return `sumupaffiliate://pay/v0.1?${params}`;
}

/** Spec 4.2: vrpayme://pay */
export function buildVrPayDeepLink(ctx: DeepLinkContext, config: VrPayConfig): string {
  const params = encodeQuery({
    amount: formatDeepLinkAmount(ctx.amount),
    currency: ctx.currency ?? 'EUR',
    terminalId: config.terminalId ?? '',
    reference: ctx.referenceId,
    purpose: ctx.title,
    callback: buildCallbackUrl(ctx.baseUrl, ctx.referenceId, 'vrpay'),
  });
  return `vrpayme://pay?${params}`;
}

/** Spec 4.3.1: Sparkasse S-POS (SoftPOS auf dem Smartphone) */
export function buildSparkasseDeepLink(ctx: DeepLinkContext, config: SparkasseConfig): string {
  const params = encodeQuery({
    amount: formatDeepLinkAmount(ctx.amount),
    currency: ctx.currency ?? 'EUR',
    merchantId: config.merchantId ?? '',
    receiptId: ctx.referenceId,
    description: ctx.title,
    callback: buildCallbackUrl(ctx.baseUrl, ctx.referenceId, 'sparkasse'),
  });
  return `spos://payment?${params}`;
}

export type CardProvider = 'sumup' | 'vrpay' | 'sparkasse';

export interface TerminalConfigBundle {
  sumupAppId: string | null;
  sumupMerchantCode: string | null;
  vrPayTerminalId: string | null;
  sparkasseMerchantId: string | null;
}

export function buildDeepLinkFor(
  provider: CardProvider,
  ctx: DeepLinkContext,
  config: TerminalConfigBundle
): string {
  switch (provider) {
    case 'sumup':
      return buildSumUpDeepLink(ctx, {
        affiliateKey: config.sumupAppId,
        merchantCode: config.sumupMerchantCode,
      });
    case 'vrpay':
      return buildVrPayDeepLink(ctx, { terminalId: config.vrPayTerminalId });
    case 'sparkasse':
      return buildSparkasseDeepLink(ctx, { merchantId: config.sparkasseMerchantId });
  }
}

export const PAYMENT_METHOD_TO_PROVIDER: Record<string, CardProvider | 'zvt' | undefined> = {
  CARD_SUMUP: 'sumup',
  CARD_VRPAY: 'vrpay',
  CARD_SPARKASSE: 'sparkasse',
  CARD_TERMINAL: 'zvt',
};
