'use client';

import React, { useState, useEffect } from 'react';
import { copyTextToClipboard } from '@/lib/clipboard';
import { useSocket } from '@/components/providers/socket-provider';
import {
  Printer,
  Trash2,
  RefreshCw,
  ArrowLeft,
  Copy,
  Check,
  Filter,
  Volume2,
  VolumeX,
  Sparkles,
  Clock,
  Send,
} from 'lucide-react';
import Link from 'next/link';
import { playKitchenChime, triggerHapticFeedback } from '@/lib/socket-client';
import { useToast } from '@/components/ui/toast';

interface VirtualTicket {
  id: string;
  printerName: string;
  printerIp: string;
  ticketData?: any;
  rawText: string;
  printedAt: string;
}

export interface VirtualPrinterMonitorProps {
  /** Rueckwaerts-Link in die Drucker-Verwaltung (nur Administration). */
  showBackLink?: boolean;
  /** Nur Administratoren duerfen den Verlauf loeschen (API erzwingt es ebenfalls). */
  allowClear?: boolean;
  /** Vorauswahl des Filters, z. B. aus `?printerName=Kueche`. */
  initialPrinter?: string;
}

/**
 * Einziger Monitor fuer den virtuellen Drucker. Wird sowohl unter
 * `/virtual-printer` (Station) als auch unter `/admin/virtual-printer`
 * (Administration) verwendet - vorher gab es zwei getrennte Oberflaechen,
 * die auseinandergelaufen sind.
 */
export default function VirtualPrinterMonitor({
  showBackLink = false,
  allowClear = false,
  initialPrinter,
}: VirtualPrinterMonitorProps) {
  const { success, error } = useToast();
  const { socket } = useSocket();
  const [tickets, setTickets] = useState<VirtualTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedPrinter, setSelectedPrinter] = useState(initialPrinter || 'ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/virtual-printer');
      const data = await res.json();
      if (Array.isArray(data)) {
        setTickets(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
    if (initialPrinter) setSelectedPrinter(initialPrinter);
  }, [initialPrinter]);

  useEffect(() => {
    if (!socket) return;

    socket.on('virtual_printer:new_ticket', (ticket: VirtualTicket) => {
      setTickets((prev) => [ticket, ...prev]);
      if (soundEnabled) {
        playKitchenChime();
        triggerHapticFeedback();
      }
    });

    socket.on('virtual_printer:cleared', () => {
      setTickets([]);
    });

    return () => {
      socket.off('virtual_printer:new_ticket');
      socket.off('virtual_printer:cleared');
    };
  }, [socket, soundEnabled]);

  const handleClearHistory = async () => {
    try {
      await fetch('/api/virtual-printer', { method: 'DELETE' });
      setTickets([]);
      success('Virtueller Druckverlauf erfolgreich geleert');
    } catch (e) {
      error('Fehler beim Leeren des Druckverlaufs');
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    const success = await copyTextToClipboard(text);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const printerNames = Array.from(new Set(tickets.map((t) => t.printerName).filter(Boolean)));
  const displayedTickets =
    selectedPrinter === 'ALL'
      ? tickets
      : tickets.filter((t) => t.printerName === selectedPrinter);

  return (
    <div className="min-h-full bg-slate-950 text-slate-100 p-3 sm:p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            {showBackLink && (
              <Link
                href="/admin/printers"
                className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl text-slate-400 hover:text-white transition"
                title="Zurück zur Drucker-Verwaltung"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
            )}
            <div className="p-3 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl shadow-lg">
              <Printer className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                <span>Virtueller Drucker-Monitor</span>
                <span className="text-xs font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 px-2.5 py-0.5 rounded-full">
                  Live-Spooler
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Echtzeit-Simulation und Anzeige aller ESC/POS Thermobons im Browser
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border ${
                soundEnabled
                  ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span>{soundEnabled ? 'Signalton: An' : 'Signalton: Aus'}</span>
            </button>
            {allowClear && (
            <button
              onClick={handleClearHistory}
              disabled={tickets.length === 0}
              className="px-3 py-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-30"
            >
              <Trash2 className="w-4 h-4" />
              <span>Verlauf leeren</span>
            </button>
            )}
            <button
              onClick={fetchTickets}
              className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition"
              title="Aktualisieren"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        {printerNames.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-bold text-slate-400 pl-2">Filter nach Drucker:</span>
            <button
              onClick={() => setSelectedPrinter('ALL')}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition border ${
                selectedPrinter === 'ALL'
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-slate-950 text-slate-400 border-slate-800'
              }`}
            >
              Alle ({tickets.length})
            </button>
            {printerNames.map((pName) => (
              <button
                key={pName}
                onClick={() => setSelectedPrinter(pName)}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition border ${
                  selectedPrinter === pName
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                {pName} ({tickets.filter((t) => t.printerName === pName).length})
              </button>
            ))}
          </div>
        )}

        {/* Live Spooler Ticket Stream */}
        {displayedTickets.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-16 text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-500 mx-auto">
              <Printer className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-300">Noch keine Druckaufträge eingegangen</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Sobald an einer Kasse, Theke oder Küche eine Bestellung aufgegeben wird, die an einen virtuellen Drucker geroutet ist, erscheint der Bon sofort hier in Echtzeit.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="bg-slate-900 border-2 border-slate-800 hover:border-emerald-500/50 rounded-3xl p-4 shadow-2xl flex flex-col justify-between transition-all group"
              >
                {/* Ticket Meta Info */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="font-bold text-emerald-300 truncate max-w-[160px]">
                      {ticket.printerName || 'Virtueller Drucker'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(ticket.printedAt).toLocaleTimeString('de-DE')}</span>
                  </div>
                </div>

                {/* Simulated Thermal Paper Receipt */}
                <div className="my-4 bg-white text-slate-950 font-mono text-[11px] p-4 rounded-xl shadow-inner border-y-4 border-dashed border-slate-400 whitespace-pre-wrap leading-relaxed select-text overflow-x-auto">
                  {ticket.rawText}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                  <span className="text-[10px] font-mono text-slate-500">ID: {ticket.id}</span>
                  <button
                    onClick={() => copyToClipboard(ticket.rawText, ticket.id)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 text-[11px] transition"
                  >
                    {copiedId === ticket.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">Kopiert</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Kopieren</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
