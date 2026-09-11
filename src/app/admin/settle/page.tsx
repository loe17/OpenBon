'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Wallet,
  Users,
  Coins,
  Calculator,
  FileText,
  ArrowLeft,
  ArrowRight,
  Check,
  RefreshCw,
  Printer,
  AlertTriangle,
  CheckCircle2,
  User,
  ShieldAlert,
  ShoppingBag,
  ListOrdered,
  Search,
  Plus,
  Trash2,
  Edit2,
  TrendingUp,
  Banknote,
  CreditCard,
  X,
  Loader2,
} from 'lucide-react';
import { formatCents } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { triggerHapticFeedback } from '@/lib/socket-client';
import { useSocket } from '@/components/providers/socket-provider';
import PinModal from '@/components/auth/pin-modal';

/**
 * Schichtabrechnung als gefuehrter Ablauf - ausschliesslich in der Administration.
 *
 * Die Abrechnung entscheidet ueber Bargeldabgabe und Trinkgeldverteilung; eine
 * Bedienung darf ihre eigene Schicht nicht abrechnen. Der frueher unter
 * /waiter/settle erreichbare Einseiter zeigte alle Angaben gleichzeitig; hier
 * fuehrt der Ablauf in fuenf klar getrennten Schritten durch den Kassensturz,
 * damit beim Zaehlen nichts uebersprungen wird.
 *
 * Alle Zahlen stammen aus /api/waiters/settle/report. Die Oberflaeche rechnet
 * bewusst NICHT selbst - so koennen Bildschirm, Bon und PDF nicht auseinanderlaufen.
 */

export interface SettlementItemSold {
  name: string;
  quantity: number;
  amountCents: number;
}

export interface SettlementOrderSummary {
  id: string;
  orderNumber: number;
  time: string;
  tableName: string;
  totalCents: number;
  itemsCount: number;
  itemsSummary: string;
}

interface SettlementReport {
  waiterName: string;
  periodNumber: number;
  periodOpenedAt: string;
  generatedAt: string;
  totalGross?: number;
  totalGrossCents?: number;
  transactionCount: number;
  byMethod: { method: string; label: string; amount?: number; amountCents?: number; count: number }[];
  cashGross?: number;
  cashGrossCents?: number;
  cashExpected?: number;
  cashExpectedCents?: number;
  tipsTotal?: number;
  tipsTotalCents?: number;
  tipWaiterShare?: number;
  tipWaiterShareCents?: number;
  tipPoolShare?: number;
  tipPoolShareCents?: number;
  tipProfileName: string | null;
  isTraining: boolean;
  eventName: string;
  orderCount?: number;
  itemsSold?: SettlementItemSold[];
  orders?: SettlementOrderSummary[];
}

type Step = 1 | 2 | 3 | 4 | 5;

const STEPS: { id: Step; label: string; icon: typeof Users }[] = [
  { id: 1, label: 'Bedienung', icon: Users },
  { id: 2, label: 'Umsätze', icon: Coins },
  { id: 3, label: 'Zählen', icon: Calculator },
  { id: 4, label: 'Bestätigen', icon: Check },
  { id: 5, label: 'Beleg', icon: FileText },
];

const money = (v?: number, centsMaybe?: number) => {
  if (typeof centsMaybe === 'number') return formatCents(centsMaybe);
  if (typeof v === 'number') return formatCents(Math.round(v * 100));
  return '0,00 €';
};

export interface TipProfile {
  id: string;
  name: string;
  waiterPercent: number;
  barPoolPercent: number;
  kitchenPoolPercent: number;
  servicePoolPercent: number;
  isDefault: boolean;
  waiters?: { id: string; name: string }[];
}

export interface WaiterEntity {
  id: string;
  name: string;
  pin: string;
  isActive: boolean;
  waiterNumber?: number | null;
  tipProfileId?: string | null;
  tipProfile?: TipProfile | null;
}

export interface WaiterStat {
  waiterName: string;
  totalGross: number;
  cashGross: number;
  cardGross: number;
  tips: number;
  depositReturned: number;
  transactionCount: number;
  ordersLastHour: number;
  salesLastHour: number;
}

type MainTab = 'SETTLE' | 'STAFF' | 'STATS';

