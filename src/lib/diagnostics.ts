import net from 'net';
import fs from 'fs';
import prisma from './db';

/**
 * Spec 7.2: Integrierte Self-Healing Selbstdiagnose.
 *
 * Läuft beim Serverstart und danach zyklisch alle 60 Sekunden:
 *  - Datenbank-Integrität: prüft Tabellenstrukturen und behebt verwaiste Bestellzeilen
 *  - Drucker-Socket-Wächter: erkennt hängende Druckaufträge und startet den Spooler neu
 *  - HA-Journal-Konsistenz: bereinigt fehlerhafte Sync-Locks
 *  - N1: HA-Sync-Secret-Zustand (schwach/ok) + Litestream-Replikat-Frische
 */

export type CheckStatus = 'OK' | 'WARNING' | 'ERROR';

export interface DiagnosticCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** Anzahl automatisch behobener Probleme */
  repaired: number;
  durationMs: number;
}

export interface DiagnosticsResult {
  status: CheckStatus;
  checks: DiagnosticCheck[];
  repairsCount: number;
  durationMs: number;
  ranAt: string;
}

const REQUIRED_TABLES = [
  'EventConfig',
  'Product',
  'ProductCategory',
  'DiningTable',
  'Order',
  'OrderItem',
  'Payment',
  'PaymentItem',
  'Printer',
  'PrintGroup',
  'RegisterPeriod',
  'CashMovement',
  'SyncJournal',
  'TapLine',
];

/** Prüfung 1: Datenbank-Integrität inkl. Reparatur verwaister Datensätze */
async function checkDatabase(): Promise<DiagnosticCheck> {
  const started = Date.now();
  let repaired = 0;
  const notes: string[] = [];

  try {
    const rows = await prisma.$queryRawUnsafe<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    const present = new Set(rows.map((r) => r.name));
    const missing = REQUIRED_TABLES.filter((t) => !present.has(t));

    if (missing.length > 0) {
      return {
        id: 'database',
        label: 'Datenbank-Integrität',
        status: 'ERROR',
        detail: `Fehlende Tabellen: ${missing.join(', ')}. Bitte "npm run db:push" ausführen.`,
        repaired: 0,
        durationMs: Date.now() - started,
      };
    }

    // Verwaiste Bestellzeilen ohne gültige Bestellung entfernen
    const orphanItems = await prisma.$executeRawUnsafe(
      'DELETE FROM OrderItem WHERE orderId NOT IN (SELECT id FROM "Order")'
    );
    if (orphanItems > 0) {
      repaired += orphanItems;
      notes.push(`${orphanItems} verwaiste Bestellzeile(n) entfernt`);
    }

    // Verwaiste Belegpositionen entfernen
    const orphanPayItems = await prisma.$executeRawUnsafe(
      'DELETE FROM PaymentItem WHERE paymentId NOT IN (SELECT id FROM Payment)'
    );
    if (orphanPayItems > 0) {
      repaired += orphanPayItems;
      notes.push(`${orphanPayItems} verwaiste Belegposition(en) entfernt`);
    }

    // Bestellungen ohne Positionen aufräumen
    const emptyOrders = await prisma.order.findMany({
      where: { items: { none: {} }, status: { in: ['OPEN', 'IN_PREPARATION'] } },
      select: { id: true },
    });
    if (emptyOrders.length > 0) {
      await prisma.order.updateMany({
        where: { id: { in: emptyOrders.map((o) => o.id) } },
        data: { status: 'CANCELLED' },
      });
      repaired += emptyOrders.length;
      notes.push(`${emptyOrders.length} leere Bestellung(en) geschlossen`);
    }

    // Tische, die als belegt markiert sind, obwohl nichts mehr offen ist
    const occupied = await prisma.diningTable.findMany({
      where: { status: 'OCCUPIED' },
      select: { id: true },
    });
    let freed = 0;
    for (const table of occupied) {
      const open = await prisma.orderItem.count({
        where: {
          isCancelled: false,
          order: { tableId: table.id, status: { in: ['OPEN', 'IN_PREPARATION', 'READY'] } },
        },
      });
      if (open === 0) {
        await prisma.diningTable.update({
          where: { id: table.id },
          data: { status: 'FREE', activeWaiterName: null },
        });
        freed++;
      }
    }
    if (freed > 0) {
      repaired += freed;
      notes.push(`${freed} Tisch(e) automatisch freigegeben`);
    }

    // Sicherstellen, dass immer genau eine Kassenperiode offen ist
    const openPeriods = await prisma.registerPeriod.count({ where: { status: 'OPEN' } });
    if (openPeriods === 0) {
      const last = await prisma.registerPeriod.findFirst({ orderBy: { periodNumber: 'desc' } });
      await prisma.registerPeriod.create({
        data: { periodNumber: (last?.periodNumber ?? 0) + 1 },
      });
      repaired++;
      notes.push('Neue Kassenperiode eröffnet');
    }

    return {
      id: 'database',
      label: 'Datenbank-Integrität',
      status: repaired > 0 ? 'WARNING' : 'OK',
      detail: notes.length > 0 ? notes.join(' · ') : 'Alle Tabellen und Relationen konsistent.',
      repaired,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      id: 'database',
      label: 'Datenbank-Integrität',
      status: 'ERROR',
      detail: error instanceof Error ? error.message : 'Unbekannter Datenbankfehler',
      repaired,
      durationMs: Date.now() - started,
    };
  }
}

