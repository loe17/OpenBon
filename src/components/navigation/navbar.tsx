'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSocket } from '../providers/socket-provider';
import FullscreenButton from '../ui/fullscreen-button';
import PinModal from '../auth/pin-modal';
import { APP_VERSION } from '@/lib/version';
import {
  Menu,
  X,
  Smartphone,
  Utensils,
  CreditCard,
  ChefHat,
  Printer,
  BarChart3,
  Settings,
  MessageSquare,
  Radio,
  Battery,
  BatteryCharging,
  ShieldCheck,
  GraduationCap,
  HardDrive,
  Users,
  QrCode,
  Lock,
  Grid,
  Layers,
  Terminal,
  LayoutDashboard,
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isConnected } = useSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [role, setRole] = useState('WAITER');
  const [trainingMode, setTrainingMode] = useState(false);
  const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  useEffect(() => {
    const savedRole = localStorage.getItem('pos_user_role') || 'WAITER';
    setRole(savedRole);

    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.trainingMode !== undefined) {
          setTrainingMode(data.trainingMode);
        }
      })
      .catch(() => {});

    if (typeof window !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any).getBattery().then((b: any) => {
        setBattery({ level: Math.round(b.level * 100), charging: b.charging });
        b.addEventListener('levelchange', () => {
          setBattery({ level: Math.round(b.level * 100), charging: b.charging });
        });
        b.addEventListener('chargingchange', () => {
          setBattery({ level: Math.round(b.level * 100), charging: b.charging });
        });
      });
    }
  }, [pathname]);

  const handleRoleSelection = (targetRole: string) => {
    if (targetRole === 'ADMIN') {
      const isAuthed = sessionStorage.getItem('admin_pin_verified') === 'true';
      if (!isAuthed) {
        setPendingTarget('ADMIN');
        setShowPinModal(true);
        return;
      }
    }
    applyRole(targetRole);
  };

  const applyRole = (newRole: string) => {
    localStorage.setItem('pos_user_role', newRole);
    setRole(newRole);
    setIsOpen(false);
    if (newRole === 'WAITER') router.push('/waiter');
    else if (newRole === 'POS_CASHIER') router.push('/pos');
    else if (newRole === 'KITCHEN') router.push('/kitchen');
    else if (newRole === 'ADMIN') router.push('/admin/dashboard');
  };

  const handleLinkClick = (e: React.MouseEvent, href: string) => {
    if (href.startsWith('/admin')) {
      const isAuthed = sessionStorage.getItem('admin_pin_verified') === 'true';
      if (!isAuthed) {
        e.preventDefault();
        setPendingTarget(href);
        setShowPinModal(true);
        return;
      }
    }
    setIsOpen(false);
  };

  const handlePinSuccess = () => {
    sessionStorage.setItem('admin_pin_verified', 'true');
    setShowPinModal(false);
    if (pendingTarget === 'ADMIN') {
      applyRole('ADMIN');
    } else if (pendingTarget) {
      localStorage.setItem('pos_user_role', 'ADMIN');
      setRole('ADMIN');
      setIsOpen(false);
      router.push(pendingTarget);
    }
    setPendingTarget(null);
  };

  const navLinks = [
    { href: '/admin/dashboard', label: 'Admin Command Center', icon: LayoutDashboard, roles: ['ADMIN'] },
    { href: '/waiter', label: 'Bedienung (Tische)', icon: Smartphone, roles: ['WAITER', 'ADMIN'] },
    { href: '/pos', label: 'Bonkasse (Theke)', icon: CreditCard, roles: ['POS_CASHIER', 'ADMIN'] },
    { href: '/kitchen', label: 'Küchenmonitor', icon: ChefHat, roles: ['KITCHEN', 'ADMIN'] },
    { href: '/virtual-printer', label: 'Virtueller Drucker', icon: Printer, roles: ['ADMIN', 'WAITER', 'KITCHEN', 'POS_CASHIER'] },
    { href: '/chat', label: 'Nachrichten / Chat', icon: MessageSquare, roles: ['ADMIN', 'WAITER', 'KITCHEN', 'POS_CASHIER'] },
    { href: '/admin/products', label: 'Preisliste & Artikel', icon: Utensils, roles: ['ADMIN'] },
    { href: '/admin/tables', label: 'Tischplan-Designer', icon: Grid, roles: ['ADMIN'] },
    { href: '/admin/printers', label: 'Druckereinrichtung', icon: Printer, roles: ['ADMIN'] },
    { href: '/admin/devices', label: 'Geräteübersicht', icon: Users, roles: ['ADMIN'] },
    { href: '/admin/qr-codes', label: 'QR-Code Beitritts-Center', icon: QrCode, roles: ['ADMIN'] },
    { href: '/admin/inventory', label: 'Lagerbestand', icon: HardDrive, roles: ['ADMIN'] },
    { href: '/admin/reports', label: 'Auswertungen & Vorhersagen', icon: BarChart3, roles: ['ADMIN'] },
    { href: '/admin/system-update', label: 'System-Update & Konsole', icon: Terminal, roles: ['ADMIN'] },
    { href: '/admin/settings', label: 'Einstellungen & Backup', icon: Settings, roles: ['ADMIN'] },
  ];

  return (
    <>
      {/* Training Mode Banner */}
      {trainingMode && (
        <div className="bg-amber-500 text-black px-4 py-1.5 text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-inner uppercase tracking-wider">
          <GraduationCap className="w-4 h-4" />
          <span>Übungsmodus aktiv — Keine echten Bons, kein Umsatz</span>
        </div>
      )}

      {/* Main Top Header */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-between h-14 sm:h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition active:scale-95 touch-manipulation"
              title="Menü öffnen"
            >
              {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link href="/" className="flex items-center gap-2 font-black text-lg sm:text-xl tracking-tight">
              <span className="bg-blue-600 text-white px-2 py-0.5 rounded-lg text-xs font-black tracking-wider uppercase shadow">
                OB
              </span>
              <span className="text-white">OpenBon</span>
              <span className="text-[10px] text-slate-400 font-mono font-bold bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                v{APP_VERSION}
              </span>
            </Link>
          </div>

          {/* Controls: Fullscreen, Live Pill, Battery, Role */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs">
            {/* Fullscreen Button */}
            <FullscreenButton />

            {/* Live Connection Pill */}
            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-xl text-slate-300">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="hidden sm:inline font-bold">{isConnected ? 'LAN' : 'Getrennt'}</span>
            </div>

            {/* Battery Indicator */}
            {battery && (
              <div
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border ${
                  battery.level <= 20
                    ? 'bg-rose-950/80 text-rose-300 border-rose-700'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
                title={`Akkustand: ${battery.level}%`}
              >
                {battery.charging ? (
                  <BatteryCharging className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Battery className="w-3.5 h-3.5 text-slate-300" />
                )}
                <span>{battery.level}%</span>
              </div>
            )}

            {/* Role Badge */}
            <div className="bg-blue-950 text-blue-300 border border-blue-700 px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider text-[10px] sm:text-xs shadow">
              {role === 'WAITER' ? 'Bedienung' : role === 'POS_CASHIER' ? 'Bonkasse' : role === 'KITCHEN' ? 'Küche' : 'Admin'}
            </div>
          </div>
        </div>
      </header>

      {/* Slide-out Navigation Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex animate-in fade-in duration-150">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

          {/* Sidebar */}
          <div className="relative w-80 max-w-[85vw] bg-slate-900 text-white h-full shadow-2xl flex flex-col z-10 border-r border-slate-700 animate-in slide-in-from-left duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-lg text-white">Hauptmenü</h3>
                  <span className="text-[10px] font-mono font-bold text-blue-400 bg-blue-950 px-1.5 py-0.5 rounded border border-blue-800">
                    v{APP_VERSION}
                  </span>
                </div>
                <p className="text-xs text-slate-400">OpenBon Kassensystem</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Role Switcher Pills */}
            <div className="p-3 bg-slate-950 border-b border-slate-800">
              <label className="text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-2 block">
                Station wechseln:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'WAITER', label: 'Bedienung' },
                  { id: 'POS_CASHIER', label: 'Bonkasse' },
                  { id: 'KITCHEN', label: 'Küche' },
                  { id: 'ADMIN', label: 'Admin (PIN)' },
                ].map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleRoleSelection(r.id)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition text-center border ${
                      role === r.id
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Links */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {navLinks
                .filter((l) => l.roles.includes(role) || role === 'ADMIN')
                .map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={(e) => handleLinkClick(e, link.href)}
                      className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold transition border ${
                        isActive
                          ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                          : 'text-slate-300 border-transparent hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 text-blue-400" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-950 text-center text-xs text-slate-500 font-medium">
              OpenBon v{APP_VERSION} • 100% Offline Ready
            </div>
          </div>
        </div>
      )}

      {/* PIN Security Modal */}
      <PinModal
        isOpen={showPinModal}
        onClose={() => {
          setShowPinModal(false);
          setPendingTarget(null);
        }}
        onSuccess={handlePinSuccess}
      />
    </>
  );
}