function AdminSettleContent() {
  const params = useSearchParams();
  const { success, error: toastError, warning } = useToast();

  const [mainTab, setMainTab] = useState<MainTab>(() => {
    const t = params.get('tab');
    if (t === 'staff') return 'STAFF';
    if (t === 'stats') return 'STATS';
    return 'SETTLE';
  });

  const [step, setStep] = useState<Step>(1);
  const [waiters, setWaiters] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [report, setReport] = useState<SettlementReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [counted, setCounted] = useState('0');
  const [countedTip, setCountedTip] = useState('');
  const [notes, setNotes] = useState('');
  const [printerId, setPrinterId] = useState<string>('');
  const [printers, setPrinters] = useState<{ id: string; name: string; isActive?: boolean }[]>([]);
  const [settleTemplate, setSettleTemplate] = useState<'OFFICIAL_A4' | 'RECEIPT_SLIP' | 'DASHBOARD_SUMMARY'>('OFFICIAL_A4');
  const [rawWaiters, setRawWaiters] = useState<{ name: string; waiterNumber?: number | null; isSettled?: boolean; lastSettledAt?: string | null }[]>([]);
  const [filterMode, setFilterMode] = useState<'ALL' | 'OPEN' | 'SETTLED'>('ALL');
  const [done, setDone] = useState(false);

  // Staff & Trinkgeld-Regeln States
  const [profiles, setProfiles] = useState<TipProfile[]>([]);
  const [staffList, setStaffList] = useState<WaiterEntity[]>([]);
  const [waiterStats, setWaiterStats] = useState<WaiterStat[]>([]);
  const [editingProfile, setEditingProfile] = useState<TipProfile | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formWaiter, setFormWaiter] = useState(100);
  const [formBar, setFormBar] = useState(0);
  const [formKitchen, setFormKitchen] = useState(0);
  const [formService, setFormService] = useState(0);
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [newWaiterName, setNewWaiterName] = useState('');
  const [newWaiterPin, setNewWaiterPin] = useState('3333');

  // Neu: Abrechnungskorrektur mit Admin-PIN & Detail-Reiter
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingWaiter, setPendingWaiter] = useState<string | null>(null);
  const [isCorrection, setIsCorrection] = useState(false);
  const [printItemsSold, setPrintItemsSold] = useState(false);
  const [printOrders, setPrintOrders] = useState(false);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ARTICLES' | 'ORDERS'>('OVERVIEW');
  const [articleSearch, setArticleSearch] = useState('');

  const { socket } = useSocket();

  const loadWaitersList = useCallback(async () => {
    try {
      const [wRes, pRes] = await Promise.all([fetch('/api/waiters'), fetch('/api/printers')]);
      const names = new Set<string>();
      const rawList: { name: string; waiterNumber?: number | null; isSettled?: boolean; lastSettledAt?: string | null }[] = [];
      if (wRes.ok) {
        const data = await wRes.json();
        if (Array.isArray(data)) {
          data.forEach((w: { name?: string; waiterNumber?: number | null; isSettled?: boolean; lastSettledAt?: string | null }) => {
            if (w.name) {
              names.add(w.name);
              rawList.push({ name: w.name, waiterNumber: w.waiterNumber, isSettled: w.isSettled, lastSettledAt: w.lastSettledAt });
            }
          });
        }
      }
      setWaiters(Array.from(names).sort((a, b) => a.localeCompare(b, 'de')));
      setRawWaiters(rawList);

      if (pRes.ok) {
        const pData = await pRes.json();
        if (Array.isArray(pData)) {
          setPrinters(pData);
          const active = pData.find((p: { isActive?: boolean }) => p.isActive);
          if (active) setPrinterId(active.id);
        }
      }
    } catch {
      toastError('Bedienungen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    loadWaitersList();
    const interval = setInterval(loadWaitersList, 10000);
    return () => clearInterval(interval);
  }, [loadWaitersList]);

  useEffect(() => {
    if (socket) {
      socket.on('waiters:settled', loadWaitersList);
      socket.on('waiter:settled', loadWaitersList);
      return () => {
        socket.off('waiters:settled');
        socket.off('waiter:settled');
      };
    }
  }, [socket, loadWaitersList]);

  // Aus /admin/tips wird die Bedienung per Verweis uebergeben - dann direkt
  // zum zweiten Schritt springen statt erneut auswaehlen zu lassen.
  const prefill = params.get('waiterName');
  useEffect(() => {
    if (!prefill || loading || report) return;
    setSelected(prefill);
    void (async () => {
      const res = await fetch(`/api/waiters/settle/report?waiterName=${encodeURIComponent(prefill)}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      setReport((await res.json()) as SettlementReport);
      setStep(2);
    })();
  }, [prefill, loading, report]);

  const loadReport = useCallback(
    async (name: string) => {
      setBusy(true);
      try {
        const res = await fetch(`/api/waiters/settle/report?waiterName=${encodeURIComponent(name)}`, {
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok) {
          toastError(data.error || 'Abrechnung konnte nicht berechnet werden.');
          return false;
        }
        setReport(data as SettlementReport);
        return true;
      } catch {
        toastError('Netzwerkfehler beim Berechnen der Abrechnung.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [toastError]
  );

  /* ------------------------------------------------------- PIN & Korrektur-Handling */

  const handleSelectWaiter = (name: string) => {
    triggerHapticFeedback();
    const info = rawWaiters.find((r) => r.name === name);
    if (info?.isSettled) {
      setPendingWaiter(name);
      setShowPinModal(true);
    } else {
      setSelected(name);
      setIsCorrection(false);
    }
  };

  const handleProceedToStep2 = async () => {
    if (!selected) return;
    const info = rawWaiters.find((r) => r.name === selected);
    if (info?.isSettled && !isCorrection) {
      setPendingWaiter(selected);
      setShowPinModal(true);
      return;
    }
    if (await loadReport(selected)) setStep(2);
  };

  const handlePinSuccess = async () => {
    setShowPinModal(false);
    const target = pendingWaiter || selected;
    if (!target) return;
    setSelected(target);
    setIsCorrection(true);
    setPendingWaiter(null);
    const ok = await loadReport(target);
    if (ok) setStep(2);
  };

  const loadStaffAndStatsData = useCallback(async () => {
    try {
      const [pRes, wRes, repRes] = await Promise.all([
        fetch('/api/tip-profiles'),
        fetch('/api/waiters'),
        fetch('/api/reports'),
      ]);
      let currentWaiters: WaiterEntity[] = [];
      if (pRes.ok) setProfiles(await pRes.json());
      if (wRes.ok) {
        currentWaiters = await wRes.json();
        setStaffList(currentWaiters);
      }
      if (repRes.ok) {
        const repData = await repRes.json();
        const statMap = new Map<string, WaiterStat>();
        if (repData && Array.isArray(repData.waiterStats)) {
          repData.waiterStats.forEach((ws: WaiterStat) => statMap.set(ws.waiterName, ws));
        }
        currentWaiters.forEach((w) => {
          if (!statMap.has(w.name)) {
            statMap.set(w.name, {
              waiterName: w.name,
              totalGross: 0,
              cashGross: 0,
              cardGross: 0,
              tips: 0,
              depositReturned: 0,
              transactionCount: 0,
              ordersLastHour: 0,
              salesLastHour: 0,
            });
          }
        });
        setWaiterStats(Array.from(statMap.values()));
      }
    } catch (err) {
      console.error('Fehler beim Laden von Personal & Stats:', err);
    }
  }, []);

  useEffect(() => {
    loadStaffAndStatsData();
  }, [loadStaffAndStatsData]);

  const openCreateProfileModal = () => {
    setEditingProfile(null);
    setFormName('');
    setFormWaiter(100);
    setFormBar(0);
    setFormKitchen(0);
    setFormService(0);
    setFormIsDefault(false);
    setIsProfileModalOpen(true);
  };

  const openEditProfileModal = (p: TipProfile) => {
    setEditingProfile(p);
    setFormName(p.name);
    setFormWaiter(p.waiterPercent);
    setFormBar(p.barPoolPercent);
    setFormKitchen(p.kitchenPoolPercent);
    setFormService(p.servicePoolPercent);
    setFormIsDefault(p.isDefault);
    setIsProfileModalOpen(true);
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const sum = formWaiter + formBar + formKitchen + formService;
    if (Math.abs(sum - 100) > 0.1) {
      warning(`Die Summe der Prozentsätze muss genau 100% ergeben (Aktuell: ${sum}%).`);
      return;
    }

    try {
      const url = editingProfile ? `/api/tip-profiles/${editingProfile.id}` : '/api/tip-profiles';
      const method = editingProfile ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          waiterPercent: formWaiter,
          barPoolPercent: formBar,
          kitchenPoolPercent: formKitchen,
          servicePoolPercent: formService,
          isDefault: formIsDefault,
        }),
      });

      if (res.ok) {
        setIsProfileModalOpen(false);
        success('Trinkgeld-Profil gespeichert');
        loadStaffAndStatsData();
      } else {
        toastError('Fehler beim Speichern des Profils');
      }
    } catch {
      toastError('Netzwerkfehler beim Speichern');
    }
  };

  const deleteProfile = async (id: string) => {
    try {
      const res = await fetch(`/api/tip-profiles/${id}`, { method: 'DELETE' });
      if (res.ok) {
        success('Trinkgeld-Profil gelöscht');
        loadStaffAndStatsData();
      }
    } catch {
      toastError('Fehler beim Löschen des Profils');
    }
  };

  const assignProfileToWaiter = async (waiterId: string, profileId: string | null) => {
    try {
      const res = await fetch(`/api/waiters/${waiterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipProfileId: profileId }),
      });
      if (res.ok) {
        success('Profil zugewiesen');
        loadStaffAndStatsData();
      }
    } catch {
      toastError('Fehler beim Zuweisen des Profils');
    }
  };

  const createWaiter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWaiterName.trim()) return;
    try {
      const res = await fetch('/api/waiters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWaiterName.trim(), pin: newWaiterPin }),
      });
      if (res.ok) {
        setNewWaiterName('');
        setNewWaiterPin('3333');
        success('Bedienung erfolgreich angelegt');
        loadStaffAndStatsData();
        loadWaitersList();
      }
    } catch {
      toastError('Fehler beim Anlegen der Bedienung');
    }
  };

  const deleteWaiter = async (id: string) => {
    try {
      const res = await fetch(`/api/waiters/${id}`, { method: 'DELETE' });
      if (res.ok) {
        success('Bedienung entfernt');
        loadStaffAndStatsData();
        loadWaitersList();
      }
    } catch {
      toastError('Fehler beim Löschen der Bedienung');
    }
  };

  const getWaiterProfile = (name: string) => {
    const w = staffList.find((item) => item.name.toLowerCase() === name.toLowerCase());
    if (w?.tipProfileId) {
      const p = profiles.find((prof) => prof.id === w.tipProfileId);
      if (p) return p;
    }
    return profiles.find((p) => p.isDefault) || {
      id: 'default',
      name: 'Standard (100% Kellner)',
      waiterPercent: 100,
      barPoolPercent: 0,
      kitchenPoolPercent: 0,
      servicePoolPercent: 0,
      isDefault: true,
    };
  };

  const totalWaiterSales = waiterStats.reduce((sum, w) => sum + w.totalGross, 0);
  const totalCashCollected = waiterStats.reduce((sum, w) => sum + w.cashGross, 0);
  const totalCardCollected = waiterStats.reduce((sum, w) => sum + w.cardGross, 0);
  const totalTips = waiterStats.reduce((sum, w) => sum + w.tips, 0);

  /* ------------------------------------------------------- Abschluss */

  const countedNum = parseFloat(counted.replace(',', '.'));
  const countedValid = Number.isFinite(countedNum) && countedNum >= 0;
  const expectedNum = report ? (report.cashExpected ?? (report.cashExpectedCents !== undefined ? report.cashExpectedCents / 100 : 0)) : 0;
  const difference = report && countedValid ? Math.round((countedNum - expectedNum) * 100) / 100 : 0;
  const differenceOk = Math.abs(difference) < 0.05;

  const countedTipNum = parseFloat(countedTip.replace(',', '.')) || 0;
  const expectedTipNum = report ? (report.tipsTotal ?? (report.tipsTotalCents !== undefined ? report.tipsTotalCents / 100 : 0)) : 0;
  const tipDifference = report ? Math.round((countedTipNum - expectedTipNum) * 100) / 100 : 0;
  const tipDifferenceOk = Math.abs(tipDifference) < 0.05;

  const finish = async (withPrint: boolean) => {
    if (!report || !countedValid) return;
    setBusy(true);
    triggerHapticFeedback();
    try {
      const res = await fetch('/api/waiters/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waiterName: report.waiterName,
          totalGross: report.totalGross ?? (report.totalGrossCents !== undefined ? report.totalGrossCents / 100 : 0),
          totalGrossCents: report.totalGrossCents ?? Math.round(((report.totalGross ?? 0)) * 100),
          cashGross: report.cashGross ?? (report.cashGrossCents !== undefined ? report.cashGrossCents / 100 : 0),
          cashGrossCents: report.cashGrossCents ?? Math.round(((report.cashGross ?? 0)) * 100),
          cashExpected: report.cashExpected ?? (report.cashExpectedCents !== undefined ? report.cashExpectedCents / 100 : 0),
          cashExpectedCents: report.cashExpectedCents ?? Math.round(((report.cashExpected ?? 0)) * 100),
          cashCounted: countedNum,
          cashCountedCents: Math.round(countedNum * 100),
          tips: report.tipsTotal ?? (report.tipsTotalCents !== undefined ? report.tipsTotalCents / 100 : 0),
          tipsTotalCents: report.tipsTotalCents ?? Math.round(((report.tipsTotal ?? 0)) * 100),
          tipWaiterShare: report.tipWaiterShare ?? (report.tipWaiterShareCents !== undefined ? report.tipWaiterShareCents / 100 : 0),
          tipWaiterShareCents: report.tipWaiterShareCents ?? Math.round(((report.tipWaiterShare ?? 0)) * 100),
          tipPoolShare: report.tipPoolShare ?? (report.tipPoolShareCents !== undefined ? report.tipPoolShareCents / 100 : 0),
          tipPoolShareCents: report.tipPoolShareCents ?? Math.round(((report.tipPoolShare ?? 0)) * 100),
          tipProfileName: report.tipProfileName,
          byMethod: report.byMethod,
          transactionCount: report.transactionCount,
          handoverAmount: countedNum,
          notes: (notes + (countedTipNum > 0 ? ` [Ist-Trinkgeld: ${countedTipNum.toFixed(2)} €, Diff: ${tipDifference > 0 ? '+' : ''}${tipDifference.toFixed(2)} €]` : '')).trim(),
          tipCounted: countedTipNum,
          tipCountedCents: Math.round(countedTipNum * 100),
          printReceipt: withPrint,
          printerId: withPrint ? printerId || undefined : undefined,
          isCorrection,
          printItemsSold,
          printOrders,
          itemsSold: report.itemsSold,
          orders: report.orders,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError(data.error || 'Abrechnung konnte nicht abgeschlossen werden.');
        return;
      }
      setDone(true);
      setStep(5);
      loadWaitersList();
      if (withPrint && data.printed) {
        success(isCorrection ? 'Abrechnungskorrektur abgeschlossen, Beleg wurde gedruckt.' : 'Abrechnung abgeschlossen, Beleg wurde gedruckt.');
      } else if (withPrint) {
        warning(`Abrechnung abgeschlossen. Beleg NICHT gedruckt: ${data.printError || 'unbekannter Grund'}`);
      } else {
        success(isCorrection ? 'Abrechnungskorrektur abgeschlossen.' : 'Abrechnung abgeschlossen.');
      }
    } catch {
      toastError('Netzwerkfehler beim Abschließen der Abrechnung.');
    } finally {
      setBusy(false);
    }
  };

  /* -------------------------------------------------------- Rendering */

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px] text-slate-400 gap-2">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
        <span>Lade Bedienungen …</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 text-white p-3 sm:p-6 max-w-6xl mx-auto w-full space-y-6 print:bg-white print:text-black print:max-w-none">
      {/* Kopfzeile */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="bg-amber-600 text-white p-2.5 rounded-2xl shadow">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Personal &amp; Abrechnung</h1>
            <p className="text-xs text-slate-400">
              Kassensturz, Schichtabrechnungen, Mitarbeiter-Profile &amp; Trinkgeldregeln
            </p>
          </div>
        </div>

        {/* 3 Haupt-Reiter */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setMainTab('SETTLE')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow ${
              mainTab === 'SETTLE'
                ? 'bg-blue-600 text-white shadow-blue-950/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Kassensturz &amp; Abrechnung</span>
          </button>
          <button
            type="button"
            onClick={() => setMainTab('STAFF')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow ${
              mainTab === 'STAFF'
                ? 'bg-blue-600 text-white shadow-blue-950/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Bedienungen &amp; Trinkgeld-Regeln</span>
          </button>
          <button
            type="button"
            onClick={() => setMainTab('STATS')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow ${
              mainTab === 'STATS'
                ? 'bg-blue-600 text-white shadow-blue-950/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Live-Umsatzübersicht</span>
          </button>
        </div>
      </div>

      {mainTab === 'SETTLE' && (
        <div className="max-w-3xl mx-auto space-y-6">

      {/* Fortschritt */}
      <div className="flex items-center gap-1 print:hidden">
        {STEPS.map((s, idx) => {
          const Icon = s.icon;
          const state = step === s.id ? 'active' : step > s.id ? 'done' : 'todo';
          return (
            <React.Fragment key={s.id}>
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition ${
                    state === 'active'
                      ? 'bg-blue-600 border-blue-400 text-white shadow-lg'
                      : state === 'done'
                      ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-600'
                  }`}
                >
                  {state === 'done' ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <span
                  className={`text-[10px] font-bold ${
                    state === 'todo' ? 'text-slate-600' : 'text-slate-300'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 rounded ${step > s.id ? 'bg-emerald-700' : 'bg-slate-800'}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ============================================ Schritt 1: Bedienung */}
      {step === 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <h2 className="font-bold text-lg">Wen rechnen Sie ab?</h2>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                className={`px-3 py-1 rounded-lg transition ${
                  filterMode === 'ALL' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Alle ({waiters.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('OPEN')}
                className={`px-3 py-1 rounded-lg transition ${
                  filterMode === 'OPEN' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Offen ({rawWaiters.filter((w) => !w.isSettled).length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('SETTLED')}
                className={`px-3 py-1 rounded-lg transition ${
                  filterMode === 'SETTLED' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Bereits abgerechnet ({rawWaiters.filter((w) => w.isSettled).length})
              </button>
            </div>
          </div>

          {(() => {
            const filtered = waiters.filter((name) => {
              const info = rawWaiters.find((r) => r.name === name);
              if (filterMode === 'OPEN') return !info?.isSettled;
              if (filterMode === 'SETTLED') return Boolean(info?.isSettled);
              return true;
            });

            if (filtered.length === 0) {
              return (
                <div className="bg-slate-950 border border-slate-800 text-slate-400 p-6 rounded-2xl text-center text-sm font-bold">
                  Keine Bedienungen für diesen Filter gefunden.
                </div>
              );
            }

            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {filtered.map((name) => {
                  const info = rawWaiters.find((r) => r.name === name);
                  const isSelected = selected === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => handleSelectWaiter(name)}
                      className={`min-h-[64px] p-3 rounded-2xl text-sm font-black border transition active:scale-95 touch-manipulation flex flex-col justify-between items-start text-left ${
                        isSelected
                          ? 'bg-blue-600 border-blue-400 text-white shadow-lg'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <User className="w-4 h-4 shrink-0 opacity-70" />
                        <span className="truncate flex-1">
                          {name}
                          {info?.waiterNumber ? (
                            <span className="ml-1 text-xs font-mono font-normal opacity-75">
                              #{info.waiterNumber}
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <div className="text-[10px] font-semibold mt-1">
                        {info?.isSettled ? (
                          <span className={isSelected ? 'text-emerald-200' : 'text-emerald-400'}>
                            ✓ Bereits abgerechnet (PIN für Korrektur)
                          </span>
                        ) : (
                          <span className={isSelected ? 'text-amber-200' : 'text-amber-400'}>
                            ● Schicht aktiv / Offen
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          <button
            type="button"
            disabled={!selected || busy}
            onClick={handleProceedToStep2}
            className="w-full min-h-[52px] rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 font-black text-sm flex items-center justify-center gap-2 transition active:scale-95 shadow"
          >
            {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {isCorrection ? 'Abrechnungskorrektur starten' : 'Umsätze anzeigen'}
          </button>
        </div>
      )}

      {/* ============================================== Schritt 2: Umsätze */}
      {step === 2 && report && (
        <div className="space-y-4 print:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
            {isCorrection && (
              <div className="flex items-center gap-2.5 bg-amber-950/40 border border-amber-800/60 text-amber-200 rounded-2xl p-3.5 shadow-sm">
                <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400" />
                <div className="text-xs">
                  <span className="font-black text-amber-300">Abrechnungskorrektur aktiv:</span> Diese Bedienung wurde bereits abgerechnet. Der Abschluss wird als Korrektur im System und auf dem Beleg dokumentiert.
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h2 className="font-bold text-lg">
                  Umsätze von {report.waiterName}
                </h2>
                <span className="text-xs text-slate-400">
                  Kassenperiode {report.periodNumber} · seit{' '}
                  {new Date(report.periodOpenedAt).toLocaleString('de-DE')}
                </span>
              </div>
            </div>

            {/* 4 KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="text-[11px] text-slate-400 font-bold mb-1">Gesamtumsatz</div>
                <div className="text-xl font-black font-mono text-emerald-400">{money(report.totalGross)}</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="text-[11px] text-slate-400 font-bold mb-1">Zahlungen</div>
                <div className="text-xl font-black font-mono">{report.transactionCount}</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="text-[11px] text-slate-400 font-bold mb-1">Bestellungen</div>
                <div className="text-xl font-black font-mono text-sky-400">{report.orderCount ?? 0}</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="text-[11px] text-slate-400 font-bold mb-1">Verkaufte Artikel</div>
                <div className="text-xl font-black font-mono text-amber-400">
                  {(report.itemsSold || []).reduce((acc, it) => acc + it.quantity, 0)} Stk.
                </div>
              </div>
            </div>

            {/* Reiter-Navigation */}
            <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab('OVERVIEW')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeTab === 'OVERVIEW'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white bg-slate-950 border border-slate-800'
                }`}
              >
                Zahlarten &amp; Trinkgeld
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ARTICLES')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'ARTICLES'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white bg-slate-950 border border-slate-800'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                Verkaufte Artikel ({(report.itemsSold || []).length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ORDERS')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'ORDERS'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white bg-slate-950 border border-slate-800'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                Bestellungen ({report.orderCount ?? 0})
              </button>
            </div>

            {/* TAB 1: ZAHLARTEN & TRINKGELD */}
            {activeTab === 'OVERVIEW' && (
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Nach Zahlart
                  </div>
                  {report.byMethod.length === 0 ? (
                    <p className="text-sm text-slate-500">Keine Buchungen in dieser Kassenperiode.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {report.byMethod.map((m) => (
                        <div
                          key={m.method}
                          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800"
                        >
                          <span className="text-sm font-bold">
                            {m.label}
                            <span className="text-slate-500 font-normal"> · {m.count}×</span>
                          </span>
                          <span className="font-mono font-bold">{money(m.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Trinkgeld
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-sm font-bold">Gesamt</span>
                      <span className="font-mono font-bold">{money(report.tipsTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-800/60 text-slate-300">
                      <span className="text-xs">davon Bedienung</span>
                      <span className="font-mono text-sm">{money(report.tipWaiterShare)}</span>
                    </div>
                    <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-800/60 text-slate-300">
                      <span className="text-xs">davon Team-Pool</span>
                      <span className="font-mono text-sm">{money(report.tipPoolShare)}</span>
                    </div>
                  </div>
                  {report.tipProfileName ? (
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      Verteilung nach Profil „{report.tipProfileName}“.
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      Kein Trinkgeldprofil hinterlegt – das Trinkgeld bleibt vollständig bei der
                      Bedienung.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: VERKAUFTE ARTIKEL */}
            {activeTab === 'ARTICLES' && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={articleSearch}
                    onChange={(e) => setArticleSearch(e.target.value)}
                    placeholder="Artikel suchen …"
                    className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-blue-500"
                  />
                </div>

                {(!report.itemsSold || report.itemsSold.length === 0) ? (
                  <p className="text-sm text-slate-500 py-4 text-center">Keine verkauften Artikel verzeichnet.</p>
                ) : (
                  <div className="max-h-[350px] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 divide-y divide-slate-800/60">
                    <div className="grid grid-cols-12 px-3.5 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-900/50 sticky top-0">
                      <span className="col-span-7">Artikel</span>
                      <span className="col-span-2 text-center">Menge</span>
                      <span className="col-span-3 text-right">Summe</span>
                    </div>
                    {report.itemsSold
                      .filter((it) => !articleSearch || it.name.toLowerCase().includes(articleSearch.toLowerCase()))
                      .map((it) => (
                        <div key={it.name} className="grid grid-cols-12 px-3.5 py-2.5 text-xs items-center hover:bg-slate-900/40">
                          <span className="col-span-7 font-semibold truncate text-slate-200">{it.name}</span>
                          <span className="col-span-2 text-center font-mono font-bold text-sky-400">{it.quantity}×</span>
                          <span className="col-span-3 text-right font-mono font-bold text-slate-100">{formatCents(it.amountCents)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: BESTELLUNGEN */}
            {activeTab === 'ORDERS' && (
              <div className="space-y-3">
                {(!report.orders || report.orders.length === 0) ? (
                  <p className="text-sm text-slate-500 py-4 text-center">Keine Bestellungen in dieser Kassenperiode.</p>
                ) : (
                  <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1">
                    {report.orders.map((ord) => (
                      <div key={ord.id} className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-blue-400 bg-blue-950/60 border border-blue-900 px-2 py-0.5 rounded-lg">
                              #{ord.orderNumber}
                            </span>
                            <span className="text-slate-400 font-semibold">{ord.time}</span>
                            <span className="font-bold text-slate-300">· {ord.tableName}</span>
                          </div>
                          <span className="font-mono font-black text-emerald-400">{formatCents(ord.totalCents)}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 leading-relaxed pl-1">
                          {ord.itemsSummary}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="min-h-[52px] px-5 rounded-2xl bg-slate-900 border border-slate-800 font-bold text-sm flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Zurück
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex-1 min-h-[52px] rounded-2xl bg-blue-600 hover:bg-blue-500 font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition"
            >
              <ArrowRight className="w-4 h-4" />
              Bargeld zählen
            </button>
          </div>
        </div>
      )}

      {/* =============================================== Schritt 3: Zählen */}
      {step === 3 && report && (
        <div className="space-y-4 print:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h2 className="font-bold text-lg">Bargeld zählen</h2>
            <p className="text-sm text-slate-400">
              Zählen Sie die Bargeldkasse von {report.waiterName} vollständig aus und tragen Sie den
              Betrag ein. Der Soll-Wert wird bewusst erst im nächsten Schritt gezeigt, damit die
              Zählung nicht davon beeinflusst wird.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
                Gezähltes Bargeld (Ist-Bargeld)
              </label>
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                value={counted}
                onChange={(e) => setCounted(e.target.value.replace(/[^0-9.,]/g, ''))}
                placeholder="0,00"
                className="w-full min-h-[72px] px-5 bg-slate-950 border-2 border-slate-700 rounded-2xl text-3xl text-white font-mono font-black text-right focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
                Gezähltes Trinkgeld (Ist-Trinkgeld)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={countedTip}
                onChange={(e) => setCountedTip(e.target.value.replace(/[^0-9.,]/g, ''))}
                placeholder="0,00"
                className="w-full min-h-[56px] px-5 bg-slate-950 border-2 border-slate-700 rounded-2xl text-2xl text-white font-mono font-bold text-right focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Freiwillig: Gezähltes Trinkgeld aus dem Kellner-Geldbeutel eintragen, um im nächsten Schritt die Trinkgeld-Differenz (Soll vs. Ist) zu sehen.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Bemerkung (freiwillig)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="z. B. Wechselgeld nachgelegt, Differenz erklärt"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="min-h-[52px] px-5 rounded-2xl bg-slate-900 border border-slate-800 font-bold text-sm flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Zurück
            </button>
            <button
              type="button"
              disabled={!countedValid}
              onClick={() => setStep(4)}
              className="flex-1 min-h-[52px] rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition"
            >
              <ArrowRight className="w-4 h-4" />
              Differenz anzeigen
            </button>
          </div>
        </div>
      )}

      {/* =========================================== Schritt 4: Bestätigen */}
      {step === 4 && report && (
        <div className="space-y-4 print:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h2 className="font-bold text-lg">Kassensturz bestätigen</h2>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-sm font-bold">Soll-Barbestand</span>
                <span className="font-mono font-bold text-amber-400">{money(report.cashExpected)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-sm font-bold">Gezählt</span>
                <span className="font-mono font-bold">{money(countedNum)}</span>
              </div>
              <div
                className={`flex items-center justify-between px-4 py-4 rounded-2xl border-2 ${
                  differenceOk
                    ? 'bg-emerald-950/40 border-emerald-700 text-emerald-300'
                    : Math.abs(difference) < 5
                    ? 'bg-amber-950/40 border-amber-700 text-amber-300'
                    : 'bg-rose-950/40 border-rose-700 text-rose-300'
                }`}
              >
                <span className="text-sm font-black uppercase tracking-wide">
                  {differenceOk ? 'Bargeld-Kasse stimmt' : difference > 0 ? 'Bargeld-Überschuss' : 'Bargeld-Fehlbetrag'}
                </span>
                <span className="font-mono font-black text-2xl">
                  {difference > 0 ? '+' : ''}
                  {money(difference)}
                </span>
              </div>
            </div>

            {/* Trinkgeld-Abgleich (Soll vs. Ist) */}
            <div className="space-y-1.5 pt-3 border-t border-slate-800">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                Trinkgeld-Abgleich
              </div>
              <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-sm font-bold">Soll-Trinkgeld (Buchungen)</span>
                <span className="font-mono font-bold text-sky-400">{money(expectedTipNum)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-sm font-bold">Ist-Trinkgeld (Gezählt)</span>
                <span className="font-mono font-bold text-white">{money(countedTipNum)}</span>
              </div>
              <div
                className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 ${
                  tipDifferenceOk
                    ? 'bg-emerald-950/40 border-emerald-700 text-emerald-300'
                    : tipDifference > 0
                    ? 'bg-sky-950/40 border-sky-700 text-sky-300'
                    : 'bg-amber-950/40 border-amber-700 text-amber-300'
                }`}
              >
                <span className="text-sm font-black uppercase tracking-wide">
                  {tipDifferenceOk
                    ? 'Trinkgeld stimmt exakt'
                    : tipDifference > 0
                    ? 'Trinkgeld-Überschuss'
                    : 'Trinkgeld-Fehlbetrag'}
                </span>
                <span className="font-mono font-black text-xl">
                  {tipDifference > 0 ? '+' : ''}
                  {money(tipDifference)}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Der Soll-Barbestand ist der Barumsatz abzüglich des Trinkgeldanteils, den die Bedienung
              behält. Ein Team-Pool-Anteil bleibt in der Kasse und wird gesondert verteilt.
            </p>

            {!differenceOk && Math.abs(difference) >= 5 ? (
              <div className="flex items-start gap-2.5 bg-rose-950/40 border border-rose-800/60 text-rose-200 rounded-2xl p-3.5">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-xs">
                  Die Abweichung ist erheblich. Bitte nachzählen und die Ursache in der Bemerkung
                  festhalten, bevor Sie abschließen – die Abrechnung lässt sich später nicht ändern.
                </p>
              </div>
            ) : null}

            {printers.length > 0 ? (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Beleg drucken auf
                </label>
                <select
                  value={printerId}
                  onChange={(e) => setPrinterId(e.target.value)}
                  className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:border-blue-500"
                >
                  {printers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.isActive ? '' : ' (inaktiv)'}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="pt-1 space-y-2">
              <label className="flex items-center gap-2.5 cursor-pointer bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs font-bold text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={printItemsSold}
                  onChange={(e) => setPrintItemsSold(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-900 border-slate-700"
                />
                <span>Verkaufte Artikel mitdrucken (Summe je Artikel)</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs font-bold text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={printOrders}
                  onChange={(e) => setPrintOrders(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-900 border-slate-700"
                />
                <span>Einzelne Bestellungen mitdrucken (jede Bestellung einzeln)</span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="min-h-[52px] px-5 rounded-2xl bg-slate-900 border border-slate-800 font-bold text-sm flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Zurück
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => finish(false)}
              className="min-h-[52px] px-5 rounded-2xl bg-slate-900 border border-slate-700 font-bold text-sm disabled:opacity-40"
            >
              {isCorrection ? 'Korrektur ohne Bon abschließen' : 'Ohne Bon abschließen'}
            </button>
            <button
              type="button"
              disabled={busy || printers.length === 0}
              onClick={() => finish(true)}
              className="flex-1 min-h-[52px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition"
            >
              {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              {isCorrection ? 'Korrektur abschließen & Bon drucken' : 'Abschließen und Bon drucken'}
            </button>
          </div>
        </div>
      )}

      {/* =============================================== Schritt 5: Beleg */}
      {step === 5 && report && done && (
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 rounded-2xl p-4 print:hidden">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="text-sm font-bold">
              Schicht von {report.waiterName} ist abgerechnet und abgemeldet.
            </span>
          </div>

          {/* Template Switcher Toolbar (Hidden in Print) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2 flex flex-wrap items-center justify-between gap-2 print:hidden">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-400 px-2">Druck-Design:</span>
              {[
                { id: 'OFFICIAL_A4', label: 'Offizieller Prüfbericht (A4)' },
                { id: 'RECEIPT_SLIP', label: 'Kassenbon (80 mm)' },
                { id: 'DASHBOARD_SUMMARY', label: 'Management Übersicht' },
              ].map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setSettleTemplate(tpl.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    settleTemplate === tpl.id
                      ? 'bg-blue-600 text-white shadow'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {tpl.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Jetzt Drucken / PDF</span>
            </button>
          </div>

          {/* Druckansicht 1: Offizieller DIN A4 Buchhaltungsbogen */}
          {settleTemplate === 'OFFICIAL_A4' && (
            <div
              id="settlement-report"
              className="bg-white text-slate-950 rounded-2xl p-8 print:rounded-none print:p-0 print:shadow-none font-sans"
            >
              <div className="text-center border-b-2 border-slate-900 pb-3 mb-6">
                {report.isTraining ? (
                  <div className="font-black text-sm mb-1 text-rose-600">*** ÜBUNGSBETRIEB - KEINE GUELTIGE BUCHUNG ***</div>
                ) : null}
                {isCorrection ? (
                  <div className="font-black text-sm mb-1 text-amber-600 uppercase tracking-wide">
                    *** KORREKTUR DER SCHICHTABRECHNUNG (ADMIN-AUTORISIERT) ***
                  </div>
                ) : null}
                <h1 className="text-2xl font-black uppercase tracking-tight">
                  {isCorrection ? 'Korrektur-Bericht: Schichtabrechnung' : 'Kassen- & Schichtabschlussbericht'}
                </h1>
                <p className="text-sm text-slate-600 font-semibold">{report.eventName}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                <div>
                  <div className="text-xs text-slate-500 uppercase font-bold">Bedienung / Kellner</div>
                  <div className="font-black text-base">{report.waiterName}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500 uppercase font-bold">Kassenperiode / Datum</div>
                  <div className="font-mono font-bold">Z-{report.periodNumber} · {new Date().toLocaleString('de-DE')}</div>
                </div>
              </div>

              <h3 className="font-black text-sm border-b-2 border-slate-900 pb-1 mb-2 uppercase">
                1. Umsatz nach Zahlungsart
              </h3>
              <table className="w-full text-sm mb-6 border border-slate-300">
                <thead className="bg-slate-100 border-b border-slate-300 text-xs uppercase font-bold text-slate-700">
                  <tr>
                    <th className="py-1.5 px-3 text-left">Zahlungsart</th>
                    <th className="py-1.5 px-3 text-center">Buchungen</th>
                    <th className="py-1.5 px-3 text-right">Umsatz Brutto</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byMethod.map((m) => (
                    <tr key={m.method} className="border-b border-slate-200">
                      <td className="py-1.5 px-3 font-semibold">{m.label}</td>
                      <td className="py-1.5 px-3 text-center font-mono">{m.count}×</td>
                      <td className="py-1.5 px-3 text-right font-mono font-bold">{money(m.amount)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-black text-base">
                    <td className="py-2 px-3">Gesamtumsatz</td>
                    <td className="py-2 px-3 text-center font-mono">{report.transactionCount}×</td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-800">{money(report.totalGross)}</td>
                  </tr>
                </tbody>
              </table>

              <h3 className="font-black text-sm border-b-2 border-slate-900 pb-1 mb-2 uppercase">
                2. Trinkgeld-Abrechnung
              </h3>
              <table className="w-full text-sm mb-6 border border-slate-300">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 px-3 font-bold">Trinkgeld Gesamt</td>
                    <td className="py-1.5 px-3 text-right font-mono font-bold">{money(report.tipsTotal)}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 px-3 pl-6 text-slate-600">davon Anteil Bedienung (Einbehalt)</td>
                    <td className="py-1.5 px-3 text-right font-mono">{money(report.tipWaiterShare)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 pl-6 text-slate-600">davon Anteil Team-Pool (Kassenabgabe)</td>
                    <td className="py-1.5 px-3 text-right font-mono">{money(report.tipPoolShare)}</td>
                  </tr>
                </tbody>
              </table>

              <h3 className="font-black text-sm border-b-2 border-slate-900 pb-1 mb-2 uppercase">
                3. Kassensturz &amp; Bargeldabgabe
              </h3>
              <table className="w-full text-sm mb-6 border border-slate-300">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 px-3">Soll-Barbestand (Barumsatz abzgl. Bedienungs-Trinkgeld)</td>
                    <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">{money(report.cashExpected)}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 px-3 font-bold">Ist-Barbestand (Tatsächlich gezählt)</td>
                    <td className="py-1.5 px-3 text-right font-mono font-black text-base">{money(countedNum)}</td>
                  </tr>
                  <tr className="bg-slate-100 font-black text-base">
                    <td className="py-2 px-3">
                      Differenz: {differenceOk ? 'Kasse stimmt exakt' : difference > 0 ? 'Überschuss' : 'Fehlbetrag'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      {difference > 0 ? '+' : ''}
                      {money(difference)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* 4. Verkaufte Artikel */}
              {printItemsSold && report.itemsSold && report.itemsSold.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-black text-sm border-b-2 border-slate-900 pb-1 mb-2 uppercase">
                    4. Verkaufte Artikel ({report.itemsSold.length} Positionen)
                  </h3>
                  <table className="w-full text-sm border border-slate-300">
                    <thead className="bg-slate-100 border-b border-slate-300 text-xs uppercase font-bold text-slate-700">
                      <tr>
                        <th className="py-1.5 px-3 text-left">Artikel</th>
                        <th className="py-1.5 px-3 text-center">Menge</th>
                        <th className="py-1.5 px-3 text-right">Umsatz Brutto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.itemsSold.map((it) => (
                        <tr key={it.name} className="border-b border-slate-200">
                          <td className="py-1.5 px-3 font-semibold">{it.name}</td>
                          <td className="py-1.5 px-3 text-center font-mono">{it.quantity}×</td>
                          <td className="py-1.5 px-3 text-right font-mono font-bold">{formatCents(it.amountCents)}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-black">
                        <td className="py-2 px-3">Gesamt verkaufte Artikel</td>
                        <td className="py-2 px-3 text-center font-mono">
                          {report.itemsSold.reduce((sum, it) => sum + it.quantity, 0)}×
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-800">
                          {formatCents(report.itemsSold.reduce((sum, it) => sum + it.amountCents, 0))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* 5. Einzelbestellungen */}
              {printOrders && report.orders && report.orders.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-black text-sm border-b-2 border-slate-900 pb-1 mb-2 uppercase">
                    5. Einzelbestellungen ({report.orders.length} Vorgänge)
                  </h3>
                  <table className="w-full text-xs border border-slate-300">
                    <thead className="bg-slate-100 border-b border-slate-300 text-[10px] uppercase font-bold text-slate-700">
                      <tr>
                        <th className="py-1 px-2 text-left"># / Zeit</th>
                        <th className="py-1 px-2 text-left">Tisch / Ort</th>
                        <th className="py-1 px-2 text-left">Bestellte Artikel</th>
                        <th className="py-1 px-2 text-right">Betrag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.orders.map((ord) => (
                        <tr key={ord.id} className="border-b border-slate-200">
                          <td className="py-1 px-2 font-mono font-bold whitespace-nowrap">
                            #{ord.orderNumber} <span className="font-normal text-slate-500">· {ord.time}</span>
                          </td>
                          <td className="py-1 px-2 font-semibold whitespace-nowrap">{ord.tableName}</td>
                          <td className="py-1 px-2 text-slate-700">{ord.itemsSummary}</td>
                          <td className="py-1 px-2 text-right font-mono font-bold whitespace-nowrap">{formatCents(ord.totalCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {notes ? (
                <div className="p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs mb-6">
                  <span className="font-black uppercase">Bemerkung zur Schicht:</span> {notes}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-12 mt-12 text-xs pt-4">
                <div className="border-t-2 border-slate-900 pt-2 text-center font-bold">
                  Unterschrift Bedienung ({report.waiterName})
                </div>
                <div className="border-t-2 border-slate-900 pt-2 text-center font-bold">
                  Unterschrift Kassenprüfer / Festleitung
                </div>
              </div>
            </div>
          )}

          {/* Druckansicht 2: Kompakter 80-mm-Bonstreifen */}
          {settleTemplate === 'RECEIPT_SLIP' && (
            <div className="bg-slate-950 p-4 rounded-2xl flex justify-center print:bg-white print:p-0">
              <div className="bg-white text-slate-950 p-6 rounded-xl border-dashed border-2 border-slate-300 max-w-sm w-full font-mono text-xs shadow-xl print:shadow-none print:border-none print:max-w-none print:p-0">
                <div className="text-center pb-2 mb-2 border-b border-slate-400">
                  <div className="font-bold text-sm">
                    {isCorrection ? '*** ABRECHNUNGSKORREKTUR ***' : '*** SCHICHTABSCHLUSS ***'}
                  </div>
                  <div className="font-bold">{report.eventName}</div>
                  <div>Z-Periode: Z-{report.periodNumber}</div>
                  <div>Bedienung: {report.waiterName}</div>
                  <div>{new Date().toLocaleString('de-DE')}</div>
                </div>

                <div className="py-2 border-b border-slate-400 space-y-1">
                  <div className="font-bold">UMSATZ NACH ZAHLART:</div>
                  {report.byMethod.map((m) => (
                    <div key={m.method} className="flex justify-between">
                      <span>{m.label} ({m.count}x)</span>
                      <span>{money(m.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold pt-1 border-t border-slate-300 text-sm">
                    <span>GESAMT:</span>
                    <span>{money(report.totalGross)}</span>
                  </div>
                </div>

                <div className="py-2 border-b border-slate-400 space-y-1">
                  <div className="font-bold">KASSENSTURZ:</div>
                  <div className="flex justify-between">
                    <span>Soll-Bar:</span>
                    <span>{money(report.cashExpected)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gezählt:</span>
                    <span>{money(countedNum)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm pt-1">
                    <span>Differenz:</span>
                    <span>{difference > 0 ? '+' : ''}{money(difference)}</span>
                  </div>
                </div>

                {/* Optional: Verkaufte Artikel auf Bonstreifen */}
                {printItemsSold && report.itemsSold && report.itemsSold.length > 0 && (
                  <div className="py-2 border-b border-slate-400 space-y-1">
                    <div className="font-bold">VERKAUFTE ARTIKEL:</div>
                    {report.itemsSold.map((it) => (
                      <div key={it.name} className="flex justify-between text-[11px]">
                        <span className="truncate pr-2">{it.quantity}x {it.name}</span>
                        <span className="font-mono">{formatCents(it.amountCents)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Optional: Bestellungen auf Bonstreifen */}
                {printOrders && report.orders && report.orders.length > 0 && (
                  <div className="py-2 border-b border-slate-400 space-y-1">
                    <div className="font-bold">BESTELLUNGEN ({report.orders.length}):</div>
                    {report.orders.map((ord) => (
                      <div key={ord.id} className="text-[10px] pb-1 border-b border-slate-200 last:border-0">
                        <div className="flex justify-between font-bold">
                          <span>#{ord.orderNumber} {ord.time} ({ord.tableName})</span>
                          <span>{formatCents(ord.totalCents)}</span>
                        </div>
                        <div className="text-slate-600 truncate">{ord.itemsSummary}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-6 grid grid-cols-2 gap-4 text-[10px] text-center">
                  <div className="border-t border-slate-400 pt-1">Bedienung</div>
                  <div className="border-t border-slate-400 pt-1">Kasse</div>
                </div>
              </div>
            </div>
          )}

          {/* Druckansicht 3: Management Dashboard-Zusammenfassung */}
          {settleTemplate === 'DASHBOARD_SUMMARY' && (
            <div className="bg-white text-slate-950 rounded-2xl p-8 print:rounded-none print:p-0 font-sans shadow">
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-6">
                <div>
                  {isCorrection ? (
                    <span className="inline-block px-2.5 py-0.5 mb-1 bg-amber-100 text-amber-900 text-xs font-black rounded-lg uppercase">
                      Abrechnungskorrektur
                    </span>
                  ) : null}
                  <h2 className="text-2xl font-black">Schicht-Auswertung &amp; KPIs</h2>
                  <p className="text-xs text-slate-500 font-semibold">{report.eventName} · Bedienung: {report.waiterName}</p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-xs bg-slate-200 px-3 py-1.5 rounded-xl">
                    Periode Z-{report.periodNumber}
                  </span>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <span className="text-xs font-bold text-emerald-800 uppercase block mb-1">Gesamtumsatz</span>
                  <span className="text-2xl font-black text-emerald-900 font-mono">{money(report.totalGross)}</span>
                  <span className="text-[11px] text-emerald-700 block mt-1">{report.transactionCount} Transaktionen</span>
                </div>
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200">
                  <span className="text-xs font-bold text-blue-800 uppercase block mb-1">Bestellungen</span>
                  <span className="text-2xl font-black text-blue-900 font-mono">{report.orderCount ?? 0}</span>
                  <span className="text-[11px] text-blue-700 block mt-1">erfasste Tische/Bons</span>
                </div>
                <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200">
                  <span className="text-xs font-bold text-indigo-800 uppercase block mb-1">Trinkgeld Gesamt</span>
                  <span className="text-2xl font-black text-indigo-900 font-mono">{money(report.tipsTotal)}</span>
                  <span className="text-[11px] text-indigo-700 block mt-1">Bedienung: {money(report.tipWaiterShare)}</span>
                </div>
                <div className={`p-4 rounded-2xl border ${differenceOk ? 'bg-emerald-50 border-emerald-300' : 'bg-rose-50 border-rose-300'}`}>
                  <span className="text-xs font-bold uppercase block mb-1">Kassensturz-Status</span>
                  <span className={`text-2xl font-black font-mono ${differenceOk ? 'text-emerald-900' : 'text-rose-900'}`}>
                    {difference > 0 ? '+' : ''}{money(difference)}
                  </span>
                  <span className="text-[11px] font-bold block mt-1">
                    {differenceOk ? 'Kasse ausgeglichen' : difference > 0 ? 'Überschuss' : 'Fehlbetrag'}
                  </span>
                </div>
              </div>

              {/* Zahlarten Aufteilung */}
              <h3 className="font-black text-sm uppercase mb-3">Zahlarten-Mix</h3>
              <div className="space-y-3 mb-6">
                {report.byMethod.map((m) => {
                  const total = report.totalGross ?? (report.totalGrossCents !== undefined ? report.totalGrossCents / 100 : 0);
                  const amount = m.amount ?? (m.amountCents !== undefined ? m.amountCents / 100 : 0);
                  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
                  return (
                    <div key={m.method} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span>{m.label} ({m.count}×)</span>
                        <span className="font-mono">{money(amount)} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Top Verkaufte Artikel */}
              {printItemsSold && report.itemsSold && report.itemsSold.length > 0 && (
                <div>
                  <h3 className="font-black text-sm uppercase mb-3">
                    Verkaufte Artikel ({report.itemsSold.length} Positionen, {report.itemsSold.reduce((sum, it) => sum + it.quantity, 0)} Stück)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {report.itemsSold.slice(0, 10).map((it) => (
                      <div key={it.name} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="font-semibold truncate pr-2">{it.name}</span>
                        <div className="flex items-center gap-2 font-mono shrink-0">
                          <span className="bg-slate-200 px-1.5 py-0.5 rounded font-bold">{it.quantity}×</span>
                          <span className="font-bold">{formatCents(it.amountCents)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 print:hidden pt-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 min-h-[52px] rounded-2xl bg-blue-600 hover:bg-blue-500 font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition"
            >
              <FileText className="w-4 h-4" />
              Als PDF speichern oder drucken
            </button>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setSelected('');
                setReport(null);
                setCounted('');
                setNotes('');
                setDone(false);
                setIsCorrection(false);
              }}
              className="min-h-[52px] px-5 rounded-2xl bg-slate-900 border border-slate-800 font-bold text-sm text-slate-300 hover:text-white"
            >
              Nächste Bedienung
            </button>
          </div>

          <p className="text-[11px] text-slate-500 print:hidden">
            „Als PDF speichern“ öffnet den Druckdialog des Browsers. Wählen Sie dort Ihr gewünschtes Format (A4 oder Bon).
          </p>
        </div>
      )}
      </div>
      )}

      {/* ============================== TAB 2: STAFF & TIP RULES ============================== */}
      {mainTab === 'STAFF' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" /> Bedienungen &amp; Profil-Zuweisung
              </h2>
              <p className="text-xs text-slate-400">
                Mitarbeiter anlegen, Station-PINs vergeben und individuellen Trinkgeld-Regeln zuweisen.
              </p>
            </div>

            {/* Schnellanlage Kellner */}
            <form onSubmit={createWaiter} className="flex gap-2">
              <input
                type="text"
                value={newWaiterName}
                onChange={(e) => setNewWaiterName(e.target.value)}
                placeholder="Name d. Bedienung"
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                value={newWaiterPin}
                onChange={(e) => setNewWaiterPin(e.target.value)}
                placeholder="PIN"
                maxLength={4}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono w-20 text-center text-white focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 font-bold text-sm text-white rounded-xl shadow transition-all"
              >
                Hinzufügen
              </button>
            </form>
          </div>

          {/* Kellner-Tabelle */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold text-xs uppercase tracking-wider">
                    <th className="pb-3">Name</th>
                    <th className="pb-3">Station-PIN</th>
                    <th className="pb-3">Trinkgeld-Profil</th>
                    <th className="pb-3">Effektive Aufteilung</th>
                    <th className="pb-3 text-right">Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {staffList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500 text-xs">
                        Keine Bedienungen angelegt.
                      </td>
                    </tr>
                  ) : (
                    staffList.map((w) => {
                      const activeProfile = profiles.find((p) => p.id === w.tipProfileId) || profiles.find((p) => p.isDefault);
                      return (
                        <tr key={w.id} className="hover:bg-slate-850/50 transition-colors">
                          <td className="py-3 font-bold text-white">
                            <span>{w.name}</span>
                            {w.waiterNumber ? (
                              <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-950 border border-blue-800 text-[11px] font-mono text-blue-300 font-normal">
                                #{w.waiterNumber}
                              </span>
                            ) : null}
                          </td>
                          <td className="py-3 font-mono text-slate-400">{w.pin}</td>
                          <td className="py-3">
                            <select
                              value={w.tipProfileId || ''}
                              onChange={(e) => assignProfileToWaiter(w.id, e.target.value || null)}
                              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                            >
                              <option value="">Standard-Profil (Default: 100%)</option>
                              {profiles.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.waiterPercent}% Bedienung)
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 font-mono text-xs text-slate-300">
                            {activeProfile ? (
                              <span className="text-emerald-400 font-bold">
                                {activeProfile.waiterPercent}% Kellner / {100 - activeProfile.waiterPercent}% Pool
                              </span>
                            ) : (
                              '100% Kellner'
                            )}
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => deleteWaiter(w.id)}
                              className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-all"
                              title="Entfernen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Trinkgeld-Profile Übersicht */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-400" /> Trinkgeld-Regeln &amp; Pools
                </h3>
                <p className="text-xs text-slate-400">
                  Definiere, wie das Trinkgeld zwischen Bedienung, Bar-, Küchen- und Service-Pool aufgeteilt wird.
                </p>
              </div>
              <button
                onClick={openCreateProfileModal}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs rounded-2xl shadow-lg transition-all"
              >
                <Plus className="w-4 h-4" /> Neues Profil anlegen
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className={`bg-slate-900 border rounded-3xl p-5 flex flex-col justify-between shadow-lg relative ${
                    p.isDefault ? 'border-amber-500/40' : 'border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <h4 className="font-bold text-white text-base">{p.name}</h4>
                        {p.isDefault && (
                          <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-500/30">
                            STANDARD
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditProfileModal(p)}
                          className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-slate-800 transition-all"
                          title="Bearbeiten"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {!p.isDefault && (
                          <button
                            onClick={() => deleteProfile(p.id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-all"
                            title="Löschen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 mt-3 text-xs font-mono">
                      <div className="flex justify-between text-slate-300">
                        <span>Bedienung direkt:</span>
                        <span className="font-bold text-emerald-400">{p.waiterPercent}%</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden flex">
                        <div style={{ width: `${p.waiterPercent}%` }} className="bg-emerald-500 h-full" />
                        <div style={{ width: `${p.barPoolPercent}%` }} className="bg-blue-500 h-full" />
                        <div style={{ width: `${p.kitchenPoolPercent}%` }} className="bg-amber-500 h-full" />
                        <div style={{ width: `${p.servicePoolPercent}%` }} className="bg-purple-500 h-full" />
                      </div>

                      {p.barPoolPercent > 0 && (
                        <div className="flex justify-between text-slate-400">
                          <span>Theke / Bar-Pool:</span>
                          <span className="font-bold text-blue-400">{p.barPoolPercent}%</span>
                        </div>
                      )}
                      {p.kitchenPoolPercent > 0 && (
                        <div className="flex justify-between text-slate-400">
                          <span>Küche-Pool:</span>
                          <span className="font-bold text-amber-400">{p.kitchenPoolPercent}%</span>
                        </div>
                      )}
                      {p.servicePoolPercent > 0 && (
                        <div className="flex justify-between text-slate-400">
                          <span>Service-Pool:</span>
                          <span className="font-bold text-purple-400">{p.servicePoolPercent}%</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-500">
                    Zugewiesene Mitarbeiter: <span className="font-bold text-slate-300">{p.waiters?.length || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================== TAB 3: LIVE-UMSATZÜBERSICHT ============================== */}
      {mainTab === 'STATS' && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase mb-1">
                <span>Umsatz gesamt</span>
                <TrendingUp className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-white">
                {formatCents(Math.round(totalWaiterSales * 100))}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Alle erfassten Bedienungen</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase mb-1">
                <span>Bar eingenommen</span>
                <Banknote className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
                {formatCents(Math.round(totalCashCollected * 100))}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">In Kellner-Portemonnaies</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase mb-1">
                <span>Karte / Unbar</span>
                <CreditCard className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-purple-300">
                {formatCents(Math.round(totalCardCollected * 100))}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Terminals &amp; SumUp</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase mb-1">
                <span>Trinkgeld gesamt</span>
                <Coins className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400">
                {formatCents(Math.round(totalTips * 100))}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Über Kasse verbucht</div>
            </div>
          </div>

          {/* Waiter Details List */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" /> Live-Umsätze je Bedienung
                </h2>
                <p className="text-xs text-slate-400">
                  Umsätze, Zahlarten-Mix, Trinkgeld und direkte Abrechnung
                </p>
              </div>
              <button
                onClick={() => window.print()}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow"
              >
                <Printer className="w-3.5 h-3.5 text-blue-400" />
                <span>Übersicht drucken</span>
              </button>
            </div>

            {waiterStats.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                Noch keine Schicht-Umsätze erfasst.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold text-xs uppercase tracking-wider">
                      <th className="pb-3">Bedienung</th>
                      <th className="pb-3">Profil</th>
                      <th className="pb-3 text-right">Umsatz</th>
                      <th className="pb-3 text-right">Bar</th>
                      <th className="pb-3 text-right">Karte</th>
                      <th className="pb-3 text-right">Trinkgeld</th>
                      <th className="pb-3 text-right">Trinkgeld-Anteil</th>
                      <th className="pb-3 text-right text-amber-400">Soll-Barabgabe</th>
                      <th className="pb-3 text-center">Aktion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {waiterStats.map((w) => {
                      const prof = getWaiterProfile(w.waiterName);
                      const waiterTipShare = (w.tips * prof.waiterPercent) / 100;
                      const poolTipShare = w.tips - waiterTipShare;
                      const cashToHandOver = Math.max(0, w.cashGross - waiterTipShare);

                      return (
                        <tr key={w.waiterName} className="hover:bg-slate-850/50 transition">
                          <td className="py-3.5 font-bold font-sans text-white">
                            {w.waiterName}
                            <span className="block text-[10px] font-mono text-slate-500">
                              {w.transactionCount} Vorgänge
                            </span>
                          </td>
                          <td className="py-3.5 font-sans text-xs text-slate-400">
                            <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded-lg">
                              {prof.name}
                            </span>
                          </td>
                          <td className="py-3.5 text-right font-bold text-white">
                            {formatCents((w as any).totalGrossCents ?? Math.round(((w as any).totalGross ?? 0) * 100))}
                          </td>
                          <td className="py-3.5 text-right text-emerald-400">
                            {formatCents((w as any).cashGrossCents ?? Math.round(((w as any).cashGross ?? 0) * 100))}
                          </td>
                          <td className="py-3.5 text-right text-purple-300">
                            {formatCents((w as any).cardGrossCents ?? Math.round(((w as any).cardGross ?? 0) * 100))}
                          </td>
                          <td className="py-3.5 text-right text-amber-400">
                            {formatCents((w as any).tipsCents ?? Math.round(((w as any).tips ?? 0) * 100))}
                          </td>
                          <td className="py-3.5 text-right text-xs">
                            <span className="text-emerald-400 font-bold">
                              {formatCents(Math.round(waiterTipShare * 100))}
                            </span>
                            {poolTipShare > 0 && (
                              <span className="block text-[10px] text-blue-400">
                                +{formatCents(Math.round(poolTipShare * 100))} Pool
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 text-right font-black text-base text-amber-400">
                            {formatCents(Math.round(cashToHandOver * 100))}
                          </td>
                          <td className="py-3.5 text-center font-sans">
                            <button
                              onClick={() => {
                                setMainTab('SETTLE');
                                setSelected(w.waiterName);
                                void (async () => {
                                  const ok = await loadReport(w.waiterName);
                                  if (ok) setStep(2);
                                })();
                              }}
                              className="px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1 mx-auto"
                              title="Kassensturz und Abrechnung starten"
                            >
                              <Calculator className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Kassensturz</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Profil Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={saveProfile}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white">
                {editingProfile ? 'Trinkgeld-Profil bearbeiten' : 'Neues Trinkgeld-Profil'}
              </h3>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Profil-Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="z. B. Theke 50/50"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-emerald-400 mb-1">
                    Bedienung direkt (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formWaiter}
                    onChange={(e) => setFormWaiter(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-400 mb-1">
                    Theke / Bar-Pool (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formBar}
                    onChange={(e) => setFormBar(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-amber-400 mb-1">
                    Küche-Pool (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formKitchen}
                    onChange={(e) => setFormKitchen(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-400 mb-1">
                    Service-Pool (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formService}
                    onChange={(e) => setFormService(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                <span>Summe aller Anteile:</span>
                <span
                  className={`font-mono font-bold ${
                    Math.abs(formWaiter + formBar + formKitchen + formService - 100) < 0.1
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {formWaiter + formBar + formKitchen + formService}% (Muss 100% sein)
                </span>
              </div>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={formIsDefault}
                  onChange={(e) => setFormIsDefault(e.target.checked)}
                  className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                />
                <span>Als Standard-Profil für neue Bedienungen festlegen</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 font-bold text-xs text-slate-300 rounded-xl transition"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white rounded-xl shadow transition"
              >
                Speichern
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Admin PIN Modal für Abrechnungskorrektur */}
      <PinModal
        isOpen={showPinModal}
        onClose={() => {
          setShowPinModal(false);
          setPendingWaiter(null);
        }}
        onCancel={() => {
          setShowPinModal(false);
          setPendingWaiter(null);
        }}
        onSuccess={handlePinSuccess}
        title="Admin-PIN für Abrechnungskorrektur"
        description={`Bedienung ${pendingWaiter || selected} ist bereits abgerechnet. Bitte gib den 4-stelligen Admin-PIN ein, um eine Korrektur durchzuführen.`}
        stationType="ADMIN"
      />
    </div>
  );
}

export default function AdminSettlePage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center min-h-[400px] text-slate-400">
          Lade Schichtabrechnung …
        </div>
      }
    >
      <AdminSettleContent />
    </Suspense>
  );
}
