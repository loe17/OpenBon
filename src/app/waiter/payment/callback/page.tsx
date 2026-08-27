'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';
import { playPaymentSuccess, playPaymentFailure } from '@/lib/audio-feedback';

type CallbackOutcome = 'PENDING' | 'SUCCESS' | 'FAILED' | 'UNVERIFIED';

/**
 * Spec 4.1 / N2.1: Rücksprungziel der Karten-Apps
 * http://openbon.local/waiter/payment/callback?orderId=...&status=success&ts=...&sig=...
 *
 * hardened v0.4.11: Der Status wird NICHT mehr blind aus der URL übernommen.
 * Vor dem Schreiben des SessionStorage-Ergebnisses verifiziert die Seite
 * serverseitig die bei Initiierung mitgegebene Signatur (/api/payments/card/verify).
 * Ohne gültige Signatur gilt die Rückkehr als UNVERIFIZIERT und blockiert
 * die automatische Verbuchung an der Kasse.
 */
function CallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState('Zahlung wird verarbeitet...');
  const [outcome, setOutcome] = useState<CallbackOutcome>('PENDING');

  const orderId = params.get('orderId') ?? '';
  const status = (params.get('status') ?? 'success').toLowerCase();
  const provider = params.get('provider') ?? 'card';
  const tsParam = params.get('ts') ?? '';
  const sigParam = params.get('sig') ?? '';
  // Verschiedene Anbieter benennen den Autorisierungscode unterschiedlich
  const authCode =
    params.get('authCode') ??
    params.get('auth_code') ??
    params.get('transaction_code') ??
    params.get('tx_code') ??
    null;

  const claimedSuccess = status === 'success' || status === 'successful' || status === 'ok';

  const cleanupTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const decideAndStore = async () => {
      if (!claimedSuccess) {
        persistResult('FAILED');
        return;
      }
      if (!orderId) {
        persistResult('UNVERIFIED', 'Unvollständige Rückkehr (ohne Referenz).');
        return;
      }

      try {
        const res = await fetch('/api/payments/card/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, status, provider, ts: tsParam, sig: sigParam }),
        });
        const data = await res.json().catch(() => ({}) as any);

        if (cancelled) return;

        if (res.ok && data.verified) {
          persistResult('SUCCESS');
        } else {
          persistResult(
            'UNVERIFIED',
            data.error || 'Rückkehr ohne gültige Server-Signatur – bitte an der Kasse prüfen.'
          );
        }
      } catch {
        if (!cancelled) {
          persistResult('UNVERIFIED', 'Signatur konnte serverseitig nicht geprüft werden.');
        }
      }
    };

    const persistResult = (target: Exclude<CallbackOutcome, 'PENDING'>, note?: string) => {
      const payload = {
        orderId,
        provider,
        status: target === 'SUCCESS' ? 'success' : 'failed',
        authCode,
        receivedAt: new Date().toISOString(),
        // N2.1: Nur signaturverifizierte Rückkehr darf die Verbuchung freischalten.
        verified: target === 'SUCCESS',
        unverifiedNote: target === 'UNVERIFIED' ? note || '' : undefined,
      };

      try {
        sessionStorage.setItem('openbon_card_result', JSON.stringify(payload));
      } catch {
        /* SessionStorage nicht verfügbar – Ergebnis wird dann manuell bestätigt */
      }

      if (target === 'SUCCESS') {
        playPaymentSuccess();
        setMessage('Zahlung autorisiert. Zurück zur Kasse...');
        setOutcome('SUCCESS');
      } else if (target === 'UNVERIFIED') {
        playPaymentFailure();
        setOutcome('UNVERIFIED');
        setMessage(note || 'Rückkehr unverifiziert.');
      } else {
        playPaymentFailure();
        setOutcome('FAILED');
        setMessage('Die Kartenzahlung wurde abgebrochen.');
      }

      const timer = setTimeout(() => {
        const tableId = params.get('tableId');
        router.replace(tableId ? `/waiter/payment?tableId=${tableId}` : '/waiter');
      }, target === 'SUCCESS' ? 1200 : target === 'UNVERIFIED' ? 3200 : 2600);
      cleanupTimerRef.current = timer;
    };

    void decideAndStore();

    return () => {
      cancelled = true;
      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, status, provider]);

  const stateStyles = outcome === 'SUCCESS' ? 'text-emerald-400' : outcome === 'UNVERIFIED' ? 'text-amber-400' : 'text-rose-400';
  const stateBg =
    outcome === 'SUCCESS' ? 'rgba(16,185,129,0.12)' : outcome === 'UNVERIFIED' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)';
  const StateIcon = outcome === 'SUCCESS' ? CheckCircle2 : outcome === 'UNVERIFIED' ? ShieldAlert : AlertTriangle;

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-white p-8 gap-5">
      <div
        className={`relative w-28 h-28 rounded-full flex items-center justify-center ${stateStyles}`}
        style={{ backgroundColor: stateBg }}
      >
        <StateIcon className="w-14 h-14" />
      </div>

      <div className="text-2xl font-black text-center">{message}</div>
      {outcome === 'UNVERIFIED' && (
        <div className="text-xs text-slate-400 text-center max-w-md leading-relaxed">
          Die Bedienung muss an der Kasse die Terminal-Anzeige gegenprüfen und die Zahlung
          dort erneut starten oder manuell buchen.
        </div>
      )}
      {authCode && (
        <div className="font-mono text-sm text-slate-400">Autorisierung: {authCode}</div>
      )}
      <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
        {provider}
      </div>
    </div>
  );
}

export default function CardCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Verarbeite Rückmeldung...</span>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
