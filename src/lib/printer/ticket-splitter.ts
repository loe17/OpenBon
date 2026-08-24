import prisma from '../db';
import networkSpooler from './network-spooler';
import { PrintItem, TicketData, TraySplitInfo } from './types';
import { splitItemsIntoChunks, buildTraySummary } from './tray-split';

// Re-Export, damit bestehende Importpfade weiterhin funktionieren
export { splitItemsIntoChunks, buildTraySummary };

interface RoutableItem {
  id: string;
  productName: string;
  alternativeName?: string | null;
  quantity: number;
  unitPrice: number;
  deposit?: number;
  variantName?: string | null;
  selectedOptions?: string | null;
  customizationText?: string | null;
  productId: string;
  courseNumber?: number;
  isHold?: boolean;
}

interface OrderToRoute {
  id: string;
  orderNumber: number;
  tableLabel?: string | null;
  waiterName: string;
  tokenNumber?: number | null;
  isTraining: boolean;
  createdAt: Date;
  items: RoutableItem[];
}

interface PrintGroupBucket {
  printGroupId: string;
  printGroupName: string;
  maxItemsPerTicket: number;
  printer: {
    id: string;
    name: string;
    ipAddress: string;
    port: number;
    isVirtual: boolean;
    paperWidth: number;
  };
  items: PrintItem[];
}

export class TicketSplitter {
  /**
   * Routet die Positionen einer Bestellung an die Drucker der jeweiligen
   * Druckgruppen. Zurueckgehaltene Positionen (Spec 6.5, HOLD) werden
   * uebersprungen und erst beim manuellen Postenabruf gedruckt.
   */
  public static async routeAndPrintOrder(
    order: OrderToRoute,
    options: { onlyItemIds?: string[]; includeHold?: boolean } = {}
  ): Promise<{ ticketsGenerated: number; printedItemIds: string[] }> {
    const candidates = order.items.filter((item) => {
      if (options.onlyItemIds && !options.onlyItemIds.includes(item.id)) return false;
      if (item.isHold && !options.includeHold) return false;
      return true;
    });

    if (candidates.length === 0) {
      return { ticketsGenerated: 0, printedItemIds: [] };
    }

    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    const globalTrayLimit = config?.trayMaxItems ?? 0;

    const products = await prisma.product.findMany({
      where: { id: { in: candidates.map((i) => i.productId) } },
      include: { printGroup: { include: { printer: true } } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const buckets = new Map<string, PrintGroupBucket>();
    const printedItemIds: string[] = [];

    for (const item of candidates) {
      const prod = productMap.get(item.productId);
      const printGroup = prod?.printGroup;
      const printer = printGroup?.printer;
      if (!printGroup || !printer || !printer.isActive) continue;

      if (!buckets.has(printGroup.id)) {
        buckets.set(printGroup.id, {
          printGroupId: printGroup.id,
          printGroupName: printGroup.name,
          // Spec 6.1: Gruppenlimit hat Vorrang, sonst globales Tablett-Limit
          maxItemsPerTicket:
            printGroup.maxItemsPerTicket && printGroup.maxItemsPerTicket > 0
              ? printGroup.maxItemsPerTicket
              : globalTrayLimit,
          printer: {
            id: printer.id,
            name: printer.name,
            ipAddress: printer.ipAddress,
            port: printer.port,
            isVirtual: printer.isVirtual,
            paperWidth: printer.paperWidth,
          },
          items: [],
        });
      }

      const options_: string[] = item.selectedOptions
        ? (JSON.parse(item.selectedOptions) as string[])
        : [];

      buckets.get(printGroup.id)!.items.push({
        name: item.productName,
        alternativeName: item.alternativeName || prod?.alternativeTicketName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        deposit: item.deposit,
        variantName: item.variantName,
        selectedOptions: options_,
        customizationText: item.customizationText,
        courseNumber: item.courseNumber ?? 1,
      });
      printedItemIds.push(item.id);
    }

    let ticketsCount = 0;

    for (const bucket of Array.from(buckets.values())) {
      const chunks = splitItemsIntoChunks(bucket.items, bucket.maxItemsPerTicket);

      for (let idx = 0; idx < chunks.length; idx++) {
        const chunk = chunks[idx];
        // Kopfzeile nur, wenn tatsaechlich gesplittet wurde
        const traySplit: TraySplitInfo | undefined =
          chunks.length > 1
            ? {
                index: idx + 1,
                total: chunks.length,
                summary: buildTraySummary(order.tableLabel, chunk),
              }
            : undefined;

        const ticketData: TicketData = {
          title: bucket.printGroupName.toUpperCase(),
          orderNumber: order.orderNumber,
          tokenNumber: order.tokenNumber || undefined,
          tableLabel: order.tableLabel,
          waiterName: order.waiterName,
          createdAt: order.createdAt,
          items: chunk,
          isTraining: order.isTraining,
          traySplit,
        };

        await networkSpooler.printTicket(bucket.printer, ticketData);
        ticketsCount++;
      }
    }

    return { ticketsGenerated: ticketsCount, printedItemIds };
  }

  /**
   * Spec 6.4: Druckt den Storno-Bon auf allen Druckern, die die stornierten
   * Positionen urspruenglich erhalten haben.
   */
  public static async printVoidTickets(params: {
    orderNumber: number;
    tableLabel?: string | null;
    waiterName: string;
    cancelledBy: string;
    reason: string;
    isTraining: boolean;
    items: { productId: string; productName: string; quantity: number; variantName?: string | null }[];
  }): Promise<{ ticketsGenerated: number }> {
    const products = await prisma.product.findMany({
      where: { id: { in: params.items.map((i) => i.productId) } },
      include: { printGroup: { include: { printer: true } } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const buckets = new Map<
      string,
      { groupName: string; printer: NonNullable<(typeof products)[number]['printGroup']>['printer']; items: PrintItem[] }
    >();

    for (const item of params.items) {
      const prod = productMap.get(item.productId);
      const printer = prod?.printGroup?.printer;
      if (!prod?.printGroup || !printer || !printer.isActive) continue;

      if (!buckets.has(prod.printGroup.id)) {
        buckets.set(prod.printGroup.id, {
          groupName: prod.printGroup.name,
          printer,
          items: [],
        });
      }
      buckets.get(prod.printGroup.id)!.items.push({
        name: item.productName,
        alternativeName: prod.alternativeTicketName,
        quantity: item.quantity,
        unitPrice: 0,
        variantName: item.variantName ?? null,
      });
    }

    const { EscPosBuilder } = await import('./escpos-builder');
    let count = 0;

    for (const bucket of Array.from(buckets.values())) {
      if (!bucket.printer) continue;
      const { rawBuffer, textRepresentation } = EscPosBuilder.buildVoidTicket(
        {
          title: bucket.groupName.toUpperCase(),
          tableLabel: params.tableLabel,
          orderNumber: params.orderNumber,
          waiterName: params.waiterName,
          cancelledBy: params.cancelledBy,
          reason: params.reason,
          items: bucket.items,
          isTraining: params.isTraining,
        },
        bucket.printer.paperWidth
      );

      await networkSpooler.sendRawBuffer(bucket.printer, rawBuffer, textRepresentation);
      count++;
    }

    return { ticketsGenerated: count };
  }
}

export default TicketSplitter;
