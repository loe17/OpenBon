'use client';

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Plus,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Check,
  X,
} from 'lucide-react';
import type { ProductCategoryDTO, PrintGroupDTO } from '@/types/domain';
import type { ParsedMenuItem } from '@/lib/pdf-menu-extractor';

interface PdfMenuImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ProductCategoryDTO[];
  printGroups: PrintGroupDTO[];
  onImportComplete: () => void;
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    warning: (msg: string) => void;
  };
}

export function PdfMenuImportModal({
  isOpen,
  onClose,
  categories,
  printGroups,
  onImportComplete,
  toast,
}: PdfMenuImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [useTextInput, setUseTextInput] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedMenuItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
        toast.error('Bitte eine gültige PDF-Datei auswählen.');
        return;
      }
      setFile(selected);
    }
  };

  const handleAnalyze = async () => {
    if (!file && !pastedText.trim()) {
      toast.error('Bitte wählen Sie eine PDF-Datei aus oder fügen Sie Text ein.');
      return;
    }

    setIsAnalyzing(true);
    try {
      let res: Response;
      if (file && !useTextInput) {
        const formData = new FormData();
        formData.append('file', file);
        res = await fetch('/api/products/pdf-preview', {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetch('/api/products/pdf-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: pastedText }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Fehler beim Analysieren der Speisekarte');
      }

      if (!data.items || data.items.length === 0) {
        toast.warning('Es konnten keine Artikel mit Preisen in der Speisekarte erkannt werden.');
      } else {
        setParsedItems(data.items);
        toast.success(`${data.items.length} Artikel erfolgreich erkannt! Bitte prüfen und anpassen.`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Fehler beim Analysieren der Speisekarte');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleToggleSelectAll = (selected: boolean) => {
    setParsedItems((prev) => prev.map((item) => ({ ...item, selected })));
  };

  const handleToggleItem = (id: string) => {
    setParsedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleUpdateItem = (id: string, field: keyof ParsedMenuItem, value: any) => {
    setParsedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleDeleteItem = (id: string) => {
    setParsedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddNewItem = () => {
    const newItem: ParsedMenuItem = {
      id: `manual_${Date.now()}`,
      name: 'Neuer Artikel',
      price: 3.5,
      category: categories[0]?.name || 'Speisen',
      taxRate: 7,
      selected: true,
      confidence: 1.0,
    };
    setParsedItems((prev) => [newItem, ...prev]);
  };

  const handleExecuteImport = async () => {
    const selectedItems = parsedItems.filter((i) => i.selected);
    if (selectedItems.length === 0) {
      toast.warning('Bitte wählen Sie mindestens einen Artikel zum Anlegen aus.');
      return;
    }

    setIsImporting(true);
    try {
      const res = await fetch('/api/products/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selectedItems.map((item) => ({
            name: item.name.trim(),
            price: Number(item.price),
            category: item.category.trim(),
            taxRate: Number(item.taxRate),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Fehler beim Anlegen der Artikel');
      }

      toast.success(
        `Erfolgreich! ${data.createdCount} neu angelegt, ${data.updatedCount} aktualisiert.`
      );
      onImportComplete();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Fehler beim Anlegen');
    } finally {
      setIsImporting(false);
    }
  };

  const selectedCount = parsedItems.filter((i) => i.selected).length;
  const filteredItems = parsedItems.filter((item) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchCat = item.category.toLowerCase().includes(q);
      if (!matchName && !matchCat) return false;
    }
    if (activeFilter === 'SELECTED') return item.selected;
    if (activeFilter === 'UNSELECTED') return !item.selected;
    if (activeFilter !== 'ALL') return item.category === activeFilter;
    return true;
  });

  const uniqueCategories = Array.from(new Set(parsedItems.map((i) => i.category)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                PDF-Speisekarten Import & Auto-Erkennung
                <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded-full border border-blue-500/30">
                  Assistent
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Speisekarte hochladen, automatische Artikel- und Preisvorschläge in der Tabelle anpassen und mit 1 Klick übernehmen.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {parsedItems.length === 0 ? (
            /* Schritt 1: Datei oder Text wählen */
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUseTextInput(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    !useTextInput
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>PDF-Datei hochladen</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUseTextInput(true)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    useTextInput
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Text manuell einfügen</span>
                </button>
              </div>

              {!useTextInput ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-950/60 hover:bg-blue-950/20 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="p-4 bg-slate-800/80 group-hover:bg-blue-600/20 rounded-2xl mb-3 text-slate-400 group-hover:text-blue-400 transition">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <p className="text-sm font-bold text-white mb-1">
                    {file ? file.name : 'PDF-Speisekarte hier ablegen oder anklicken'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {file
                      ? `${(file.size / 1024).toFixed(1)} KB ausgewählt`
                      : 'Unterstützt digitale Speisekarten, Festzelt-Flyer und Preislisten als PDF'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    rows={8}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Fügen Sie hier den Text der Speisekarte ein (z. B. aus Word, E-Mail oder Website)...&#10;&#10;Bratwurst mit Semmel 4,50 EUR&#10;Pommes Frites 3,50&#10;Helles Bier 0,5l 4,00 €"
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={(!file && !pastedText.trim()) || isAnalyzing}
                  onClick={handleAnalyze}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black shadow-lg flex items-center gap-2 transition"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Analysiere Speisekarte...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Speisekarte jetzt analysieren</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Schritt 2: Interaktive Vorschlags-Tabelle */
            <div className="space-y-4">
              {/* Steuerung & Filterzeile */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-white">
                    {selectedCount} von {parsedItems.length} Artikeln ausgewählt
                  </span>
                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => handleToggleSelectAll(true)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-bold"
                    >
                      Alle an
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleSelectAll(false)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-bold"
                    >
                      Alle aus
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    placeholder="In Vorschlägen suchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-500 w-44"
                  />

                  {/* Warengruppen-Filter */}
                  <select
                    value={activeFilter}
                    onChange={(e) => setActiveFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                  >
                    <option value="ALL">Alle Gruppen ({parsedItems.length})</option>
                    <option value="SELECTED">Nur Ausgewählte ({selectedCount})</option>
                    <option value="UNSELECTED">Nicht Ausgewählte</option>
                    {uniqueCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleAddNewItem}
                    className="px-3 py-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Zeile hinzufügen</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setParsedItems([]);
                      setFile(null);
                      setPastedText('');
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Neu laden</span>
                  </button>
                </div>
              </div>

              {/* Vorschlags-Tabelle */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="max-h-[50vh] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 sticky top-0 z-10">
                        <th className="p-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={selectedCount === parsedItems.length && parsedItems.length > 0}
                            onChange={(e) => handleToggleSelectAll(e.target.checked)}
                            className="rounded bg-slate-900 border-slate-700 text-blue-600 w-4 h-4 cursor-pointer"
                          />
                        </th>
                        <th className="p-3">Artikelname</th>
                        <th className="p-3 w-28">Preis (€)</th>
                        <th className="p-3 w-48">Warengruppe</th>
                        <th className="p-3 w-28">MwSt.</th>
                        <th className="p-3 w-24 text-center">Erkennung</th>
                        <th className="p-3 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredItems.map((item) => (
                        <tr
                          key={item.id}
                          className={`transition ${
                            item.selected
                              ? 'hover:bg-slate-900/60'
                              : 'opacity-50 bg-slate-950/40 hover:opacity-80'
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => handleToggleItem(item.id)}
                              className="rounded bg-slate-900 border-slate-700 text-blue-600 w-4 h-4 cursor-pointer"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-white text-xs font-bold focus:border-blue-500 focus:outline-none"
                            />
                          </td>
                          <td className="p-2.5">
                            <div className="relative">
                              <input
                                type="number"
                                step="0.10"
                                min="0"
                                value={item.price}
                                onChange={(e) =>
                                  handleUpdateItem(
                                    item.id,
                                    'price',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-2.5 pr-6 py-1.5 text-white text-xs font-mono font-bold focus:border-blue-500 focus:outline-none"
                              />
                              <span className="absolute right-2 top-1.5 text-slate-500 text-[11px] font-mono">
                                €
                              </span>
                            </div>
                          </td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              list="category-suggestions"
                              value={item.category}
                              onChange={(e) =>
                                handleUpdateItem(item.id, 'category', e.target.value)
                              }
                              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-white text-xs focus:border-blue-500 focus:outline-none"
                            />
                          </td>
                          <td className="p-2.5">
                            <select
                              value={item.taxRate}
                              onChange={(e) =>
                                handleUpdateItem(item.id, 'taxRate', parseInt(e.target.value, 10))
                              }
                              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1.5 text-white text-xs font-mono focus:border-blue-500 focus:outline-none"
                            >
                              <option value={7}>7% (Speisen)</option>
                              <option value={19}>19% (Getränke)</option>
                            </select>
                          </td>
                          <td className="p-2.5 text-center">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                item.confidence >= 0.9
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : item.confidence >= 0.7
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                  : 'bg-slate-700/20 text-slate-400 border-slate-700'
                              }`}
                            >
                              {Math.round(item.confidence * 100)}%
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 transition"
                              title="Zeile entfernen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredItems.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-500">
                            Keine Artikel entsprechen dem aktuellen Filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Datalist fuer automatische Kategorie-Vervollstaendigung */}
              <datalist id="category-suggestions">
                {categories.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
                {uniqueCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
          >
            Schließen
          </button>

          {parsedItems.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                {selectedCount} Artikel werden übernommen
              </span>
              <button
                type="button"
                disabled={selectedCount === 0 || isImporting}
                onClick={handleExecuteImport}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black shadow-lg flex items-center gap-2 transition"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Artikel werden angelegt...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Ausgewählte Artikel jetzt anlegen</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
