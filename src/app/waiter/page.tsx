'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/components/providers/socket-provider';
import { formatCurrency } from '@/lib/utils';
import {
  Users,
  PlusCircle,
  CreditCard,
  History,
  Clock,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  Layers,
  Sparkles,
} from 'lucide-react';

interface TableData {
  id: string;
  tableNumber: number;
  label: string;
  gridX: number;
  gridY: number;
  status: string;
  activeWaiterName: string | null;
  openGrossAmount: number;
  openItemCount: number;
  orders: any[];
}

export default function WaiterTablesPage() {
  const router = useRouter();
  const { socket } = useSocket();
  const [tables, setTables] = useState<TableData[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableData | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'OCCUPIED' | 'FREE'>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const fetchTables = async () => {
    try {
      const res = await fetch('/api/tables');
      const data = await res.json();
      if (Array.isArray(data)) {
        setTables(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();

    if (socket) {
      socket.on('table:updated', () => fetchTables());
      socket.on('order:new', () => fetchTables());
      socket.on('payment:completed', () => fetchTables());
      socket.on('tables:regenerated', () => fetchTables());
    }

    return () => {
      if (socket) {
        socket.off('table:updated');
        socket.off('order:new');
        socket.off('payment:completed');
        socket.off('tables:regenerated');
      }
    };
  }, [socket]);

  const filteredTables = tables.filter((t) => {
    if (filter === 'OCCUPIED' && t.openItemCount === 0) return false;
    if (filter === 'FREE' && t.openItemCount > 0) return false;
    if (search && !t.label.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
      {/* Top Filter & Search Bar */}
      <div className="p-3 sm:p-4 bg-slate-900 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tisch suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl pl-10 pr-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
            />
          </div>
          <button
            onClick={fetchTables}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl border border-slate-700 transition"
            title="Aktualisieren"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-700">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              filter === 'ALL' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Alle ({tables.length})
          </button>
          <button
            onClick={() => setFilter('OCCUPIED')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              filter === 'OCCUPIED' ? 'bg-amber-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Belegt ({tables.filter((t) => t.openItemCount > 0).length})
          </button>
          <button
            onClick={() => setFilter('FREE')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              filter === 'FREE' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Frei ({tables.filter((t) => t.openItemCount === 0).length})
          </button>
        </div>
      </div>

      {/* Table Grid Layout */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 font-bold">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span>Lade Tische...</span>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="text-center py-12 text-slate-500 font-bold">Keine Tische gefunden.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {filteredTables.map((table) => {
              const isOccupied = table.openItemCount > 0;
              return (
                <button
                  key={table.id}
                  onClick={() => setSelectedTable(table)}
                  className={`pos-touch-btn relative flex flex-col justify-between p-4 rounded-3xl border-2 text-left transition-all h-32 sm:h-36 ${
                    isOccupied
                      ? 'bg-slate-900 border-amber-500 shadow-xl shadow-amber-950/40 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-start justify-between w-full">
                    <span className="font-black text-lg sm:text-xl tracking-tight">
                      {table.label}
                    </span>
                    {isOccupied && (
                      <span className="bg-amber-500 text-black text-xs font-black px-2 py-0.5 rounded-full animate-pulse shadow">
                        {table.openItemCount} Pos
                      </span>
                    )}
                  </div>

                  {isOccupied ? (
                    <div>
                      <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
                        {formatCurrency(table.openGrossAmount)}
                      </div>
                      <div className="text-xs text-slate-400 truncate font-semibold mt-0.5">
                        {table.activeWaiterName ? `Bed: ${table.activeWaiterName}` : 'Offene Bestellung'}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 flex items-center gap-1.5 font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow" />
                      <span>Frei</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Table Action Drawer / Modal */}
      {selectedTable && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl text-white">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div>
                <h3 className="text-2xl sm:text-3xl font-black text-white">{selectedTable.label}</h3>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">
                  Status: {selectedTable.openItemCount > 0 ? 'Belegt / Nicht abgerechnet' : 'Frei'}
                </p>
              </div>
              {selectedTable.openItemCount > 0 && (
                <div className="text-right">
                  <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                    {formatCurrency(selectedTable.openGrossAmount)}
                  </div>
                  <div className="text-xs text-slate-400 font-bold">{selectedTable.openItemCount} offene Posten</div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              {/* Button 1: Order */}
              <button
                onClick={() => router.push(`/waiter/order?tableId=${selectedTable.id}`)}
                className="pos-touch-btn flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white h-16 rounded-2xl font-black text-base shadow-lg shadow-blue-950/50"
              >
                <PlusCircle className="w-6 h-6" />
                <span>Bestellen</span>
              </button>

              {/* Button 2: Pay */}
              <button
                disabled={selectedTable.openItemCount === 0}
                onClick={() => router.push(`/waiter/payment?tableId=${selectedTable.id}`)}
                className={`pos-touch-btn flex items-center justify-center gap-2 h-16 rounded-2xl font-black text-base shadow-lg transition ${
                  selectedTable.openItemCount > 0
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                }`}
              >
                <CreditCard className="w-6 h-6" />
                <span>Kassieren</span>
              </button>
            </div>

            {/* View Table Orders History */}
            {selectedTable.openItemCount > 0 && (
              <button
                onClick={() => setShowHistoryModal(true)}
                className="pos-touch-btn w-full h-12 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl text-xs font-bold border border-slate-700 mb-3"
              >
                <History className="w-4 h-4 text-blue-400" />
                <span>Bestellhistorie ansehen</span>
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={() => {
                setSelectedTable(null);
                setShowHistoryModal(false);
              }}
              className="w-full py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white"
            >
              Schließen
            </button>
          </div>
        </div>
      )}

      {/* Detailed Table Order History Modal */}
      {showHistoryModal && selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh] text-white">
            <h3 className="text-xl font-black mb-3 pb-3 border-b border-slate-800 flex items-center justify-between">
              <span>Bestellungen: {selectedTable.label}</span>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-white text-xs font-bold uppercase">
                Schließen
              </button>
            </h3>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {selectedTable.orders.map((ord: any) => (
                <div key={ord.id} className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                  <div className="flex justify-between text-xs text-slate-400 mb-2 pb-1 border-b border-slate-800">
                    <span className="font-bold">Bestell-Nr: #{ord.orderNumber} ({ord.waiterName})</span>
                    <span className="font-mono">{new Date(ord.createdAt).toLocaleTimeString('de-DE')}</span>
                  </div>
                  <div className="space-y-2">
                    {ord.items.map((item: any) => (
                      <div key={item.id} className="flex justify-between text-sm items-baseline">
                        <div>
                          <span className="font-bold text-white">
                            {item.quantity}x {item.productName}
                          </span>
                          {item.variantName && <span className="text-xs text-slate-400 ml-1.5">({item.variantName})</span>}
                          {item.customizationText && (
                            <div className="text-xs font-bold text-amber-400 ml-4">! {item.customizationText}</div>
                          )}
                          {item.paidQuantity > 0 && (
                            <span className="text-xs text-emerald-400 ml-2 font-bold">({item.paidQuantity} bezahlt)</span>
                          )}
                        </div>
                        <span className="font-mono font-bold text-emerald-400">
                          {formatCurrency((item.unitPrice + (item.deposit || 0)) * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowHistoryModal(false)}
              className="mt-4 w-full h-12 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-xs font-bold uppercase tracking-wider"
            >
              Zurück
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
