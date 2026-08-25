'use client';

import React, { useState, useEffect } from 'react';
import { useSocket } from '@/components/providers/socket-provider';
import { triggerHapticFeedback } from '@/lib/socket-client';
import { playConfirm } from '@/lib/audio-feedback';
import {
  Beer,
  RefreshCw,
  Plus,
  AlertTriangle,
  Settings2,
  Trash2,
  Activity,
  CheckCircle2,
  Sparkles,
  Droplets,
  Layers,
  ArrowUpRight,
  Flame,
} from 'lucide-react';

interface TapLineDTO {
  id: string;
  tapNumber: number;
  name: string;
  kegVolumeLiters: number;
  currentVolumeLiters: number;
  portionSizeLiters: number;
  lossPercentage: number;
  warningLevelPercent: number;
  kegsTapped: number;
  productId?: string | null;
  product?: {
    id: string;
    name: string;
    price: number;
    stockQuantity: number;
  } | null;
  isActive: boolean;
  fillPercentage: number;
  portionsRemaining: number;
  isWarning: boolean;
}

interface ProductDTO {
  id: string;
  name: string;
  price: number;
}

import { useToast } from '@/components/ui/toast';

export default function TapsMonitorPage() {
  const { success, error } = useToast();
  const { socket } = useSocket();
  const [taps, setTaps] = useState<TapLineDTO[]>([]);
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTap, setEditingTap] = useState<TapLineDTO | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    tapNumber: 1,
    name: '',
    kegVolumeLiters: 50.0,
    portionSizeLiters: 0.5,
    lossPercentage: 3.0,
    warningLevelPercent: 10.0,
    productId: '',
  });

  const fetchTaps = async () => {
    try {
      const res = await fetch('/api/taps');
      const data = await res.json();
      if (Array.isArray(data)) {
        setTaps(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (Array.isArray(data)) {
        setProducts(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTaps();
    fetchProducts();

    if (socket) {
      socket.on('tap:updated', () => fetchTaps());
      socket.on('tap:deleted', () => fetchTaps());
      socket.on('tap:volume_updated', (update: { tapId: string; currentVolumeLiters: number }) => {
        setTaps((prev) =>
          prev.map((t) => {
            if (t.id !== update.tapId) return t;
            const percent = t.kegVolumeLiters > 0
              ? Math.min(100, Math.max(0, (update.currentVolumeLiters / t.kegVolumeLiters) * 100))
              : 0;
            const effectivePortion = t.portionSizeLiters * (1 + t.lossPercentage / 100);
            const portionsRemaining = effectivePortion > 0
              ? Math.floor(update.currentVolumeLiters / effectivePortion)
              : 0;
            return {
              ...t,
              currentVolumeLiters: update.currentVolumeLiters,
              fillPercentage: Number(percent.toFixed(1)),
              portionsRemaining,
              isWarning: percent <= t.warningLevelPercent,
            };
          })
        );
      });
      socket.on('payment:completed', () => fetchTaps());
    }

    return () => {
      if (socket) {
        socket.off('tap:updated');
        socket.off('tap:deleted');
        socket.off('tap:volume_updated');
        socket.off('payment:completed');
      }
    };
  }, [socket]);

  const handleKegChange = async (tapId: string, kegVolume: number) => {
    triggerHapticFeedback();
    playConfirm();
    try {
      await fetch('/api/taps', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tapId, action: 'CHANGE_KEG', kegVolumeLiters: kegVolume }),
      });
      fetchTaps();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveTap = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHapticFeedback();
    try {
      if (editingTap) {
        await fetch('/api/taps', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingTap.id,
            ...formData,
          }),
        });
      } else {
        await fetch('/api/taps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }
      setShowModal(false);
      setEditingTap(null);
      fetchTaps();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTap = async (id: string) => {
    try {
      await fetch(`/api/taps/${id}`, { method: 'DELETE' });
      success('Zapfhahn gelöscht');
      fetchTaps();
    } catch (e) {
      error('Fehler beim Löschen des Zapfhahns');
    }
  };

  const openCreateModal = () => {
    setEditingTap(null);
    setFormData({
      tapNumber: taps.length + 1,
      name: `Zapfhahn ${taps.length + 1}`,
      kegVolumeLiters: 50.0,
      portionSizeLiters: 0.5,
      lossPercentage: 3.0,
      warningLevelPercent: 10.0,
      productId: products[0]?.id || '',
    });
    setShowModal(true);
  };

  const openEditModal = (tap: TapLineDTO) => {
    setEditingTap(tap);
    setFormData({
      tapNumber: tap.tapNumber,
      name: tap.name,
      kegVolumeLiters: tap.kegVolumeLiters,
      portionSizeLiters: tap.portionSizeLiters,
      lossPercentage: tap.lossPercentage,
      warningLevelPercent: tap.warningLevelPercent,
      productId: tap.productId || '',
    });
    setShowModal(true);
  };

  const totalLitersServedToday = taps.reduce(
    (sum, t) => sum + (t.kegsTapped * t.kegVolumeLiters - t.currentVolumeLiters),
    0
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-white overflow-y-auto">
      {/* Top Header */}
      <div className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 p-4 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 text-black p-2.5 rounded-2xl shadow">
              <Beer className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-black text-xl tracking-tight flex items-center gap-2">
                <span>Fass- & Schankmonitor</span>
                <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-mono font-bold">
                  Live
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-semibold">
                Echtzeit-Füllstände, Schankverlust-Kalkulation & Fasswechsel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl text-xs">
              <Droplets className="w-4 h-4 text-amber-400" />
              <span className="text-slate-400">Heute ausgeschenkt:</span>
              <span className="font-mono font-black text-amber-300">
                {Math.max(0, totalLitersServedToday).toFixed(1)} Liter
              </span>
            </div>

            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Zapfhahn anlegen</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Tap Lines Grid */}
      <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span>Lade Schankanlagen...</span>
          </div>
        ) : taps.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center max-w-lg mx-auto">
            <Beer className="w-16 h-16 text-amber-500/40 mx-auto mb-4" />
            <h3 className="font-black text-lg mb-1">Keine Zapfhähne konfiguriert</h3>
            <p className="text-xs text-slate-400 mb-6">
              Richte deine Zapfhähne ein, um Füllstände der Bierfässer live zu überwachen und Schankverluste automatisch zu erfassen.
            </p>
            <button
              onClick={openCreateModal}
              className="bg-amber-500 hover:bg-amber-400 text-black font-black px-6 py-3 rounded-2xl text-sm transition shadow-lg inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>Ersten Zapfhahn anlegen</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {taps.map((tap) => {
              const percent = tap.fillPercentage;
              const isLow = tap.isWarning;

              return (
                <div
                  key={tap.id}
                  className={`bg-slate-900 border rounded-3xl p-5 relative overflow-hidden transition-all shadow-xl flex flex-col justify-between ${
                    isLow
                      ? 'border-rose-500/80 shadow-rose-950/30'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Top Bar inside Card */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 font-mono font-black flex items-center justify-center text-sm shadow">
                          #{tap.tapNumber}
                        </span>
                        <div>
                          <h3 className="font-black text-base leading-snug">{tap.name}</h3>
                          <p className="text-xs text-slate-400 font-semibold">
                            {tap.product ? tap.product.name : 'Kein Artikel verknüpft'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(tap)}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                          title="Einstellungen"
                        >
                          <Settings2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTap(tap.id)}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 transition"
                          title="Löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Warning Banner if below threshold */}
                    {isLow && (
                      <div className="bg-rose-500/20 border border-rose-500/50 text-rose-300 px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-2 mb-4 animate-pulse">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>Fass fast leer! Bitte Fasswechsel vorbereiten.</span>
                      </div>
                    )}

                    {/* Liquid Gauge Visual */}
                    <div className="relative h-28 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden my-3 p-3 flex flex-col justify-between">
                      {/* Animated Liquid Background */}
                      <div
                        className={`absolute inset-x-0 bottom-0 transition-all duration-700 opacity-80 ${
                          isLow
                            ? 'bg-gradient-to-t from-rose-600 to-rose-400'
                            : percent < 30
                            ? 'bg-gradient-to-t from-amber-600 to-amber-400'
                            : 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                        }`}
                        style={{ height: `${Math.max(6, percent)}%` }}
                      >
                        {/* Wave highlight */}
                        <div className="absolute top-0 inset-x-0 h-2 bg-white/30" />
                      </div>

                      {/* Foreground Stats */}
                      <div className="relative z-10 flex items-center justify-between">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 drop-shadow">
                          Restvolumen
                        </span>
                        <span className="font-mono font-extrabold text-sm text-white drop-shadow bg-black/40 px-2 py-0.5 rounded-lg border border-white/10">
                          {percent}%
                        </span>
                      </div>

                      <div className="relative z-10 flex items-baseline justify-between">
                        <div>
                          <span className="text-3xl font-mono font-black text-white drop-shadow-md">
                            {tap.currentVolumeLiters.toFixed(1)}
                          </span>
                          <span className="text-xs font-mono text-slate-200 ml-1">
                            / {tap.kegVolumeLiters} Liter
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-xl font-mono font-black text-amber-300 drop-shadow">
                            ~{tap.portionsRemaining}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-200 block">
                            Portionen ({tap.portionSizeLiters}l)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Tap Details Metrics */}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs py-2 border-t border-slate-800/80">
                      <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-semibold">Schankverlust</span>
                        <span className="font-mono font-black text-slate-200">{tap.lossPercentage}%</span>
                      </div>
                      <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-semibold">Fässer heute</span>
                        <span className="font-mono font-black text-amber-400">#{tap.kegsTapped}</span>
                      </div>
                      <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-semibold">Warnlevel</span>
                        <span className="font-mono font-black text-slate-200">{tap.warningLevelPercent}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Fasswechsel Quick Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-2">
                    <button
                      onClick={() => handleKegChange(tap.id, 50.0)}
                      className="flex-1 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-black py-2.5 px-3 rounded-2xl text-xs transition shadow active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>50l Fass angeschlagen</span>
                    </button>
                    <button
                      onClick={() => handleKegChange(tap.id, 30.0)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 px-3 rounded-2xl text-xs transition active:scale-95"
                      title="30l Fass anschlagen"
                    >
                      30l
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Zapfhahn anlegen / bearbeiten */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <h2 className="font-black text-lg flex items-center gap-2">
                <Beer className="w-5 h-5 text-amber-400" />
                <span>{editingTap ? 'Zapfhahn bearbeiten' : 'Neuen Zapfhahn anlegen'}</span>
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTap} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Hahn-Nr.</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.tapNumber}
                    onChange={(e) => setFormData({ ...formData, tapNumber: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-400 font-bold block mb-1">Bezeichnung</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                    placeholder="z. B. Helles Festbier"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">Verknüpfter Kassenartikel</label>
                <select
                  value={formData.productId}
                  onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                >
                  <option value="">-- Kein Artikel verknüpft --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.price.toFixed(2)} €)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Fassvolumen (Liter)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.kegVolumeLiters}
                    onChange={(e) => setFormData({ ...formData, kegVolumeLiters: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Portionsgröße (Liter)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={formData.portionSizeLiters}
                    onChange={(e) => setFormData({ ...formData, portionSizeLiters: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Schankverlust (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.lossPercentage}
                    onChange={(e) => setFormData({ ...formData, lossPercentage: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Warnlevel (%)</label>
                  <input
                    type="number"
                    value={formData.warningLevelPercent}
                    onChange={(e) => setFormData({ ...formData, warningLevelPercent: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-bold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-400 text-black font-black px-5 py-2.5 rounded-xl text-xs transition shadow"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
