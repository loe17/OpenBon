import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { TseConnector, TseFinishResult, TseInfo, TseStartResult } from './types';

function logFile(): string {
  const dir = process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : path.join(process.cwd(), 'prisma');
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}
  return path.join(dir, 'tse-log.jsonl');
}

function salt(): string {
  const s = process.env.FISCAL_SALT?.trim();
  if (s && s.length >= 16) return s;
  return 'OPENBON-TEST-FISCAL-SALT-MIN-16-CHARS';
}

let counter = 0;

/** File/Mock-TSE: kein Hardware nötig, schreibt JSONL-Protokoll. Nicht §146a-konform. */
export class MockFileTse implements TseConnector {
  readonly name = 'MOCK' as const;

  async start(orderId: string): Promise<TseStartResult> {
    counter += 1;
    const entry = { ev: 'start', transactionNo: counter, orderId, logTime: new Date().toISOString() };
    try {
      fs.appendFileSync(logFile(), JSON.stringify(entry) + '\n');
    } catch {}
    return { serial: 'MOCK-TSE-LOCAL', transactionNo: counter, logTime: entry.logTime };
  }

  async update(transactionNo: number, payload: string): Promise<void> {
    try {
      fs.appendFileSync(logFile(), JSON.stringify({ ev: 'update', transactionNo, len: payload.length, logTime: new Date().toISOString() }) + '\n');
    } catch {}
  }

  async finish(transactionNo: number): Promise<TseFinishResult> {
    const signature = crypto.createHmac('sha256', salt()).update(`MOCK|${transactionNo}|${Date.now()}`).digest('hex').toUpperCase();
    const logTime = new Date().toISOString();
    try {
      fs.appendFileSync(logFile(), JSON.stringify({ ev: 'finish', transactionNo, signature, signatureCounter: transactionNo, logTime }) + '\n');
    } catch {}
    return { signature, signatureCounter: transactionNo, logTime };
  }

  async info(): Promise<TseInfo> {
    return { provider: 'MOCK', serial: 'MOCK-TSE-LOCAL', enabled: true };
  }
}
