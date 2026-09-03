'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { formatCents, formatCurrency } from '@/lib/utils';
import {
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  FileBarChart,
  Lock,
} from 'lucide-react';
import type { CashMovementDTO } from '@/types/domain';

/**
 * Spec 6.8: Kassenbuch & Geldbewegungen (Wechselgeld-Vorschuss und Entnahmen).
 */

interface CashbookState {
  periodNumber: number | null;
  movements: CashMovementDTO[];
  cashIn: number;
  cashOut: number;
  balance: number;
}

interface XBonSummary {
  totalCash: number;
  cashExpected: number;
  totalGross: number;
  totalCard: number;
  totalTips: number;
  transactionCount: number;
}

const QUICK_REASONS_IN = ['Wechselgeld-Vorschuss', 'Nachschub Münzgeld', 'Rückführung Tresor'];
const QUICK_REASONS_OUT = ['Abgabe an Tresor', 'Zwischenabschöpfung', 'Auslage Einkauf'];

export default function CashbookPage() {
  const [data, setData] = useState<CashbookState | null>(null);
  const [summary, setSummary] = useState<XBonSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [type, setType] = useState<'CASH_IN' | 'CASH_OUT'>('CASH_IN');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState(QUICK_REASONS_IN[0]);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [refundId, setRefundId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundBusy, setRefundBusy] = useState(false);
  const [archiveQ, setArchiveQ] = useState('');
  const [archiveItems, setArchiveItems] = useState<Array<{ id: string; invoiceNumber: string; totalGrossCents?: number; paymentMethod: string; createdAt: string }> | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [cashRes, xbonRes] = await Promise.all([
        fetch('/api/cash-movements'),
        fetch('/api/reports/x-bon'),
      ]);
      setData((await cashRes.json()) as CashbookState);
      setSummary((await xbonRes.json()) as XBonSummary);
    } catch {
      setToast({ kind: 'err', text: 'Kassenbuch konnte nicht geladen werden.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const showToast = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 4000);
  };

  const submit = async () => {
    const value = Number(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      showToast('err', 'Bitte einen Betrag größer als 0 eingeben.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/cash-movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          amount: value,
          reason,
          pin,
          waiterName: localStorage.getItem('pos_waiter_name') || 'Kasse',
          deviceId: localStorage.getItem('pos_device_id'),
          printReceipt: true,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (res.ok) {
        showToast('ok', 'Geldbewegung erfasst und quittiert.');
        setAmount('');
        setPin('');
        void load();
      } else {
        showToast('err', body.error || 'Buchung fehlgeschlagen.');
      }
    } catch {
      showToast('err', 'Verbindungsfehler.');
    } finally {
      setBusy(false);
    }
  };

  const quickReasons = type === 'CASH_IN' ? QUICK_REASONS_IN : QUICK_REASONS_OUT;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 text-slate-100 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-800">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Kassenbuch</h1>
            <p className="text-sm text-slate-400 font-semibold">
              Wechselgeld-Einlagen und Entnahmen{' '}
              {data?.periodNumber ? `· Kassenperiode #${data.periodNumber}` : ''}
            </p>
          </div>
        </div>

        {/* Kennzahlen */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Einlagen', value: data?.cashIn ?? 0, color: '#10B981' },
            { label: 'Entnahmen', value: data?.cashOut ?? 0, color: '#EF4444' },
            { label: 'Bareinnahmen', value: summary?.totalCash ?? 0, color: '#3B82F6' },
            { label: 'Bar-Soll in Kasse', value: summary?.cashExpected ?? 0, color: '#F59E0B' },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="p-4 rounded-3xl bg-slate-900 border border-slate-800"
              style={{ borderLeftColor: kpi.color, borderLeftWidth: '5px' }}
            >
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                {kpi.label}
              </div>
              <div className="font-mono font-black text-2xl mt-1" style={{ color: kpi.color }}>
                {formatCents((kpi as any).valueCents ?? Math.round(((kpi as any).value ?? 0) * 100))}
              </div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          {/* Erfassung */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <h2 className="font-black text-lg text-white">Geldbewegung erfassen</h2>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setType('CASH_IN');
                  setReason(QUICK_REASONS_IN[0]);
                }}
                className={`touch-target rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border transition ${
                  type === 'CASH_IN'
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                <ArrowDownCircle className="w-5 h-5" />
                <span>Einlage</span>
              </button>
              <button
                onClick={() => {
                  setType('CASH_OUT');
                  setReason(QUICK_REASONS_OUT[0]);
                }}
                className={`touch-target rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border transition ${
                  type === 'CASH_OUT'
                    ? 'bg-rose-600 text-white border-rose-500'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                <ArrowUpCircle className="w-5 h-5" />
                <span>Entnahme</span>
              </button>
            </div>

            <div>
              <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">
                Betrag
              </label>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3.5 text-2xl font-mono font-black text-white text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="grid grid-cols-4 gap-2 mt-2">
                {[50, 100, 200, 500].map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmount(String(v))}
                    className="touch-target rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 font-mono font-bold text-sm"
                  >
                    {v} €
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">
                Grund
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {quickReasons.map((r) => (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                      reason === r
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>Admin- oder Kassen-PIN</span>
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-lg font-mono font-bold text-white tracking-[0.4em] text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={() => void submit()}
              disabled={busy || !amount || !pin || !reason.trim()}
              className={`w-full h-14 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition ${
                type === 'CASH_IN' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
              } disabled:bg-slate-800 disabled:text-slate-500`}
            >
              {busy ? <RefreshCw className="w-5 h-5 animate-spin" /> : <FileBarChart className="w-5 h-5" />}
              <span>Buchen &amp; Quittung drucken</span>
            </button>
          </div>

          {/* Verlauf */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800">
            <h2 className="font-black text-lg text-white mb-3">Bewegungen dieser Periode</h2>
            {loading ? (
              <div className="py-10 flex items-center justify-center text-slate-400 gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span className="text-sm font-semibold">Lade...</span>
              </div>
            ) : !data || data.movements.length === 0 ? (
              <p className="text-sm text-slate-500 font-semibold py-10 text-center">
                Noch keine Geldbewegungen erfasst.
              </p>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {data.movements.map((m) => (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {m.type === 'CASH_IN' ? (
                        <ArrowDownCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                      ) : (
                        <ArrowUpCircle className="w-5 h-5 text-rose-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-white truncate">{m.reason}</div>
                        <div className="text-[11px] text-slate-400 font-semibold">
                          {m.waiterName} · {new Date(m.createdAt).toLocaleString('de-DE')}
                          {m.isTraining ? ' · Übung' : ''}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`font-mono font-black text-base shrink-0 ${
                        m.type === 'CASH_IN' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {m.type === 'CASH_IN' ? '+' : '−'}
                      {formatCents((m as any).amountCents ?? Math.round(((m as any).amount ?? 0) * 100))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800">
          <h3 className="font-black text-white text-base">Bar-Erstattung (nur bar, ADMIN)</h3>
          <p className="text-xs text-slate-400 mt-1">Erstellt eine Gegenbuchung (CASH_REFUND). Karten → bitte Terminal-Rückbuchung separat.</p>
          <input value={refundId} onChange={(e) => setRefundId(e.target.value)} placeholder="Zahlungs-ID (aus Bericht kopieren)" aria-label="Zahlungs-ID für Erstattung" className="mt-3 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white min-h-[48px]" />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder="Betrag € (leer = voll)" inputMode="decimal" aria-label="Erstattungsbetrag" className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white min-h-[48px]" />
            <input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="Grund (Pflicht)" aria-label="Erstattungsgrund" className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white min-h-[48px]" />
          </div>
          <button
            disabled={refundBusy || !refundId.trim() || !refundReason.trim()}
            onClick={async () => {
              setRefundBusy(true);
              try {
                const body: Record<string, unknown> = { reason: refundReason.trim() };
                if (refundAmount.trim()) body.amount = Number(refundAmount.replace(',', '.'));
                const res = await fetch(`/api/payments/${refundId.trim()}/refund`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                const j = await res.json();
                if (!res.ok) throw new Error(j.error || 'Fehlgeschlagen');
                setToast({ kind: 'ok', text: `Erstattet: ${j.refund.invoiceNumber}` });
                setRefundId(''); setRefundAmount(''); setRefundReason('');
              } catch (e) {
                setToast({ kind: 'err', text: e instanceof Error ? e.message : 'Fehler' });
              } finally {
                setRefundBusy(false);
              }
            }}
            className="mt-3 w-full py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-extrabold rounded-2xl min-h-[48px]"
          >
            {refundBusy ? 'Wird erstattet …' : 'Bar erstatten'}
          </button>
        </div>
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800">
          <h3 className="font-black text-white text-base">Belegarchiv (Suche + Neudruck)</h3>
          <div className="mt-3 flex gap-2">
            <input value={archiveQ} onChange={(e) => setArchiveQ(e.target.value)} placeholder="Rechnung / E-Bon-Code" aria-label="Belegarchiv suchen" className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white min-h-[48px]" />
            <button
              disabled={archiveBusy}
              onClick={async () => {
                setArchiveBusy(true);
                try {
                  const res = await fetch(`/api/receipt/archive?q=${encodeURIComponent(archiveQ.trim())}&take=20`);
                  const j = await res.json();
                  if (!res.ok) throw new Error(j.error || 'Fehlgeschlagen');
                  setArchiveItems(j.payments || []);
                } catch (e) {
                  setToast({ kind: 'err', text: e instanceof Error ? e.message : 'Fehler' });
                } finally {
                  setArchiveBusy(false);
                }
              }}
              className="px-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl min-h-[48px]"
            >
              Suchen
            </button>
          </div>
          {archiveItems && (
            <div className="mt-3 space-y-2 max-h-[260px] overflow-y-auto">
              {archiveItems.map((p) => (
                <div key={p.id} className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-white truncate">{p.invoiceNumber}</div>
                    <div className="text-[11px] text-slate-400">{formatCents(p.totalGrossCents ?? 0)} · {p.paymentMethod} · {new Date(p.createdAt).toLocaleString('de-DE')}</div>
                  </div>
                  <button
                    onClick={async () => {
                      const reason = window.prompt('Grund für Neudruck (wird protokolliert):') || '';
                      if (!reason.trim()) return;
                      const res = await fetch('/api/receipt/archive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentId: p.id, reason: reason.trim() }) });
                      const j = await res.json();
                      setToast(res.ok ? { kind: 'ok', text: `Neudruck protokolliert: ${p.invoiceNumber}` } : { kind: 'err', text: j.error || 'Fehlgeschlagen' });
                    }}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl min-h-[48px]"
                  >
                    Neudruck
                  </button>
                </div>
              ))}
              {archiveItems.length === 0 && <div className="text-xs text-slate-500">Keine Belege gefunden.</div>}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div
          className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl border shadow-2xl font-bold text-sm flex items-center gap-2 ${
            toast.kind === 'ok'
              ? 'bg-emerald-950 border-emerald-700 text-emerald-200'
              : 'bg-rose-950 border-rose-700 text-rose-200'
          }`}
        >
          {toast.kind === 'ok' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}
