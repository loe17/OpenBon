'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { playPaymentSuccess, playPaymentFailure } from '@/lib/audio-feedback';

/**
 * Spec 4.1: Rücksprungziel der Karten-Apps
 * http://openbon.local/waiter/payment/callback?orderId=...&status=success
 *
 * Die Seite schreibt das Ergebnis in den SessionStorage und schickt die
 * Bedienung zurück in die Kassiermaske, die den Abschluss dann verbucht.
 */
function CallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState('Zahlung wird verarbeitet...');

  const orderId = params.get('orderId') ?? '';
  const status = (params.get('status') ?? 'success').toLowerCase();
  const provider = params.get('provider') ?? 'card';
  // Verschiedene Anbieter benennen den Autorisierungscode unterschiedlich
  const authCode =
    params.get('authCode') ??
    params.get('auth_code') ??
    params.get('transaction_code') ??
    params.get('tx_code') ??
    null;

  const success = status === 'success' || status === 'successful' || status === 'ok';

  useEffect(() => {
    const payload = {
      orderId,
      provider,
      status: success ? 'success' : 'failed',
      authCode,
      receivedAt: new Date().toISOString(),
    };

    try {
      sessionStorage.setItem('openbon_card_result', JSON.stringify(payload));
    } catch {
      /* SessionStorage nicht verfügbar – Ergebnis wird dann manuell bestätigt */
    }

    if (success) {
      playPaymentSuccess();
      setMessage('Zahlung autorisiert. Zurück zur Kasse...');
    } else {
      playPaymentFailure();
      setMessage('Die Kartenzahlung wurde abgebrochen.');
    }

    const timer = setTimeout(() => {
      const target = params.get('tableId')
        ? `/waiter/payment?tableId=${params.get('tableId')}`
        : '/waiter';
      router.replace(target);
    }, success ? 1200 : 2600);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, status, provider]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-white p-8 gap-5">
      <div
        className={`relative w-28 h-28 rounded-full flex items-center justify-center ${
          success ? 'text-emerald-400' : 'text-rose-400'
        }`}
        style={{ backgroundColor: success ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }}
      >
        {success ? <CheckCircle2 className="w-14 h-14" /> : <AlertTriangle className="w-14 h-14" />}
      </div>

      <div className="text-2xl font-black text-center">{message}</div>
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
