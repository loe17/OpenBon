'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSocket } from '@/components/providers/socket-provider';
import {
  LayoutDashboard,
  TrendingUp,
  CreditCard,
  Banknote,
  ChefHat,
  Smartphone,
  QrCode,
  Printer,
  ShieldCheck,
  RefreshCw,
  Users,
  HardDrive,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Terminal,
  Activity,
  Layers,
  ArrowUpRight,
  Receipt,
  HeartHandshake,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { APP_VERSION } from '@/lib/version';
import type { ReportSummary, EventConfigDTO } from '@/types/domain';

export default function AdminDashboardPage() {
  const { socket } = useSocket();
  const [reportsData, setReportsData] = useState<ReportSummary | null>(null);
  const [tablesData, setTablesData] = useState<any[]>([]);
  const [kitchenOrders, setKitchenOrders] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [config, setConfig] = useState<EventConfigDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAllDashboardData = async () => {
    try {
      const [repRes, tblRes, kdsRes, devRes, cfgRes] = await Promise.all([
        fetch('/api/reports'),
        fetch('/api/tables'),
        fetch('/api/orders?kds=true'),
        fetch('/api/devices'),
        fetch('/api/config'),
      ]);

      const [rep, tbl, kds, dev, cfg] = await Promise.all([
        repRes.json(),
        tblRes.json(),
        kdsRes.json(),
        devRes.json(),
        cfgRes.json(),
      ]);

      setReportsData(rep);
      if (Array.isArray(tbl)) setTablesData(tbl);
      if (Array.isArray(kds)) setKitchenOrders(kds);
      if (Array.isArray(dev)) setDevices(dev);
      setConfig(cfg);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllDashboardData();

    if (socket) {
      socket.on('order:new', () => fetchAllDashboardData());
      socket.on('payment:completed', () => fetchAllDashboardData());
      socket.on('table:updated', () => fetchAllDashboardData());
      socket.on('device:update', (devs) => {
        if (Array.isArray(devs)) setDevices(devs);
      });
    }

    return () => {
      if (socket) {
        socket.off('order:new');
        socket.off('payment:completed');
        socket.off('table:updated');
        socket.off('device:update');
      }
    };
  }, [socket]);

  const occupiedTables = tablesData.filter((t) => t.openItemCount > 0);
  const openTableGross = occupiedTables.reduce((sum, t) => sum + (t.openGrossAmount || 0), 0);
  const onlineDevices = devices.filter((d) => d.status === 'ONLINE');

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 text-white p-3 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-purple-600 text-white p-2.5 rounded-2xl shadow">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black">Admin Command Center</h1>
              <span className="bg-blue-950 text-blue-300 font-bold px-2.5 py-0.5 rounded-lg text-xs border border-blue-700">
                v{APP_VERSION}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Echtzeit-Leitstand für Umsatz, Auslastung, Küche und Serviceteam
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAllDashboardData}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-200 border border-slate-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Aktualisieren</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Lade Live-Dashboard...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Live KPIs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* KPI 1: Realized Sales */}
            <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Realisierter Umsatz
                </span>
                <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                  {formatCurrency(reportsData?.totalGross || 0)}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between text-xs text-slate-400">
                <span>Bar: {formatCurrency(reportsData?.totalCash || 0)}</span>
                <span>Karte: {formatCurrency(reportsData?.totalCard || 0)}</span>
              </div>
            </div>

            {/* KPI 2: Open Tables Gross */}
            <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Offene Tische (Nicht bezahlt)
                </span>
                <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                  {formatCurrency(openTableGross)}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between text-xs text-slate-400">
                <span>{occupiedTables.length} von {tablesData.length} Tischen belegt</span>
              </div>
            </div>

            {/* KPI 3: Kitchen Backlog */}
            <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Aktive Küchenbons
                </span>
                <div className="text-2xl sm:text-3xl font-black text-blue-400 font-mono">
                  {kitchenOrders.length}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between text-xs text-slate-400">
                <span>Wartezeit-Alarm aktiv</span>
                <Link href="/kitchen" className="text-blue-400 hover:underline font-bold">KDS →</Link>
              </div>
            </div>

            {/* KPI 4: Connected Devices */}
            <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Geräte im Einsatz
                </span>
                <div className="text-2xl sm:text-3xl font-black text-purple-400 font-mono">
                  {onlineDevices.length} Online
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between text-xs text-slate-400">
                <span>{devices.length} Registriert</span>
                <Link href="/admin/devices" className="text-purple-400 hover:underline font-bold">Geräte →</Link>
              </div>
            </div>
          </div>

          {/* Middle Split: Revenue Distribution & Predictive Forecast */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Category Shares & Forecast */}
            <div className="lg:col-span-2 space-y-6">
              {/* Forecast Banner */}
              {reportsData?.forecast && (
                <div className="p-5 bg-gradient-to-r from-blue-950/80 via-purple-950/60 to-slate-900 rounded-3xl border-2 border-blue-500/40 shadow-xl flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-blue-300">
                      <Sparkles className="w-4 h-4" />
                      <span>KI-Umsatzprognose für heute (EOD)</span>
                    </div>
                    <div className="text-3xl sm:text-4xl font-black text-white font-mono">
                      ca. {formatCurrency(reportsData.forecast.projectedEodGross)}
                    </div>
                    <div className="text-xs text-slate-400 font-medium">
                      Hauptansturm (Peak): <span className="text-amber-400 font-bold">{reportsData.forecast.peakHourLabel}</span> • Konfidenz: {reportsData.forecast.confidencePercent}%
                    </div>
                  </div>

                  <Link
                    href="/admin/reports"
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold transition flex items-center gap-1 shadow-lg"
                  >
                    <span>Detail-Analyse</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
              )}

              {/* Category Breakdown */}
              <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl space-y-4">
                <h3 className="text-base font-bold text-white flex items-center justify-between">
                  <span>Warengruppen-Verteilung</span>
                  <span className="text-xs text-slate-400 font-normal">Live nach Umsatz</span>
                </h3>

                <div className="space-y-3">
                  {reportsData?.categoryBreakdown?.map((cat) => (
                    <div key={cat.id}>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span>{cat.name} ({cat.count} Positionen)</span>
                        <span className="font-mono text-emerald-400">{formatCurrency(cat.revenue)} ({cat.percent}%)</span>
                      </div>
                      <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.max(3, cat.percent)}%`, backgroundColor: cat.color || '#3b82f6' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Col: Quick Actions & System Health */}
            <div className="space-y-4">
              {/* System Health */}
              <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl space-y-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>System-Status</span>
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-slate-400">Server-Rolle:</span>
                    <span className="font-bold text-emerald-400">{config?.haRole || 'PRIMARY'}</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-slate-400">Trainingsmodus:</span>
                    <span className={`font-bold ${config?.trainingMode ? 'text-amber-400' : 'text-slate-300'}`}>
                      {config?.trainingMode ? 'AKTIV' : 'Aus (Echter Betrieb)'}
                    </span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-slate-400">mDNS Domain:</span>
                    <span className="font-mono text-blue-400">openbon.local:3000</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl space-y-2.5">
                <h3 className="text-base font-bold text-white mb-2">Schnellzugriff</h3>

                <Link
                  href="/admin/qr-codes"
                  className="w-full p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-200 transition border border-slate-700"
                >
                  <div className="flex items-center gap-2.5">
                    <QrCode className="w-4 h-4 text-blue-400" />
                    <span>QR-Code Beitritts-Center</span>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-500" />
                </Link>

                <Link
                  href="/admin/reports"
                  className="w-full p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-200 transition border border-slate-700"
                >
                  <div className="flex items-center gap-2.5">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span>Statistiken & Z-Bon</span>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-500" />
                </Link>

                <Link
                  href="/admin/settings"
                  className="w-full p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-200 transition border border-slate-700"
                >
                  <div className="flex items-center gap-2.5">
                    <HardDrive className="w-4 h-4 text-amber-400" />
                    <span>Selektives Backup & Export</span>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-500" />
                </Link>

                <Link
                  href="/admin/system-update"
                  className="w-full p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-200 transition border border-slate-700"
                >
                  <div className="flex items-center gap-2.5">
                    <Terminal className="w-4 h-4 text-purple-400" />
                    <span>System-Update & Konsole</span>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-500" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
