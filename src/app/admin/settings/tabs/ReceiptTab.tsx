'use client';

import React, { useMemo, useState } from 'react';
import {
  Receipt,
  Smartphone,
  Globe,
  Wifi,
  WifiOff,
  QrCode,
  Download,
  ToggleLeft,
  ToggleRight,
  Type,
  Utensils,
  Beer,
  Scissors,
  Sliders,
  AlertCircle,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import type { EventConfigDTO } from '@/types/domain';

interface ReceiptTabProps {
  config: EventConfigDTO;
  onChange: (updates: Partial<EventConfigDTO>) => void;
}

type PreviewKind = 'RECEIPT' | 'FOOD' | 'DRINK' | 'EBON';

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

/** 10-Stufen Schriftgrößen-Slider */
function FontSizeSlider({
  label,
  value,
  onChange,
  color = 'emerald',
}: {
  label: string;
  value?: number | string | null;
  onChange: (v: number) => void;
  color?: 'emerald' | 'amber' | 'sky' | 'blue';
}) {
  const numVal = Math.min(
    10,
    Math.max(1, typeof value === 'number' ? value : parseInt(String(value || 3), 10) || 3)
  );

  const accentClass =
    color === 'amber'
      ? 'accent-amber-500'
      : color === 'sky'
      ? 'accent-sky-500'
      : color === 'blue'
      ? 'accent-blue-500'
      : 'accent-emerald-500';

  const badgeColor =
    color === 'amber'
      ? 'text-amber-400'
      : color === 'sky'
      ? 'text-sky-400'
      : color === 'blue'
      ? 'text-blue-400'
      : 'text-emerald-400';

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs font-bold text-slate-300">
        <span>{label}</span>
        <span className={`font-mono text-[11px] ${badgeColor}`}>
          Stufe {numVal} / 10 {numVal >= 8 ? '(Sehr groß)' : numVal >= 5 ? '(Groß)' : '(Standard)'}
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={numVal}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className={`w-full ${accentClass}`}
      />
      <div className="flex justify-between text-[9px] text-slate-500 font-mono">
        <span>1: Fein</span>
        <span>3: Normal</span>
        <span>5: Groß</span>
        <span>8: Extra-Groß</span>
        <span>10: Maximal</span>
      </div>
    </div>
  );
}

