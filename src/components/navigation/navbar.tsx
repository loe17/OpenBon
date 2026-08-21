'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSocket } from '../providers/socket-provider';
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
  ShieldAlert,
  GraduationCap,
  HardDrive,
  Users,
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isConnected } = useSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [role, setRole] = useState('WAITER');
  const [trainingMode, setTrainingMode] = useState(false);
  const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(null);

  useEffect(() => {
    const savedRole = localStorage.getItem('pos_user_role') || 'WAITER';
    setRole(savedRole);

    // Fetch training mode state
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.trainingMode !== undefined) {
          setTrainingMode(data.trainingMode);
        }
      })
      .catch(() => {});

    // Read local battery
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

  const switchRole = (newRole: string) => {
    localStorage.setItem('pos_user_role', newRole);
    setRole(newRole);
    setIsOpen(false);
    if (newRole === 'WAITER') router.push('/waiter');
    else if (newRole === 'POS_CASHIER') router.push('/pos');
    else if (newRole === 'KITCHEN') router.push('/kitchen');
    else if (newRole === 'ADMIN') router.push('/admin/products');
  };

  const navLinks = [
    { href: '/waiter', label: 'Bedienung (Tische)', icon: Smartphone, roles: ['WAITER', 'ADMIN'] },
    { href: '/pos', label: 'Bonkasse (Theke)', icon: CreditCard, roles: ['POS_CASHIER', 'ADMIN'] },
    { href: '/kitchen', label: 'Küchenmonitor', icon: ChefHat, roles: ['KITCHEN', 'ADMIN'] },
    { href: '/virtual-printer', label: 'Virtueller Drucker', icon: Printer, roles: ['ADMIN', 'WAITER', 'KITCHEN', 'POS_CASHIER'] },
    { href: '/chat', label: 'Nachrichten / Chat', icon: MessageSquare, roles: ['ADMIN', 'WAITER', 'KITCHEN', 'POS_CASHIER'] },
    { href: '/admin/products', label: 'Preisliste & Artikel', icon: Utensils, roles: ['ADMIN'] },
    { href: '/admin/tables', label: 'Tischplan-Designer', icon: Utensils, roles: ['ADMIN'] },
    { href: '/admin/printers', label: 'Druckereinrichtung', icon: Printer, roles: ['ADMIN'] },
    { href: '/admin/devices', label: 'Geräteübersicht', icon: Users, roles: ['ADMIN'] },
    { href: '/admin/inventory', label: 'Lagerbestand', icon: HardDrive, roles: ['ADMIN'] },
    { href: '/admin/reports', label: 'Auswertungen & Z-Bon', icon: BarChart3, roles: ['ADMIN'] },
    { href: '/admin/settings', label: 'Einstellungen & Backup', icon: Settings, roles: ['ADMIN'] },
  ];

  return (
    <>
      {/* Training Mode Banner */}
      {trainingMode && (
        <div className="bg-amber-500 text-black px-4 py-1.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-inner">
          <GraduationCap className="w-4 h-4 animate-bounce" />
          <span>ÜBUNGSMODUS AKTIV — Keine echten Bons, kein Umsatz</span>
        </div>
      )}

      {/* Main Top Header */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-between h-14 sm:h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
              title="Menü öffnen"
            >
              {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link href="/" className="flex items-center gap-2 font-bold text-base sm:text-lg tracking-tight">
              <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-sm font-black">OA</span>
              <span>OrderAssist Web</span>
            </Link>
          </div>

          {/* Quick status badges */}
          <div className="flex items-center gap-2 sm:gap-4 text-xs">
            {/* Live Connection Pill */}
            <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-full text-slate-300">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
              <span className="hidden sm:inline">{isConnected ? 'Live LAN' : 'Getrennt'}</span>
            </div>

            {/* Battery Indicator */}
            {battery && (
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                  battery.level <= 20 ? 'bg-red-900/80 text-red-200' : 'bg-slate-800 text-slate-300'
                }`}
                title={`Akkustand: ${battery.level}%`}
              >
                {battery.charging ? (
                  <BatteryCharging className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Battery className="w-3.5 h-3.5" />
                )}
                <span>{battery.level}%</span>
              </div>
            )}

            {/* Role Badge */}
            <div className="bg-blue-900/80 text-blue-200 border border-blue-700 px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider text-[10px] sm:text-xs">
              {role === 'WAITER' ? 'Bedienung' : role === 'POS_CASHIER' ? 'Bonkasse' : role === 'KITCHEN' ? 'Küche' : 'Admin'}
            </div>
          </div>
        </div>
      </header>

      {/* Slide-out Navigation Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

          {/* Sidebar */}
          <div className="relative w-80 max-w-[85vw] bg-slate-900 text-white h-full shadow-2xl flex flex-col z-10 border-r border-slate-800 animate-in slide-in-from-left duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">Hauptmenü</h3>
                <p className="text-xs text-slate-400">OrderAssist Kassensystem</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Role Switcher Pills */}
            <div className="p-3 bg-slate-950 border-b border-slate-800">
              <label className="text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-2 block">
                Rolle wechseln:
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
                    onClick={() => switchRole(r.id)}
                    className={`px-2 py-1.5 rounded text-xs font-semibold transition text-center ${
                      role === r.id ? 'bg-blue-600 text-white shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Links */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {navLinks
                .filter((l) => l.roles.includes(role) || role === 'ADMIN')
                .map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 text-slate-400" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-950 text-center text-xs text-slate-500">
              OrderAssist Web v1.0 • Offline Ready
            </div>
          </div>
        </div>
      )}
    </>
  );
}
