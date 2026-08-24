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
    id: 'CARD_TERMINAL',
    label: 'EC-Terminal (ZVT)',
    color: '#7C3AED',
    icon: CreditCard,
    isCard: true,
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
 * Prüft ob eine Zahlart gemäß hinterlegter Terminal- und Händler-Konfiguration im Adminbereich aktiv ist.
 */
export function isPaymentMethodAvailable(
  methodId: PaymentMethod,
  config?: EventConfigDTO | null
): boolean {
  if (!config) {
    return methodId === 'CASH' || methodId === 'NON_PAID_STAFF' || methodId === 'DISCOUNT';
  }

  if (methodId === 'CARD_SUMUP') {
    return Boolean(
      (config.sumupMerchantCode && config.sumupMerchantCode.trim() !== '') ||
      (config.sumupAppId && config.sumupAppId.trim() !== '')
    );
  }
  if (methodId === 'CARD_VRPAY') {
    return Boolean(config.vrPayTerminalId && config.vrPayTerminalId.trim() !== '');
  }
  if (methodId === 'CARD_SPARKASSE') {
    return Boolean(config.sparkasseMerchantId && config.sparkasseMerchantId.trim() !== '');
  }
  if (methodId === 'CARD_TERMINAL') {
    return Boolean(config.zvtHost && config.zvtHost.trim() !== '');
  }
  return true;
}

/**
 * Prüft ob mindestens eine Kartenzahlungsmethode im Adminbereich konfiguriert ist.
 */
export function hasAnyCardPaymentConfigured(config?: EventConfigDTO | null): boolean {
  if (!config) return false;
  return Boolean(
    (config.sumupMerchantCode && config.sumupMerchantCode.trim() !== '') ||
    (config.sumupAppId && config.sumupAppId.trim() !== '') ||
    (config.vrPayTerminalId && config.vrPayTerminalId.trim() !== '') ||
    (config.sparkasseMerchantId && config.sparkasseMerchantId.trim() !== '') ||
    (config.zvtHost && config.zvtHost.trim() !== '')
  );
}
