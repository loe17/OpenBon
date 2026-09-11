import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { APP_VERSION } from '@/lib/version';
import { hasActiveEventData } from '@/lib/auth-pin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const config = await prisma.eventConfig.findUnique({
      where: { id: 'default' },
    });

    if (!config) {
      return NextResponse.json({
        id: 'default',
        name: 'Vereinsfest 2026',
        currency: 'EUR',
        taxRateNormal: 19.0,
        taxRateReduced: 7.0,
        enableTax: false,
        trainingMode: false,
        trayMaxItems: 6,
        enableVirtualPrinters: false,
        enableCourses: false,
        enableDigitalReceipt: false,
        enableAgeVerificationAlerts: true,
        enableDigitalReceiptQr: false,
        enableNfc: false,
        enableNfcWaiter: true,
        enableNfcPos: true,
        enableWaiterReceiptPrint: false,
        enablePosReceiptPrint: false,
        enableOrderPrintDelay: false,
        orderPrintDelaySeconds: 60,
        enableGuestSelfOrder: false,
        enableKioskMode: false,

        lockStartScreen: true,
        activeTheme: 'dark',
        waiterAutoLockMinutes: 0,
        receiptHeader: 'Vereinsfest 2026',
        receiptSubHeader: 'Freiwillige Feuerwehr e.V.',
        receiptFooterText: 'Vielen Dank für Ihren Besuch!',
        receiptShowTimestamp: true,
        receiptShowWaiter: true,
        receiptShowTable: true,
        receiptShowTse: true,
        receiptTableFontSize: 3,
        receiptSingleItemFoodSlips: true,
        receiptSingleItemDrinkSlips: true,
      });
    }

    // Prüfen, ob bereits aktive Veranstaltungsdaten auf dem System existieren
    const hasActiveData = await hasActiveEventData();

    if (hasActiveData && !config.initialPinSet) {
      await prisma.eventConfig.update({
        where: { id: 'default' },
        data: { initialPinSet: true },
      }).catch(() => {});
    }

    const isEffectivelyConfigured = Boolean(config.initialPinSet || hasActiveData);
    const needsSetup = !isEffectivelyConfigured;

    // Dynamische Pfand-Erkennung aus allen aktiven Artikeln der aktuellen Speisekarte
    const depositProducts = await prisma.product.findMany({
      where: {
        status: { not: 'HIDDEN' },
        depositCents: { gt: 0 },
      },
      select: {
        depositCents: true,
      },
    });

    const distinctDepositCents = Array.from(
      new Set(depositProducts.map((p) => p.depositCents).filter((c): c is number => typeof c === 'number' && c > 0))
    ).sort((a, b) => a - b);

    const hasActiveDeposit = distinctDepositCents.length > 0;
    const depositTiers = distinctDepositCents.map((c) => ({
      unit: c / 100,
      unitCents: c,
      label: `${(c / 100).toFixed(2).replace('.', ',')} € Pfand`,
    }));

    // Sicherer Payload OHNE PINs, ZVT-Passwörter oder Secrets
    const publicConfig = {
      id: config.id,
      name: config.name,
      hasActiveDeposit,
      depositTiers,
      currency: config.currency,
      taxRateNormal: config.taxRateNormal,
      taxRateReduced: config.taxRateReduced,
      enableTax: config.enableTax,
      trainingMode: config.trainingMode,
      trayMaxItems: config.trayMaxItems,
      enableVirtualPrinters: config.enableVirtualPrinters,
      enableCourses: config.enableCourses,
      enableDigitalReceipt: config.enableDigitalReceipt,
      enableAgeVerificationAlerts: config.enableAgeVerificationAlerts,
      enableDigitalReceiptQr: config.enableDigitalReceiptQr,
      enableNfc: config.enableNfc,
      enableNfcWaiter: config.enableNfcWaiter,
      enableNfcPos: config.enableNfcPos,
      enableGuestSelfOrder: config.enableGuestSelfOrder,
      enableKioskMode: config.enableKioskMode,
      lockStartScreen: config.lockStartScreen,
      activeTheme: config.activeTheme,
      waiterAutoLockMinutes: config.waiterAutoLockMinutes ?? 0,
      enableOrderPrintDelay: config.enableOrderPrintDelay ?? false,
      orderPrintDelaySeconds: config.orderPrintDelaySeconds ?? 60,
      receiptHeader: config.receiptHeader,
      receiptSubHeader: config.receiptSubHeader,
      receiptFooterText: config.receiptFooterText,
      receiptShowTimestamp: config.receiptShowTimestamp,
      receiptShowWaiter: config.receiptShowWaiter,
      receiptShowTable: config.receiptShowTable,
      receiptShowTse: config.receiptShowTse,
      receiptTableFontSize: config.receiptTableFontSize,
      receiptSingleItemFoodSlips: config.receiptSingleItemFoodSlips,
      receiptSingleItemDrinkSlips: config.receiptSingleItemDrinkSlips,
      receiptFoodShowHeader: config.receiptFoodShowHeader,
      receiptFoodShowTable: config.receiptFoodShowTable,
      receiptFoodShowWaiter: config.receiptFoodShowWaiter,
      receiptFoodShowTimestamp: config.receiptFoodShowTimestamp,
      receiptFoodShowOptions: config.receiptFoodShowOptions,
      receiptDrinkShowHeader: config.receiptDrinkShowHeader,
      receiptDrinkShowTable: config.receiptDrinkShowTable,
      receiptDrinkShowWaiter: config.receiptDrinkShowWaiter,
      receiptDrinkShowTimestamp: config.receiptDrinkShowTimestamp,
      receiptDrinkShowOptions: config.receiptDrinkShowOptions,
      activeCardProvider: config.activeCardProvider || 'SUMUP',
      cardSumupEnabled: config.cardSumupEnabled ?? false,
      cardVrPayEnabled: config.cardVrPayEnabled ?? false,
      cardSparkasseEnabled: config.cardSparkasseEnabled ?? false,
      cardZvtEnabled: config.cardZvtEnabled ?? false,
      cardStripeEnabled: config.cardStripeEnabled ?? false,
      cardZettleEnabled: config.cardZettleEnabled ?? false,
      sumupMerchantCode: config.sumupMerchantCode,
      sumupAppId: config.sumupAppId,
      vrPayTerminalId: config.vrPayTerminalId,
      sparkasseMerchantId: config.sparkasseMerchantId,
      zvtHost: config.zvtHost,
      hasStripeConfig: Boolean(config.stripeSecretKey || config.stripePublishableKey),
      receiptPrinterId: config.receiptPrinterId,
      enableWaiterReceiptPrint: config.enableWaiterReceiptPrint ?? false,
      enablePosReceiptPrint: config.enablePosReceiptPrint ?? false,
      tseProvider: config.tseProvider,
      initialPinSet: isEffectivelyConfigured,
      needsSetup,
      // N3.3: Versionskennung fuer den "Update verfuegbar"-Hinweis der Clients
      appVersion: APP_VERSION,
    };

    return NextResponse.json(publicConfig, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Konfiguration konnte nicht geladen werden' }, { status: 500 });
  }
}
