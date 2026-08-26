import { NextResponse } from 'next/server';
import { logSystemAction } from '@/lib/action-logger';
import prisma from '@/lib/db';
import haService from '@/lib/ha/ha-service';
import { requireAdmin } from '@/lib/admin-guard';
import { requireApiAuth } from '@/lib/api-guard';

/**
 * Nur ausdrücklich freigegebene Felder werden übernommen – so führt ein
 * versehentlich mitgesendetes Feld (z. B. `updatedAt`) nicht zum Fehler.
 */
const ALLOWED_FIELDS = [
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
  'enableGuestSelfOrder',
  'enableGuestFacingDisplay',
  'enableKioskMode',
  'activeTheme',
  'receiptHeader',
  'receiptSubHeader',
  'receiptFooterText',
  'receiptShowTimestamp',
  'receiptShowWaiter',
  'receiptShowTable',
  'receiptShowTse',
  'receiptTableFontSize',
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
  'vrPayTerminalId',
  'sparkasseMerchantId',
  'zvtHost',
  'zvtPort',
  'zvtPassword',
  'baseUrl',
  'tseProvider',
  'tseSerialNumber',
  'datevConsultantNumber',
  'datevClientNumber',
  'datevCashAccount',
  'licenseKey',
  'haRole',
  'haPartnerUrl',
  'haAutoFailover',
  'tokenSequence',
  'invoiceSequence',
  'orderSequence',
] as const;

const NUMERIC_FIELDS = new Set<string>([
  'taxRateNormal',
  'taxRateReduced',
  'trayMaxItems',
  'receiptTableFontSize',
  'zvtPort',
  'tokenSequence',
  'invoiceSequence',
  'orderSequence',
]);

const BOOLEAN_FIELDS = new Set<string>([
  'trainingMode',
  'enableVirtualPrinters',
  'enableTax',
  'enableCourses',
  'enableDigitalReceipt',
  'enableAgeVerificationAlerts',
  'enableDigitalReceiptQr',
  'enableGuestSelfOrder',
  'enableGuestFacingDisplay',
  'enableKioskMode',
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
]);

function sanitize(body: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (!(field in body)) continue;
    const value = body[field];
    if (value === undefined) continue;

    if (NUMERIC_FIELDS.has(field)) {
      const num = Number(value);
      if (Number.isFinite(num)) data[field] = num;
      continue;
    }
    if (BOOLEAN_FIELDS.has(field)) {
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

export async function GET(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    let config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      config = await prisma.eventConfig.create({
        data: { id: 'default', name: 'Vereinsfest 2026' },
      });
    }
    return NextResponse.json(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const data = sanitize(body);

    const updated = await prisma.eventConfig.upsert({
      where: { id: 'default' },
      update: data,
      create: { id: 'default', ...data },
    });

    if (typeof data.haRole === 'string') {
      const promoted = await haService.setRole(data.haRole as 'PRIMARY' | 'STANDBY');
      if (!promoted) {
        return NextResponse.json(
          {
            error:
              'Rollenwechsel abgelehnt: Eine andere Instanz hält noch eine gültige PRIMARY-Lease (Split-Brain-Schutz).',
          },
          { status: 409 }
        );
      }
    }

    if (global.io) {
      global.io.emit('config:updated', updated);
    }

    await logSystemAction({
      action: 'CONFIG_UPDATED',
      category: 'ADMIN',
      actor: auth.session.waiterName || auth.session.role,
      details: `Konfiguration geändert: ${Object.keys(data).join(', ') || '(keine Felder)'}`,
      metadata: { changedFields: Object.keys(data) },
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