function probeSocket(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.connect(port, host, () => done(true));
    socket.on('error', () => done(false));
    socket.on('timeout', () => done(false));
  });
}

/** Prüfung 2: Drucker-Socket-Wächter */
async function checkPrinters(): Promise<DiagnosticCheck> {
  const started = Date.now();
  let repaired = 0;

  try {
    const printers = await prisma.printer.findMany({ where: { isActive: true, isVirtual: false } });

    if (printers.length === 0) {
      return {
        id: 'printers',
        label: 'Drucker-Socket-Wächter',
        status: 'OK',
        detail: 'Keine physischen Drucker konfiguriert (nur virtuelle Ausgabe).',
        repaired: 0,
        durationMs: Date.now() - started,
      };
    }

    const unreachable: string[] = [];
    for (const printer of printers) {
      const ok = await probeSocket(printer.ipAddress, printer.port || 9100);
      if (!ok) unreachable.push(`${printer.name} (${printer.ipAddress}:${printer.port})`);
    }

    // Haengende Bonpositionen erkennen.
    //
    // Bisher wurde hier nur `restartSpooler()` aufgerufen. Da die betroffenen
    // Positionen nie den Status wechselten, fand die naechste Runde exakt
    // dieselben wieder: der leere Spooler wurde im Minutentakt endlos neu
    // gestartet ("[SPOOLER] Neustart - 0 Auftraege") und die Diagnose meldete
    // jedes Mal eine Reparatur, die nichts bewirkt hat.
    //
    // Jetzt wird unterschieden: Gibt es zu einer Position noch einen offenen
    // Druckauftrag, ist der Spooler tatsaechlich zustaendig und wird angestossen.
    // Gibt es keinen, ist der Auftrag unwiederbringlich verloren gegangen (etwa
    // durch einen Absturz vor dem Einreihen) - dann wird die Position als
    // fehlerhaft gekennzeichnet, damit sie sichtbar wird und die Pruefung
    // beim naechsten Lauf zur Ruhe kommt.
    const stuckItems = await prisma.orderItem.findMany({
      where: {
        printStatus: 'PENDING',
        isHold: false,
        order: { createdAt: { lt: new Date(Date.now() - 3 * 60 * 1000) } },
      },
      select: { id: true, orderId: true },
      take: 200,
    });
    const stuck = stuckItems.length;
    let requeued = 0;
    let markedFailed = 0;

    if (stuck > 0) {
      const affectedOrderIds = Array.from(new Set(stuckItems.map((i) => i.orderId)));
      const openJobs = await prisma.printJob.count({
        where: { status: 'PENDING', orderId: { in: affectedOrderIds } },
      });

      if (openJobs > 0) {
        const { networkSpooler } = await import('./printer/network-spooler');
        networkSpooler.restartSpooler();
        requeued = openJobs;
        repaired++;
      } else {
        const updated = await prisma.orderItem.updateMany({
          where: { id: { in: stuckItems.map((i) => i.id) } },
          data: { printStatus: 'ERROR' },
        });
        markedFailed = updated.count;
        if (markedFailed > 0) repaired++;
      }
    }

    const details: string[] = [];
    if (unreachable.length > 0) details.push(`Nicht erreichbar: ${unreachable.join(', ')}`);
    if (requeued > 0) {
      details.push(`${stuck} hängende Position(en), ${requeued} Druckauftrag/-aufträge erneut angestoßen`);
    } else if (markedFailed > 0) {
      details.push(
        `${markedFailed} Position(en) ohne zugehörigen Druckauftrag – als fehlgeschlagen markiert, bitte am Ausgabeplatz prüfen`
      );
    }

    return {
      id: 'printers',
      label: 'Drucker-Socket-Wächter',
      status: unreachable.length > 0 ? 'WARNING' : stuck > 0 ? 'WARNING' : 'OK',
      detail:
        details.length > 0
          ? details.join(' · ')
          : `${printers.length} Drucker erreichbar, keine hängenden Aufträge.`,
      repaired,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      id: 'printers',
      label: 'Drucker-Socket-Wächter',
      status: 'ERROR',
      detail: error instanceof Error ? error.message : 'Unbekannter Druckerfehler',
      repaired,
      durationMs: Date.now() - started,
    };
  }
}

