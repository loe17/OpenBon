'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Receipt,
  Smartphone,
  Globe,
  Wifi,
  WifiOff,
  QrCode,
  Download,
  Upload,
  FileText,
  Trash2,
  ExternalLink,
  HelpCircle,
  RefreshCw,
  Check,
  ChevronDown,
  ChevronUp,
  Key,
  FileUp,
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
  Link2,
} from 'lucide-react';
import type { EventConfigDTO } from '@/types/domain';

interface ReceiptTabProps {
  config: EventConfigDTO;
  onChange: (updates: Partial<EventConfigDTO>) => void;
  printers?: { id: string; name: string; isActive?: boolean }[];
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

export function ReceiptTab({ config, onChange, printers }: ReceiptTabProps) {
  const [preview, setPreview] = useState<PreviewKind>('FOOD');
  const [paperWidth, setPaperWidth] = useState<80 | 58>(80);

  // Live-Erkennung der Internetverbindung
  const [isInternetOnline, setIsInternetOnline] = useState<boolean | null>(
    config.isInternetOnline ?? null
  );

  useEffect(() => {
    let isMounted = true;
    const checkNet = async () => {
      try {
        const res = await fetch('/api/system/internet');
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setIsInternetOnline(Boolean(data.online));
        }
      } catch {
        if (isMounted) setIsInternetOnline(false);
      }
    };
    checkNet();
    const interval = setInterval(checkNet, 45000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Synchronisation Speisen-Bon & Getränke-Bon
  const isSynced = Boolean(config.syncFoodDrinkReceiptSettings);

  const handleToggleSync = () => {
    const next = !isSynced;
    if (next) {
      onChange({
        syncFoodDrinkReceiptSettings: true,
        receiptDrinkTemplate: config.receiptFoodTemplate || 'CLASSIC',
        receiptDrinkTableFontSize: config.receiptFoodTableFontSize ?? 4,
        receiptDrinkItemFontSize: config.receiptFoodItemFontSize ?? 3,
      });
    } else {
      onChange({ syncFoodDrinkReceiptSettings: false });
    }
  };

  const handleFoodTemplateChange = (tplId: string) => {
    const updates: Partial<EventConfigDTO> = { receiptFoodTemplate: tplId };
    if (isSynced) updates.receiptDrinkTemplate = tplId;
    onChange(updates);
  };

  const handleDrinkTemplateChange = (tplId: string) => {
    const updates: Partial<EventConfigDTO> = { receiptDrinkTemplate: tplId };
    if (isSynced) updates.receiptFoodTemplate = tplId;
    onChange(updates);
  };

  const handleFoodTableFontSizeChange = (val: number) => {
    const updates: Partial<EventConfigDTO> = { receiptFoodTableFontSize: val };
    if (isSynced) updates.receiptDrinkTableFontSize = val;
    onChange(updates);
  };

  const handleDrinkTableFontSizeChange = (val: number) => {
    const updates: Partial<EventConfigDTO> = { receiptDrinkTableFontSize: val };
    if (isSynced) updates.receiptFoodTableFontSize = val;
    onChange(updates);
  };

  const handleFoodItemFontSizeChange = (val: number) => {
    const updates: Partial<EventConfigDTO> = { receiptFoodItemFontSize: val };
    if (isSynced) updates.receiptDrinkItemFontSize = val;
    onChange(updates);
  };

  const handleDrinkItemFontSizeChange = (val: number) => {
    const updates: Partial<EventConfigDTO> = { receiptDrinkItemFontSize: val };
    if (isSynced) updates.receiptFoodItemFontSize = val;
    onChange(updates);
  };

  // Webhosting-Brücke & Speisekarte
  const [menuInfo, setMenuInfo] = useState<{
    exists: boolean;
    filename?: string;
    sizeBytes?: number;
    mimeType?: string;
    updatedAt?: string;
    url?: string;
  } | null>(null);
  const [isUploadingMenu, setIsUploadingMenu] = useState(false);
  const [isSyncingMenu, setIsSyncingMenu] = useState(false);
  const [menuExpiresAt, setMenuExpiresAt] = useState<string>('');
  const [isTestingBridge, setIsTestingBridge] = useState(false);
  const [testBridgeResult, setTestBridgeResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    steps?: Array<{ label: string; ok: boolean; detail?: string }>;
    receiptUrl?: string;
    cleanReceiptUrl?: string;
    testCode?: string;
  } | null>(null);
  const [bridgeStatusMsg, setBridgeStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showBridgeHelp, setShowBridgeHelp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadMenuInfo = async () => {
    try {
      const res = await fetch('/api/bridge/menu-upload');
      if (res.ok) {
        const data = await res.json();
        setMenuInfo(data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadMenuInfo();
  }, []);

  const handleDownloadBridgeZip = () => {
    const token = encodeURIComponent(config.webhostingSyncToken || '');
    const bUrl = encodeURIComponent(config.baseUrl || '');
    const eName = encodeURIComponent(config.name || '');
    window.location.href = `/api/bridge/download?token=${token}&baseUrl=${bUrl}&eventName=${eName}`;
  };

  const handleGenerateToken = () => {
    const token =
      'OB-SYNC-' +
      Math.random().toString(36).substring(2, 8).toUpperCase() +
      '-' +
      Math.random().toString(36).substring(2, 8).toUpperCase();
    onChange({ webhostingSyncToken: token });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingMenu(true);
    setBridgeStatusMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/bridge/menu-upload', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload fehlgeschlagen');
      await loadMenuInfo();
      setBridgeStatusMsg({ type: 'success', text: `Speisekarte "${file.name}" erfolgreich hochgeladen!` });
    } catch (err: any) {
      setBridgeStatusMsg({ type: 'error', text: err.message || 'Fehler beim Hochladen' });
    } finally {
      setIsUploadingMenu(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteMenu = async () => {
    if (!confirm('Möchtest du die hinterlegte Speisekarte wirklich löschen?')) return;
    try {
      const res = await fetch('/api/bridge/menu-upload', { method: 'DELETE' });
      if (res.ok) {
        setMenuInfo({ exists: false });
        setBridgeStatusMsg({ type: 'success', text: 'Speisekarte wurde gelöscht.' });
      }
    } catch (err: any) {
      setBridgeStatusMsg({ type: 'error', text: 'Fehler beim Löschen' });
    }
  };

  const handleSyncMenuToWebhosting = async () => {
    setIsSyncingMenu(true);
    setBridgeStatusMsg(null);
    try {
      const res = await fetch('/api/bridge/sync-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          syncToken: config.webhostingSyncToken,
          eventName: config.name,
          expiresAt: menuExpiresAt ? new Date(menuExpiresAt).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Übertragung fehlgeschlagen');
      setBridgeStatusMsg({ type: 'success', text: data.message || 'Speisekarte erfolgreich an Webhosting übertragen!' });
    } catch (err: any) {
      setBridgeStatusMsg({ type: 'error', text: err.message || 'Fehler bei der Übertragung' });
    } finally {
      setIsSyncingMenu(false);
    }
  };

  const handleTestBridgeConnection = async () => {
    setIsTestingBridge(true);
    setTestBridgeResult(null);
    setBridgeStatusMsg(null);
    try {
      const res = await fetch('/api/bridge/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          syncToken: config.webhostingSyncToken,
          eventName: config.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Verbindungstest fehlgeschlagen');
      }
      setTestBridgeResult(data);
      setBridgeStatusMsg({
        type: 'success',
        text: 'Alle Funktionen der Webhosting-Brücke erfolgreich geprüft!',
      });
    } catch (err: any) {
      setBridgeStatusMsg({
        type: 'error',
        text: err.message || 'Verbindungstest fehlgeschlagen',
      });
    } finally {
      setIsTestingBridge(false);
    }
  };

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
    const isEco = tpl === 'ECO';
    const singleSlipActive = isFood ? config.receiptSingleItemFoodSlips !== false : isDrink ? config.receiptSingleItemDrinkSlips !== false : false;

    // 1. Kopfzeilen-Hierarchie
    if (showHeader) {
      const eventName = config.name || 'Veranstaltung 2026';
      const organizer = config.receiptSubHeader || '';
      const customHeader = config.receiptHeader || '';

      if (singleSlipActive) {
        headerLines.push(center('*** BON 1 von 2 (Tisch 7) ***'));
      }

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

      if (!isEco) {
        headerLines.push(DBL_LINE);
      }
    }

    // 2. Tischnummer
    const tableText = showTable ? 'Tisch 7' : null;

    // 3. Metadaten
    const metaLines: string[] = [];
    if (isEco) {
      if (showWaiter && showStamp) {
        metaLines.push(row(sample.waiter, sample.stamp));
      } else if (showWaiter) {
        metaLines.push(row('Bedienung:', sample.waiter));
      } else if (showStamp) {
        metaLines.push(row('Zeit:', sample.stamp));
      }
      if (isReceipt) {
        metaLines.push(row('Bon #42', 'Nr: BELEG-2026-00042'));
      }
      metaLines.push(LINE);
    } else {
      if (showWaiter) {
        metaLines.push(row(`Bedienung: ${sample.waiter}`, isReceipt ? 'Bon #42' : ''));
      }
      if (showStamp) {
        metaLines.push(`Datum: ${sample.stamp}`);
      }
      if (isReceipt) {
        metaLines.push('Beleg-Nr: BELEG-2026-00042');
      }
      metaLines.push(LINE);
    }

    // 4. Positionen
    const visible = isFood
      ? (singleSlipActive ? [sample.items[0]] : sample.items.filter((i) => !i.name.includes('Helles')))
      : isDrink
      ? (singleSlipActive ? [sample.items[2]] : sample.items.filter((i) => i.name.includes('Helles')))
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
      const priceFormatted = `${(item.price * item.qty).toFixed(2)} EUR`;
      let subText: string | undefined;
      let optionText: string | undefined;

      if (isReceipt) {
        itemLines.push(row(`${item.qty}x ${item.name}`, priceFormatted));
      } else {
        if (tpl === 'HIGH_VISIBILITY') {
          itemLines.push(`-> ${item.qty}x ${item.name.toUpperCase()}`);
        } else {
          itemLines.push(`${item.qty}x ${item.name}`);
        }
      }

      if (showOptions && item.option) {
        optionText = tpl === 'HIGH_VISIBILITY' ? `! WUNSCH: ${item.option.toUpperCase()}` : `   + ${item.option}`;
        itemLines.push(`   ${optionText}`);
      }

      if (isReceipt && item.name.includes('Helles')) {
        subText = '   inkl. Pfand: 3.00 EUR';
        itemLines.push(subText);
      }

      formattedItems.push({
        qty: item.qty,
        name: isReceipt || tpl !== 'HIGH_VISIBILITY' ? item.name : item.name.toUpperCase(),
        priceStr: isReceipt ? priceFormatted : '',
        subText,
        optionText,
      });
    }

    // 5. Gesamtsumme & Fußzeile
    const footerLines: string[] = [];
    if (isReceipt) {
      const total = visible.reduce((s, i) => s + (i.price * i.qty), 0);
      footerLines.push(LINE);
      footerLines.push(row('GESAMTBETRAG:', `${total.toFixed(2)} EUR`));
      footerLines.push(row('Bar:', `${total.toFixed(2)} EUR`));
      footerLines.push(row('Gegeben:', '50.00 EUR'));
      footerLines.push(row('Rueckgeld:', `${(50 - total).toFixed(2)} EUR`));

      if (config.enableTax) {
        const net = total / (1 + (config.taxRateNormal || 19) / 100);
        const tax = total - net;
        footerLines.push('.'.repeat(widthCols));
        footerLines.push(row('MwSt-Satz', 'Netto       Steuer      Brutto'));
        footerLines.push(row(`${(config.taxRateNormal || 19).toFixed(1)}%`, `${net.toFixed(2)} EUR   ${tax.toFixed(2)} EUR  ${total.toFixed(2)} EUR`));
        footerLines.push('.'.repeat(widthCols));
      }

      if (config.receiptShowTse !== false) {
        footerLines.push(center('TSE-Signatur (KassenSichV)'));
        footerLines.push(center('TSE-01-OK-9842A7BC34F2'));
        footerLines.push(row('Start: 24.08. 19:42:01', 'Ende: 19:42:15'));
        footerLines.push(center('Seriennr: TSE-SANDBOX-849204'));
        footerLines.push(LINE);
      }

      if (tpl === 'GASTRO') {
        footerLines.push('');
        footerLines.push(center('--- BEWIRTUNGSBELEG (§ 4 Abs. 5 EStG) ---'));
        footerLines.push('Bewirtete Personen: _____________________');
        footerLines.push('Anlass: _________________________________');
        footerLines.push('Trinkgeld: ____________ € Datum: ________');
        footerLines.push('Unterschrift: ___________________________');
      }

      if (config.receiptFooterText) {
        footerLines.push('');
        footerLines.push(center(config.receiptFooterText));
      }
    } else {
      footerLines.push(LINE);
      if (singleSlipActive) {
        footerLines.push(center('* Posten 1 von 2 abgeschlossen *'));
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
          {/* 1. Kopf- und Fußzeile (Ganz oben) */}
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

          {/* 2. Speisen-Bon (Küche) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <Utensils className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-base text-white">Speisen-Bon (Küche)</h3>
                  <p className="text-xs text-slate-400">Layout und Druckoptionen für Küchenbestellungen</p>
                </div>
              </div>
              {isSynced && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-950/60 border border-amber-800/40 px-2.5 py-1 rounded-xl">
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Mit Ausschank synchron</span>
                </span>
              )}
            </div>

            {/* Synchronisations-Schalter */}
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-bold text-sm text-white">Mit Getränke-Bon synchronisieren</span>
                  {isSynced && (
                    <span className="text-[10px] bg-amber-950/70 border border-amber-700/50 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                      Aktiv
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-snug mt-0.5">
                  Gleicht Vorlage, Schriftgröße Tischnummer und Schriftgröße Artikel &amp; Menge automatisch mit dem Ausschank ab.
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleSync}
                aria-pressed={isSynced}
                aria-label="Boneinstellungen synchronisieren"
                className="p-1.5 shrink-0 active:scale-95 touch-manipulation"
              >
                {isSynced ? (
                  <ToggleRight className="w-10 h-10 text-amber-400" />
                ) : (
                  <ToggleLeft className="w-10 h-10 text-slate-600" />
                )}
              </button>
            </div>

            {/* Template Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Design-Vorlage (Speisen-Bon)
                </label>
                {isSynced && (
                  <span className="text-[11px] text-amber-400 flex items-center gap-1 font-mono">
                    <Link2 className="w-3 h-3" />
                    Synchronisiert
                  </span>
                )}
              </div>
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
                      onClick={() => !isDisabled && handleFoodTemplateChange(tpl.id)}
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
                onChange={(v) => handleFoodTableFontSizeChange(v)}
                color="amber"
              />
              <FontSizeSlider
                label="Schriftgröße Speisen &amp; Menge"
                value={config.receiptFoodItemFontSize ?? 3}
                onChange={(v) => handleFoodItemFontSizeChange(v)}
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

          {/* 3. Getränke-Bon (Ausschank) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <Beer className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="font-bold text-base text-white">Getränke-Bon (Ausschank)</h3>
                  <p className="text-xs text-slate-400">Layout und Druckoptionen für Ausschank &amp; Schänke</p>
                </div>
              </div>
              {isSynced && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-sky-400 bg-sky-950/60 border border-sky-800/40 px-2.5 py-1 rounded-xl">
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Mit Küche synchron</span>
                </span>
              )}
            </div>

            {/* Synchronisations-Hinweis wenn aktiv */}
            {isSynced && (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-sky-950/40 border border-sky-800/40 text-xs text-sky-300">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>Mit Speisen-Bon synchronisiert – Vorlage &amp; Schriftgrößen sind gekoppelt.</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleSync}
                  className="text-[11px] underline hover:text-white font-bold ml-2 shrink-0"
                >
                  Trennen
                </button>
              </div>
            )}

            {/* Template Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Design-Vorlage (Getränke-Bon)
                </label>
                {isSynced && (
                  <span className="text-[11px] text-sky-400 flex items-center gap-1 font-mono">
                    <Link2 className="w-3 h-3" />
                    Synchronisiert
                  </span>
                )}
              </div>
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
                      onClick={() => !isDisabled && handleDrinkTemplateChange(tpl.id)}
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
                onChange={(v) => handleDrinkTableFontSizeChange(v)}
                color="sky"
              />
              <FontSizeSlider
                label="Schriftgröße Getränke &amp; Menge"
                value={config.receiptDrinkItemFontSize ?? 3}
                onChange={(v) => handleDrinkItemFontSizeChange(v)}
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

          {/* 4. Kassenbeleg für den Gast */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-base text-white">Kassenbeleg für den Gast</h3>
                  <p className="text-xs text-slate-400">Layout und Druckoptionen für Kundenbelege &amp; Quittungen</p>
                </div>
              </div>
            </div>

            {/* Standard-Drucker & Bedienungs-Ausgabe */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Standard-Drucker für Kassenbelege &amp; Quittungen
                </label>
                <select
                  value={config.receiptPrinterId || ''}
                  onChange={(e) => onChange({ receiptPrinterId: e.target.value || null })}
                  className="w-full min-h-[48px] px-3.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:border-emerald-500"
                >
                  <option value="">(Erster aktiver Drucker / Automatisch)</option>
                  {(printers || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {!p.isActive ? '(inaktiv)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Legt fest, an welchem Bondrucker Gastquittungen und Belege ausgedruckt werden.
                </p>
              </div>

              <div className="space-y-3">
                <Toggle
                  label="Papierbon-Knopf bei Bedienung anzeigen"
                  hint="Erlaubt Bedienungen, nach dem Bezahlen einen Papierbon auszudrucken. Standard: Nicht angehakt."
                  value={Boolean(config.enableWaiterReceiptPrint)}
                  onToggle={() => onChange({ enableWaiterReceiptPrint: !config.enableWaiterReceiptPrint })}
                />
                <Toggle
                  label="Papierbon-Knopf an der Bonkasse anzeigen"
                  hint="Zeigt nach dem Kassieren an der Bonkasse die Option, einen Papierbon auszudrucken. Standard: Nicht angehakt."
                  value={Boolean(config.enablePosReceiptPrint)}
                  onToggle={() => onChange({ enablePosReceiptPrint: !config.enablePosReceiptPrint })}
                />
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
                {isInternetOnline === null ? (
                  <span className="text-slate-400">Verbindung prüfen...</span>
                ) : isInternetOnline ? (
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

              {isInternetOnline === false && (
                <div className="p-3 rounded-xl border border-amber-800/60 bg-amber-950/40 text-xs font-semibold text-amber-300 flex items-center gap-2.5">
                  <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Aktuell keine Internetverbindung erkannt. Der Online-Belegabruf über QR-Code und der Webhosting-Upload sind nur bei bestehender Internetverbindung aktiv.
                  </span>
                </div>
              )}

              {/* Feedback-Banner */}
              {bridgeStatusMsg && (
                <div
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 ${
                    bridgeStatusMsg.type === 'success'
                      ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {bridgeStatusMsg.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>{bridgeStatusMsg.text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBridgeStatusMsg(null)}
                    className="text-xs opacity-70 hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Öffentliche Basis-URL + Download-Button */}
              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-300">
                      Öffentliche Basis-URL für E-Bons (Webhosting-Brücke)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowBridgeHelp(!showBridgeHelp)}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>{showBridgeHelp ? 'Anleitung schließen' : 'Wie richte ich das ein?'}</span>
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="flex-1 flex items-center gap-2">
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-500">
                        <Globe className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={config.baseUrl || ''}
                        onChange={(e) => onChange({ baseUrl: e.target.value })}
                        placeholder="https://bon.mein-verein.de oder http://192.168.1.100:3000"
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs font-mono font-bold focus:border-indigo-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadBridgeZip}
                      title="Fertiges ZIP-Paket für Webhosting (z. B. Netcup, Plesk) herunterladen"
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shrink-0"
                    >
                      <Download className="w-4 h-4" />
                      <span>ZIP-Paket herunterladen</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                    Trage hier die Internetadresse deines Webhostings (z. B. Netcup Webhosting 1000) ein. Klicke auf &bdquo;ZIP-Paket herunterladen&ldquo;, um die fertigen Dateien für dein Webhosting zu erhalten.
                  </p>
                </div>

                {/* Webhosting Sync-Token */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Abgleich-Schlüssel für Webhosting (Sicherheits-Token)
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-500">
                      <Key className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={config.webhostingSyncToken || ''}
                      onChange={(e) => onChange({ webhostingSyncToken: e.target.value })}
                      placeholder="z. B. OB-SYNC-8F3K2L-9Q1Z"
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs font-mono font-bold focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateToken}
                      title="Neuen Zufalls-Schlüssel erzeugen"
                      className="flex items-center gap-1.5 px-3 py-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold transition shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Neu generieren</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                    Sichert die Belegübertragung zwischen Kasse und Webhosting ab. Derselbe Schlüssel wird im ZIP-Paket automatisch voreingestellt.
                  </p>
                </div>

                {/* Aufklappbare Schritt-für-Schritt-Hilfe */}
                {showBridgeHelp && (
                  <div className="p-4 bg-indigo-950/30 border border-indigo-500/30 rounded-2xl text-xs space-y-3">
                    <div className="flex items-center gap-2 font-bold text-indigo-300 text-sm">
                      <HelpCircle className="w-4 h-4" />
                      <span>Schritt-für-Schritt Anleitung: Webhosting-Brücke einrichten</span>
                    </div>

                    <div className="space-y-2 text-slate-300 leading-relaxed">
                      <div className="flex items-start gap-2">
                        <span className="bg-indigo-600 text-white font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px]">1</span>
                        <div>
                          <strong>Webhosting bereitstellen:</strong> Nutze ein normales Webhosting (z. B. Netcup Webhosting 1000) oder eine Domain/Subdomain wie <code>bon.mein-verein.de</code>.
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="bg-indigo-600 text-white font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px]">2</span>
                        <div>
                          <strong>ZIP-Paket entpacken:</strong> Klicke oben auf &bdquo;ZIP-Paket herunterladen&ldquo; und lade den Inhalt im Webhosting-Dateimanager (Plesk / cPanel) oder per FTP direkt in den Web-Ordner (meist <code>httpdocs</code>).
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="bg-indigo-600 text-white font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px]">3</span>
                        <div>
                          <strong>URL & Schlüssel eintragen:</strong> Trage die Adresse oben ein. Fertig! Sobald du einen Verkauf abschließt, überträgt OpenBon den Beleg automatisch.
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-indigo-500/20 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                      <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 text-slate-300">
                        <strong className="text-emerald-400 block mb-1">✓ Weder DynDNS noch Router-Port nötig</strong>
                        OpenBon sendet die Belege als normale, ausgehende Verbindung ins Internet. Dein Festzelt-Router bleibt vollständig geschützt.
                      </div>
                      <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 text-slate-300">
                        <strong className="text-amber-400 block mb-1">⏱ Automatische 24h-Löschung</strong>
                        Belege auf dem Webhosting werden nach genau 24 Stunden automatisch gelöscht. So bleibt dein Speicherplatz sauber und der Datenschutz gewahrt.
                      </div>
                    </div>
                  </div>
                )}

                {/* Karte: Speisekarte & Aushang (PDF oder Bild) */}
                <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-xs text-white">Digitale Speisekarte & Aushang (PDF oder Bild)</span>
                    </div>
                    {menuInfo?.exists && (
                      <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-full">
                        Hinterlegt
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Hinterlege hier die Speisekarte oder den Festzelt-Flyer als PDF oder Foto. Gäste können diesen über den QR-Code am Tisch auf ihrem Smartphone öffnen. Auch auf der Webhosting-Brücke wird die Speisekarte automatisch bereitgestellt.
                  </p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleFileUpload}
                  />

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {menuInfo?.exists ? (
                      <>
                        <div className="w-full flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200">
                            <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                            <span className="font-mono font-medium truncate max-w-[200px]">
                              {menuInfo.filename}
                            </span>
                            {menuInfo.sizeBytes && (
                              <span className="text-slate-500 text-[10px]">
                                ({(menuInfo.sizeBytes / (1024 * 1024)).toFixed(1)} MB)
                              </span>
                            )}
                          </div>

                          {menuInfo.url && (
                            <a
                              href={menuInfo.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold transition"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Vorschau</span>
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingMenu}
                            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold transition"
                          >
                            <FileUp className="w-3.5 h-3.5" />
                            <span>Ersetzen</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleDeleteMenu}
                            className="flex items-center gap-1.5 px-3 py-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/50 text-rose-300 rounded-xl text-xs font-bold transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Löschen</span>
                          </button>
                        </div>

                        <div className="w-full p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2 mt-1">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-slate-200 block">
                                Automatisches Ablaufdatum auf Webhosting (optional):
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="datetime-local"
                                  value={menuExpiresAt}
                                  onChange={(e) => setMenuExpiresAt(e.target.value)}
                                  className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:border-indigo-500 outline-none"
                                />
                                {menuExpiresAt && (
                                  <button
                                    type="button"
                                    onClick={() => setMenuExpiresAt('')}
                                    className="text-xs text-slate-400 hover:text-slate-200 underline"
                                  >
                                    Zurücksetzen
                                  </button>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400">
                                Ohne Eingabe wird die Speisekarte automatisch nach 7 Tagen gelöscht. Mit Datum verschwindet sie pünktlich zum Festende vom Server – auch wenn OpenBon ausgeschaltet ist.
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={handleSyncMenuToWebhosting}
                              disabled={isSyncingMenu}
                              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow shrink-0"
                            >
                              <Upload className="w-4 h-4" />
                              <span>{isSyncingMenu ? 'Übertrage...' : 'Jetzt auf Webhosting übertragen'}</span>
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingMenu}
                          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow"
                        >
                          <FileUp className="w-4 h-4" />
                          <span>{isUploadingMenu ? 'Wird hochgeladen...' : 'Speisekarte hochladen (PDF / Bild)'}</span>
                        </button>
                        <span className="text-[11px] text-slate-500">
                          (PDF, PNG, JPG oder WebP bis zu 25 MB)
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Karte: Verbindung & Funktionen testen */}
                <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="font-bold text-xs text-white">
                          Funktionstest: Webhosting & Beleg-Anzeige prüfen
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        Prüft mit einem Klick die Erreichbarkeit deines Webhostings, synchronisiert den Festnamen und erstellt einen Test-Beleg, den du sofort als Gast im Browser öffnen kannst.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleTestBridgeConnection}
                      disabled={isTestingBridge || !config.baseUrl}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition shadow shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTestingBridge ? 'animate-spin' : ''}`} />
                      <span>{isTestingBridge ? 'Wird geprüft...' : 'Jetzt alle Funktionen testen'}</span>
                    </button>
                  </div>

                  {testBridgeResult && testBridgeResult.success && (
                    <div className="mt-3 p-3.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl space-y-3">
                      <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Verbindung erfolgreich! Alle Tests bestanden.</span>
                      </div>

                      {testBridgeResult.steps && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-300">
                          {testBridgeResult.steps.map((step, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-slate-900/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
                              <span className="text-emerald-400 font-bold">✓</span>
                              <span>{step.label}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {testBridgeResult.receiptUrl && (
                        <div className="pt-2 border-t border-emerald-500/20 flex flex-wrap items-center gap-2">
                          <a
                            href={testBridgeResult.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Muster-Beleg als Gast öffnen</span>
                          </a>

                          {config.baseUrl && (
                            <a
                              href={config.baseUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-xs font-bold transition"
                            >
                              <Globe className="w-3.5 h-3.5" />
                              <span>Startseite / Speisekarte aufrufen</span>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------ Vorschau (Rechts) */}
        <div className="xl:col-span-2">
          <div className="xl:sticky xl:top-4 space-y-3">
            {/* Bon-Typ Umschalter */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-2xl p-1.5">
              {([
                { id: 'FOOD', label: 'Speisen-Bon' },
                { id: 'DRINK', label: 'Getränke-Bon' },
                { id: 'RECEIPT', label: 'Kassenbeleg' },
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

                {/* Table Number (Scaled dynamically with 10-step tableFs - füllt auf Stufe 10 die gesamte Bonbreite) */}
                {previewContent.tableText && (() => {
                  const maxRem = paperWidth === 58 ? 3.6 : 4.6;
                  const minRem = 0.9;
                  const remSize = (minRem + (previewContent.tableFs - 1) * ((maxRem - minRem) / 9)).toFixed(2);
                  return (
                    <div
                      className="my-2 py-1 text-center transition-all font-black text-slate-950 whitespace-nowrap overflow-hidden tracking-tight leading-none flex items-center justify-center w-full"
                      style={{
                        fontSize: `${remSize}rem`,
                        letterSpacing: previewContent.tableFs >= 5 ? '0.05em' : 'normal',
                        lineHeight: 1.1,
                      }}
                    >
                      {previewContent.tableText}
                    </div>
                  );
                })()}

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
