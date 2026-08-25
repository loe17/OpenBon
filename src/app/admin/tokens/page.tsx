'use client';

import React, { useState, useEffect } from 'react';
import {
  Ticket,
  Plus,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

interface TokenTransaction {
  id: string;
  tokenType: string;
  action: 'ISSUE' | 'REDEEM' | 'RETURN';
  quantity: number;
  unitValue: number;
  totalValue: number;
  waiterName: string;
  createdAt: string;
}

import { useToast } from '@/components/ui/toast';

export default function AdminTokensPage() {
  const { success, error } = useToast();
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [totals, setTotals] = useState({
    totalIssuedQty: 0,
    totalIssuedValue: 0,
    totalRedeemedQty: 0,
    totalRedeemedValue: 0,
    totalReturnedQty: 0,
    totalReturnedValue: 0,
  });

  const [action, setAction] = useState<'ISSUE' | 'REDEEM' | 'RETURN'>('ISSUE');
  const [tokenType, setTokenType] = useState('DRINK');
  const [quantity, setQuantity] = useState(10);
  const [unitValue, setUnitValue] = useState(4.5);
  const [waiterName, setWaiterName] = useState('Hauptkasse');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const res = await fetch('/api/tokens');
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
        if (data.totals) setTotals(data.totals);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Wertmarken:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenType,
          action,
          quantity,
          unitValue,
          waiterName,
        }),
      });
      if (res.ok) {
        success('Wertmarken-Buchung erfolgreich erfasst!');
        loadData();
      } else {
        error('Fehler beim Erfassen der Wertmarken-Buchung');
      }
    } catch (err) {
      error('Netzwerkfehler beim Speichern');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-3" />
        <p>Wertmarken-Dashboard wird geladen...</p>
      </div>
    );
  }

  const openCirculationValue = totals.totalIssuedValue - totals.totalRedeemedValue - totals.totalReturnedValue;
  const openCirculationQty = totals.totalIssuedQty - totals.totalRedeemedQty - totals.totalReturnedQty;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <Ticket className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              Wertmarken- & Token-System
            </h1>
          </div>
          <p className="text-sm text-slate-400">
            Verwaltung von Verzehrbons, Getränkemarken und Pfandmarken mit digitaler Gegenbuchung.
          </p>
        </div>

        {/* KPI Kacheln */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">
              Ausgegeben (Verkauf)
            </span>
            <div className="text-2xl font-mono font-black text-emerald-400">
              {totals.totalIssuedValue.toFixed(2)} €
            </div>
            <span className="text-xs text-slate-500 font-mono mt-1 block">
              {totals.totalIssuedQty} Stück
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">
              Eingelöst (Theke/Küche)
            </span>
            <div className="text-2xl font-mono font-black text-blue-400">
              {totals.totalRedeemedValue.toFixed(2)} €
            </div>
            <span className="text-xs text-slate-500 font-mono mt-1 block">
              {totals.totalRedeemedQty} Stück
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">
              Rückkauf (Rückgabe)
            </span>
            <div className="text-2xl font-mono font-black text-amber-400">
              {totals.totalReturnedValue.toFixed(2)} €
            </div>
            <span className="text-xs text-slate-500 font-mono mt-1 block">
              {totals.totalReturnedQty} Stück
            </span>
          </div>

          <div className="bg-slate-900 border border-emerald-500/30 p-5 rounded-3xl bg-emerald-950/10">
            <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider block mb-1">
              Aktuell im Umlauf (Saldo)
            </span>
            <div className="text-2xl font-mono font-black text-white">
              {openCirculationValue.toFixed(2)} €
            </div>
            <span className="text-xs text-emerald-400/70 font-mono mt-1 block">
              {openCirculationQty} Stück offen
            </span>
          </div>
        </div>

        {/* Schnellerfassungs-Formular */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-400" /> Wertmarken-Buchung erfassen
          </h2>

          <form onSubmit={handleTransaction} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">Vorgang:</label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="ISSUE">Ausgabe / Verkauf</option>
                <option value="REDEEM">Einlösung (Abgabe)</option>
                <option value="RETURN">Rückkauf / Erstattung</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">Marken-Kategorie:</label>
              <select
                value={tokenType}
                onChange={(e) => setTokenType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="DRINK">Getränkemarke</option>
                <option value="FOOD">Essensmarke</option>
                <option value="DEPOSIT">Pfandtoken</option>
                <option value="GENERAL">Wertgutschein (Allg.)</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">Anzahl (Stk):</label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">Stückwert (€):</label>
              <input
                type="number"
                step="0.10"
                min="0.10"
                required
                value={unitValue}
                onChange={(e) => setUnitValue(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg transition-all"
              >
                {isSubmitting ? 'Buchen...' : `Verbuchen (${(quantity * unitValue).toFixed(2)} €)`}
              </button>
            </div>
          </form>
        </div>

        {/* Transaktions-Journal */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h2 className="text-lg font-bold text-white">Letzte Wertmarken-Transaktionen</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold text-xs uppercase tracking-wider">
                  <th className="pb-3">Zeitpunkt</th>
                  <th className="pb-3">Vorgang</th>
                  <th className="pb-3">Kategorie</th>
                  <th className="pb-3">Menge</th>
                  <th className="pb-3">Stückpreis</th>
                  <th className="pb-3">Gesamtwert</th>
                  <th className="pb-3 text-right">Bediener</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {transactions.map((t) => {
                  const dateStr = new Date(t.createdAt).toLocaleTimeString('de-DE');
                  return (
                    <tr key={t.id} className="hover:bg-slate-850/50">
                      <td className="py-2.5 text-slate-400">{dateStr}</td>
                      <td className="py-2.5 font-sans font-bold">
                        {t.action === 'ISSUE' && (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <ArrowUpRight className="w-3.5 h-3.5" /> Ausgabe
                          </span>
                        )}
                        {t.action === 'REDEEM' && (
                          <span className="text-blue-400 flex items-center gap-1">
                            <ArrowDownLeft className="w-3.5 h-3.5" /> Einlösung
                          </span>
                        )}
                        {t.action === 'RETURN' && (
                          <span className="text-amber-400 flex items-center gap-1">
                            <RotateCcw className="w-3.5 h-3.5" /> Rückkauf
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-slate-300">{t.tokenType}</td>
                      <td className="py-2.5 text-white font-bold">{t.quantity} Stk</td>
                      <td className="py-2.5 text-slate-400">{t.unitValue.toFixed(2)} €</td>
                      <td className="py-2.5 text-emerald-400 font-black text-sm">
                        {t.totalValue.toFixed(2)} €
                      </td>
                      <td className="py-2.5 text-slate-400 text-right font-sans">{t.waiterName}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
