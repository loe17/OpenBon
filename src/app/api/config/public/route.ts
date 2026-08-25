import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

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
        enableGuestSelfOrder: false,
        enableGuestFacingDisplay: false,
        enableKioskMode: false,
        activeTheme: 'dark',
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

    // Sicherer Payload OHNE PINs, ZVT-Passwörter oder Secrets
    const publicConfig = {
      id: config.id,
      name: config.name,
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
      enableGuestSelfOrder: config.enableGuestSelfOrder,
      enableGuestFacingDisplay: config.enableGuestFacingDisplay,
      enableKioskMode: config.enableKioskMode,
      activeTheme: config.activeTheme,
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
      sumupAppId: config.sumupAppId,
      sumupMerchantCode: config.sumupMerchantCode,
      vrPayTerminalId: config.vrPayTerminalId,
      sparkasseMerchantId: config.sparkasseMerchantId,
      baseUrl: config.baseUrl,
      tseProvider: config.tseProvider,
    };

    return NextResponse.json(publicConfig);
  } catch (error) {
    return NextResponse.json({ error: 'Konfiguration konnte nicht geladen werden' }, { status: 500 });
  }
}
