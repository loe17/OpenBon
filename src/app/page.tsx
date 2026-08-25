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
  QrCode,
  Lock,
  Terminal,
} from 'lucide-react';
import { useSocket } from '@/components/providers/socket-provider';
import PinModal from '@/components/auth/pin-modal';
import type { EventConfigDTO } from '@/types/domain';

export default function HomePage() {
  const router = useRouter();
  const { isConnected } = useSocket();
  const [config, setConfig] = useState<EventConfigDTO | null>(null);
  const [deviceStats, setDeviceStats] = useState({ online: 0, total: 0 });
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<string>('ADMIN');
  const [pinStationType, setPinStationType] = useState<'ADMIN' | 'POS' | 'KITCHEN' | 'WAITER'>('ADMIN');

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
    setPendingRole(role);
    setPendingPath(targetPath);
    if (role === 'ADMIN') {
      const isAuthed = sessionStorage.getItem('admin_pin_verified') === 'true';
      if (isAuthed) {
        localStorage.setItem('pos_user_role', 'ADMIN');
        router.push(targetPath);
        return;
      }
      setPinStationType('ADMIN');
    } else if (role === 'POS_CASHIER') {
      setPinStationType('POS');
    } else if (role === 'KITCHEN') {
      setPinStationType('KITCHEN');
    } else if (role === 'WAITER') {
      setPinStationType('WAITER');
    }
    setShowPinModal(true);
  };

  const handlePinSuccess = () => {
    if (pendingRole === 'ADMIN') {
      sessionStorage.setItem('admin_pin_verified', 'true');
    }
    setShowPinModal(false);
    localStorage.setItem('pos_user_role', pendingRole);
    if (pendingPath) {
      router.push(pendingPath);
    }
    setPendingPath(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col items-center justify-center max-w-6xl mx-auto w-full">
      {/* Hero Welcome */}
      <div className="text-center mb-8 sm:mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-950/80 border border-blue-700 text-blue-300 text-xs font-bold mb-4 shadow">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Plattformunabhängig • 100% Offline-LAN • Dual-Server Hochverfügbarkeit</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-3">
          {config?.name || 'OpenBon Kassensystem'}
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto font-medium">
          Modernes, offenes Kassen-, Bestell- und Küchensystem. Wähle deine Station, um direkt loszulegen:
        </p>
      </div>

      {/* Role Selection Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full max-w-5xl mb-8">
        {/* Card 1: Waiter / Bedienung */}
        <button
          onClick={() => selectRole('WAITER', '/waiter')}
          className="pos-touch-btn flex flex-col text-left p-6 rounded-3xl bg-slate-900 border border-slate-700 hover:border-blue-500 shadow-xl transition-all group min-h-[220px] justify-between"
        >
          <div>
            <div className="w-14 h-14 rounded-2xl bg-blue-600 border border-blue-500 flex items-center justify-center text-white mb-4 group-hover:scale-105 transition-transform shadow-lg">
              <Smartphone className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-black text-white mb-1.5 group-hover:text-blue-400 transition-colors">
              Bedienung / Service
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Tischübersicht, mobile Bestellaufnahme mit Sonderwünschen, Rechnungs-Splitting und Rückpfand.
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-blue-400 w-full">
            <span>Station öffnen →</span>
            <span className="bg-blue-950 px-2.5 py-1 rounded-lg border border-blue-800 text-[11px]">Mobile PWA</span>
          </div>
        </button>

        {/* Card 2: Bonkasse / Thekenverkauf */}
        <button
          onClick={() => selectRole('POS_CASHIER', '/pos')}
          className="pos-touch-btn flex flex-col text-left p-6 rounded-3xl bg-slate-900 border border-slate-700 hover:border-emerald-500 shadow-xl transition-all group min-h-[220px] justify-between"
        >
          <div>
            <div className="w-14 h-14 rounded-2xl bg-emerald-600 border border-emerald-500 flex items-center justify-center text-white mb-4 group-hover:scale-105 transition-transform shadow-lg">
              <CreditCard className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-black text-white mb-1.5 group-hover:text-emerald-400 transition-colors">
              Bonkasse / Theke
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              High-Speed Wertmarken- & Bonverkauf, automatische Kassenlade und synchrone Gegenbons.
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-emerald-400 w-full">
            <span>Kasse starten →</span>
            <span className="bg-emerald-950 px-2.5 py-1 rounded-lg border border-emerald-800 text-[11px]">Express</span>
          </div>
        </button>

        {/* Card 3: Kitchen / Küchenmonitor */}
        <button
          onClick={() => selectRole('KITCHEN', '/kitchen')}
          className="pos-touch-btn flex flex-col text-left p-6 rounded-3xl bg-slate-900 border border-slate-700 hover:border-amber-500 shadow-xl transition-all group min-h-[220px] justify-between"
        >
          <div>
            <div className="w-14 h-14 rounded-2xl bg-amber-600 border border-amber-500 flex items-center justify-center text-white mb-4 group-hover:scale-105 transition-transform shadow-lg">
              <ChefHat className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-black text-white mb-1.5 group-hover:text-amber-400 transition-colors">
              Küchenmonitor (KDS)
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Echtzeit-Auftragsspalten, FIFO- & Tisch-Ansicht, Wartezeit-Alarm, Rückstandszähler und Gong.
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-amber-400 w-full">
            <span>KDS öffnen →</span>
            <span className="bg-amber-950 px-2.5 py-1 rounded-lg border border-amber-800 text-[11px]">Live Screen</span>
          </div>
        </button>

        {/* Card 4: SB-Bestellterminal (Kiosk) */}
        <button
          onClick={() => selectRole('KIOSK', '/kiosk')}
          className="pos-touch-btn flex flex-col text-left p-6 rounded-3xl bg-slate-900 border border-slate-700 hover:border-cyan-500 shadow-xl transition-all group min-h-[220px] justify-between"
        >
          <div>
            <div className="w-14 h-14 rounded-2xl bg-cyan-600 border border-cyan-500 flex items-center justify-center text-white mb-4 group-hover:scale-105 transition-transform shadow-lg">
              <Terminal className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-black text-white mb-1.5 group-hover:text-cyan-400 transition-colors">
              SB-Terminal (Kiosk)
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Eigenständiges Selbstbedienungs-Terminal für Gäste mit Kartenzahlung und Bon-Ausgabe.
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-cyan-400 w-full">
            <span>Kiosk starten →</span>
            <span className="bg-cyan-950 px-2.5 py-1 rounded-lg border border-cyan-800 text-[11px]">Self-Order</span>
          </div>
        </button>

        {/* Card 5: Administration & Setup (PIN Protected) */}
        <button
          onClick={() => selectRole('ADMIN', '/admin/dashboard')}
          className="pos-touch-btn flex flex-col text-left p-6 rounded-3xl bg-slate-900 border border-slate-700 hover:border-purple-500 shadow-xl transition-all group min-h-[220px] justify-between"
        >
          <div>
            <div className="w-14 h-14 rounded-2xl bg-purple-600 border border-purple-500 flex items-center justify-center text-white mb-4 group-hover:scale-105 transition-transform shadow-lg">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-black text-white mb-1.5 group-hover:text-purple-400 transition-colors flex items-center gap-2">
              <span>Admin Command Center</span>
              <Lock className="w-4 h-4 text-purple-400" />
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Echtzeit-Leitstand, Umsatzprognosen, Preislisten, Tischplan-Designer, Drucker und Z-Bon.
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-purple-400 w-full">
            <span>Leitstand öffnen (PIN) →</span>
            <span className="bg-purple-950 px-2.5 py-1 rounded-lg border border-purple-800 text-[11px]">Admin</span>
          </div>
        </button>

        {/* Card 5: QR-Code Beitritts-Center */}
        <button
          onClick={() => selectRole('ADMIN', '/admin/qr-codes')}
          className="pos-touch-btn flex flex-col text-left p-6 rounded-3xl bg-slate-900 border border-slate-700 hover:border-cyan-500 shadow-xl transition-all group min-h-[220px] justify-between"
        >
          <div>
            <div className="w-14 h-14 rounded-2xl bg-cyan-600 border border-cyan-500 flex items-center justify-center text-white mb-4 group-hover:scale-105 transition-transform shadow-lg">
              <QrCode className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-black text-white mb-1.5 group-hover:text-cyan-400 transition-colors">
              QR-Code Beitritt
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Erstelle Scan-to-Join QR-Codes für Helfer-Smartphones oder drucke sie direkt auf Bondruckern aus.
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-cyan-400 w-full">
            <span>QR-Center öffnen →</span>
            <span className="bg-cyan-950 px-2.5 py-1 rounded-lg border border-cyan-800 text-[11px]">Quick Join</span>
          </div>
        </button>

        {/* Card 6: Virtual Receipt Simulator */}
        <button
          onClick={() => selectRole('ADMIN', '/virtual-printer')}
          className="pos-touch-btn flex flex-col text-left p-6 rounded-3xl bg-slate-900 border border-slate-700 hover:border-rose-500 shadow-xl transition-all group min-h-[220px] justify-between"
        >
          <div>
            <div className="w-14 h-14 rounded-2xl bg-rose-600 border border-rose-500 flex items-center justify-center text-white mb-4 group-hover:scale-105 transition-transform shadow-lg">
              <Printer className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-black text-white mb-1.5 group-hover:text-rose-400 transition-colors">
              Drucker-Monitor
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Live-Vorschau aller gedruckten Küchen-, Ausschank- und Kassenbons direkt im Browser.
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-rose-400 w-full">
            <span>Druck-Simulator →</span>
            <span className="bg-rose-950 px-2.5 py-1 rounded-lg border border-rose-800 text-[11px]">ESC/POS</span>
          </div>
        </button>
      </div>

      {/* System Status Footer Pill */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-slate-300 bg-slate-900 px-5 py-2.5 rounded-full border border-slate-700 shadow-md">
        <span className="flex items-center gap-1.5">
          <Wifi className="w-4 h-4 text-blue-400" />
          <span>Server: {isConnected ? 'Verbunden' : 'Wartet auf Verbindung'}</span>
        </span>
        <span className="text-slate-600">•</span>
        <span className="flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>HA-Rolle: {config?.haRole || 'PRIMARY'}</span>
        </span>
        <span className="text-slate-600">•</span>
        <span className="flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-amber-400" />
          <span>Währung: {config?.currency || 'EUR'}</span>
        </span>
      </div>

      {/* PIN Modal */}
      <PinModal
        isOpen={showPinModal}
        title={
          pinStationType === 'ADMIN'
            ? 'Administrator-PIN eingeben'
            : pinStationType === 'POS'
            ? 'Bonkassen-PIN eingeben'
            : pinStationType === 'KITCHEN'
            ? 'Küchen-PIN eingeben'
            : 'Bedienungs-PIN eingeben'
        }
        stationType={pinStationType}
        onClose={() => setShowPinModal(false)}
        onCancel={() => setShowPinModal(false)}
        onSuccess={handlePinSuccess}
      />
    </div>
  );
}
