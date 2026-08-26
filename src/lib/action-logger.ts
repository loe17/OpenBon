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

/**
 * Sichere Variante von {@link logSystemAction}.
 *
 * WICHTIG: Ein Protokolleintrag darf einen Kassiervorgang niemals scheitern
 * lassen. `logSystemAction` faengt zwar eigene Datenbankfehler ab - der
 * Aufrufer baut seine Parameter aber VOR dem Aufruf zusammen. Ein Tippfehler
 * in einem Feldnamen (z. B. `payment.amount` statt `payment.totalGross`)
 * warf dort eine Ausnahme, die die bereits gebuchte Zahlung mit HTTP 500
 * quittierte: das Geld war in der Kasse, die Bedienung sah einen Fehler.
 *
 * Deshalb wird hier eine FUNKTION uebergeben. Damit liegt auch das
 * Zusammenbauen der Parameter innerhalb des try-Blocks.
 */
export async function logSystemActionSafe(build: () => LogActionParams): Promise<void> {
  try {
    await logSystemAction(build());
  } catch (error) {
    console.warn(
      '[LOG] Protokolleintrag konnte nicht erstellt werden (Vorgang selbst ist davon unberuehrt):',
      error instanceof Error ? error.message : error
    );
  }
}
