import { describe, it, expect } from 'vitest';
import { generateDatevCsv, DatevBookingLine } from '../lib/datev-exporter';
import { generateDsfinvkTables, DsfinvkBonkopf, DsfinvkBonpos, DsfinvkBonposPreise } from '../lib/dsfinvk-exporter';

describe('Fiscal Export Engines (DATEV & DSFinV-K - Spec V2 §7.1, §7.2)', () => {
  it('should generate valid DATEV format EXTF 700 CSV header and lines', () => {
    const bookingLines: DatevBookingLine[] = [
      {
        amountGross: 119.0,
        isDebit: true,
        account: '1000',
        contraAccount: '8400',
        bookingDate: new Date('2026-08-24T18:00:00'),
        documentNumber: 'Z-0001',
        text: 'Tagesumsatz 19% Z-Bon #1',
      },
    ];

    const csv = generateDatevCsv(bookingLines, {
      consultantNumber: '10000',
      clientNumber: '10001',
      cashAccount: '1000',
    });

    expect(csv).toContain('"EXTF";700;21;"Buchungsstapel"');
    expect(csv).toContain('"Umsatz (ohne Soll/Haben-Kz)"');
    expect(csv).toContain('119,00;"S";"EUR"');
    expect(csv).toContain('"1000";"8400"');
    expect(csv).toContain('"Z-0001"');
  });

  it('should generate standardized DSFinV-K 2.3+ tables with SHA-256 checksum', () => {
    const bonkoepfe: DsfinvkBonkopf[] = [
      {
        bonId: 'bon-123',
        bonNr: 'BELEG-2026-0001',
        bonTyp: 'BELEG',
        bonStatus: 'ABGESCHLOSSEN',
        zeitBeginn: '2026-08-24T18:00:00Z',
        zeitEnde: '2026-08-24T18:01:00Z',
        kassenId: 'POS-01',
        bedienerName: 'Lukas',
        tseSeriennr: 'TSE-SWISS-001',
        tseSignaturzaehler: 42,
        tseSignatur: 'ABCDEF123456',
      },
    ];

    const bonpos: DsfinvkBonpos[] = [
      {
        bonId: 'bon-123',
        posZeile: 1,
        artikeltext: 'Helles Bier 0,5l',
        menge: 2,
        einzelpreisGross: 4.5,
        gesamtGross: 9.0,
        ustSatz: 19.0,
      },
    ];

    const steuerPreise: DsfinvkBonposPreise[] = [
      {
        bonId: 'bon-123',
        ustSatz: 19.0,
        netto: 7.56,
        ust: 1.44,
        brutto: 9.0,
      },
    ];

    const result = generateDsfinvkTables(bonkoepfe, bonpos, steuerPreise);

    expect(result.bonkopfCsv).toContain('BON_ID;BON_NR;BON_TYP;BON_STATUS');
    expect(result.bonkopfCsv).toContain('bon-123;BELEG-2026-0001;BELEG;ABGESCHLOSSEN');

    expect(result.bonposCsv).toContain('BON_ID;POS_ZEILE;POS_ARTIKELTEXT;POS_MENGE');
    expect(result.bonposCsv).toContain('bon-123;1;"Helles Bier 0,5l";2;4,50;9,00;19,0');

    expect(result.bonposPreiseCsv).toContain('BON_ID;UST_SATZ;NETTO;UST;BRUTTO');
    expect(result.bonposPreiseCsv).toContain('bon-123;19,0;7,56;1,44;9,00');

    expect(result.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
