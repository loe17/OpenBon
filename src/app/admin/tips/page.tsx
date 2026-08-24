'use client';

import React, { useState, useEffect } from 'react';
import {
  Coins,
  Plus,
  Trash2,
  Edit2,
  Users,
  CheckCircle2,
  AlertCircle,
  Save,
  Shield,
  Loader2,
  Calculator,
  Printer,
  FileSpreadsheet,
  Wallet,
  CreditCard,
  Banknote,
  DollarSign,
  TrendingUp,
  X,
  Sparkles,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface TipProfile {
  id: string;
  name: string;
  waiterPercent: number;
  barPoolPercent: number;
  kitchenPoolPercent: number;
  servicePoolPercent: number;
  isDefault: boolean;
  waiters?: { id: string; name: string }[];
}

interface Waiter {
  id: string;
  name: string;
  pin: string;
  isActive: boolean;
  tipProfileId?: string | null;
  tipProfile?: TipProfile | null;
}

interface WaiterStat {
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

export default function AdminTipsPage() {
  const [activeTab, setActiveTab] = useState<'ABRECHNUNG' | 'MATRIX'>('ABRECHNUNG');
  const [profiles, setProfiles] = useState<TipProfile[]>([]);
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [waiterStats, setWaiterStats] = useState<WaiterStat[]>([]);
  const [loading, setLoading] = useState(true);

  // Profile Modal State
  const [editingProfile, setEditingProfile] = useState<TipProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formWaiter, setFormWaiter] = useState(100);
  const [formBar, setFormBar] = useState(0);
  const [formKitchen, setFormKitchen] = useState(0);
  const [formService, setFormService] = useState(0);
  const [formIsDefault, setFormIsDefault] = useState(false);

  // New Waiter State
  const [newWaiterName, setNewWaiterName] = useState('');
  const [newWaiterPin, setNewWaiterPin] = useState('3333');

  // Kassensturz Modal State
  const [selectedWaiterForKassensturz, setSelectedWaiterForKassensturz] = useState<WaiterStat | null>(null);
  const [cashCounts, setCashCounts] = useState<{ [denom: number]: number }>({
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    2: 0,
    1: 0,
    0.5: 0,
    0.2: 0,
    0.1: 0,
  });

  const [isSettling, setIsSettling] = useState(false);

  const loadData = async () => {
    try {
      const [pRes, wRes, repRes] = await Promise.all([
        fetch('/api/tip-profiles'),
        fetch('/api/waiters'),
        fetch('/api/reports'),
      ]);
      let currentWaiters: Waiter[] = [];
      if (pRes.ok) setProfiles(await pRes.json());
      if (wRes.ok) {
        currentWaiters = await wRes.json();
        setWaiters(currentWaiters);
      }
      if (repRes.ok) {
        const repData = await repRes.json();
        const statMap = new Map<string, WaiterStat>();
        if (repData && Array.isArray(repData.waiterStats)) {
          repData.waiterStats.forEach((ws: WaiterStat) => statMap.set(ws.waiterName, ws));
        }
        // Alle registrierten Bedienungen ohne bisherige Umsätze ebenfalls anzeigen
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
      console.error('Fehler beim Laden:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSettleWaiter = async (stat: WaiterStat) => {
    const prof = getWaiterProfile(stat.waiterName);
    const waiterTipShare = (stat.tips * prof.waiterPercent) / 100;
    const sollBar = Math.max(0, stat.cashGross - waiterTipShare);

    const ok = confirm(
      `Möchtest du die Schicht für "${stat.waiterName}" wirklich abrechnen und die Bedienung abmelden?\n\n` +
      `• Umsatz: ${formatCurrency(stat.totalGross)}\n` +
      `• Bar eingenommen: ${formatCurrency(stat.cashGross)}\n` +
      `• Trinkgeld: ${formatCurrency(stat.tips)}\n` +
      `• Abgabe Hauptkasse: ${formatCurrency(sollBar)}\n\n` +
      `Die Bedienung wird anschließend abgemeldet und muss sich für eine neue Schicht neu anmelden.`
    );
    if (!ok) return;

    setIsSettling(true);
    try {
      const res = await fetch('/api/waiters/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waiterName: stat.waiterName,
          totalGross: stat.totalGross,
          cashGross: stat.cashGross,
          tips: stat.tips,
          handoverAmount: sollBar,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || `Bedienung ${stat.waiterName} erfolgreich abgerechnet!`);
        setSelectedWaiterForKassensturz(null);
        void loadData();
      } else {
        alert(data.error || 'Fehler bei der Schichtabrechnung');
      }
    } catch {
      alert('Netzwerkfehler bei der Schichtabrechnung');
    } finally {
      setIsSettling(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingProfile(null);
    setFormName('');
    setFormWaiter(100);
    setFormBar(0);
    setFormKitchen(0);
    setFormService(0);
    setFormIsDefault(false);
    setIsModalOpen(true);
  };

  const openEditModal = (p: TipProfile) => {
    setEditingProfile(p);
    setFormName(p.name);
    setFormWaiter(p.waiterPercent);
    setFormBar(p.barPoolPercent);
    setFormKitchen(p.kitchenPoolPercent);
    setFormService(p.servicePoolPercent);
    setFormIsDefault(p.isDefault);
    setIsModalOpen(true);
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const sum = formWaiter + formBar + formKitchen + formService;
    if (Math.abs(sum - 100) > 0.1) {
      alert(`Die Summe der Prozentsätze muss genau 100% ergeben (Aktuell: ${sum}%).`);
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
        setIsModalOpen(false);
        loadData();
      } else {
        alert('Fehler beim Speichern des Profils');
      }
    } catch {
      alert('Netzwerkfehler');
    }
  };

  const deleteProfile = async (id: string) => {
    if (!confirm('Möchten Sie dieses Trinkgeld-Profil wirklich löschen?')) return;
    try {
      const res = await fetch(`/api/tip-profiles/${id}`, { method: 'DELETE' });
      if (res.ok) loadData();
    } catch {
      alert('Fehler beim Löschen');
    }
  };

  const assignProfileToWaiter = async (waiterId: string, profileId: string | null) => {
    try {
      const res = await fetch(`/api/waiters/${waiterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipProfileId: profileId }),
      });
      if (res.ok) loadData();
    } catch {
      alert('Fehler beim Zuweisen');
    }
  };

  const createWaiter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWaiterName) return;
    try {
      const res = await fetch('/api/waiters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWaiterName, pin: newWaiterPin }),
      });
      if (res.ok) {
        setNewWaiterName('');
        setNewWaiterPin('3333');
        loadData();
      }
    } catch {
      alert('Fehler beim Anlegen');
    }
  };

  const deleteWaiter = async (id: string) => {
    if (!confirm('Bedienung wirklich entfernen?')) return;
    try {
      const res = await fetch(`/api/waiters/${id}`, { method: 'DELETE' });
      if (res.ok) loadData();
    } catch {
      alert('Fehler beim Löschen');
    }
  };

  // Helper for active tip profile of a waiter
  const getWaiterProfile = (name: string) => {
    const w = waiters.find((item) => item.name.toLowerCase() === name.toLowerCase());
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

  // Totals
  const totalWaiterSales = waiterStats.reduce((sum, w) => sum + w.totalGross, 0);
  const totalCashCollected = waiterStats.reduce((sum, w) => sum + w.cashGross, 0);
  const totalCardCollected = waiterStats.reduce((sum, w) => sum + w.cardGross, 0);
  const totalTips = waiterStats.reduce((sum, w) => sum + w.tips, 0);

  // Kassensturz Total
  const countedCashTotal = Object.entries(cashCounts).reduce(
    (sum, [denom, count]) => sum + parseFloat(denom) * (count || 0),
    0
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-3" />
        <p>Kellner-Abrechnungen & Trinkgeld werden geladen...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 sm:p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-amber-500 to-amber-700 text-white rounded-2xl shadow-lg">
              <Coins className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Kellner-Abrechnung & Trinkgeld
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Schichtumsätze, Kassensturz, Trinkgeld-Pools & Übergabe an die Hauptkasse
              </p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 self-start md:self-auto">
            <button
              onClick={() => setActiveTab('ABRECHNUNG')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow ${
                activeTab === 'ABRECHNUNG'
                  ? 'bg-blue-600 text-white shadow-blue-950/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calculator className="w-4 h-4" />
              <span>Schichtabrechnung & Kassensturz</span>
            </button>
            <button
              onClick={() => setActiveTab('MATRIX')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow ${
                activeTab === 'MATRIX'
                  ? 'bg-amber-600 text-white shadow-amber-950/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Coins className="w-4 h-4" />
              <span>Trinkgeld-Matrix & Pools</span>
            </button>
          </div>
        </div>

        {/* ======================= TAB 1: SCHICHTABRECHNUNG ======================= */}
        {activeTab === 'ABRECHNUNG' && (
          <div className="space-y-6">
            {/* Top KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase mb-1">
                  <span>Umsatz gesamt</span>
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-white">
                  {formatCurrency(totalWaiterSales)}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Alle erfassten Bedienungen</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase mb-1">
                  <span>Bar eingenommen</span>
                  <Banknote className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
                  {formatCurrency(totalCashCollected)}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">In Kellner-Portemonnaies</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase mb-1">
                  <span>Karte / Unbar</span>
                  <CreditCard className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-purple-300">
                  {formatCurrency(totalCardCollected)}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Terminals & SumUp/VR Pay</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase mb-1">
                  <span>Trinkgeld gesamt</span>
                  <Coins className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400">
                  {formatCurrency(totalTips)}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Über Kasse verbucht</div>
              </div>
            </div>

            {/* Waiter Details List */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-400" /> Einzelabrechnung je Bedienung
                  </h2>
                  <p className="text-xs text-slate-400">
                    Kassierte Barbeträge, Trinkgeld-Ausschüttung und abzugebender Kassenbetrag
                  </p>
                </div>
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-400" />
                  <span>Abrechnung drucken</span>
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
                        <th className="pb-3 text-center">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {waiterStats.map((w) => {
                        const prof = getWaiterProfile(w.waiterName);
                        const waiterTipShare = (w.tips * prof.waiterPercent) / 100;
                        const poolTipShare = w.tips - waiterTipShare;
                        // Soll Barabgabe = Bar eingenommen - Kellner-Trinkgeld
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
                              {formatCurrency(w.totalGross)}
                            </td>
                            <td className="py-3.5 text-right text-emerald-400">
                              {formatCurrency(w.cashGross)}
                            </td>
                            <td className="py-3.5 text-right text-purple-300">
                              {formatCurrency(w.cardGross)}
                            </td>
                            <td className="py-3.5 text-right text-amber-400">
                              {formatCurrency(w.tips)}
                            </td>
                            <td className="py-3.5 text-right text-xs">
                              <span className="text-emerald-400 font-bold">
                                {formatCurrency(waiterTipShare)}
                              </span>
                              {poolTipShare > 0 && (
                                <span className="block text-[10px] text-blue-400">
                                  +{formatCurrency(poolTipShare)} Pool
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 text-right font-black text-base text-amber-400">
                              {formatCurrency(cashToHandOver)}
                            </td>
                            <td className="py-3.5 text-center font-sans">
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                <button
                                  onClick={() => {
                                    setSelectedWaiterForKassensturz(w);
                                    setCashCounts({
                                      100: 0,
                                      50: 0,
                                      20: 0,
                                      10: 0,
                                      5: 0,
                                      2: 0,
                                      1: 0,
                                      0.5: 0,
                                      0.2: 0,
                                      0.1: 0,
                                    });
                                  }}
                                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
                                  title="Geldzähler / Kassensturz öffnen"
                                >
                                  <Calculator className="w-3.5 h-3.5 text-blue-400" />
                                  <span>Kassensturz</span>
                                </button>
                                <button
                                  onClick={() => handleSettleWaiter(w)}
                                  disabled={isSettling}
                                  className="px-2.5 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1"
                                  title="Schicht abrechnen und Kellner abmelden"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Abrechnen</span>
                                </button>
                              </div>
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

        {/* ======================= TAB 2: TRINKGELD-MATRIX & PROFILE ======================= */}
        {activeTab === 'MATRIX' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button
                onClick={openCreateModal}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs rounded-2xl shadow-lg transition-all"
              >
                <Plus className="w-4 h-4" /> Neues Profil anlegen
              </button>
            </div>

            {/* Profile Übersicht */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className={`bg-slate-900 border rounded-3xl p-6 flex flex-col justify-between shadow-lg relative ${
                    p.isDefault ? 'border-amber-500/40' : 'border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <h3 className="font-bold text-white text-lg">{p.name}</h3>
                        {p.isDefault && (
                          <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-500/30">
                            STANDARD (DEFAULT)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-2 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-slate-800 transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {!p.isDefault && (
                          <button
                            onClick={() => deleteProfile(p.id)}
                            className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Prozent-Balken */}
                    <div className="space-y-2 mt-4 text-xs font-mono">
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

                  <div className="mt-6 pt-4 border-t border-slate-800/80 text-xs text-slate-500">
                    Zugewiesene Mitarbeiter: <span className="font-bold text-slate-300">{p.waiters?.length || 0}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Kellner-Zuordnungs-Tabelle */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-400" /> Bedienungen & Profil-Zuweisung
                  </h2>
                  <p className="text-xs text-slate-400">
                    Jede Bedienung kann einem individuellen Trinkgeld-Profil zugewiesen werden.
                  </p>
                </div>

                {/* Schnellanlage Kellner */}
                <form onSubmit={createWaiter} className="flex gap-2">
                  <input
                    type="text"
                    value={newWaiterName}
                    onChange={(e) => setNewWaiterName(e.target.value)}
                    placeholder="Name d. Bedienung"
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    value={newWaiterPin}
                    onChange={(e) => setNewWaiterPin(e.target.value)}
                    placeholder="PIN"
                    maxLength={4}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono w-20 text-center text-white focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 font-bold text-sm text-white rounded-xl shadow transition-all"
                  >
                    Hinzufügen
                  </button>
                </form>
              </div>

              {/* Tabelle */}
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
                    {waiters.map((w) => {
                      const activeProfile = profiles.find((p) => p.id === w.tipProfileId) || profiles.find((p) => p.isDefault);
                      return (
                        <tr key={w.id} className="hover:bg-slate-850/50 transition-colors">
                          <td className="py-3 font-bold text-white">{w.name}</td>
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
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Profil Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={saveProfile}
            className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-md w-full shadow-2xl space-y-4"
          >
            <h3 className="text-xl font-bold text-white mb-2">
              {editingProfile ? 'Trinkgeld-Profil bearbeiten' : 'Neues Trinkgeld-Profil'}
            </h3>

            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">Profil-Name:</label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="z. B. Bar-Team oder Service-Mix"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-emerald-400 font-bold block mb-1">Bedienung direkt (%):</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  value={formWaiter}
                  onChange={(e) => setFormWaiter(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-blue-400 font-bold block mb-1">Theke / Bar-Pool (%):</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  value={formBar}
                  onChange={(e) => setFormBar(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-amber-400 font-bold block mb-1">Küche-Pool (%):</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  value={formKitchen}
                  onChange={(e) => setFormKitchen(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-purple-400 font-bold block mb-1">Service-Pool (%):</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  value={formService}
                  onChange={(e) => setFormService(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs font-mono">
              <span className="text-slate-400">Summe aller Anteile:</span>
              <span
                className={`font-black text-sm ${
                  formWaiter + formBar + formKitchen + formService === 100
                    ? 'text-emerald-400'
                    : 'text-red-400'
                }`}
              >
                {formWaiter + formBar + formKitchen + formService}% (Muss 100% sein)
              </span>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={formIsDefault}
                onChange={(e) => setFormIsDefault(e.target.checked)}
                className="rounded text-blue-600 focus:ring-0"
              />
              <span>Als Standard-Profil für alle unzugewiesenen Kellner festlegen</span>
            </label>

            <div className="flex gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 font-bold text-sm rounded-xl text-slate-300"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 font-bold text-sm rounded-xl text-white shadow-lg"
              >
                Speichern
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Kassensturz-Zählhilfe Modal */}
      {selectedWaiterForKassensturz && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-emerald-400" /> Kassensturz:{' '}
                  {selectedWaiterForKassensturz.waiterName}
                </h3>
                <p className="text-xs text-slate-400">Geldzähler für Münzen und Scheine</p>
              </div>
              <button
                onClick={() => setSelectedWaiterForKassensturz(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Zählraster */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <div className="grid grid-cols-2 gap-2">
                {[100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1].map((denom) => (
                  <div
                    key={denom}
                    className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl"
                  >
                    <span className="font-mono font-bold text-sm text-slate-200 w-16">
                      {denom >= 1 ? `${denom} €` : `${Math.round(denom * 100)} ct`}
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={cashCounts[denom] || ''}
                      placeholder="0"
                      onChange={(e) =>
                        setCashCounts({
                          ...cashCounts,
                          [denom]: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center font-mono font-bold text-sm text-white"
                    />
                    <span className="font-mono text-xs text-slate-400 w-16 text-right">
                      {formatCurrency(denom * (cashCounts[denom] || 0))}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ergebnis-Box */}
            {(() => {
              const prof = getWaiterProfile(selectedWaiterForKassensturz.waiterName);
              const waiterTipShare = (selectedWaiterForKassensturz.tips * prof.waiterPercent) / 100;
              const sollBar = Math.max(0, selectedWaiterForKassensturz.cashGross - waiterTipShare);
              const diff = countedCashTotal - sollBar;

              return (
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 font-mono text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Soll-Abgabe Hauptkasse:</span>
                    <span className="font-bold text-amber-400">{formatCurrency(sollBar)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Gezählter Ist-Bestand:</span>
                    <span className="font-black text-sm text-white">{formatCurrency(countedCashTotal)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-800 font-bold text-sm">
                    <span>Differenz:</span>
                    <span
                      className={
                        Math.abs(diff) < 0.01
                          ? 'text-emerald-400'
                          : diff > 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }
                    >
                      {diff >= 0 ? `+${formatCurrency(diff)}` : formatCurrency(diff)}
                    </span>
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedWaiterForKassensturz(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
              >
                Schließen
              </button>
              <button
                onClick={() => handleSettleWaiter(selectedWaiterForKassensturz)}
                disabled={isSettling}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-950 flex items-center gap-2 transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Schicht abrechnen &amp; Bedienung abmelden</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
