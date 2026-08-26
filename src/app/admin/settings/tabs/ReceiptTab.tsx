'use client';

import React, { useMemo, useState } from 'react';
import { Receipt, ToggleLeft, ToggleRight, Type, Utensils, Beer, Scissors } from 'lucide-react';
import type { EventConfigDTO } from '@/types/domain';

/**
 * Bonlayout mit Live-Vorschau.
 *
 * Diese Oberfläche ging bei der Modularisierung der Einstellungen verloren
 * (die alte Seite hatte 1465 Zeilen, die fünf neuen Tabs nur 620). Die Felder
 * existierten in Datenmodell und Schnittstelle weiter, waren aber nicht mehr
 * einstellbar. Hier sind alle 17 Bon-Felder wieder erreichbar – zusammen mit
 * der Vorschau, die jede Änderung sofort als 80-mm-Thermobon zeigt.
 */

interface ReceiptTabProps {
  config: EventConfigDTO;
  onChange: (updates: Partial<EventConfigDTO>) => void;
}

type PreviewKind = 'RECEIPT' | 'FOOD' | 'DRINK';

/** Ein Schalter im einheitlichen Stil der übrigen Tabs. */
function Toggle({
  label,
  hint,
  value,
  onToggle,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
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
          <ToggleRight className="w-10 h-10 text-emerald-400" />
        ) : (
          <ToggleLeft className="w-10 h-10 text-slate-600" />
        )}
      </button>
    </div>
  );
}

/** 42 Zeichen entsprechen einer 80-mm-Rolle bei Standardschrift. */
const WIDTH = 42;

function center(text: string): string {
  const t = text.slice(0, WIDTH);
  const pad = Math.max(0, Math.floor((WIDTH - t.length) / 2));
  return ' '.repeat(pad) + t;
}

function row(left: string, right: string): string {
  const l = left.slice(0, WIDTH - right.length - 1);
  return l + ' '.repeat(Math.max(1, WIDTH - l.length - right.length)) + right;
}

const LINE = '-'.repeat(WIDTH);

