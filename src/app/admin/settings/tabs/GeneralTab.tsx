'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  GraduationCap,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Lock,
  Palette,
  Percent,
  RotateCcw,
  AlertTriangle,
  Trash2,
  Check,
  X,
  Server,
  ShieldCheck,
  Activity,
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
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetOrders, setResetOrders] = useState(true);
  const [resetPayments, setResetPayments] = useState(true);
  const [resetTables, setResetTables] = useState(false);
  const [resetProducts, setResetProducts] = useState(false);
  const [resetWaiters, setResetWaiters] = useState(false);
  const [resetPrinters, setResetPrinters] = useState(false);
  const [resetConfig, setResetConfig] = useState(false);

  const [confirmText, setConfirmText] = useState('');
  const [countdown, setCountdown] = useState(5);
  const [isResetting, setIsResetting] = useState(false);
  const [resetResult, setResetResult] = useState<string[] | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showResetModal) {
      setCountdown(5);
      setConfirmText('');
      setResetResult(null);
      timer = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showResetModal]);

  const handleExecuteReset = async () => {
    setIsResetting(true);
    try {
      const res = await fetch('/api/system/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resetOrders,
          resetPayments,
          resetTables,
          resetProducts,
          resetWaiters,
          resetPrinters,
          resetConfig,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResetResult(data.summary || ['Erfolgreich zurückgesetzt']);
      } else {
        alert(data.error || 'Fehler beim Zurücksetzen');
      }
    } catch {
      alert('Netzwerkfehler beim Zurücksetzen');
    } finally {
      setIsResetting(false);
    }
  };

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

      {/* Hochverfügbarkeit & Ausfallsicherheit (Secondary Server / HA) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-950/80 text-blue-400 border border-blue-800">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Hochverfügbarkeit &amp; Sekundärserver (HA-Cluster)</h3>
              <p className="text-xs text-slate-400">
                Automatischer Standby-Server mit Live-Replikation bei Hardware- oder Netzwerkausfall
              </p>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-blue-950/80 border border-blue-800 text-[10px] font-bold text-blue-300">
            Ausfallsicherheit
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Rolle dieses Servers
            </label>
            <select
              value={(config as any).haRole || 'STANDALONE'}
              onChange={(e) => onChange({ haRole: e.target.value } as any)}
              className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-bold focus:border-blue-500"
            >
              <option value="STANDALONE">STANDALONE (Einzelserver-Betrieb)</option>
              <option value="PRIMARY">PRIMARY (Hauptserver / Master mit Live-Replikation)</option>
              <option value="STANDBY">STANDBY (Sekundärserver / Hot-Standby Empfänger)</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              {(config as any).haRole === 'PRIMARY'
                ? 'Dieser Server verarbeitet alle Kassenbuchungen und spiegelt Änderungen live auf den Sekundärserver.'
                : (config as any).haRole === 'STANDBY'
                ? 'Dieser Server läuft im Hintergrund mit und übernimmt bei Ausfall des Primärservers sofort nahtlos.'
                : 'Standard für Einzelgeräte ohne Backup-Server im Netzwerk.'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Partner-Server URL im lokalen Netzwerk
            </label>
            <input
              type="text"
              value={(config as any).haPartnerUrl || ''}
              onChange={(e) => onChange({ haPartnerUrl: e.target.value } as any)}
              className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono focus:border-blue-500"
              placeholder="z. B. http://192.168.1.100:3000"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              IP-Adresse und Port des anderen OpenBon-Servers im LAN (z. B. http://192.168.1.100:3000).
            </p>
          </div>
        </div>

        <Toggle
          label="Automatisches Failover (Auto-Umschaltung bei Ausfall)"
          hint="Übernimmt automatisch den Kassenbetrieb als Primärserver, falls der Hauptserver länger als 10 Sekunden nicht mehr erreichbar ist."
          color="blue"
          value={Boolean((config as any).haAutoFailover)}
          onToggle={() =>
            onChange({
              haAutoFailover: !(config as any).haAutoFailover,
            } as any)
          }
        />
      </div>

      {/* Betriebsdaten & Veranstaltung zurücksetzen */}
      <div className="bg-slate-900 border border-rose-900/50 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3 text-rose-400">
            <RotateCcw className="w-5 h-5" />
            <h3 className="font-bold text-base text-white">Veranstaltung &amp; Daten zurücksetzen</h3>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-rose-950/80 border border-rose-800 text-[10px] font-bold text-rose-300">
            Wartung &amp; Bereinigung
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Bereinige Testbuchungen vor einem Fest oder setze einzelne Bereiche wie Artikel, Tische oder Umsätze selektiv zurück.
        </p>

        <button
          type="button"
          onClick={() => setShowResetModal(true)}
          className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 border border-rose-800 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 touch-manipulation"
        >
          <Trash2 className="w-4 h-4 text-rose-400" />
          <span>Veranstaltungsdaten selektiv zurücksetzen...</span>
        </button>
      </div>

      {/* Selective Reset Modal Dialog */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-rose-700/80 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="font-black text-lg text-white">Veranstaltung zurücksetzen</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {resetResult ? (
              <div className="space-y-4 text-center py-4">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Check className="w-8 h-8" />
                </div>
                <h4 className="text-base font-black text-white">Reset erfolgreich durchgeführt</h4>
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left space-y-1 text-xs text-slate-300">
                  {resetResult.map((msg, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-emerald-400">✓</span>
                      <span>{msg}</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    window.location.reload();
                  }}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-xs shadow"
                >
                  Schließen &amp; Seite aktualisieren
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-300">
                  Wähle genau aus, welche Datenbereiche unwiderruflich gelöscht werden sollen:
                </p>

                <div className="space-y-2">
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700">
                    <span className="text-xs font-bold text-white">Bestellungen, Bons &amp; KDS-Aufträge</span>
                    <input
                      type="checkbox"
                      checked={resetOrders}
                      onChange={(e) => setResetOrders(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 bg-slate-900 border-slate-700"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700">
                    <span className="text-xs font-bold text-white">Umsätze, Zahlungen &amp; Kassenbuch</span>
                    <input
                      type="checkbox"
                      checked={resetPayments}
                      onChange={(e) => setResetPayments(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 bg-slate-900 border-slate-700"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700">
                    <span className="text-xs font-bold text-white">Tische &amp; 2D-Raumplan</span>
                    <input
                      type="checkbox"
                      checked={resetTables}
                      onChange={(e) => setResetTables(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 bg-slate-900 border-slate-700"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700">
                    <span className="text-xs font-bold text-white">Speisekarte, Artikel, Warengruppen &amp; Bestand</span>
                    <input
                      type="checkbox"
                      checked={resetProducts}
                      onChange={(e) => setResetProducts(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 bg-slate-900 border-slate-700"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700">
                    <span className="text-xs font-bold text-white">Bedienungsprofile &amp; Trinkgeldmodelle</span>
                    <input
                      type="checkbox"
                      checked={resetWaiters}
                      onChange={(e) => setResetWaiters(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 bg-slate-900 border-slate-700"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700">
                    <span className="text-xs font-bold text-white">Drucker &amp; Druckgruppen</span>
                    <input
                      type="checkbox"
                      checked={resetPrinters}
                      onChange={(e) => setResetPrinters(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 bg-slate-900 border-slate-700"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-rose-950/40 border border-rose-800/80 cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-rose-300 block">Vollständiger Werksreset</span>
                      <span className="text-[10px] text-rose-400">Setzt auch alle PINs und Systemeinstellungen zurück</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={resetConfig}
                      onChange={(e) => setResetConfig(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 bg-slate-900 border-rose-700"
                    />
                  </label>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <label className="text-xs font-bold text-slate-300 block">
                    Tippe zur Sicherheitsbestätigung <span className="font-mono text-rose-400 font-black">RESET</span> ein:
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                    placeholder="RESET"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-center font-mono font-black text-rose-400 tracking-widest uppercase focus:border-rose-500"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    disabled={countdown > 0 || confirmText !== 'RESET' || isResetting}
                    onClick={handleExecuteReset}
                    className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black shadow transition active:scale-95"
                  >
                    {isResetting ? (
                      'Wird bereinigt...'
                    ) : countdown > 0 ? (
                      `Warte ${countdown}s...`
                    ) : (
                      'Löschung jetzt ausführen'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
