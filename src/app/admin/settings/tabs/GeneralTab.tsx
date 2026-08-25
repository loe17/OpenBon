'use client';

import React from 'react';
import { Building2, Globe, GraduationCap, ToggleLeft, ToggleRight, Sparkles } from 'lucide-react';
import type { EventConfigDTO } from '@/types/domain';

interface GeneralTabProps {
  config: EventConfigDTO;
  onChange: (updates: Partial<EventConfigDTO>) => void;
  autostartInfo: any;
  onToggleAutostart: () => void;
  togglingAutostart: boolean;
}

export function GeneralTab({
  config,
  onChange,
  autostartInfo,
  onToggleAutostart,
  togglingAutostart,
}: GeneralTabProps) {
  return (
    <div className="space-y-6">
      {/* Event Grunddaten */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <Building2 className="w-5 h-5 text-blue-400" />
          <h3 className="font-bold text-base text-white">Veranstaltung & Organisation</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Name der Veranstaltung
            </label>
            <input
              type="text"
              value={config.name || ''}
              onChange={(e) => onChange({ name: e.target.value })}
              className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-medium focus:border-blue-500"
              placeholder="z. B. Feuerwehrfest 2026"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Veranstalter / Verein (Unterzeile)
            </label>
            <input
              type="text"
              value={config.receiptSubHeader || ''}
              onChange={(e) => onChange({ receiptSubHeader: e.target.value })}
              className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-medium focus:border-blue-500"
              placeholder="z. B. Freiwillige Feuerwehr Musterstadt e.V."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Währungssymbol</label>
            <input
              type="text"
              value={config.currency || 'EUR'}
              onChange={(e) => onChange({ currency: e.target.value })}
              className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Standard-Steuersatz Normal (%)
            </label>
            <input
              type="number"
              value={config.taxRateNormal || 19}
              onChange={(e) => onChange({ taxRateNormal: parseFloat(e.target.value) || 19 })}
              className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Betriebsmodi */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <GraduationCap className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-base text-white">Betriebs- & Übungsmodi</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <div>
              <div className="font-bold text-sm text-white">Übungs- / Schulungsmodus</div>
              <p className="text-xs text-slate-400">
                Bons werden als &bdquo;SCHULUNGSBON&ldquo; gekennzeichnet und nicht fiskaliert.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChange({ trainingMode: !config.trainingMode })}
              className="p-2 text-2xl active:scale-95 touch-manipulation"
            >
              {config.trainingMode ? (
                <ToggleRight className="w-10 h-10 text-amber-400" />
              ) : (
                <ToggleLeft className="w-10 h-10 text-slate-600" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <div>
              <div className="font-bold text-sm text-white">Autostart beim Booten</div>
              <p className="text-xs text-slate-400">
                {autostartInfo?.message || 'Server automatisch beim Hochfahren starten'}
              </p>
            </div>
            <button
              type="button"
              disabled={togglingAutostart}
              onClick={onToggleAutostart}
              className="p-2 text-2xl active:scale-95 touch-manipulation disabled:opacity-50"
            >
              {autostartInfo?.autostartEnabled ? (
                <ToggleRight className="w-10 h-10 text-emerald-400" />
              ) : (
                <ToggleLeft className="w-10 h-10 text-slate-600" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
