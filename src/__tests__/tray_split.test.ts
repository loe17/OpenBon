import { describe, it, expect } from 'vitest';
import { splitItemsIntoChunks, buildTraySummary } from '../lib/printer/tray-split';
import { EscPosBuilder } from '../lib/printer/escpos-builder';
import type { PrintItem } from '../lib/printer/types';

const beer = (qty: number): PrintItem => ({
  name: 'Helles Bier 0,5l',
  alternativeName: 'Helles 0,5',
  quantity: qty,
  unitPrice: 4.5,
});

/** Spec 6.1: Tablett-Limitierung & automatisches Bon-Splitting */
describe('Tray capacity splitting (Spec 6.1)', () => {
  it('should split 14 beers into 3 tickets at a tray limit of 6', () => {
    const chunks = splitItemsIntoChunks([beer(14)], 6);

    expect(chunks).toHaveLength(3);
    expect(chunks[0][0].quantity).toBe(6);
    expect(chunks[1][0].quantity).toBe(6);
    expect(chunks[2][0].quantity).toBe(2);

    const total = chunks.flat().reduce((s, i) => s + i.quantity, 0);
    expect(total).toBe(14);
  });

  it('should keep everything on one ticket when the limit is 0 (unlimited)', () => {
    const chunks = splitItemsIntoChunks([beer(14)], 0);
    expect(chunks).toHaveLength(1);
    expect(chunks[0][0].quantity).toBe(14);
  });

  it('should produce single-unit tickets when the limit is 1', () => {
    const chunks = splitItemsIntoChunks(
      [{ name: 'Schnitzel', quantity: 3, unitPrice: 12.5 }],
      1
    );
    expect(chunks).toHaveLength(3);
    expect(chunks.every((c) => c[0].quantity === 1)).toBe(true);
  });

  it('should pack mixed items up to the limit without losing quantity', () => {
    const chunks = splitItemsIntoChunks(
      [beer(4), { name: 'Radler 0,5l', quantity: 5, unitPrice: 4.2 }],
      6
    );

    const perTicket = chunks.map((c) => c.reduce((s, i) => s + i.quantity, 0));
    expect(perTicket).toEqual([6, 3]);
    expect(perTicket.reduce((a, b) => a + b, 0)).toBe(9);
  });

  it('should return no chunks for an empty item list', () => {
    expect(splitItemsIntoChunks([], 6)).toHaveLength(0);
    expect(splitItemsIntoChunks([], 0)).toHaveLength(0);
  });

  it('should build the tray summary in the specified wording', () => {
    expect(buildTraySummary('Tisch 14', [beer(6)])).toBe('Tisch 14 - 6x Helles 0,5');
    expect(buildTraySummary(null, [beer(2)])).toBe('Theke - 2x Helles 0,5');
    expect(buildTraySummary('Tisch 3', [beer(4), { name: 'Cola', quantity: 2, unitPrice: 3 }])).toBe(
      'Tisch 3 - 6 Pos. / 2 Artikel'
    );
  });

  it('should print the "BON x von y" header on split tickets', () => {
    const { textRepresentation } = EscPosBuilder.buildTicket(
      {
        title: 'AUSSCHANK',
        tableLabel: 'Tisch 14',
        items: [beer(6)],
        traySplit: { index: 2, total: 3, summary: 'Tisch 14 - 6x Bier' },
      },
      80
    );

    expect(textRepresentation).toContain('*** BON 2 von 3 (Tisch 14 - 6x Bier) ***');
  });

  it('should omit the header when no splitting happened', () => {
    const { textRepresentation } = EscPosBuilder.buildTicket(
      { title: 'AUSSCHANK', items: [beer(2)] },
      80
    );
    expect(textRepresentation).not.toContain('BON 1 von');
  });
});

/** Spec 6.2: Alternative Artikelbezeichnung für den Bondrucker */
describe('Alternative ticket name (Spec 6.2)', () => {
  it('should print the compact name instead of the long display name', () => {
    const { textRepresentation } = EscPosBuilder.buildTicket(
      {
        title: 'KUECHE',
        items: [
          {
            name: 'Bratwurstsemmel mit Senf',
            alternativeName: 'Bratw. Senf',
            quantity: 2,
            unitPrice: 4.0,
          },
        ],
      },
      80
    );

    expect(textRepresentation).toContain('Bratw. Senf');
    expect(textRepresentation).not.toContain('Bratwurstsemmel mit Senf');
  });
});

