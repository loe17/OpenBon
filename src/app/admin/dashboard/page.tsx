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
  Cpu,
} from 'lucide-react';
import { formatCents, formatCurrency } from '@/lib/utils';
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
  const [systemMetrics, setSystemMetrics] = useState<{ cpuPercent: number; ramPercent: number; ramFormatted: string } | null>(null);

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

  // Echtzeit-Hardware-Metriken (400ms Takt) mit Überlappungsschutz
  useEffect(() => {
    let isMounted = true;
    let isFetching = false;
    const fetchMetrics = async () => {
      if (isFetching) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      isFetching = true;
      try {
        const res = await fetch('/api/system/update?metricsOnly=1', {
          signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data?.cpu && data?.memory) {
          setSystemMetrics({
            cpuPercent: data.cpu.usedPercentage ?? 0,
            ramPercent: data.memory.usedPercentage ?? 0,
            ramFormatted: data.memory.formattedUsed ? `${data.memory.formattedUsed} / ${data.memory.formattedTotal}` : `${data.memory.usedPercentage}%`,
          });
        }
      } catch {
        // Leise ignorieren
      } finally {
        isFetching = false;
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 400);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const occupiedTables = tablesData.filter((t) => t.openItemCount > 0);
  const openTableGross = occupiedTables.reduce((sum, t) => sum + (t.openGrossAmount || 0), 0);
  const onlineDevices = devices.filter((d) => d.status === 'ONLINE');

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-white">
      {/* Scrollbarer Inhaltsbereich */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span>Lade Live-Dashboard...</span>
          </div>
        ) : (
          <>
            {/* 4 Kennzahl-Karten (2x2 Raster) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* KPI 1: Realisierter Umsatz */}
              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 shadow flex items-center justify-between gap-3 border-l-4 border-l-emerald-500">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Realisierter Umsatz
                  </span>
                  <div className="text-xs text-slate-400">
                    Bar: {formatCents((reportsData as any)?.totalCashCents ?? Math.round(((reportsData as any)?.totalCash ?? 0) * 100))} · Karte: {formatCents((reportsData as any)?.totalCardCents ?? Math.round(((reportsData as any)?.totalCard ?? 0) * 100))}
                  </div>
                </div>
                <div className="text-[28px] font-black text-emerald-400 font-mono text-right shrink-0">
                  {formatCents((reportsData as any)?.totalGrossCents ?? Math.round(((reportsData as any)?.totalGross ?? 0) * 100))}
                </div>
              </div>

              {/* KPI 2: Offene Tische */}
              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 shadow flex items-center justify-between gap-3 border-l-4 border-l-amber-500">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Offene Tische
                  </span>
                  <div className="text-xs text-slate-400">
                    {occupiedTables.length} von {tablesData.length} Tischen belegt
                  </div>
                </div>
                <div className="text-[28px] font-black text-amber-400 font-mono text-right shrink-0">
                  {formatCents(Math.round(openTableGross * 100))}
                </div>
              </div>

              {/* KPI 3: Aktive Küchenbons */}
              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 shadow flex items-center justify-between gap-3 border-l-4 border-l-blue-500">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Aktive Küchenbons
                  </span>
                  <Link href="/kitchen" className="text-xs text-blue-400 font-bold hover:underline">
                    KDS →
                  </Link>
                </div>
                <div className="text-[28px] font-black text-blue-400 font-mono text-right shrink-0">
                  {kitchenOrders.length}
                </div>
              </div>

              {/* KPI 4: Geräte im Einsatz */}
              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 shadow flex items-center justify-between gap-3 border-l-4 border-l-purple-500">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Geräte im Einsatz
                  </span>
                  <Link href="/admin/devices" className="text-xs text-purple-400 font-bold hover:underline">
                    Geräte →
                  </Link>
                </div>
                <div className="text-[28px] font-black text-purple-400 font-mono text-right shrink-0">
                  {onlineDevices.length} <span className="text-xs text-slate-400 font-normal">/ {devices.length}</span>
                </div>
              </div>
            </div>

            {/* Prognose heute (Volle Breite, eine Zeile mit .admin-forecast-banner) */}
            {reportsData?.forecast && (
              <div className="admin-forecast-banner p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 shadow">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-blue-400 shrink-0" />
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-blue-300 block">
                      Prognose heute
                    </span>
                    <span className="text-xs text-slate-400">
                      Ansturm {reportsData.forecast.peakHourLabel} · {reportsData.forecast.confidencePercent}% Konfidenz
                    </span>
                  </div>
                </div>

                <div className="text-[28px] font-black text-white font-mono shrink-0">
                  ca. {formatCents((reportsData as any).forecast.projectedEodGrossCents ?? Math.round(((reportsData as any).forecast.projectedEodGross ?? 0) * 100))}
                </div>

                <Link
                  href="/admin/reports"
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-[10px] text-xs font-bold transition flex items-center gap-1 shadow shrink-0"
                >
                  <span>Detail-Analyse</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}

            {/* Warengruppen-Verteilung (Volle Breite, Balken 10px) */}
            <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 shadow space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-white">Warengruppen-Verteilung</span>
                <span className="text-slate-400 font-normal">Live nach Umsatz</span>
              </div>

              <div className="space-y-2">
                {reportsData?.categoryBreakdown?.map((cat) => (
                  <div key={cat.id}>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span>{cat.name} ({cat.count} Positionen)</span>
                      <span className="font-mono text-emerald-400">
                        {formatCents((cat as any).revenueCents ?? Math.round(((cat as any).revenue ?? 0) * 100))} ({cat.percent}%)
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/60">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.max(3, cat.percent)}%`, backgroundColor: cat.color || '#3b82f6' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Leiste unten (64 px) */}
      <div className="h-16 min-h-[64px] bg-slate-900 border-t border-slate-800 px-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 shrink-0 shadow-lg">
        {/* Schnellzugriff-Knöpfe nebeneinander */}
        <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 pr-2">
          <Link
            href="/admin/diagnostics"
            className="h-11 px-3 rounded-[10px] border bg-slate-800 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700 flex items-center gap-1.5 text-xs font-bold transition shrink-0"
          >
            <Activity className="w-4 h-4 text-blue-400" />
            <span>Testbetrieb</span>
          </Link>
          <Link
            href="/admin/qr-codes"
            className="h-11 px-3 rounded-[10px] border bg-slate-800 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700 flex items-center gap-1.5 text-xs font-bold transition shrink-0"
          >
            <QrCode className="w-4 h-4 text-blue-400" />
            <span>QR-Codes</span>
          </Link>
          <Link
            href="/admin/reports"
            className="h-11 px-3 rounded-[10px] border bg-slate-800 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700 flex items-center gap-1.5 text-xs font-bold transition shrink-0"
          >
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Berichte</span>
          </Link>
          <Link
            href="/admin/settings"
            className="h-11 px-3 rounded-[10px] border bg-slate-800 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700 flex items-center gap-1.5 text-xs font-bold transition shrink-0"
          >
            <HardDrive className="w-4 h-4 text-amber-400" />
            <span>Backup</span>
          </Link>
          <Link
            href="/admin/system-update"
            className="h-11 px-3 rounded-[10px] border bg-slate-800 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700 flex items-center gap-1.5 text-xs font-bold transition shrink-0"
          >
            <Terminal className="w-4 h-4 text-purple-400" />
            <span>Update</span>
          </Link>
        </div>

        {/* Rechts: System-Status kompakt + Aktualisieren */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-xs text-slate-400 font-medium px-2.5 py-1.5 bg-slate-950 rounded-[10px] border border-slate-800 flex items-center gap-1.5">
            <span className="font-bold text-emerald-400">{config?.haRole || 'PRIMARY'}</span>
            <span>·</span>
            <span>{config?.trainingMode ? 'Trainingsmodus' : 'Echtbetrieb'}</span>
            <span>·</span>
            <span className="font-mono text-slate-300">CPU {systemMetrics?.cpuPercent ?? 0}%</span>
            <span>·</span>
            <span className="font-mono text-slate-300">RAM {systemMetrics?.ramPercent ?? 0}%</span>
          </div>

          <button
            onClick={fetchAllDashboardData}
            className="h-11 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-[10px] text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition active:scale-95"
            title="Aktualisieren"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Aktualisieren</span>
          </button>
        </div>
      </div>
    </div>
  );
}
