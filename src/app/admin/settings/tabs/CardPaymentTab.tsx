'use client';

import React from 'react';
import { CreditCard, Smartphone, Server, CheckCircle2, AlertTriangle, Link2 } from 'lucide-react';
import type { EventConfigDTO } from '@/types/domain';

/**
 * Kartenzahlung einrichten.
 *
 * WICHTIG für das Verständnis: Eine Kartenzahlart erscheint an der Kasse nur,
 * wenn hier das zugehörige Feld ausgefüllt ist (siehe `src/lib/payment/methods.ts`).
 * Da diese Felder bei der Modularisierung der Einstellungen aus der Oberfläche
 * verschwunden sind, war Kartenzahlung faktisch nicht mehr aktivierbar – die
 * Knöpfe tauchten an der Kasse schlicht nie auf.
 */

interface CardPaymentTabProps {
  config: EventConfigDTO;
  onChange: (updates: Partial<EventConfigDTO>) => void;
}

function filled(value?: string | null): boolean {
  return Boolean(value && String(value).trim() !== '');
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-full">
      <CheckCircle2 className="w-3 h-3" />
      An der Kasse verfügbar
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 bg-slate-950 border border-slate-700 px-2 py-0.5 rounded-full">
      Nicht eingerichtet
    </span>
  );
}

