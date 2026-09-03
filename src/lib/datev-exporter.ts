/**
 * DATEV Kassenbuch-Export Engine (Spec V2 §7.1).
 *
 * Erzeugt standardkonforme DATEV-Buchungsstapel im CSV-/ASCII-Format
 * fuer den direkten Import in DATEV Unternehmen Online / Kanzlei-Rechnungswesen.
 */

export interface DatevBookingLine {
  amountCents: number;
  /** @deprecated Legacy Euro, wird via Math.round(x*100) normalisiert */
  amountGross?: number;
  isDebit: boolean; // true = Soll (S), false = Haben (H)
  account: string;      // z. B. "1000" (Kasse)
  contraAccount: string;// z. B. "8400" (Erlöse 19%), "8300" (Erlöse 7%), "1360" (Geldtransit)
  bookingDate: Date;    // Belegdatum
  documentNumber: string; // Belegfeld 1 (z. B. "Z-0004" oder "RE-1002")
  text: string;         // Buchungstext
  taxCode?: string;     // Steuerschlüssel (BU-Schlüssel)
}

export interface DatevExportConfig {
  consultantNumber?: string | null; // Beraternummer (z. B. "10001")
  clientNumber?: string | null;     // Mandantennummer (z. B. "99999")
  cashAccount?: string | null;      // Standard Kassenkonto (Default: "1000")
  revenueAccount19?: string;        // Default: "8400"
  revenueAccount7?: string;         // Default: "8300"
  revenueAccount0?: string;         // Default: "8200"
  transitAccount?: string;          // Default: "1360" (Geldtransit fuer Kartenzahlungen)
}

export const DATEV_DEFAULTS = {
  cashAccount: '1000',
  revenueAccount19: '8400',
  revenueAccount7: '8300',
  revenueAccount0: '8200',
  transitAccount: '1360',
} as const;

export function resolveDatevAccounts(config: DatevExportConfig = {}): Required<Omit<DatevExportConfig, 'consultantNumber' | 'clientNumber'>> {
  return {
    cashAccount: config.cashAccount || process.env.DATEV_CASH_ACCOUNT || DATEV_DEFAULTS.cashAccount,
    revenueAccount19: config.revenueAccount19 || DATEV_DEFAULTS.revenueAccount19,
    revenueAccount7: config.revenueAccount7 || DATEV_DEFAULTS.revenueAccount7,
    revenueAccount0: config.revenueAccount0 || DATEV_DEFAULTS.revenueAccount0,
    transitAccount: config.transitAccount || DATEV_DEFAULTS.transitAccount,
  };
}

export function generateDatevZipManifest(csvName: string, pdfNames: string[]): string {
  return [`DATEV-Export ${new Date().toISOString()}`, `Stapel: ${csvName}`, ...pdfNames.map((p) => `Beleg: ${p}`)].join('\n');
}

export function generateDatevCsv(lines: DatevBookingLine[], config: DatevExportConfig = {}): string {
  const consultant = config.consultantNumber || '10000';
  const client = config.clientNumber || '10001';
  const now = new Date();
  
  const nowFormatted = now.toISOString().replace(/[-:T]/g, '').substring(0, 14);
  const year = now.getFullYear().toString();
  const yearStart = `${year}0101`;

  // DATEV Headerzeile 1 (Formatkennzeichen)
  const header1 = `"EXTF";700;21;"Buchungsstapel";4;${nowFormatted};"";"";"";"";"${consultant}";"${client}";${yearStart};4;${yearStart};${nowFormatted};"OpenBon Kassenbuch";"";1;;;;"EUR";;;;""`;

  // DATEV Headerzeile 2 (Feldbezeichnungen)
  const header2 = `"Umsatz (ohne Soll/Haben-Kz)";"Soll/Haben-Kennzeichen";"WKZ Umsatz";"Kurs";"Basis-Umsatz";"WKZ Basis-Umsatz";"Konto";"Gegenkonto (ohne BU-Schlüssel)";"BU-Schlüssel";"Belegdatum";"Belegfeld 1";"Belegfeld 2";"Skonto";"Buchungstext"`;

  const dataRows = lines.map((line) => {
    // Betrag formatiert mit Komma als Dezimaltrenner gemaess DATEV-Norm.
    // Formatierung erst im CSV: Int-Cent -> Euro-String.
    const cents = typeof line.amountCents === 'number'
      ? Math.round(line.amountCents)
      : Math.round(((line.amountGross ?? 0) + Number.EPSILON) * 100);
    const amountStr = (cents / 100).toFixed(2).replace('.', ',');
    const shKz = line.isDebit ? 'S' : 'H';
    
    const day = line.bookingDate.getDate().toString().padStart(2, '0');
    const month = (line.bookingDate.getMonth() + 1).toString().padStart(2, '0');
    const dateStr = `${day}${month}`; // Format TTMM

    const docNo = line.documentNumber.replace(/"/g, '""').substring(0, 36);
    const text = line.text.replace(/"/g, '""').substring(0, 60);
    const taxCode = line.taxCode ?? '';

    return `${amountStr};"${shKz}";"EUR";"";"";"";"${line.account}";"${line.contraAccount}";"${taxCode}";"${dateStr}";"${docNo}";"";"";"${text}"`;
  });

  return [header1, header2, ...dataRows].join('\r\n');
}
