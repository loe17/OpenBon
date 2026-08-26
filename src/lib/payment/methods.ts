import { CreditCard, Banknote, Smartphone, HeartHandshake, Percent, type LucideIcon } from 'lucide-react';
import type { PaymentMethod, EventConfigDTO } from '@/types/domain';

/**
 * Spec 3.1 / 5.2: Signal-Farbleitsystem der Zahlarten.
 * Farben sind bewusst als Hex hinterlegt, damit sie sowohl im UI (inline style)
 * als auch in Reports und Exporten identisch verwendet werden koennen.
 */
export interface PaymentMethodDef {
  id: PaymentMethod;
  label: string;
  color: string;
  icon: LucideIcon;
  /** Karten-Zahlart mit externem Terminal / App-to-App */
  isCard: boolean;
  /** Zahlart erzeugt keinen Geldfluss (Freiverzehr, Rabatt) */
  isNonPaid: boolean;
}

export const PAYMENT_METHODS: PaymentMethodDef[] = [
  {
    id: 'CASH',
    label: 'Bargeld',
    color: '#10B981',
    icon: Banknote,
    isCard: false,
    isNonPaid: false,
  },
  {
    id: 'CARD' as any,
    label: 'Kartenzahlung',
    color: '#3B82F6',
    icon: CreditCard,
    isCard: true,
    isNonPaid: false,
  },
  {
    id: 'CARD_SUMUP',
    label: 'SumUp',
    color: '#3B82F6',
    icon: CreditCard,
    isCard: true,
    isNonPaid: false,
  },
  {
    id: 'CARD_VRPAY',
    label: 'VR-Pay Me',
    color: '#1E40AF',
    icon: CreditCard,
    isCard: true,
    isNonPaid: false,
  },
  {
    id: 'CARD_SPARKASSE',
    label: 'Sparkasse / S-POS',
    color: '#DC2626',
    icon: Smartphone,
    isCard: true,
    isNonPaid: false,
  },
  {
    id: 'CARD_ZETTLE',
    label: 'Zettle by PayPal',
    color: '#0284C7',
    icon: CreditCard,
    isCard: true,
    isNonPaid: false,
  },
  {
    id: 'CARD_STRIPE',
    label: 'Stripe Terminal / QR',
    color: '#6366F1',
    icon: CreditCard,
    isCard: true,
    isNonPaid: false,
  },
  {
    id: 'CARD_TERMINAL',
    label: 'EC-Terminal (ZVT)',
    color: '#7C3AED',
    icon: CreditCard,
    isCard: true,
    isNonPaid: false,
  },
  {
    id: 'TOKEN',
    label: 'Wertmarke / Token',
    color: '#D97706',
    icon: Banknote,
    isCard: false,
    isNonPaid: false,
  },
  {
    id: 'NON_PAID_STAFF',
    label: 'Personal / Bewirtung',
    color: '#F59E0B',
    icon: HeartHandshake,
    isCard: false,
    isNonPaid: true,
  },
  {
    id: 'DISCOUNT',
    label: 'Rabatt / Freiverzehr',
    color: '#8B5CF6',
    icon: Percent,
    isCard: false,
    isNonPaid: true,
  },
];

export function getPaymentMethod(id: string): PaymentMethodDef | undefined {
  return PAYMENT_METHODS.find((m) => m.id === id);
}

export function getPaymentLabel(id: string): string {
  return getPaymentMethod(id)?.label ?? id;
}

export function getPaymentColor(id: string): string {
  return getPaymentMethod(id)?.color ?? '#64748B';
}

/**
 * Ermittelt die exakte konkrete Kartenmethode basierend auf dem in den Einstellungen
 * gewählten einzigen aktiven Anbieter.
 */
export function getActiveCardPaymentMethod(config?: EventConfigDTO | null): PaymentMethod | null {
  if (!config) return null;
  const provider = config.activeCardProvider?.toUpperCase();

  if (provider === 'SUMUP') {
    if ((config.sumupMerchantCode && config.sumupMerchantCode.trim() !== '') || (config.sumupAppId && config.sumupAppId.trim() !== '')) {
      return 'CARD_SUMUP';
    }
  } else if (provider === 'VR_PAYME' || provider === 'VRPAY') {
    if (config.vrPayTerminalId && config.vrPayTerminalId.trim() !== '') {
      return 'CARD_VRPAY';
    }
  } else if (provider === 'SPARKASSE_SPOS' || provider === 'SPOS' || provider === 'SPARKASSE') {
    if (config.sparkasseMerchantId && config.sparkasseMerchantId.trim() !== '') {
      return 'CARD_SPARKASSE';
    }
  } else if (provider === 'ZETTLE') {
    return 'CARD_ZETTLE';
  } else if (provider === 'STRIPE') {
    if (config.stripeSecretKey || config.stripePublishableKey) {
      return 'CARD_STRIPE';
    }
  } else if (provider === 'ZVT' || provider === 'TERMINAL') {
    if (config.zvtHost && config.zvtHost.trim() !== '') {
      return 'CARD_TERMINAL';
    }
  }

  // Automatischer Fallback, falls kein expliziter Provider-Name gewählt wurde
  if ((config.sumupMerchantCode && config.sumupMerchantCode.trim() !== '') || (config.sumupAppId && config.sumupAppId.trim() !== '')) {
    return 'CARD_SUMUP';
  }
  if (config.vrPayTerminalId && config.vrPayTerminalId.trim() !== '') return 'CARD_VRPAY';
  if (config.sparkasseMerchantId && config.sparkasseMerchantId.trim() !== '') return 'CARD_SPARKASSE';
  if (config.zvtHost && config.zvtHost.trim() !== '') return 'CARD_TERMINAL';

  return null;
}

/**
 * Prüft ob mindestens eine Kartenzahlungsmethode im Adminbereich konfiguriert ist.
 */
export function hasAnyCardPaymentConfigured(config?: EventConfigDTO | null): boolean {
  return getActiveCardPaymentMethod(config) !== null;
}

/**
 * Prüft ob eine Zahlart gemäß hinterlegter Terminal- und Händler-Konfiguration im Adminbereich aktiv ist.
 */
export function isPaymentMethodAvailable(
  methodId: PaymentMethod | 'CARD',
  config?: EventConfigDTO | null
): boolean {
  if (methodId === 'CARD') {
    return hasAnyCardPaymentConfigured(config);
  }
  if (!config) {
    return methodId === 'CASH' || methodId === 'NON_PAID_STAFF' || methodId === 'DISCOUNT';
  }

  const activeCardMethod = getActiveCardPaymentMethod(config);
  if (methodId === activeCardMethod) return true;
  if (methodId.startsWith('CARD_')) return false;

  return true;
}
