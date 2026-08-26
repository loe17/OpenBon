import React, { useState } from 'react';
import { Lock, KeyRound, ShieldCheck, Users, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import type { EventConfigDTO } from '@/types/domain';

interface SecurityTabProps {
  config: EventConfigDTO;
  onChange: (updates: Partial<EventConfigDTO>) => void;
}

export function SecurityTab({ config, onChange }: SecurityTabProps) {
  const [showPins, setShowPins] = useState<Record<string, boolean>>({});

  const toggleShow = (key: string) => {
    setShowPins((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6">
      {/* Stations-PINs */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <KeyRound className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base text-white">Stations- &amp; Mitarbeiter-PINs</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              const allShown = ['admin', 'pos', 'kitchen', 'waiter'].every((k) => showPins[k]);
              setShowPins({
                admin: !allShown,
                pos: !allShown,
                kitchen: !allShown,
                waiter: !allShown,
              });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition"
          >
            {['admin', 'pos', 'kitchen', 'waiter'].every((k) => showPins[k]) ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                <span>Alle verbergen</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                <span>Alle anzeigen</span>
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-slate-400">
          PINs werden mit PBKDF2 und 100.000 Iterationen kryptografisch gehasht in der Datenbank gespeichert.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-300">Admin-PIN</label>
              <button
                type="button"
                onClick={() => toggleShow('admin')}
                className="text-slate-400 hover:text-white p-0.5"
                title={showPins.admin ? 'PIN verbergen' : 'PIN anzeigen'}
              >
                {showPins.admin ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <input
              type={showPins.admin ? 'text' : 'password'}
              inputMode="numeric"
              value={config.adminPin || ''}
              onChange={(e) => onChange({ adminPin: e.target.value })}
              className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-base text-white font-mono text-center focus:border-amber-500"
              placeholder="1234"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-300">Kassen-PIN</label>
              <button
                type="button"
                onClick={() => toggleShow('pos')}
                className="text-slate-400 hover:text-white p-0.5"
                title={showPins.pos ? 'PIN verbergen' : 'PIN anzeigen'}
              >
                {showPins.pos ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <input
              type={showPins.pos ? 'text' : 'password'}
              inputMode="numeric"
              value={config.posPin || ''}
              onChange={(e) => onChange({ posPin: e.target.value })}
              className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-base text-white font-mono text-center focus:border-amber-500"
              placeholder="1111"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-300">Küchen-PIN</label>
              <button
                type="button"
                onClick={() => toggleShow('kitchen')}
                className="text-slate-400 hover:text-white p-0.5"
                title={showPins.kitchen ? 'PIN verbergen' : 'PIN anzeigen'}
              >
                {showPins.kitchen ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <input
              type={showPins.kitchen ? 'text' : 'password'}
              inputMode="numeric"
              value={config.kitchenPin || ''}
              onChange={(e) => onChange({ kitchenPin: e.target.value })}
              className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-base text-white font-mono text-center focus:border-amber-500"
              placeholder="2222"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-300">Kellner-PIN</label>
              <button
                type="button"
                onClick={() => toggleShow('waiter')}
                className="text-slate-400 hover:text-white p-0.5"
                title={showPins.waiter ? 'PIN verbergen' : 'PIN anzeigen'}
              >
                {showPins.waiter ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <input
              type={showPins.waiter ? 'text' : 'password'}
              inputMode="numeric"
              value={config.waiterPin || ''}
              onChange={(e) => onChange({ waiterPin: e.target.value })}
              className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-base text-white font-mono text-center focus:border-amber-500"
              placeholder="3333"
            />
          </div>
        </div>
      </div>

      {/* Brute-Force & Rate-Limiter Schutz */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <ShieldAlert className="w-5 h-5 text-rose-400" />
          <h3 className="font-bold text-base text-white">Brute-Force & Lockout-Schutz</h3>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
          <div className="flex items-center gap-2 font-bold text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Rate-Limiter aktiv (IP & Geräte-ID)</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Nach 5 aufeinanderfolgenden PIN-Fehleingaben sperrt das System Anfragen für 30 Sekunden.
            Alle sicherheitsrelevanten Vorgänge werden im unveränderlichen Audit-Log protokolliert.
          </p>
        </div>
      </div>
    </div>
  );
}
