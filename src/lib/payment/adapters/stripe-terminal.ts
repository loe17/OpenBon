import { BasePaymentAdapter } from './base';
import type { PaymentRequest, PaymentResult, ProviderConfiguration, InitiateResult, PaymentStatus } from '../types';

export class StripeTerminalAdapter extends BasePaymentAdapter {
  type = 'STRIPE' as const;
  platformNote = 'Stripe Terminal BBPOS / WisePOS E oder Hosted QR';

  isConfigured(config: ProviderConfiguration): boolean {
    return Boolean(config.stripeSecretKey && config.stripeSecretKey.trim() !== '');
  }

  async initiatePayment(req: PaymentRequest, config: ProviderConfiguration): Promise<InitiateResult> {
    const ref = req.customerReference || req.orderId || `STR-${Date.now()}`;

    if (config.stripeSecretKey) {
      try {
        const body = new URLSearchParams({
          amount: String(req.amountInCents),
          currency: (req.currency || 'EUR').toLowerCase(),
          'metadata[customerReference]': ref,
          'metadata[orderId]': req.orderId || '',
          'metadata[waiterName]': req.waiterName || '',
          description: req.title || 'OpenBon Zahlung',
        });

        const res = await fetch('https://api.stripe.com/v1/payment_intents', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.stripeSecretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        });

        if (res.ok) {
          const intent = await res.json();
          const clientSecret = intent.client_secret;
          const qrUrl = `https://checkout.stripe.com/pay/${intent.id}`;
          return {
            kind: 'qr',
            url: qrUrl,
            clientSecret,
          };
        }
      } catch (err) {
        console.error('Stripe API Intent creation error:', err);
      }
    }

    // Fallback Mock URL wenn offline / Testmodus
    return {
      kind: 'qr',
      url: `${req.baseUrl}/payment/callback?provider=stripe&status=success&referenceId=${ref}`,
    };
  }

  handleCallback(raw: URLSearchParams | Record<string, string>): PaymentResult {
    const get = (key: string) => (raw instanceof URLSearchParams ? raw.get(key) : raw[key]) || '';

    const status = (get('status') || get('redirect_status') || '').toLowerCase();
    const intentId = get('payment_intent') || get('intentId') || get('id') || '';
    const ref = get('referenceId') || get('customerReference') || '';

    if (status === 'succeeded' || status === 'success' || (!status && intentId)) {
      return {
        status: 'SUCCESS',
        externalTransactionId: intentId,
        authCode: intentId,
        customerReference: ref,
      };
    } else if (status === 'cancelled' || status === 'canceled') {
      return {
        status: 'CANCELLED',
        customerReference: ref,
      };
    } else {
      return {
        status: 'FAILED',
        customerReference: ref,
        errorMessage: get('error') || 'Stripe Zahlung fehlgeschlagen',
      };
    }
  }

  async checkStatus(sessionId: string, config: ProviderConfiguration): Promise<PaymentStatus> {
    if (!config.stripeSecretKey || !sessionId) return 'PENDING';
    try {
      const res = await fetch(`https://api.stripe.com/v1/payment_intents/${sessionId}`, {
        headers: {
          Authorization: `Bearer ${config.stripeSecretKey}`,
        },
      });
      if (res.ok) {
        const intent = await res.json();
        if (intent.status === 'succeeded') return 'SUCCESS';
        if (intent.status === 'canceled') return 'CANCELLED';
        if (intent.status === 'requires_payment_method') return 'PENDING';
      }
    } catch {}
    return 'PENDING';
  }
}
