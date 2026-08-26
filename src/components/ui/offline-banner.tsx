'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { WifiOff, RefreshCw, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  subscribeToOutbox,
  syncOutboxWithServer,
  retryFailedOutboxItems,
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
  const syncingRef = useRef(false);

  const runSync = useCallback(async (retryFailed = false) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      if (retryFailed) await retryFailedOutboxItems();
      else await syncOutboxWithServer();
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
    </div>
  );
}
