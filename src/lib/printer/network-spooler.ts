import net from 'net';
import fs from 'fs';
import { EscPosBuilder } from './escpos-builder';
import { TicketData, VirtualTicketRecord } from './types';
import prisma from '../db';

interface SpoolJob {
  id: string;
  dbJobId?: string;
  printerId: string;
  printerName: string;
  printerIp: string;
  printerPort: number;
  isVirtual: boolean;
  paperWidth: number;
  ticketData: TicketData;
  retries: number;
  createdAt: Date;
}

class NetworkSpooler {
  private queue: SpoolJob[] = [];
  private isProcessing = false;
  /** Verhindert, dass ein zweiter Aufruf dieselben Jobs erneut einreiht (Doppeldruck). */
  private recoveryRunning = false;

  constructor() {
    // Beim Initialisieren nicht abgeschlossene Jobs aus der DB nachladen.
    // Zusaetzlich ruft `src/instrumentation.ts` die Wiederaufnahme beim
    // Serverstart auf, falls dieses Modul erst spaeter geladen wird.
    void this.recoverPendingJobs();
  }

  public async printTicket(
    printer: { id: string; name: string; ipAddress: string; port: number; isVirtual: boolean; paperWidth: number },
    ticketData: TicketData,
    options?: { orderId?: string; printGroupId?: string; itemIds?: string[] }
  ): Promise<{ success: boolean; isVirtual: boolean; jobId?: string; error?: string }> {
    // 1. In Datenbank persistieren (Resilienz gegen Abstürze)
    // rawPayload enthält zusätzlich itemIds für pro-Item-ACK (nur dieses Ticket, nicht ganze Order)
    const payloadWithIds = { ...ticketData, __itemIds: options?.itemIds || [] };
    let dbJob = null;
    try {
      dbJob = await prisma.printJob.create({
        data: {
          printerId: printer.id,
          printGroupId: options?.printGroupId || null,
          orderId: options?.orderId || null,
          title: ticketData.title || 'Bon',
          rawPayload: JSON.stringify(payloadWithIds),
          status: printer.isVirtual ? 'PRINTED' : 'PENDING',
          attempts: 0,
          printedAt: printer.isVirtual ? new Date() : null,
        },
      });
    } catch (err) {
      console.error('[SPOOLER] PrintJob-DB-Write fehlgeschlagen, Memory-Fallback (geht bei Crash verloren):', err instanceof Error ? err.message : err);
    }

    const job: SpoolJob = {
      id: dbJob?.id || Math.random().toString(36).substring(2, 9),
      dbJobId: dbJob?.id,
      printerId: printer.id,
      printerName: printer.name,
      printerIp: printer.ipAddress,
      printerPort: printer.port || 9100,
      isVirtual: printer.isVirtual,
      paperWidth: printer.paperWidth || 80,
      ticketData,
      retries: 0,
      createdAt: new Date(),
    };

    if (printer.isVirtual) {
      const res = await this.processVirtualPrint(job);
      return { success: res.success, isVirtual: true, jobId: job.id };
    } else {
      // Ehrlich: PENDING einreihen, erst nach Socket-ACK als PRINTED melden.
      // Aufrufer dürfen printStatus erst nach Erfolg auf PRINTED setzen.
      this.queue.push(job);
      this.processQueue();
      return { success: false, isVirtual: false, jobId: job.id, error: 'PENDING' };
    }
  }

