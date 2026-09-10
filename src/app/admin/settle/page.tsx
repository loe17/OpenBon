'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Wallet,
  Users,
  Coins,
  Calculator,
  FileText,
  ArrowLeft,
  ArrowRight,
  Check,
  RefreshCw,
  Printer,
  AlertTriangle,
  CheckCircle2,
  User,
  ShieldAlert,
  ShoppingBag,
  ListOrdered,
  Search,
} from 'lucide-react';
import { formatCents } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { triggerHapticFeedback } from '@/lib/socket-client';
import { useSocket } from '@/components/providers/socket-provider';
import PinModal from '@/components/auth/pin-modal';

/**
 * Schichtabrechnung als gefuehrter Ablauf - ausschliesslich in der Administration.
 *
 * Die Abrechnung entscheidet ueber Bargeldabgabe und Trinkgeldverteilung; eine
 * Bedienung darf ihre eigene Schicht nicht abrechnen. Der frueher unter
 * /waiter/settle erreichbare Einseiter zeigte alle Angaben gleichzeitig; hier
 * fuehrt der Ablauf in fuenf klar getrennten Schritten durch den Kassensturz,
 * damit beim Zaehlen nichts uebersprungen wird.
 *
 * Alle Zahlen stammen aus /api/waiters/settle/report. Die Oberflaeche rechnet
 * bewusst NICHT selbst - so koennen Bildschirm, Bon und PDF nicht auseinanderlaufen.
 */

export interface SettlementItemSold {
  name: string;
  quantity: number;
  amountCents: number;
}

export interface SettlementOrderSummary {
  id: string;
  orderNumber: number;
  time: string;
  tableName: string;
  totalCents: number;
  itemsCount: number;
  itemsSummary: string;
}

interface SettlementReport {
  waiterName: string;
  periodNumber: number;
  periodOpenedAt: string;
  generatedAt: string;
  totalGross?: number;
  totalGrossCents?: number;
  transactionCount: number;
  byMethod: { method: string; label: string; amount?: number; amountCents?: number; count: number }[];
  cashGross?: number;
  cashGrossCents?: number;
  cashExpected?: number;
  cashExpectedCents?: number;
  tipsTotal?: number;
  tipsTotalCents?: number;
  tipWaiterShare?: number;
  tipWaiterShareCents?: number;
  tipPoolShare?: number;
  tipPoolShareCents?: number;
  tipProfileName: string | null;
  isTraining: boolean;
  eventName: string;
  orderCount?: number;
  itemsSold?: SettlementItemSold[];
  orders?: SettlementOrderSummary[];
}

type Step = 1 | 2 | 3 | 4 | 5;

const STEPS: { id: Step; label: string; icon: typeof Users }[] = [
  { id: 1, label: 'Bedienung', icon: Users },
  { id: 2, label: 'Umsätze', icon: Coins },
  { id: 3, label: 'Zählen', icon: Calculator },
  { id: 4, label: 'Bestätigen', icon: Check },
  { id: 5, label: 'Beleg', icon: FileText },
];

const money = (v?: number, centsMaybe?: number) => {
  if (typeof centsMaybe === 'number') return formatCents(centsMaybe);
  if (typeof v === 'number') return formatCents(Math.round(v * 100));
  return '0,00 €';
};

