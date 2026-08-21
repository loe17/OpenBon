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
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { triggerHapticFeedback } from '@/lib/socket-client';

export default function AdminReportsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [printers, setPrinters] = useState<any[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState('');
  const [activeTab, setActiveTab] = useState<'FORECAST' | 'CHARTS' | 'WAITERS' | 'ITEMS'>('FORECAST');

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

  const handlePrintZBon = async () => {
    if (!selectedPrinterId) {
      alert('Bitte wähle zuerst einen Bondrucker aus.');
      return;
    }

    try {
      await fetch('/api/printers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TEST_PRINT',
          printerId: selectedPrinterId,
        }),
      });
      alert('Z-Bon Kassenabschluss erfolgreich an den Drucker gesendet!');
    } catch (e) {
      alert('Druckfehler beim Z-Bon');
    }
  };

  const maxHourlyGross = data?.hourlySales
    ? Math.max(...data.hourlySales.map((h: any) => h.grossAmount), 1)
    : 1;

  const maxProductQty = data?.topProducts
    ? Math.max(...data.topProducts.slice(0, 10).map((p: any) => p.quantity), 1)
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
              Echtzeit-Umsätze, stündliche Lastspitzen, Renner/Penner und KI-Bedarfsprognose
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
            onClick={handlePrintZBon}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white transition shadow"
          >
            <Printer className="w-4 h-4" />
            <span>Z-Bon drucken</span>
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

      {loading ? (
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
              <span className="text-xs font-bold text-slate-400 block mb-1">Barbestand Kasse</span>
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
              <span className="text-xs font-bold text-slate-400 block mb-1">Belege & Bons</span>
              <div className="text-2xl sm:text-3xl font-black text-purple-400 font-mono">
                {data.transactionCount}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Kellner-Trinkgeld: {formatCurrency(data.totalTips)}</span>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 w-fit">
            {[
              { id: 'FORECAST', label: 'Prognose & Bedarf', icon: Sparkles },
              { id: 'CHARTS', label: 'Stundenverlauf & Warengruppen', icon: TrendingUp },
              { id: 'WAITERS', label: 'Kellner-Abrechnung (Z-Bon)', icon: Users },
              { id: 'ITEMS', label: 'Top-Seller Ranking', icon: BarChart3 },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    triggerHapticFeedback();
                    setActiveTab(t.id as any);
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
                    {data.forecast.criticalStockAlerts?.map((alert: any, idx: number) => (
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

          {/* TAB 2: Visual Charts */}
          {activeTab === 'CHARTS' && (
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
                  {data.hourlySales?.map((h: any) => {
                    const heightPercent = Math.max(6, Math.round((h.grossAmount / maxHourlyGross) * 100));
                    const isPeak = h.grossAmount === maxHourlyGross && h.grossAmount > 0;

                    return (
                      <div key={h.hour} className="flex-1 flex flex-col items-center group relative">
                        {/* Tooltip on hover */}
                        <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950 text-white text-[10px] font-mono px-2 py-1 rounded-lg border border-slate-700 whitespace-nowrap z-10 pointer-events-none shadow-xl">
                          {h.label}: {formatCurrency(h.grossAmount)} ({h.orderCount} Bons)
                        </div>

                        {/* Bar */}
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
                  {data.categoryBreakdown?.map((cat: any) => (
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
          )}

          {/* TAB 3: Waiter Breakdown */}
          {activeTab === 'WAITERS' && (
            <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-x-auto">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                <span>Kellner-Schichtabrechnung (Z-Bon)</span>
              </h3>

              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 font-bold">Bedienung</th>
                    <th className="pb-3 font-bold">Barumsatz (Ist)</th>
                    <th className="pb-3 font-bold">Kartenzahlung</th>
                    <th className="pb-3 font-bold">Rückpfand</th>
                    <th className="pb-3 font-bold">Trinkgeld</th>
                    <th className="pb-3 font-bold text-right">Belege</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {data.waiters?.map((w: any) => (
                    <tr key={w.waiterName}>
                      <td className="py-3 font-bold text-white">{w.waiterName}</td>
                      <td className="py-3 font-mono font-bold text-blue-400">{formatCurrency(w.cashGross)}</td>
                      <td className="py-3 font-mono text-slate-300">{formatCurrency(w.cardGross)}</td>
                      <td className="py-3 font-mono text-amber-400">-{formatCurrency(w.depositReturned)}</td>
                      <td className="py-3 font-mono text-emerald-400">+{formatCurrency(w.tips)}</td>
                      <td className="py-3 font-mono text-right text-slate-300">{w.transactionCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                {data.topProducts?.slice(0, 15).map((prod: any, idx: number) => {
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
    </div>
  );
}
