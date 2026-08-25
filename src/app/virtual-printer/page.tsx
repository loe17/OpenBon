'use client';

import React, { useEffect, useState } from 'react';
import { useSocket } from '@/components/providers/socket-provider';
import {
  Printer,
  Trash2,
  RefreshCw,
  Sparkles,
  Receipt,
  Clock,
  Radio,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import type { TicketData } from '@/lib/printer/types';

interface VirtualTicket {
  id: string;
  printerName: string;
  printerIp: string;
  rawText: string;
  printedAt: string;
  ticketData: TicketData;
}

export default function VirtualPrinterPage() {
  const { success, error } = useToast();
  const { socket } = useSocket();
  const [tickets, setTickets] = useState<VirtualTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
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
    fetchHistory();

    if (socket) {
      socket.on('virtual_printer:new_ticket', (ticket: VirtualTicket) => {
        setTickets((prev) => [ticket, ...prev]);
      });
      socket.on('virtual_printer:cleared', () => {
        setTickets([]);
      });
    }

    return () => {
      if (socket) {
        socket.off('virtual_printer:new_ticket');
        socket.off('virtual_printer:cleared');
      }
    };
  }, [socket]);

  const handleClearHistory = async () => {
    try {
      await fetch('/api/virtual-printer', { method: 'DELETE' });
      setTickets([]);
      success('Druckverlauf geleert');
    } catch (e) {
      error('Fehler beim Leeren des Druckverlaufs');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 text-white p-4 sm:p-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-rose-600 text-white p-2.5 rounded-2xl">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Virtueller Drucker-Monitor</h1>
            <p className="text-xs text-slate-400">
              Live-Vorschau aller ESC/POS Thermobons für Küchen-, Bar- und Kassenbelege im Browser
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {tickets.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition"
            >
              <Trash2 className="w-4 h-4" />
              <span>Verlauf leeren</span>
            </button>
          )}
          <button
            onClick={fetchHistory}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition"
            title="Aktualisieren"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tickets Feed */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Lade Druckerverlauf...</span>
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-500 bg-slate-900/40 rounded-3xl border border-slate-800">
          <Receipt className="w-12 h-12 text-slate-700 mb-3" />
          <h3 className="text-base font-bold text-slate-300">Warte auf Druckaufträge...</h3>
          <p className="text-xs max-w-sm text-center mt-1">
            Sobald eine Bedienung oder die Bonkasse einen Bon abschickt, erscheint er hier in Echtzeit.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tickets.map((t) => (
            <div
              key={t.id}
              className="flex flex-col bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-xl"
            >
              {/* Card Meta Header */}
              <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs">
                <span className="font-bold text-blue-400 flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5" />
                  <span>{t.printerName}</span>
                </span>
                <span className="font-mono text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(t.printedAt).toLocaleTimeString('de-DE')}</span>
                </span>
              </div>

              {/* Thermal Paper Styling */}
              <div className="p-4 bg-amber-50 text-slate-900 font-mono text-xs leading-relaxed whitespace-pre-wrap select-text shadow-inner border-y border-amber-200 min-h-[160px]">
                {t.rawText}
              </div>

              {/* Footer */}
              <div className="p-2.5 bg-slate-950 text-center text-[10px] text-slate-500 font-mono">
                ESC/POS Emulation • CP858 German
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
