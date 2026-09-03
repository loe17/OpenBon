export type TseProviderName = 'NONE' | 'MOCK' | 'FISKALY' | 'EFSTA' | 'SWISSBIT';

export interface TseStartResult {
  serial: string;
  transactionNo: number;
  logTime: string;
}

export interface TseFinishResult {
  signature: string;
  signatureCounter: number;
  logTime: string;
}

export interface TseInfo {
  provider: TseProviderName;
  serial: string | null;
  enabled: boolean;
}

export interface TseConnector {
  readonly name: TseProviderName;
  start(orderId: string): Promise<TseStartResult>;
  update(transactionNo: number, payload: string): Promise<void>;
  finish(transactionNo: number): Promise<TseFinishResult>;
  info(): Promise<TseInfo>;
}
