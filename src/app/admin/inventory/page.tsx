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
} from 'lucide-react';

export default function AdminInventoryPage() {
  const { socket } = useSocket();
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [restockModal, setRestockModal] = useState<any>(null);
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
    }

    return () => {
      if (socket) {
        socket.off('stock:updated');
        socket.off('order:new');
      }
    };
  }, [socket]);

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockModal || addAmount <= 0) return;
    try {
      await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: restockModal.productId,
          addQuantity: addAmount,
        }),
      });
      setRestockModal(null);
      fetchStock();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 text-white p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-amber-600 text-white p-2.5 rounded-2xl">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Lagerbestand & Ausverkaufsschutz</h1>
            <p className="text-xs text-slate-400">
              Echtzeit-Bestandskontrolle mit automatischer Sperre bei Bestand 0 und Live-Nachstockung
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

      {/* Stock Cards */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Lade Lagerbestände...</span>
        </div>
      ) : stockItems.length === 0 ? (
        <div className="text-center py-12 text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800">
          Aktuell ist für keine Artikel eine Bestandserfassung aktiviert.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stockItems.map((item) => {
            const isSoldOut = item.currentQuantity <= 0;
            const isWarning = item.currentQuantity > 0 && item.currentQuantity <= item.alertThreshold;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border flex flex-col justify-between shadow-lg transition ${
                  isSoldOut
                    ? 'bg-gradient-to-br from-rose-950/80 to-slate-900 border-rose-600 shadow-rose-950/40'
                    : isWarning
                    ? 'bg-gradient-to-br from-amber-950/60 to-slate-900 border-amber-500'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-bold text-base text-white">{item.product.name}</h4>
                    {isSoldOut ? (
                      <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                        Ausverkauft
                      </span>
                    ) : isWarning ? (
                      <span className="bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Knapp (&lt;{item.alertThreshold})
                      </span>
                    ) : (
                      <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Verfügbar
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between mb-3">
                    <span className="text-xs text-slate-400">Aktueller Restbestand:</span>
                    <span
                      className={`text-3xl font-black font-mono ${
                        isSoldOut ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {item.currentQuantity} Stk.
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800 mb-3 space-y-1">
                    <div>Anfangsbestand: {item.initialQuantity} Stk.</div>
                    <div>Warnschwelle: {item.alertThreshold} Stk.</div>
                    <div>Auto-Deaktivierung bei 0: {item.isAutoDeactivate ? 'Aktiviert' : 'Deaktiviert'}</div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setRestockModal(item);
                    setAddAmount(50);
                  }}
                  className="pos-touch-btn w-full py-2.5 bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nachstocken (+ Menge)</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Restock Modal */}
      {restockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleRestock}
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white">Bestand nachfüllen</h3>
                <p className="text-xs text-slate-400">{restockModal.product.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setRestockModal(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1.5">Hinzuzufügende Menge:</label>
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                {[10, 25, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAddAmount(amt)}
                    className="py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold text-slate-300"
                  >
                    +{amt}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                required
                value={addAmount}
                onChange={(e) => setAddAmount(parseInt(e.target.value) || 1)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRestockModal(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-900/30"
              >
                Einbuchen
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
