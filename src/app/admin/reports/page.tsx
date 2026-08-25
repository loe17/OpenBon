'use client';

import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  RefreshCw,
  Coins,
  TrendingUp,
  Clock,
  Zap,
  AlertTriangle,
  Sparkles,
  PieChart,
  Users,
  CreditCard,
  Banknote,
  HeartHandshake,
  CheckCircle2,
  Trophy,
  Landmark,
  PlusCircle,
  Lock,
  X,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { triggerHapticFeedback } from '@/lib/socket-client';
import { useToast } from '@/components/ui/toast';
import type { ReportSummary, PrinterDTO, ZBonPreview } from '@/types/domain';

export default function AdminReportsPage() {
  const { success, error, warning } = useToast();
  const [data, setData] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [printers, setPrinters] = useState<PrinterDTO[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState('');
  const [activeTab, setActiveTab] = useState<'FORECAST' | 'CHARTS' | 'WAITERS' | 'ITEMS'>('FORECAST');

  // Spec 6.7: X-Bon (Zwischenstand) und Z-Bon (echter Tagesabschluss)
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closePin, setClosePin] = useState('');
  const [cashCounted, setCashCounted] = useState('');
  const [closeBusy, setCloseBusy] = useState(false);
  const [closeResult, setCloseResult] = useState<string | null>(null);
  const [zPreview, setZPreview] = useState<ZBonPreview | null>(null);

  const fetchReports = async () => {
    try {
      const [repRes, prnRes] = await Promise.all([
        fetch('/api/reports'),
        fetch('/api/printers'),
      ]);
      const repData = await repRes.json();
      const prnData = await prnRes.json();

      setData(repData);
      if (Array.isArray(prnData)) {
        setPrinters(prnData);
        if (prnData.length > 0) setSelectedPrinterId(prnData[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  /** Spec 6.7: X-Bon – Zwischenbericht ohne Kassenabschluss */
  const handlePrintXBon = async () => {
    triggerHapticFeedback();
    try {
      const res = await fetch('/api/reports/x-bon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printerId: selectedPrinterId || undefined }),
      });
      const body = await res.json();
      setCloseResult(
        res.ok
          ? 'X-Bon gedruckt. Die Kasse bleibt geöffnet, Zähler unverändert.'
          : body.error || 'X-Bon konnte nicht gedruckt werden.'
      );
    } catch {
      setCloseResult('Drucker nicht erreichbar.');
    }
  };

  /** X-Bon für eine einzelne Bedienung drucken */
  const handlePrintWaiterXBon = async (waiterName: string) => {
    triggerHapticFeedback();
    try {
      const res = await fetch('/api/reports/x-bon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waiterName, printerId: selectedPrinterId || undefined }),
      });
      const body = await res.json();
      if (res.ok) {
        success(`X-Bon Abrechnung für "${waiterName}" gedruckt!`);
      } else {
        error(`Druckfehler: ${body.error || 'Unbekannt'}`);
      }
    } catch {
      error('Drucker nicht erreichbar.');
    }
  };

  /** Spec 6.7: Z-Bon-Dialog mit Vorschau der abzuschließenden Periode */
  const openCloseModal = async () => {
    triggerHapticFeedback();
    setClosePin('');
    setCashCounted('');
    setCloseResult(null);
    try {
      const res = await fetch('/api/reports/z-bon');
      setZPreview(await res.json());
    } catch {
      setZPreview(null);
    }
    setShowCloseModal(true);
  };

  /** Spec 6.7: Tagesabschluss durchführen */
  const handleCloseRegister = async () => {
    setCloseBusy(true);
    try {
      const res = await fetch('/api/reports/z-bon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: closePin,
          closedBy: localStorage.getItem('pos_waiter_name') || 'Admin',
          cashCounted: cashCounted ? Number(cashCounted.replace(',', '.')) : undefined,
          printerId: selectedPrinterId || undefined,
          print: true,
        }),
      });
      const body = await res.json();
      if (res.ok) {
        setCloseResult(
          `Tagesabschluss Z-${String(body.period?.periodNumber ?? 0).padStart(4, '0')} erfolgreich. Zähler zurückgesetzt.`
        );
        setShowCloseModal(false);
        fetchReports();
      } else {
        setCloseResult(body.error || 'Tagesabschluss fehlgeschlagen.');
      }
    } catch {
      setCloseResult('Verbindungsfehler beim Tagesabschluss.');
    } finally {
      setCloseBusy(false);
    }
  };

  const maxHourlyGross = data?.hourlySales
    ? Math.max(...data.hourlySales.map((h) => h.grossAmount), 1)
    : 1;

  const maxProductQty = data?.topProducts
    ? Math.max(...data.topProducts.slice(0, 10).map((p) => p.quantity), 1)
    : 1;

  const maxWaiterGross = data?.waiters
    ? Math.max(...data.waiters.map((w) => w.totalGross), 1)
    : 1;

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 text-white p-3 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2.5 rounded-2xl shadow">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Statistiken, Charts & Vorhersagen</h1>
            <p className="text-xs text-slate-400">
              Echtzeit-Umsätze, stündliche Lastspitzen, Kellner-Performance und KI-Bedarfsprognose
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {printers.length > 0 && (
            <select
              value={selectedPrinterId}
              onChange={(e) => setSelectedPrinterId(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200"
            >
              {printers.map((p) => (
                <option key={p.id} value={p.id}>
                  Drucker: {p.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handlePrintXBon}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 transition"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>X-Bon (Zwischenstand)</span>
          </button>

          <button
            onClick={openCloseModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 rounded-xl text-xs font-bold text-white transition shadow"
          >
            <Lock className="w-4 h-4" />
            <span>Z-Bon Tagesabschluss</span>
          </button>

          <a
            href="/api/reports?format=csv"
            download
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white transition shadow"
          >
            <Download className="w-4 h-4" />
            <span>Excel / CSV</span>
          </a>

          <button
            onClick={fetchReports}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center h-48 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Lade Daten & berechne Trend-Prognosen...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top KPI Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
              <span className="text-xs font-bold text-slate-400 block mb-1">Tagesumsatz (Brutto)</span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                {formatCurrency(data.totalGross)}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Netto: {formatCurrency(data.totalNet)}</span>
            </div>

            <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
              <span className="text-xs font-bold text-slate-400 block mb-1">Barbestand (Ist)</span>
              <div className="text-2xl sm:text-3xl font-black text-blue-400 font-mono">
                {formatCurrency(data.totalCash)}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Kartenzahlung: {formatCurrency(data.totalCard)}</span>
            </div>

            <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
              <span className="text-xs font-bold text-slate-400 block mb-1">Pfand-Saldo</span>
              <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                {formatCurrency(data.netDepositBalance)}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Rückgabe: -{formatCurrency(data.totalDepositReturned)}</span>
            </div>

            <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
              <span className="text-xs font-bold text-slate-400 block mb-1">Belege & Aufschläge</span>
              <div className="text-2xl sm:text-3xl font-black text-purple-400 font-mono">
                {data.transactionCount}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Aufschläge: +{formatCurrency(data.totalSurcharges)}</span>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 w-fit">
            {([
              { id: 'FORECAST', label: 'Prognose & Bedarf', icon: Sparkles },
              { id: 'CHARTS', label: 'Umsatz & Zahlungsarten', icon: TrendingUp },
              { id: 'WAITERS', label: 'Kellner-Performance & Z-Bon', icon: Trophy },
              { id: 'ITEMS', label: 'Top-Seller Ranking', icon: BarChart3 },
            ] as const).map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    triggerHapticFeedback();
                    setActiveTab(t.id);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                    activeTab === t.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: Predictive Forecast */}
          {activeTab === 'FORECAST' && data.forecast && (
            <div className="space-y-6">
              {/* Forecast Metrics Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-3xl bg-gradient-to-br from-blue-950/80 to-slate-900 border-2 border-blue-500/50 shadow-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
                      Erwarteter Tagesumsatz (EOD)
                    </span>
                    <Sparkles className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="text-3xl sm:text-4xl font-black text-blue-400 font-mono mb-1">
                    ca. {formatCurrency(data.forecast.projectedEodGross)}
                  </div>
                  <p className="text-xs text-slate-400">
                    Basierend auf {data.forecast.currentVelocityPerHour > 0 ? `${formatCurrency(data.forecast.currentVelocityPerHour)} / Std.` : 'aktueller Verkaufsgeschwindigkeit'}.
                  </p>
                </div>

                <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-950/80 to-slate-900 border-2 border-amber-500/50 shadow-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                      Haupt-Stoßzeit (Peak Hour)
                    </span>
                    <Zap className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="text-3xl sm:text-4xl font-black text-amber-400 font-mono mb-1">
                    {data.forecast.peakHourLabel}
                  </div>
                  <p className="text-xs text-slate-400">
                    Intensität: <span className="text-white font-bold">{data.forecast.peakHourIntensity}</span> (Höchste Bestellfrequenz).
                  </p>
                </div>

                <div className="p-5 rounded-3xl bg-gradient-to-br from-purple-950/80 to-slate-900 border-2 border-purple-500/50 shadow-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                      Prognose Nächste Stunde
                    </span>
                    <Clock className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="text-3xl sm:text-4xl font-black text-purple-300 font-mono mb-1">
                    +{formatCurrency(data.forecast.projectedNextHourGross)}
                  </div>
                  <p className="text-xs text-slate-400">
                    Zuverlässigkeit der Hochrechnung: <span className="text-white font-bold">{data.forecast.confidencePercent}%</span>
                  </p>
                </div>
              </div>

              {/* Critical Stock Depletion Warnings */}
              <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
                <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <span>Automatische Nachschub- & Reichweiten-Warnungen</span>
                </h3>

                {data.forecast.criticalStockAlerts?.length === 0 ? (
                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-emerald-400 font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Alle Lagerbestände ausreichend für die nächsten Stunden.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {data.forecast.criticalStockAlerts?.map((alert, idx: number) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border-2 ${
                          alert.urgency === 'HIGH'
                            ? 'bg-rose-950/40 border-rose-600 text-rose-200'
                            : 'bg-amber-950/40 border-amber-500 text-amber-200'
                        }`}
                      >
                        <div className="font-extrabold text-sm text-white mb-1">{alert.productName}</div>
                        <div className="text-xs font-semibold space-y-0.5">
                          <div>Restbestand: <span className="font-bold">{alert.currentStock} Stk.</span></div>
                          <div>Verbrauch: ~{alert.consumptionPerHour} Stk. / Stunde</div>
                          <div className="font-bold mt-1 text-amber-300">
                            Reicht noch: {alert.estimatedMinutesRemaining > 0 ? `ca. ${alert.estimatedMinutesRemaining} Min.` : 'Kritisch / Nachfüllen!'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Visual Charts & Payment Splits */}
          {activeTab === 'CHARTS' && (
            <div className="space-y-6">
              {/* Payment Split Banner */}
              <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl space-y-4">
                <h3 className="text-base font-bold text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-blue-400" />
                    <span>Zahlungsarten-Verteilung: Bar vs. Karte</span>
                  </span>
                  <span className="text-xs text-slate-400 font-normal">
                    Bar: {data.paymentSplit?.cash.percent}% • Karte: {data.paymentSplit?.cardAll.percent}%
                  </span>
                </h3>

                {/* Combined Progress Bar */}
                <div className="h-6 w-full bg-slate-800 rounded-2xl overflow-hidden flex border border-slate-700">
                  <div
                    style={{ width: `${Math.max(2, data.paymentSplit?.cash.percent || 0)}%` }}
                    className="bg-emerald-500 h-full flex items-center justify-center text-[10px] font-bold text-white transition-all"
                  >
                    Bar {data.paymentSplit?.cash.percent}%
                  </div>
                  <div
                    style={{ width: `${Math.max(2, data.paymentSplit?.cardAll.percent || 0)}%` }}
                    className="bg-blue-600 h-full flex items-center justify-center text-[10px] font-bold text-white transition-all"
                  >
                    Karte {data.paymentSplit?.cardAll.percent}%
                  </div>
                </div>

                {/* Detailed Payment Split Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                    <div className="text-xs text-slate-400 font-semibold mb-1 flex items-center gap-1.5">
                      <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Bargeld (Kasse)</span>
                    </div>
                    <div className="text-lg font-black font-mono text-emerald-400">
                      {formatCurrency(data.paymentSplit?.cash.amount || 0)}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                    <div className="text-xs text-slate-400 font-semibold mb-1 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                      <span>SumUp</span>
                    </div>
                    <div className="text-lg font-black font-mono text-blue-400">
                      {formatCurrency(data.paymentSplit?.cardSumUp || 0)}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                    <div className="text-xs text-slate-400 font-semibold mb-1 flex items-center gap-1.5">
                      <Landmark className="w-3.5 h-3.5 text-blue-400" />
                      <span>VR-Pay Me</span>
                    </div>
                    <div className="text-lg font-black font-mono text-blue-300">
                      {formatCurrency(data.paymentSplit?.cardVrPay || 0)}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                    <div className="text-xs text-slate-400 font-semibold mb-1 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-purple-400" />
                      <span>EC-Terminal / Sonst.</span>
                    </div>
                    <div className="text-lg font-black font-mono text-purple-400">
                      {formatCurrency(data.paymentSplit?.cardTerminal || 0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Hourly Chart & Category Progress */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Hourly Peak Load Bar Chart */}
                <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-blue-400" />
                      <span>Stündlicher Umsatzverlauf (08:00 - 23:00)</span>
                    </h3>
                    <p className="text-xs text-slate-400 mb-6">Umsatz pro Stunde zur Erkennung von Lastspitzen</p>
                  </div>

                  <div className="h-60 flex items-end gap-1.5 sm:gap-2 px-2 pt-6 border-b border-slate-700">
                    {data.hourlySales?.map((h) => {
                      const heightPercent = Math.max(6, Math.round((h.grossAmount / maxHourlyGross) * 100));
                      const isPeak = h.grossAmount === maxHourlyGross && h.grossAmount > 0;

                      return (
                        <div key={h.hour} className="flex-1 flex flex-col items-center group relative">
                          <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950 text-white text-[10px] font-mono px-2 py-1 rounded-lg border border-slate-700 whitespace-nowrap z-10 pointer-events-none shadow-xl">
                            {h.label}: {formatCurrency(h.grossAmount)} ({h.orderCount} Bons)
                          </div>

                          <div
                            style={{ height: `${heightPercent}%` }}
                            className={`w-full rounded-t-xl transition-all ${
                              isPeak
                                ? 'bg-amber-400 shadow-lg shadow-amber-400/30'
                                : h.grossAmount > 0
                                ? 'bg-blue-500 hover:bg-blue-400'
                                : 'bg-slate-800'
                            }`}
                          />
                          <span className="text-[10px] font-mono text-slate-400 mt-2 rotate-[-45deg] origin-top-left">
                            {h.hour}h
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Category Breakdown Progress */}
                <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                      <PieChart className="w-5 h-5 text-emerald-400" />
                      <span>Umsatz nach Warengruppen</span>
                    </h3>
                    <p className="text-xs text-slate-400 mb-4">Prozentuale Verteilung aller Umsätze</p>
                  </div>

                  <div className="space-y-4 my-auto">
                    {data.categoryBreakdown?.map((cat) => (
                      <div key={cat.id}>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span className="text-slate-200">{cat.name} ({cat.count} Stk.)</span>
                          <span className="font-mono text-emerald-400">{formatCurrency(cat.revenue)} ({cat.percent}%)</span>
                        </div>
                        <div className="h-3.5 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${Math.max(4, cat.percent)}%`, backgroundColor: cat.color || '#3b82f6' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Waiter Performance & Leaderboard */}
          {activeTab === 'WAITERS' && (
            <div className="space-y-6">
              {/* Waiter Leaderboard Ranking Cards */}
              <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
                <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  <span>Bedienungs-Rangliste & Performance der letzten Stunde</span>
                </h3>

                <div className="space-y-3">
                  {data.waiters?.map((w) => {
                    const widthPercent = Math.round((w.totalGross / maxWaiterGross) * 100);
                    return (
                      <div key={w.waiterName} className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-3">
                            <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${
                              w.rank === 1 ? 'bg-amber-500 text-black' : w.rank === 2 ? 'bg-slate-300 text-black' : w.rank === 3 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-400'
                            }`}>
                              #{w.rank}
                            </span>
                            <span className="font-bold text-white text-sm sm:text-base">{w.waiterName}</span>
                          </div>

                          <div className="flex items-center gap-4 text-xs font-semibold">
                            <span className="text-blue-400 font-mono">
                              Letzte 60 Min: <strong>{formatCurrency(w.salesLastHour)}</strong> ({w.ordersLastHour} Bons)
                            </span>
                            <span className="text-emerald-400 font-mono text-sm sm:text-base font-black">
                              {formatCurrency(w.totalGross)}
                            </span>
                          </div>
                        </div>

                        <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden mb-2">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full"
                            style={{ width: `${Math.max(3, widthPercent)}%` }}
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1">
                          <span>Bar: {formatCurrency(w.cashGross)} • Karte: {formatCurrency(w.cardGross)}</span>
                          <span>Trinkgeld: +{formatCurrency(w.tips)} • Belege: {w.transactionCount}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detail Table */}
              <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-x-auto">
                <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  <span>Detaillierte Kellner-Schichtabrechnung (Z-Bon)</span>
                </h3>

                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-3 font-bold">Rang</th>
                      <th className="pb-3 font-bold">Bedienung</th>
                      <th className="pb-3 font-bold">Gesamtumsatz</th>
                      <th className="pb-3 font-bold">Letzte Stunde</th>
                      <th className="pb-3 font-bold">Barumsatz</th>
                      <th className="pb-3 font-bold">Kartenzahlung</th>
                      <th className="pb-3 font-bold">Trinkgeld</th>
                      <th className="pb-3 font-bold">Belege</th>
                      <th className="pb-3 font-bold text-right">Abrechnung</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {data.waiters?.map((w) => (
                      <tr key={w.waiterName}>
                        <td className="py-3 font-bold text-slate-400">#{w.rank}</td>
                        <td className="py-3 font-bold text-white">{w.waiterName}</td>
                        <td className="py-3 font-mono font-black text-emerald-400">{formatCurrency(w.totalGross)}</td>
                        <td className="py-3 font-mono text-blue-400">{formatCurrency(w.salesLastHour)} ({w.ordersLastHour} Bons)</td>
                        <td className="py-3 font-mono text-slate-300">{formatCurrency(w.cashGross)}</td>
                        <td className="py-3 font-mono text-slate-300">{formatCurrency(w.cardGross)}</td>
                        <td className="py-3 font-mono text-amber-400">+{formatCurrency(w.tips)}</td>
                        <td className="py-3 font-mono text-slate-300">{w.transactionCount}</td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handlePrintWaiterXBon(w.waiterName)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 hover:border-amber-500 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition"
                            title="X-Bon Abrechnung für diese Bedienung drucken"
                          >
                            <Printer className="w-3.5 h-3.5 text-amber-400" />
                            <span>X-Bon</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: Top Seller Ranking */}
          {activeTab === 'ITEMS' && (
            <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
                <span>Renner & Penner (Verkaufte Artikel)</span>
              </h3>

              <div className="space-y-3">
                {data.topProducts?.slice(0, 15).map((prod, idx: number) => {
                  const widthPercent = Math.round((prod.quantity / maxProductQty) * 100);
                  return (
                    <div key={prod.name} className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                      <div className="flex justify-between text-xs font-bold mb-1.5">
                        <span className="text-white">
                          #{idx + 1} {prod.name}
                        </span>
                        <span className="font-mono text-emerald-400">
                          {prod.quantity}x verkauft • {formatCurrency(prod.revenue)}
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${Math.max(3, widthPercent)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Spec 6.7: Z-Bon Tagesabschluss */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-rose-900 rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-600/20 text-rose-400 rounded-2xl border border-rose-800">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white">Tagesabschluss (Z-Bon)</h3>
                  <p className="text-xs text-slate-400">
                    Schließt die Kassenperiode und setzt die Zähler zurück
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCloseModal(false)}
                className="p-2 text-slate-400 rounded-xl bg-slate-800"
                aria-label="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {zPreview && !zPreview.error && (
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Periode', value: `Z-${String(zPreview.periodNumber ?? 0).padStart(4, '0')}` },
                  { label: 'Belege', value: String(zPreview.transactionCount ?? 0) },
                  { label: 'Umsatz brutto', value: formatCurrency(zPreview.totalGross ?? 0) },
                  { label: 'MwSt 19 %', value: formatCurrency(zPreview.taxAmount19 ?? 0) },
                  { label: 'MwSt 7 %', value: formatCurrency(zPreview.taxAmount7 ?? 0) },
                  { label: 'Bar-Soll', value: formatCurrency(zPreview.cashExpected ?? 0) },
                ].map((k) => (
                  <div key={k.label} className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      {k.label}
                    </div>
                    <div className="font-mono font-black text-base text-white mt-0.5">{k.value}</div>
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">
                Gezähltes Bargeld (optional, für Kassensturz)
              </label>
              <input
                inputMode="decimal"
                value={cashCounted}
                onChange={(e) => setCashCounted(e.target.value)}
                placeholder="0,00"
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-lg font-mono font-bold text-white text-right focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              {cashCounted && zPreview?.cashExpected !== undefined && (
                <p className="text-xs font-bold mt-1.5 text-amber-300">
                  Differenz zum Bar-Soll:{' '}
                  {formatCurrency(
                    (Number(cashCounted.replace(',', '.')) || 0) - (zPreview.cashExpected ?? 0)
                  )}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">
                Admin-PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={closePin}
                onChange={(e) => setClosePin(e.target.value)}
                placeholder="••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-lg font-mono font-bold text-white tracking-[0.4em] text-center focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-950/50 border border-amber-800 text-amber-200 text-xs font-semibold flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Der Abschluss ist endgültig: Der Fiskalblock wird signiert gespeichert, der Z-Bon
                gedruckt und Bon- sowie Abholnummern werden zurückgesetzt. Offene Tische müssen
                vorher kassiert oder storniert sein.
              </span>
            </div>

            {closeResult && (
              <p className="text-xs font-bold text-rose-300">{closeResult}</p>
            )}

            <button
              onClick={handleCloseRegister}
              disabled={closeBusy || !closePin}
              className="w-full h-14 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 disabled:bg-slate-800 disabled:text-slate-500 transition"
            >
              {closeBusy ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
              <span>Kasse abschließen &amp; Z-Bon drucken</span>
            </button>
          </div>
        </div>
      )}

      {closeResult && !showCloseModal && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl font-bold text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>{closeResult}</span>
          <button onClick={() => setCloseResult(null)} className="ml-2 p-1" aria-label="Schließen">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
