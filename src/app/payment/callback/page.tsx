'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, RefreshCw, ArrowRight } from 'lucide-react';
import PaymentService from '@/lib/payment/payment-service';

function PaymentCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'cancelled' | 'failed'>('loading');
  const [message, setMessage] = useState('Zahlung wird verifiziert...');
  const [returnUrl, setReturnUrl] = useState('/waiter');

  useEffect(() => {
    const process = async () => {
      try {
        const pending = PaymentService.getPending();
        let targetUrl = '/waiter';
        if (pending?.tableId) {
          targetUrl = `/waiter/payment?tableId=${pending.tableId}`;
        } else if (pending?.orderId) {
          targetUrl = `/pos`;
        }
        setReturnUrl(targetUrl);

        const paramsObj: Record<string, string> = {};
        searchParams.forEach((value, key) => {
          paramsObj[key] = value;
        });

        // Callback an Backend senden
        const res = await fetch('/api/payments/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(paramsObj),
        });

        const data = await res.json();
        PaymentService.clearPending();

        if (data.status === 'SUCCESS' || data.success) {
          setStatus('success');
          setMessage('Zahlung erfolgreich autorisiert!');
          setTimeout(() => {
            router.push(targetUrl);
          }, 1500);
        } else if (data.status === 'CANCELLED') {
          setStatus('cancelled');
          setMessage('Zahlung wurde in der Bezahl-App abgebrochen.');
        } else {
          setStatus('failed');
          setMessage(data.result?.errorMessage || 'Zahlung nicht erfolgreich.');
        }
      } catch (err) {
        setStatus('failed');
        setMessage(err instanceof Error ? err.message : 'Verbindungsfehler bei der Zahlungsverifikation.');
      }
    };

    process();
  }, [searchParams, router]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl animate-in zoom-in-95">
      {status === 'loading' && (
        <div className="space-y-4">
          <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
          <h2 className="text-xl font-black text-white">Zahlung wird geprüft</h2>
          <p className="text-sm text-slate-400">{message}</p>
        </div>
      )}

      {status === 'success' && (
        <div className="space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-white">Zahlung erfolgreich!</h2>
          <p className="text-sm text-slate-300">{message}</p>
          <p className="text-xs text-slate-500">Automatische Weiterleitung in Kürze...</p>
        </div>
      )}

      {(status === 'failed' || status === 'cancelled') && (
        <div className="space-y-4">
          <div className="w-16 h-16 rounded-full bg-rose-600/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
            <XCircle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-white">
            {status === 'cancelled' ? 'Zahlung abgebrochen' : 'Zahlungsfehler'}
          </h2>
          <p className="text-sm text-rose-300">{message}</p>
          <button
            onClick={() => router.push(returnUrl)}
            className="w-full min-h-[48px] bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition"
          >
            <span>Zurück zur Kasse</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="text-center p-8 bg-slate-900 border border-slate-800 rounded-3xl">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
            <span className="text-slate-400 text-sm">Wird geladen...</span>
          </div>
        }
      >
        <PaymentCallbackContent />
      </Suspense>
    </div>
  );
}
