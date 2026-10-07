'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSocket } from '../providers/socket-provider';
import { useTheme, AVAILABLE_THEMES } from '../providers/theme-provider';
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
  Zap,
  Square,
  LayoutGrid,
  Check,
  Package,
  Boxes,
  Wallet,
  BookOpen,
  Ticket,
  Coins,
  Beer,
  Truck,
  Monitor,
  ChevronDown,
  Sparkles,
  Activity,
  Scaling,
  Clock,
  Globe,
  ShieldAlert,
} from 'lucide-react';
import { calculateMinBirthdate } from '@/lib/compliance';

interface NavItem {
  href: string;
  label: string;
  icon: any;
  roles: string[];
}

interface NavGroup {
  id: string;
  label: string;
  icon: any;
  items: NavItem[];
}

// Navigationsgruppen für den Admin-Bereich: 4 klare, übersichtliche Hauptbereiche
const adminGroups: NavGroup[] = [
  {
    id: 'inventory',
    label: 'Sortiment & Warenwirtschaft',
    icon: Package,
    items: [
      { href: '/admin/products', label: 'Artikel & Speisekarte', icon: Utensils, roles: ['ADMIN'] },
      { href: '/admin/inventory', label: 'Warenbestand je Artikel', icon: Package, roles: ['ADMIN'] },
      { href: '/admin/stock-units', label: 'Lagerposten & Verbrauch', icon: Boxes, roles: ['ADMIN'] },
      { href: '/taps', label: 'Fass- & Schankmonitor', icon: Beer, roles: ['ADMIN'] },
      { href: '/admin/procurement', label: 'Lieferanten-Bestellvorschlag', icon: Truck, roles: ['ADMIN'] },
    ],
  },
  {
    id: 'finance',
    label: 'Kasse, Abrechnung & Finanzen',
    icon: Wallet,
    items: [
      { href: '/admin/reports', label: 'Berichte, Statistik & Z-Bon', icon: BarChart3, roles: ['ADMIN'] },
      { href: '/admin/cashbook', label: 'Kassenbuch & Barverkehr', icon: Wallet, roles: ['ADMIN'] },
      { href: '/admin/settle', label: 'Personal & Schichtabrechnung', icon: Coins, roles: ['ADMIN'] },
      { href: '/admin/accounting', label: 'DATEV Kassenbuch Export', icon: BookOpen, roles: ['ADMIN'] },
      { href: '/admin/fiscal', label: 'DSFinV-K & TSE Archiv (Beta)', icon: ShieldCheck, roles: ['ADMIN'] },
      { href: '/admin/tokens', label: 'Wertmarken & Bons', icon: Ticket, roles: ['ADMIN'] },
    ],
  },
  {
    id: 'hardware',
    label: 'Geräte, Tische & Hardware',
    icon: Printer,
    items: [
      { href: '/admin/tables', label: 'Tischplan Designer', icon: Grid, roles: ['ADMIN'] },
      { href: '/admin/printers', label: 'Drucker & Druckgruppen', icon: Printer, roles: ['ADMIN'] },
      { href: '/admin/virtual-printer', label: 'Virtueller Drucker-Monitor', icon: Terminal, roles: ['ADMIN'] },
      { href: '/admin/devices', label: 'Geräte-Manager', icon: Users, roles: ['ADMIN'] },
      { href: '/admin/qr-codes', label: 'QR Beitritts-Center', icon: QrCode, roles: ['ADMIN'] },
    ],
  },
  {
    id: 'system',
    label: 'System & Verwaltung',
    icon: Settings,
    items: [
      { href: '/admin/dashboard', label: 'Admin Command Center', icon: LayoutDashboard, roles: ['ADMIN'] },
      { href: '/admin/settings', label: 'Grundeinstellungen & Bon-Design', icon: Settings, roles: ['ADMIN'] },
      { href: '/admin/backup', label: 'Datensicherung & Auto-Backup', icon: ShieldCheck, roles: ['ADMIN'] },
      { href: '/admin/system-update', label: 'System-Update & Konsole', icon: HardDrive, roles: ['ADMIN'] },
      { href: '/admin/diagnostics', label: 'Testbetrieb & Hardware-Diagnose', icon: Activity, roles: ['ADMIN'] },
      { href: '/admin/logs', label: 'System- & Revisionsprotokoll', icon: BookOpen, roles: ['ADMIN'] },
      { href: '/chat', label: 'Team-Funk & Notrufe', icon: MessageSquare, roles: ['ADMIN'] },
      { href: '/admin/docs', label: 'Handbuch & Anleitungen', icon: BookOpen, roles: ['ADMIN'] },
    ],
  },
];

