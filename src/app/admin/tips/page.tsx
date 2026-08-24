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
} from 'lucide-react';

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

export default function AdminTipsPage() {
  const [profiles, setProfiles] = useState<TipProfile[]>([]);
  const [waiters, setWaiters] = useState<Waiter[]>([]);
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

  const loadData = async () => {
    try {
      const [pRes, wRes] = await Promise.all([
        fetch('/api/tip-profiles'),
        fetch('/api/waiters'),
      ]);
      if (pRes.ok && wRes.ok) {
        setProfiles(await pRes.json());
        setWaiters(await wRes.json());
      }
    } catch (err) {
      console.error('Fehler beim Laden:', err);
    } finally {
      setLoading(false);
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
    } catch (err) {
      alert('Netzwerkfehler');
    }
  };

  const deleteProfile = async (id: string) => {
    if (!confirm('Möchten Sie dieses Trinkgeld-Profil wirklich löschen?')) return;
    try {
      const res = await fetch(`/api/tip-profiles/${id}`, { method: 'DELETE' });
      if (res.ok) loadData();
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
      alert('Fehler beim Anlegen');
    }
  };

  const deleteWaiter = async (id: string) => {
    if (!confirm('Bedienung wirklich entfernen?')) return;
    try {
      const res = await fetch(`/api/waiters/${id}`, { method: 'DELETE' });
      if (res.ok) loadData();
    } catch (err) {
      alert('Fehler beim Löschen');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-3" />
        <p>Trinkgeld-Profile werden geladen...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                <Coins className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white">
                Trinkgeld-Verteilungsmatrix
              </h1>
            </div>
            <p className="text-sm text-slate-400">
              Konfigurieren Sie flexible Trinkgeld-Pools und weisen Sie diese individuellen Bedienungen zu (Spec V2 §5.3).
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-sm rounded-2xl shadow-lg transition-all"
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
    </div>
  );
}
