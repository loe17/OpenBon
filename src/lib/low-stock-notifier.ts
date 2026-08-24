import { prisma } from './db';
import { EscPosBuilder } from './printer/escpos-builder';
import networkSpooler from './printer/network-spooler';

/**
 * Meldebestand-Wächter & Druckauslöser (Spec V2 §6.3).
 *
 * Prüft bei Lagerveränderungen, ob der Meldebestand unterschritten wurde,
 * und steuert optional den im Adminbereich konfigurierten Drucker an.
 */

export interface LowStockCheckResult {
  productId: string;
  productName: string;
  currentQuantity: number;
  minStockAlert: number;
  alertTriggered: boolean;
  printDispatched: boolean;
}

export async function checkAndTriggerLowStockAlert(
  productId: string,
  newQuantity: number
): Promise<LowStockCheckResult | null> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || product.minStockAlert === null || product.minStockAlert === undefined) {
      return null;
    }

    const minAlert = product.minStockAlert;
    if (newQuantity > minAlert) {
      // Wenn der Bestand wieder aufgestockt wurde, Flag zuruecksetzen
      if (product.minStockAlertPrinted) {
        await prisma.product.update({
          where: { id: productId },
          data: { minStockAlertPrinted: false },
        });
      }
      return {
        productId,
        productName: product.name,
        currentQuantity: newQuantity,
        minStockAlert: minAlert,
        alertTriggered: false,
        printDispatched: false,
      };
    }

    // Meldebestand unterschritten
    let printDispatched = false;

    if (!product.minStockAlertPrinted) {
      const config = await prisma.eventConfig.findUnique({
        where: { id: 'default' },
      });

      if (config?.lowStockAlertPrinterId) {
        const printer = await prisma.printer.findUnique({
          where: { id: config.lowStockAlertPrinterId },
        });

        if (printer && printer.isActive) {
          const now = new Date();
          const timeStr = `${now.toLocaleDateString('de-DE')} ${now.toLocaleTimeString('de-DE')}`;
          
          const escpos = new EscPosBuilder(printer.paperWidth || 80, 'CP858')
            .init()
            .align('center')
            .bold(true)
            .textLine('========================================')
            .textLine('*** WARNUNG: MINDESTMENGE ***')
            .textLine('========================================')
            .bold(false)
            .align('left')
            .textLine(`Artikel:      ${product.name}`)
            .textLine(`Restbestand:  ${newQuantity} Stk`)
            .textLine(`Meldebestand: ${minAlert} Stk`)
            .textLine(`Zeitpunkt:    ${timeStr}`)
            .textLine('----------------------------------------')
            .align('center')
            .textLine('Bitte Lager pruefen & nachfuellen!')
            .cut()
            .build();

          await networkSpooler.spoolRaw(
            printer.ipAddress,
            printer.port || 9100,
            escpos,
            `low-stock-alert-${productId}`
          );

          printDispatched = true;
        }
      }

      await prisma.product.update({
        where: { id: productId },
        data: { minStockAlertPrinted: true },
      });
    }

    return {
      productId,
      productName: product.name,
      currentQuantity: newQuantity,
      minStockAlert: minAlert,
      alertTriggered: true,
      printDispatched,
    };
  } catch (error) {
    console.error('Fehler bei Meldebestand-Prüfung:', error);
    return null;
  }
}
