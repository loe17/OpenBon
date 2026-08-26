import { BasePaymentAdapter } from './base';
import { runZvtPayment } from '../zvt-client';
import type { PaymentRequest, PaymentResult, ProviderConfiguration, InitiateResult } from '../types';

export class ZvtAdapter extends BasePaymentAdapter {
  type = 'ZVT' as const;
  platformNote = 'Stationäres EC-Terminal über Netzwerk (ZVT 700 / Port 20007)';

  isConfigured(config: ProviderConfiguration): boolean {
    return Boolean(config.zvtHost && config.zvtHost.trim() !== '');
  }

  async initiatePayment(req: PaymentRequest, config: ProviderConfiguration): Promise<InitiateResult> {
    if (!config.zvtHost) {
      return {
        kind: 'sync',
        result: {
          status: 'FAILED',
          errorMessage: 'Kein ZVT-Terminal konfiguriert',
        },
      };
    }

    try {
      const zvtRes = await runZvtPayment(
        {
          host: config.zvtHost,
          port: config.zvtPort || 20007,
          password: config.zvtPassword || '000000',
        },
        req.amountInCents
      );

      if (zvtRes.success) {
        return {
          kind: 'sync',
          result: {
            status: 'SUCCESS',
            authCode: zvtRes.authCode,
            externalTransactionId: zvtRes.authCode,
            customerReference: req.customerReference,
          },
        };
      } else {
        return {
          kind: 'sync',
          result: {
            status: 'FAILED',
            errorMessage: zvtRes.error || 'ZVT Terminal Abbruch',
            customerReference: req.customerReference,
          },
        };
      }
    } catch (err) {
      return {
        kind: 'sync',
        result: {
          status: 'FAILED',
          errorMessage: err instanceof Error ? err.message : String(err),
          customerReference: req.customerReference,
        },
      };
    }
  }

  handleCallback(_raw: URLSearchParams | Record<string, string>): PaymentResult {
    return {
      status: 'FAILED',
      errorMessage: 'ZVT arbeitet synchron, keine Callbacks',
    };
  }
}
