'use client';

export interface PendingPaymentState {
  sessionId: string;
  orderId?: string;
  tableId?: string;
  waiterName?: string;
  provider: string;
  amount: number;
  initiatedAt: number;
}

const STORAGE_KEY = 'openbon_pending_payment';

export class PaymentService {
  /**
   * Speichert eine ausstehende Zahlung im lokalen Speicher.
   */
  public static savePending(state: PendingPaymentState): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }

  /**
   * Liest die ausstehende Zahlung aus.
   */
  public static getPending(): PendingPaymentState | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed: PendingPaymentState = JSON.parse(raw);
      // TTL 15 Minuten
      if (Date.now() - parsed.initiatedAt > 15 * 60 * 1000) {
        this.clearPending();
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Löscht die ausstehende Zahlung.
   */
  public static clearPending(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  /**
   * Startet eine Kartenzahlung (App-to-App, QR oder Terminal).
   */
  public static async initiate(options: {
    provider: string;
    amount: number;
    orderId?: string;
    tableId?: string;
    waiterName?: string;
    title?: string;
    context?: Record<string, unknown>;
  }): Promise<{
    sessionId: string;
    kind: 'deeplink' | 'qr' | 'sync';
    url?: string;
    clientSecret?: string;
    result?: Record<string, unknown>;
  }> {
    const amountCents = Math.round(options.amount * 100);

    const res = await fetch('/api/payments/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: options.provider,
        amountCents,
        orderId: options.orderId,
        tableId: options.tableId,
        waiterName: options.waiterName,
        title: options.title,
        context: options.context,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Fehler beim Starten der Zahlung');
    }

    const data = await res.json();
    const sessionId = data.sessionId;
    const init = data.initiate;

    // Lokalen Zustand für Recovery sichern
    this.savePending({
      sessionId,
      orderId: options.orderId,
      tableId: options.tableId,
      waiterName: options.waiterName,
      provider: options.provider,
      amount: options.amount,
      initiatedAt: Date.now(),
    });

    if (init.kind === 'deeplink' && init.url) {
      // App-to-App Switch
      window.location.href = init.url;
    }

    return {
      sessionId,
      kind: init.kind,
      url: init.url,
      clientSecret: init.clientSecret,
      result: init.result,
    };
  }

  /**
   * Fragt den aktuellen Status einer Session vom Server ab.
   */
  public static async checkStatus(sessionId: string): Promise<any> {
    const res = await fetch(`/api/payments/session/${sessionId}`);
    if (!res.ok) throw new Error('Status konnte nicht abgefragt werden');
    return res.json();
  }

  /**
   * Bricht eine ausstehende Session ab.
   */
  public static async cancel(sessionId: string, reason?: string): Promise<void> {
    await fetch(`/api/payments/session/${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'CANCEL', reason }),
    });
    this.clearPending();
  }

  /**
   * Bestätigt eine Zahlung manuell mit Autorisierungscode (Notfall-Wiederherstellung).
   */
  public static async manualConfirm(sessionId: string, authCode: string): Promise<void> {
    await fetch(`/api/payments/session/${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'MANUAL_CONFIRM', authCode }),
    });
    this.clearPending();
  }
}

export default PaymentService;