function AdminSettleContent() {
  const params = useSearchParams();
  const { success, error: toastError, warning } = useToast();

  const [step, setStep] = useState<Step>(1);
  const [waiters, setWaiters] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [report, setReport] = useState<SettlementReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [counted, setCounted] = useState('0');
  const [notes, setNotes] = useState('');
  const [printerId, setPrinterId] = useState<string>('');
  const [printers, setPrinters] = useState<{ id: string; name: string; isActive?: boolean }[]>([]);
  const [settleTemplate, setSettleTemplate] = useState<'OFFICIAL_A4' | 'RECEIPT_SLIP' | 'DASHBOARD_SUMMARY'>('OFFICIAL_A4');
  const [rawWaiters, setRawWaiters] = useState<{ name: string; waiterNumber?: number | null; isSettled?: boolean; lastSettledAt?: string | null }[]>([]);
  const [filterMode, setFilterMode] = useState<'ALL' | 'OPEN' | 'SETTLED'>('ALL');
  const [done, setDone] = useState(false);

  // Neu: Abrechnungskorrektur mit Admin-PIN & Detail-Reiter
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingWaiter, setPendingWaiter] = useState<string | null>(null);
  const [isCorrection, setIsCorrection] = useState(false);
  const [printDetails, setPrintDetails] = useState(true);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ARTICLES' | 'ORDERS'>('OVERVIEW');
  const [articleSearch, setArticleSearch] = useState('');

  const { socket } = useSocket();

  const loadWaitersList = useCallback(async () => {
    try {
      const [wRes, pRes] = await Promise.all([fetch('/api/waiters'), fetch('/api/printers')]);
      const names = new Set<string>();
      const rawList: { name: string; waiterNumber?: number | null; isSettled?: boolean; lastSettledAt?: string | null }[] = [];
      if (wRes.ok) {
        const data = await wRes.json();
        if (Array.isArray(data)) {
          data.forEach((w: { name?: string; waiterNumber?: number | null; isSettled?: boolean; lastSettledAt?: string | null }) => {
            if (w.name) {
              names.add(w.name);
              rawList.push({ name: w.name, waiterNumber: w.waiterNumber, isSettled: w.isSettled, lastSettledAt: w.lastSettledAt });
            }
          });
        }
      }
      setWaiters(Array.from(names).sort((a, b) => a.localeCompare(b, 'de')));
      setRawWaiters(rawList);

      if (pRes.ok) {
        const pData = await pRes.json();
        if (Array.isArray(pData)) {
          setPrinters(pData);
          const active = pData.find((p: { isActive?: boolean }) => p.isActive);
          if (active) setPrinterId(active.id);
        }
      }
    } catch {
      toastError('Bedienungen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    loadWaitersList();
    const interval = setInterval(loadWaitersList, 10000);
    return () => clearInterval(interval);
  }, [loadWaitersList]);

  useEffect(() => {
    if (socket) {
      socket.on('waiters:settled', loadWaitersList);
      socket.on('waiter:settled', loadWaitersList);
      return () => {
        socket.off('waiters:settled');
        socket.off('waiter:settled');
      };
    }
  }, [socket, loadWaitersList]);

  // Aus /admin/tips wird die Bedienung per Verweis uebergeben - dann direkt
  // zum zweiten Schritt springen statt erneut auswaehlen zu lassen.
  const prefill = params.get('waiterName');
  useEffect(() => {
    if (!prefill || loading || report) return;
    setSelected(prefill);
    void (async () => {
      const res = await fetch(`/api/waiters/settle/report?waiterName=${encodeURIComponent(prefill)}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      setReport((await res.json()) as SettlementReport);
      setStep(2);
    })();
  }, [prefill, loading, report]);

  const loadReport = useCallback(
    async (name: string) => {
      setBusy(true);
      try {
        const res = await fetch(`/api/waiters/settle/report?waiterName=${encodeURIComponent(name)}`, {
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok) {
          toastError(data.error || 'Abrechnung konnte nicht berechnet werden.');
          return false;
        }
        setReport(data as SettlementReport);
        return true;
      } catch {
        toastError('Netzwerkfehler beim Berechnen der Abrechnung.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [toastError]
  );

  /* ------------------------------------------------------- PIN & Korrektur-Handling */

  const handleSelectWaiter = (name: string) => {
    triggerHapticFeedback();
    const info = rawWaiters.find((r) => r.name === name);
    if (info?.isSettled) {
      setPendingWaiter(name);
      setShowPinModal(true);
    } else {
      setSelected(name);
      setIsCorrection(false);
    }
  };

  const handleProceedToStep2 = async () => {
    if (!selected) return;
    const info = rawWaiters.find((r) => r.name === selected);
    if (info?.isSettled && !isCorrection) {
      setPendingWaiter(selected);
      setShowPinModal(true);
      return;
    }
    if (await loadReport(selected)) setStep(2);
  };

  const handlePinSuccess = async () => {
    setShowPinModal(false);
    const target = pendingWaiter || selected;
    if (!target) return;
    setSelected(target);
    setIsCorrection(true);
    setPendingWaiter(null);
    const ok = await loadReport(target);
    if (ok) setStep(2);
  };

  /* ------------------------------------------------------- Abschluss */

  const countedNum = parseFloat(counted.replace(',', '.'));
  const countedValid = Number.isFinite(countedNum) && countedNum >= 0;
  const expectedNum = report ? (report.cashExpected ?? (report.cashExpectedCents !== undefined ? report.cashExpectedCents / 100 : 0)) : 0;
  const difference = report && countedValid ? Math.round((countedNum - expectedNum) * 100) / 100 : 0;
  const differenceOk = Math.abs(difference) < 0.05;

  const finish = async (withPrint: boolean) => {
    if (!report || !countedValid) return;
    setBusy(true);
    triggerHapticFeedback();
    try {
      const res = await fetch('/api/waiters/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waiterName: report.waiterName,
          totalGross: report.totalGross ?? (report.totalGrossCents !== undefined ? report.totalGrossCents / 100 : 0),
          totalGrossCents: report.totalGrossCents ?? Math.round(((report.totalGross ?? 0)) * 100),
          cashGross: report.cashGross ?? (report.cashGrossCents !== undefined ? report.cashGrossCents / 100 : 0),
          cashGrossCents: report.cashGrossCents ?? Math.round(((report.cashGross ?? 0)) * 100),
          cashExpected: report.cashExpected ?? (report.cashExpectedCents !== undefined ? report.cashExpectedCents / 100 : 0),
          cashExpectedCents: report.cashExpectedCents ?? Math.round(((report.cashExpected ?? 0)) * 100),
          cashCounted: countedNum,
          cashCountedCents: Math.round(countedNum * 100),
          tips: report.tipsTotal ?? (report.tipsTotalCents !== undefined ? report.tipsTotalCents / 100 : 0),
          tipsTotalCents: report.tipsTotalCents ?? Math.round(((report.tipsTotal ?? 0)) * 100),
          tipWaiterShare: report.tipWaiterShare ?? (report.tipWaiterShareCents !== undefined ? report.tipWaiterShareCents / 100 : 0),
          tipWaiterShareCents: report.tipWaiterShareCents ?? Math.round(((report.tipWaiterShare ?? 0)) * 100),
          tipPoolShare: report.tipPoolShare ?? (report.tipPoolShareCents !== undefined ? report.tipPoolShareCents / 100 : 0),
          tipPoolShareCents: report.tipPoolShareCents ?? Math.round(((report.tipPoolShare ?? 0)) * 100),
          tipProfileName: report.tipProfileName,
          byMethod: report.byMethod,
          transactionCount: report.transactionCount,
          handoverAmount: countedNum,
          notes,
          printReceipt: withPrint,
          printerId: withPrint ? printerId || undefined : undefined,
          isCorrection,
          printDetails,
          itemsSold: report.itemsSold,
          orders: report.orders,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError(data.error || 'Abrechnung konnte nicht abgeschlossen werden.');
        return;
      }
      setDone(true);
      setStep(5);
      loadWaitersList();
      if (withPrint && data.printed) {
        success(isCorrection ? 'Abrechnungskorrektur abgeschlossen, Beleg wurde gedruckt.' : 'Abrechnung abgeschlossen, Beleg wurde gedruckt.');
      } else if (withPrint) {
        warning(`Abrechnung abgeschlossen. Beleg NICHT gedruckt: ${data.printError || 'unbekannter Grund'}`);
      } else {
        success(isCorrection ? 'Abrechnungskorrektur abgeschlossen.' : 'Abrechnung abgeschlossen.');
      }
    } catch {
      toastError('Netzwerkfehler beim Abschließen der Abrechnung.');
    } finally {
      setBusy(false);
    }
  };

  /* -------------------------------------------------------- Rendering */

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px] text-slate-400 gap-2">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
        <span>Lade Bedienungen …</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 text-white p-3 sm:p-6 max-w-3xl mx-auto w-full space-y-6 print:bg-white print:text-black print:max-w-none">
      {/* Kopf */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4 print:hidden">
        <div className="bg-amber-600 text-white p-2.5 rounded-2xl shadow">
          <Wallet className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black">Schichtabrechnung</h1>
          <p className="text-xs text-slate-400">
            Kassensturz und Trinkgeldverteilung – Schritt für Schritt
          </p>
        </div>
      </div>

      {/* Fortschritt */}
      <div className="flex items-center gap-1 print:hidden">
        {STEPS.map((s, idx) => {
          const Icon = s.icon;
          const state = step === s.id ? 'active' : step > s.id ? 'done' : 'todo';
          return (
            <React.Fragment key={s.id}>
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition ${
                    state === 'active'
                      ? 'bg-blue-600 border-blue-400 text-white shadow-lg'
                      : state === 'done'
                      ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-600'
                  }`}
                >
                  {state === 'done' ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <span
                  className={`text-[10px] font-bold ${
                    state === 'todo' ? 'text-slate-600' : 'text-slate-300'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 rounded ${step > s.id ? 'bg-emerald-700' : 'bg-slate-800'}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ============================================ Schritt 1: Bedienung */}
      {step === 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <h2 className="font-bold text-lg">Wen rechnen Sie ab?</h2>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                className={`px-3 py-1 rounded-lg transition ${
                  filterMode === 'ALL' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Alle ({waiters.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('OPEN')}
                className={`px-3 py-1 rounded-lg transition ${
                  filterMode === 'OPEN' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Offen ({rawWaiters.filter((w) => !w.isSettled).length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('SETTLED')}
                className={`px-3 py-1 rounded-lg transition ${
                  filterMode === 'SETTLED' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Bereits abgerechnet ({rawWaiters.filter((w) => w.isSettled).length})
              </button>
            </div>
          </div>

          {(() => {
            const filtered = waiters.filter((name) => {
              const info = rawWaiters.find((r) => r.name === name);
              if (filterMode === 'OPEN') return !info?.isSettled;
              if (filterMode === 'SETTLED') return Boolean(info?.isSettled);
              return true;
            });

            if (filtered.length === 0) {
              return (
                <div className="bg-slate-950 border border-slate-800 text-slate-400 p-6 rounded-2xl text-center text-sm font-bold">
                  Keine Bedienungen für diesen Filter gefunden.
                </div>
              );
            }

            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {filtered.map((name) => {
                  const info = rawWaiters.find((r) => r.name === name);
                  const isSelected = selected === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => handleSelectWaiter(name)}
                      className={`min-h-[64px] p-3 rounded-2xl text-sm font-black border transition active:scale-95 touch-manipulation flex flex-col justify-between items-start text-left ${
                        isSelected
                          ? 'bg-blue-600 border-blue-400 text-white shadow-lg'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <User className="w-4 h-4 shrink-0 opacity-70" />
                        <span className="truncate flex-1">
                          {name}
                          {info?.waiterNumber ? (
                            <span className="ml-1 text-xs font-mono font-normal opacity-75">
                              #{info.waiterNumber}
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <div className="text-[10px] font-semibold mt-1">
                        {info?.isSettled ? (
                          <span className={isSelected ? 'text-emerald-200' : 'text-emerald-400'}>
                            ✓ Bereits abgerechnet (PIN für Korrektur)
                          </span>
                        ) : (
                          <span className={isSelected ? 'text-amber-200' : 'text-amber-400'}>
                            ● Schicht aktiv / Offen
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          <button
            type="button"
            disabled={!selected || busy}
            onClick={handleProceedToStep2}
            className="w-full min-h-[52px] rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 font-black text-sm flex items-center justify-center gap-2 transition active:scale-95 shadow"
          >
            {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {isCorrection ? 'Abrechnungskorrektur starten' : 'Umsätze anzeigen'}
          </button>
        </div>
      )}

      {/* ============================================== Schritt 2: Umsätze */}
      {step === 2 && report && (
        <div className="space-y-4 print:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
            {isCorrection && (
              <div className="flex items-center gap-2.5 bg-amber-950/40 border border-amber-800/60 text-amber-200 rounded-2xl p-3.5 shadow-sm">
                <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400" />
                <div className="text-xs">
                  <span className="font-black text-amber-300">Abrechnungskorrektur aktiv:</span> Diese Bedienung wurde bereits abgerechnet. Der Abschluss wird als Korrektur im System und auf dem Beleg dokumentiert.
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h2 className="font-bold text-lg">
                  Umsätze von {report.waiterName}
                </h2>
                <span className="text-xs text-slate-400">
                  Kassenperiode {report.periodNumber} · seit{' '}
                  {new Date(report.periodOpenedAt).toLocaleString('de-DE')}
                </span>
              </div>
            </div>

            {/* 4 KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="text-[11px] text-slate-400 font-bold mb-1">Gesamtumsatz</div>
                <div className="text-xl font-black font-mono text-emerald-400">{money(report.totalGross)}</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="text-[11px] text-slate-400 font-bold mb-1">Zahlungen</div>
                <div className="text-xl font-black font-mono">{report.transactionCount}</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="text-[11px] text-slate-400 font-bold mb-1">Bestellungen</div>
                <div className="text-xl font-black font-mono text-sky-400">{report.orderCount ?? 0}</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="text-[11px] text-slate-400 font-bold mb-1">Verkaufte Artikel</div>
                <div className="text-xl font-black font-mono text-amber-400">
                  {(report.itemsSold || []).reduce((acc, it) => acc + it.quantity, 0)} Stk.
                </div>
              </div>
            </div>

            {/* Reiter-Navigation */}
            <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab('OVERVIEW')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeTab === 'OVERVIEW'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white bg-slate-950 border border-slate-800'
                }`}
              >
                Zahlarten &amp; Trinkgeld
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ARTICLES')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'ARTICLES'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white bg-slate-950 border border-slate-800'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                Verkaufte Artikel ({(report.itemsSold || []).length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ORDERS')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'ORDERS'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white bg-slate-950 border border-slate-800'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                Bestellungen ({report.orderCount ?? 0})
              </button>
            </div>

            {/* TAB 1: ZAHLARTEN & TRINKGELD */}
            {activeTab === 'OVERVIEW' && (
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Nach Zahlart
                  </div>
                  {report.byMethod.length === 0 ? (
                    <p className="text-sm text-slate-500">Keine Buchungen in dieser Kassenperiode.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {report.byMethod.map((m) => (
                        <div
                          key={m.method}
                          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800"
                        >
                          <span className="text-sm font-bold">
                            {m.label}
                            <span className="text-slate-500 font-normal"> · {m.count}×</span>
                          </span>
                          <span className="font-mono font-bold">{money(m.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Trinkgeld
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-sm font-bold">Gesamt</span>
                      <span className="font-mono font-bold">{money(report.tipsTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-800/60 text-slate-300">
                      <span className="text-xs">davon Bedienung</span>
                      <span className="font-mono text-sm">{money(report.tipWaiterShare)}</span>
                    </div>
                    <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-800/60 text-slate-300">
                      <span className="text-xs">davon Team-Pool</span>
                      <span className="font-mono text-sm">{money(report.tipPoolShare)}</span>
                    </div>
                  </div>
                  {report.tipProfileName ? (
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      Verteilung nach Profil „{report.tipProfileName}“.
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      Kein Trinkgeldprofil hinterlegt – das Trinkgeld bleibt vollständig bei der
                      Bedienung.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: VERKAUFTE ARTIKEL */}
            {activeTab === 'ARTICLES' && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={articleSearch}
                    onChange={(e) => setArticleSearch(e.target.value)}
                    placeholder="Artikel suchen …"
                    className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-blue-500"
                  />
                </div>

                {(!report.itemsSold || report.itemsSold.length === 0) ? (
                  <p className="text-sm text-slate-500 py-4 text-center">Keine verkauften Artikel verzeichnet.</p>
                ) : (
                  <div className="max-h-[350px] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 divide-y divide-slate-800/60">
                    <div className="grid grid-cols-12 px-3.5 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-900/50 sticky top-0">
                      <span className="col-span-7">Artikel</span>
                      <span className="col-span-2 text-center">Menge</span>
                      <span className="col-span-3 text-right">Summe</span>
                    </div>
                    {report.itemsSold
                      .filter((it) => !articleSearch || it.name.toLowerCase().includes(articleSearch.toLowerCase()))
                      .map((it) => (
                        <div key={it.name} className="grid grid-cols-12 px-3.5 py-2.5 text-xs items-center hover:bg-slate-900/40">
                          <span className="col-span-7 font-semibold truncate text-slate-200">{it.name}</span>
                          <span className="col-span-2 text-center font-mono font-bold text-sky-400">{it.quantity}×</span>
                          <span className="col-span-3 text-right font-mono font-bold text-slate-100">{formatCents(it.amountCents)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: BESTELLUNGEN */}
            {activeTab === 'ORDERS' && (
              <div className="space-y-3">
                {(!report.orders || report.orders.length === 0) ? (
                  <p className="text-sm text-slate-500 py-4 text-center">Keine Bestellungen in dieser Kassenperiode.</p>
                ) : (
                  <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1">
                    {report.orders.map((ord) => (
                      <div key={ord.id} className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-blue-400 bg-blue-950/60 border border-blue-900 px-2 py-0.5 rounded-lg">
                              #{ord.orderNumber}
                            </span>
                            <span className="text-slate-400 font-semibold">{ord.time}</span>
                            <span className="font-bold text-slate-300">· {ord.tableName}</span>
                          </div>
                          <span className="font-mono font-black text-emerald-400">{formatCents(ord.totalCents)}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 leading-relaxed pl-1">
                          {ord.itemsSummary}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="min-h-[52px] px-5 rounded-2xl bg-slate-900 border border-slate-800 font-bold text-sm flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Zurück
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex-1 min-h-[52px] rounded-2xl bg-blue-600 hover:bg-blue-500 font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition"
            >
              <ArrowRight className="w-4 h-4" />
              Bargeld zählen
            </button>
          </div>
        </div>
      )}

      {/* =============================================== Schritt 3: Zählen */}
      {step === 3 && report && (
        <div className="space-y-4 print:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h2 className="font-bold text-lg">Bargeld zählen</h2>
            <p className="text-sm text-slate-400">
              Zählen Sie die Bargeldkasse von {report.waiterName} vollständig aus und tragen Sie den
              Betrag ein. Der Soll-Wert wird bewusst erst im nächsten Schritt gezeigt, damit die
              Zählung nicht davon beeinflusst wird.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
                Gezählter Betrag
              </label>
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                value={counted}
                onChange={(e) => setCounted(e.target.value.replace(/[^0-9.,]/g, ''))}
                placeholder="0,00"
                className="w-full min-h-[72px] px-5 bg-slate-950 border-2 border-slate-700 rounded-2xl text-3xl text-white font-mono font-black text-right focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Bemerkung (freiwillig)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="z. B. Wechselgeld nachgelegt, Differenz erklärt"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="min-h-[52px] px-5 rounded-2xl bg-slate-900 border border-slate-800 font-bold text-sm flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Zurück
            </button>
            <button
              type="button"
              disabled={!countedValid}
              onClick={() => setStep(4)}
              className="flex-1 min-h-[52px] rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition"
            >
              <ArrowRight className="w-4 h-4" />
              Differenz anzeigen
            </button>
          </div>
        </div>
      )}

      {/* =========================================== Schritt 4: Bestätigen */}
      {step === 4 && report && (
        <div className="space-y-4 print:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h2 className="font-bold text-lg">Kassensturz bestätigen</h2>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-sm font-bold">Soll-Barbestand</span>
                <span className="font-mono font-bold text-amber-400">{money(report.cashExpected)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-sm font-bold">Gezählt</span>
                <span className="font-mono font-bold">{money(countedNum)}</span>
              </div>
              <div
                className={`flex items-center justify-between px-4 py-4 rounded-2xl border-2 ${
                  differenceOk
                    ? 'bg-emerald-950/40 border-emerald-700 text-emerald-300'
                    : Math.abs(difference) < 5
                    ? 'bg-amber-950/40 border-amber-700 text-amber-300'
                    : 'bg-rose-950/40 border-rose-700 text-rose-300'
                }`}
              >
                <span className="text-sm font-black uppercase tracking-wide">
                  {differenceOk ? 'Kasse stimmt' : difference > 0 ? 'Überschuss' : 'Fehlbetrag'}
                </span>
                <span className="font-mono font-black text-2xl">
                  {difference > 0 ? '+' : ''}
                  {money(difference)}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Der Soll-Barbestand ist der Barumsatz abzüglich des Trinkgeldanteils, den die Bedienung
              behält. Ein Team-Pool-Anteil bleibt in der Kasse und wird gesondert verteilt.
            </p>

            {!differenceOk && Math.abs(difference) >= 5 ? (
              <div className="flex items-start gap-2.5 bg-rose-950/40 border border-rose-800/60 text-rose-200 rounded-2xl p-3.5">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-xs">
                  Die Abweichung ist erheblich. Bitte nachzählen und die Ursache in der Bemerkung
                  festhalten, bevor Sie abschließen – die Abrechnung lässt sich später nicht ändern.
                </p>
              </div>
            ) : null}

            {printers.length > 0 ? (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Beleg drucken auf
                </label>
                <select
                  value={printerId}
                  onChange={(e) => setPrinterId(e.target.value)}
                  className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:border-blue-500"
                >
                  {printers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.isActive ? '' : ' (inaktiv)'}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs font-bold text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={printDetails}
                  onChange={(e) => setPrintDetails(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-900 border-slate-700"
                />
                <span>Artikel- und Bestelldetails mit auf den Bon drucken</span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="min-h-[52px] px-5 rounded-2xl bg-slate-900 border border-slate-800 font-bold text-sm flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Zurück
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => finish(false)}
              className="min-h-[52px] px-5 rounded-2xl bg-slate-900 border border-slate-700 font-bold text-sm disabled:opacity-40"
            >
              {isCorrection ? 'Korrektur ohne Bon abschließen' : 'Ohne Bon abschließen'}
            </button>
            <button
              type="button"
              disabled={busy || printers.length === 0}
              onClick={() => finish(true)}
              className="flex-1 min-h-[52px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition"
            >
              {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              {isCorrection ? 'Korrektur abschließen & Bon drucken' : 'Abschließen und Bon drucken'}
            </button>
          </div>
        </div>
      )}

      {/* =============================================== Schritt 5: Beleg */}
      {step === 5 && report && done && (
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 rounded-2xl p-4 print:hidden">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="text-sm font-bold">
              Schicht von {report.waiterName} ist abgerechnet und abgemeldet.
            </span>
          </div>

          {/* Template Switcher Toolbar (Hidden in Print) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2 flex flex-wrap items-center justify-between gap-2 print:hidden">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-400 px-2">Druck-Design:</span>
              {[
                { id: 'OFFICIAL_A4', label: 'Offizieller Prüfbericht (A4)' },
                { id: 'RECEIPT_SLIP', label: 'Kassenbon (80 mm)' },
                { id: 'DASHBOARD_SUMMARY', label: 'Management Übersicht' },
              ].map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setSettleTemplate(tpl.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    settleTemplate === tpl.id
                      ? 'bg-blue-600 text-white shadow'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {tpl.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Jetzt Drucken / PDF</span>
            </button>
          </div>

          {/* Druckansicht 1: Offizieller DIN A4 Buchhaltungsbogen */}
          {settleTemplate === 'OFFICIAL_A4' && (
            <div
              id="settlement-report"
              className="bg-white text-slate-950 rounded-2xl p-8 print:rounded-none print:p-0 print:shadow-none font-sans"
            >
              <div className="text-center border-b-2 border-slate-900 pb-3 mb-6">
                {report.isTraining ? (
                  <div className="font-black text-sm mb-1 text-rose-600">*** ÜBUNGSBETRIEB - KEINE GUELTIGE BUCHUNG ***</div>
                ) : null}
                {isCorrection ? (
                  <div className="font-black text-sm mb-1 text-amber-600 uppercase tracking-wide">
                    *** KORREKTUR DER SCHICHTABRECHNUNG (ADMIN-AUTORISIERT) ***
                  </div>
                ) : null}
                <h1 className="text-2xl font-black uppercase tracking-tight">
                  {isCorrection ? 'Korrektur-Bericht: Schichtabrechnung' : 'Kassen- & Schichtabschlussbericht'}
                </h1>
                <p className="text-sm text-slate-600 font-semibold">{report.eventName}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                <div>
                  <div className="text-xs text-slate-500 uppercase font-bold">Bedienung / Kellner</div>
                  <div className="font-black text-base">{report.waiterName}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500 uppercase font-bold">Kassenperiode / Datum</div>
                  <div className="font-mono font-bold">Z-{report.periodNumber} · {new Date().toLocaleString('de-DE')}</div>
                </div>
              </div>

              <h3 className="font-black text-sm border-b-2 border-slate-900 pb-1 mb-2 uppercase">
                1. Umsatz nach Zahlungsart
              </h3>
              <table className="w-full text-sm mb-6 border border-slate-300">
                <thead className="bg-slate-100 border-b border-slate-300 text-xs uppercase font-bold text-slate-700">
                  <tr>
                    <th className="py-1.5 px-3 text-left">Zahlungsart</th>
                    <th className="py-1.5 px-3 text-center">Buchungen</th>
                    <th className="py-1.5 px-3 text-right">Umsatz Brutto</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byMethod.map((m) => (
                    <tr key={m.method} className="border-b border-slate-200">
                      <td className="py-1.5 px-3 font-semibold">{m.label}</td>
                      <td className="py-1.5 px-3 text-center font-mono">{m.count}×</td>
                      <td className="py-1.5 px-3 text-right font-mono font-bold">{money(m.amount)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-black text-base">
                    <td className="py-2 px-3">Gesamtumsatz</td>
                    <td className="py-2 px-3 text-center font-mono">{report.transactionCount}×</td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-800">{money(report.totalGross)}</td>
                  </tr>
                </tbody>
              </table>

              <h3 className="font-black text-sm border-b-2 border-slate-900 pb-1 mb-2 uppercase">
                2. Trinkgeld-Abrechnung
              </h3>
              <table className="w-full text-sm mb-6 border border-slate-300">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 px-3 font-bold">Trinkgeld Gesamt</td>
                    <td className="py-1.5 px-3 text-right font-mono font-bold">{money(report.tipsTotal)}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 px-3 pl-6 text-slate-600">davon Anteil Bedienung (Einbehalt)</td>
                    <td className="py-1.5 px-3 text-right font-mono">{money(report.tipWaiterShare)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 pl-6 text-slate-600">davon Anteil Team-Pool (Kassenabgabe)</td>
                    <td className="py-1.5 px-3 text-right font-mono">{money(report.tipPoolShare)}</td>
                  </tr>
                </tbody>
              </table>

              <h3 className="font-black text-sm border-b-2 border-slate-900 pb-1 mb-2 uppercase">
                3. Kassensturz &amp; Bargeldabgabe
              </h3>
              <table className="w-full text-sm mb-6 border border-slate-300">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 px-3">Soll-Barbestand (Barumsatz abzgl. Bedienungs-Trinkgeld)</td>
                    <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">{money(report.cashExpected)}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 px-3 font-bold">Ist-Barbestand (Tatsächlich gezählt)</td>
                    <td className="py-1.5 px-3 text-right font-mono font-black text-base">{money(countedNum)}</td>
                  </tr>
                  <tr className="bg-slate-100 font-black text-base">
                    <td className="py-2 px-3">
                      Differenz: {differenceOk ? 'Kasse stimmt exakt' : difference > 0 ? 'Überschuss' : 'Fehlbetrag'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      {difference > 0 ? '+' : ''}
                      {money(difference)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* 4. Verkaufte Artikel */}
              {report.itemsSold && report.itemsSold.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-black text-sm border-b-2 border-slate-900 pb-1 mb-2 uppercase">
                    4. Verkaufte Artikel ({report.itemsSold.length} Positionen)
                  </h3>
                  <table className="w-full text-sm border border-slate-300">
                    <thead className="bg-slate-100 border-b border-slate-300 text-xs uppercase font-bold text-slate-700">
                      <tr>
                        <th className="py-1.5 px-3 text-left">Artikel</th>
                        <th className="py-1.5 px-3 text-center">Menge</th>
                        <th className="py-1.5 px-3 text-right">Umsatz Brutto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.itemsSold.map((it) => (
                        <tr key={it.name} className="border-b border-slate-200">
                          <td className="py-1.5 px-3 font-semibold">{it.name}</td>
                          <td className="py-1.5 px-3 text-center font-mono">{it.quantity}×</td>
                          <td className="py-1.5 px-3 text-right font-mono font-bold">{formatCents(it.amountCents)}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-black">
                        <td className="py-2 px-3">Gesamt verkaufte Artikel</td>
                        <td className="py-2 px-3 text-center font-mono">
                          {report.itemsSold.reduce((sum, it) => sum + it.quantity, 0)}×
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-800">
                          {formatCents(report.itemsSold.reduce((sum, it) => sum + it.amountCents, 0))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* 5. Einzelbestellungen */}
              {report.orders && report.orders.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-black text-sm border-b-2 border-slate-900 pb-1 mb-2 uppercase">
                    5. Einzelbestellungen ({report.orders.length} Vorgänge)
                  </h3>
                  <table className="w-full text-xs border border-slate-300">
                    <thead className="bg-slate-100 border-b border-slate-300 text-[10px] uppercase font-bold text-slate-700">
                      <tr>
                        <th className="py-1 px-2 text-left"># / Zeit</th>
                        <th className="py-1 px-2 text-left">Tisch / Ort</th>
                        <th className="py-1 px-2 text-left">Bestellte Artikel</th>
                        <th className="py-1 px-2 text-right">Betrag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.orders.map((ord) => (
                        <tr key={ord.id} className="border-b border-slate-200">
                          <td className="py-1 px-2 font-mono font-bold whitespace-nowrap">
                            #{ord.orderNumber} <span className="font-normal text-slate-500">· {ord.time}</span>
                          </td>
                          <td className="py-1 px-2 font-semibold whitespace-nowrap">{ord.tableName}</td>
                          <td className="py-1 px-2 text-slate-700">{ord.itemsSummary}</td>
                          <td className="py-1 px-2 text-right font-mono font-bold whitespace-nowrap">{formatCents(ord.totalCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {notes ? (
                <div className="p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs mb-6">
                  <span className="font-black uppercase">Bemerkung zur Schicht:</span> {notes}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-12 mt-12 text-xs pt-4">
                <div className="border-t-2 border-slate-900 pt-2 text-center font-bold">
                  Unterschrift Bedienung ({report.waiterName})
                </div>
                <div className="border-t-2 border-slate-900 pt-2 text-center font-bold">
                  Unterschrift Kassenprüfer / Festleitung
                </div>
              </div>
            </div>
          )}

          {/* Druckansicht 2: Kompakter 80-mm-Bonstreifen */}
          {settleTemplate === 'RECEIPT_SLIP' && (
            <div className="bg-slate-950 p-4 rounded-2xl flex justify-center print:bg-white print:p-0">
              <div className="bg-white text-slate-950 p-6 rounded-xl border-dashed border-2 border-slate-300 max-w-sm w-full font-mono text-xs shadow-xl print:shadow-none print:border-none print:max-w-none print:p-0">
                <div className="text-center pb-2 mb-2 border-b border-slate-400">
                  <div className="font-bold text-sm">
                    {isCorrection ? '*** ABRECHNUNGSKORREKTUR ***' : '*** SCHICHTABSCHLUSS ***'}
                  </div>
                  <div className="font-bold">{report.eventName}</div>
                  <div>Z-Periode: Z-{report.periodNumber}</div>
                  <div>Bedienung: {report.waiterName}</div>
                  <div>{new Date().toLocaleString('de-DE')}</div>
                </div>

                <div className="py-2 border-b border-slate-400 space-y-1">
                  <div className="font-bold">UMSATZ NACH ZAHLART:</div>
                  {report.byMethod.map((m) => (
                    <div key={m.method} className="flex justify-between">
                      <span>{m.label} ({m.count}x)</span>
                      <span>{money(m.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold pt-1 border-t border-slate-300 text-sm">
                    <span>GESAMT:</span>
                    <span>{money(report.totalGross)}</span>
                  </div>
                </div>

                <div className="py-2 border-b border-slate-400 space-y-1">
                  <div className="font-bold">KASSENSTURZ:</div>
                  <div className="flex justify-between">
                    <span>Soll-Bar:</span>
                    <span>{money(report.cashExpected)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gezählt:</span>
                    <span>{money(countedNum)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm pt-1">
                    <span>Differenz:</span>
                    <span>{difference > 0 ? '+' : ''}{money(difference)}</span>
                  </div>
                </div>

                {/* Optional: Verkaufte Artikel auf Bonstreifen */}
                {printDetails && report.itemsSold && report.itemsSold.length > 0 && (
                  <div className="py-2 border-b border-slate-400 space-y-1">
                    <div className="font-bold">VERKAUFTE ARTIKEL:</div>
                    {report.itemsSold.map((it) => (
                      <div key={it.name} className="flex justify-between text-[11px]">
                        <span className="truncate pr-2">{it.quantity}x {it.name}</span>
                        <span className="font-mono">{formatCents(it.amountCents)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Optional: Bestellungen auf Bonstreifen */}
                {printDetails && report.orders && report.orders.length > 0 && (
                  <div className="py-2 border-b border-slate-400 space-y-1">
                    <div className="font-bold">BESTELLUNGEN ({report.orders.length}):</div>
                    {report.orders.map((ord) => (
                      <div key={ord.id} className="text-[10px] pb-1 border-b border-slate-200 last:border-0">
                        <div className="flex justify-between font-bold">
                          <span>#{ord.orderNumber} {ord.time} ({ord.tableName})</span>
                          <span>{formatCents(ord.totalCents)}</span>
                        </div>
                        <div className="text-slate-600 truncate">{ord.itemsSummary}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-6 grid grid-cols-2 gap-4 text-[10px] text-center">
                  <div className="border-t border-slate-400 pt-1">Bedienung</div>
                  <div className="border-t border-slate-400 pt-1">Kasse</div>
                </div>
              </div>
            </div>
          )}

          {/* Druckansicht 3: Management Dashboard-Zusammenfassung */}
          {settleTemplate === 'DASHBOARD_SUMMARY' && (
            <div className="bg-white text-slate-950 rounded-2xl p-8 print:rounded-none print:p-0 font-sans shadow">
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-6">
                <div>
                  {isCorrection ? (
                    <span className="inline-block px-2.5 py-0.5 mb-1 bg-amber-100 text-amber-900 text-xs font-black rounded-lg uppercase">
                      Abrechnungskorrektur
                    </span>
                  ) : null}
                  <h2 className="text-2xl font-black">Schicht-Auswertung &amp; KPIs</h2>
                  <p className="text-xs text-slate-500 font-semibold">{report.eventName} · Bedienung: {report.waiterName}</p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-xs bg-slate-200 px-3 py-1.5 rounded-xl">
                    Periode Z-{report.periodNumber}
                  </span>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <span className="text-xs font-bold text-emerald-800 uppercase block mb-1">Gesamtumsatz</span>
                  <span className="text-2xl font-black text-emerald-900 font-mono">{money(report.totalGross)}</span>
                  <span className="text-[11px] text-emerald-700 block mt-1">{report.transactionCount} Transaktionen</span>
                </div>
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200">
                  <span className="text-xs font-bold text-blue-800 uppercase block mb-1">Bestellungen</span>
                  <span className="text-2xl font-black text-blue-900 font-mono">{report.orderCount ?? 0}</span>
                  <span className="text-[11px] text-blue-700 block mt-1">erfasste Tische/Bons</span>
                </div>
                <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200">
                  <span className="text-xs font-bold text-indigo-800 uppercase block mb-1">Trinkgeld Gesamt</span>
                  <span className="text-2xl font-black text-indigo-900 font-mono">{money(report.tipsTotal)}</span>
                  <span className="text-[11px] text-indigo-700 block mt-1">Bedienung: {money(report.tipWaiterShare)}</span>
                </div>
                <div className={`p-4 rounded-2xl border ${differenceOk ? 'bg-emerald-50 border-emerald-300' : 'bg-rose-50 border-rose-300'}`}>
                  <span className="text-xs font-bold uppercase block mb-1">Kassensturz-Status</span>
                  <span className={`text-2xl font-black font-mono ${differenceOk ? 'text-emerald-900' : 'text-rose-900'}`}>
                    {difference > 0 ? '+' : ''}{money(difference)}
                  </span>
                  <span className="text-[11px] font-bold block mt-1">
                    {differenceOk ? 'Kasse ausgeglichen' : difference > 0 ? 'Überschuss' : 'Fehlbetrag'}
                  </span>
                </div>
              </div>

              {/* Zahlarten Aufteilung */}
              <h3 className="font-black text-sm uppercase mb-3">Zahlarten-Mix</h3>
              <div className="space-y-3 mb-6">
                {report.byMethod.map((m) => {
                  const total = report.totalGross ?? (report.totalGrossCents !== undefined ? report.totalGrossCents / 100 : 0);
                  const amount = m.amount ?? (m.amountCents !== undefined ? m.amountCents / 100 : 0);
                  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
                  return (
                    <div key={m.method} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span>{m.label} ({m.count}×)</span>
                        <span className="font-mono">{money(amount)} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Top Verkaufte Artikel */}
              {report.itemsSold && report.itemsSold.length > 0 && (
                <div>
                  <h3 className="font-black text-sm uppercase mb-3">
                    Verkaufte Artikel ({report.itemsSold.length} Positionen, {report.itemsSold.reduce((sum, it) => sum + it.quantity, 0)} Stück)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {report.itemsSold.slice(0, 10).map((it) => (
                      <div key={it.name} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="font-semibold truncate pr-2">{it.name}</span>
                        <div className="flex items-center gap-2 font-mono shrink-0">
                          <span className="bg-slate-200 px-1.5 py-0.5 rounded font-bold">{it.quantity}×</span>
                          <span className="font-bold">{formatCents(it.amountCents)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 print:hidden pt-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 min-h-[52px] rounded-2xl bg-blue-600 hover:bg-blue-500 font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition"
            >
              <FileText className="w-4 h-4" />
              Als PDF speichern oder drucken
            </button>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setSelected('');
                setReport(null);
                setCounted('');
                setNotes('');
                setDone(false);
                setIsCorrection(false);
              }}
              className="min-h-[52px] px-5 rounded-2xl bg-slate-900 border border-slate-800 font-bold text-sm text-slate-300 hover:text-white"
            >
              Nächste Bedienung
            </button>
          </div>

          <p className="text-[11px] text-slate-500 print:hidden">
            „Als PDF speichern“ öffnet den Druckdialog des Browsers. Wählen Sie dort Ihr gewünschtes Format (A4 oder Bon).
          </p>
        </div>
      )}

      {/* Admin PIN Modal für Abrechnungskorrektur */}
      <PinModal
        isOpen={showPinModal}
        onClose={() => {
          setShowPinModal(false);
          setPendingWaiter(null);
        }}
        onCancel={() => {
          setShowPinModal(false);
          setPendingWaiter(null);
        }}
        onSuccess={handlePinSuccess}
        title="Admin-PIN für Abrechnungskorrektur"
        description={`Bedienung ${pendingWaiter || selected} ist bereits abgerechnet. Bitte gib den 4-stelligen Admin-PIN ein, um eine Korrektur durchzuführen.`}
        stationType="ADMIN"
      />
    </div>
  );
}

export default function AdminSettlePage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center min-h-[400px] text-slate-400">
          Lade Schichtabrechnung …
        </div>
      }
    >
      <AdminSettleContent />
    </Suspense>
  );
}
