'use client';

import React, { useEffect, useState } from 'react';
import {
  RefreshCw,
  Trash2,
  RotateCw,
  CornerDownRight,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Printer,
  FileText,
  X,
  Send,
  Sparkles,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { formatCents, formatCurrency } from '@/lib/utils';

interface PrintJobItem {
  id: string;
  printerId: string | null;
  printerName: string;
  printerIp: string | null;
  isVirtual: boolean;
  orderId: string | null;
  title: string;
  status: 'PENDING' | 'PRINTING' | 'FAILED' | 'PRINTED' | string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  createdAt: string;
  printedAt: string | null;
  payload: any;
}

interface QueueCounts {
  total: number;
  pending: number;
  failed: number;
  printed: number;
}

export function PrintQueueManager({ printers }: { printers: Array<{ id: string; name: string; ipAddress: string; isVirtual: boolean }> }) {
  const { success, error, warning } = useToast();
  const [items, setItems] = useState<PrintJobItem[]>([]);
  const [counts, setCounts] = useState<QueueCounts>({ total: 0, pending: 0, failed: 0, printed: 0 });
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PENDING' | 'FAILED' | 'PRINTED' | 'CONFIRMED'>('ALL');
  const [selectedJobForPreview, setSelectedJobForPreview] = useState<PrintJobItem | null>(null);
  const [selectedJobForReroute, setSelectedJobForReroute] = useState<PrintJobItem | null>(null);
  const [rerouteTargetPrinterId, setRerouteTargetPrinterId] = useState('');
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  const fetchQueue = async () => {
    try {
      const res = await fetch(`/api/printers/queue?status=${activeFilter}&limit=50`);
      if (!res.ok) throw new Error('Fehler beim Abruf der Warteschlange');
      const data = await res.json();
      setItems(data.items || []);
      setCounts(data.counts || { total: 0, pending: 0, failed: 0, printed: 0 });
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    // Socket-Echtzeit statt nur Polling (Fallback-Polling 15s)
    const onAck = () => fetchQueue();
    window.addEventListener('openbon:print-acked', onAck);
    window.addEventListener('openbon:print-failed', onAck);
    window.addEventListener('openbon:print-queued', onAck);
    window.addEventListener('openbon:print-confirmed', onAck);
    const interval = setInterval(fetchQueue, 15000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('openbon:print-acked', onAck);
      window.removeEventListener('openbon:print-failed', onAck);
      window.removeEventListener('openbon:print-queued', onAck);
      window.removeEventListener('openbon:print-confirmed', onAck);
    };
  }, [activeFilter]);

  const handleRetry = async (job: PrintJobItem) => {
    setBusyActionId(job.id);
    try {
      const res = await fetch('/api/printers/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RETRY', jobId: job.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        error(body.error || 'Fehler beim Wiederholen des Auftrags');
        return;
      }
      success(`Druckauftrag erneut an ${job.printerName} gesendet!`);
      fetchQueue();
    } catch {
      error('Verbindungsfehler');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleReroute = async () => {
    if (!selectedJobForReroute || !rerouteTargetPrinterId) return;
    setBusyActionId(selectedJobForReroute.id);
    try {
      const res = await fetch('/api/printers/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REROUTE',
          jobId: selectedJobForReroute.id,
          targetPrinterId: rerouteTargetPrinterId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        error(body.error || 'Fehler beim Umleiten des Auftrags');
        return;
      }
      const data = await res.json();
      success(`Druckauftrag erfolgreich auf "${data.printerName}" umgeleitet!`);
      setSelectedJobForReroute(null);
      setRerouteTargetPrinterId('');
      fetchQueue();
    } catch {
      error('Verbindungsfehler');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleDelete = async (job: PrintJobItem) => {
    if (!window.confirm(`Druckauftrag "${job.title}" wirklich aus der Warteschlange löschen?`)) return;
    try {
      const res = await fetch('/api/printers/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DELETE', jobId: job.id }),
      });
      if (!res.ok) {
        error('Fehler beim Löschen');
        return;
      }
      success('Druckauftrag entfernt.');
      fetchQueue();
    } catch {
      error('Verbindungsfehler');
    }
  };

  const handleClearCompleted = async () => {
    if (!window.confirm('Alle bereits gedruckten Aufträge aus der Liste aufräumen?')) return;
    try {
      const res = await fetch('/api/printers/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CLEAR_COMPLETED' }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      success(`${data.count} gedruckte Aufträge aufgeräumt.`);
      fetchQueue();
    } catch {
      error('Fehler beim Aufräumen');
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Tabs & Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveFilter('ALL')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <span>Alle</span>
            <span className="px-1.5 py-0.5 rounded-full bg-black/40 text-[10px]">{counts.total}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('PENDING')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeFilter === 'PENDING'
                ? 'bg-amber-600 text-white shadow'
                : 'bg-slate-950 text-amber-400/80 hover:text-amber-300 border border-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Offen / Druckt</span>
            <span className="px-1.5 py-0.5 rounded-full bg-black/40 text-[10px]">{counts.pending}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('FAILED')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeFilter === 'FAILED'
                ? 'bg-rose-600 text-white shadow'
                : 'bg-slate-950 text-rose-400/80 hover:text-rose-300 border border-slate-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Fehlgeschlagen</span>
            <span className="px-1.5 py-0.5 rounded-full bg-black/40 text-[10px]">{counts.failed}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('PRINTED')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeFilter === 'PRINTED'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-slate-950 text-emerald-400/80 hover:text-emerald-300 border border-slate-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Gedruckt</span>
            <span className="px-1.5 py-0.5 rounded-full bg-black/40 text-[10px]">{counts.printed}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchQueue}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
            <span>Aktualisieren</span>
          </button>

          {counts.printed > 0 && (
            <button
              type="button"
              onClick={handleClearCompleted}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold transition"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Gedruckte leeren</span>
            </button>
          )}
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Lade Druckwarteschlange...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Printer className="w-10 h-10 mx-auto text-slate-600 opacity-50" />
            <p className="font-bold text-sm text-slate-400">Keine Druckaufträge in dieser Ansicht</p>
            <p className="text-xs">Alle Druckaufträge wurden erfolgreich abgearbeitet oder sind leer.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3.5">Zeit</th>
                  <th className="p-3.5">Bon-Inhalt / Titel</th>
                  <th className="p-3.5">Ziel-Drucker</th>
                  <th className="p-3.5">Status & Versuche</th>
                  <th className="p-3.5">Fehlerursache</th>
                  <th className="p-3.5 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map((job) => {
                  const isPending = job.status === 'PENDING' || job.status === 'PRINTING';
                  const isFailed = job.status === 'FAILED';
                  const isPrinted = job.status === 'PRINTED';

                  const timeStr = new Date(job.createdAt).toLocaleTimeString('de-DE', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  return (
                    <tr key={job.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3.5 font-mono text-slate-300 whitespace-nowrap">{timeStr}</td>

                      <td className="p-3.5 font-bold text-white max-w-xs truncate">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                          <span className="truncate">{job.title}</span>
                        </div>
                        {job.payload?.tableName && (
                          <span className="text-[10px] text-slate-400 font-normal block">
                            Tisch: {job.payload.tableName} {job.payload.waiterName ? `· ${job.payload.waiterName}` : ''}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <div className="font-bold text-slate-200 flex items-center gap-1.5">
                          <Printer className="w-3.5 h-3.5 text-slate-400" />
                          <span>{job.printerName}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 block">
                          {job.isVirtual ? 'Virtueller Druckmonitor' : job.printerIp || 'Keine IP'}
                        </span>
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {isPending && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-800 text-amber-300 font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3 animate-spin" />
                              <span>Wartet / Druckt</span>
                            </span>
                          )}
                          {isFailed && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-950/80 border border-rose-800 text-rose-300 font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Fehlgeschlagen</span>
                            </span>
                          )}
                          {isPrinted && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-300 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Gedruckt</span>
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-slate-400">
                            ({job.attempts}/{job.maxAttempts})
                          </span>
                        </div>
                      </td>

                      <td className="p-3.5 max-w-xs truncate">
                        {job.lastError ? (
                          <span className="text-rose-400 font-mono text-[11px] truncate block" title={job.lastError}>
                            {job.lastError}
                          </span>
                        ) : isPrinted ? (
                          <span className="text-slate-500 text-[11px]">Keine Fehler</span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Wird verarbeitet</span>
                        )}
                      </td>

                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Vorschau */}
                          <button
                            type="button"
                            onClick={() => setSelectedJobForPreview(job)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                            title="Bon-Vorschau anzeigen"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Retry */}
                          <button
                            type="button"
                            disabled={busyActionId === job.id}
                            onClick={() => handleRetry(job)}
                            className="p-1.5 bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-800 rounded-lg transition disabled:opacity-50"
                            title="Druckauftrag sofort wiederholen"
                          >
                            <RotateCw className={`w-3.5 h-3.5 ${busyActionId === job.id ? 'animate-spin' : ''}`} />
                          </button>

                          {/* Reroute */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedJobForReroute(job);
                              setRerouteTargetPrinterId(printers[0]?.id || '');
                            }}
                            className="p-1.5 bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-800 rounded-lg transition"
                            title="Auf anderen Drucker umleiten"
                          >
                            <CornerDownRight className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDelete(job)}
                            className="p-1.5 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 rounded-lg transition"
                            title="Auftrag löschen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reroute Modal */}
      {selectedJobForReroute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CornerDownRight className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-lg text-white">Druckauftrag umleiten</h3>
              </div>
              <button
                onClick={() => setSelectedJobForReroute(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
              <div><span className="font-bold text-slate-400">Auftrag:</span> {selectedJobForReroute.title}</div>
              <div><span className="font-bold text-slate-400">Bisheriger Drucker:</span> {selectedJobForReroute.printerName}</div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Neuen Ziel-Drucker auswählen
              </label>
              <select
                value={rerouteTargetPrinterId}
                onChange={(e) => setRerouteTargetPrinterId(e.target.value)}
                className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-bold focus:border-purple-500"
              >
                {printers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.isVirtual ? '(virtuell)' : `– ${p.ipAddress}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedJobForReroute(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleReroute}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Jetzt umleiten & drucken</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {selectedJobForPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-lg text-white">Bon-Vorschau</h3>
              </div>
              <button
                onClick={() => setSelectedJobForPreview(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white text-black p-5 rounded-2xl font-mono text-xs shadow-inner space-y-2">
              <div className="text-center font-bold text-sm border-b border-black pb-2">
                {selectedJobForPreview.payload?.header || selectedJobForPreview.title || 'KASSENBON'}
              </div>

              {selectedJobForPreview.payload?.tableName && (
                <div className="flex justify-between font-bold">
                  <span>Tisch: {selectedJobForPreview.payload.tableName}</span>
                  <span>{selectedJobForPreview.payload.waiterName || ''}</span>
                </div>
              )}

              {Array.isArray(selectedJobForPreview.payload?.items) && (
                <div className="border-t border-b border-dashed border-black py-2 space-y-1">
                  {selectedJobForPreview.payload.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between">
                      <span>{item.quantity}x {item.productName || item.name}</span>
                      {item.price !== undefined && <span>{formatCents(Math.round((item.price * item.quantity) * 100))}</span>}
                    </div>
                  ))}
                </div>
              )}

              {selectedJobForPreview.payload?.totalGross !== undefined && (
                <div className="flex justify-between font-bold text-sm pt-1">
                  <span>GESAMT:</span>
                  <span>{formatCents((selectedJobForPreview as any).payload.totalGrossCents ?? Math.round(((selectedJobForPreview as any).payload.totalGross ?? 0) * 100))}</span>
                </div>
              )}

              <div className="text-[10px] text-gray-500 text-center pt-2 border-t border-gray-300">
                Job ID: {selectedJobForPreview.id} · Drucker: {selectedJobForPreview.printerName}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedJobForPreview(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
              >
                Schließen
              </button>
              <button
                type="button"
                onClick={() => {
                  const j = selectedJobForPreview;
                  setSelectedJobForPreview(null);
                  handleRetry(j);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Erneut ausdrucken</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
