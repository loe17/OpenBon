import JSZip from 'jszip';
import type { DsfinvkArchiveResult } from './dsfinvk-exporter';

/** Bündelt DSFinV-K-Tabellen als ZIP (6 Dateien + Prüfsumme). */
export async function buildDsfinvkZip(tables: DsfinvkArchiveResult, periodLabel: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('bonkopf.csv', tables.bonkopfCsv);
  zip.file('bonpos.csv', tables.bonposCsv);
  zip.file('bonpos_preise.csv', tables.bonposPreiseCsv);
  zip.file('tse_transaktionen.csv', tables.tseTransaktionenCsv);
  zip.file('cashPointClosing.csv', tables.cashPointClosingCsv);
  zip.file('index.xml', tables.indexXml);
  zip.file('CHECKSUM.sha256', `${tables.checksumSha256}  DSFinVK_${periodLabel}\n`);
  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
}
