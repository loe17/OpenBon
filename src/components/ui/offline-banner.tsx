'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, Clock, CheckCircle2 } from 'lucide-react';
import {
  subscribeToOutbox,
  syncOutboxWithServer,
} from '@/lib/offline/outbox';

/**
 * Globaler Offline-/Sync-Status-Banner: zeigt auf allen Stationen an,
 * wenn keine Serververbindung besteht und wie viele Vorgänge in der
 * Offline-Outbox warten. Nach Wiederverbindung wird automatisch gesynct.
 */
export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    const unsubscribe = subscribeToOutbox((count) => setPendingCount(count));

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      unsubscribe();
    };
  }, []);

  // Nach Wiederverbindung automatisch nachsenden
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isSyncing) {
      setIsSyncing(true);
      syncOutboxWithServer()
        .catch(() => {})
        .finally(() => setIsSyncing(false));
    }
  }, [isOnline, pendingCount, isSyncing]);

  if (isOnline && pendingCount === 0) return null;

  const showRetry = isOnline && pendingCount > 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-bold text-white shadow-lg transition-colors ${
        !isOnline ? 'bg-red-600' : 'bg-amber-500'
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
      ) : (
        <>
          <Clock className="w-4 h-4" />
          <span>{pendingCount} Vorgang/Vorgänge warten auf Synchronisation</span>
          <button
            onClick={() => {
              setIsSyncing(true);
              syncOutboxWithServer()
                .then(({ synced }) => {
                  if (synced > 0) {
                    setPendingCount((c) => Math.max(0, c - synced));
                  }
                })
                .catch(() => {})
                .finally(() => setIsSyncing(false));
            }}
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