// Einzel-Links für nicht-Admin Rollen
const nonAdminLinks: Record<string, NavItem[]> = {
  WAITER: [
    { href: '/waiter', label: 'Bedienung (Tischübersicht)', icon: Smartphone, roles: ['WAITER'] },
    { href: '/chat', label: 'Team-Funk & Notrufe', icon: MessageSquare, roles: ['WAITER'] },
  ],
  POS_CASHIER: [
    { href: '/pos', label: 'Bonkasse (Thekenverkauf)', icon: CreditCard, roles: ['POS_CASHIER'] },
    { href: '/customer-display', label: 'Kundendisplay', icon: Monitor, roles: ['POS_CASHIER'] },
    { href: '/chat', label: 'Team-Funk & Notrufe', icon: MessageSquare, roles: ['POS_CASHIER'] },
  ],
  KIOSK: [
    { href: '/kiosk', label: 'SB-Bestellterminal', icon: Terminal, roles: ['KIOSK'] },
  ],
  KITCHEN: [
    { href: '/kitchen', label: 'Küchenmonitor', icon: ChefHat, roles: ['KITCHEN'] },
    { href: '/chat', label: 'Team-Funk & Notrufe', icon: MessageSquare, roles: ['KITCHEN'] },
  ],
};

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isConnected } = useSocket();
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [role, setRole] = useState('WAITER');
  const [trainingMode, setTrainingMode] = useState(false);
  const [haStatus, setHaStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'STANDALONE'>('STANDALONE');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinTarget, setPinTarget] = useState<'ADMIN' | 'POS_CASHIER' | 'KITCHEN' | 'WAITER' | string>('ADMIN');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [pendingOutboxCount, setPendingOutboxCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [isAutoFit, setIsAutoFit] = useState(false);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const { socket } = useSocket();

  const [posStationName, setPosStationName] = useState('Bonkasse 1');
  const [posLowStock, setPosLowStock] = useState<string | null>(null);
  const [kdsCount, setKdsCount] = useState<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedName = localStorage.getItem('openbon_pos_name') || 'Bonkasse 1';
    setPosStationName(savedName);

    const onStationChange = (e: any) => {
      if (e.detail) setPosStationName(e.detail);
      else setPosStationName(localStorage.getItem('openbon_pos_name') || 'Bonkasse 1');
    };
    const onLowStock = (e: any) => {
      setPosLowStock(e.detail || null);
    };
    const onKdsCount = (e: any) => {
      if (typeof e.detail === 'number') setKdsCount(e.detail);
    };
    const onOpenMenu = () => setIsOpen(true);

    window.addEventListener('openbon:pos_station_changed', onStationChange);
    window.addEventListener('openbon:pos_low_stock', onLowStock);
    window.addEventListener('openbon:kds_active_count', onKdsCount);
    window.addEventListener('openbon:open_menu', onOpenMenu);

    return () => {
      window.removeEventListener('openbon:pos_station_changed', onStationChange);
      window.removeEventListener('openbon:pos_low_stock', onLowStock);
      window.removeEventListener('openbon:kds_active_count', onKdsCount);
      window.removeEventListener('openbon:open_menu', onOpenMenu);
    };
  }, []);

  const minBirth16 = calculateMinBirthdate(16);
  const minBirth18 = calculateMinBirthdate(18);

  const getAdminTitle = (path: string) => {
    if (path === '/admin' || path === '/admin/dashboard') return 'Command Center';
    if (path.startsWith('/admin/products')) return 'Artikel & Speisekarte';
    if (path.startsWith('/admin/inventory')) return 'Warenbestand';
    if (path.startsWith('/admin/stock-units')) return 'Lagerposten';
    if (path.startsWith('/admin/procurement')) return 'Bestellvorschlag';
    if (path.startsWith('/admin/reports')) return 'Berichte & Statistik';
    if (path.startsWith('/admin/cashbook')) return 'Kassenbuch';
    if (path.startsWith('/admin/settle')) return 'Schichtabrechnung';
    if (path.startsWith('/admin/accounting')) return 'DATEV Export';
    if (path.startsWith('/admin/fiscal')) return 'DSFinV-K & TSE';
    if (path.startsWith('/admin/tokens')) return 'Wertmarken & Bons';
    if (path.startsWith('/admin/devices')) return 'Geräte & Hardware';
    if (path.startsWith('/admin/tables')) return 'Tische & Bereiche';
    if (path.startsWith('/admin/printers')) return 'Drucker';
    if (path.startsWith('/admin/customer-cards')) return 'Kundenkarten';
    if (path.startsWith('/admin/security')) return 'Sicherheit & PINs';
    if (path.startsWith('/admin/settings')) return 'Kasseneinstellungen';
    if (path.startsWith('/admin/diagnostics')) return 'Testbetrieb & Hardware';
    if (path.startsWith('/admin/backup')) return 'Backup & Wiederherstellung';
    if (path.startsWith('/admin/logs')) return 'System- & Fehlerprotokoll';
    if (path.startsWith('/admin/qr-codes')) return 'QR-Codes';
    return 'Command Center';
  };

  const getOtherPageTitle = (path: string) => {
    if (path === '/kiosk') return 'SB-Bestellterminal';
    if (path === '/customer-display') return 'Kundendisplay';
    if (path === '/chat') return 'Team-Funk';
    if (path === '/taps') return 'Fass- & Schankmonitor';
    if (path === '/order') return 'Gast-Bestellung';
    if (path === '/receipt') return 'Digitaler Beleg';
    if (path === '/docs') return 'Dokumentation';
    if (path === '/') return 'Hauptmenü';
    return 'OpenBon';
  };

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    const getSessionStart = () => {
      if (typeof window === 'undefined') return 0;
      let sessionStart = Number(sessionStorage.getItem('openbon_session_start') || 0);
      if (!sessionStart) {
        sessionStart = Date.now();
        sessionStorage.setItem('openbon_session_start', String(sessionStart));
      }
      return sessionStart;
    };

    const checkUnread = (msgs?: any[]) => {
      const sessionStart = getSessionStart();
      const lastReadLocal = typeof window !== 'undefined' ? Number(localStorage.getItem('openbon_chat_last_read') || 0) : 0;
      const effectiveCutoff = Math.max(lastReadLocal, sessionStart);

      if (pathname === '/chat') {
        if (typeof window !== 'undefined') {
          localStorage.setItem('openbon_chat_last_read', String(Date.now()));
        }
        setHasUnreadChat(false);
        return;
      }
      if (Array.isArray(msgs)) {
        // Nur neue Nachrichten werten, die NACH dem Anmeldezeitpunkt / letzten Lesen eingetroffen sind
        const unread = msgs.some((m: any) => !m.isRead && new Date(m.createdAt).getTime() > effectiveCutoff);
        setHasUnreadChat(unread);
      }
    };

    fetch('/api/chat')
      .then((r) => (r.ok ? r.json() : []))
      .then((msgs) => {
        checkUnread(msgs);
      })
      .catch(() => {});

    const handleReadEvent = () => setHasUnreadChat(false);
    if (typeof window !== 'undefined') {
      window.addEventListener('openbon:chat_read', handleReadEvent);
    }

    if (!socket) {
      return () => {
        if (typeof window !== 'undefined') {
          window.removeEventListener('openbon:chat_read', handleReadEvent);
        }
      };
    }

    const handleChat = (msg: any) => {
      if (pathname === '/chat') {
        if (typeof window !== 'undefined') {
          localStorage.setItem('openbon_chat_last_read', String(Date.now()));
        }
        setHasUnreadChat(false);
      } else {
        const sessionStart = getSessionStart();
        const msgTime = msg?.createdAt ? new Date(msg.createdAt).getTime() : Date.now();
        if (msgTime >= sessionStart) {
          setHasUnreadChat(true);
        }
      }
    };
    socket.on('chat:incoming', handleChat);
    socket.on('chat:message', handleChat);
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('openbon:chat_read', handleReadEvent);
      }
      socket.off('chat:incoming', handleChat);
      socket.off('chat:message', handleChat);
    };
  }, [socket, pathname]);

  useEffect(() => {
    if (pathname === '/chat') {
      if (typeof window !== 'undefined') {
        localStorage.setItem('openbon_chat_last_read', String(Date.now()));
      }
      setHasUnreadChat(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsAutoFit(localStorage.getItem('openbon_autofit_screen') === '1');
    }
  }, []);

  const toggleAutoFit = () => {
    const next = !isAutoFit;
    setIsAutoFit(next);
    localStorage.setItem('openbon_autofit_screen', next ? '1' : '0');
    window.dispatchEvent(new CustomEvent('openbon:autofit_changed', { detail: next }));
  };

  // Outbox & Online Tracker
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    let unsub = () => {};
    try {
      // subscribeToOutbox liefert den aktuellen Stand sofort beim Abonnieren mit;
      // ein zusaetzlicher Einzelabruf ist nicht noetig.
      const { subscribeToOutbox } = require('@/lib/offline/outbox');
      unsub = subscribeToOutbox((count: number, failed: number) =>
        setPendingOutboxCount(count + failed)
      );
    } catch {}

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsub();
    };
  }, []);

  // Expanded Group State in Admin Drawer: Standardmäßig nur Sortiment & Warenwirtschaft ausgeklappt, Zustand dauerhaft merken
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    inventory: true,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('openbon_admin_open_groups');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          setOpenGroups(parsed);
        }
      }
    } catch {}
  }, []);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => {
      const isCurrentlyOpen = Boolean(prev[groupId]);
      const next = { ...prev, [groupId]: !isCurrentlyOpen };
      try {
        localStorage.setItem('openbon_admin_open_groups', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Track Fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const savedRole = localStorage.getItem('pos_user_role') || 'WAITER';
    setRole(savedRole);

    fetch('/api/config/public')
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          if (data.serverTimestamp) {
            setServerTimeOffset(data.serverTimestamp - Date.now());
          }
          if (data.trainingMode !== undefined) setTrainingMode(data.trainingMode);
          if (data.haPartnerUrl && data.haPartnerUrl.trim() !== '') {
            fetch('/api/system/ha/status')
              .then((r) => r.json())
              .then((ha) => {
                const isConnected = Boolean(ha.partnerUrl && (ha.missedHeartbeats ?? 0) < 3);
                setHaStatus(isConnected ? 'CONNECTED' : 'DISCONNECTED');
              })
              .catch(() => setHaStatus('DISCONNECTED'));
          } else {
            setHaStatus('STANDALONE');
          }
        }
      })
      .catch(() => {});
  }, [pathname]);

  // Kassen-Uhrzeit (Serverzeit-Synchronisation für den Admin-Bereich)
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentTime(new Date(Date.now() + serverTimeOffset));
    const timer = setInterval(() => {
      setCurrentTime(new Date(Date.now() + serverTimeOffset));
    }, 1000);
    return () => clearInterval(timer);
  }, [serverTimeOffset]);

  const formattedServerTime = currentTime
    ? currentTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';
  const formattedServerDate = currentTime
    ? currentTime.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  // Spec: Internet-Statusanzeige nur im Adminbereich (45s Polling)
  const [isInternetOnline, setIsInternetOnline] = useState<boolean | null>(null);

  useEffect(() => {
    if (!pathname.startsWith('/admin')) {
      setIsInternetOnline(null);
      return;
    }

    let isMounted = true;
    const checkInternet = async () => {
      try {
        const res = await fetch('/api/system/internet', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setIsInternetOnline(Boolean(data.online));
        }
      } catch {
        if (isMounted) setIsInternetOnline(false);
      }
    };

    checkInternet();
    const interval = setInterval(checkInternet, 45000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [pathname]);

  // Bei jedem Stationswechsel PIN immer abfragen
  const handleRoleSelection = (targetRole: string) => {
    setIsOpen(false);
    if (targetRole === role) return;

    if (typeof window !== 'undefined' && (window as any).__openbon_dirty_handler) {
      const targetPath =
        targetRole === 'WAITER' ? '/waiter' :
        targetRole === 'POS_CASHIER' ? '/pos' :
        targetRole === 'KITCHEN' ? '/kitchen' :
        '/admin/dashboard';
      const handled = (window as any).__openbon_dirty_handler(targetPath);
      if (handled) return;
    }

    if (targetRole === 'ADMIN') {
      setPinTarget('ADMIN');
      setShowPinModal(true);
      return;
    } else if (targetRole === 'POS_CASHIER') {
      setPinTarget('POS');
      setShowPinModal(true);
      return;
    } else if (targetRole === 'KITCHEN') {
      setPinTarget('KITCHEN');
      setShowPinModal(true);
      return;
    } else if (targetRole === 'WAITER') {
      setPinTarget('WAITER');
      setShowPinModal(true);
      return;
    }
    applyRole(targetRole);
  };

  const [pendingAdminPath, setPendingAdminPath] = useState<string | null>(null);

  const applyRole = (newRole: string) => {
    if (typeof window !== 'undefined' && (window as any).__openbon_dirty_handler) {
      const targetPath =
        newRole === 'WAITER' ? '/waiter' :
        newRole === 'POS_CASHIER' ? '/pos' :
        newRole === 'KITCHEN' ? '/kitchen' :
        '/admin/dashboard';
      setIsOpen(false);
      const handled = (window as any).__openbon_dirty_handler(targetPath);
      if (handled) return;
    }

    localStorage.setItem('pos_user_role', newRole);
    setRole(newRole);
    setIsOpen(false);
    if (newRole === 'WAITER') router.push('/waiter');
    else if (newRole === 'POS_CASHIER') router.push('/pos');
    else if (newRole === 'KITCHEN') router.push('/kitchen');
    else if (newRole === 'ADMIN') {
      if (pendingAdminPath) {
        const dest = pendingAdminPath;
        setPendingAdminPath(null);
        router.push(dest);
      } else if (!pathname.startsWith('/admin')) {
        router.push('/admin/dashboard');
      }
    }
  };

  const handlePinSuccess = () => {
    setShowPinModal(false);
    if (pinTarget === 'ADMIN') {
      applyRole('ADMIN');
    } else if (pinTarget === 'POS') {
      applyRole('POS_CASHIER');
    } else if (pinTarget === 'KITCHEN') {
      applyRole('KITCHEN');
    } else if (pinTarget === 'WAITER') {
      applyRole('WAITER');
    }
  };

  return (
    <>
      {/* Training Mode Banner */}
      {trainingMode && (
        <div className="bg-amber-500 text-black px-4 py-1 text-center text-xs font-black tracking-wider uppercase flex items-center justify-center gap-2 shadow-md">
          <GraduationCap className="w-4 h-4" />
          <span>Übungsmodus aktiv (Keine echten Buchungen)</span>
        </div>
      )}

      {/* Main Top Header (46px - Redesign 2b) - Nicht auf Kellner-Mobilansicht anzeigen */}
      {!pathname.startsWith('/waiter') && (
        <header className="sticky top-0 z-50 h-[46px] flex-none flex items-center justify-between gap-2.5 px-3 bg-slate-900 text-white border-b border-slate-800 shadow-sm select-none">
          {/* Links: Menü 32x32 · OpenBon · / · Seitenname · Zusatzinfo */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition active:scale-95 touch-manipulation flex items-center justify-center shrink-0 relative"
              title="Menü öffnen"
              aria-label="Menü öffnen"
            >
              {isOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              {hasUnreadChat && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-slate-900 animate-pulse shadow shadow-rose-950" />
              )}
            </button>

            <Link href="/" className="flex items-center gap-2 font-['Plus_Jakarta_Sans',sans-serif] font-extrabold text-[16px] tracking-tight text-white hover:opacity-90 shrink-0">
              <span>OpenBon</span>
            </Link>

            <span className="text-slate-600 font-normal shrink-0 select-none">/</span>

            {/* Seitenbezogener Name */}
            {pathname === '/pos' ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-bold text-[14px] text-white">{posStationName}</span>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('openbon:open_station_modal'))}
                  className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                  title="Kassenname ändern"
                >
                  Ändern
                </button>
              </div>
            ) : pathname === '/kitchen' ? (
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold text-[14px] text-white">Küche &amp; Schank</span>
                <span className="text-[12px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">{kdsCount} aktiv</span>
              </div>
            ) : pathname.startsWith('/admin') ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-bold text-[14px] text-white">{getAdminTitle(pathname)}</span>
                <span className="text-[11px] font-semibold text-slate-400 bg-slate-800/70 px-2 py-0.5 rounded-full border border-slate-700/60">
                  v{APP_VERSION}{APP_IS_BETA ? ' Beta' : ''}
                </span>
              </div>
            ) : (
              <span className="font-bold text-[14px] text-white truncate">{getOtherPageTitle(pathname)}</span>
            )}
          </div>

          {/* Mitte / Seitenbezogene Zusatzinfo */}
          <div className="flex-1 flex items-center justify-end gap-3 min-w-0 pr-2">
            {pathname === '/pos' && (
              <div className="hidden lg:flex items-center gap-3 shrink-0">
                {posLowStock && (
                  <span className="text-[12px] font-bold text-amber-300 flex items-center gap-1.5 bg-amber-950/60 border border-amber-800 px-2.5 py-1 rounded-md">
                    <Package className="w-3.5 h-3.5 text-amber-400" />
                    <span>{posLowStock}</span>
                  </span>
                )}
                <span className="font-mono text-[12px] text-slate-300 flex items-center gap-1.5 px-2 select-none">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>16 <b className="text-amber-400 font-bold">≤{minBirth16.formattedDate}</b></span>
                  <span>18 <b className="text-rose-400 font-bold">≤{minBirth18.formattedDate}</b></span>
                </span>
              </div>
            )}

            {pathname.startsWith('/admin') && (
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                {formattedServerTime && (
                  <div
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-700/80 bg-slate-800/80 text-slate-200 font-mono font-bold text-xs shadow-sm select-none"
                    title={`Kassen-Uhrzeit (OpenBon Server): ${formattedServerDate}, ${formattedServerTime} Uhr`}
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                    <span>{formattedServerTime}</span>
                  </div>
                )}
                {isInternetOnline !== null && (
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-lg border transition cursor-default ${
                      isInternetOnline
                        ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                        : 'bg-amber-950/70 border-amber-800 text-amber-300'
                    }`}
                    title={isInternetOnline ? 'Internetverbindung aktiv' : 'Kein Internet'}
                    aria-label={isInternetOnline ? 'Internet online' : 'Kein Internet'}
                  >
                    <div className="relative flex items-center justify-center">
                      <Globe className="w-4 h-4" />
                      <span
                        className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ring-1 ring-slate-900 ${
                          isInternetOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rechts (Reihenfolge: Hell/Dunkel 32x32 · Vollbild 32x32 · Extern öffnen 32x32 · Status-Pille · ADMIN) */}
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs shrink-0">
            {/* Offline / Outbox Status Badge */}
            {(!isOnline || pendingOutboxCount > 0) && (
              <div
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border font-bold text-[11px] animate-pulse ${
                  !isOnline
                    ? 'bg-rose-950/80 border-rose-700 text-rose-300'
                    : 'bg-amber-950/80 border-amber-700 text-amber-300'
                }`}
                title={!isOnline ? 'Offline: Vorgänge werden lokal gespeichert' : `${pendingOutboxCount} Vorgänge in der Warteschlange`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${!isOnline ? 'bg-rose-500' : 'bg-amber-400'}`} />
                <span>{!isOnline ? 'Offline' : `${pendingOutboxCount} wartend`}</span>
              </div>
            )}

            {/* Theme Switcher (32x32) */}
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition active:scale-95 flex items-center justify-center"
              title={theme === 'light' ? 'Dunkelmodus aktivieren' : 'Hellmodus aktivieren'}
              aria-label="Farbschema wechseln"
            >
              {theme === 'light' ? <Moon className="w-4 h-4 text-blue-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </button>

            {/* Fullscreen Button (32x32) */}
            <FullscreenButton className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition active:scale-95 touch-manipulation flex items-center justify-center" />

            {/* Kassen- & Server-Verbindungsstatus (h 32, 12 px 700) */}
            <div
              className={`h-8 px-2.5 rounded-lg border text-[12px] font-bold flex items-center gap-1.5 transition select-none ${
                !isConnected
                  ? 'bg-rose-950/80 text-rose-300 border-rose-700'
                  : haStatus === 'CONNECTED'
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                  : haStatus === 'DISCONNECTED'
                  ? 'bg-amber-950/80 text-amber-300 border-amber-700'
                  : 'bg-slate-800/90 text-slate-200 border-slate-700'
              }`}
              title={
                !isConnected
                  ? 'Verbindung zum Kassen-Server getrennt!'
                  : haStatus === 'CONNECTED'
                  ? 'HA Verbund aktiv & synchronisiert'
                  : haStatus === 'DISCONNECTED'
                  ? 'HA Partner getrennt!'
                  : 'Kassen-Server verbunden & bereit'
              }
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  !isConnected
                    ? 'bg-rose-500'
                    : haStatus === 'DISCONNECTED'
                    ? 'bg-amber-400'
                    : 'bg-emerald-400 animate-pulse'
                }`}
              />
              <span className="hidden md:inline">
                {!isConnected
                  ? 'Getrennt'
                  : haStatus === 'CONNECTED'
                  ? 'HA OK'
                  : haStatus === 'DISCONNECTED'
                  ? 'HA Offline'
                  : 'Kasse'}
              </span>
            </div>

            {/* ADMIN Button (h 32, 12 px 800, tracking .06em) */}
            <button
              type="button"
              onClick={() => {
                if (role === 'ADMIN') {
                  router.push('/admin/dashboard');
                } else {
                  setPinTarget('ADMIN');
                  setShowPinModal(true);
                }
              }}
              className="h-8 px-3 rounded-lg bg-blue-950 hover:bg-blue-900 border border-blue-600 text-blue-300 font-extrabold text-[12px] tracking-[0.06em] flex items-center justify-center transition active:scale-95"
              title="Zum Admin Command Center wechseln (PIN-geschützt)"
            >
              ADMIN
            </button>
          </div>
        </header>
      )}

      {/* Slide-out Navigation Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex animate-in fade-in duration-150">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

          <div className="relative w-84 max-w-[88vw] bg-slate-900 text-white h-full shadow-2xl flex flex-col z-10 border-r border-slate-700 animate-in slide-in-from-left duration-200 overscroll-contain">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-lg text-white">Hauptmenü</h3>
                  <span className="text-[11px] font-semibold text-slate-400 bg-slate-800/70 px-2 py-0.5 rounded-full border border-slate-700/60">
                    v{APP_VERSION}{APP_IS_BETA ? ' Beta' : ''}
                  </span>
                </div>
                <p className="text-xs text-slate-400">OpenBon Kassen- &amp; Bestellsystem</p>
                <div className="mt-2 bg-blue-950 text-blue-300 border border-blue-700 px-2.5 py-1 rounded-xl font-bold uppercase tracking-wider text-[10px] shadow select-none w-fit">
                  {role === 'WAITER' ? 'Bedienung' : role === 'POS_CASHIER' ? 'Bonkasse' : role === 'KITCHEN' ? 'Küche' : 'Admin'}
                </div>
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

            {/* Navigation Links by Role */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 overscroll-contain">
              {role === 'ADMIN' ? (
                /* Admin Grouped Hubs */
                adminGroups.map((group) => {
                  const isExpanded = Boolean(openGroups[group.id]);
                  return (
                    <div key={group.id} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.id)}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider text-slate-400 hover:text-white transition"
                      >
                        <div className="flex items-center gap-2">
                          <group.icon className="w-3.5 h-3.5 text-blue-400" />
                          <span>{group.label}</span>
                        </div>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {isExpanded && (
                        <div className="space-y-0.5 pl-1.5 border-l-2 border-slate-800 ml-2">
                          {group.items.map((link) => {
                            const Icon = link.icon;
                            const isActive = pathname === link.href;
                            return (
                              <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setIsOpen(false)}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                                  isActive
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                }`}
                              >
                                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                                <span className="flex-1">{link.label}</span>
                                {link.href === '/chat' && hasUnreadChat && (
                                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse ml-auto" />
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                /* Non-Admin Direct Clean Links */
                <div className="space-y-1">
                  <div className="px-3 py-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Funktionen für {role === 'WAITER' ? 'Bedienung' : role === 'POS_CASHIER' ? 'Bonkasse' : 'Küche'}
                  </div>
                  {(nonAdminLinks[role] || []).map((link) => {
                    const Icon = link.icon;
                    const isActive = pathname === link.href;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span className="flex-1">{link.label}</span>
                        {link.href === '/chat' && hasUnreadChat && (
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse ml-auto" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-950 text-center text-[11px] text-slate-500">
              OpenBon v{APP_VERSION}{APP_IS_BETA ? ' Beta' : ''}
            </div>
          </div>
        </div>
      )}

      {/* PIN Verification Modal */}
      <PinModal
        isOpen={showPinModal}
        title={
          pinTarget === 'ADMIN'
            ? 'Administrator PIN eingeben'
            : pinTarget === 'POS'
            ? 'Bonkassen PIN eingeben'
            : pinTarget === 'KITCHEN'
            ? 'Küchen PIN eingeben'
            : 'Bedienungs PIN eingeben'
        }
        stationType={
          pinTarget === 'ADMIN'
            ? 'ADMIN'
            : pinTarget === 'POS'
            ? 'POS'
            : pinTarget === 'KITCHEN'
            ? 'KITCHEN'
            : 'WAITER'
        }
        onSuccess={handlePinSuccess}
        onCancel={() => setShowPinModal(false)}
      />
    </>
  );
}
