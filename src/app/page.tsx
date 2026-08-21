'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Smartphone,
  CreditCard,
  ChefHat,
  Printer,
  ShieldCheck,
  BarChart3,
  HardDrive,
  Users,
  MessageSquare,
  Sparkles,
  Wifi,
  Activity,
  Layers,
} from 'lucide-react';
import { useSocket } from '@/components/providers/socket-provider';

export default function HomePage() {
  const router = useRouter();
  const { isConnected } = useSocket();
  const [config, setConfig] = useState<any>(null);
  const [deviceStats, setDeviceStats] = useState({ online: 0, total: 0 });

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => setConfig(d))
      .catch(() => {});

    fetch('/api/devices')
      .then((r) => r.json())
      .then((devices) => {
        if (Array.isArray(devices)) {
          const online = devices.filter((d) => d.status === 'ONLINE').length;
          setDeviceStats({ online, total: devices.length });
        }
      })
      .catch(() => {});
  }, []);

  const selectRole = (role: string, targetPath: string) => {
    localStorage.setItem('pos_user_role', role);
    router.push(targetPath);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col items-center justify-center max-w-6xl mx-auto w-full">
      {/* Hero Welcome */}
      <div className="text-center mb-8 sm:mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/60 border border-blue-700 text-blue-300 text-xs font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Plattformunabhängig • 100% Offline-Fähig • High-Availability</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-3">
          {config?.name || 'OrderAssist Web'}
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
          Modernes Kassen-, Bestell- und Küchensystem. Wähle deine Station, um sofort loszulegen:
        </p>
      </div>

      {/* Role Selection Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full max-w-4xl mb-8">
        {/* Card 1: Waiter / Bedienung */}
        <button
          onClick={() => selectRole('WAITER', '/waiter')}
          className="pos-touch-btn flex flex-col text-left p-6 rounded-2xl bg-gradient-to-br from-blue-900/40 to-slate-900 border border-blue-700/60 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-900/20 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
            <Smartphone className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">
            Bedienung / Service
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm">
            Tischübersicht, mobile Bestellaufnahme mit Sonderwünschen, Rechnungs-Splitting und Rückpfand.
          </p>
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-semibold text-blue-400">
            <span>Station öffnen →</span>
            <span className="bg-blue-950 px-2 py-0.5 rounded text-[11px] border border-blue-800">Mobile PWA</span>
          </div>
        </button>

        {/* Card 2: Bonkasse / Thekenverkauf */}
        <button
          onClick={() => selectRole('POS_CASHIER', '/pos')}
          className="pos-touch-btn flex flex-col text-left p-6 rounded-2xl bg-gradient-to-br from-emerald-900/40 to-slate-900 border border-emerald-700/60 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-900/20 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
            <CreditCard className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">
            Bonkasse / Theke
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm">
            High-Speed Wertmarken- & Bonverkauf, automatische Kassenlade und synchrone Gegenbons.
          </p>
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-semibold text-emerald-400">
            <span>Kasse starten →</span>
            <span className="bg-emerald-950 px-2 py-0.5 rounded text-[11px] border border-emerald-800">Express</span>
          </div>
        </button>

        {/* Card 3: Kitchen / Küchenmonitor */}
        <button
          onClick={() => selectRole('KITCHEN', '/kitchen')}
          className="pos-touch-btn flex flex-col text-left p-6 rounded-2xl bg-gradient-to-br from-amber-900/40 to-slate-900 border border-amber-700/60 hover:border-amber-500 hover:shadow-xl hover:shadow-amber-900/20 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-600 flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
            <ChefHat className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1 group-hover:text-amber-400 transition-colors">
            Küchenmonitor (KDS)
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm">
            Echtzeit-Auftragsspalten, FIFO- & Tisch-Ansicht, Zeitalarm, Rückstandszähler und Gong.
          </p>
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-semibold text-amber-400">
            <span>KDS öffnen →</span>
            <span className="bg-amber-950 px-2 py-0.5 rounded text-[11px] border border-amber-800">Live Screen</span>
          </div>
        </button>

        {/* Card 4: Administration & Setup */}
        <button
          onClick={() => selectRole('ADMIN', '/admin/products')}
          className="pos-touch-btn flex flex-col text-left p-6 rounded-2xl bg-gradient-to-br from-purple-900/40 to-slate-900 border border-purple-700/60 hover:border-purple-500 hover:shadow-xl hover:shadow-purple-900/20 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-600 flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1 group-hover:text-purple-400 transition-colors">
            Verwaltung & Stammdaten
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm">
            Preislisten, Tischplan-Designer, ESC/POS-Druckergruppen, Lagerbestand und Z-Bon Berichte.
          </p>
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-semibold text-purple-400">
            <span>Verwaltung →</span>
            <span className="bg-purple-950 px-2 py-0.5 rounded text-[11px] border border-purple-800">Admin</span>
          </div>
        </button>

        {/* Card 5: Live Device Dashboard */}
        <button
          onClick={() => selectRole('ADMIN', '/admin/devices')}
          className="pos-touch-btn flex flex-col text-left p-6 rounded-2xl bg-gradient-to-br from-cyan-900/40 to-slate-900 border border-cyan-700/60 hover:border-cyan-500 hover:shadow-xl hover:shadow-cyan-900/20 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-cyan-600 flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
            <Users className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1 group-hover:text-cyan-400 transition-colors">
            Geräteübersicht & Akku
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm">
            Live-Status aller Bedienungen, Akku-Warnung, Online-Uptime und akustischer Suchton (Find My Device).
          </p>
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-semibold text-cyan-400">
            <span>Geräte ({deviceStats.online} online) →</span>
            <span className="bg-cyan-950 px-2 py-0.5 rounded text-[11px] border border-cyan-800">Live</span>
          </div>
        </button>

        {/* Card 6: Virtual Receipt Simulator */}
        <button
          onClick={() => selectRole('ADMIN', '/virtual-printer')}
          className="pos-touch-btn flex flex-col text-left p-6 rounded-2xl bg-gradient-to-br from-rose-900/40 to-slate-900 border border-rose-700/60 hover:border-rose-500 hover:shadow-xl hover:shadow-rose-900/20 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-rose-600 flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
            <Printer className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1 group-hover:text-rose-400 transition-colors">
            Virtueller Drucker-Monitor
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm">
            Live-Vorschau aller gedruckten Küchen-, Ausschank- und Kassenbons direkt im Browser.
          </p>
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-semibold text-rose-400">
            <span>Druck-Simulator →</span>
            <span className="bg-rose-950 px-2 py-0.5 rounded text-[11px] border border-rose-800">ESC/POS</span>
          </div>
        </button>
      </div>

      {/* System Status Footer Pill */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400 bg-slate-900/80 px-4 py-2 rounded-full border border-slate-800">
        <span className="flex items-center gap-1.5">
          <Wifi className="w-3.5 h-3.5 text-blue-400" />
          <span>Server: {isConnected ? 'Verbunden' : 'Wartet auf Verbindung'}</span>
        </span>
        <span>•</span>
        <span className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span>HA-Rolle: {config?.haRole || 'PRIMARY'}</span>
        </span>
        <span>•</span>
        <span className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-amber-400" />
          <span>Währung: {config?.currency || 'EUR'}</span>
        </span>
      </div>
    </div>
  );
}
