'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Lock, WifiOff } from 'lucide-react';
import PinModal from './pin-modal';
import type { UserRole } from '@/lib/auth-session';

type StationPin = 'ADMIN' | 'POS' | 'KITCHEN' | 'WAITER';

interface StationGateProps {
  /** Welcher Stations-PIN wird abgefragt */
  station: StationPin;
  /** Klartextname der Station für die Anzeige */
  label: string;
  /** Rollen, die diese Station bedienen dürfen (ADMIN darf immer) */
  allow: UserRole[];
  children: React.ReactNode;
}

interface SessionInfo {
  authenticated: boolean;
  role: UserRole | null;
}

/**
 * Zentrales Session-Gate für alle Bedienstationen.
 *
 * Bisher rendered jede Station sofort durch; die Datenabrufe kamen ohne Session
 * mit 401 zurück und wurden still verschluckt (`Array.isArray(data)` schlug fehl).
 * Ergebnis: leere Artikel-, Tisch- und KDS-Listen ohne jeden Hinweis, und das
 * PIN-Pad erschien erst nach einem manuellen Stationswechsel.
 *
 * Das Gate prüft die Session beim Mount und zeigt bei Bedarf sofort das PIN-Pad.
 */
export default function StationGate({ station, label, allow, children }: StationGateProps) {
  const [state, setState] = useState<'checking' | 'locked' | 'open' | 'offline'>('checking');
  const [role, setRole] = useState<UserRole | null>(null);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store' });
      if (!res.ok) {
        setState('locked');
        return;
      }
      const data = (await res.json()) as SessionInfo;

      if (!data.authenticated || !data.role) {
        setState('locked');
        return;
      }

      const permitted = data.role === 'ADMIN' || allow.includes(data.role);
      setRole(data.role);
      setState(permitted ? 'open' : 'locked');
    } catch {
      // Kein Netz: Die Station darf weiterarbeiten (Offline-First), die
      // Outbox puffert Bestellungen und sendet sie später nach.
      setState('offline');
    }
  }, [allow]);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  if (state === 'checking') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-slate-950 text-slate-400">
        <RefreshCw className="w-7 h-7 animate-spin text-blue-500" />
        <p className="text-sm font-semibold">Anmeldung wird geprüft…</p>
      </div>
    );
  }

  if (state === 'locked') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-slate-950 text-slate-300 p-6">
        <div className="p-4 rounded-3xl bg-blue-600/15 text-blue-400 border border-blue-800">
          <Lock className="w-8 h-8" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-black text-white">{label}</h2>
          <p className="text-sm text-slate-400 font-semibold mt-1">
            Bitte mit dem Stations-PIN anmelden.
          </p>
        </div>

        <PinModal
          isOpen
          stationType={station}
          title={`${label}: Anmeldung`}
          description="Bitte gib den Stations-PIN ein, um diese Station zu benutzen."
          onSuccess={() => {
            setState('checking');
            void checkSession();
          }}
        />
      </div>
    );
  }

  return (
    <>
      {state === 'offline' && (
        <div className="bg-amber-600 text-black px-4 py-1.5 text-center text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          <span>Kein Serverkontakt – Eingaben werden lokal gepuffert und später gesendet</span>
        </div>
      )}
      {children}
    </>
  );
}
