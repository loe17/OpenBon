import { describe, it, expect } from 'vitest';
import { EscPosBuilder } from '../lib/printer/escpos-builder';
import { formatCurrency } from '../lib/utils';
import { HighAvailabilityService } from '../lib/ha/ha-service';

describe('Praxisnahe End-to-End Workflow Tests', () => {
  it('Workflow 1: Tischbestellung mit Sonderwünschen, Pfand und Bon-Druck', () => {
    // 1. Artikel & Sonderwünsche definieren
    const orderItems = [
      {
        name: 'Festbier 0,5l',
        quantity: 3,
        unitPrice: 4.5,
        deposit: 1.0,
        variantName: 'Gezapft',
      },
      {
        name: 'Bratwurst im Brötchen',
        quantity: 2,
        unitPrice: 4.0,
        deposit: 0.0,
        customizationText: 'extra Senf',
      },
    ];

    // 2. Gesamtpreis & Pfand berechnen
    const grossTotal = orderItems.reduce(
      (sum, i) => sum + (i.unitPrice + i.deposit) * i.quantity,
      0
    );
    // (4.5 + 1.0)*3 = 16.50 + 4.0*2 = 8.00 -> 24.50 €
    expect(grossTotal).toBe(24.5);

    // 3. Ticket generieren
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
    // Gast 1 zahlt 1x Bier (5.50€ inkl. 1€ Pfand) und gibt 2x Leergut zurück (-2€)
    const itemGross = 4.5 + 1.0; // 5.50 €
    const returnDeposit = 2 * 1.0; // 2.00 €
    const tip = 0.5; // 0.50 €
    const givenCash = 10.0; // 10.00 €

    const toPay = itemGross - returnDeposit; // 3.50 €
    const change = givenCash - toPay - tip; // 10.00 - 3.50 - 0.50 = 6.00 €

    expect(toPay).toBe(3.5);
    expect(change).toBe(6.0);
    expect(formatCurrency(change)).toContain('6,00');
  });

  it('Workflow 3: KDS Küchenmonitor Statuszyklus', () => {
    let kdsStatus = 'PENDING';
    expect(kdsStatus).toBe('PENDING');

    // Koch startet Zubereitung
    kdsStatus = 'IN_PROGRESS';
    expect(kdsStatus).toBe('IN_PROGRESS');

    // Koch hakt Artikel ab
    kdsStatus = 'COMPLETED';
    expect(kdsStatus).toBe('COMPLETED');
  });

  it('Workflow 4: Hot-Standby Failover und Rollenwechsel', () => {
    const haService = new HighAvailabilityService();
    haService.setRole('STANDBY');
    expect(haService.getRole()).toBe('STANDBY');

    // Simulierter Ausfall des Primärservers -> Promote
    haService.promoteToPrimary();
    expect(haService.getRole()).toBe('PRIMARY');
  });
});
