'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, ShieldCheck, KeyRound, Copy, CheckCircle2, AlertTriangle, ChevronDown } from 'lucide-react';

interface HaStatus {
  role?: string;
  partnerUrl?: string | null;
  secret?: { hasSecret: boolean; isWeak: boolean; source: string; enforceMode: boolean };
  pairingRequired?: boolean;
  enforceBlocked?: boolean;
}

/**
 * N1 In-App-HA-Pairing-Assistent.
 *
 * Ersetzt den manuellen Terminal-Befehl (`node scripts/ha-pair.mjs ...`)
 * durch einen gefuehrten 3-Schritt-Flow mit manueller Bestaetigung:
 *
 *   A) Diesen Server vorbereiten  -> erzeugt 6-stelligen Code (Admin-PIN)
 *   B) Am Partner-Server: Code eintragen -> uebernimmt das Secret (Admin-PIN)
 *   C) Zurück am Initiator: "Übernehmen" -> aktiviert beidseitig (Admin-PIN)
 */
export default function HaPairingAssistant({ highlight: externalHighlight }: { highlight?: boolean }) {
  const [highlight] = useState<boolean>(
    () =>
      Boolean(externalHighlight) ||
      (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('ha') === '1')
  );
  const [status, setStatus] = useState<HaStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Schritt A - Initiation
  const [initiating, setInitiating] = useState(false);
  const [pinA, setPinA] = useState('');
  const [showInitiateForm, setShowInitiateForm] = useState(false);
  const [pairId, setPairId] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Schritt B - Partner-Seite
  const [peerUrl, setPeerUrl] = useState('');
  const [peerCode, setPeerCode] = useState('');
  const [pinB, setPinB] = useState('');
  const [applying, setApplying] = useState(false);

  // Schritt C
  const [finalizing, setFinalizing] = useState(false);
  const [pinC, setPinC] = useState('');
  const [showFinalize, setShowFinalize] = useState(false);

  const [message, setMessage] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/system/ha/status', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (data.partnerUrl && !peerUrl) setPeerUrl(String(data.partnerUrl));
      }
    } catch {
      /* Status optional */
    } finally {
      setLoadingStatus(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadStatus();
    if (highlight && sectionRef.current) {
      setTimeout(
        () => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        250
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!codeExpiresAt) return;
    const t = setInterval(() => {
      if (Date.now() > codeExpiresAt) {
        setCode(null);
        setCodeExpiresAt(null);
        setPairId(null);
        setMessage({ kind: 'err', text: 'Bestätigungscode abgelaufen – bitte neu starten.' });
      }
    }, 1000);
    return () => clearInterval(t);
  }, [codeExpiresAt]);

  const post = useCallback(async <T,>(payload: Record<string, unknown>): Promise<{ ok: boolean; data: T & { error?: string; message?: string } }> => {
    const res = await fetch('/api/system/ha/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}) as any);
    return { ok: res.ok, data };
  }, []);

  /* ------------------------------- Schritt A: INITIATE ------------------------------ */
  const handleInitiate = async () => {
    setInitiating(true);
    setMessage(null);
    try {
      const { ok, data } = await post<any>({ action: 'INITIATE', pin: pinA });
      if (ok) {
        setPairId(data.pairId);
        setCode(data.code);
        setCodeExpiresAt(data.expiresAt);
        setShowInitiateForm(false);
        setPinA('');
        setMessage({
          kind: 'info',
          text: 'Schritt B: Öffne am Partner-Server dieselbe Einstellungsseite und trage dort diesen Code ein.',
        });
      } else {
        setMessage({ kind: 'err', text: data.error || 'Start fehlgeschlagen.' });
      }
    } catch {
      setMessage({ kind: 'err', text: 'Netzwerkfehler beim Starten des Pairings.' });
    } finally {
      setInitiating(false);
    }
  };

  /* --------------------------- Schritt B: APPLY_FROM_PEER ---------------------------- */
  const handleApplyFromPeer = async () => {
    if (peerCode.trim().length !== 6) {
      setMessage({ kind: 'err', text: 'Bitte den 6-stelligen Code vom anderen Server eingeben.' });
      return;
    }
    setApplying(true);
    setMessage(null);
    try {
      const { ok, data } = await post<any>({
        action: 'APPLY_FROM_PEER',
        pin: pinB,
        code: peerCode,
        peerUrl,
      });

      if (ok) {
        setPeerCode('');
        setPinB('');
        setMessage({
          kind: 'ok',
          text:
            (data.message || 'Dieser Knoten ist gepaart.') +
            ' Wechsle nun zum Initiator-Server und klicke dort im Schritt C auf "Übernehmen".',
        });
        void loadStatus();
      } else {
        setMessage({ kind: 'err', text: data.error || 'Übernahme fehlgeschlagen.' });
      }
    } catch {
      setMessage({ kind: 'err', text: 'Partner-Server nicht erreichbar.' });
    } finally {
      setApplying(false);
    }
  };

  /* -------------------------------- Schritt C: FINALIZE ------------------------------ */
  const handleFinalize = async () => {
    if (!pairId) {
      setMessage({ kind: 'err', text: 'Kein laufendes Pairing auf diesem Server.' });
      return;
    }
    setFinalizing(true);
    setMessage(null);
    try {
      const { ok, data } = await post<any>({ action: 'FINALIZE', pin: pinC, pairId });
      if (ok) {
        setPairId(null);
        setCode(null);
        setPinC('');
        setShowFinalize(false);
        setMessage({ kind: 'ok', text: data.message || 'Pairing abgeschlossen.' });
        void loadStatus();
      } else {
        setMessage({ kind: 'err', text: data.error || 'Abschluss fehlgeschlagen.' });
      }
    } catch {
      setMessage({ kind: 'err', text: 'Netzwerkfehler beim Abschließen.' });
    } finally {
      setFinalizing(false);
    }
  };

  const weakWarning = status?.secret?.isWeak && status.pairingRequired;

  return (
    <div
      id="ha-section"
      ref={sectionRef}
      className={`rounded-2xl border p-4 space-y-4 transition ${
        weakWarning ? 'border-amber-700/70 bg-amber-950/20' : 'border-slate-800 bg-slate-950/70'
      } ${highlight ? 'ring-2 ring-blue-500/60' : ''}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className={`w-5 h-5 ${weakWarning ? 'text-amber-400' : 'text-emerald-400'}`} />
          <h4 className="font-bold text-sm text-white">Sync-Sicherheit &amp; PAIRING-ASSISTENT</h4>
          {loadingStatus && <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />}
        </div>
        {status && !loadingStatus ? (
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
              status.pairingRequired
                ? 'bg-amber-950/80 border-amber-800 text-amber-300'
                : 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
            }`}
          >
            {status.pairingRequired
              ? 'SCHWACHES SECRET AKTIV'
              : `SECRET OK (${status.secret?.source ?? 'DB'})`}
          </span>
        ) : null}
      </div>

      {status && (
        <p className="text-[11px] text-slate-400 leading-snug">
          Rolle dieses Servers: <b className="text-white">{status.role ?? 'unbekannt'}</b>
          {status.partnerUrl ? (
            <>
              {' '}· Partner: <span className="font-mono">{status.partnerUrl}</span>
            </>
          ) : null}
          {weakWarning
            ? ' · Beide Knoten nutzen aktuell das öffentlich bekannte Standard-Secret.'
            : ''}
          {status.secret?.enforceMode ? ' · Enforce-Modus aktiv.' : ''}
        </p>
      )}

      {/* Schritt-A-Karte */}
      <div className="space-y-2">
        <div className="font-bold text-xs text-slate-300">Schritt A · Diesen Server vorbereiten</div>
        {!code ? (
          showInitiateForm ? (
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
              <input
                type="password"
                inputMode="numeric"
                value={pinA}
                onChange={(e) => setPinA(e.target.value)}
                placeholder="Admin-PIN"
                maxLength={8}
                className="w-full sm:w-40 min-h-[44px] px-3 bg-black/40 border border-slate-700 rounded-xl text-sm font-bold tracking-widest"
              />
              <button
                type="button"
                onClick={handleInitiate}
                disabled={initiating || pinA.length < 4}
                className="min-h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-black flex items-center gap-2"
              >
                {initiating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                PIN prüfen &amp; Code erzeugen
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowInitiateForm(true)}
              className="min-h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black flex items-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              Pairing starten (Code erzeugen)
            </button>
          )
        ) : (
          <div className="space-y-2 p-3 rounded-xl bg-black/40 border border-blue-800">
            <div className="text-[11px] text-slate-300 font-semibold">
              Diesen 6-stelligen Code am PARTNER-Server eingeben:
            </div>
            <div className="flex items-center gap-3">
              <div className="font-mono text-2xl font-black tracking-[0.45em] text-blue-300 select-all">
                {code}
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(code).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }).catch(() => {});
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                aria-label="Code kopieren"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-slate-500">Gültig für 10 Minuten.</p>
              <button
                type="button"
                onClick={() => setShowFinalize((v) => !v)}
                className="text-[11px] font-bold text-blue-300 hover:text-blue-200 underline underline-offset-2"
              >
                Nach Übernahme am Partner: hier abschließen
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Finalisieren-Faltbereich (Schritt C) */}
      {showFinalize && pairId && (
        <div className="space-y-2 p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/60">
          <div className="font-bold text-xs text-emerald-200">
            Schritt C · Pairing auf DIESEM Server abschließen
          </div>
          <p className="text-[11px] text-slate-400">
            Nur klicken, wenn der Partner-Server bereits bestätigt hat ("Diesen Knoten gepaart").
          </p>
          <div className="flex gap-2 items-end">
            <input
              type="password"
              inputMode="numeric"
              value={pinC}
              onChange={(e) => setPinC(e.target.value)}
              placeholder="Admin-PIN"
              maxLength={8}
              className="w-40 min-h-[44px] px-3 bg-black/40 border border-slate-700 rounded-xl text-sm font-bold tracking-widest"
            />
            <button
              type="button"
              onClick={handleFinalize}
              disabled={finalizing || pinC.length < 4}
              className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-black flex items-center gap-2"
            >
              {finalizing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Übernehmen
            </button>
          </div>
        </div>
      )}

      {/* Schritt-B-Karte */}
      <details className="group rounded-xl border border-slate-800 bg-black/30 overflow-hidden">
        <summary className="cursor-pointer list-none px-3 py-2.5 flex items-center justify-between gap-2 select-none">
          <span className="font-bold text-xs text-slate-300">
            Ich bin der zweite Server · Code vom Initiator eintragen
          </span>
          <ChevronDown className="w-4 h-4 text-slate-500 group-open:rotate-180 transition" />
        </summary>
        <div className="px-3 pb-3 space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">
              Adresse des initiatorierenden Servers (URL)
            </label>
            <input
              type="text"
              value={peerUrl}
              onChange={(e) => setPeerUrl(e.target.value)}
              placeholder="z. B. http://192.168.1.100:3000"
              className="w-full min-h-[44px] px-3 bg-black/40 border border-slate-700 rounded-xl text-sm font-mono focus:border-blue-500"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
            <input
              type="text"
              inputMode="numeric"
              value={peerCode}
              onChange={(e) => setPeerCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-stelliger Code"
              className="min-h-[44px] px-3 bg-black/40 border border-slate-700 rounded-xl text-lg font-mono font-black tracking-[0.35em] focus:border-blue-500 col-span-1"
            />
            <input
              type="password"
              inputMode="numeric"
              value={pinB}
              onChange={(e) => setPinB(e.target.value)}
              placeholder="Admin-PIN (dieser Server)"
              maxLength={8}
              className="min-h-[44px] px-3 bg-black/40 border border-slate-700 rounded-xl text-sm font-bold tracking-widest col-span-1"
            />
            <button
              type="button"
              onClick={handleApplyFromPeer}
              disabled={applying || peerCode.length !== 6 || pinB.length < 4}
              className="min-h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-black flex items-center justify-center gap-2 col-span-1"
            >
              {applying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              Vom Initiator übernehmen
            </button>
          </div>
        </div>
      </details>

      {message && (
        <div
          className={`flex items-start gap-2 text-xs p-3 rounded-xl border ${
            message.kind === 'ok'
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
              : message.kind === 'err'
                ? 'bg-rose-950/40 border-rose-800 text-rose-200'
                : 'bg-blue-950/40 border-blue-800 text-blue-200'
          }`}
        >
          {message.kind === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : message.kind === 'err' ? (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{message.text}</span>
        </div>
      )}
    </div>
  );
}

function Info(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
    </svg>
  );
}
