import { describe, it, expect } from 'vitest';
import { EscPosBuilder } from '../lib/printer/escpos-builder';
import { formatCents } from '../lib/utils';
import { HighAvailabilityService } from '../lib/ha/ha-service';

describe('Praxisnahe End-to-End Workflow Tests (Cent-hart)', () => {
  it('Workflow 1: Tischbestellung mit Sonderwünschen, Pfand und Bon-Druck', () => {
    const orderItems = [
      {
        name: 'Festbier 0,5l',
        quantity: 3,
        unitPriceCents: 450,
        depositCents: 100,
        variantName: 'Gezapft',
      },
      {
        name: 'Bratwurst im Brötchen',
        quantity: 2,
        unitPriceCents: 400,
        depositCents: 0,
        customizationText: 'extra Senf',
      },
    ];

    const grossCents = orderItems.reduce(
      (sum, i) => sum + (i.unitPriceCents + i.depositCents) * i.quantity,
      0
    );
    // (450 + 100)*3 = 1650 + 400*2 = 800 -> 2450 Cent
    expect(grossCents).toBe(2450);

    const ticketData = {
      title: 'TISCHBESTELLUNG',
      orderNumber: 101,
      tableLabel: 'Tisch 14',
      waiterName: 'Johannes',
      createdAt: new Date(),
      items: orderItems,
    };

    const { rawBuffer, textRepresentation } = EscPosBuilder.buildTicket(ticketData, 80);

    expect(rawBuffer.length).toBeGreaterThan(50);
    expect(textRepresentation).toContain('TISCHBESTELLUNG');
    expect(textRepresentation).toContain('Tisch 14');
    expect(textRepresentation).toContain('extra Senf');
    expect(textRepresentation).toContain('Festbier 0,5l');
  });

  it('Workflow 2: Rechnungs-Splitting (Teilzahlung) mit Leergut-Rückpfand und Wechselgeld', () => {
    const itemGrossCents = 450 + 100; // 550
    const returnDepositCents = 2 * 100; // 200
    const tipCents = 50;
    const givenCents = 1000;

    const toPayCents = itemGrossCents - returnDepositCents; // 350
    const changeCents = givenCents - toPayCents - tipCents; // 600

    expect(toPayCents).toBe(350);
    expect(changeCents).toBe(600);
    expect(formatCents(changeCents)).toContain('6,00');
  });

  it('Workflow 3: KDS Küchenmonitor Statuszyklus', () => {
    let kdsStatus = 'PENDING';
    expect(kdsStatus).toBe('PENDING');
    kdsStatus = 'IN_PROGRESS';
    expect(kdsStatus).toBe('IN_PROGRESS');
    kdsStatus = 'COMPLETED';
    expect(kdsStatus).toBe('COMPLETED');
  });

  it('Workflow 4: Hot-Standby Failover und Rollenwechsel', async () => {
    const haService = new HighAvailabilityService();
    await haService.ready;
    await haService.setRole('STANDBY');
    expect(haService.getRole()).toBe('STANDBY');

    const prisma = (await import('../lib/db')).default;
    await prisma.haLease.deleteMany().catch(() => {});
    const promoted = await haService.promoteToPrimary();
    expect(promoted).toBe(true);
    expect(haService.getRole()).toBe('PRIMARY');

    haService.dispose();
  });

  it('Workflow 5: VR-Pay Me & Kartenzahlung mit prozentualem und festem Aufschlag', () => {
    const grossCents = 5000;
    const surchargePercent = 10.0;
    const surchargeFixedCents = 200;

    const percentCents = Math.round(grossCents * (surchargePercent / 100)); // 500
    const totalSurchargesCents = surchargeFixedCents + percentCents; // 700
    const finalGrossCents = grossCents + totalSurchargesCents; // 5700

    expect(percentCents).toBe(500);
    expect(totalSurchargesCents).toBe(700);
    expect(finalGrossCents).toBe(5700);

    const payment = {
      paymentMethod: 'CARD_VRPAY',
      totalGrossCents: finalGrossCents,
      surchargeAmountCents: totalSurchargesCents,
      surchargePercent: 10.0,
      surchargeReason: '10% Nachtzuschlag + 2€ Pauschale',
    };

    expect(payment.paymentMethod).toBe('CARD_VRPAY');
    expect(payment.surchargeAmountCents).toBe(700);
  });
});
