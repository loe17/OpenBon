'use client';

import React from 'react';
import { ShieldCheck, FileSpreadsheet, FileCheck, Percent } from 'lucide-react';
import type { EventConfigDTO } from '@/types/domain';

interface FiscalTabProps {
  config: EventConfigDTO;
  onChange: (updates: Partial<EventConfigDTO>) => void;
}

export function FiscalTab({ config, onChange }: FiscalTabProps) {
  return (
    <div className="space-y-6">
      {/* Mehrwertsteuer */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <Percent className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-base text-white">Steuer & Kleinunternehmer-Regelung</h3>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <input
            type="checkbox"
            id="enableTax"
            checked={config.enableTax || false}
            onChange={(e) => onChange({ enableTax: e.target.checked })}
            className="w-5 h-5 rounded accent-emerald-600"
          />
          <label htmlFor="enableTax" className="text-xs text-slate-300 cursor-pointer">
            <strong>Mehrwertsteuer ausweisen (19% / 7%)</strong>
            <span className="block text-slate-500 mt-0.5">
              Für nicht steuerpflichtige Vereine oder Kleinunternehmer deaktiviert lassen.
            </span>
          </label>
        </div>
      </div>

      {/* TSE & KassenSichV */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <ShieldCheck className="w-5 h-5 text-blue-400" />
          <h3 className="font-bold text-base text-white">TSE-Sicherheitsmodul (KassenSichV)</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">TSE-Provider</label>
            <select
              value={config.tseProvider || 'NONE'}
              onChange={(e) => onChange({ tseProvider: e.target.value })}
              className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:border-blue-500"
            >
              <option value="NONE">Keine TSE (Vereinsfest / Ausnahme)</option>
              <option value="SIMULATION">TSE-Simulation (Offline Test)</option>
              <option value="SWISSBIT_USB">Swissbit USB TSE</option>
              <option value="FISKALY_CLOUD">fiskaly Cloud TSE</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              TSE Seriennummer
            </label>
            <input
              type="text"
              value={config.tseSerialNumber || ''}
              onChange={(e) => onChange({ tseSerialNumber: e.target.value })}
              className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono focus:border-blue-500"
              placeholder="z. B. TSE-SWISSBIT-0012345"
            />
          </div>
        </div>
      </div>

      {/* DATEV Kontenrahmen */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <FileSpreadsheet className="w-5 h-5 text-purple-400" />
          <h3 className="font-bold text-base text-white">DATEV EXTF Buchungskonten</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Berater-Nr.</label>
            <input
              type="text"
              value={config.datevConsultantNumber || ''}
              onChange={(e) => onChange({ datevConsultantNumber: e.target.value })}
              className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono focus:border-purple-500"
              placeholder="z. B. 1001"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Mandanten-Nr.</label>
            <input
              type="text"
              value={config.datevClientNumber || ''}
              onChange={(e) => onChange({ datevClientNumber: e.target.value })}
              className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono focus:border-purple-500"
              placeholder="z. B. 50020"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Kassenkonto</label>
            <input
              type="text"
              value={config.datevCashAccount || '1000'}
              onChange={(e) => onChange({ datevCashAccount: e.target.value })}
              className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono focus:border-purple-500"
              placeholder="1000"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
