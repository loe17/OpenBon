/**
 * OpenBon v0.4.17 -> v0.4.23+ Datenrettung: Euro-Float -> Cent-Int.
 *
 * Kopiert alle Geldbetraege (x * 100, kaufmaennisch gerundet) aus den alten
 * Float-Spalten in die neuen *Cents-Spalten. Danach kann `prisma db push`
 * die alten Spalten gefahrlos entfernen (Werte sind bereits gesichert).
 *
 * - Idempotent: laeuft nur ueber Spaltenpaare (alt vorhanden, neu fehlend).
 * - Verifiziert: Summenvergleich alt vs. neu pro Tabelle, Abbruch bei Drift.
 * - Braucht KEIN sqlite3-CLI, nur Node + @prisma/client.
 *
 * Gebrauch auf der Kasse (Backup vorher!):
 *   cp prisma/dev.db /tmp/mig.db
 *   DATABASE_URL="file:/tmp/mig.db" node scripts/migrate-v0417-cent.js
 *   # bei "OK" -> Datei nach prisma/dev.db zurueckkopieren
 */
try {
  require('dotenv').config();
} catch {}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// [Tabelle, AltSpalte, NeuSpalte]
const MONEY_COLUMNS = [
  ['Product', 'price', 'priceCents'],
  ['Product', 'deposit', 'depositCents'],
  ['Product', 'happyHourPrice', 'happyHourPriceCents'],
  ['ProductVariant', 'priceDelta', 'priceDeltaCents'],
  ['ProductVariant', 'deposit', 'depositCents'],
  ['ProductOption', 'priceDelta', 'priceDeltaCents'],
  ['OrderItem', 'unitPrice', 'unitPriceCents'],
  ['OrderItem', 'deposit', 'depositCents'],
  ['Payment', 'totalGross', 'totalGrossCents'],
  ['Payment', 'totalNet', 'totalNetCents'],
  ['Payment', 'totalTax', 'totalTaxCents'],
  ['Payment', 'taxBase19', 'taxBase19Cents'],
  ['Payment', 'taxAmount19', 'taxAmount19Cents'],
  ['Payment', 'taxBase7', 'taxBase7Cents'],
  ['Payment', 'taxAmount7', 'taxAmount7Cents'],
  ['Payment', 'taxBase0', 'taxBase0Cents'],
  ['Payment', 'totalDeposit', 'totalDepositCents'],
  ['Payment', 'returnDeposit', 'returnDepositCents'],
  ['Payment', 'discountAmount', 'discountAmountCents'],
  ['Payment', 'tipAmount', 'tipAmountCents'],
  ['Payment', 'tipWaiterShare', 'tipWaiterShareCents'],
  ['Payment', 'tipPoolShare', 'tipPoolShareCents'],
  ['Payment', 'surchargeAmount', 'surchargeAmountCents'],
  ['Payment', 'givenAmount', 'givenAmountCents'],
  ['Payment', 'changeAmount', 'changeAmountCents'],
  ['PaymentItem', 'unitPrice', 'unitPriceCents'],
  ['PaymentItem', 'deposit', 'depositCents'],
  ['RegisterPeriod', 'totalGross', 'totalGrossCents'],
  ['RegisterPeriod', 'totalNet', 'totalNetCents'],
  ['RegisterPeriod', 'taxAmount19', 'taxAmount19Cents'],
  ['RegisterPeriod', 'taxAmount7', 'taxAmount7Cents'],
  ['RegisterPeriod', 'taxBase0', 'taxBase0Cents'],
  ['RegisterPeriod', 'totalCash', 'totalCashCents'],
  ['RegisterPeriod', 'totalCard', 'totalCardCents'],
  ['RegisterPeriod', 'totalTips', 'totalTipsCents'],
  ['RegisterPeriod', 'totalDepositOut', 'totalDepositOutCents'],
  ['RegisterPeriod', 'cashIn', 'cashInCents'],
  ['RegisterPeriod', 'cashOut', 'cashOutCents'],
  ['RegisterPeriod', 'cashExpected', 'cashExpectedCents'],
  ['RegisterPeriod', 'cashCounted', 'cashCountedCents'],
  ['RegisterPeriod', 'cashDifference', 'cashDifferenceCents'],
  ['CashMovement', 'amount', 'amountCents'],
  ['TokenTransaction', 'unitValue', 'unitValueCents'],
  ['TokenTransaction', 'totalValue', 'totalValueCents'],
];

async function columnsOf(table) {
  const rows = await prisma.$queryRawUnsafe(`PRAGMA table_info("${table}")`);
  return new Map(rows.map((r) => [r.name, r]));
}

async function main() {
  console.log('[MIGRATE] Starte Float->Cent Uebernahme...');
  let migrated = 0;
  let skipped = 0;

  for (const [table, oldCol, newCol] of MONEY_COLUMNS) {
    let cols;
    try {
      cols = await columnsOf(table);
    } catch (e) {
      console.log(`[SKIP] Tabelle ${table} fehlt (${e.message})`);
      continue;
    }
    if (!cols.has(oldCol)) {
      skipped++;
      continue; // nichts zu kopieren (neues Schema oder andere Version)
    }
    if (!cols.has(newCol)) {
      const notNull = cols.get(newCol) === undefined ? '' : '';
      await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${newCol}" INTEGER DEFAULT 0`);
      void notNull;
      console.log(`[ADD] ${table}.${newCol}`);
    }
    const res = await prisma.$executeRawUnsafe(
      `UPDATE "${table}" SET "${newCol}" = CAST(ROUND("${oldCol}" * 100) AS INTEGER) WHERE "${oldCol}" IS NOT NULL`
    );
    console.log(`[COPY] ${table}.${oldCol} -> ${newCol} (${res} Zeilen)`);
    migrated++;

    // Verifikation: Summenvergleich (Toleranz 1 Cent pro Zeile)
    const chk = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) AS n, COALESCE(SUM("${oldCol}"),0) AS sOld, COALESCE(SUM("${newCol}"),0) AS sNew FROM "${table}"`
    );
    const row = chk[0] || { n: 0, sOld: 0, sNew: 0 };
    const drift = Math.abs(Number(row.sOld) * 100 - Number(row.sNew));
    if (drift > Number(row.n)) {
      throw new Error(`[ABBRUCH] Drift in ${table}.${oldCol}: alt=${row.sOld} neu=${row.sNew}`);
    }
  }

  console.log(`[OK] ${migrated} Spalten uebernommen, ${skipped} uebersprungen. Naechste Schritte:`);
  console.log('  1. prisma db push (alte Spalten fallen weg, Werte sind gesichert)');
  console.log('  2. npm run build && Dienst neustarten');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('[FEHLER]', e.message);
  try {
    await prisma.$disconnect();
  } catch {}
  process.exit(1);
});