export function CardPaymentTab({ config, onChange }: CardPaymentTabProps) {
  const sumupActive = filled(config.sumupMerchantCode) || filled(config.sumupAppId);
  const vrPayActive = filled(config.vrPayTerminalId);
  const sparkasseActive = filled(config.sparkasseMerchantId);
  const zvtActive = filled(config.zvtHost);
  const anyActive = sumupActive || vrPayActive || sparkasseActive || zvtActive;

  const inputClass =
    'w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono focus:border-blue-500';

  return (
    <div className="space-y-6">
      {!anyActive ? (
        <div className="flex items-start gap-3 bg-amber-950/40 border border-amber-800/60 text-amber-200 rounded-2xl p-4">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-bold">Zurzeit ist nur Barzahlung möglich.</div>
            <p className="text-xs text-amber-200/80 mt-0.5">
              Eine Kartenzahlart wird an Bonkasse und Bedienung erst angeboten, sobald unten das
              passende Feld ausgefüllt ist.
            </p>
          </div>
        </div>
      ) : null}

      {/* --------------------------------------------------- App-to-App */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <Smartphone className="w-5 h-5 text-blue-400" />
          <h3 className="font-bold text-base text-white">Kartenzahlung per Händler-App</h3>
        </div>
        <p className="text-xs text-slate-400 -mt-2">
          Die Kasse öffnet die App des Anbieters, der Betrag wird übergeben und das Ergebnis kommt
          automatisch zurück. Voraussetzung: Die App ist auf demselben Gerät installiert.
        </p>

        {/* SumUp */}
        <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-bold text-sm text-white">SumUp</span>
            <StatusBadge active={sumupActive} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Händlercode</label>
              <input
                type="text"
                value={config.sumupMerchantCode || ''}
                onChange={(e) => onChange({ sumupMerchantCode: e.target.value })}
                className={inputClass}
                placeholder="z. B. MXXXXXXX"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Affiliate-Key</label>
              <input
                type="text"
                value={config.sumupAppId || ''}
                onChange={(e) => onChange({ sumupAppId: e.target.value })}
                className={inputClass}
                placeholder="aus dem SumUp-Entwicklerbereich"
              />
            </div>
          </div>
        </div>

        {/* VR-Pay */}
        <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-bold text-sm text-white">VR-Pay Me</span>
            <StatusBadge active={vrPayActive} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Terminal-ID</label>
            <input
              type="text"
              value={config.vrPayTerminalId || ''}
              onChange={(e) => onChange({ vrPayTerminalId: e.target.value })}
              className={inputClass}
              placeholder="aus der VR-Pay-Me-App"
            />
          </div>
        </div>

        {/* Sparkasse */}
        <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-bold text-sm text-white">Sparkasse / S-POS</span>
            <StatusBadge active={sparkasseActive} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Händler- bzw. Filial-ID
            </label>
            <input
              type="text"
              value={config.sparkasseMerchantId || ''}
              onChange={(e) => onChange({ sparkasseMerchantId: e.target.value })}
              className={inputClass}
              placeholder="aus dem S-POS-Vertrag"
            />
          </div>
        </div>

        {/* Zettle by PayPal */}
        <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-bold text-sm text-white">Zettle by PayPal</span>
            <StatusBadge active={true} />
          </div>
          <p className="text-xs text-slate-400">
            Zettle App-to-App benötigt keine statischen API-Keys. Die Zettle-App muss auf dem Gerät installiert sein.
          </p>
        </div>

        {/* Stripe Terminal / QR */}
        <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-bold text-sm text-white">Stripe Terminal / Hosted QR</span>
            <StatusBadge active={Boolean(config.stripeSecretKey)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Secret Key (Server)</label>
              <input
                type="password"
                value={config.stripeSecretKey || ''}
                onChange={(e) => onChange({ stripeSecretKey: e.target.value })}
                className={inputClass}
                placeholder="sk_live_... oder sk_test_..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Location / Reader ID</label>
              <input
                type="text"
                value={config.stripeLocationId || ''}
                onChange={(e) => onChange({ stripeLocationId: e.target.value })}
                className={inputClass}
                placeholder="tml_... (optional)"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------- ZVT */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-rose-400" />
            <h3 className="font-bold text-base text-white">EC-Terminal im Netzwerk (ZVT)</h3>
          </div>
          <StatusBadge active={zvtActive} />
        </div>
        <p className="text-xs text-slate-400 -mt-1">
          Für fest verbaute Terminals, die per Netzwerkkabel oder WLAN erreichbar sind. Die Kasse
          spricht direkt mit dem Gerät – ohne Umweg über eine App.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-300 mb-1">
              IP-Adresse des Terminals
            </label>
            <input
              type="text"
              value={config.zvtHost || ''}
              onChange={(e) => onChange({ zvtHost: e.target.value })}
              className={inputClass}
              placeholder="z. B. 192.168.1.50"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Port</label>
            <input
              type="number"
              value={config.zvtPort ?? 20007}
              onChange={(e) => onChange({ zvtPort: parseInt(e.target.value, 10) || 20007 })}
              className={inputClass}
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Terminal-Passwort (6 Stellen)
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={config.zvtPassword || ''}
              onChange={(e) => onChange({ zvtPassword: e.target.value.replace(/\D/g, '') })}
              className={inputClass}
              placeholder="000000"
            />
            <p className="text-xs text-slate-500 mt-1">
              Werkseinstellung ist meist 000000. Steht im Handbuch des Terminals.
            </p>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------- Rücksprung */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <Link2 className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-base text-white">Rücksprung-Adresse</h3>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1">Basis-URL der Kasse</label>
          <input
            type="text"
            value={config.baseUrl || ''}
            onChange={(e) => onChange({ baseUrl: e.target.value })}
            className={inputClass}
            placeholder="http://openbon.local:3000"
          />
          <p className="text-xs text-slate-500 mt-1">
            Über diese Adresse kehrt die Händler-App nach der Zahlung zur Kasse zurück. Sie wird
            außerdem für den QR-Code des digitalen Belegs verwendet. Muss aus dem WLAN der
            Veranstaltung erreichbar sein.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 text-slate-400">
        <CreditCard className="w-5 h-5 shrink-0 mt-0.5 text-slate-500" />
        <p className="text-xs leading-relaxed">
          Prüfen Sie jede eingerichtete Zahlart vor dem Fest mit einem Betrag von einem Cent. Ein
          Terminal, das erst am Abend nicht antwortet, kostet mehr Zeit als jede Voreinstellung.
        </p>
      </div>
    </div>
  );
}