  public async sendRawBuffer(
    printer: { id?: string; name: string; ipAddress: string; port: number; isVirtual: boolean; paperWidth?: number },
    rawBuffer: Buffer,
    textRepresentation?: string
  ): Promise<{ success: boolean; isVirtual: boolean; error?: string }> {
    // Spiegelung für den Virtuellen Monitor bereithalten
    const record: VirtualTicketRecord = {
      id: Math.random().toString(36).substring(2, 11),
      printerName: printer.name,
      printerIp: printer.ipAddress,
      ticketData: { title: 'Druckauftrag', items: [] },
      rawText: textRepresentation || '[ESC/POS Binärdaten]',
      printedAt: new Date().toISOString(),
    };

    if (!global.virtualPrinterHistory) global.virtualPrinterHistory = [];
    if (!global.virtualPrinterHistory.some((r) => r.id === record.id)) {
      global.virtualPrinterHistory.unshift(record);
      if (global.virtualPrinterHistory.length > 100) global.virtualPrinterHistory.pop();

      if (global.io) {
        global.io.emit('virtual_printer:new_ticket', record);
      }
    }

    if (printer.isVirtual) {
      return { success: true, isVirtual: true };
    }

    if (printer.ipAddress.startsWith('/dev/')) {
      return new Promise((resolve) => {
        try {
          fs.writeFile(printer.ipAddress, rawBuffer, (err) => {
            if (err) {
              resolve({ success: false, isVirtual: false, error: `USB-Fehler: ${err.message}` });
            } else {
              resolve({ success: true, isVirtual: false });
            }
          });
        } catch (err: any) {
          resolve({ success: false, isVirtual: false, error: err?.message || 'USB-Gerätefehler' });
        }
      });
    }

    return new Promise((resolve) => {
      const client = new net.Socket();
      client.setNoDelay(true);
      client.setTimeout(2500);

      let isDone = false;
      const cleanup = (res: { success: boolean; isVirtual: boolean; error?: string }) => {
        if (!isDone) {
          isDone = true;
          try {
            client.destroy();
          } catch {}
          resolve(res);
        }
      };

      client.connect(printer.port || 9100, printer.ipAddress, () => {
        client.write(rawBuffer, (err) => {
          if (err) {
            cleanup({ success: false, isVirtual: false, error: err.message });
          } else {
            cleanup({ success: true, isVirtual: false });
          }
        });
      });

      client.on('error', (err) => {
        cleanup({ success: false, isVirtual: false, error: err.message });
      });

      client.on('timeout', () => {
        cleanup({ success: false, isVirtual: false, error: 'Drucker-Timeout nach 2.5s' });
      });
    });
  }

