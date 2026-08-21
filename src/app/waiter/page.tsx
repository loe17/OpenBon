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
      <div className="p-3 sm:p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tisch suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={fetchTables}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
            title="Aktualisieren"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
              filter === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Alle ({tables.length})
          </button>
          <button
            onClick={() => setFilter('OCCUPIED')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
              filter === 'OCCUPIED' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Belegt ({tables.filter((t) => t.openItemCount > 0).length})
          </button>
          <button
            onClick={() => setFilter('FREE')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
              filter === 'FREE' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Frei ({tables.filter((t) => t.openItemCount === 0).length})
          </button>
        </div>
      </div>

      {/* Table Grid Layout */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span>Lade Tische...</span>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="text-center py-12 text-slate-400">Keine Tische gefunden.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {filteredTables.map((table) => {
              const isOccupied = table.openItemCount > 0;
              return (
                <button
                  key={table.id}
                  onClick={() => setSelectedTable(table)}
                  className={`pos-touch-btn relative flex flex-col justify-between p-3 sm:p-4 rounded-2xl border text-left transition-all h-28 sm:h-32 ${
                    isOccupied
                      ? 'bg-gradient-to-br from-amber-950/60 to-slate-900 border-amber-500 shadow-lg shadow-amber-950/40 text-white'
                      : 'bg-slate-900/90 border-slate-800 text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between w-full">
                    <span className="font-extrabold text-base sm:text-lg tracking-tight">
                      {table.label}
                    </span>
                    {isOccupied && (
                      <span className="bg-amber-500 text-black text-[10px] sm:text-xs font-black px-1.5 py-0.5 rounded-full animate-pulse">
                        {table.openItemCount} Pos
                      </span>
                    )}
                  </div>

                  {isOccupied ? (
                    <div>
                      <div className="text-lg sm:text-xl font-black text-amber-400">
                        {formatCurrency(table.openGrossAmount)}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {table.activeWaiterName ? `Bed: ${table.activeWaiterName}` : 'Offene Bestellung'}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl animate-in slide-in-from-bottom duration-200 text-white">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div>
                <h3 className="text-2xl font-black text-white">{selectedTable.label}</h3>
                <p className="text-xs text-slate-400">
                  Status: {selectedTable.openItemCount > 0 ? 'Belegt / Nicht kassiert' : 'Frei'}
                </p>
              </div>
              {selectedTable.openItemCount > 0 && (
                <div className="text-right">
                  <div className="text-2xl font-black text-amber-400">
                    {formatCurrency(selectedTable.openGrossAmount)}
                  </div>
                  <div className="text-xs text-slate-400">{selectedTable.openItemCount} offene Artikel</div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {/* Button 1: Order */}
              <button
                onClick={() => router.push(`/waiter/order?tableId=${selectedTable.id}`)}
                className="pos-touch-btn flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-2xl font-bold text-base shadow-lg shadow-blue-900/30"
              >
                <PlusCircle className="w-5 h-5" />
                <span>Bestellen</span>
              </button>

              {/* Button 2: Pay */}
              <button
                disabled={selectedTable.openItemCount === 0}
                onClick={() => router.push(`/waiter/payment?tableId=${selectedTable.id}`)}
                className={`pos-touch-btn flex items-center justify-center gap-2 p-4 rounded-2xl font-bold text-base shadow-lg transition ${
                  selectedTable.openItemCount > 0
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                <span>Kassieren</span>
              </button>
            </div>

            {/* View Table Orders History */}
            {selectedTable.openItemCount > 0 && (
              <button
                onClick={() => setShowHistoryModal(true)}
                className="pos-touch-btn w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 p-3 rounded-xl text-sm font-semibold mb-3"
              >
                <History className="w-4 h-4 text-slate-400" />
                <span>Bestellübersicht anzeigen</span>
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={() => {
                setSelectedTable(null);
                setShowHistoryModal(false);
              }}
              className="w-full py-3 text-center text-sm font-semibold text-slate-400 hover:text-white"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Detailed Table Order History Modal */}
      {showHistoryModal && selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col max-h-[85vh] text-white">
            <h3 className="text-xl font-bold mb-3 pb-2 border-b border-slate-800 flex items-center justify-between">
              <span>Bestellhistorie: {selectedTable.label}</span>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-white text-sm">
                Schließen
              </button>
            </h3>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {selectedTable.orders.map((ord: any) => (
                <div key={ord.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="flex justify-between text-xs text-slate-400 mb-2 pb-1 border-b border-slate-800">
                    <span>Bestell-Nr: #{ord.orderNumber} ({ord.waiterName})</span>
                    <span>{new Date(ord.createdAt).toLocaleTimeString('de-DE')}</span>
                  </div>
                  <div className="space-y-1.5">
                    {ord.items.map((item: any) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <div>
                          <span className="font-semibold text-slate-200">
                            {item.quantity}x {item.productName}
                          </span>
                          {item.variantName && <span className="text-xs text-slate-400 ml-1">({item.variantName})</span>}
                          {item.customizationText && (
                            <div className="text-xs font-bold text-amber-400 ml-3">! {item.customizationText}</div>
                          )}
                          {item.paidQuantity > 0 && (
                            <span className="text-xs text-emerald-400 ml-2">({item.paidQuantity} bezahlt)</span>
                          )}
                        </div>
                        <span className="font-mono text-slate-300">
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
              className="mt-4 w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold"
            >
              Zurück
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
