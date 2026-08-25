import prisma from './db';

const RETENTION = {
  syncJournalDays: 7,
  chatMessageDays: 7,
  actionLogDays: 90,
  diagnosticRunDays: 30,
  idempotencyKeyHours: 24,
} as const;

let timer: NodeJS.Timeout | null = null;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Räumt wachsende Tabellen auf, damit die SQLite-DB über lange Festwochen
 * hinweg performant bleibt: SyncJournal, ChatMessages, ActionLogs,
 * DiagnosticRuns und abgelaufene IdempotencyKeys.
 */
export async function runDataRetentionCleanup(): Promise<Record<string, number>> {
  const deleted: Record<string, number> = {};

  try {
    const sj = await prisma.syncJournal.deleteMany({
      where: { createdAt: { lt: daysAgo(RETENTION.syncJournalDays) } },
    });
    deleted.syncJournal = sj.count;
  } catch (e) {
    console.warn('[CLEANUP] SyncJournal:', e instanceof Error ? e.message : e);
  }

  try {
    const cm = await prisma.chatMessage.deleteMany({
      where: { createdAt: { lt: daysAgo(RETENTION.chatMessageDays) } },
    });
    deleted.chatMessage = cm.count;
  } catch (e) {
    console.warn('[CLEANUP] ChatMessage:', e instanceof Error ? e.message : e);
  }

  try {
    const al = await prisma.actionLog.deleteMany({
      where: { createdAt: { lt: daysAgo(RETENTION.actionLogDays) } },
    });
    deleted.actionLog = al.count;
  } catch (e) {
    console.warn('[CLEANUP] ActionLog:', e instanceof Error ? e.message : e);
  }

  try {
    const dr = await prisma.diagnosticRun.deleteMany({
      where: { createdAt: { lt: daysAgo(RETENTION.diagnosticRunDays) } },
    });
    deleted.diagnosticRun = dr.count;
  } catch (e) {
    console.warn('[CLEANUP] DiagnosticRun:', e instanceof Error ? e.message : e);
  }

  try {
    const ik = await prisma.idempotencyKey.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - RETENTION.idempotencyKeyHours * 60 * 60 * 1000) } },
    });
    deleted.idempotencyKey = ik.count;
  } catch (e) {
    console.warn('[CLEANUP] IdempotencyKey:', e instanceof Error ? e.message : e);
  }

  return deleted;
}

export function startCleanupScheduler(): void {
  if (timer) return;
  console.log('[CLEANUP] Daten-Retention-Scheduler aktiv (täglich, 03:00 Uhr + Startlauf).');

  // Erster Lauf kurz nach dem Start
  setTimeout(() => {
    runDataRetentionCleanup()
      .then((d) => {
        const total = Object.values(d).reduce((s, n) => s + n, 0);
        if (total > 0) console.log(`[CLEANUP] ${total} alte Datensätze entfernt.`);
      })
      .catch(() => {});
  }, 20000);

  // Stündlich prüfen; der eigentliche Lauf erfolgt einmal pro Tag
  let lastRunDay = new Date().getDate();
  timer = setInterval(() => {
    const today = new Date().getDate();
    if (today !== lastRunDay && new Date().getHours() >= 3) {
      lastRunDay = today;
      runDataRetentionCleanup().catch(() => {});
    }
  }, 60 * 60 * 1000);
}
