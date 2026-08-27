/**
 * M4.1 Entfernt sämtliche geheimen Konfigurationsfelder, bevor eine
 * EventConfig an nicht-administrative Kanäle verbreitet wird (z. B.
 * Socket.IO-Broadcast `config:updated`).
 *
 * Hintergrund: Bis v0.4.9 wurde nach jeder Konfigänderung das KOMPLETTE
 * Config-Objekt an alle verbundenen WebSocket-Clients gebroadcastet -
 * inklusive Stripe-Secret-Key, ZVT-Passwort, Session-Secret, HA-Sync-Secret
 * und der PIN-Einträge. Der einzige bekannte Konsument des Broadcasts liest
 * ausschliesslich `trainingMode`; alle übrigen Felder sind wegwerfbar.
 */
const SENSITIVE_CONFIG_KEYS = new Set([
  'stripeSecretKey',
  'stripePublishableKey',
  'stripeLocationId',
  'vrPayApiKey',
  'vrPayTerminalId',
  'zvtHost',
  'zvtPort',
  'zvtPassword',
  'sessionSecret',
  'haSyncSecret',
  'haPartnerUrl',
  'licenseKey',
  'adminPin',
  'posPin',
  'kitchenPin',
  'waiterPin',
]);

export function sanitizeConfigForBroadcast<T extends Record<string, unknown>>(config: T): Record<string, unknown> {
  if (!config || typeof config !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (SENSITIVE_CONFIG_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}
