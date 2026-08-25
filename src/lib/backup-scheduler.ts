import fs from 'fs';
import path from 'path';
import prisma from './db';

const BACKUP_DIR = path.join(process.cwd(), 'prisma', 'backups');
const BACKUP_INTERVAL_MS = 5 * 60 * 1000; // 5 Minuten

let timer: NodeJS.Timeout | null = null;

export async function createDatabaseBackup(): Promise<string | null> {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const latestBackupPath = path.join(BACKUP_DIR, 'dev-auto-latest.db');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const timestampBackupPath = path.join(BACKUP_DIR, `dev-backup-${timestamp}.db`);

    // SQLite Online Backup via VACUUM INTO
    try {
      // Prüfen ob Datei existiert und löschen vor VACUUM INTO
      if (fs.existsSync(latestBackupPath)) {
        fs.unlinkSync(latestBackupPath);
      }
      await prisma.$queryRawUnsafe(`VACUUM INTO '${latestBackupPath.replace(/\\/g, '/')}'`);
    } catch {
      // Fallback: Datei-Kopie von dev.db
      const srcDb = path.join(process.cwd(), 'prisma', 'dev.db');
      if (fs.existsSync(srcDb)) {
        fs.copyFileSync(srcDb, latestBackupPath);
      }
    }

    // Alte Backups rotieren (maximal die letzten 10 behalten)
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('dev-backup-') && f.endsWith('.db'))
      .sort();

    if (files.length > 10) {
      const toDelete = files.slice(0, files.length - 10);
      for (const file of toDelete) {
        fs.unlinkSync(path.join(BACKUP_DIR, file));
      }
    }

    return latestBackupPath;
  } catch (err) {
    console.error('[BACKUP] Automatisches Backup fehlgeschlagen:', err);
    return null;
  }
}

export function startAutoBackupScheduler(): void {
  if (timer) return;
  console.log('[BACKUP] Automatischer Backup-Scheduler gestartet (Intervall: 5 Minuten).');
  // Erstes Backup nach 30 Sekunden
  setTimeout(() => {
    createDatabaseBackup();
  }, 30000);

  timer = setInterval(() => {
    createDatabaseBackup();
  }, BACKUP_INTERVAL_MS);
}
