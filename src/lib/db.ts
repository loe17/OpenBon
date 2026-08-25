import { PrismaClient } from '@prisma/client';

if (typeof process !== 'undefined' && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db';
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

// High-Performance SQLite Pragmas für verzögerungsfreie Schreib- & Lesezugriffe
if (typeof process !== 'undefined') {
  prisma
    .$queryRawUnsafe('PRAGMA journal_mode = WAL;')
    .then(() => prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;'))
    .then(() => prisma.$queryRawUnsafe('PRAGMA synchronous = FULL;'))
    .catch(() => {});
}

export default prisma;
