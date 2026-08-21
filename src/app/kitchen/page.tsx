'use client';

import React, { useEffect, useState } from 'react';
import { useSocket } from '@/components/providers/socket-provider';
import { playKitchenChime, triggerHapticFeedback } from '@/lib/socket-client';
import {
  ChefHat,
  Clock,
  CheckCircle2,
  ListOrdered,
  Layers,
  Volume2,
  RefreshCw,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

interface KitchenOrder {
  id: string;
  orderNumber: number;
  tableLabel?: string | null;
  table?: { label: string } | null;
  tokenNumber?: number | null;
  waiterName: string;
  status: string;
  createdAt: string;
  items: {
    id: string;
    productName: string;
    quantity: number;
    variantName?: string | null;
    selectedOptions?: string | null;
    customizationText?: string | null;
    kdsStatus: string;
  }[];
}

export default function KitchenMonitorPage() {
  const { socket } = useSocket();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [viewMode, setViewMode] = useState<'FIFO' | 'TABLE'>('FIFO');
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const fetchKdsOrders = async () => {
    try {
      const res = await fetch('/api/orders?kds=true');
      const data = await res.json();
      if (Array.isArray(data)) {
        setOrders(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKdsOrders();

    // Timer tick every 10 seconds to update order elapsed times
    const timer = setInterval(() => setCurrentTime(Date.now()), 10000);

    if (socket) {
      socket.on('order:new', (newOrder: KitchenOrder) => {
        playKitchenChime();
        fetchKdsOrders();
      });

      socket.on('kds:item_updated', () => fetchKdsOrders());
      socket.on('kds:order_updated', () => fetchKdsOrders());
    }

    return () => {
      clearInterval(timer);
      if (socket) {
        socket.off('order:new');
        socket.off('kds:item_updated');
        socket.off('kds:order_updated');
      }
    };
  }, [socket]);

  // Toggle single item status
  const toggleItemDone = async (orderId: string, itemId: string, currentStatus: string) => {
    triggerHapticFeedback();
    const nextStatus = currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';

    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, itemKdsStatus: nextStatus }),
      });
      fetchKdsOrders();
    } catch (e) {
      console.error(e);
    }
  };

  // Mark entire order as completed
  const completeOrder = async (orderId: string) => {
    triggerHapticFeedback();
    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'COMPLETED' }),
      });
      fetchKdsOrders();
    } catch (e) {
      console.error(e);
    }
  };

  // Calculate live backlog tally
  const backlogMap = new Map<string, number>();
  for (const ord of orders) {
    for (const item of ord.items) {
      if (item.kdsStatus !== 'COMPLETED') {
        const count = backlogMap.get(item.productName) || 0;
        backlogMap.set(item.productName, count + item.quantity);
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-white">
      {/* Top Header & Live Backlog Bar */}
      <div className="bg-slate-900 border-b border-slate-800 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 text-black p-2 rounded-xl">
              <ChefHat className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-black text-lg sm:text-xl">Küchenmonitor (KDS)</h2>
              <p className="text-xs text-slate-400">
                {orders.length} aktive Bestellungen • Audio-Signal aktiv
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('FIFO')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  viewMode === 'FIFO' ? 'bg-amber-500 text-black shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span>FIFO (Wartezeit)</span>
              </button>
              <button
                onClick={() => setViewMode('TABLE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  viewMode === 'TABLE' ? 'bg-amber-500 text-black shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Nach Tisch</span>
              </button>
            </div>

            <button
              onClick={() => {
                playKitchenChime();
                fetchKdsOrders();
              }}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition"
              title="Aktualisieren & Testton"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Backlog Summary Strip */}
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-black uppercase tracking-wider text-amber-400 whitespace-nowrap mr-1">
            Offener Rückstand:
          </span>
          {backlogMap.size === 0 ? (
            <span className="text-xs text-emerald-400 font-semibold">Keine offenen Speisen</span>
          ) : (
            Array.from(backlogMap.entries()).map(([name, qty]) => (
              <span
                key={name}
                className="bg-slate-800 text-slate-200 border border-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap"
              >
                {qty}x <span className="text-white">{name}</span>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Main Order Columns Grid */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-3 sm:p-4">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span>Lade Küchenbons...</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <ChefHat className="w-16 h-16 text-slate-700 mb-3" />
            <h3 className="text-lg font-bold text-slate-300">Küche ist bereit</h3>
            <p className="text-xs">Aktuell liegen keine offenen Bestellungen vor.</p>
          </div>
        ) : (
          <div className="flex gap-4 h-full items-stretch">
            {orders.map((order) => {
              const elapsedMinutes = Math.floor(
                (currentTime - new Date(order.createdAt).getTime()) / 60000
              );
              const isUrgent = elapsedMinutes >= 10;
              const isWarning = elapsedMinutes >= 5 && elapsedMinutes < 10;

              return (
                <div
                  key={order.id}
                  className={`w-72 sm:w-80 flex-shrink-0 flex flex-col justify-between rounded-2xl border shadow-xl transition-all ${
                    isUrgent
                      ? 'bg-gradient-to-b from-rose-950/80 to-slate-900 border-rose-500 shadow-rose-950/50'
                      : isWarning
                      ? 'bg-gradient-to-b from-amber-950/60 to-slate-900 border-amber-500'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-3 border-b border-slate-800/80 flex items-center justify-between">
                    <div>
                      <div className="font-extrabold text-base text-white flex items-center gap-1.5">
                        {order.tokenNumber ? (
                          <span className="bg-amber-500 text-black px-2 py-0.5 rounded text-sm font-black">
                            #{order.tokenNumber}
                          </span>
                        ) : (
                          <span>{order.table?.label || 'Theke'}</span>
                        )}
                        <span className="text-xs text-slate-400 font-normal">
                          (#{order.orderNumber})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Bedienung: <span className="text-slate-300 font-semibold">{order.waiterName}</span>
                      </div>
                    </div>

                    {/* Timer Badge */}
                    <div
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black font-mono ${
                        isUrgent
                          ? 'bg-rose-600 text-white animate-pulse'
                          : isWarning
                          ? 'bg-amber-500 text-black'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>{elapsedMinutes}m</span>
                    </div>
                  </div>

                  {/* Items Checklist */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {order.items.map((item) => {
                      const isDone = item.kdsStatus === 'COMPLETED';
                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleItemDone(order.id, item.id, item.kdsStatus)}
                          className={`p-2.5 rounded-xl border cursor-pointer select-none transition-all flex items-start justify-between gap-2 ${
                            isDone
                              ? 'bg-slate-950/50 border-slate-800/50 opacity-40 line-through'
                              : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-white'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-extrabold text-sm flex items-baseline gap-1.5">
                              <span className="text-amber-400 font-mono text-base font-black">
                                {item.quantity}x
                              </span>
                              <span>{item.productName}</span>
                            </div>

                            {item.variantName && (
                              <div className="text-xs text-slate-400 ml-5 font-semibold">
                                {item.variantName}
                              </div>
                            )}

                            {item.customizationText && (
                              <div className="text-xs font-black text-rose-400 ml-5 mt-0.5 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-900/50">
                                ! {item.customizationText}
                              </div>
                            )}
                          </div>

                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center mt-0.5 border ${
                              isDone
                                ? 'bg-emerald-600 border-emerald-500 text-white'
                                : 'border-slate-700 bg-slate-800 text-transparent'
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Card Footer: Complete Button */}
                  <div className="p-3 border-t border-slate-800/80">
                    <button
                      onClick={() => completeOrder(order.id)}
                      className="pos-touch-btn w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Bestellung Fertig</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
