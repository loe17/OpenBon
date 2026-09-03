'use client';

import React, { useEffect, useState } from 'react';
import { useSocket } from '@/components/providers/socket-provider';
import {
  HardDrive,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  Sparkles,
  Ban,
  Check,
  Beer,
} from 'lucide-react';
import type { ProductDTO } from '@/types/domain';

/** Eine Zeile aus /api/inventory */
interface InventoryRow {
  id: string;
  productId: string;
  product: ProductDTO;
  currentQuantity: number;
  alertThreshold: number;
  isSoldOut: boolean;
}

export default function AdminInventoryPage() {
  const { socket } = useSocket();
  const [stockItems, setStockItems] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [restockModal, setRestockModal] = useState<InventoryRow | null>(null);
  const [addAmount, setAddAmount] = useState<number>(50);

  const fetchStock = async () => {
    try {
      const res = await fetch('/api/inventory');
      const data = await res.json();
      if (Array.isArray(data)) {
        setStockItems(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();

    if (socket) {
      socket.on('stock:updated', () => fetchStock());
      socket.on('order:new', () => fetchStock());
      socket.on('product:updated', () => fetchStock());
    }

    return () => {
      if (socket) {
        socket.off('stock:updated');
        socket.off('order:new');
        socket.off('product:updated');
      }
    };
  }, [socket]);

  const handleQuickAdd = async (productId: string, amount: number) => {
    try {
      await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          addQuantity: amount,
        }),
      });
      fetchStock();
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleSoldOut = async (productId: string, currentSoldOut: boolean) => {
    try {
      await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSoldOut: !currentSoldOut }),
      });
      fetchStock();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCustomRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockModal || addAmount <= 0) return;
    await handleQuickAdd(restockModal.productId, addAmount);
    setRestockModal(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 text-white p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-amber-600 text-white p-2.5 rounded-2xl shadow">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Warenbestand & Lager</h1>
            <p className="text-xs text-slate-400">
              Echtzeit-Bestandsabzug bei jeder Bestellung, Fasswechsel und Schnellnachfüllung
            </p>
          </div>
        </div>

        <button
          onClick={fetchStock}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Aktualisieren</span>
        </button>
      </div>

      {/* Stock Items Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span className="text-sm font-semibold">Lade Lagerbestände...</span>
        </div>
      ) : stockItems.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-400 space-y-3 max-w-md mx-auto my-12">
          <Package className="w-12 h-12 mx-auto text-slate-600 stroke-1" />
          <h3 className="font-extrabold text-white text-base">Keine Artikel mit Bestandsüberwachung</h3>
          <p className="text-xs">
            Gehe in die <strong className="text-white">Artikelverwaltung</strong> und aktiviere bei den gewünschten Artikeln die Option <em>&quot;Bestand für diesen Artikel überwachen&quot;</em>.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stockItems.map((item) => {
            const isLow = item.currentQuantity <= item.alertThreshold && item.currentQuantity > 0;
            const isOut = item.currentQuantity <= 0 || item.isSoldOut;

            return (
              <div
                key={item.id}
                className={`bg-slate-900 border rounded-3xl p-5 shadow-lg flex flex-col justify-between transition ${
                  isOut
                    ? 'border-rose-900/60 bg-rose-950/20'
                    : isLow
                    ? 'border-amber-700/60 bg-amber-950/20'
                    : 'border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {item.product?.category?.name || 'Artikel'}
                    </span>
                    <button
                      onClick={() => handleToggleSoldOut(item.productId, item.isSoldOut)}
                      className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition ${
                        item.isSoldOut
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {item.isSoldOut ? <Ban className="w-3 h-3" /> : <Check className="w-3 h-3 text-emerald-400" />}
                      <span>{item.isSoldOut ? 'Gesperrt' : 'Aktiv'}</span>
                    </button>
                  </div>

                  <h3 className="font-black text-lg text-white mb-2">{item.product?.name}</h3>

                  <div className="flex items-baseline gap-2 mb-4">
                    <span
                      className={`text-3xl font-black ${
                        isOut ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {item.currentQuantity}
                    </span>
                    <span className="text-xs text-slate-400 font-bold">Stk. / Portionen</span>
                  </div>

                  {isLow && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold mb-3">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Bestand kritisch! Schwelle: {item.alertThreshold} Stk.</span>
                    </div>
                  )}
                  {isOut && (
                    <div className="flex items-center gap-1.5 text-xs text-rose-400 font-bold mb-3">
                      <Ban className="w-4 h-4" />
                      <span>Artikel ist als AUSVERKAUFT gesperrt!</span>
                    </div>
                  )}
                </div>

                {/* Quick Restock Buttons */}
                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Schnell nachfüllen:
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      onClick={() => handleQuickAdd(item.productId, 10)}
                      className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition border border-slate-700"
                    >
                      +10
                    </button>
                    <button
                      onClick={() => handleQuickAdd(item.productId, 50)}
                      className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition border border-slate-700"
                    >
                      +50
                    </button>
                    <button
                      onClick={() => handleQuickAdd(item.productId, 100)}
                      className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition border border-slate-700"
                      title="100 Stk. (z. B. 50L Fass / Kiste)"
                    >
                      <span className="inline-flex items-center justify-center gap-1">
                        <span>+100</span>
                        <Beer className="w-3.5 h-3.5" />
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setRestockModal(item);
                        setAddAmount(50);
                      }}
                      className="py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow"
                    >
                      +...
                    </button>
                  </div>
                  <button
                    onClick={async () => {
                      const v = window.prompt(`Inventur-Zählung für ${item.product?.name} (Soll: ${item.currentQuantity}). Gezählte Menge eingeben:`, String(item.currentQuantity));
                      if (v === null) return;
                      const counted = Number(v.replace(',', '.'));
                      if (!Number.isFinite(counted) || counted < 0) { alert('Ungültige Menge.'); return; }
                      const res = await fetch('/api/stock-units/count', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: item.productId, countedQuantity: counted, note: 'Inventur Admin' }) });
                      const j = await res.json().catch(() => ({}));
                      alert(res.ok ? `Gezählt: Soll ${j.soll}, Ist ${j.ist}, Diff ${j.diff}` : (j.error || 'Fehlgeschlagen'));
                      window.location.reload();
                    }}
                    className="mt-2 w-full py-2 bg-amber-600 hover:bg-amber-500 text-black rounded-xl text-xs font-black min-h-[44px]"
                    title="Soll/Ist-Zählung mit Differenzbuchung"
                  >
                    Zählen (Inventur)
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Custom Restock Modal */}
      {restockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="font-extrabold text-lg text-white">
              {restockModal.product?.name} nachfüllen
            </h3>

            <form onSubmit={handleCustomRestock} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Menge hinzufügen
                </label>
                <input
                  type="number"
                  min="1"
                  autoFocus
                  value={addAmount}
                  onChange={(e) => setAddAmount(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-lg font-black text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockModal(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black shadow"
                >
                  Einbuchen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
