import { hashPin } from './auth-pin';

/**
 * M5.3 Zentrale Feld-Whitelist und Sanitisierung fuer EventConfig-Eingaben.
 *
 * Bis v0.4.9 liess der Backup-Restore beliebiges JSON direkt in die
 * EventConfig-Konfiguration schreiben (Mass Assignment) - ein manipuliertes
 * "Backup" konnte so sessionSecret, haSyncSecret, haRole & Co. ueberschreiben.
 * Diese Shared-Whitelist wird von /api/config (POST) UND /api/backup
 * (Restore) verwendet.
 */
export const ALLOWED_CONFIG_FIELDS = [
  'name',
  'currency',
  'taxRateNormal',
  'taxRateReduced',
  'trainingMode',
  'trayMaxItems',
  'adminPin',
  'posPin',
  'kitchenPin',
  'waiterPin',
  'enableVirtualPrinters',
  'enableTax',
  'enableCourses',
  'enableDigitalReceipt',
  'enableAgeVerificationAlerts',
  'enableDigitalReceiptQr',
  'enableNfc',
  'enableNfcWaiter',
  'enableNfcPos',
  'enableGuestSelfOrder',
  'enableGuestFacingDisplay',
  'enableKioskMode',
  'lockStartScreen',
  'activeTheme',
  'waiterAutoLockMinutes',
  'activeCardProvider',
  'receiptHeader',
  'receiptSubHeader',
  'receiptFooterText',
  'addressStreet',
  'addressCity',
  'taxNumber',
  'vatId',
  'receiptShowTimestamp',
  'receiptShowWaiter',
  'receiptShowTable',
  'receiptShowTse',
  'receiptTableFontSize',
  'receiptItemFontSize',
  'receiptOptionsFontSize',
  'receiptMetaFontSize',
  'receiptFoodTableFontSize',
  'receiptFoodItemFontSize',
  'receiptFoodOptionsFontSize',
  'receiptDrinkTableFontSize',
  'receiptDrinkItemFontSize',
  'receiptDrinkOptionsFontSize',
  'tableMarkerFontSize',
  'receiptTemplate',
  'receiptFoodTemplate',
  'receiptDrinkTemplate',
  'autoBackupEnabled',
  'autoBackupIntervalMinutes',
  'receiptSingleItemKitchenSlips',
  'receiptSingleItemFoodSlips',
  'receiptSingleItemDrinkSlips',
  'receiptFoodShowHeader',
  'receiptFoodShowTable',
  'receiptFoodShowWaiter',
  'receiptFoodShowTimestamp',
  'receiptFoodShowOptions',
  'receiptDrinkShowHeader',
  'receiptDrinkShowTable',
  'receiptDrinkShowWaiter',
  'receiptDrinkShowTimestamp',
  'receiptDrinkShowOptions',
  'lowStockAlertPrinterId',
  'sumupMerchantCode',
  'sumupAppId',
  'vrPayApiKey',
  'vrPayTerminalId',
  'sparkasseMerchantId',
  'stripeSecretKey',
  'stripePublishableKey',
  'stripeLocationId',
  'zvtHost',
  'zvtPort',
  'zvtPassword',
  'baseUrl',
  'initialPinSet',
  'tseProvider',
  'tseSerialNumber',
  'datevConsultantNumber',
  'datevClientNumber',
  'datevCashAccount',
  'licenseKey',
  'haRole',
  'haPartnerUrl',
  'haAutoFailover',
  'aisles',
  'tokenSequence',
  'invoiceSequence',
  'orderSequence',
] as const;

export const CONFIG_NUMERIC_FIELDS = new Set<string>([
  'taxRateNormal',
  'taxRateReduced',
  'trayMaxItems',
  'receiptTableFontSize',
  'receiptItemFontSize',
  'receiptOptionsFontSize',
  'receiptMetaFontSize',
  'receiptFoodTableFontSize',
  'receiptFoodItemFontSize',
  'receiptFoodOptionsFontSize',
  'receiptDrinkTableFontSize',
  'receiptDrinkItemFontSize',
  'receiptDrinkOptionsFontSize',
  'tableMarkerFontSize',
  'autoBackupIntervalMinutes',
  'waiterAutoLockMinutes',
  'zvtPort',
  'tokenSequence',
  'invoiceSequence',
  'orderSequence',
]);

export const CONFIG_BOOLEAN_FIELDS = new Set<string>([
  'autoBackupEnabled',
  'trainingMode',
  'enableVirtualPrinters',
  'enableTax',
  'enableCourses',
  'enableDigitalReceipt',
  'enableAgeVerificationAlerts',
  'enableDigitalReceiptQr',
  'enableNfc',
  'enableNfcWaiter',
  'enableNfcPos',
  'enableGuestSelfOrder',
  'enableGuestFacingDisplay',
  'enableKioskMode',
  'lockStartScreen',
  'receiptShowTimestamp',
  'receiptShowWaiter',
  'receiptShowTable',
  'receiptShowTse',
  'receiptSingleItemKitchenSlips',
  'receiptSingleItemFoodSlips',
  'receiptSingleItemDrinkSlips',
  'receiptFoodShowHeader',
  'receiptFoodShowTable',
  'receiptFoodShowWaiter',
  'receiptFoodShowTimestamp',
  'receiptFoodShowOptions',
  'receiptDrinkShowHeader',
  'receiptDrinkShowTable',
  'receiptDrinkShowWaiter',
  'receiptDrinkShowTimestamp',
  'receiptDrinkShowOptions',
  'haAutoFailover',
  'initialPinSet',
]);

/** Bewusst NICHT ueberschreibbare System-/Geheimfelder im Restore-Pfad */
export const FORBIDDEN_RESTORE_FIELDS = new Set<string>([
  'sessionSecret',
  'haSyncSecret',
]);

export function sanitizeConfigInput(body: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (!body || typeof body !== 'object') return data;
  for (const field of ALLOWED_CONFIG_FIELDS) {
    if (!(field in body)) continue;
    const value = body[field];
    if (value === undefined) continue;
    // Restore/Update duerfen Geheimnisse der Runtime-Verwaltung niemals setzen.
    if (FORBIDDEN_RESTORE_FIELDS.has(field)) continue;

    if (CONFIG_NUMERIC_FIELDS.has(field)) {
      const num = Number(value);
      if (Number.isFinite(num)) data[field] = num;
      continue;
    }
    if (CONFIG_BOOLEAN_FIELDS.has(field)) {
      data[field] = Boolean(value);
      continue;
    }
    if (value === null) {
      data[field] = null;
      continue;
    }
    data[field] = String(value);
  }
  return data;
}

const PIN_FIELDS = ['adminPin', 'posPin', 'kitchenPin', 'waiterPin'] as const;

/**
 * Wandelt Klartext-PINs aus Eingaben automatisch in PBKDF2-Hashes um -
 * identisches Verhalten wie das bisherige /api/config POST.
 */
export function hashPlaintextConfigPins(
  data: Record<string, unknown>
): Record<string, unknown> {
  for (const field of PIN_FIELDS) {
    const raw = data[field];
    if (typeof raw !== 'string' || !raw.trim()) continue;
    if (!raw.trim().startsWith('$pbkdf2$')) {
      data[field] = hashPin(raw.trim());
    }
  }
  return data;
}
