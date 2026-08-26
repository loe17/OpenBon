import { describe, it, expect } from 'vitest';
import { EscPosBuilder } from '../lib/printer/escpos-builder';

describe('ESC/POS Builder & Encoding', () => {
  it('should initialize and produce raw byte buffers', () => {
    const builder = new EscPosBuilder();
    builder.text('OpenBon Test').lineFeed(2).cut();
    const buffer = builder.build();

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should correctly format German umlauts and Euro symbol', () => {
    const builder = new EscPosBuilder();
    builder.text('Currywurst & Pommes: 8,50 € (äöüÄÖÜß)');
    const buffer = builder.build();

    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should build a complete formatted ticket with text representation', () => {
    const ticketData = {
      title: 'KÜCHE SPEISEN',
      orderNumber: 42,
      tableLabel: 'Tisch 7',
      waiterName: 'Lisa',
      createdAt: new Date(),
      items: [
        {
          name: 'Schnitzel Wiener Art',
          quantity: 2,
          unitPrice: 12.5,
          customizationText: 'ohne Zwiebeln',
        },
        {
          name: 'Portion Pommes',
          quantity: 1,
          unitPrice: 4.0,
        },
      ],
    };

    const { rawBuffer, textRepresentation } = EscPosBuilder.buildTicket(ticketData, 80);

    expect(rawBuffer).toBeInstanceOf(Buffer);
    expect(textRepresentation).toContain('Tisch 7');
    expect(textRepresentation).toContain('Schnitzel Wiener Art');
    expect(textRepresentation).toContain('ohne Zwiebeln');
  });

  it('should generate drawer kickout pulse bytes', () => {
    const builder = new EscPosBuilder();
    builder.openCashDrawer();
    const buf = builder.build();

    // After init (5 bytes: ESC @ ESC t 19), ESC p is at index 5 and 6
    expect(buf[5]).toBe(0x1b);
    expect(buf[6]).toBe(0x70); // 0x70 = 'p'
  });
});
