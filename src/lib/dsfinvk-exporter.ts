import crypto from 'crypto';

/**
 * DSFinV-K 2.3+ & TSE Export Engine (Spec V2 §7.2).
 *
 * Erstellt die standardisierten Datenstrukturen gemaess den Richtlinien
 * der Bundesfinanzverwaltung (KassenSichV / GoBD) fuer Kassennachschauen.
 */

export interface DsfinvkBonkopf {
  bonId: string;
  bonNr: string;
  bonTyp: string; // BELEG, STORNO, TRAINING
  bonStatus: string; // ABGESCHLOSSEN, ABGEBROCHEN
  zeitBeginn: string; // ISO 8601
  zeitEnde: string;   // ISO 8601
  kassenId: string;
  bedienerName: string;
  tseSeriennr?: string | null;
  tseSignaturzaehler?: number | null;
  tseSignatur?: string | null;
}

export interface DsfinvkBonpos {
  bonId: string;
  posZeile: number;
  artikeltext: string;
  menge: number;
  einzelpreisGrossCents: number;
  gesamtGrossCents: number;
  ustSatz: number;
  /** @deprecated Legacy Euro */
  einzelpreisGross?: number;
  /** @deprecated Legacy Euro */
  gesamtGross?: number;
}

export interface DsfinvkBonposPreise {
  bonId: string;
  ustSatz: number;
  nettoCents: number;
  ustCents: number;
  bruttoCents: number;
  /** @deprecated Legacy Euro */
  netto?: number;
  /** @deprecated Legacy Euro */
  ust?: number;
  /** @deprecated Legacy Euro */
  brutto?: number;
}

export interface DsfinvkArchiveResult {
  bonkopfCsv: string;
  bonposCsv: string;
  bonposPreiseCsv: string;
  tseTransaktionenCsv: string;
  cashPointClosingCsv: string;
  indexXml: string;
  checksumSha256: string;
}

export function generateCashPointClosingCsv(args: {
  kassenId: string;
  schliessungNr: number;
  zeitpunkt: string;
  totalGrossCents: number;
  transactionCount: number;
  /** @deprecated Legacy Euro */
  totalGross?: number;
}): string {
  const h = 'KASSEN_ID;SCHLIESSUNG_NR;ZEITPUNKT;GESAMT_BRUTTO;ANZAHL_BONS';
  const cents = typeof args.totalGrossCents === 'number'
    ? Math.round(args.totalGrossCents)
    : Math.round(((args.totalGross ?? 0) + Number.EPSILON) * 100);
  return [h, [args.kassenId, args.schliessungNr, args.zeitpunkt, (cents / 100).toFixed(2).replace('.', ','), args.transactionCount].join(';')].join('\r\n');
}

