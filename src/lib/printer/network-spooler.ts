import net from 'net';
import { EscPosBuilder } from './escpos-builder';
import { TicketData, VirtualTicketRecord } from './types';
import prisma from '../db';

interface SpoolJob {
  id: string;
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

  public async printTicket(
    printer: { id: string; name: string; ipAddress: string; port: number; isVirtual: boolean; paperWidth: number },
    ticketData: TicketData
  ): Promise<{ success: boolean; isVirtual: boolean; error?: string }> {
    const job: SpoolJob = {
      id: Math.random().toString(36).substring(2, 9),
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
      return this.processVirtualPrint(job);
    } else {
      this.queue.push(job);
      this.processQueue();
      return { success: true, isVirtual: false };
    }
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

    // Store in global history (max 100 tickets)
    if (!global.virtualPrinterHistory) global.virtualPrinterHistory = [];
    global.virtualPrinterHistory.unshift(record);
    if (global.virtualPrinterHistory.length > 100) {
      global.virtualPrinterHistory.pop();
    }

    // Broadcast to browser clients via Socket.io
    if (global.io) {
      global.io.emit('virtual_printer:new_ticket', record);
    }

    console.log(`[VIRTUELLER DRUCKER: ${job.printerName}]`);
    console.log(textRepresentation);
    console.log(`--------------------------------------------------`);

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
      await this.sendToRawSocket(job);
    } catch (err: any) {
      console.error(`[ERROR] Fehler beim Drucken auf ${job.printerName} (${job.printerIp}):`, err.message);
      
      // Auto retry up to 3 times before error alert
      if (job.retries < 3) {
        job.retries++;
        console.log(`[RETRY] Wiederhole Druckauftrag fuer ${job.printerName} (Versuch ${job.retries}/3)...`);
        this.queue.push(job);
      } else {
        if (global.io) {
          global.io.emit('printer:error', {
            printerId: job.printerId,
            printerName: job.printerName,
            error: err.message,
          });
        }
      }
    } finally {
      this.isProcessing = false;
      setTimeout(() => this.processQueue(), 200);
    }
  }

  private sendToRawSocket(job: SpoolJob): Promise<void> {
    return new Promise((resolve, reject) => {
      const { rawBuffer } = EscPosBuilder.buildTicket(job.ticketData, job.paperWidth);
      const client = new net.Socket();
      client.setTimeout(5000);

      client.connect(job.printerPort, job.printerIp, () => {
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
        reject(new Error(`Timeout bei Verbindung zu ${job.printerIp}:${job.printerPort}`));
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
