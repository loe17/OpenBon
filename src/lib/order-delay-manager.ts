import prisma from './db';
import TicketSplitter from './printer/ticket-splitter';

declare global {
  // eslint-disable-next-line no-var
  var __openbonDelayedPrintTimers: Map<string, NodeJS.Timeout> | undefined;
}

const getTimerMap = (): Map<string, NodeJS.Timeout> => {
  if (!global.__openbonDelayedPrintTimers) {
    global.__openbonDelayedPrintTimers = new Map<string, NodeJS.Timeout>();
  }
  return global.__openbonDelayedPrintTimers;
};

/**
 * Plant den verspäteten Bondruck für eine Bestellung nach Ablauf des Storno-Zeitfensters.
 */
export function scheduleDelayedPrint(orderId: string, delaySeconds: number): void {
  const timers = getTimerMap();

  // Vorherigen Timer für diese Bestellung falls vorhanden löschen
  if (timers.has(orderId)) {
    clearTimeout(timers.get(orderId)!);
    timers.delete(orderId);
  }

  const timeoutMs = Math.max(1, delaySeconds) * 1000;

  const timer = setTimeout(async () => {
    timers.delete(orderId);
    try {
      await executeDelayedPrint(orderId);
    } catch (err) {
      console.error(`Fehler beim verspäteten Druck für Bestellung ${orderId}:`, err);
    }
  }, timeoutMs);

  timers.set(orderId, timer);
}

/**
 * Führt den Druck der noch aktiven (nicht stornierten) Positionen einer Bestellung aus.
 */
export async function executeDelayedPrint(orderId: string): Promise<{ printed: boolean; jobIds: string[] }> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        table: true,
        items: {
          where: { isCancelled: false },
          include: {
            product: {
              include: {
                category: true,
                printGroup: {
                  include: { printer: true },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return { printed: false, jobIds: [] };
    }

    // Wenn Bestellung komplett storniert wurde oder keine Positionen übrig sind: nichts drucken!
    if (order.status === 'CANCELLED' || order.items.length === 0) {
      return { printed: false, jobIds: [] };
    }

    const { jobIds } = await TicketSplitter.routeAndPrintOrder({
      id: order.id,
      orderNumber: order.orderNumber,
      tableLabel: order.table?.label || (order.tokenNumber ? `Abholmarke #${order.tokenNumber}` : 'Theke'),
      waiterName: order.waiterName,
      tokenNumber: order.tokenNumber,
      isTraining: order.isTraining,
      createdAt: order.createdAt,
      items: order.items.map((i: any) => ({
        id: i.id,
        productId: i.productId,
        productName: i.productName,
        alternativeName: i.product?.alternativeTicketName,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
        depositCents: i.depositCents ?? 0,
        variantName: i.variantName,
        selectedOptions: i.selectedOptions,
        customizationText: i.customizationText,
        courseNumber: i.courseNumber,
        isHold: i.isHold,
      })),
    });

    if (global.io) {
      if (jobIds.length > 0) {
        global.io.emit('print:queued', { orderId: order.id, jobIds });
      }
      global.io.emit('order:delay_completed', { orderId: order.id });
    }

    return { printed: true, jobIds };
  } catch (error) {
    console.error(`executeDelayedPrint fehlgeschlagen für Order ${orderId}:`, error);
    return { printed: false, jobIds: [] };
  }
}

/**
 * Bricht einen anstehenden verspäteten Bondruck ab (z. B. wenn gesamte Bestellung storniert wurde).
 */
export function cancelDelayedPrint(orderId: string): boolean {
  const timers = getTimerMap();
  const timer = timers.get(orderId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(orderId);
    return true;
  }
  return false;
}

/**
 * Prüft, ob für eine Bestellung aktuell noch ein verspäteter Druck ansteht.
 */
export function isDelayedPrintPending(orderId: string): boolean {
  return getTimerMap().has(orderId);
}

/**
 * Setzt alle laufenden Timer zurück (z. B. für Tests oder Server-Shutdown).
 */
export function clearAllDelayedPrintTimers(): void {
  const timers = getTimerMap();
  for (const timer of timers.values()) {
    clearTimeout(timer);
  }
  timers.clear();
}
