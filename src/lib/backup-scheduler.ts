import fs from 'fs';
import path from 'path';
import prisma from './db';

const BACKUP_DIR = process.env.BACKUP_DIR
  ? path.resolve(process.env.BACKUP_DIR)
  : path.join(process.cwd(), 'prisma', 'backups');
const BACKUP_INTERVAL_MS = 5 * 60 * 1000; // 5 Minuten
const BACKUP_KEEP = Math.max(3, parseInt(process.env.BACKUP_KEEP || '10', 10) || 10);

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
      // Fallback: WAL Checkpoint und sichere Dateikopie (Pfad aus DATABASE_URL)
      try {
        await prisma.$queryRawUnsafe(`PRAGMA wal_checkpoint(PASSIVE)`);
      } catch {}
      const { resolveDbFile } = await import('./db');
      const srcDb = resolveDbFile();
      if (fs.existsSync(srcDb)) {
        fs.copyFileSync(srcDb, timestampBackupPath);
      } else {
        console.error(`[BACKUP] Fallback fehlgeschlagen: DB-Datei nicht gefunden (${srcDb}).`);
        return null;
      }
    }

    // Wenn zeitgestempeltes Backup erfolgreich erstellt wurde -> als neuestes spiegeln
    if (fs.existsSync(timestampBackupPath)) {
      try {
        fs.copyFileSync(timestampBackupPath, latestBackupPath);
      } catch {}
    } else {
      return null;
    }

    // Alte Backups rotieren (Standard 10, per BACKUP_KEEP konfigurierbar)
    // Hinweis: BACKUP_DIR per ENV auf USB/NAS legen (off-device). Siehe docs/AUSFALLSICHERHEIT_LITESTREAM.md
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('dev-backup-') && f.endsWith('.db'))
      .sort();

    if (files.length > BACKUP_KEEP) {
      const toDelete = files.slice(0, files.length - BACKUP_KEEP);
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
