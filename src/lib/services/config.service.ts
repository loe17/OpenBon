import prisma from '@/lib/db';

export interface SafeEventConfig {
  id: string;
  name: string;
  currency: string;
  taxRateNormal: number;
  taxRateReduced: number;
  enableTax: boolean;
  trainingMode: boolean;
  enableVirtualPrinters: boolean;
  enableCourses: boolean;
  enableDigitalReceipt: boolean;
  enableGuestSelfOrder: boolean;
  enableKioskMode: boolean;
  activeTheme: string;
  receiptHeader: string | null;
  receiptSubHeader: string | null;
  receiptFooterText: string | null;
}

export class ConfigService {
  /**
   * Lädt die EventConfig garantiert und liefert sichere Default-Werte, falls keine Zeile existiert.
   */
  public static async getEventConfig(): Promise<SafeEventConfig> {
    try {
      const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
      if (config) return config as SafeEventConfig;
    } catch {}

    // Fallback Defaults
    return {
      id: 'default',
      name: 'OpenBon Kassenbetrieb',
      currency: 'EUR',
      taxRateNormal: 19,
      taxRateReduced: 7,
      enableTax: false,
      trainingMode: false,
      enableVirtualPrinters: false,
      enableCourses: false,
      enableDigitalReceipt: false,
      enableGuestSelfOrder: false,
      enableKioskMode: false,
      activeTheme: 'dark',
      receiptHeader: 'OpenBon Kasse',
      receiptSubHeader: 'Vereinsfest',
      receiptFooterText: 'Vielen Dank für Ihren Besuch!',
    };
  }

  /**
   * Prüft, ob das System im Trainingsmodus läuft.
   */
  public static async isTrainingMode(): Promise<boolean> {
    const config = await this.getEventConfig();
    return Boolean(config.trainingMode);
  }
}

export default ConfigService;
