import prisma from './db';

/**
 * Zieht Schankvolumen von verknüpften Zapfhähnen ab, inklusive Schankverlust.
 */
export async function deductTapVolumeForItems(
  items: { productId?: string | null; quantity: number }[]
) {
  try {
    for (const item of items) {
      if (!item.productId || item.quantity <= 0) continue;

      const taps = await prisma.tapLine.findMany({
        where: {
          productId: item.productId,
          isActive: true,
        },
      });

      for (const tap of taps) {
        // Schankvolumen berechnen: Menge * Portionsgröße * (1 + Schankverlust%)
        const volumePerPortion = tap.portionSizeLiters * (1 + tap.lossPercentage / 100);
        const totalDeductionLiters = item.quantity * volumePerPortion;
        const newVolume = Math.max(0, tap.currentVolumeLiters - totalDeductionLiters);

        await prisma.tapLine.update({
          where: { id: tap.id },
          data: { currentVolumeLiters: Number(newVolume.toFixed(2)) },
        });

        // Socket Event für Live-Monitor
        if (global.io) {
          global.io.emit('tap:volume_updated', {
            tapId: tap.id,
            tapNumber: tap.tapNumber,
            currentVolumeLiters: newVolume,
            kegVolumeLiters: tap.kegVolumeLiters,
            deductedLiters: totalDeductionLiters,
          });
        }
      }
    }
  } catch (error) {
    console.error('Error deducting tap volume:', error);
  }
}
