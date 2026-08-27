'use client';

import React, { useEffect, useState } from 'react';
import {
  History,
  X,
  RefreshCw,
  Clock,
  Utensils,
  ChevronRight,
  User,
  ShoppingBag,
} from 'lucide-react';

interface OrderItemDetail {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  notes?: string | null;
  status: string;
  product?: {
    category?: {
      name: string;
      color?: string | null;
    } | null;
  } | null;
}

interface WaiterOrder {
  id: string;
  orderNumber?: number | string | null;
  tableId?: string | null;
  orderType: string;
  status: string;
  waiterName: string;
  createdAt: string;
  table?: {
    tableNumber: number;
    label?: string | null;
  } | null;
  items: OrderItemDetail[];
}

interface WaiterOrderHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  waiterName: string;
}

export function WaiterOrderHistoryModal({
  isOpen,
  onClose,
  waiterName,
}: WaiterOrderHistoryModalProps) {
  const [orders, setOrders] = useState<WaiterOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const fetchOrders = async () => {
    if (!waiterName) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/orders?waiterName=${encodeURIComponent(waiterName)}&limit=50&sort=desc`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setOrders(data);
          if (data.length > 0 && !selectedOrderId) {
            setSelectedOrderId(data[0].id);
          }
        }
      }
    } catch (e) {
      console.error('Error fetching waiter orders:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchOrders();
    }
  }, [isOpen, waiterName]);

  if (!isOpen) return null;

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) || orders[0];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">Offen</span>;
      case 'IN_PREPARATION':
        return <span className="px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold">In Zubereitung</span>;
      case 'READY':
        return <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">Abholbereit</span>;
      case 'COMPLETED':
      case 'SERVED':
      case 'DELIVERED':
        return <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">Abgeschlossen</span>;
      case 'CANCELLED':
      case 'VOIDED':
        return <span className="px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">Storniert</span>;
      default:
        return <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-bold">{status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
        {/* Top Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-2xl text-white shadow">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base sm:text-lg text-white">Mein Bestellverlauf</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-950 border border-blue-800 text-blue-300 text-xs font-bold flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {waiterName || 'Bedienung'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Vergangene Bestellungen dieser Schicht (Schreibgeschützt)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchOrders}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition active:scale-95 disabled:opacity-50"
              title="Aktualisieren"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition active:scale-95"
              title="Schließen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body: Left List, Right Detail */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Orders List (Left) */}
          <div className="md:col-span-5 border-r border-slate-800 overflow-y-auto p-3 space-y-2 bg-slate-950/50">
            {loading && orders.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs font-bold">
                Lade Bestellungen...
              </div>
            ) : orders.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-2">
                <ShoppingBag className="w-8 h-8 mx-auto stroke-1" />
                <p className="text-xs font-bold">Keine Bestellungen für &bdquo;{waiterName}&ldquo; gefunden.</p>
              </div>
            ) : (
              orders.map((ord) => {
                const isSelected = selectedOrderId === ord.id;
                const itemsCount = ord.items.reduce((sum, it) => sum + it.quantity, 0);
                const orderTotal = ord.items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
                const timeStr = new Date(ord.createdAt).toLocaleTimeString('de-DE', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const tableLabel = ord.table ? `Tisch ${ord.table.tableNumber}` : 'Direktverkauf / Theke';

                return (
                  <button
                    key={ord.id}
                    type="button"
                    onClick={() => setSelectedOrderId(ord.id)}
                    className={`w-full p-3 rounded-2xl text-left transition border flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-blue-600/15 border-blue-500 text-white shadow'
                        : 'bg-slate-900/80 border-slate-800/80 text-slate-300 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm text-white">{tableLabel}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {timeStr}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">
                        {itemsCount} {itemsCount === 1 ? 'Artikel' : 'Artikel'}
                      </span>
                      <span className="font-mono font-black text-white">
                        {orderTotal.toFixed(2).replace('.', ',')} €
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                      {getStatusBadge(ord.status)}
                      <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-blue-400' : 'text-slate-600'}`} />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Order Details (Right) */}
          <div className="md:col-span-7 p-4 overflow-y-auto bg-slate-900 space-y-4">
            {selectedOrder ? (
              <div className="space-y-4">
                {/* Header Card */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-base text-white">
                      {selectedOrder.table ? `Tisch ${selectedOrder.table.tableNumber}` : 'Direktverkauf'}
                      {selectedOrder.table?.label ? ` (${selectedOrder.table.label})` : ''}
                    </span>
                    {getStatusBadge(selectedOrder.status)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs text-slate-400 font-mono">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Bestellzeit:</span>
                      <span className="text-white font-bold">
                        {new Date(selectedOrder.createdAt).toLocaleTimeString('de-DE', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })} Uhr
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Bedienung:</span>
                      <span className="text-white font-bold">{selectedOrder.waiterName || waiterName}</span>
                    </div>
                  </div>
                </div>

                {/* Items List */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Bestellte Artikel ({selectedOrder.items.reduce((sum, it) => sum + it.quantity, 0)})
                  </h4>
                  <div className="space-y-1.5">
                    {selectedOrder.items.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="px-2 py-0.5 rounded-lg bg-blue-600 text-white font-mono font-black text-xs shrink-0">
                              {item.quantity}x
                            </span>
                            <span className="font-bold text-sm text-white truncate">
                              {item.productName}
                            </span>
                          </div>

                          {item.notes && (
                            <div className="mt-1 pl-8 text-xs font-semibold text-amber-300">
                              ↳ {item.notes}
                            </div>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-mono font-black text-sm text-white">
                            {(item.unitPrice * item.quantity).toFixed(2).replace('.', ',')} €
                          </div>
                          {item.quantity > 1 && (
                            <div className="text-[10px] font-mono text-slate-500">
                              je {item.unitPrice.toFixed(2).replace('.', ',')} €
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total Summary */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-300">Gesamtsumme Bestellung:</span>
                  <span className="text-xl font-black font-mono text-white">
                    {selectedOrder.items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0).toFixed(2).replace('.', ',')} €
                  </span>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs font-bold">
                Wähle links eine Bestellung aus, um Details anzuzeigen.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

export default WaiterOrderHistoryModal;