export function ReceiptTab({ config, onChange }: ReceiptTabProps) {
  const [preview, setPreview] = useState<PreviewKind>('RECEIPT');
  const [paperWidth, setPaperWidth] = useState<80 | 58>(80);

  // Gastro-Pflichtdaten prüfen
  const hasGastroData = Boolean(
    config.addressStreet?.trim() &&
    config.addressCity?.trim() &&
    (config.taxNumber?.trim() || config.vatId?.trim())
  );

  // Beispieldaten der Vorschau
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

  const widthCols = paperWidth === 58 ? 32 : 42;

  const center = (text: string) => {
    const t = text.slice(0, widthCols);
    const pad = Math.max(0, Math.floor((widthCols - t.length) / 2));
    return ' '.repeat(pad) + t;
  };

  const row = (left: string, right: string) => {
    const l = left.slice(0, widthCols - right.length - 1);
    return l + ' '.repeat(Math.max(1, widthCols - l.length - right.length)) + right;
  };

  const LINE = '-'.repeat(widthCols);
  const DBL_LINE = '='.repeat(widthCols);

  const previewContent = useMemo(() => {
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

    const showOptions = isReceipt
      ? true
      : isFood
      ? config.receiptFoodShowOptions !== false
      : config.receiptDrinkShowOptions !== false;

    const tpl = isReceipt
      ? config.receiptTemplate || 'CLASSIC'
      : isFood
      ? config.receiptFoodTemplate || 'CLASSIC'
      : config.receiptDrinkTemplate || 'CLASSIC';

    const tableFs = Number(
      isReceipt
        ? config.receiptTableFontSize ?? 3
        : isFood
        ? config.receiptFoodTableFontSize ?? 4
        : config.receiptDrinkTableFontSize ?? 4
    );

    const itemFs = Number(
      isReceipt
        ? config.receiptItemFontSize ?? 2
        : isFood
        ? config.receiptFoodItemFontSize ?? 3
        : config.receiptDrinkItemFontSize ?? 3
    );

    const optionsFs = Number(
      isReceipt
        ? config.receiptOptionsFontSize ?? 1
        : isFood
        ? config.receiptFoodOptionsFontSize ?? 1
        : config.receiptDrinkOptionsFontSize ?? 1
    );

    const headerLines: string[] = [];

    // 1. Kopfzeilen-Hierarchie:
    // Zeile 1: Name der Veranstaltung
    // Zeile 2: Veranstalter / Organisation
    // Zeile 3: Zusatztext Kopfzeile
    if (showHeader) {
      const eventName = config.name || 'Veranstaltung 2026';
      const organizer = config.receiptSubHeader || '';
      const customHeader = config.receiptHeader || '';

      headerLines.push(center(eventName.toUpperCase()));
      if (organizer) headerLines.push(center(organizer));
      if (customHeader) headerLines.push(center(customHeader));

      if (tpl === 'GASTRO') {
        const street = config.addressStreet || 'Musterstraße 1';
        const city = config.addressCity || '12345 Musterstadt';
        const tax = config.taxNumber ? `St.-Nr: ${config.taxNumber}` : '';
        const vat = config.vatId ? `USt-ID: ${config.vatId}` : '';
        headerLines.push(center(`${street} · ${city}`));
        const taxLine = [tax, vat].filter(Boolean).join(' · ');
        if (taxLine) headerLines.push(center(taxLine));
      }
      headerLines.push('');
    }

    // 2. Tischnummer
    const tableText = showTable ? 'Tisch 7' : null;

    // 3. Metadaten
    const metaLines: string[] = [];
    if (tpl === 'ECO') {
      if (showWaiter && showStamp) {
        metaLines.push(row(sample.waiter, sample.stamp));
      } else if (showWaiter) {
        metaLines.push(row('Bedienung:', sample.waiter));
      } else if (showStamp) {
        metaLines.push(row('Zeit:', sample.stamp));
      }
      if (showTable || showWaiter || showStamp) metaLines.push(LINE);
    } else {
      if (showWaiter) metaLines.push(row('Bedienung:', sample.waiter));
      if (showStamp) metaLines.push(row('Uhrzeit:', sample.stamp));
      if (showTable || showWaiter || showStamp) metaLines.push(LINE);
    }

    // 4. Positionen
    const visible = isFood
      ? sample.items.filter((i) => !i.name.includes('Helles'))
      : isDrink
      ? sample.items.filter((i) => i.name.includes('Helles'))
      : sample.items;

    const formattedItems: {
      qty: number;
      name: string;
      priceStr: string;
      subText?: string;
      optionText?: string;
    }[] = [];

    const itemLines: string[] = [];

    for (const item of visible) {
      const priceFormatted = item.price.toFixed(2);
      let subText: string | undefined;
      let optionText: string | undefined;

      if (isReceipt) {
        if (tpl === 'GASTRO') {
          itemLines.push(row(`${item.qty}x ${item.name}`, priceFormatted));
          subText = `(Einzelpreis: ${(item.price / item.qty).toFixed(2)} € | MwSt: 19%)`;
          itemLines.push(`   ${subText}`);
        } else {
          itemLines.push(row(`${item.qty}x ${item.name}`, priceFormatted));
        }
      } else {
        if (tpl === 'HIGH_VISIBILITY') {
          itemLines.push(`-> ${item.qty}x ${item.name.toUpperCase()}`);
        } else {
          itemLines.push(`${item.qty}x ${item.name}`);
        }
      }

      if (showOptions && item.option) {
        optionText = tpl === 'HIGH_VISIBILITY' ? `! WUNSCH: ${item.option.toUpperCase()}` : `> ${item.option}`;
        itemLines.push(`   ${optionText}`);
      }

      formattedItems.push({
        qty: item.qty,
        name: isReceipt || tpl !== 'HIGH_VISIBILITY' ? item.name : item.name.toUpperCase(),
        priceStr: isReceipt ? `${priceFormatted} €` : '',
        subText,
        optionText,
      });
    }

    // 5. Gesamtsumme & Fußzeile
    const footerLines: string[] = [];
    if (isReceipt) {
      const total = visible.reduce((s, i) => s + i.price, 0);
      footerLines.push(LINE);
      if (tpl === 'HIGH_VISIBILITY') {
        footerLines.push(center(`GESAMTBETRAG: ${total.toFixed(2)} ${config.currency || 'EUR'}`));
        footerLines.push(center(DBL_LINE));
      } else {
        footerLines.push(row('GESAMTSUMME', `${total.toFixed(2)} ${config.currency || 'EUR'}`));
      }

      if (config.enableTax) {
        const net = total / (1 + (config.taxRateNormal || 19) / 100);
        footerLines.push(row(`darin MwSt ${config.taxRateNormal || 19}%`, (total - net).toFixed(2)));
      }

      if (config.receiptShowTse !== false) {
        footerLines.push('');
        footerLines.push('TSE-Signatur:');
        footerLines.push('A1B2-C3D4-E5F6-7890');
      }

      if (tpl === 'GASTRO') {
        footerLines.push('');
        footerLines.push('--- BEWIRTUNGSBELEG (§ 4 Abs. 5 EStG) ---');
        footerLines.push('Bewirtete Personen: _____________________');
        footerLines.push('Anlass: _________________________________');
        footerLines.push('Trinkgeld: ____________ € Datum: ________');
        footerLines.push('Unterschrift: ___________________________');
      }

      if (config.receiptFooterText) {
        footerLines.push('');
        footerLines.push(center(config.receiptFooterText));
      }
    }

    const fullLines: string[] = [
      ...headerLines,
      ...(tableText ? [center(tableText), ''] : []),
      ...metaLines,
      ...itemLines,
      ...footerLines,
    ];

    return {
      text: fullLines.join('\n'),
      headerLines,
      tableText,
      metaLines,
      items: formattedItems,
      footerLines,
      tableFs,
      itemFs,
      optionsFs,
      tpl,
    };
  }, [config, preview, paperWidth, widthCols]);

  const singleSlipHint =
    preview === 'FOOD'
      ? config.receiptSingleItemFoodSlips !== false
      : preview === 'DRINK'
      ? config.receiptSingleItemDrinkSlips !== false
      : false;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* ------------------------------------------------ Einstellungen (Links) */}
        <div className="xl:col-span-3 space-y-6">
          {/* Kopf- und Fußzeilen */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <Type className="w-5 h-5 text-blue-400" />
              <div>
                <h3 className="font-bold text-base text-white">Kopf- und Fußzeile</h3>
                <p className="text-xs text-slate-400">
                  Name und Veranstalter werden automatisch aus „Allgemein“ übernommen.
                </p>
              </div>
            </div>

            {/* Automatische Vorschau der übernommenen Felder */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">1. Kopfzeile (Name der Veranstaltung):</span>
                <span className="font-bold text-white">{config.name || 'Vereinsfest 2026'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">2. Kopfzeile (Veranstalter / Verein):</span>
                <span className="font-bold text-white">{config.receiptSubHeader || '– (In Allgemein festlegen)'}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Zusatztext Kopfzeile (3. Zeile, optional)
              </label>
              <input
                type="text"
                value={config.receiptHeader || ''}
                onChange={(e) => onChange({ receiptHeader: e.target.value })}
                className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-medium focus:border-blue-500"
                placeholder="z. B. Herzlich Willkommen! (Standard: leer)"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Fußzeile (Abschluss des Belegs)
              </label>
              <input
                type="text"
                value={config.receiptFooterText || ''}
                onChange={(e) => onChange({ receiptFooterText: e.target.value })}
                className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-medium focus:border-blue-500"
                placeholder="z. B. Vielen Dank für Ihren Besuch! (Standard: leer)"
              />
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
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Design-Vorlage (Kassenbeleg)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'CLASSIC', label: 'Klassisch', reqGastro: false },
                  { id: 'ECO', label: 'Kompakt (Eco)', reqGastro: false },
                  { id: 'HIGH_VISIBILITY', label: 'Großschrift', reqGastro: false },
                  { id: 'GASTRO', label: 'Gastro Detail', reqGastro: true },
                ].map((tpl) => {
                  const isDisabled = tpl.reqGastro && !hasGastroData;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => onChange({ receiptTemplate: tpl.id })}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition border relative ${
                        (config.receiptTemplate || 'CLASSIC') === tpl.id
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                          : isDisabled
                          ? 'bg-slate-950/40 text-slate-600 border-slate-800/60 cursor-not-allowed'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                      title={isDisabled ? 'Zuerst Adress- & Steuerdaten im Reiter Allgemein hinterlegen' : ''}
                    >
                      <span>{tpl.label}</span>
                      {isDisabled && (
                        <Lock className="w-3 h-3 absolute top-1.5 right-1.5 text-slate-500" />
                      )}
                    </button>
                  );
                })}
              </div>
              {!hasGastroData && (
                <p className="text-[11px] text-amber-400 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Gastro Detail ist erst wählbar, sobald Adresse &amp; Steuernummer in „Allgemein“ hinterlegt sind.
                </p>
              )}
            </div>

            {/* Schriftgrößen-Slider (10 Stufen) */}
            <div className="space-y-3 pt-2 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <FontSizeSlider
                label="Schriftgröße Tischnummer (Zentriert)"
                value={config.receiptTableFontSize ?? 3}
                onChange={(v) => onChange({ receiptTableFontSize: v })}
                color="emerald"
              />
              <FontSizeSlider
                label="Schriftgröße Artikel &amp; Menge"
                value={config.receiptItemFontSize ?? 2}
                onChange={(v) => onChange({ receiptItemFontSize: v })}
                color="emerald"
              />
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
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Design-Vorlage (Speisen-Bon)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'CLASSIC', label: 'Klassisch' },
                  { id: 'ECO', label: 'Kompakt (Eco)' },
                  { id: 'HIGH_VISIBILITY', label: 'Großschrift' },
                  { id: 'GASTRO', label: 'Gastro Detail', requiresGastro: true },
                ].map((tpl) => {
                  const isDisabled = tpl.requiresGastro && !hasGastroData;
                  const isSelected = (config.receiptFoodTemplate || 'CLASSIC') === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => !isDisabled && onChange({ receiptFoodTemplate: tpl.id })}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition border ${
                        isSelected
                          ? 'bg-amber-600 text-white border-amber-500 shadow'
                          : isDisabled
                          ? 'bg-slate-950/40 text-slate-600 border-slate-900 cursor-not-allowed opacity-50'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                      title={isDisabled ? 'Erfordert Steuer-/Adressdaten unter Organisation' : undefined}
                    >
                      {tpl.label}
                    </button>
                  );
                })}
              </div>
              {!hasGastroData && (
                <p className="text-[10px] text-amber-500/80 mt-1">
                  * Gastro Detail erfordert Anschrift &amp; Steuernummer unter &bdquo;Veranstaltung &amp; Organisation&ldquo;.
                </p>
              )}
            </div>

            {/* Schriftgrößen-Slider (10 Stufen) */}
            <div className="space-y-3 pt-2 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <FontSizeSlider
                label="Schriftgröße Tischnummer (Küche)"
                value={config.receiptFoodTableFontSize ?? 4}
                onChange={(v) => onChange({ receiptFoodTableFontSize: v })}
                color="amber"
              />
              <FontSizeSlider
                label="Schriftgröße Speisen &amp; Menge"
                value={config.receiptFoodItemFontSize ?? 3}
                onChange={(v) => onChange({ receiptFoodItemFontSize: v })}
                color="amber"
              />
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


          {/* Digitaler E-Bon (Smartphone) & Gast-QR */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="font-bold text-base text-white">Digitaler E-Bon (§ 33 KassenSichV)</h3>
                  <p className="text-xs text-slate-400">Papierloser Belegabruf über QR-Code auf Smartphone</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-bold text-slate-300">
                {typeof window !== 'undefined' && navigator.onLine ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Internet Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-400">Fest-WLAN / Offline</span>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Toggle
                label="Digitalen E-Bon aktivieren"
                hint="Erzeugt bei jedem Kassiervorgang einen kryptografisch sicheren Online-Belegabruf."
                value={Boolean(config.enableDigitalReceipt)}
                onToggle={() => onChange({ enableDigitalReceipt: !config.enableDigitalReceipt })}
              />

              <Toggle
                label="QR-Code für digitalen Beleg auf Papierbon drucken"
                hint="Druckt den E-Bon-Link als scanbaren QR-Code auf den Gast-Kassenbeleg."
                value={Boolean(config.enableDigitalReceiptQr)}
                onToggle={() => onChange({ enableDigitalReceiptQr: !config.enableDigitalReceiptQr })}
              />

              <Toggle
                label="E-Bon per NFC (Near Field Communication)"
                hint="Ermöglicht das direkte Übertragen des Beleg-Links per Smartphone-NFC an den Gast."
                value={Boolean(config.enableNfc)}
                onToggle={() => onChange({ enableNfc: !config.enableNfc })}
              />

              {config.enableNfc && (
                <div className="pl-4 border-l-2 border-emerald-500/40 space-y-2 pt-1">
                  <Toggle
                    label="NFC auf Kellner-Handys"
                    hint="Kellner können E-Bons per Smartphone-NFC an Gäste übertragen."
                    value={config.enableNfcWaiter !== false}
                    onToggle={() => onChange({ enableNfcWaiter: !(config.enableNfcWaiter !== false) })}
                  />
                  <Toggle
                    label="NFC an der Bonkasse"
                    hint="Thekenkasse bietet NFC-Belegübertragung an."
                    value={config.enableNfcPos !== false}
                    onToggle={() => onChange({ enableNfcPos: !(config.enableNfcPos !== false) })}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Öffentliche Basis-URL für E-Bons (z. B. Cloudflare Tunnel, DynDNS oder Fest-Domain)
                </label>
                <div className="flex items-center gap-2">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-500">
                    <Globe className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={config.baseUrl || ''}
                    onChange={(e) => onChange({ baseUrl: e.target.value })}
                    placeholder="https://bon.mein-fest.de oder http://192.168.1.100:3000"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs font-mono font-bold focus:border-indigo-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  Damit Gäste den Beleg mit Mobilfunk (LTE/5G) öffnen können, trage hier die öffentlich erreichbare Adresse ein (z. B. via kostenlosem Cloudflare Tunnel oder DynDNS). Im reinen Festzelt-WLAN reicht die lokale IP oder &bdquo;http://openbon.local&ldquo;.
                </p>
              </div>
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
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Design-Vorlage (Getränke-Bon)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'CLASSIC', label: 'Klassisch' },
                  { id: 'ECO', label: 'Kompakt (Eco)' },
                  { id: 'HIGH_VISIBILITY', label: 'Großschrift' },
                  { id: 'GASTRO', label: 'Gastro Detail', requiresGastro: true },
                ].map((tpl) => {
                  const isDisabled = tpl.requiresGastro && !hasGastroData;
                  const isSelected = (config.receiptDrinkTemplate || 'CLASSIC') === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => !isDisabled && onChange({ receiptDrinkTemplate: tpl.id })}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition border ${
                        isSelected
                          ? 'bg-sky-600 text-white border-sky-500 shadow'
                          : isDisabled
                          ? 'bg-slate-950/40 text-slate-600 border-slate-900 cursor-not-allowed opacity-50'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                      title={isDisabled ? 'Erfordert Steuer-/Adressdaten unter Organisation' : undefined}
                    >
                      {tpl.label}
                    </button>
                  );
                })}
              </div>
              {!hasGastroData && (
                <p className="text-[10px] text-sky-400/80 mt-1">
                  * Gastro Detail erfordert Anschrift &amp; Steuernummer unter &bdquo;Veranstaltung &amp; Organisation&ldquo;.
                </p>
              )}
            </div>

            {/* Schriftgrößen-Slider (10 Stufen) */}
            <div className="space-y-3 pt-2 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <FontSizeSlider
                label="Schriftgröße Tischnummer (Ausschank)"
                value={config.receiptDrinkTableFontSize ?? 4}
                onChange={(v) => onChange({ receiptDrinkTableFontSize: v })}
                color="sky"
              />
              <FontSizeSlider
                label="Schriftgröße Getränke &amp; Menge"
                value={config.receiptDrinkItemFontSize ?? 3}
                onChange={(v) => onChange({ receiptDrinkItemFontSize: v })}
                color="sky"
              />
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

        {/* ------------------------------------------------------ Vorschau (Rechts) */}
        <div className="xl:col-span-2">
          <div className="xl:sticky xl:top-4 space-y-3">
            {/* Bon-Typ Umschalter */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-2xl p-1.5">
              {([
                { id: 'RECEIPT', label: 'Kassenbeleg' },
                { id: 'FOOD', label: 'Speisen-Bon' },
                { id: 'DRINK', label: 'Getränke-Bon' },
                { id: 'EBON', label: 'Digitaler E-Bon' },
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

            {/* Breiten-Umschalter 80mm vs 58mm */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border border-slate-800 rounded-2xl text-xs">
              <span className="font-bold text-slate-300">Papierbreite:</span>
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setPaperWidth(80)}
                  className={`px-3 py-1 rounded-lg font-bold transition ${
                    paperWidth === 80
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  80 mm (Standard)
                </button>
                <button
                  type="button"
                  onClick={() => setPaperWidth(58)}
                  className={`px-3 py-1 rounded-lg font-bold transition ${
                    paperWidth === 58
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  58 mm (Schmal)
                </button>
              </div>
            </div>

            {/* Papierstreifen Live-Vorschau oder E-Bon Smartphone Simulator */}
            {preview === 'EBON' ? (
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-4 shadow-xl flex flex-col items-center">
                <div className="flex items-center justify-between w-full mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Smartphone-Ansicht für Gäste</span>
                  </span>
                  <span className="text-emerald-400 font-mono">/receipt/REC-8K92X</span>
                </div>

                {/* Smartphone Device Frame */}
                <div className="w-[300px] bg-slate-900 border-4 border-slate-800 rounded-[2.5rem] p-3 shadow-2xl space-y-3 font-sans">
                  {/* Notch / Speaker */}
                  <div className="w-24 h-4 bg-slate-950 rounded-full mx-auto mb-2 flex items-center justify-center">
                    <div className="w-8 h-1 bg-slate-800 rounded-full" />
                  </div>

                  {/* Mobile Screen Content */}
                  <div className="bg-white text-slate-950 rounded-2xl p-4 shadow-inner space-y-3 text-left">
                    <div className="text-center border-b border-slate-200 pb-2">
                      <div className="font-black text-sm text-slate-950 uppercase">{config.name || 'Vereinsfest 2026'}</div>
                      <div className="text-[10px] text-slate-500">Digitaler Kassenbeleg (§ 33 KassenSichV)</div>
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-mono text-slate-600">
                      <span>Beleg #0042</span>
                      <span>{new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</span>
                    </div>

                    <div className="space-y-1 py-1 border-y border-slate-100 font-mono text-xs">
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>2x Bratwurst</span>
                        <span>9,00 €</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>2x Festbier 0,5l</span>
                        <span>11,00 €</span>
                      </div>
                      <div className="text-[9px] text-slate-500 pl-2">inkl. 2,00 € Pfand</div>
                    </div>

                    <div className="flex justify-between items-baseline pt-1">
                      <span className="text-xs font-bold text-slate-700">Gesamtbetrag:</span>
                      <span className="text-lg font-black font-mono text-slate-950">20,00 €</span>
                    </div>

                    {/* Tax Breakdown */}
                    <div className="bg-slate-50 p-2 rounded-xl text-[9px] font-mono space-y-0.5 text-slate-600">
                      <div className="flex justify-between">
                        <span>19% MwSt aus 11,00 €</span>
                        <span>1,76 €</span>
                      </div>
                      <div className="flex justify-between">
                        <span>7% MwSt aus 7,00 €</span>
                        <span>0,46 €</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="w-full py-2 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>PDF Beleg herunterladen</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-4 shadow-xl">
              <div className="flex items-center justify-between mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <span>Vorschau · {paperWidth} mm</span>
                <span className="flex items-center gap-1">
                  <Scissors className="w-3 h-3" />
                  {widthCols} Spalten
                </span>
              </div>

              <div
                className={`bg-white text-slate-950 rounded-xl border-y-4 border-dashed border-slate-400 p-4 mx-auto transition-all shadow-inner overflow-x-auto font-mono select-all ${
                  paperWidth === 58 ? 'max-w-[280px]' : 'max-w-[380px]'
                }`}
                style={{ fontSize: paperWidth === 58 ? '10px' : '11px', lineHeight: 1.35 }}
              >
                {/* Header Lines */}
                {previewContent.headerLines.length > 0 && (
                  <div className="text-center font-medium mb-2 whitespace-pre leading-snug">
                    {previewContent.headerLines.join('\n')}
                  </div>
                )}

                {/* Table Number (Scaled dynamically with 10-step tableFs - kein schwarzer Kasten) */}
                {previewContent.tableText && (
                  <div
                    className="my-2 py-1 text-center transition-all font-black text-slate-950"
                    style={{
                      fontSize: `${0.9 + (previewContent.tableFs - 1) * 0.22}rem`,
                      letterSpacing: previewContent.tableFs >= 5 ? '0.05em' : 'normal',
                      lineHeight: 1.15,
                    }}
                  >
                    {previewContent.tableText}
                  </div>
                )}

                {/* Meta Lines */}
                {previewContent.metaLines.length > 0 && (
                  <div className="text-xs text-slate-800 my-1 whitespace-pre leading-snug">
                    {previewContent.metaLines.join('\n')}
                  </div>
                )}

                {/* Items (Scaled dynamically with 10-step itemFs & optionsFs) */}
                <div className="space-y-1.5 my-2">
                  {previewContent.items.map((item, idx) => {
                    const effectiveOptFs = Math.max(previewContent.optionsFs, Math.min(8, Math.floor(previewContent.itemFs * 0.8)));
                    return (
                      <div key={idx} className="transition-all">
                        <div
                          className="flex justify-between items-baseline gap-2 font-mono"
                          style={{
                            fontSize: `${0.75 + (previewContent.itemFs - 1) * 0.09}rem`,
                            fontWeight: previewContent.itemFs >= 2 ? 800 : 500,
                          }}
                        >
                          <span className="truncate">{item.qty}x {item.name}</span>
                          <span className="shrink-0">{item.priceStr}</span>
                        </div>
                        {item.subText && (
                          <div
                            className="pl-4 font-mono font-bold text-slate-700"
                            style={{
                              fontSize: `${0.7 + (effectiveOptFs - 1) * 0.07}rem`,
                            }}
                          >
                            {item.subText}
                          </div>
                        )}
                        {item.optionText && (
                          <div
                            className="pl-4 font-mono font-bold text-slate-700"
                            style={{
                              fontSize: `${0.7 + (effectiveOptFs - 1) * 0.07}rem`,
                            }}
                          >
                            {item.optionText}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Footer Lines */}
                {previewContent.footerLines.length > 0 && (
                  <div className="mt-3 pt-1 text-xs text-slate-800 whitespace-pre leading-snug">
                    {previewContent.footerLines.join('\n')}
                  </div>
                )}
              </div>

              {singleSlipHint && (
                <p className="mt-3 text-[11px] text-amber-300 font-bold text-center">
                  Einzelbon aktiv: Jede Position wird als separater Bon gedruckt.
                </p>
              )}
            </div>

            )}
            <p className="text-[11px] text-slate-500 leading-relaxed text-center">
              Die Vorschau aktualisiert Schriftgrößen, Breiten und Kopfzeilen in Echtzeit.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
