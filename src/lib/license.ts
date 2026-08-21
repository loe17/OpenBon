import crypto from 'crypto';

const LICENSE_SALT = 'OPENBON-OFFLINE-LICENSE-SECURITY-SALT-2026';

export interface LicenseData {
  licensee: string; // e.g. "Freiwillige Feuerwehr e.V."
  licenseKey: string;
  type: 'COMMUNITY' | 'STANDARD' | 'PRO_FESTIVAL' | 'UNLIMITED';
  maxDevices: number;
  expiresAt: string | null; // null = unbegrenzt
  features: string[];
  issuedAt: string;
  isValid: boolean;
  message?: string;
}

export function generateOfflineSignature(payload: string): string {
  return crypto.createHmac('sha256', LICENSE_SALT).update(payload).digest('hex').slice(0, 16).toUpperCase();
}

export function parseAndValidateLicense(keyString: string): LicenseData {
  const defaultCommunity: LicenseData = {
    licensee: 'OpenBon Community (Kostenlos)',
    licenseKey: 'OPENBON-COMMUNITY-FREE',
    type: 'COMMUNITY',
    maxDevices: 50,
    expiresAt: null,
    features: ['ALL_STANDARD_FEATURES', 'HA_FAILOVER', 'KDS', 'OFFLINE_MODE'],
    issuedAt: '2026-01-01',
    isValid: true,
    message: 'Kostenlose Community-Lizenz aktiv (Alle Kernfunktionen freigeschaltet)',
  };

  if (!keyString || keyString.trim() === '' || keyString === 'OPENBON-COMMUNITY-FREE') {
    return defaultCommunity;
  }

  try {
    const raw = Buffer.from(keyString.trim(), 'base64').toString('utf-8');
    const json = JSON.parse(raw);

    const payload = `${json.licensee}|${json.type}|${json.maxDevices}|${json.expiresAt || 'NEVER'}`;
    const expectedSig = generateOfflineSignature(payload);

    if (json.signature !== expectedSig) {
      return {
        ...defaultCommunity,
        isValid: false,
        message: 'Ungueltige Lizenzsignatur oder modifizierter Lizenzschluessel!',
      };
    }

    if (json.expiresAt) {
      const expDate = new Date(json.expiresAt);
      if (expDate < new Date()) {
        return {
          ...defaultCommunity,
          isValid: false,
          message: `Lizenz ist am ${expDate.toLocaleDateString('de-DE')} abgelaufen!`,
        };
      }
    }

    return {
      licensee: json.licensee,
      licenseKey: keyString,
      type: json.type || 'PRO_FESTIVAL',
      maxDevices: json.maxDevices || 100,
      expiresAt: json.expiresAt || null,
      features: json.features || ['ALL_FEATURES'],
      issuedAt: json.issuedAt || new Date().toISOString().slice(0, 10),
      isValid: true,
      message: `Gueltige Lizenz fuer "${json.licensee}" aktiviert.`,
    };
  } catch {
    return {
      ...defaultCommunity,
      isValid: false,
      message: 'Format des Lizenzschluessels ist fehlerhaft.',
    };
  }
}