/** Prüfung 3: HA-Journal-Konsistenz */
async function checkSyncJournal(): Promise<DiagnosticCheck> {
  const started = Date.now();
  let repaired = 0;
  const notes: string[] = [];

  try {
    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });

    // Journal beschneiden, damit es auf dem Pi nicht unbegrenzt wächst
    const total = await prisma.syncJournal.count();
    const KEEP = 5000;
    if (total > KEEP) {
      const cutoff = await prisma.syncJournal.findMany({
        orderBy: { id: 'desc' },
        skip: KEEP,
        take: 1,
        select: { id: true },
      });
      if (cutoff.length > 0) {
        const deleted = await prisma.syncJournal.deleteMany({
          where: { id: { lte: cutoff[0].id } },
        });
        repaired += deleted.count;
        notes.push(`${deleted.count} alte Journal-Einträge bereinigt`);
      }
    }

    // Fehlerhafte Einträge ohne verwertbares Payload entfernen (fehlerhafte Sync-Locks)
    const broken = await prisma.syncJournal.findMany({
      where: { OR: [{ payload: '' }, { entityId: '' }] },
      select: { id: true },
    });
    if (broken.length > 0) {
      await prisma.syncJournal.deleteMany({ where: { id: { in: broken.map((b) => b.id) } } });
      repaired += broken.length;
      notes.push(`${broken.length} fehlerhafte Journal-Einträge entfernt`);
    }

    let status: CheckStatus = repaired > 0 ? 'WARNING' : 'OK';
    if (config?.haRole === 'STANDBY' && !config.haPartnerUrl) {
      status = 'WARNING';
      notes.push('STANDBY-Rolle ohne konfigurierte Partner-URL');
    }

    return {
      id: 'ha_journal',
      label: 'HA-Journal Konsistenz',
      status,
      detail:
        notes.length > 0
          ? notes.join(' · ')
          : `Journal konsistent (${total} Einträge, Rolle: ${config?.haRole ?? 'PRIMARY'}).`,
      repaired,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      id: 'ha_journal',
      label: 'HA-Journal Konsistenz',
      status: 'ERROR',
      detail: error instanceof Error ? error.message : 'Unbekannter Journal-Fehler',
      repaired,
      durationMs: Date.now() - started,
    };
  }
}

let isRunning = false;

