'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSocket } from '../providers/socket-provider';
import { useTheme } from '../providers/theme-provider';
import FullscreenButton from '../ui/fullscreen-button';
import PinModal from '../auth/pin-modal';
import { APP_VERSION, APP_IS_BETA } from '@/lib/version';
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
  Sun,
  Moon,
  Server,
  Package,
  Wallet,
  BookOpen,
  Ticket,
  Coins,
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isConnected } = useSocket();
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [role, setRole] = useState('WAITER');
  const [trainingMode, setTrainingMode] = useState(false);
  const [haStatus, setHaStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'STANDALONE'>('STANDALONE');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinTarget, setPinTarget] = useState<'ADMIN' | 'POS_CASHIER' | 'KITCHEN' | 'WAITER' | string>('ADMIN');

  useEffect(() => {
    const savedRole = localStorage.getItem('pos_user_role') || 'WAITER';
    setRole(savedRole);

    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          if (data.trainingMode !== undefined) setTrainingMode(data.trainingMode);
          if (data.haPartnerUrl && data.haPartnerUrl.trim() !== '') {
            // Check heartbeat
            fetch('/api/sync/heartbeat')
              .then((r) => r.json())
              .then((hb) => {
                setHaStatus(hb.partnerConnected ? 'CONNECTED' : 'DISCONNECTED');
              })
              .catch(() => setHaStatus('DISCONNECTED'));
          } else {
            setHaStatus('STANDALONE');
          }
        }
      })
      .catch(() => {});
  }, [pathname]);

  const handleRoleSelection = (targetRole: string) => {
    if (targetRole === 'ADMIN') {
      if (sessionStorage.getItem('admin_pin_verified') !== 'true') {
        setPinTarget('ADMIN');
        setShowPinModal(true);
        return;
      }
    } else if (targetRole === 'POS_CASHIER') {
      if (sessionStorage.getItem('pos_pin_verified') !== 'true') {
        setPinTarget('POS_CASHIER');
        setShowPinModal(true);
        return;
      }
    } else if (targetRole === 'KITCHEN') {
      if (sessionStorage.getItem('kitchen_pin_verified') !== 'true') {
        setPinTarget('KITCHEN');
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
      if (sessionStorage.getItem('admin_pin_verified') !== 'true') {
        e.preventDefault();
        setPinTarget(href);
        setShowPinModal(true);
        return;
      }
    } else if (href === '/pos') {
      if (sessionStorage.getItem('pos_pin_verified') !== 'true') {
        e.preventDefault();
        setPinTarget('/pos');
        setShowPinModal(true);
        return;
      }
    } else if (href === '/kitchen') {
      if (sessionStorage.getItem('kitchen_pin_verified') !== 'true') {
        e.preventDefault();
        setPinTarget('/kitchen');
        setShowPinModal(true);
        return;
      }
    }
    setIsOpen(false);
  };

  const handlePinSuccess = () => {
    setShowPinModal(false);
    if (pinTarget === 'ADMIN' || pinTarget.startsWith('/admin')) {
      sessionStorage.setItem('admin_pin_verified', 'true');
      if (pinTarget === 'ADMIN') applyRole('ADMIN');
      else {
        setIsOpen(false);
        router.push(pinTarget);
      }
    } else if (pinTarget === 'POS_CASHIER' || pinTarget === '/pos') {
      sessionStorage.setItem('pos_pin_verified', 'true');
      applyRole('POS_CASHIER');
    } else if (pinTarget === 'KITCHEN' || pinTarget === '/kitchen') {
      sessionStorage.setItem('kitchen_pin_verified', 'true');
      applyRole('KITCHEN');
    }
  };

  const navLinks = [
    { href: '/admin/dashboard', label: 'Admin Command Center', icon: LayoutDashboard, roles: ['ADMIN'] },
    { href: '/waiter', label: 'Bedienung (Tische)', icon: Smartphone, roles: ['WAITER', 'ADMIN'] },
    { href: '/pos', label: 'Bonkasse (Theke)', icon: CreditCard, roles: ['POS_CASHIER', 'ADMIN'] },
    { href: '/kiosk', label: 'SB-Terminal (Kiosk)', icon: Terminal, roles: ['POS_CASHIER', 'ADMIN'] },
    { href: '/kitchen', label: 'Küchenmonitor', icon: ChefHat, roles: ['KITCHEN', 'ADMIN'] },
    { href: '/chat', label: 'Team-Funk & Notrufe', icon: MessageSquare, roles: ['WAITER', 'POS_CASHIER', 'KITCHEN', 'ADMIN'] },
    { href: '/admin/qr-codes', label: 'QR Beitritts-Center', icon: QrCode, roles: ['ADMIN'] },
    { href: '/admin/products', label: 'Artikel & Warengruppen', icon: Utensils, roles: ['ADMIN'] },
    { href: '/admin/tokens', label: 'Wertmarken & Bons', icon: Ticket, roles: ['ADMIN'] },
    { href: '/admin/tips', label: 'Trinkgeld-Matrix', icon: Coins, roles: ['ADMIN'] },
    { href: '/admin/inventory', label: 'Warenbestand & Lager', icon: Package, roles: ['ADMIN'] },
    { href: '/admin/tables', label: 'Tischplan Designer', icon: Grid, roles: ['ADMIN'] },
    { href: '/admin/printers', label: 'Drucker & Druckgruppen', icon: Printer, roles: ['ADMIN'] },
    { href: '/admin/reports', label: 'Statistik & Z-Bon', icon: BarChart3, roles: ['ADMIN'] },
    { href: '/admin/cashbook', label: 'Kassenbuch & Barverkehr', icon: Wallet, roles: ['ADMIN'] },
    { href: '/admin/accounting', label: 'DATEV Kassenbuch Export', icon: BookOpen, roles: ['ADMIN'] },
    { href: '/admin/fiscal', label: 'DSFinV-K & TSE Archiv', icon: ShieldCheck, roles: ['ADMIN'] },
    { href: '/docs', label: 'Handbuch & Anleitungen', icon: BookOpen, roles: ['WAITER', 'POS_CASHIER', 'KITCHEN', 'ADMIN'] },
    { href: '/admin/devices', label: 'Geräte-Manager', icon: Users, roles: ['ADMIN'] },
    { href: '/admin/system-update', label: 'System-Update', icon: HardDrive, roles: ['ADMIN'] },
    { href: '/admin/settings', label: 'Grundeinstellungen & TSE', icon: Settings, roles: ['ADMIN'] },
  ];

  return (
    <>
      {/* Training Mode Banner */}
      {trainingMode && (
        <div className="bg-amber-500 text-black px-4 py-1 text-center text-xs font-black tracking-wider uppercase flex items-center justify-center gap-2 shadow-md">
          <GraduationCap className="w-4 h-4" />
          <span>Übungsmodus aktiv (Keine echten Buchungen)</span>
        </div>
      )}

      {/* Main Top Header */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 shadow-md">
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
              <span className="text-[10px] text-amber-300 font-mono font-bold bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-700">
                v{APP_VERSION} {APP_IS_BETA ? 'Beta' : ''}
              </span>
            </Link>
          </div>

          {/* Controls: Theme Switcher, Fullscreen, HA Status, Role */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs">
            {/* Theme Switcher */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition active:scale-95"
              title={theme === 'dark' ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-300" />}
            </button>

            {/* Fullscreen Button */}
            <FullscreenButton />

            {/* HA Status Indicator */}
            <div
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border ${
                haStatus === 'CONNECTED'
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                  : haStatus === 'DISCONNECTED'
                  ? 'bg-rose-950/80 text-rose-300 border-rose-700'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title={
                haStatus === 'CONNECTED'
                  ? 'HA Partner verbunden'
                  : haStatus === 'DISCONNECTED'
                  ? 'HA Partner getrennt!'
                  : 'Einzelserver-Betrieb'
              }
            >
              <Server className="w-3.5 h-3.5" />
              <span>{haStatus === 'CONNECTED' ? 'HA OK' : haStatus === 'DISCONNECTED' ? 'HA Offline' : 'Solo'}</span>
            </div>

            {/* Connection Pill */}
            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-xl text-slate-300">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="hidden sm:inline font-bold">{isConnected ? 'Online' : 'Getrennt'}</span>
            </div>

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
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

          <div className="relative w-80 max-w-[85vw] bg-slate-900 text-white h-full shadow-2xl flex flex-col z-10 border-r border-slate-700 animate-in slide-in-from-left duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-lg text-white">Hauptmenü</h3>
                  <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950 px-1.5 py-0.5 rounded border border-amber-800">
                    v{APP_VERSION} Beta
                  </span>
                </div>
                <p className="text-xs text-slate-400">OpenBon Kassen- & Bestellsystem</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Role Switcher */}
            <div className="p-3 bg-slate-950 border-b border-slate-800">
              <label className="text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-2 block">
                Station wechseln (PIN-geschützt):
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'WAITER', label: 'Bedienung' },
                  { id: 'POS_CASHIER', label: 'Bonkasse' },
                  { id: 'KITCHEN', label: 'Küche' },
                  { id: 'ADMIN', label: 'Admin' },
                ].map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleRoleSelection(r.id)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition text-center border ${
                      role === r.id
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation Links */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              <div className="px-3 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Funktionsbereiche
              </div>
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={(e) => handleLinkClick(e, link.href)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{link.label}</span>
                    </div>
                    {(link.href.startsWith('/admin') || link.href === '/pos' || link.href === '/kitchen') && (
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-950 text-center text-[11px] text-slate-500">
              OpenBon v{APP_VERSION} Beta (Nutzung ohne Gewähr)
            </div>
          </div>
        </div>
      )}

      {/* PIN Verification Modal */}
      <PinModal
        isOpen={showPinModal}
        title={
          pinTarget === 'ADMIN' || pinTarget.startsWith('/admin')
            ? 'Administrator PIN eingeben'
            : pinTarget === 'POS_CASHIER' || pinTarget === '/pos'
            ? 'Bonkassen PIN eingeben'
            : 'Küchen PIN eingeben'
        }
        stationType={
          pinTarget === 'ADMIN' || pinTarget.startsWith('/admin')
            ? 'ADMIN'
            : pinTarget === 'POS_CASHIER' || pinTarget === '/pos'
            ? 'POS'
            : 'KITCHEN'
        }
        onSuccess={handlePinSuccess}
        onCancel={() => setShowPinModal(false)}
      />
    </>
  );
}
