import prisma from '@/lib/db';
import networkSpooler from '@/lib/printer/network-spooler';
import { EscPosBuilder } from '@/lib/printer/escpos-builder';

export interface StockDeductionItem {
  productId: string;
  quantity: number;
}

export class StockService {
  /**
   * Zieht Bestände atomar ab und schaltet ausverkaufte Artikel automatisch ab.
   */
  public static async deductStock(
    tx: any,
    items: StockDeductionItem[]
  ): Promise<string[]> {
    const soldOutProductIds: string[] = [];

    for (const item of items) {
      if (!item.productId || item.quantity <= 0) continue;

      const product = await tx.product.findUnique({
        where: { id: item.productId },
        include: { stockItem: true },
      });

      if (!product || !product.trackStock) continue;

      const currentQty = product.stockItem?.currentQuantity ?? product.stockQuantity ?? 0;
      const nextQty = Math.max(0, currentQty - item.quantity);

      await tx.stockItem.upsert({
        where: { productId: item.productId },
        create: {
          productId: item.productId,
          currentQuantity: nextQty,
          initialQuantity: currentQty,
          isAutoDeactivate: true,
        },
        update: {
          currentQuantity: nextQty,
        },
      });

      const isSoldOut = nextQty <= 0;
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stockQuantity: nextQty,
          isSoldOut,
        },
      });

      if (isSoldOut) {
        soldOutProductIds.push(item.productId);
      }
    }

    return soldOutProductIds;
  }

  /**
   * Prüft Meldebestände und druckt bei Unterschreitung einen Warnbon.
   */
  public static async checkAndTriggerAlert(productId: string, currentQuantity: number): Promise<void> {
    try {
      const prod = await prisma.product.findUnique({ where: { id: productId } });
      if (!prod || !prod.trackStock) return;

      const threshold = prod.stockAlertThreshold || 10;
      if (currentQuantity <= threshold) {
        const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
        if (config?.lowStockAlertPrinterId) {
          const printer = await prisma.printer.findUnique({
            where: { id: config.lowStockAlertPrinterId, isActive: true },
          });

          if (printer) {
            const { rawBuffer, textRepresentation } = EscPosBuilder.buildTicket(
              {
                title: '⚠️ LAGERBESTAND-WARNUNG',
                tableLabel: 'Lager',
                waiterName: 'System',
                items: [
                  {
                    name: `MELDEBESTAND: ${prod.name}`,
                    quantity: currentQuantity,
                    unitPrice: 0,
                  },
                ],
              },
              printer.paperWidth || 80
            );
            await networkSpooler.sendRawBuffer(printer, rawBuffer, textRepresentation);
          }
        }
      }
    } catch {}
  }
}

export default StockService;
