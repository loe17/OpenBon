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
  einzelpreisGross: number;
  gesamtGross: number;
  ustSatz: number;
}

export interface DsfinvkBonposPreise {
  bonId: string;
  ustSatz: number;
  netto: number;
  ust: number;
  brutto: number;
}

export interface DsfinvkArchiveResult {
  bonkopfCsv: string;
  bonposCsv: string;
  bonposPreiseCsv: string;
  tseTransaktionenCsv: string;
  checksumSha256: string;
}

export function generateDsfinvkTables(
  bonkoepfe: DsfinvkBonkopf[],
  bonpositionen: DsfinvkBonpos[],
  steuerPreise: DsfinvkBonposPreise[]
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

  // 2. bonpos.csv
  const bonposHeader = 'BON_ID;POS_ZEILE;POS_ARTIKELTEXT;POS_MENGE;POS_EINZELPREIS;POS_BRUTTO;POS_UST_SATZ';
  const bonposRows = bonpositionen.map((p) =>
    [
      p.bonId,
      p.posZeile,
      `"${p.artikeltext.replace(/"/g, '""')}"`,
      p.menge,
      p.einzelpreisGross.toFixed(2).replace('.', ','),
      p.gesamtGross.toFixed(2).replace('.', ','),
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
      sp.netto.toFixed(2).replace('.', ','),
      sp.ust.toFixed(2).replace('.', ','),
      sp.brutto.toFixed(2).replace('.', ','),
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

  // SHA-256 Pruefsumme ueber den gesamten Datenbestand
  const totalPayload = `${bonkopfCsv}\n---\n${bonposCsv}\n---\n${bonposPreiseCsv}\n---\n${tseTransaktionenCsv}`;
  const checksumSha256 = crypto.createHash('sha256').update(totalPayload).digest('hex');

  return {
    bonkopfCsv,
    bonposCsv,
    bonposPreiseCsv,
    tseTransaktionenCsv,
    checksumSha256,
  };
}
