'use client';

import React from 'react';
import {
  Building2,
  GraduationCap,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Lock,
  Palette,
  Percent,
} from 'lucide-react';
import type { EventConfigDTO } from '@/types/domain';

interface GeneralTabProps {
  config: EventConfigDTO;
  onChange: (updates: Partial<EventConfigDTO>) => void;
  autostartInfo: any;
  onToggleAutostart: () => void;
  togglingAutostart: boolean;
}

/** Einheitlicher Schalter fuer alle Funktionsoptionen. */
function Toggle({
  label,
  hint,
  value,
  onToggle,
  color = 'emerald',
}: {
  label: string;
  hint?: string;
  value: boolean;
  onToggle: () => void;
  color?: 'emerald' | 'amber' | 'blue';
}) {
  const on =
    color === 'amber' ? 'text-amber-400' : color === 'blue' ? 'text-blue-400' : 'text-emerald-400';
  return (
    <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-slate-950 border border-slate-800">
      <div className="min-w-0">
        <div className="font-bold text-sm text-white">{label}</div>
        {hint ? <p className="text-xs text-slate-400 leading-snug">{hint}</p> : null}
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={value}
        aria-label={label}
        className="p-1.5 shrink-0 active:scale-95 touch-manipulation"
      >
        {value ? (
          <ToggleRight className={`w-10 h-10 ${on}`} />
        ) : (
          <ToggleLeft className="w-10 h-10 text-slate-600" />
        )}
      </button>
    </div>
  );
}

