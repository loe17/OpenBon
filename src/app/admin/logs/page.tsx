'use client';

import React, { useState, useEffect } from 'react';
import { useSocket } from '@/components/providers/socket-provider';
import {
  FileText,
  Download,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  Shield,
  Layers,
  ArrowLeft,
  Calendar,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import type { ActionLogDTO } from '@/types/domain';

const CATEGORIES = [
  { id: 'ALL', label: 'Alle Kategorien' },
  { id: 'SALES', label: '💰 Verkäufe & Zahlungen' },
  { id: 'ORDERS', label: '🍽️ Bestellungen & Stornos' },
  { id: 'CASHBOOK', label: '💵 Kassenbuch & Tresor' },
  { id: 'AUTH', label: '🔐 Kellner & Schichten' },
  { id: 'ADMIN', label: '⚙️ Einstellungen & Admin' },
  { id: 'SYSTEM', label: '🖥️ System & Hardware' },
];

export default function AdminLogsPage() {
  const { socket } = useSocket();
  const [logs, setLogs] = useState<ActionLogDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [limit, setLimit] = useState(200);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        category: selectedCategory,
        limit: String(limit),
      });
      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }
      const res = await fetch(`/api/logs?${params.toString()}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setLogs(data);
      }
    } catch (e) {
      console.error('Fehler beim Laden der Logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedCategory, limit]);

  useEffect(() => {
    if (!socket) return;
    socket.on('log:new', (newLog: ActionLogDTO) => {
      setLogs((prev) => [newLog, ...prev]);
    });
    return () => {
      socket.off('log:new');
    };
  }, [socket]);

  const handleDownload = (format: 'csv' | 'json_file' | 'txt') => {
    const params = new URLSearchParams({
      category: selectedCategory,
      limit: '1000',
      format,
    });
    if (searchTerm.trim()) {
      params.append('search', searchTerm.trim());
    }
    window.open(`/api/logs?${params.toString()}`, '_blank');
  };

  const getBadgeColor = (category: string) => {
    switch (category) {
      case 'SALES':
        return 'bg-emerald-950/80 text-emerald-400 border-emerald-800';
      case 'ORDERS':
        return 'bg-blue-950/80 text-blue-400 border-blue-800';
      case 'CASHBOOK':
        return 'bg-amber-950/80 text-amber-400 border-amber-800';
      case 'AUTH':
        return 'bg-purple-950/80 text-purple-400 border-purple-800';
      case 'ADMIN':
        return 'bg-rose-950/80 text-rose-400 border-rose-800';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 sm:p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/settings"
              className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl text-slate-400 hover:text-white transition"
              title="Zurück zu den Einstellungen"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl shadow-lg">
              <FileText className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                <span>System- &amp; Revisionsprotokoll</span>
                <span className="text-xs font-mono font-bold bg-blue-950 text-blue-400 border border-blue-800 px-2.5 py-0.5 rounded-full">
                  Audit-Log
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Lückenlose Dokumentation aller Bestellungen, Kassiervorgänge, Stornos und Schichten
              </p>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleDownload('csv')}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5 transition active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>CSV Export</span>
            </button>
            <button
              onClick={() => handleDownload('txt')}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs rounded-xl shadow flex items-center gap-1.5 transition active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>TXT Log</span>
            </button>
            <button
              onClick={() => handleDownload('json_file')}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs rounded-xl shadow flex items-center gap-1.5 transition active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>JSON</span>
            </button>
            <button
              onClick={fetchLogs}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
              title="Aktualisieren"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Log durchsuchen (Akteur, Tisch, Artikel, Aktion)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 font-medium focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Limit Selector */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-400 font-bold">Einträge:</span>
              <select
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value, 10))}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
                <option value={1000}>1.000</option>
              </select>
            </div>
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition border ${
                  selectedCategory === c.id
                    ? 'bg-blue-600 border-blue-500 text-white shadow'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Logs Table / Stream */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Gefundene Einträge: {logs.length}
            </span>
            <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live-Stream aktiv
            </span>
          </div>

          {logs.length === 0 ? (
            <div className="text-center py-16 text-slate-500 font-medium text-sm">
              Keine Logeinträge für die gewählten Filter vorhanden.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="pb-3 w-40">Zeitstempel</th>
                    <th className="pb-3 w-32">Kategorie</th>
                    <th className="pb-3 w-36">Aktion</th>
                    <th className="pb-3 w-36">Akteur</th>
                    <th className="pb-3">Details / Ereignis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 font-sans">
                  {logs.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-850/50 transition">
                      <td className="py-3 font-mono text-slate-400 whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-lg border font-bold text-[10px] ${getBadgeColor(
                            entry.category
                          )}`}
                        >
                          {entry.category}
                        </span>
                      </td>
                      <td className="py-3 font-mono font-bold text-white">
                        {entry.action}
                      </td>
                      <td className="py-3 font-bold text-slate-300">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-500" />
                          {entry.actor}
                        </span>
                      </td>
                      <td className="py-3 text-slate-200">
                        <div className="font-medium leading-relaxed">{entry.details}</div>
                        {entry.metadata && (
                          <div className="text-[10px] font-mono text-slate-500 truncate max-w-xl mt-0.5">
                            {typeof entry.metadata === 'string'
                              ? entry.metadata
                              : JSON.stringify(entry.metadata)}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
