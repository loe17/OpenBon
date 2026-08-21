import prisma from '../db';
import networkSpooler from './network-spooler';
import { PrintItem, TicketData } from './types';

interface OrderToRoute {
  id: string;
  orderNumber: number;
  tableLabel?: string | null;
  waiterName: string;
  tokenNumber?: number | null;
  isTraining: boolean;
  createdAt: Date;
  items: {
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
  }[];
}

export class TicketSplitter {
  public static async routeAndPrintOrder(order: OrderToRoute): Promise<{ ticketsGenerated: number }> {
    // 1. Fetch products with printGroup & printer info
    const productIds = order.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        printGroup: {
          include: {
            printer: true,
          },
        },
      },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    // 2. Group items by PrintGroup (or default printer if none assigned)
    const printGroupBuckets = new Map<
      string,
      {
        printGroup: any;
        printer: any;
        items: PrintItem[];
      }
    >();

    for (const item of order.items) {
      const prod = productMap.get(item.productId);
      const printGroup = prod?.printGroup;
      const printer = printGroup?.printer;

      if (!printer) {
        // No printer configured for this item -> skip physical print
        continue;
      }

      const key = printGroup.id;
      if (!printGroupBuckets.has(key)) {
        printGroupBuckets.set(key, {
          printGroup,
          printer,
          items: [],
        });
      }

      const options = item.selectedOptions ? (JSON.parse(item.selectedOptions) as string[]) : [];

      printGroupBuckets.get(key)!.items.push({
        name: item.productName,
        alternativeName: item.alternativeName || prod?.alternativeTicketName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        deposit: item.deposit,
        variantName: item.variantName,
        selectedOptions: options,
        customizationText: item.customizationText,
      });
    }

    let ticketsCount = 0;

    // 3. For each PrintGroup bucket, split items according to maxItemsPerTicket
    for (const [, bucket] of printGroupBuckets) {
      const maxLimit = bucket.printGroup.maxItemsPerTicket || 0;
      const chunks: PrintItem[][] = [];

      if (maxLimit === 1) {
        // Each single unit gets its own ticket (e.g. 3x Schnitzel -> 3 tickets with 1x Schnitzel each)
        for (const item of bucket.items) {
          for (let q = 0; q < item.quantity; q++) {
            chunks.push([{ ...item, quantity: 1 }]);
          }
        }
      } else if (maxLimit > 1) {
        // Group items up to maxLimit per ticket
        let currentChunk: PrintItem[] = [];
        let currentCount = 0;

        for (const item of bucket.items) {
          let remainingQty = item.quantity;
          while (remainingQty > 0) {
            const fit = Math.min(remainingQty, maxLimit - currentCount);
            if (fit > 0) {
              currentChunk.push({ ...item, quantity: fit });
              currentCount += fit;
              remainingQty -= fit;
            }

            if (currentCount >= maxLimit) {
              chunks.push(currentChunk);
              currentChunk = [];
              currentCount = 0;
            }
          }
        }
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
        }
      } else {
        // No limit: all items of this print group on 1 ticket
        chunks.push(bucket.items);
      }

      // 4. Send each ticket chunk to the network spooler
      for (const chunk of chunks) {
        const ticketData: TicketData = {
          title: bucket.printGroup.name.toUpperCase(),
          orderNumber: order.orderNumber,
          tokenNumber: order.tokenNumber || undefined,
          tableLabel: order.tableLabel,
          waiterName: order.waiterName,
          createdAt: order.createdAt,
          items: chunk,
          isTraining: order.isTraining,
        };

        await networkSpooler.printTicket(bucket.printer, ticketData);
        ticketsCount++;
      }
    }

    return { ticketsGenerated: ticketsCount };
  }
}

export default TicketSplitter;