const THEMES: { id: string; label: string }[] = [
  { id: 'klassisch', label: 'Klassisch (Standard)' },
  { id: 'dark', label: 'Dunkel' },
  { id: 'light', label: 'Hell' },
  { id: 'contrast', label: 'Hoher Kontrast' },
  { id: 'modern', label: 'Modern' },
  { id: 'minimal', label: 'Minimal' },
];

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

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Ermäßigter Steuersatz (%)
            </label>
            <input
              type="number"
              value={config.taxRateReduced ?? 7}
              onChange={(e) => onChange({ taxRateReduced: parseFloat(e.target.value) || 7 })}
              className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono focus:border-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">Gilt üblicherweise für Speisen.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Positionen je Tablett (Standard)
            </label>
            <input
              type="number"
              min={0}
              value={config.trayMaxItems ?? 6}
              onChange={(e) => onChange({ trayMaxItems: parseInt(e.target.value, 10) || 0 })}
              className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono focus:border-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Ab dieser Anzahl wird ein Bon geteilt, damit eine Bestellung auf ein Tablett passt.
              0 schaltet die Teilung ab. Druckgruppen können davon abweichen.
            </p>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              <span className="inline-flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" />
                Erscheinungsbild
              </span>
            </label>
            <select
              value={config.activeTheme || 'dark'}
              onChange={(e) => onChange({ activeTheme: e.target.value })}
              className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-medium focus:border-blue-500"
            >
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Anschrift & Rechtliche Angaben für Gastro-Bons */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <Building2 className="w-5 h-5 text-emerald-400" />
          <div>
            <h3 className="font-bold text-base text-white">Anschrift &amp; Rechtliche Angaben</h3>
            <p className="text-xs text-slate-400">
              Pflichtangaben für das Gastro-Detail-Bonlayout (Rechnungsnachweis für Gäste).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Straße &amp; Hausnummer
            </label>
            <input
              type="text"
              value={config.addressStreet || ''}
              onChange={(e) => onChange({ addressStreet: e.target.value })}
              className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-medium focus:border-emerald-500"
              placeholder="z. B. Festplatzstraße 12"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              PLZ &amp; Ort
            </label>
            <input
              type="text"
              value={config.addressCity || ''}
              onChange={(e) => onChange({ addressCity: e.target.value })}
              className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-medium focus:border-emerald-500"
              placeholder="z. B. 12345 Musterstadt"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Steuernummer
            </label>
            <input
              type="text"
              value={config.taxNumber || ''}
              onChange={(e) => onChange({ taxNumber: e.target.value })}
              className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono focus:border-emerald-500"
              placeholder="z. B. 123/456/78901"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Umsatzsteuer-ID (USt-IdNr.)
            </label>
            <input
              type="text"
              value={config.vatId || ''}
              onChange={(e) => onChange({ vatId: e.target.value })}
              className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono focus:border-emerald-500"
              placeholder="z. B. DE123456789"
            />
          </div>
        </div>
      </div>

      {/* Funktionsumfang */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <Sparkles className="w-5 h-5 text-blue-400" />
          <h3 className="font-bold text-base text-white">Funktionsumfang</h3>
        </div>
        <p className="text-xs text-slate-400 -mt-2">
          Nur was hier eingeschaltet ist, taucht an den Stationen auf. Schalten Sie ab, was Ihr Fest
          nicht braucht – jede zusätzliche Schaltfläche kostet die Bedienung Zeit.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Toggle
            label="Gänge / Speisenfolge"
            hint="Vorspeise, Hauptgang und Nachspeise getrennt abrufen."
            value={Boolean(config.enableCourses)}
            onToggle={() => onChange({ enableCourses: !config.enableCourses })}
          />
          <Toggle
            label="Digitaler Beleg"
            hint="Der Gast erhält den Beleg über einen Link statt auf Papier."
            value={Boolean(config.enableDigitalReceipt)}
            onToggle={() => onChange({ enableDigitalReceipt: !config.enableDigitalReceipt })}
          />
          <Toggle
            label="Gast-Sicht beim Kassieren"
            hint="Zeigt dem Gast den Betrag auf dem gedrehten Bildschirm."
            value={Boolean(config.enableGuestFacingDisplay)}
            onToggle={() =>
              onChange({ enableGuestFacingDisplay: !config.enableGuestFacingDisplay })
            }
          />
          <Toggle
            label="Gast bestellt selbst (QR am Tisch)"
            hint="Gäste bestellen über den QR-Code auf dem Tischaufsteller."
            value={Boolean(config.enableGuestSelfOrder)}
            onToggle={() => onChange({ enableGuestSelfOrder: !config.enableGuestSelfOrder })}
          />
          <Toggle
            label="Selbstbedienungs-Terminal"
            hint="Kiosk-Ansicht für ein aufgestelltes Tablet."
            value={Boolean(config.enableKioskMode)}
            onToggle={() => onChange({ enableKioskMode: !config.enableKioskMode })}
          />
          <Toggle
            label="Virtuelle Drucker"
            hint="Bons erscheinen auf einem Bildschirm statt auf Papier."
            value={Boolean(config.enableVirtualPrinters)}
            onToggle={() => onChange({ enableVirtualPrinters: !config.enableVirtualPrinters })}
          />
          <Toggle
            label="Hinweis bei Alterskontrolle"
            hint="Warnt beim Kassieren von Spirituosen und Tabak."
            color="amber"
            value={config.enableAgeVerificationAlerts !== false}
            onToggle={() =>
              onChange({
                enableAgeVerificationAlerts: !(config.enableAgeVerificationAlerts !== false),
              })
            }
          />
          <Toggle
            label="QR-Code auf dem Beleg"
            hint="Druckt den Link zum digitalen Beleg als QR-Code."
            value={Boolean(config.enableDigitalReceiptQr)}
            onToggle={() => onChange({ enableDigitalReceiptQr: !config.enableDigitalReceiptQr })}
          />
        </div>
      </div>

      {/* Zugang */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <Lock className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-base text-white">Zugang</h3>
        </div>
        <Toggle
          label="Startseite sperren"
          hint="Beim Öffnen wird zuerst ein PIN verlangt. Ausgeschaltet ist die Stationsauswahl sofort bedienbar und der PIN kommt erst beim Antippen."
          color="amber"
          value={config.lockStartScreen !== false}
          onToggle={() => onChange({ lockStartScreen: !(config.lockStartScreen !== false) })}
        />
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
