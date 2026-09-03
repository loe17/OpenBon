import prisma from '../db';
import type { TseConnector, TseFinishResult, TseInfo, TseProviderName, TseStartResult } from './types';
import { MockFileTse } from './mock-file-tse';
import { FiskalyTse } from './fiskaly-tse';

let cached: { connector: TseConnector; at: number } | null = null;

class NoneTse implements TseConnector {
  readonly name = 'NONE' as const;
  async start(_orderId: string): Promise<TseStartResult> {
    throw new Error('[TSE] Kein TSE-Anbieter konfiguriert (TSE_PROVIDER=NONE).');
  }
  async update(_transactionNo: number, _payload: string): Promise<void> {
    throw new Error('[TSE] Kein TSE-Anbieter konfiguriert.');
  }
  async finish(_transactionNo: number): Promise<TseFinishResult> {
    throw new Error('[TSE] Kein TSE-Anbieter konfiguriert.');
  }
  async info(): Promise<TseInfo> {
    return { provider: 'NONE' as const, serial: null, enabled: false };
  }
}

class NotImplementedTse implements TseConnector {
  readonly name: TseProviderName;
  constructor(name: TseProviderName) {
    this.name = name;
  }
  async start(_orderId: string): Promise<TseStartResult> {
    throw new Error(`[TSE-${this.name}] Noch nicht implementiert (Stub).`);
  }
  async update(_transactionNo: number, _payload: string): Promise<void> {
    throw new Error(`[TSE-${this.name}] Noch nicht implementiert (Stub).`);
  }
  async finish(_transactionNo: number): Promise<TseFinishResult> {
    throw new Error(`[TSE-${this.name}] Noch nicht implementiert (Stub).`);
  }
  async info(): Promise<TseInfo> {
    return { provider: this.name, serial: null, enabled: false };
  }
}

/** Default NONE (ehrenhaft, kein stiller Mock). ENV TSE_PROVIDER überschreibt DB. */
export async function getTseConnector(): Promise<TseConnector> {
  if (cached && Date.now() - cached.at < 30000) return cached.connector;
  const env = (process.env.TSE_PROVIDER?.trim().toUpperCase() || '') as TseProviderName;
  let name: TseProviderName = 'NONE';
  if (env === 'MOCK' || env === 'FISKALY' || env === 'EFSTA' || env === 'SWISSBIT' || env === 'NONE') {
    name = env;
  } else {
    try {
      const cfg = await prisma.eventConfig.findUnique({ where: { id: 'default' }, select: { tseProvider: true } });
      const db = (cfg?.tseProvider || 'NONE').toUpperCase();
      if (db === 'MOCK' || db === 'FISKALY' || db === 'EFSTA' || db === 'SWISSBIT') name = db as TseProviderName;
    } catch {}
  }
  let connector: TseConnector;
  if (name === 'MOCK') connector = new MockFileTse();
  else if (name === 'FISKALY') connector = new FiskalyTse();
  else if (name === 'EFSTA' || name === 'SWISSBIT') connector = new NotImplementedTse(name);
  else connector = new NoneTse();
  cached = { connector, at: Date.now() };
  return connector;
}