/** Spec 6.5: Gang-Steuerung auf dem Bon */
describe('Course grouping on tickets (Spec 6.5)', () => {
  it('should group printed items by course', () => {
    const { textRepresentation } = EscPosBuilder.buildTicket(
      {
        title: 'KUECHE',
        items: [
          { name: 'Tiramisu', quantity: 1, unitPrice: 4, courseNumber: 3 },
          { name: 'Suppe', quantity: 2, unitPrice: 3.5, courseNumber: 1 },
          { name: 'Schnitzel', quantity: 2, unitPrice: 12.5, courseNumber: 2 },
        ],
      },
      80
    );

    const posSoup = textRepresentation.indexOf('Suppe');
    const posSchnitzel = textRepresentation.indexOf('Schnitzel');
    const posDessert = textRepresentation.indexOf('Tiramisu');

    expect(textRepresentation).toContain('--- GANG 1 ---');
    expect(textRepresentation).toContain('--- GANG 2 ---');
    expect(textRepresentation).toContain('--- GANG 3 ---');
    expect(posSoup).toBeLessThan(posSchnitzel);
    expect(posSchnitzel).toBeLessThan(posDessert);
  });

  it('should not add course headers when everything is course 1', () => {
    const { textRepresentation } = EscPosBuilder.buildTicket(
      { title: 'AUSSCHANK', items: [beer(2)] },
      80
    );
    expect(textRepresentation).not.toContain('GANG');
  });
});

/** Spec 6.4: Storno-Bon */
describe('Void ticket (Spec 6.4)', () => {
  it('should print the mandatory "NICHT ZUBEREITEN" warning and the reason', () => {
    const { rawBuffer, textRepresentation } = EscPosBuilder.buildVoidTicket(
      {
        title: 'KUECHE',
        tableLabel: 'Tisch 7',
        orderNumber: 42,
        waiterName: 'Lisa',
        cancelledBy: 'Leitung',
        reason: 'Bruch/Verschüttet',
        items: [{ name: 'Schnitzel', quantity: 1, unitPrice: 12.5 }],
      },
      80
    );

    expect(rawBuffer).toBeInstanceOf(Buffer);
    expect(textRepresentation).toContain('*** STORNO-BON - NICHT ZUBEREITEN ***');
    expect(textRepresentation).toContain('GRUND: Bruch/Verschüttet');
    expect(textRepresentation).toContain('Tisch 7');
    expect(textRepresentation).toContain('Storniert durch: Leitung');
  });
});

/** Spec 6.11: Übungsmodus */
describe('Training mode imprint (Spec 6.11)', () => {
  it('should print the training banner in the specified wording', () => {
    const { textRepresentation } = EscPosBuilder.buildTicket(
      { title: 'KASSENBELEG', items: [beer(1)], isTraining: true },
      80
    );
    expect(textRepresentation).toContain('*** UEBUNGSBON - KEINE BEZAHLUNG ***');
  });
});

/** Spec 6.10: Zwischenrechnung */
describe('Preliminary bill (Spec 6.10)', () => {
  it('should mark the preliminary bill as no receipt', () => {
    const { textRepresentation } = EscPosBuilder.buildTicket(
      { title: 'ZWISCHENRECHNUNG', items: [beer(3)], isPreliminary: true },
      80
    );
    expect(textRepresentation).toContain('*** ZWISCHENRECHNUNG - KEIN KASSENBELEG ***');
  });
});

/** Spec 6.7 / 6.8: X-Bon und Kassenbuch-Quittung */
describe('X-Bon and cash movement receipts (Spec 6.7 / 6.8)', () => {
  it('should print the X-Bon without closing the register', () => {
    const { textRepresentation } = EscPosBuilder.buildXBonTicket({
      waiterName: 'Lisa',
      periodNumber: 3,
      totalGross: 412.5,
      totalCash: 300,
      totalCard: 112.5,
      cardSumUp: 60,
      cardVrPay: 20,
      cardSparkasse: 12.5,
      cardTerminal: 20,
      totalTips: 14.5,
      cashExpected: 300,
      transactionCount: 37,
    });

    expect(textRepresentation).toContain('X-BON');
    expect(textRepresentation).toContain('*** KASSE BLEIBT GEOEFFNET ***');
    expect(textRepresentation).toContain('SCHICHT-UMSATZ: 412.50 EUR');
    expect(textRepresentation).toContain('TRINKGELD: 14.50 EUR');
  });

  it('should print a signed receipt for cash movements', () => {
    const { textRepresentation } = EscPosBuilder.buildCashMovementTicket({
      type: 'CASH_OUT',
      amount: 250,
      reason: 'Abgabe an Tresor',
      waiterName: 'Max',
    });

    expect(textRepresentation).toContain('ENTNAHME / TRESORABGABE');
    expect(textRepresentation).toContain('Betrag: -250.00 EUR');
    expect(textRepresentation).toContain('Grund: Abgabe an Tresor');
  });
});
