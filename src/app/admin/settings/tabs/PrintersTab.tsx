'use client';

import React from 'react';
import { Printer, Receipt, Eye, Sparkles } from 'lucide-react';
import type { EventConfigDTO } from '@/types/domain';

interface PrintersTabProps {
  config: EventConfigDTO;
  onChange: (updates: Partial<EventConfigDTO>) => void;
  printers: any[];
}

export function PrintersTab({ config, onChange, printers }: PrintersTabProps) {
  return (
    <div className="space-y-6">
      {/* Drucker Routing & Meldebestand-Drucker */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <Printer className="w-5 h-5 text-blue-400" />
          <h3 className="font-bold text-base text-white">Warn- & Alert-Drucker</h3>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1">
            Drucker für Meldebestand-Warnungen
          </label>
          <select
            value={config.lowStockAlertPrinterId || ''}
            onChange={(e) => onChange({ lowStockAlertPrinterId: e.target.value || null })}
            className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:border-blue-500"
          >
            <option value="">Kein automatischer Warndruck (Nur Bildschirm)</option>
            {printers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.ipAddress || 'Virtuell'})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
