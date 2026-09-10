'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { WifiOff, RefreshCw, Clock, CheckCircle2, AlertTriangle, Eye, Trash2, X } from 'lucide-react';
import {
  subscribeToOutbox,
  syncOutboxWithServer,
  retryFailedOutboxItems,
  getAllOutboxItems,
  removeOutboxItem,
  type OutboxItem,
} from '@/lib/offline/outbox';

/**
 * Globaler Offline-/Sync-Status-Banner: zeigt auf allen Stationen an,
 * wenn keine Serververbindung besteht und wie viele Vorgänge in der
 * Offline-Outbox warten. Nach Wiederverbindung wird automatisch gesynct.
 *
 * Endgültig fehlgeschlagene Vorgänge werden gesondert in Rot gemeldet –
 * sie verschwinden nicht still, sondern verlangen eine Entscheidung.
 */
export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [outboxItems, setOutboxItems] = useState<OutboxItem[]>([]);
  const syncingRef = useRef(false);

  const openDetails = async () => {
    const items = await getAllOutboxItems();
    setOutboxItems(items);
    setShowModal(true);
  };

  const handleDeleteItem = async (id: string) => {
    await removeOutboxItem(id);
    const updated = await getAllOutboxItems();
    setOutboxItems(updated);
  };

  const runSync = useCallback(async (retryFailed = false) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      if (retryFailed) await retryFailedOutboxItems();
      else await syncOutboxWithServer();
      const updated = await getAllOutboxItems();
      setOutboxItems(updated);
    } catch {
      // Zähler werden über das Abonnement aktualisiert.
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const goOnline = () => {
      setIsOnline(true);
      void runSync();
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    const unsubscribe = subscribeToOutbox((count, failed) => {
      setPendingCount(count);
      setFailedCount(failed);
    });

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      unsubscribe();
    };
  }, [runSync]);

  if (isOnline && pendingCount === 0 && failedCount === 0) return null;

  // Rot hat Vorrang: offline oder aufgegebene Vorgänge.
  const isCritical = !isOnline || failedCount > 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 left-0 right-0 z-[100] flex flex-wrap items-center justify-center gap-2 px-4 py-1.5 text-xs font-bold text-white shadow-lg transition-colors ${
        isCritical ? 'bg-red-600' : 'bg-amber-500'
      }`}
    >
      {!isOnline ? (
        <>
          <WifiOff className="w-4 h-4" />
          <span>Keine Serververbindung – Vorgänge werden lokal gespeichert und automatisch synchronisiert</span>
        </>
      ) : isSyncing ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Synchronisiere {pendingCount} wartende(r) Vorgang/Vorgänge …</span>
        </>
      ) : failedCount > 0 ? (
        <>
          <AlertTriangle className="w-4 h-4" />
          <span>
            {failedCount} Vorgang/Vorgänge konnten nicht übertragen werden – bitte prüfen!
            {pendingCount > 0 ? ` (${pendingCount} weitere warten)` : ''}
          </span>
          <button
            onClick={() => void runSync(true)}
            className="ml-2 inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-md transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Erneut versuchen
          </button>
        </>
      ) : (
        <>
          <Clock className="w-4 h-4" />
          <span>{pendingCount} Vorgang/Vorgänge warten auf Synchronisation</span>
          <button
            onClick={() => void runSync()}
            className="ml-2 inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-md transition"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Jetzt senden
          </button>
        </>
      )}

      {(pendingCount > 0 || failedCount > 0) && (
        <button
          onClick={() => void openDetails()}
          className="ml-2 inline-flex items-center gap-1 bg-black/30 hover:bg-black/40 px-2.5 py-0.5 rounded-md transition text-[11px]"
        >
          <Eye className="w-3.5 h-3.5" />
          Details & Warteschlange
        </button>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm text-left select-none animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-base text-white">Offline-Warteschlange (Outbox)</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Vorgänge, die bei Verbindungsverlust zwischengespeichert wurden. Sie werden automatisch nachgesendet, sobald der Server wieder erreichbar ist.
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {outboxItems.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs font-bold">
                  Keine offenen Offline-Vorgänge vorhanden.
                </div>
              ) : (
                outboxItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          item.status === 'FAILED' ? 'bg-red-950 text-red-300 border border-red-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}>
                          {item.type} {item.status === 'FAILED' ? '(Fehlgeschlagen)' : '(Wartend)'}
                        </span>
                        <span className="font-mono text-slate-400 text-[11px] truncate">
                          {item.endpoint}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-3">
                        <span>Versuche: {item.attempts}</span>
                        <span>{new Date(item.createdAt).toLocaleTimeString('de-DE')} Uhr</span>
                      </div>
                      {item.lastError && (
                        <div className="text-[10px] text-red-400 font-mono truncate">
                          Fehler: {item.lastError}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-2 bg-slate-900 hover:bg-red-900/50 text-slate-400 hover:text-red-300 rounded-xl transition shrink-0"
                      title="Diesen Vorgang unwiderruflich verwerfen/löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => void runSync(true)}
                disabled={isSyncing || outboxItems.length === 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Alle jetzt senden</span>
              </button>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
