import { PrismaClient } from '@prisma/client';
import path from 'path';

if (typeof process !== 'undefined' && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./prisma/dev.db';
}

/**
 * Einheitlicher Datenbank-Dateipfad für alle Komponenten (Backup, Litestream,
 * Doku): aus DATABASE_URL abgeleitet, Default prisma/dev.db.
 */
export function resolveDbFile(): string {
  const raw = process.env.DATABASE_URL || 'file:./prisma/dev.db';
  const m = raw.match(/^file:(.+?)(\?.*)?$/);
  const rel = (m?.[1] || './prisma/dev.db').replace(/^\.\//, '');
  return path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// High-Performance SQLite Pragmas – sequentiell mit await, Fehler werden geloggt
if (typeof process !== 'undefined') {
  (async () => {
    try {
      await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
      await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 8000;');
      await prisma.$queryRawUnsafe('PRAGMA synchronous = FULL;');
      await prisma.$queryRawUnsafe('PRAGMA foreign_keys = ON;');
    } catch (err) {
      console.error('[DB] SQLite-Pragmas konnten nicht gesetzt werden:', err instanceof Error ? err.message : err);
    }
  })();
}

export default prisma;
