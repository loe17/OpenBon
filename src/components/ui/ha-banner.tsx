'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, ArrowRight, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface HaStatusResponse {
  role?: string;
  secret?: { hasSecret: boolean; isWeak: boolean; source: string; enforceMode: boolean };
  pairingRequired?: boolean;
}

const DISMISS_KEY = 'openbon_ha_banner_dismissed_at';
const DISMISS_TTL_MS = 12 * 60 * 60 * 1000; // halber Tag, dann erinnert das Banner wieder

/**
 * N1 Globales HA-Sicherheitsbanner.
 *
 * Ersetzt die ehemalige manuelle Rotaufgabe (Terminal-Befehl
 * `node scripts/ha-pair.mjs ...`): Solange im Doppelbetrieb ein
 * oeffentlich bekanntes Sync-Secret aktiv ist, meldet sich die Kasse
 * selbstaendig - inklusive Direkteinstieg in den Assistenten.
 *
 * Verhalten:
 *  - Pollt alle 60 s den ADMIN-geschuetzten Status. Fuer Nicht-Admins
 *    antwortet der Endpunkt mit 401 -> Banner bleibt unsichtbar.
 *  - Abblendbar fuer 12 h pro Geraet (sessionStorage).
 */
export default function HaBanner() {
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'hidden' | 'weak' | 'enforced'>('loading');
  const [dismissed, setDismissed] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/system/ha/status', { cache: 'no-store' });
      if (!res.ok) {
        // Nicht-Admin (401) oder Fehler: nichts anzeigen
        setState((s) => (s === 'weak' || s === 'enforced' ? s : 'hidden'));
        return;
      }
      const data = (await res.json()) as HaStatusResponse;
      if (data.pairingRequired) {
        const enforceMode = Boolean(data.secret?.enforceMode);
        setState(enforceMode ? 'enforced' : 'weak');
        try {
          setDismissed(
            Date.now() - Number(sessionStorage.getItem(DISMISS_KEY) || 0) < DISMISS_TTL_MS
          );
        } catch {
          setDismissed(false);
        }
      } else {
        setState('hidden');
      }
    } catch {
      setState((s) => (s === 'weak' || s === 'enforced' ? s : 'hidden'));
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 60_000);
    return () => clearInterval(timer);
  }, [load]);

  if (state !== 'weak' && state !== 'enforced') return null;
  if (dismissed) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setDismissed(true);
  };

  const isEnforced = state === 'enforced';

  return (
    <div
      role="alert"
      className={`fixed top-0 left-0 right-0 z-[101] flex flex-wrap items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white shadow-lg transition-colors ${
        isEnforced ? 'bg-red-700' : 'bg-amber-600'
      }`}
    >
      <ShieldAlert className="w-4 h-4 shrink-0" />
      <span>
        {isEnforced
          ? 'HA blockiert: Schwaches Sync-Secret + Enforce-Modus aktiv - Standby kann nicht synchronisieren!'
          : 'HA-Hinweis: Doppelbetrieb mit oeffentlich bekanntem Sync-Secret. Bitte einmalig paaren.'}
      </span>
      <button
        onClick={() => router.push('/admin/settings?ha=1')}
        className="ml-2 inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-md transition"
      >
        HA-Assistent öffnen
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
      {!isEnforced && (
        <button
          onClick={dismiss}
          aria-label="Hinweis ausblenden"
          className="inline-flex items-center justify-center w-6 h-6 rounded-md hover:bg-white/20 transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
