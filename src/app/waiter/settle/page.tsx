'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  Receipt,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Coins,
  DollarSign,
  User,
  Printer,
  Delete,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';
import { triggerHapticFeedback } from '@/lib/socket-client';

export default function WaiterSettlePage() {
  const router = useRouter();
  const { success, error } = useToast();

  const [waiterName, setWaiterName] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalGross: 0,
    cashGross: 0,
    cardGross: 0,
    tips: 0,
    orderCount: 0,
  });

  const [countedCash, setCountedCash] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settledData, setSettledData] = useState<any>(null);

  useEffect(() => {
    const activeUser = localStorage.getItem('pos_waiter_name') || localStorage.getItem('pos_user_name') || '';
    setWaiterName(activeUser);

    if (activeUser) {
      fetchStats(activeUser);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchStats = async (name: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?waiterName=${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = await res.json();
        setStats({
          totalGross: data.totalGross || 0,
          cashGross: data.totalCash || data.cashGross || 0,
          cardGross: data.totalCard || data.cardGross || 0,
          tips: data.totalTips || data.tips || 0,
          orderCount: data.totalTransactions || 0,
        });
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const handleKeypadPress = (val: string) => {
    triggerHapticFeedback();
    if (val === 'C') {
      setCountedCash('');
    } else if (val === 'DEL') {
      setCountedCash((prev) => prev.slice(0, -1));
    } else if (val === '.') {
      if (!countedCash.includes('.')) {
        setCountedCash((prev) => (prev ? prev + '.' : '0.'));
      }
    } else {
      setCountedCash((prev) => prev + val);
    }
  };

  const countedNum = parseFloat(countedCash) || 0;
  const targetCash = stats.cashGross;
  const discrepancy = countedNum - targetCash;

  const handleSettle = async () => {
    if (!waiterName) {
      error('Kein Kellnername hinterlegt');
      return;
    }

    setIsSubmitting(true);
    triggerHapticFeedback();

    try {
      const res = await fetch('/api/waiters/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waiterName,
          totalGross: stats.totalGross,
          cashGross: stats.cashGross,
          tips: stats.tips,
          handoverAmount: countedNum,
          notes: `Gezählt: ${countedNum.toFixed(2)} €, Soll: ${targetCash.toFixed(2)} €, Diff: ${discrepancy.toFixed(2)} €`,
        }),
      });

      if (!res.ok) {
        throw new Error('Fehler bei der Schichtabrechnung');
      }

      setSettledData({
        waiterName,
        targetCash,
        countedNum,
        discrepancy,
        tips: stats.tips,
        totalGross: stats.totalGross,
        settledAt: new Date().toLocaleTimeString('de-DE'),
      });

      success('Schicht erfolgreich abgerechnet!');
    } catch (err: any) {
      error(err.message || 'Abrechnung fehlgeschlagen');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (settledData) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 flex items-center justify-center">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 text-center shadow-2xl animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10" />
          </div>

          <h1 className="text-2xl font-black mb-1">Schicht beendet</h1>
          <p className="text-slate-400 text-xs mb-6">
            Abrechnungsbeleg für {settledData.waiterName} ({settledData.settledAt})
          </p>

          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3 text-left text-sm mb-6">
            <div className="flex justify-between">
              <span className="text-slate-400">Gesamtumsatz:</span>
              <span className="font-bold">{formatCurrency(settledData.totalGross)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Soll-Barkasse:</span>
              <span className="font-bold">{formatCurrency(settledData.targetCash)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Gezählte Barabgabe:</span>
              <span className="font-bold text-white">{formatCurrency(settledData.countedNum)}</span>
            </div>
            <div className="border-t border-slate-800 pt-2 flex justify-between">
              <span className="text-slate-400">Kassendifferenz:</span>
              <span
                className={`font-black ${
                  Math.abs(settledData.discrepancy) < 0.05
                    ? 'text-emerald-400'
                    : settledData.discrepancy > 0
                    ? 'text-blue-400'
                    : 'text-rose-400'
                }`}
              >
                {settledData.discrepancy >= 0 ? '+' : ''}
                {formatCurrency(settledData.discrepancy)}
              </span>
            </div>
            <div className="border-t border-slate-800 pt-2 flex justify-between text-amber-300">
              <span className="font-bold">Erhaltenes Trinkgeld:</span>
              <span className="font-black">{formatCurrency(settledData.tips)}</span>
            </div>
          </div>

          <button
            onClick={() => {
              localStorage.removeItem('pos_waiter_name');
              router.push('/waiter');
            }}
            className="w-full min-h-[52px] py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition text-base active:scale-95 touch-manipulation shadow-lg shadow-blue-900/30"
          >
            Zurück zur Kellner-Anmeldung
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 flex flex-col items-center">
      <div className="max-w-xl w-full">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.back()}
            className="min-h-[48px] px-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex items-center gap-2 text-sm font-bold active:scale-95 touch-manipulation"
          >
            <ArrowLeft className="w-5 h-5" />
            Zurück
          </button>
          <div className="text-right">
            <h1 className="text-xl font-black flex items-center gap-2 justify-end">
              <Wallet className="w-6 h-6 text-amber-400" />
              Schichtabrechnung
            </h1>
            <p className="text-xs text-slate-400">{waiterName || 'Kein Kellner angemeldet'}</p>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="text-xs text-slate-400 font-bold mb-1">Soll-Barkasse</div>
            <div className="text-2xl font-black text-amber-400 font-mono">
              {formatCurrency(targetCash)}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="text-xs text-slate-400 font-bold mb-1">Gesamtumsatz</div>
            <div className="text-2xl font-black text-white font-mono">
              {formatCurrency(stats.totalGross)}
            </div>
          </div>
        </div>

        {/* Counted Input Display */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6 shadow-xl">
          <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
            Gezähltes Bargeld eingeben
          </label>
          <div className="flex items-center justify-between bg-slate-950 p-4 rounded-2xl border border-slate-700 mb-4">
            <span className="text-3xl font-black font-mono text-emerald-400">
              {countedCash ? `${countedCash} €` : '0,00 €'}
            </span>
            {countedCash && (
              <button
                onClick={() => setCountedCash('')}
                className="p-2 text-xs font-bold text-slate-400 hover:text-white"
              >
                Löschen
              </button>
            )}
          </div>

          {/* Discrepancy Live Display */}
          {countedCash && (
            <div
              className={`p-3 rounded-xl border flex items-center justify-between text-sm font-bold ${
                Math.abs(discrepancy) < 0.05
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : discrepancy > 0
                  ? 'bg-blue-950/40 border-blue-800 text-blue-300'
                  : 'bg-rose-950/40 border-rose-800 text-rose-300'
              }`}
            >
              <span>Differenz (Ist - Soll):</span>
              <span className="font-mono text-base">
                {discrepancy >= 0 ? '+' : ''}
                {formatCurrency(discrepancy)}
              </span>
            </div>
          )}
        </div>

        {/* Touch Keypad (min 52px high) */}
        <div className="grid grid-cols-3 gap-2.5 mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'DEL'].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => handleKeypadPress(k)}
              className="min-h-[58px] rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800 active:bg-blue-600 text-xl font-bold font-mono text-white transition active:scale-95 touch-manipulation flex items-center justify-center shadow"
            >
              {k === 'DEL' ? <Delete className="w-6 h-6" /> : k}
            </button>
          ))}
        </div>

        {/* Submit Button */}
        <button
          type="button"
          disabled={isSubmitting || !countedCash}
          onClick={handleSettle}
          className="w-full min-h-[56px] py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-lg transition active:scale-95 touch-manipulation shadow-xl shadow-emerald-950/40 flex items-center justify-center gap-2"
        >
          <Receipt className="w-5 h-5" />
          {isSubmitting ? 'Wird abgerechnet...' : 'Schicht abrechnen & abmelden'}
        </button>
      </div>
    </div>
  );
}
