import type { TseConnector, TseFinishResult, TseInfo, TseStartResult } from './types';

/**
 * Fiskaly-HTTP-Stub (ENV-gated, default aus).
 * Aktiv nur wenn TSE_PROVIDER=FISKALY + FISKALY_API_KEY + FISKALY_TSS_ID gesetzt.
 * Ohne Keys wirft er klar statt still SUCCESS vorzutäuschen.
 */
export class FiskalyTse implements TseConnector {
  readonly name = 'FISKALY' as const;

  private cfg() {
    const apiKey = process.env.FISKALY_API_KEY?.trim() || '';
    const tssId = process.env.FISKALY_TSS_ID?.trim() || '';
    const baseUrl = process.env.FISKALY_BASE_URL?.trim() || 'https://kassensicherungsverordnung.fiskaly.com/api/v2';
    if (!apiKey || !tssId) {
      throw new Error('[TSE-FISKALY] FISKALY_API_KEY und FISKALY_TSS_ID erforderlich (ENV).');
    }
    return { apiKey, tssId, baseUrl };
  }

  async start(orderId: string): Promise<TseStartResult> {
    const { apiKey, tssId, baseUrl } = this.cfg();
    const res = await fetch(`${baseUrl}/tss/${tssId}/tx`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'ACTIVE', client_id: orderId }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`[TSE-FISKALY] start fehlgeschlagen: ${res.status}`);
    const j = (await res.json()) as { number?: number; time?: string; _id?: string };
    return { serial: tssId, transactionNo: j.number ?? Date.now(), logTime: j.time ?? new Date().toISOString() };
  }

  async update(): Promise<void> {
    return;
  }

  async finish(transactionNo: number): Promise<TseFinishResult> {
    const { apiKey, tssId, baseUrl } = this.cfg();
    const res = await fetch(`${baseUrl}/tss/${tssId}/tx/${transactionNo}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'FINISHED' }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`[TSE-FISKALY] finish fehlgeschlagen: ${res.status}`);
    const j = (await res.json()) as { signature?: { value?: string; counter?: number }; time?: string };
    return {
      signature: j.signature?.value ?? '',
      signatureCounter: j.signature?.counter ?? transactionNo,
      logTime: j.time ?? new Date().toISOString(),
    };
  }

  async info(): Promise<TseInfo> {
    try {
      const { tssId } = this.cfg();
      return { provider: 'FISKALY', serial: tssId, enabled: true };
    } catch {
      return { provider: 'FISKALY', serial: null, enabled: false };
    }
  }
}