/**
 * N1 Prüfung 4: Zustand des HA-Sync-Secrets.
 * Automatische Erkennung statt manuellem Pairing-Skript: Ein schwaches Secret
 * bei konfiguriertem Partnerknoten erzeugt eine dauerhafte Meldung mit
 * Fix-Hinweis auf den In-App-Assistenten (Einstellungen > Allgemein).
 */
async function checkHaSecret(): Promise<DiagnosticCheck> {
  const startedAt = Date.now();
  try {
    const { getHaSecretStatus } = await import('./ha/ha-secret');
    const status = await getHaSecretStatus();

    if (!status.partnerConfigured) {
      if (status.isWeak || !status.hasSecret) {
        // Einzelknoten: ensureHaSecretHardened rotiert beim naechsten Start;
        // solange kein Sync-Endpunkt exponiert wird, ist das unkritisch.
        return {
          id: 'ha_secret',
          label: 'HA-Sync-Secret',
          status: 'OK',
          detail:
            'Einzelbetrieb ohne Partner - Sync-Endpunkte bleiben geschlossen.' +
            (status.enforceMode ? ' Enforce-Modus aktiv.' : ''),
          repaired: 0,
          durationMs: Date.now() - startedAt,
        };
      }
      return {
        id: 'ha_secret',
        label: 'HA-Sync-Secret',
        status: 'OK',
        detail: 'Starkes Einzelknoten-Secret aktiv.',
        repaired: 0,
        durationMs: Date.now() - startedAt,
      };
    }

    if (status.isWeak) {
      return {
        id: 'ha_secret',
        label: 'HA-Sync-Secret',
        status: 'WARNING',
        detail:
          'Doppelbetrieb mit oeffentlich bekanntem Standard-Secret. Bitte in den Einstellungen ' +
          '(Allgemein > Hochverfuegbarkeit) den HA-Assistenten oeffnen und die Knoten pairen.',
        repaired: 0,
        durationMs: Date.now() - startedAt,
      };
    }

    return {
      id: 'ha_secret',
      label: 'HA-Sync-Secret',
      status: 'OK',
      detail:
        `Starkes Secret aktiv (${status.source})` +
        (status.enforceMode ? ', Enforce-Modus aktiv' : '') +
        '.',
      repaired: 0,
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      id: 'ha_secret',
      label: 'HA-Sync-Secret',
      status: 'WARNING',
      detail: `Zustand nicht pruefbar: ${err instanceof Error ? err.message : String(err)}`,
      repaired: 0,
      durationMs: Date.now() - startedAt,
    };
  }
}

/**
 * N1 Prüfung 5: Frische des Litestream-Replikats (lokale Backup-Kopie).
 * Dieselben Schwellwerte wie im Preflight (120 s OK, darunter Warnung/Störung),
 * damit die Regelmeldung aus einem einzigen 60-s-Zyklus kommt.
 */
async function checkLitestreamReplicaFreshness(): Promise<DiagnosticCheck> {
  const startedAt = Date.now();
  const replicaDir = './prisma/backups/litestream-replica';
  try {
    if (!fs.existsSync(replicaDir)) {
      return {
        id: 'litestream_age',
        label: 'Litestream-Replikat',
        status: 'OK',
        detail: 'Kein lokales Replikatverzeichnis vorhanden - Litestream offenbar nicht konfiguriert.',
        repaired: 0,
        durationMs: Date.now() - startedAt,
      };
    }

    let newestMtime = 0;
    for (const entry of fs.readdirSync(replicaDir)) {
      if (!entry.endsWith('.db')) continue;
      try {
        const stat = fs.statSync(`${replicaDir}/${entry}`);
        if (stat.mtimeMs > newestMtime) newestMtime = stat.mtimeMs;
      } catch {}
    }

    if (newestMtime === 0) {
      return {
        id: 'litestream_age',
        label: 'Litestream-Replikat',
        status: 'WARNING',
        detail: 'Replikatverzeichnis enthaelt keine .db-Datei - Backup-Frische unklar.',
        repaired: 0,
        durationMs: Date.now() - startedAt,
      };
    }

    const ageSeconds = Math.round((Date.now() - newestMtime) / 1000);
    if (ageSeconds < 120) {
      return {
        id: 'litestream_age',
        label: 'Litestream-Replikat',
        status: 'OK',
        detail: `Letztes Replikat vor ${ageSeconds}s aktualisiert.`,
        repaired: 0,
        durationMs: Date.now() - startedAt,
      };
    }
    if (ageSeconds < 600) {
      return {
        id: 'litestream_age',
        label: 'Litestream-Replikat',
        status: 'WARNING',
        detail: `Replikat ${Math.round(ageSeconds / 60)} Minuten alt - schwaecher als gewoehnlich.`,
        repaired: 0,
        durationMs: Date.now() - startedAt,
      };
    }
    return {
      id: 'litestream_age',
      label: 'Litestream-Replikat',
      status: 'ERROR',
      detail: `Replikat ${Math.round(ageSeconds / 60)} Minuten alt - Litestream laeuft moeglicherweise nicht.`,
      repaired: 0,
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      id: 'litestream_age',
      label: 'Litestream-Replikat',
      status: 'WARNING',
      detail: `Frische nicht pruefbar: ${err instanceof Error ? err.message : String(err)}`,
      repaired: 0,
      durationMs: Date.now() - startedAt,
    };
  }
}

