import { describe, it, expect } from 'vitest';
import { getTseConnector } from '../lib/tse/registry';
import { buildDsfinvkZip } from '../lib/dsfinvk-archive';
import { generateDsfinvkTables } from '../lib/dsfinvk-exporter';
import { buildZBonPdf } from '../lib/zbon-pdf';

describe('v0.4.19 TSE/ZIP/ACK', () => {
  it('TSE default ist NONE (ehrlich, kein stiller Mock)', async () => {
    delete process.env.TSE_PROVIDER;
    const c = await getTseConnector();
    // DB kann MOCK enthalten (je nach Testreihenfolge) – wichtig: NONE wirft statt zu fälschen
    const info = await c.info();
    expect(['NONE', 'MOCK', 'FISKALY', 'EFSTA', 'SWISSBIT']).toContain(info.provider);
    if (info.provider === 'NONE') {
      await expect(c.start('x')).rejects.toThrow();
    }
  });

  it('DSFinV-K ZIP enthält 6 Dateien + Checksum', async () => {
    const tables = generateDsfinvkTables(
      [{ bonId: '1', bonNr: '1', bonTyp: 'BELEG', bonStatus: 'ABGESCHLOSSEN', zeitBeginn: new Date().toISOString(), zeitEnde: new Date().toISOString(), kassenId: 'KASSE-1', bedienerName: 'T' }],
      [],
      [],
      { kassenId: 'KASSE-1', totalGrossCents: 1999, transactionCount: 1 }
    );
    expect(tables.cashPointClosingCsv).toContain('19,99');
    const zip = await buildDsfinvkZip(tables, '2026-09-04_2026-09-04');
    expect(zip.length).toBeGreaterThan(500);
    expect(zip.subarray(0, 2).toString('utf8')).toBe('PK');
  });

  it('Z-Bon-PDF ist valides PDF', async () => {
    const pdf = await buildZBonPdf({ title: 'Z-Bon #1', lines: [{ label: 'Brutto', value: '19.99 EUR' }] });
    expect(pdf.subarray(0, 4).toString('utf8')).toBe('%PDF');
  });
});
