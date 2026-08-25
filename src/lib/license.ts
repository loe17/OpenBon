export interface LicenseData {
  licensee: string;
  licenseKey: string;
  type: 'COMMUNITY' | 'STANDARD' | 'PRO_FESTIVAL' | 'UNLIMITED';
  maxDevices: number;
  expiresAt: string | null;
  features: string[];
  issuedAt: string;
  isValid: boolean;
  message?: string;
}

/**
 * OpenBon ist 100% freie Open-Source Software (MIT-Lizenz).
 * Alle Features, Stationen und Geräteanzahlen sind ohne Einschränkungen freigeschaltet.
 */
export function parseAndValidateLicense(keyString?: string): LicenseData {
  return {
    licensee: 'OpenBon Community (Freie Open-Source-Software)',
    licenseKey: 'OPENBON-MIT-FREE',
    type: 'COMMUNITY',
    maxDevices: 9999,
    expiresAt: null,
    features: ['ALL_FEATURES', 'HA_FAILOVER', 'KDS', 'OFFLINE_MODE', 'UNLIMITED_DEVICES'],
    issuedAt: '2026-01-01',
    isValid: true,
    message: 'OpenBon MIT-Lizenz aktiv – Alle Funktionen uneingeschränkt freigeschaltet.',
  };
}

export function generateOfflineSignature(payload: string): string {
  return 'OPENBON-FREE-VALID';
}
