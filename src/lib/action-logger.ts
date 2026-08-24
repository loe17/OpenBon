import prisma from './db';

export type LogCategory = 'SALES' | 'ORDERS' | 'AUTH' | 'CASHBOOK' | 'SYSTEM' | 'ADMIN' | 'GENERAL';

export interface LogActionParams {
  action: string;
  category?: LogCategory;
  actor?: string;
  details: string;
  metadata?: Record<string, any> | string | null;
}

export async function logSystemAction({
  action,
  category = 'GENERAL',
  actor = 'System',
  details,
  metadata = null,
}: LogActionParams) {
  try {
    const metaString =
      metadata && typeof metadata === 'object' ? JSON.stringify(metadata) : typeof metadata === 'string' ? metadata : null;

    const logEntry = await prisma.actionLog.create({
      data: {
        action,
        category,
        actor,
        details,
        metadata: metaString,
      },
    });

    if (typeof global !== 'undefined' && (global as any).io) {
      (global as any).io.emit('log:new', logEntry);
    }

    return logEntry;
  } catch (error) {
    console.error('Fehler beim Schreiben des ActionLogs:', error);
    return null;
  }
}
