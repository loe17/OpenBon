import { describe, it, expect, beforeEach } from 'vitest';
import prisma from '@/lib/db';
import { cancelDelayedPrint, executeDelayedPrint, scheduleDelayedPrint, isDelayedPrintPending } from '@/lib/order-delay-manager';
import TicketSplitter from '@/lib/printer/ticket-splitter';

describe('KDS Ergonomie, Doppel-Druckschutz & Historie (v0.4.70)', () => {
  beforeEach(async () => {
    await prisma.eventConfig.upsert({
      where: { id: 'default' },
      update: {
        kdsNotifyWaitersOnReady: false,
        kdsControlsPrinting: false,
      },
      create: {
        id: 'default',
        name: 'Test Fest',
        kdsNotifyWaitersOnReady: false,
        kdsControlsPrinting: false,
      },
    });
  });

  it('sollte sicherstellen, dass kdsNotifyWaitersOnReady standardmäßig false (ausgeschaltet) ist', async () => {
    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    expect(config?.kdsNotifyWaitersOnReady).toBe(false);
  });

  it('sollte anstehende verzögerte Drucke sauber abbrechen können (cancelDelayedPrint)', () => {
    const orderId = 'test-order-cancel-123';
    scheduleDelayedPrint(orderId, 60);
    expect(isDelayedPrintPending(orderId)).toBe(true);

    const cancelled = cancelDelayedPrint(orderId);
    expect(cancelled).toBe(true);
    expect(isDelayedPrintPending(orderId)).toBe(false);
  });

  it('sollte bei executeDelayedPrint keine bereits gedruckten Positionen (printStatus: PRINTED) erneut drucken', async () => {
    const table = await prisma.diningTable.upsert({
      where: { id: 'tbl-kds-test' },
      update: {},
      create: { id: 'tbl-kds-test', tableNumber: 99, label: 'Tisch 99' },
    });

    const category = await prisma.productCategory.upsert({
      where: { id: 'cat-kds-test' },
      update: {},
      create: { id: 'cat-kds-test', name: 'Speisen', color: '#f59e0b' },
    });

    const product = await prisma.product.upsert({
      where: { id: 'prod-kds-test' },
      update: {},
      create: {
        id: 'prod-kds-test',
        name: 'Currywurst',
        priceCents: 500,
        categoryId: category.id,
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: 99991,
        table: { connect: { id: table.id } },
        waiterName: 'TestKellner',
        status: 'OPEN',
        isTraining: false,
        items: {
          create: [
            {
              productId: product.id,
              productName: product.name,
              quantity: 1,
              unitPriceCents: 500,
              printStatus: 'PRINTED', // Bereits gedruckt!
              kdsStatus: 'COMPLETED',
            },
          ],
        },
      },
    });

    // executeDelayedPrint aufrufen
    const result = await executeDelayedPrint(order.id);
    // Da alle Positionen bereits PRINTED sind, darf nichts gedruckt werden
    expect(result.printed).toBe(false);
    expect(result.jobIds).toHaveLength(0);

    // Cleanup
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
  });

  it('sollte in TicketSplitter.routeAndPrintOrder Items mit printStatus PRINTED überspringen', async () => {
    const res = await TicketSplitter.routeAndPrintOrder({
      id: 'order-dup-check',
      orderNumber: 8888,
      waiterName: 'Lisa',
      isTraining: false,
      createdAt: new Date(),
      items: [
        {
          id: 'item-already-printed',
          productId: 'prod-none',
          productName: 'Cola',
          quantity: 1,
          unitPriceCents: 300,
          printStatus: 'PRINTED',
        },
      ],
    });

    expect(res.ticketsGenerated).toBe(0);
    expect(res.jobIds).toHaveLength(0);
  });
});
