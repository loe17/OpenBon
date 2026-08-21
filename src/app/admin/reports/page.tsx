'use client';

import React, { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import {
  BarChart3,
  Download,
  RefreshCw,
  Coins,
  Banknote,
  CreditCard,
  Heart,
  TrendingUp,
  Receipt,
  User,
} from 'lucide-react';

export default function AdminReportsPage() {
  const [reports, setReports] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      setReports(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const downloadCsv = () => {
    window.open('/api/reports?format=csv', '_blank');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 text-white p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2.5 rounded-2xl">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Auswertungen, Z-Bon & Buchhaltung</h1>
            <p className="text-xs text-slate-400">
              Kellner-Schichtabrechnungen, Z-Bon Tagesabschluss, Renner/Penner-Liste und CSV-Export
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={downloadCsv}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-lg shadow-emerald-900/30 transition"
          >
            <Download className="w-4 h-4" />
            <span>CSV-Export (Excel)</span>
          </button>
          <button
            onClick={fetchReports}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition"
            title="Aktualisieren"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Berechne Auswertungen...</span>
        </div>
      ) : !reports ? (
        <div className="text-center py-12 text-slate-500">Keine Daten vorhanden.</div>
      ) : (
        <div className="space-y-6">
          {/* Top Big KPI Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
              <div className="text-xs text-slate-400 font-semibold mb-1">Gesamtumsatz (Brutto)</div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                {formatCurrency(reports.totalGross)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Netto: {formatCurrency(reports.totalNet)}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
              <div className="text-xs text-slate-400 font-semibold mb-1 flex items-center gap-1">
                <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                <span>Bargeldeinnahmen</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                {formatCurrency(reports.totalCash)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Im Kassenbestand</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
              <div className="text-xs text-slate-400 font-semibold mb-1 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                <span>Kartenzahlungen</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-blue-400 font-mono">
                {formatCurrency(reports.totalCard)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">SumUp / Terminal</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
              <div className="text-xs text-slate-400 font-semibold mb-1 flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>Trinkgelder</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                {formatCurrency(reports.totalTips)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Für das Servicepersonal</div>
            </div>
          </div>

          {/* Section 1: Kellner-Schichtabrechnung (Z-Bon pro Kellner) */}
          <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-400" />
              <span>Kellner-Schichtabrechnung (Z-Bon pro Bedienung)</span>
            </h3>

            {reports.waiters.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">Noch keine Buchungen getätigt.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="text-[11px] uppercase font-bold text-slate-400 border-b border-slate-800 bg-slate-950">
                    <tr>
                      <th className="py-2.5 px-3">Bedienung</th>
                      <th className="py-2.5 px-3 text-right">Transaktionen</th>
                      <th className="py-2.5 px-3 text-right text-emerald-400">Bargeld (Ist)</th>
                      <th className="py-2.5 px-3 text-right text-blue-400">Kartenzahlung</th>
                      <th className="py-2.5 px-3 text-right text-amber-400">Trinkgeld</th>
                      <th className="py-2.5 px-3 text-right text-rose-400">Rückpfand</th>
                      <th className="py-2.5 px-3 text-right font-black">Abrechnungssumme</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {reports.waiters.map((w: any) => (
                      <tr key={w.waiterName} className="hover:bg-slate-800/50">
                        <td className="py-3 px-3 font-bold text-white">{w.waiterName}</td>
                        <td className="py-3 px-3 text-right font-mono">{w.transactionCount}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                          {formatCurrency(w.cashGross)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-blue-400">
                          {formatCurrency(w.cardGross)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-amber-400">
                          {formatCurrency(w.tips)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-rose-400">
                          -{formatCurrency(w.depositReturned)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-white">
                          {formatCurrency(w.cashGross + w.cardGross)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 2: Renner- & Penner-Statistik (Bestseller) */}
          <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Renner-/Penner-Statistik verkaufter Artikel</span>
            </h3>

            {reports.topProducts.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">Keine Verkaufsdaten vorhanden.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {reports.topProducts.slice(0, 9).map((prod: any, idx: number) => (
                  <div
                    key={prod.name}
                    className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-400">
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="font-bold text-sm text-white">{prod.name}</div>
                        <div className="text-xs text-slate-400 font-mono">
                          {formatCurrency(prod.revenue)}
                        </div>
                      </div>
                    </div>
                    <span className="bg-blue-950 text-blue-300 border border-blue-800 px-2.5 py-1 rounded-xl text-xs font-black font-mono">
                      {prod.quantity}x
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