  private async processVirtualPrint(job: SpoolJob): Promise<{ success: boolean; isVirtual: boolean }> {
    const { textRepresentation } = EscPosBuilder.buildTicket(job.ticketData, job.paperWidth);
    
    const record: VirtualTicketRecord = {
      id: job.id,
      printerName: job.printerName,
      printerIp: job.printerIp,
      ticketData: job.ticketData,
      rawText: textRepresentation,
      printedAt: new Date().toISOString(),
    };

    if (!global.virtualPrinterHistory) global.virtualPrinterHistory = [];
    
    // Verhindere Mehrfacheinträge mit gleicher ID
    if (!global.virtualPrinterHistory.some((r) => r.id === record.id)) {
      global.virtualPrinterHistory.unshift(record);
      if (global.virtualPrinterHistory.length > 100) {
        global.virtualPrinterHistory.pop();
      }

      if (global.io) {
        global.io.emit('virtual_printer:new_ticket', record);
      }
    }

    return { success: true, isVirtual: true };
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    const job = this.queue.shift();
    if (!job) {
      this.isProcessing = false;
      return;
    }

    try {
      if (job.isVirtual) {
        await this.processVirtualPrint(job);
      } else {
        await this.sendToRawSocket(job);
        // Spiegelung für Virtuellen Monitor
        await this.processVirtualPrint(job);
      }

      // In DB als gedruckt markieren + async ACK (OrderItems + Socket)
      let orderId: string | null = null;
      let printGroupId: string | null = null;
      let updatedRaw: string | null = null;
      if (job.dbJobId) {
        const updated = await prisma.printJob
          .update({
            where: { id: job.dbJobId },
            data: { status: 'PRINTED', printedAt: new Date() },
          })
          .catch(() => null);
        orderId = (updated as { orderId?: string | null } | null)?.orderId ?? null;
        printGroupId = (updated as { printGroupId?: string | null } | null)?.printGroupId ?? null;
        updatedRaw = (updated as { rawPayload?: string | null } | null)?.rawPayload ?? null;
      }
      // Pro-Item-ACK: nur Items dieses Tickets, nicht ganze Order
      try {
        const parsed = JSON.parse(updatedRaw || '{}') as { __itemIds?: string[] };
        const ids = Array.isArray(parsed.__itemIds) ? parsed.__itemIds.filter((x) => typeof x === 'string') : [];
        if (ids.length > 0) {
          await prisma.orderItem.updateMany({ where: { id: { in: ids }, printStatus: 'PENDING' }, data: { printStatus: 'PRINTED' } }).catch(() => null);
        } else if (orderId) {
          await prisma.orderItem.updateMany({ where: { orderId, printStatus: 'PENDING' }, data: { printStatus: 'PRINTED' } }).catch(() => null);
        }
      } catch {}
      if (global.io) {
        global.io.emit('print:acked', {
          jobId: job.id,
          dbJobId: job.dbJobId || null,
          printerId: job.printerId,
          printerName: job.printerName,
          orderId,
          printGroupId,
        });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[ERROR] Fehler beim Drucken auf ${job.printerName} (${job.printerIp}):`, errMsg);

      if (job.retries < 2) {
        job.retries++;
        // Vorne in die Queue einhängen, damit die Druckreihenfolge erhalten bleibt
        this.queue.unshift(job);
      } else {
        // Nach Fehlversuchen prüfen, ob ein Ersatzdrucker konfiguriert ist
        let fallbackHandled = false;
        try {
          const printGroup = await prisma.printGroup.findFirst({
            where: { printerId: job.printerId, fallbackPrinterId: { not: null } },
          });

          if (printGroup?.fallbackPrinterId && printGroup.fallbackPrinterId !== job.printerId) {
            const fallbackPrinter = await prisma.printer.findUnique({
              where: { id: printGroup.fallbackPrinterId, isActive: true },
            });

            if (fallbackPrinter) {
              console.warn(
                `[FALLBACK] Leite Druckjob von ${job.printerName} auf Ersatzdrucker ${fallbackPrinter.name} (${fallbackPrinter.ipAddress}) um.`
              );
              job.printerId = fallbackPrinter.id;
              job.printerName = `${fallbackPrinter.name} (Ersatz)`;
              job.printerIp = fallbackPrinter.ipAddress;
              job.printerPort = fallbackPrinter.port || 9100;
              job.isVirtual = fallbackPrinter.isVirtual;
              job.paperWidth = fallbackPrinter.paperWidth || 80;
              job.ticketData.title = `[ERSATZ] ${job.ticketData.title || 'BON'}`;
              job.retries = 0;

              if (global.io) {
                global.io.emit('printer:fallback_rerouted', {
                  originalPrinterName: job.printerName,
                  fallbackPrinterName: fallbackPrinter.name,
                  jobId: job.id,
                });
              }

              this.queue.unshift(job);
              fallbackHandled = true;
            }
          }
        } catch {}

        if (!fallbackHandled) {
          // Als FAILED markieren + async NACK (OrderItems + Socket)
          let failedOrderId: string | null = null;
          let failedRaw: string | null = null;
          if (job.dbJobId) {
            const updated = await prisma.printJob
              .update({
                where: { id: job.dbJobId },
                data: {
                  status: 'FAILED',
                  attempts: job.retries + 1,
                  lastError: errMsg,
                },
              })
              .catch(() => null);
            failedOrderId = (updated as { orderId?: string | null } | null)?.orderId ?? null;
            failedRaw = (updated as { rawPayload?: string | null } | null)?.rawPayload ?? null;
          }
          try {
            const parsed = JSON.parse(failedRaw || '{}') as { __itemIds?: string[] };
            const ids = Array.isArray(parsed.__itemIds) ? parsed.__itemIds.filter((x) => typeof x === 'string') : [];
            if (ids.length > 0) {
              await prisma.orderItem.updateMany({ where: { id: { in: ids }, printStatus: 'PENDING' }, data: { printStatus: 'ERROR' } }).catch(() => null);
            } else if (failedOrderId) {
              await prisma.orderItem.updateMany({ where: { orderId: failedOrderId, printStatus: 'PENDING' }, data: { printStatus: 'ERROR' } }).catch(() => null);
            }
          } catch {}

          if (global.io) {
            global.io.emit('printer:error', {
              jobId: job.id,
              printerId: job.printerId,
              printerName: job.printerName,
              error: errMsg,
            });
            global.io.emit('print:failed', {
              jobId: job.id,
              dbJobId: job.dbJobId || null,
              printerId: job.printerId,
              printerName: job.printerName,
              orderId: failedOrderId,
              error: errMsg,
            });
          }
        }
      }
    } finally {
      this.isProcessing = false;
      setTimeout(() => this.processQueue(), 50);
    }
  }

  private sendToRawSocket(job: SpoolJob): Promise<void> {
    const { rawBuffer } = EscPosBuilder.buildTicket(job.ticketData, job.paperWidth);

    if (job.printerIp.startsWith('/dev/')) {
      return new Promise((resolve, reject) => {
        try {
          fs.writeFile(job.printerIp, rawBuffer, (err) => {
            if (err) reject(new Error(`USB-Druckfehler (${job.printerIp}): ${err.message}`));
            else resolve();
          });
        } catch (err: any) {
          reject(new Error(`USB-Gerätefehler (${job.printerIp}): ${err?.message || String(err)}`));
        }
      });
    }

    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      client.setNoDelay(true);
      client.setTimeout(2500);

      let isDone = false;
      const cleanup = (err?: Error) => {
        if (!isDone) {
          isDone = true;
          try {
            client.destroy();
          } catch {}
          if (err) reject(err);
          else resolve();
        }
      };

      client.connect(job.printerPort, job.printerIp, () => {
        client.write(rawBuffer, () => {
          client.end();
          cleanup();
        });
      });

      client.on('error', (err) => {
        cleanup(err);
      });

      client.on('timeout', () => {
        cleanup(new Error(`Timeout bei Verbindung zu ${job.printerIp}:${job.printerPort}`));
      });
    });
  }

  /**
   * Lädt beim Serverstart unvollendete Jobs aus der DB nach.
   */
  public async recoverPendingJobs(): Promise<void> {
    if (this.recoveryRunning) return;
    this.recoveryRunning = true;
    try {
      // Cursor-Schleife statt take:50-Deckel (nach Crash darf nichts ewig PENDING bleiben)
      let cursor: string | undefined;
      let total = 0;
      for (let round = 0; round < 20; round++) {
        const pending = await prisma.printJob.findMany({
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'asc' },
          take: 100,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        });
        if (pending.length === 0) break;
        total += pending.length;
        cursor = pending[pending.length - 1].id;
        await this.enqueueRecovered(pending);
        if (pending.length < 100) break;
      }
      if (total > 0) {
        console.log(`[SPOOLER] ${total} noch ausstehende Druckaufträge aus der Datenbank geladen.`);
        this.processQueue();
      }
      return;
    } catch {
      // Ignorieren bei Initialisierung / DB-Setup
    } finally {
      this.recoveryRunning = false;
    }
  }

  private async enqueueRecovered(pending: Array<{ id: string; printerId: string | null; rawPayload: string | null; attempts: number; createdAt: Date }>): Promise<void> {
    const printers = await prisma.printer.findMany();
    const printerMap = new Map(printers.map((pr) => [pr.id, pr]));
    for (const p of pending) {
      if (!p.printerId || !p.rawPayload) continue;
      // Bereits eingereihte Jobs nicht ein zweites Mal aufnehmen.
      if (this.queue.some((q) => q.dbJobId === p.id)) continue;
      const printer = printerMap.get(p.printerId);
      if (!printer) continue;
      try {
        const ticketData: TicketData = JSON.parse(p.rawPayload);
        this.queue.push({
          id: p.id,
          dbJobId: p.id,
          printerId: printer.id,
          printerName: printer.name,
          printerIp: printer.ipAddress,
          printerPort: printer.port || 9100,
          isVirtual: printer.isVirtual,
          paperWidth: printer.paperWidth || 80,
          ticketData,
          retries: p.attempts || 0,
          createdAt: p.createdAt,
        });
      } catch {}
    }
  }

  /** Requeue ohne Duplikat-PrintJob: nutzt bestehende DB-ID (Retry/Reroute). */
  public async requeueExistingJob(
    dbJob: { id: string; printerId: string | null; rawPayload: string | null; attempts?: number; createdAt?: Date },
    printer: { id: string; name: string; ipAddress: string; port: number; isVirtual: boolean; paperWidth: number }
  ): Promise<boolean> {
    if (!dbJob.rawPayload) return false;
    if (this.queue.some((q) => q.dbJobId === dbJob.id)) return true;
    try {
      const ticketData: TicketData = JSON.parse(dbJob.rawPayload);
      this.queue.push({
        id: dbJob.id,
        dbJobId: dbJob.id,
        printerId: printer.id,
        printerName: printer.name,
        printerIp: printer.ipAddress,
        printerPort: printer.port || 9100,
        isVirtual: printer.isVirtual,
        paperWidth: printer.paperWidth || 80,
        ticketData,
        retries: dbJob.attempts || 0,
        createdAt: dbJob.createdAt || new Date(),
      });
      this.processQueue();
      return true;
    } catch {
      return false;
    }
  }

  public async restartSpooler(): Promise<void> {
    this.isProcessing = false;
    // Nicht still verwerfen: ausgeschöpfte Jobs als FAILED in DB persistieren
    const dropped = this.queue.filter((job) => job.retries >= 3);
    this.queue = this.queue.filter((job) => job.retries < 3);
    for (const job of dropped) {
      try {
        if (job.dbJobId) {
          await prisma.printJob.update({
            where: { id: job.dbJobId },
            data: { status: 'FAILED', lastError: 'Max. Versuche erreicht – manuelles Retry/Reroute nötig.' },
          });
        }
      } catch {}
    }
    if (dropped.length > 0) {
      console.warn(`[SPOOLER] Neustart – ${dropped.length} Auftrag/Aufträge als FAILED persistiert, ${this.queue.length} weiter in Warteschlange.`);
    } else {
      console.warn(`[SPOOLER] Neustart – ${this.queue.length} Auftrag/Aufträge in der Warteschlange.`);
    }
    setTimeout(() => this.processQueue(), 50);
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public async spoolRaw(ipAddress: string, port: number, rawBuffer: Buffer, jobId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      client.setTimeout(3000);
      client.connect(port || 9100, ipAddress, () => {
        client.write(rawBuffer, () => {
          client.end();
          resolve();
        });
      });
      client.on('error', (err) => {
        client.destroy();
        reject(err);
      });
      client.on('timeout', () => {
        client.destroy();
        reject(new Error(`Timeout beim Senden an ${ipAddress}:${port}`));
      });
    });
  }

  public async openDrawer(printer: { ipAddress: string; port: number; isVirtual: boolean; name: string }): Promise<void> {
    if (printer.isVirtual) {
      console.log(`[KASSENLADE] Virtueller Impuls an ${printer.name}`);
      return;
    }

    const builder = new EscPosBuilder();
    builder.openCashDrawer();
    const rawBuffer = builder.build();

    const client = new net.Socket();
    client.setTimeout(3000);
    client.connect(printer.port || 9100, printer.ipAddress, () => {
      client.write(rawBuffer, () => {
        client.end();
      });
    });
  }
}

export const networkSpooler = new NetworkSpooler();
export default networkSpooler;
