'use client';

import React from 'react';
import { Printer, Receipt, ToggleLeft, ToggleRight } from 'lucide-react';
import type { EventConfigDTO } from '@/types/domain';

interface PrintersTabProps {
  config: EventConfigDTO;
  onChange: (updates: Partial<EventConfigDTO>) => void;
  printers: any[];
}

export function PrintersTab({ config, onChange, printers }: PrintersTabProps) {
  const isNearEndActive = !!config.enablePaperNearEndWarning;

  return (
    <div className="space-y-6">
      {/* Papierrollen-Erkennung & geräuschloser Stopp-Bon */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <Receipt className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-base text-white">Papierrollen-Überwachung</h3>
        </div>

        <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <div className="min-w-0">
            <div className="font-bold text-sm text-white">
              Papierrollen-Erkennung &amp; geräuschloser Stopp-Bon
            </div>
            <p className="text-xs text-slate-400 leading-snug mt-0.5">
              Überwacht den Fühlerhebel im Drucker und druckt kurz vor Rollenende automatisch einen geräuschlosen Hinweisbeleg (ohne Warnton), damit keine Bestellung abreißt.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange({ enablePaperNearEndWarning: !isNearEndActive })}
            aria-pressed={isNearEndActive}
            aria-label="Papierrollen-Erkennung & geräuschloser Stopp-Bon"
            className="p-1.5 shrink-0 active:scale-95 touch-manipulation transition-transform"
          >
            {isNearEndActive ? (
              <ToggleRight className="w-10 h-10 text-emerald-400" />
            ) : (
              <ToggleLeft className="w-10 h-10 text-slate-600" />
            )}
          </button>
        </div>

        <div className="text-xs rounded-xl p-3 bg-slate-950/60 border border-slate-800/80 leading-relaxed text-slate-300">
          {isNearEndActive ? (
            <span className="flex items-center gap-2 text-emerald-400 font-medium">
              <span>🟢</span>
              <span>
                <strong>Aktiviert:</strong> Der Status des Rollen-Vorwarnhebels wird in der Druckerverwaltung angezeigt. Droht das Papier auszugehen, schützt der automatische Stopp-Bon vor unleserlichen Belegen.
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-2 text-slate-400 font-medium">
              <span>⚪</span>
              <span>
                <strong>Deaktiviert:</strong> Der Drucker druckt ohne Vorwarnungen oder Stopp-Bons ganz normal bis zum physischen Ende durch.
              </span>
            </span>
          )}
        </div>
      </div>

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

      {/* Küchenmonitor-Drucksteuerung (KDS) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <Printer className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-base text-white">Küchenmonitor-Drucksteuerung (KDS)</h3>
        </div>

        <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <div className="min-w-0">
            <div className="font-bold text-sm text-white">
              Küchenmonitor steuert Bon-Ausgabe
            </div>
            <p className="text-xs text-slate-400 leading-snug mt-0.5">
              Wenn aktiv, druckt bei einer Kellner-Bestellung noch kein Bon. Der Bon druckt erst, wenn die Küche fertige Positionen abhakt und auf „Bons drucken“ tippt.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange({ kdsControlsPrinting: !config.kdsControlsPrinting })}
            aria-pressed={!!config.kdsControlsPrinting}
            aria-label="Küchenmonitor steuert Bon-Ausgabe"
            className="p-1.5 shrink-0 active:scale-95 touch-manipulation transition-transform"
          >
            {config.kdsControlsPrinting ? (
              <ToggleRight className="w-10 h-10 text-emerald-400" />
            ) : (
              <ToggleLeft className="w-10 h-10 text-slate-600" />
            )}
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <div className="min-w-0">
            <div className="font-bold text-sm text-white">
              Warte-Bon für verzögerte Speisen
            </div>
            <p className="text-xs text-slate-400 leading-snug mt-0.5">
              Druckt bei Teillieferungen einen kompakten Hinweisbon für verbleibende Speisen aus, damit Servicekraft und Gast informiert sind.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange({ kdsPrintDelayTicket: config.kdsPrintDelayTicket === false ? true : false })}
            aria-pressed={config.kdsPrintDelayTicket !== false}
            aria-label="Warte-Bon für verzögerte Speisen"
            className="p-1.5 shrink-0 active:scale-95 touch-manipulation transition-transform"
          >
            {config.kdsPrintDelayTicket !== false ? (
              <ToggleRight className="w-10 h-10 text-emerald-400" />
            ) : (
              <ToggleLeft className="w-10 h-10 text-slate-600" />
            )}
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <div className="min-w-0">
            <div className="font-bold text-sm text-white">
              Kellner bei Fertigmeldung benachrichtigen (Gong &amp; Banner)
            </div>
            <p className="text-xs text-slate-400 leading-snug mt-0.5">
              Wenn aktiv, ertönt beim Kellner ein Signalton und ein Banner erscheint, sobald ein Tisch in der Küche fertig gemeldet wird. (Standard: Ausgeschaltet)
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange({ kdsNotifyWaitersOnReady: !config.kdsNotifyWaitersOnReady })}
            aria-pressed={!!config.kdsNotifyWaitersOnReady}
            aria-label="Kellner bei Fertigmeldung benachrichtigen"
            className="p-1.5 shrink-0 active:scale-95 touch-manipulation transition-transform"
          >
            {config.kdsNotifyWaitersOnReady ? (
              <ToggleRight className="w-10 h-10 text-emerald-400" />
            ) : (
              <ToggleLeft className="w-10 h-10 text-slate-600" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