export function generateDsfinvkIndexXml(files: Array<{ name: string; sha256: string; size: number }>, meta: { erstelltAm: string; kassenId: string }): string {
  const rows = files.map((f) => `    <Datei Name="${f.name}" SHA256="${f.sha256}" Groesse="${f.size}" />`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<DSFinVKExport ErstelltAm="${meta.erstelltAm}" KassenId="${meta.kassenId}">\n${rows}\n    <Hinweis>Ohne zertifizierte TSE unvollständig (NO_TSE) – siehe TSE_HINWEIS.</Hinweis>\n</DSFinVKExport>`;
}

export function generateDsfinvkTables(
  bonkoepfe: DsfinvkBonkopf[],
  bonpositionen: DsfinvkBonpos[],
  steuerPreise: DsfinvkBonposPreise[],
  closing?: { kassenId?: string; totalGrossCents?: number; transactionCount?: number }
): DsfinvkArchiveResult {
  // 1. bonkopf.csv
  const bonkopfHeader = 'BON_ID;BON_NR;BON_TYP;BON_STATUS;BON_ZEIT_BEGINN;BON_ZEIT_BEENDIGUNG;KASSEN_ID;BEDIENER_ID;TSE_SERIENNR;TSE_SIGNATURZAEHLER;TSE_SIGNATUR';
  const bonkopfRows = bonkoepfe.map((b) =>
    [
      b.bonId,
      b.bonNr,
      b.bonTyp,
      b.bonStatus,
      b.zeitBeginn,
      b.zeitEnde,
      b.kassenId,
      b.bedienerName,
      b.tseSeriennr ?? 'NONE',
      b.tseSignaturzaehler ?? 0,
      b.tseSignatur ?? '',
    ].join(';')
  );
  const bonkopfCsv = [bonkopfHeader, ...bonkopfRows].join('\r\n');

  // 2. bonpos.csv (Formatierung erst im CSV: Int-Cent -> Euro-String)
  const bonposHeader = 'BON_ID;POS_ZEILE;POS_ARTIKELTEXT;POS_MENGE;POS_EINZELPREIS;POS_BRUTTO;POS_UST_SATZ';
  const toCentsNum = (c: number | undefined, legacy: number | undefined): number =>
    typeof c === 'number' ? Math.round(c) : Math.round(((legacy ?? 0) + Number.EPSILON) * 100);
  const fmt = (c: number): string => (c / 100).toFixed(2).replace('.', ',');
  const bonposRows = bonpositionen.map((p) =>
    [
      p.bonId,
      p.posZeile,
      `"${p.artikeltext.replace(/"/g, '""')}"`,
      p.menge,
      fmt(toCentsNum(p.einzelpreisGrossCents, p.einzelpreisGross)),
      fmt(toCentsNum(p.gesamtGrossCents, p.gesamtGross)),
      p.ustSatz.toFixed(1).replace('.', ','),
    ].join(';')
  );
  const bonposCsv = [bonposHeader, ...bonposRows].join('\r\n');

  // 3. bonpos_preise.csv
  const preiseHeader = 'BON_ID;UST_SATZ;NETTO;UST;BRUTTO';
  const preiseRows = steuerPreise.map((sp) =>
    [
      sp.bonId,
      sp.ustSatz.toFixed(1).replace('.', ','),
      fmt(toCentsNum(sp.nettoCents, sp.netto)),
      fmt(toCentsNum(sp.ustCents, sp.ust)),
      fmt(toCentsNum(sp.bruttoCents, sp.brutto)),
    ].join(';')
  );
  const bonposPreiseCsv = [preiseHeader, ...preiseRows].join('\r\n');

  // 4. tse_transaktionen.csv
  const tseHeader = 'BON_ID;TSE_STATUS;TSE_SIGNATUR_HEX';
  const tseRows = bonkoepfe.map((b) =>
    [
      b.bonId,
      b.tseSeriennr ? 'VALID' : 'NO_TSE',
      b.tseSignatur ?? '',
    ].join(';')
  );
  const tseTransaktionenCsv = [tseHeader, ...tseRows].join('\r\n');

  // cashPointClosing + index.xml (DSFinV-K verlangt Archiv mit Verzeichnis)
  const kassenId = closing?.kassenId || bonkoepfe[0]?.kassenId || 'KASSE-1';
  const txCount = closing?.transactionCount ?? bonkoepfe.length;
  const grossCents = Math.round(closing?.totalGrossCents ?? 0);
  const cashPointClosingCsv = generateCashPointClosingCsv({
    kassenId,
    schliessungNr: 1,
    zeitpunkt: new Date().toISOString(),
    totalGrossCents: grossCents,
    transactionCount: txCount,
  });
  const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
  const files = [
    { name: 'bonkopf.csv', sha256: sha(bonkopfCsv), size: bonkopfCsv.length },
    { name: 'bonpos.csv', sha256: sha(bonposCsv), size: bonposCsv.length },
    { name: 'bonpos_preise.csv', sha256: sha(bonposPreiseCsv), size: bonposPreiseCsv.length },
    { name: 'tse_transaktionen.csv', sha256: sha(tseTransaktionenCsv), size: tseTransaktionenCsv.length },
    { name: 'cashPointClosing.csv', sha256: sha(cashPointClosingCsv), size: cashPointClosingCsv.length },
  ];
  const indexXml = generateDsfinvkIndexXml(files, { erstelltAm: new Date().toISOString(), kassenId });

  // SHA-256 Pruefsumme ueber den gesamten Datenbestand
  const totalPayload = `${bonkopfCsv}\n---\n${bonposCsv}\n---\n${bonposPreiseCsv}\n---\n${tseTransaktionenCsv}\n---\n${cashPointClosingCsv}\n---\n${indexXml}`;
  const checksumSha256 = crypto.createHash('sha256').update(totalPayload).digest('hex');

  return {
    bonkopfCsv,
    bonposCsv,
    bonposPreiseCsv,
    tseTransaktionenCsv,
    cashPointClosingCsv,
    indexXml,
    checksumSha256,
  };
}
