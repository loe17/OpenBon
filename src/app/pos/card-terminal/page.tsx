'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/components/providers/socket-provider';
import {
  CreditCard,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Wifi,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Zap,
  Clock,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { triggerHapticFeedback } from '@/lib/socket-client';

interface IncomingPayment {
  sessionId: string;
  amountCents: number;
  currency: string;
  provider: string;
  orderId?: string;
  deviceId?: string;
  waiterName?: string;
  title?: string;
  initiate?: {
    kind: string;
    url?: string;
  };
}

export default function CardTerminalCompanionPage() {
  const { socket, isConnected } = useSocket();
  const [pairedStation, setPairedStation] = useState<string>('ALL');
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [incoming, setIncoming] = useState<IncomingPayment | null>(null);
  const [status, setStatus] = useState<'READY' | 'PAYING' | 'SUCCESS' | 'CANCELLED'>('READY');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const wakeLockRef = useRef<any>(null);

  // 1. WakeLock: Hält das Smartphone-Display während der Schicht eingeschaltet
  useEffect(() => {
    async function requestWakeLock() {
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          setWakeLockActive(true);
          wakeLockRef.current.addEventListener('release', () => {
            setWakeLockActive(false);
          });
        } catch {
          setWakeLockActive(false);
        }
      }
    }

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  // 2. Station-Kopplung aus LocalStorage laden / speichern
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('openbon_card_terminal_paired_kiosk');
      if (saved) setPairedStation(saved);
    }
  }, []);

  const handlePairingChange = (val: string) => {
    setPairedStation(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('openbon_card_terminal_paired_kiosk', val);
    }
  };

  // 3. Auf eingehende Zahlungsaufforderungen per WebSocket lauschen
  useEffect(() => {
    if (!socket) return;

    const handlePaymentCreated = (data: IncomingPayment) => {
      // Wenn eine bestimmte Station gefiltert wird, nur passende Events annehmen
      if (pairedStation !== 'ALL' && data.deviceId && data.deviceId !== pairedStation) {
        return;
      }

      triggerHapticFeedback();
      setIncoming(data);
      setStatus('PAYING');
      setStatusMessage('Zahlungsaufforderung empfangen');

      // Automatischer Versuch, den Deeplink der Bezahl-App aufzurufen
      if (data.initiate?.url) {
        try {
          window.location.href = data.initiate.url;
        } catch {
          // Browser blockiert ggf. automatischen Deeplink ohne Klick
        }
      }
    };

    const handlePaymentCompleted = (data: { sessionId: string }) => {
      if (incoming && incoming.sessionId === data.sessionId) {
        setStatus('SUCCESS');
        setStatusMessage('Zahlung erfolgreich autorisiert!');
        setTimeout(() => {
          setStatus('READY');
          setIncoming(null);
        }, 4000);
      }
    };

    const handlePaymentCancelled = (data: { sessionId: string }) => {
      if (incoming && incoming.sessionId === data.sessionId) {
        setStatus('CANCELLED');
        setStatusMessage('Zahlung am Kiosk abgebrochen');
        setTimeout(() => {
          setStatus('READY');
          setIncoming(null);
        }, 3000);
      }
    };

    socket.on('payment:session_created', handlePaymentCreated);
    socket.on('payment:completed', handlePaymentCompleted);
    socket.on('payment:cancelled', handlePaymentCancelled);

    return () => {
      socket.off('payment:session_created', handlePaymentCreated);
      socket.off('payment:completed', handlePaymentCompleted);
      socket.off('payment:cancelled', handlePaymentCancelled);
    };
  }, [socket, pairedStation, incoming]);

  // Manuelle Simulation / Bestätigung für Beta- & Testbetrieb (ohne Live-Bankvertrag)
  const handleConfirmSimulation = async () => {
    if (!incoming) return;
    setIsSubmitting(true);
    triggerHapticFeedback();
    try {
      const res = await fetch('/api/payments/session/' + incoming.sessionId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CONFIRM_SUCCESS',
          authCode: 'SIM-' + Date.now().toString(36).toUpperCase(),
        }),
      });

      if (res.ok) {
        setStatus('SUCCESS');
        setStatusMessage('Zahlung erfolgreich verbucht!');
        setTimeout(() => {
          setStatus('READY');
          setIncoming(null);
        }, 3000);
      } else {
        const err = await res.json();
        alert('Fehler: ' + (err.error || 'Bestätigung fehlgeschlagen'));
      }
    } catch (e: any) {
      alert('Verbindungsfehler: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelPayment = async () => {
    if (!incoming) return;
    setIsSubmitting(true);
    triggerHapticFeedback();
    try {
      await fetch('/api/payments/session/' + incoming.sessionId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CANCEL',
          reason: 'Am Bezahl-Handy abgebrochen',
        }),
      });
      setStatus('CANCELLED');
      setStatusMessage('Zahlung abgebrochen');
      setTimeout(() => {
        setStatus('READY');
        setIncoming(null);
      }, 2000);
    } catch {
      setStatus('READY');
      setIncoming(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none p-4 max-w-md mx-auto justify-between">
      {/* Kopfbereich */}
      <header className="flex items-center justify-between py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-sm shadow-md">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-sm text-white">Bezahl-Terminal</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Beta
              </span>
            </div>
            <p className="text-[11px] text-slate-400">SoftPOS Begleiter</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
              isConnected
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                : 'bg-rose-950/60 text-rose-300 border-rose-800'
            }`}
          >
            <Wifi className="w-3 h-3" />
            <span>{isConnected ? 'Online' : 'Offline'}</span>
          </span>
        </div>
      </header>

      {/* Hauptbereich */}
      <main className="flex-1 flex flex-col justify-center items-center my-6 text-center">
        {/* Status: BEREIT */}
        {status === 'READY' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="w-24 h-24 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-950/40 animate-pulse">
              <CreditCard className="w-12 h-12" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-white">Bereit für Zahlungen</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Warte auf Zahlungsbefehl vom SB-Kiosk. Sobald ein Gast bestellt, springt dieses Handy automatisch an.
              </p>
            </div>

            {/* Kopplungs-Wähler */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 text-left text-xs space-y-2">
              <label className="font-bold text-slate-300 block">Kopplung mit Kiosk-Terminal:</label>
              <select
                value={pairedStation}
                onChange={(e) => handlePairingChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-medium focus:border-blue-500"
              >
                <option value="ALL">Alle SB-Kioske (Universell)</option>
                <option value="kiosk-1">SB-Kiosk #1</option>
                <option value="kiosk-2">SB-Kiosk #2</option>
                <option value="kiosk-3">SB-Kiosk #3</option>
              </select>
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <span>Display-Sperre: {wakeLockActive ? 'Verhindert (AN)' : 'Standard'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Status: ZAHLUNG LÄUFT */}
        {status === 'PAYING' && incoming && (
          <div className="space-y-5 w-full animate-in zoom-in-95">
            <div className="bg-slate-900 border-2 border-blue-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="w-16 h-16 rounded-full bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center mx-auto animate-bounce">
                <CreditCard className="w-8 h-8" />
              </div>

              <div>
                <span className="text-xs uppercase tracking-widest text-slate-400 font-bold block">
                  Zahlungsbetrag
                </span>
                <div className="text-4xl font-black font-mono text-emerald-400 my-1">
                  {(incoming.amountCents / 100).toFixed(2)} €
                </div>
                <p className="text-xs text-slate-400">
                  {incoming.title || 'SB-Kiosk Bestellung'}
                </p>
              </div>

              {/* Handlungsanweisung für den Kunden */}
              <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-800/60 text-xs text-blue-200 text-left space-y-2">
                <div className="font-bold flex items-center gap-2 text-blue-300">
                  <Smartphone className="w-4 h-4" />
                  <span>Karte an Rückseite halten:</span>
                </div>
                <p className="leading-relaxed">
                  Bitte halten Sie Ihre Girokarte, Kreditkarte oder Ihr Handy an die <strong>Rückseite dieses Smartphones</strong>.
                </p>
                <p className="text-[11px] text-blue-300/80">
                  Bei Beträgen über 50 € erscheint die PIN-Eingabe auf diesem Display.
                </p>
              </div>

              {/* VR Pay:Me App öffnen (falls Deeplink vorhanden) */}
              {incoming.initiate?.url && (
                <a
                  href={incoming.initiate.url}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg transition"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>VR Pay:Me App öffnen</span>
                </a>
              )}

              {/* Beta-Test-Leiste (Erfolg / Abbruch simulieren) */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="text-[11px] text-amber-400 font-bold flex items-center justify-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Beta-Testmodus (ohne Bankvertrag):</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleConfirmSimulation}
                    disabled={isSubmitting}
                    className="py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition"
                  >
                    ✓ Zahlung simulieren (Erfolg)
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelPayment}
                    disabled={isSubmitting}
                    className="py-3 bg-rose-900/60 hover:bg-rose-900 text-rose-200 font-bold text-xs rounded-xl border border-rose-700 shadow transition"
                  >
                    ✕ Abbrechen
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status: ERFOLG */}
        {status === 'SUCCESS' && (
          <div className="space-y-4 animate-in zoom-in-95">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h2 className="text-2xl font-black text-white">Zahlung erfolgt!</h2>
            <p className="text-xs text-slate-300">
              Der Kiosk druckt jetzt den Kassenbon und die Abholmarke.
            </p>
          </div>
        )}

        {/* Status: ABGEBROCHEN */}
        {status === 'CANCELLED' && (
          <div className="space-y-4 animate-in zoom-in-95">
            <div className="w-20 h-20 rounded-full bg-rose-500/20 border-2 border-rose-500 text-rose-400 flex items-center justify-center mx-auto">
              <XCircle className="w-12 h-12" />
            </div>
            <h2 className="text-2xl font-black text-white">Zahlung abgebrochen</h2>
            <p className="text-xs text-slate-300">
              Der Kiosk kehrt zur Artikelauswahl zurück.
            </p>
          </div>
        )}
      </main>

      {/* Fußbereich */}
      <footer className="text-center text-[11px] text-slate-500 border-t border-slate-800/80 pt-3">
        <p>OpenBon Kassen-Terminal Begleiter • VR Pay:Me SoftPOS</p>
      </footer>
    </div>
  );
}