/** Führt alle Prüfungen aus und protokolliert das Ergebnis. */
export async function runDiagnostics(persist = true): Promise<DiagnosticsResult> {
  if (isRunning) {
    return {
      status: 'OK',
      checks: [],
      repairsCount: 0,
      durationMs: 0,
      ranAt: new Date().toISOString(),
    };
  }
  isRunning = true;
  const started = Date.now();

  try {
    const checks = [
      await checkDatabase(),
      await checkPrinters(),
      await checkSyncJournal(),
      await checkHaSecret(), // N1: automatische Pruefung statt manueller Skript-Befehle
      await checkLitestreamReplicaFreshness(), // N1: Backup-Frische im Regelbetrieb sichtbar machen
    ];

    const repairsCount = checks.reduce((s, c) => s + c.repaired, 0);
    const status: CheckStatus = checks.some((c) => c.status === 'ERROR')
      ? 'ERROR'
      : checks.some((c) => c.status === 'WARNING')
        ? 'WARNING'
        : 'OK';

    const durationMs = Date.now() - started;
    const result: DiagnosticsResult = {
      status,
      checks,
      repairsCount,
      durationMs,
      ranAt: new Date().toISOString(),
    };

    if (persist) {
      try {
        await prisma.diagnosticRun.create({
          data: {
            status,
            checksJson: JSON.stringify(checks),
            repairsCount,
            durationMs,
          },
        });
        // Historie begrenzen
        const count = await prisma.diagnosticRun.count();
        if (count > 200) {
          const old = await prisma.diagnosticRun.findMany({
            orderBy: { createdAt: 'desc' },
            skip: 200,
            select: { id: true },
          });
          await prisma.diagnosticRun.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
        }
      } catch {
        /* Protokollierung ist optional */
      }
    }

    if (global.io && (status !== 'OK' || repairsCount > 0)) {
      global.io.emit('system:diagnostics', result);
    }

    return result;
  } finally {
    isRunning = false;
  }
}

let cycleTimer: NodeJS.Timeout | null = null;

/** Startet den zyklischen Selbsttest (Spec 7.2: alle 60 Sekunden) und den Backup-Scheduler. */
export function startDiagnosticsCycle(intervalMs = 60000): void {
  if (cycleTimer) return;

  // Starte automatischen SQLite Backup-Scheduler
  try {
    const { startAutoBackupScheduler } = require('./backup-scheduler');
    startAutoBackupScheduler();
  } catch {}

  void runDiagnostics().catch(() => undefined);
  cycleTimer = setInterval(() => {
    void runDiagnostics().catch(() => undefined);
  }, intervalMs);
  cycleTimer.unref?.();
}

export function stopDiagnosticsCycle(): void {
  if (cycleTimer) {
    clearInterval(cycleTimer);
    cycleTimer = null;
  }
}
