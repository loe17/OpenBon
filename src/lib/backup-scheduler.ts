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

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const timestampBackupPath = path.join(BACKUP_DIR, `dev-backup-${timestamp}.db`);
    const latestBackupPath = path.join(BACKUP_DIR, 'dev-auto-latest.db');

    // SQLite Online Backup via VACUUM INTO direkt in die zeitgestempelte Datei
    try {
      await prisma.$queryRawUnsafe(`VACUUM INTO '${timestampBackupPath.replace(/\\/g, '/')}'`);
    } catch {
      // Fallback: WAL Checkpoint und sichere Dateikopie
      try {
        await prisma.$queryRawUnsafe(`PRAGMA wal_checkpoint(PASSIVE)`);
      } catch {}
      const srcDb = path.join(process.cwd(), 'prisma', 'dev.db');
      if (fs.existsSync(srcDb)) {
        fs.copyFileSync(srcDb, timestampBackupPath);
      }
    }

    // Wenn zeitgestempeltes Backup erfolgreich erstellt wurde -> als neuestes spiegeln
    if (fs.existsSync(timestampBackupPath)) {
      try {
        fs.copyFileSync(timestampBackupPath, latestBackupPath);
      } catch {}
    }

    // Alte Backups rotieren (maximal die letzten 10 behalten)
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('dev-backup-') && f.endsWith('.db'))
      .sort();

    if (files.length > 10) {
      const toDelete = files.slice(0, files.length - 10);
      for (const file of toDelete) {
        try {
          fs.unlinkSync(path.join(BACKUP_DIR, file));
        } catch {}
      }
    }

    return timestampBackupPath;
  } catch (err) {
    console.error('[BACKUP] Automatisches Backup fehlgeschlagen:', err);
    return null;
  }
}

export function startAutoBackupScheduler(): void {
  if (timer) return;
  console.log('[BACKUP] Automatischer SQLite Backup-Scheduler aktiv (Intervall: 5 Minuten).');
  // Erstes Backup nach 10 Sekunden
  setTimeout(() => {
    createDatabaseBackup();
  }, 10000);

  timer = setInterval(() => {
    createDatabaseBackup();
  }, BACKUP_INTERVAL_MS);
}
