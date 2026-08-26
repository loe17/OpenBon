import type { PaymentProviderAdapter, PaymentProviderType, ProviderConfiguration } from '../types';
import { SumUpAdapter } from './sumup';
import { VrPayMeAdapter } from './vr-payme';
import { SparkasseSposAdapter } from './sparkasse-spos';
import { ZettleAdapter } from './zettle';
import { StripeTerminalAdapter } from './stripe-terminal';
import { ZvtAdapter } from './zvt';

export class PaymentAdapterRegistry {
  private static adapters = new Map<PaymentProviderType, PaymentProviderAdapter>([
    ['SUMUP', new SumUpAdapter()],
    ['VR_PAYME', new VrPayMeAdapter()],
    ['SPARKASSE_SPOS', new SparkasseSposAdapter()],
    ['ZETTLE', new ZettleAdapter()],
    ['STRIPE', new StripeTerminalAdapter()],
    ['ZVT', new ZvtAdapter()],
  ]);

  public static getAdapter(type: PaymentProviderType | string): PaymentProviderAdapter | undefined {
    const normalized = (type || '').toUpperCase().replace(/^CARD_/, '') as PaymentProviderType;
    if (this.adapters.has(normalized)) {
      return this.adapters.get(normalized);
    }
    // Mapping von Legacy-Identifiern
    if (normalized === 'VRPAY' as any) return this.adapters.get('VR_PAYME');
    if (normalized === 'SPARKASSE' as any || normalized === 'SPOS' as any) return this.adapters.get('SPARKASSE_SPOS');
    if (normalized === 'TERMINAL' as any) return this.adapters.get('ZVT');

    return undefined;
  }

  public static getAllAdapters(): PaymentProviderAdapter[] {
    return Array.from(this.adapters.values());
  }

  public static getAvailableAdapters(config: ProviderConfiguration): PaymentProviderAdapter[] {
    return this.getAllAdapters().filter((a) => a.isConfigured(config));
  }
}

export default PaymentAdapterRegistry;