export function ReceiptTab({ config, onChange }: ReceiptTabProps) {
  const [preview, setPreview] = useState<PreviewKind>('RECEIPT');

  // Beispieldaten der Vorschau – bewusst fest, damit man Änderungen
  // am Layout und nicht an wechselnden Zahlen erkennt.
  const sample = {
    table: 'Tisch 7',
    waiter: 'Lisa',
    stamp: '24.08.2026, 19:42',
    items: [
      { qty: 2, name: 'Bratwurst mit Brot', option: 'ohne Senf', price: 7.0 },
      { qty: 1, name: 'Pommes groß', option: 'mit Mayo', price: 3.5 },
      { qty: 3, name: 'Helles 0,5 l', option: '', price: 12.0 },
    ],
  };

  const text = useMemo(() => {
    const lines: string[] = [];
    const isFood = preview === 'FOOD';
    const isDrink = preview === 'DRINK';
    const isReceipt = preview === 'RECEIPT';

    const showHeader = isReceipt
      ? true
      : isFood
      ? config.receiptFoodShowHeader !== false
      : config.receiptDrinkShowHeader !== false;
    const showTable = isReceipt
      ? config.receiptShowTable !== false
      : isFood
      ? config.receiptFoodShowTable !== false
      : config.receiptDrinkShowTable !== false;
    const showWaiter = isReceipt
      ? config.receiptShowWaiter !== false
      : isFood
      ? config.receiptFoodShowWaiter !== false
      : config.receiptDrinkShowWaiter !== false;
    const showStamp = isReceipt
      ? config.receiptShowTimestamp !== false
      : isFood
      ? config.receiptFoodShowTimestamp !== false
      : config.receiptDrinkShowTimestamp !== false;
    const showOptions = isReceipt ? true : isFood
      ? config.receiptFoodShowOptions !== false
      : config.receiptDrinkShowOptions !== false;

    const tpl = isReceipt
      ? (config.receiptTemplate || 'CLASSIC')
      : isFood
      ? (config.receiptFoodTemplate || 'CLASSIC')
      : (config.receiptDrinkTemplate || 'CLASSIC');

    const fs = Number(
      isReceipt
        ? (config.receiptTableFontSize ?? 3)
        : isFood
        ? (config.receiptFoodTableFontSize ?? 4)
        : (config.receiptDrinkTableFontSize ?? 4)
    );

    if (showHeader) {
      if (tpl === 'ECO') {
        lines.push(center(config.receiptHeader || config.name || 'OpenBon'));
      } else if (tpl === 'GASTRO') {
        lines.push(center(config.receiptHeader || config.name || 'OpenBon'));
        if (config.receiptSubHeader) lines.push(center(config.receiptSubHeader));
        lines.push(center('Musterstraße 1 · 12345 Musterstadt'));
        lines.push(center('St.-Nr: 123/456/78901 · USt-ID: DE123456789'));
        lines.push('');
      } else {
        lines.push(center(config.receiptHeader || config.name || 'OpenBon'));
        if (config.receiptSubHeader) lines.push(center(config.receiptSubHeader));
        lines.push('');
      }
    }

    if (!isReceipt) {
      if (tpl === 'HIGH_VISIBILITY') {
        lines.push(center(isFood ? '==========================================' : '=========================================='));
        lines.push(center(isFood ? '*** KÜCHENAUFTRAG (SOFORT) ***' : '*** AUSSCHANK / THEKE ***'));
        lines.push(center(isFood ? '==========================================' : '=========================================='));
      } else {
        lines.push(center(isFood ? '*** KÜCHE ***' : '*** AUSSCHANK ***'));
      }
      lines.push('');
    }

    if (showTable) {
      if (fs >= 5 || tpl === 'HIGH_VISIBILITY') {
        lines.push(center(`[ === ${sample.table.toUpperCase()} === ]`));
      } else if (fs >= 4) {
        lines.push(`>> ${sample.table.toUpperCase()} <<`);
      } else {
        lines.push(row(sample.table, ''));
      }
    }
    if (showWaiter) lines.push(row('Bedienung', sample.waiter));
    if (showStamp) lines.push(row('Zeit', sample.stamp));
    if (showTable || showWaiter || showStamp) lines.push(LINE);

    const visible = isFood
      ? sample.items.filter((i) => !i.name.includes('Helles'))
      : isDrink
      ? sample.items.filter((i) => i.name.includes('Helles'))
      : sample.items;

    for (const item of visible) {
      if (isReceipt) {
        if (tpl === 'GASTRO') {
          lines.push(row(`${item.qty}x ${item.name}`, item.price.toFixed(2)));
          lines.push(`   (Einzelpreis: ${(item.price / item.qty).toFixed(2)} € | MwSt: 19%)`);
        } else {
          lines.push(row(`${item.qty}x ${item.name}`, item.price.toFixed(2)));
        }
      } else {
        if (tpl === 'HIGH_VISIBILITY') {
          lines.push(`-> ${item.qty}x ${item.name.toUpperCase()}`);
        } else {
          lines.push(`${item.qty}x ${item.name}`);
        }
      }
      if (showOptions && item.option) {
        lines.push(tpl === 'HIGH_VISIBILITY' ? `   *** WUNSCH: ${item.option.toUpperCase()} ***` : `     > ${item.option}`);
      }
    }

    if (isReceipt) {
      const total = visible.reduce((s, i) => s + i.price, 0);
      lines.push(LINE);
      if (tpl === 'HIGH_VISIBILITY') {
        lines.push(center(`##########################################`));
        lines.push(center(`   GESAMTSUMME: ${total.toFixed(2)} ${config.currency || 'EUR'}   `));
        lines.push(center(`##########################################`));
      } else {
        lines.push(row('SUMME', `${total.toFixed(2)} ${config.currency || 'EUR'}`));
      }
      if (config.enableTax) {
        const net = total / (1 + (config.taxRateNormal || 19) / 100);
        lines.push(row(`darin MwSt ${config.taxRateNormal || 19}%`, (total - net).toFixed(2)));
      }
      if (config.receiptShowTse !== false) {
        lines.push('');
        lines.push('TSE-Signatur:');
        lines.push('A1B2-C3D4-E5F6-7890');
      }
      if (tpl === 'GASTRO') {
        lines.push('');
        lines.push('--- BEWIRTUNGSBELEG (§ 4 Abs. 5 EStG) ---');
        lines.push('Bewirtete Personen: _____________________');
        lines.push('Anlass: _________________________________');
        lines.push('Trinkgeld: ____________ € Datum: ________');
        lines.push('Unterschrift: ___________________________');
      }
      if (config.receiptFooterText) {
        lines.push('');
        lines.push(center(config.receiptFooterText));
      }
    }

    return lines.join('\n');
  }, [config, preview]);

  const singleSlipHint =
    preview === 'FOOD'
      ? config.receiptSingleItemFoodSlips !== false
      : preview === 'DRINK'
      ? config.receiptSingleItemDrinkSlips !== false
      : false;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* ------------------------------------------------ Einstellungen */}
        <div className="xl:col-span-3 space-y-6">
          {/* Kopf- und Fußzeilen */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <Type className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-base text-white">Kopf- und Fußzeile</h3>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Kopfzeile</label>
              <input
                type="text"
                value={config.receiptHeader || ''}
                onChange={(e) => onChange({ receiptHeader: e.target.value })}
                className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-medium focus:border-blue-500"
                placeholder="z. B. Feuerwehrfest 2026"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Unterzeile</label>
              <input
                type="text"
                value={config.receiptSubHeader || ''}
                onChange={(e) => onChange({ receiptSubHeader: e.target.value })}
                className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-medium focus:border-blue-500"
                placeholder="z. B. Freiwillige Feuerwehr Musterstadt e.V."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Fußzeile</label>
              <input
                type="text"
                value={config.receiptFooterText || ''}
                onChange={(e) => onChange({ receiptFooterText: e.target.value })}
                className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-medium focus:border-blue-500"
                placeholder="z. B. Vielen Dank für Ihren Besuch!"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Schriftgröße Tischnummer auf Bons: Stufe {config.receiptTableFontSize ?? 3}
              </label>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={config.receiptTableFontSize ?? 3}
                onChange={(e) => onChange({ receiptTableFontSize: parseInt(e.target.value, 10) })}
                className="w-full accent-blue-500"
              />
              <p className="text-xs text-slate-500">
                Stufe 5 druckt die Tischnummer so groß, dass sie im Küchendurchgang aus einem Meter
                Entfernung lesbar ist.
              </p>
            </div>
          </div>

          {/* Kassenbeleg */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base text-white">Kassenbeleg für den Gast</h3>
              </div>
            </div>

            {/* Template Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Design-Vorlage (Kassenbeleg)</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'CLASSIC', label: 'Klassisch' },
                  { id: 'ECO', label: 'Kompakt (Eco)' },
                  { id: 'HIGH_VISIBILITY', label: 'Großschrift' },
                  { id: 'GASTRO', label: 'Gastro Detail' },
                ].map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => onChange({ receiptTemplate: tpl.id })}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition border ${
                      (config.receiptTemplate || 'CLASSIC') === tpl.id
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-300">
                  Schriftgröße Tischnummer (Kassenbeleg): {config.receiptTableFontSize ?? 3}×
                </label>
                <span className="text-[11px] font-mono text-emerald-400">
                  {Number(config.receiptTableFontSize ?? 3) >= 5 ? 'Invertiert (Weiß auf Schwarz)' : 'Standard'}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={config.receiptTableFontSize ?? 3}
                onChange={(e) => onChange({ receiptTableFontSize: parseInt(e.target.value, 10) })}
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                <span>1× Fein</span>
                <span>3× Mittel</span>
                <span>5× Invertiert</span>
                <span>8× Riesig</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <Toggle
                label="Tischnummer drucken"
                value={config.receiptShowTable !== false}
                onToggle={() => onChange({ receiptShowTable: !(config.receiptShowTable !== false) })}
              />
              <Toggle
                label="Bedienung drucken"
                value={config.receiptShowWaiter !== false}
                onToggle={() => onChange({ receiptShowWaiter: !(config.receiptShowWaiter !== false) })}
              />
              <Toggle
                label="Datum und Uhrzeit"
                value={config.receiptShowTimestamp !== false}
                onToggle={() =>
                  onChange({ receiptShowTimestamp: !(config.receiptShowTimestamp !== false) })
                }
              />
              <Toggle
                label="TSE-Signatur"
                hint="Bei Kassenpflicht vorgeschrieben."
                value={config.receiptShowTse !== false}
                onToggle={() => onChange({ receiptShowTse: !(config.receiptShowTse !== false) })}
              />
            </div>
          </div>

          {/* Speisen-Bon */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <Utensils className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base text-white">Speisen-Bon (Küche)</h3>
              </div>
            </div>

            {/* Template Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Design-Vorlage (Speisen-Bon)</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'CLASSIC', label: 'Klassisch' },
                  { id: 'ECO', label: 'Kompakt (Eco)' },
                  { id: 'HIGH_VISIBILITY', label: 'Großschrift' },
                  { id: 'GASTRO', label: 'Gastro Detail' },
                ].map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => onChange({ receiptFoodTemplate: tpl.id })}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition border ${
                      (config.receiptFoodTemplate || 'CLASSIC') === tpl.id
                        ? 'bg-amber-600 text-white border-amber-500 shadow'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-300">
                  Schriftgröße Tischnummer (Speisen): {config.receiptFoodTableFontSize ?? 4}×
                </label>
                <span className="text-[11px] font-mono text-amber-400">
                  {Number(config.receiptFoodTableFontSize ?? 4) >= 5 ? 'Invertiert (Weiß auf Schwarz)' : 'Groß'}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={config.receiptFoodTableFontSize ?? 4}
                onChange={(e) => onChange({ receiptFoodTableFontSize: parseInt(e.target.value, 10) })}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                <span>1× Klein</span>
                <span>4× Groß</span>
                <span>6× Riesig</span>
                <span>8× Maximal</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <Toggle
                label="Kopfzeile"
                value={config.receiptFoodShowHeader !== false}
                onToggle={() =>
                  onChange({ receiptFoodShowHeader: !(config.receiptFoodShowHeader !== false) })
                }
              />
              <Toggle
                label="Tischnummer"
                value={config.receiptFoodShowTable !== false}
                onToggle={() =>
                  onChange({ receiptFoodShowTable: !(config.receiptFoodShowTable !== false) })
                }
              />
              <Toggle
                label="Bedienung"
                value={config.receiptFoodShowWaiter !== false}
                onToggle={() =>
                  onChange({ receiptFoodShowWaiter: !(config.receiptFoodShowWaiter !== false) })
                }
              />
              <Toggle
                label="Uhrzeit"
                value={config.receiptFoodShowTimestamp !== false}
                onToggle={() =>
                  onChange({ receiptFoodShowTimestamp: !(config.receiptFoodShowTimestamp !== false) })
                }
              />
              <Toggle
                label="Zusatzwünsche"
                hint="„ohne Zwiebeln“, Beilagenwahl usw."
                value={config.receiptFoodShowOptions !== false}
                onToggle={() =>
                  onChange({ receiptFoodShowOptions: !(config.receiptFoodShowOptions !== false) })
                }
              />
              <Toggle
                label="Einzelbon je Position"
                hint="Jede Speise bekommt einen eigenen Zettel."
                value={config.receiptSingleItemFoodSlips !== false}
                onToggle={() =>
                  onChange({
                    receiptSingleItemFoodSlips: !(config.receiptSingleItemFoodSlips !== false),
                  })
                }
              />
            </div>
          </div>

          {/* Getränke-Bon */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <Beer className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-base text-white">Getränke-Bon (Ausschank)</h3>
              </div>
            </div>

            {/* Template Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Design-Vorlage (Getränke-Bon)</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'CLASSIC', label: 'Klassisch' },
                  { id: 'ECO', label: 'Kompakt (Eco)' },
                  { id: 'HIGH_VISIBILITY', label: 'Großschrift' },
                  { id: 'GASTRO', label: 'Gastro Detail' },
                ].map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => onChange({ receiptDrinkTemplate: tpl.id })}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition border ${
                      (config.receiptDrinkTemplate || 'CLASSIC') === tpl.id
                        ? 'bg-sky-600 text-white border-sky-500 shadow'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-300">
                  Schriftgröße Tischnummer (Getränke): {config.receiptDrinkTableFontSize ?? 4}×
                </label>
                <span className="text-[11px] font-mono text-sky-400">
                  {Number(config.receiptDrinkTableFontSize ?? 4) >= 5 ? 'Invertiert (Weiß auf Schwarz)' : 'Groß'}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={config.receiptDrinkTableFontSize ?? 4}
                onChange={(e) => onChange({ receiptDrinkTableFontSize: parseInt(e.target.value, 10) })}
                className="w-full accent-sky-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                <span>1× Klein</span>
                <span>4× Groß</span>
                <span>6× Riesig</span>
                <span>8× Maximal</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <Toggle
                label="Kopfzeile"
                value={config.receiptDrinkShowHeader !== false}
                onToggle={() =>
                  onChange({ receiptDrinkShowHeader: !(config.receiptDrinkShowHeader !== false) })
                }
              />
              <Toggle
                label="Tischnummer"
                value={config.receiptDrinkShowTable !== false}
                onToggle={() =>
                  onChange({ receiptDrinkShowTable: !(config.receiptDrinkShowTable !== false) })
                }
              />
              <Toggle
                label="Bedienung"
                value={config.receiptDrinkShowWaiter !== false}
                onToggle={() =>
                  onChange({ receiptDrinkShowWaiter: !(config.receiptDrinkShowWaiter !== false) })
                }
              />
              <Toggle
                label="Uhrzeit"
                value={config.receiptDrinkShowTimestamp !== false}
                onToggle={() =>
                  onChange({
                    receiptDrinkShowTimestamp: !(config.receiptDrinkShowTimestamp !== false),
                  })
                }
              />
              <Toggle
                label="Zusatzwünsche"
                value={config.receiptDrinkShowOptions !== false}
                onToggle={() =>
                  onChange({ receiptDrinkShowOptions: !(config.receiptDrinkShowOptions !== false) })
                }
              />
              <Toggle
                label="Einzelbon je Position"
                hint="Jedes Getränk bekommt einen eigenen Zettel."
                value={config.receiptSingleItemDrinkSlips !== false}
                onToggle={() =>
                  onChange({
                    receiptSingleItemDrinkSlips: !(config.receiptSingleItemDrinkSlips !== false),
                  })
                }
              />
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------ Vorschau */}
        <div className="xl:col-span-2">
          <div className="xl:sticky xl:top-4 space-y-3">
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-2xl p-1.5">
              {([
                { id: 'RECEIPT', label: 'Kassenbeleg' },
                { id: 'FOOD', label: 'Speisen-Bon' },
                { id: 'DRINK', label: 'Getränke-Bon' },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPreview(tab.id)}
                  className={`flex-1 min-h-[40px] px-2 rounded-xl text-xs font-bold transition ${
                    preview === tab.id
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Papierstreifen */}
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-4 shadow-xl">
              <div className="flex items-center justify-between mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <span>Vorschau · 80 mm</span>
                <span className="flex items-center gap-1">
                  <Scissors className="w-3 h-3" />
                  42 Zeichen
                </span>
              </div>
              <div className="bg-white text-slate-950 rounded-xl border-y-4 border-dashed border-slate-400 p-3 overflow-x-auto">
                <pre className="font-mono text-[11px] leading-[1.45] whitespace-pre">{text}</pre>
              </div>
              {singleSlipHint ? (
                <p className="mt-2 text-[11px] text-amber-300 font-bold">
                  Einzelbon aktiv: Jede Position wird als eigener Zettel gedruckt – die Vorschau
                  zeigt sie der Übersicht halber zusammen.
                </p>
              ) : null}
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Die Vorschau bildet das Layout ab, nicht die exakte Druckbreite Ihres Geräts. Bei
              58-mm-Rollen bricht der Text entsprechend früher um.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
