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
  UserCheck,
  Edit3,
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

  // Waiter Identification
  const [waiterName, setWaiterName] = useState('Bedienung');
  const [showWaiterPrompt, setShowWaiterPrompt] = useState(false);
  const [inputWaiterName, setInputWaiterName] = useState('');

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
    const savedWaiter = localStorage.getItem('pos_waiter_name');
    if (savedWaiter && savedWaiter.trim() !== '') {
      setWaiterName(savedWaiter);
    } else {
      setShowWaiterPrompt(true);
    }

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

  const handleSaveWaiterName = (name: string) => {
    const finalName = name.trim() || 'Bedienung';
    localStorage.setItem('pos_waiter_name', finalName);
    setWaiterName(finalName);
    setShowWaiterPrompt(false);
  };

  const filteredTables = tables.filter((t) => {
    if (filter === 'OCCUPIED' && t.openItemCount === 0) return false;
    if (filter === 'FREE' && t.openItemCount > 0) return false;
    if (search && !t.label.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
      {/* Top Waiter Bar & Search Bar */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-md">
        {/* Waiter Pill */}
        <button
          onClick={() => {
            setInputWaiterName(waiterName);
            setShowWaiterPrompt(true);
          }}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-950 text-blue-300 border border-blue-800 hover:border-blue-500 rounded-xl text-xs font-bold transition"
        >
          <UserCheck className="w-4 h-4 text-blue-400" />
          <span>Bedienung: <strong className="text-white">{waiterName}</strong></span>
          <Edit3 className="w-3 h-3 text-blue-400" />
        </button>

        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tisch suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
              filter === 'ALL' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Alle ({tables.length})
          </button>
          <button
            onClick={() => setFilter('OCCUPIED')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
              filter === 'OCCUPIED' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Offen ({tables.filter((t) => t.openItemCount > 0).length})
          </button>
          <button
            onClick={() => setFilter('FREE')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
              filter === 'FREE' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Frei ({tables.filter((t) => t.openItemCount === 0).length})
          </button>
        </div>
      </div>

      {/* Tables Grid View */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm font-semibold">Lade Tischplan...</p>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
            <p className="text-sm font-semibold">Keine Tische gefunden.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {filteredTables.map((table) => {
              const isOccupied = table.openItemCount > 0;
              return (
                <div
                  key={table.id}
                  onClick={() => setSelectedTable(table)}
                  className={`relative rounded-3xl p-4 cursor-pointer transition-all duration-150 active:scale-95 flex flex-col justify-between min-h-[120px] shadow-lg border ${
                    isOccupied
                      ? 'bg-amber-950/40 border-amber-500/60 hover:border-amber-400 shadow-amber-950/30'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-400">
                      Nr. {table.tableNumber}
                    </span>
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isOccupied ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                      }`}
                    />
                  </div>

                  <div className="my-2">
                    <h3 className="font-black text-lg text-white truncate">{table.label}</h3>
                    {table.activeWaiterName && (
                      <p className="text-[10px] text-slate-400 truncate">
                        Bedienung: {table.activeWaiterName}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    {isOccupied ? (
                      <>
                        <span className="text-[11px] font-bold text-amber-300">
                          {table.openItemCount} Pos.
                        </span>
                        <span className="text-xs font-black text-white">
                          {formatCurrency(table.openGrossAmount)}
                        </span>
                      </>
                    ) : (
                      <span className="text-[11px] font-bold text-emerald-400">Frei</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Table Action Bottom Sheet / Modal */}
      {selectedTable && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-t sm:border border-slate-700 rounded-t-3xl sm:rounded-3xl p-5 w-full max-w-lg shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono text-slate-400">
                  Tischnummer #{selectedTable.tableNumber}
                </span>
                <h3 className="text-xl font-black text-white">{selectedTable.label}</h3>
              </div>
              <button
                onClick={() => setSelectedTable(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Table Financial Summary */}
            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block font-semibold">Offener Betrag:</span>
                <span className="text-2xl font-black text-white">
                  {formatCurrency(selectedTable.openGrossAmount)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block font-semibold">Offene Positionen:</span>
                <span className="text-lg font-black text-amber-400">
                  {selectedTable.openItemCount} Artikel
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => router.push(`/waiter/order?tableId=${selectedTable.id}&waiterName=${encodeURIComponent(waiterName)}`)}
                className="h-14 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-950/50 transition"
              >
                <PlusCircle className="w-5 h-5" />
                <span>Bestellen</span>
              </button>

              <button
                onClick={() => router.push(`/waiter/payment?tableId=${selectedTable.id}&waiterName=${encodeURIComponent(waiterName)}`)}
                className={`h-14 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition ${
                  selectedTable.openItemCount > 0
                    ? 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-lg shadow-emerald-950/50'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
                disabled={selectedTable.openItemCount === 0}
              >
                <CreditCard className="w-5 h-5" />
                <span>Kassieren</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Waiter Name Prompt Modal */}
      {showWaiterPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/30">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-white">Bedienungsname</h3>
                <p className="text-xs text-slate-400">Wer bedient gerade an diesem Smartphone?</p>
              </div>
            </div>

            <input
              type="text"
              autoFocus
              placeholder="z. B. Lisa, Johannes, Max"
              value={inputWaiterName}
              onChange={(e) => setInputWaiterName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveWaiterName(inputWaiterName);
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white font-bold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Quick Suggestions */}
            <div className="flex flex-wrap gap-1.5">
              {['Lisa', 'Max', 'Johannes', 'Anna', 'Thomas', 'Sophie'].map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setInputWaiterName(name)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  {name}
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleSaveWaiterName(inputWaiterName || waiterName)}
                className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-950/50 transition"
              >
                Anmelden & Weiter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
