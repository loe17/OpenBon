'use client';

import React, { useState, useEffect } from 'react';
import { triggerHapticFeedback } from '@/lib/socket-client';
import { formatCurrency } from '@/lib/utils';
import {
  Truck,
  RefreshCw,
  Printer,
  Download,
  CheckCircle2,
  AlertTriangle,
  PackageCheck,
  Search,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface ProcurementItem {
  id: string;
  name: string;
  categoryName: string;
  currentStock: number;
  minStock: number;
  targetStock: number;
  suggestedQty: number;
  isUrgent: boolean;
  unitPrice: number;
  orderQty?: number; // User adjusted
}

export default function ProcurementPage() {
  const [items, setItems] = useState<ProcurementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [onlyUrgent, setOnlyUrgent] = useState(false);
  const [search, setSearch] = useState('');
  const [bookingModal, setBookingModal] = useState(false);

  const fetchProcurement = async () => {
    try {
      const res = await fetch('/api/procurement');
      const data = await res.json();
      if (Array.isArray(data.suggestions)) {
        setItems(
          data.suggestions.map((s: ProcurementItem) => ({
            ...s,
            orderQty: s.suggestedQty,
          }))
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProcurement();
  }, []);

  const categories = Array.from(new Set(items.map((i) => i.categoryName)));

  const filteredItems = items.filter((item) => {
    if (filterCategory !== 'ALL' && item.categoryName !== filterCategory) return false;
    if (onlyUrgent && !item.isUrgent) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleQtyChange = (id: string, qty: number) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, orderQty: Math.max(0, qty) } : i))
    );
  };

  const handleBookStock = async () => {
    const toBook = items
      .filter((i) => (i.orderQty || 0) > 0)
      .map((i) => ({ productId: i.id, receivedQty: i.orderQty }));

    if (toBook.length === 0) {
      alert('Keine Artikel mit Bestellmenge > 0 vorhanden.');
      return;
    }

    try {
      await fetch('/api/procurement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: toBook }),
      });
      alert('Bestände wurden erfolgreich eingebucht!');
      setBookingModal(false);
      fetchProcurement();
    } catch (e) {
      console.error(e);
      alert('Fehler beim Einbuchen.');
    }
  };

  const handlePrintOrderSheet = () => {
    window.print();
  };

  const handleExportCsv = () => {
    const lines = [
      'Lieferant/Kategorie;Artikelname;Ist-Bestand;Meldebestand;Empfohlene Menge;Bestellmenge',
    ];
    for (const item of filteredItems) {
      lines.push(
        `"${item.categoryName}";"${item.name}";${item.currentStock};${item.minStock};${item.suggestedQty};${item.orderQty || 0}`
      );
    }
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Lieferanten_Bestellvorschlag_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const totalUrgent = items.filter((i) => i.isUrgent).length;
  const totalItemsToOrder = items.filter((i) => (i.orderQty || 0) > 0).length;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-white overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 text-black p-2.5 rounded-2xl shadow">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-black text-xl sm:text-2xl tracking-tight flex items-center gap-2">
              <span>Lieferanten-Bestellvorschlag</span>
              {totalUrgent > 0 && (
                <span className="text-xs bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-0.5 rounded-full font-bold animate-pulse">
                  {totalUrgent} Dringend
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400 font-semibold">
              Automatische Bedarfsanalyse nach Meldebestand für Brauereien, Bäcker, Metzger & Großmarkt
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition border border-slate-700"
          >
            <Download className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">CSV Export</span>
          </button>
          <button
            onClick={handlePrintOrderSheet}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition border border-slate-700"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Drucken / PDF</span>
          </button>
          <button
            onClick={() => setBookingModal(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-black transition shadow"
          >
            <PackageCheck className="w-4 h-4" />
            <span>Wareneingang buchen</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:hidden">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-bold block">Eilige Nachbestellungen</span>
            <span className="text-2xl font-mono font-black text-rose-400">{totalUrgent} Artikel</span>
          </div>
          <AlertTriangle className="w-8 h-8 text-rose-500/40" />
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-bold block">Artikel im Bestellschein</span>
            <span className="text-2xl font-mono font-black text-amber-400">{totalItemsToOrder} Positionen</span>
          </div>
          <Truck className="w-8 h-8 text-amber-500/40" />
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-bold block">Bestandskontrolle aktiv</span>
            <span className="text-2xl font-mono font-black text-emerald-400">{items.length} Produkte</span>
          </div>
          <CheckCircle2 className="w-8 h-8 text-emerald-500/40" />
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-2xl print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
          >
            <option value="ALL">Alle Warengruppen / Lieferanten</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <button
            onClick={() => setOnlyUrgent(!onlyUrgent)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              onlyUrgent
                ? 'bg-rose-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Nur unter Meldebestand</span>
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Artikel suchen..."
            className="bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Printable Sheet Header (Visible only in Print) */}
      <div className="hidden print:block border-b-2 border-black pb-3 mb-4 text-black">
        <h1 className="text-xl font-black uppercase">OpenBon Lieferanten-Bestellschein</h1>
        <p className="text-xs text-gray-600">Erstellt am {new Date().toLocaleDateString('de-DE')} • Ausgedruckt zur Nachbestellung</p>
      </div>

      {/* Main Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl print:border-none print:bg-white print:text-black">
        {loading ? (
          <div className="py-20 text-center text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Berechne Lieferanten-Bedarf...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <PackageCheck className="w-12 h-12 text-slate-600 mx-auto mb-2" />
            <p className="font-bold text-sm">Keine Artikel gefunden</p>
            <p className="text-xs text-slate-500">Alle Artikel haben ausreichenden Lagerbestand.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono font-bold uppercase print:bg-gray-100 print:text-black">
                <tr>
                  <th className="p-3.5">Warengruppe / Lieferant</th>
                  <th className="p-3.5">Artikelname</th>
                  <th className="p-3.5 text-center">Ist-Bestand</th>
                  <th className="p-3.5 text-center">Meldebestand</th>
                  <th className="p-3.5 text-center">Vorschlag</th>
                  <th className="p-3.5 text-right print:text-center">Bestellmenge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 print:divide-gray-200">
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-800/50 transition ${
                      item.isUrgent ? 'bg-rose-950/20' : ''
                    }`}
                  >
                    <td className="p-3.5 font-bold text-slate-300 print:text-black">
                      {item.categoryName}
                    </td>
                    <td className="p-3.5">
                      <span className="font-extrabold text-white text-sm block print:text-black">
                        {item.name}
                      </span>
                      {item.isUrgent && (
                        <span className="text-[10px] text-rose-400 font-bold print:hidden">
                          ⚠️ Meldebestand unterschritten
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center font-mono font-bold">
                      <span
                        className={`px-2 py-0.5 rounded-md ${
                          item.isUrgent
                            ? 'bg-rose-950 text-rose-300 border border-rose-800 print:text-red-600 print:border-none'
                            : 'text-slate-300 print:text-black'
                        }`}
                      >
                        {item.currentStock} Stk.
                      </span>
                    </td>
                    <td className="p-3.5 text-center font-mono text-slate-400 print:text-gray-600">
                      {item.minStock} Stk.
                    </td>
                    <td className="p-3.5 text-center font-mono font-extrabold text-amber-400 print:text-black">
                      +{item.suggestedQty} Stk.
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5 print:hidden">
                        <input
                          type="number"
                          min="0"
                          value={item.orderQty ?? item.suggestedQty}
                          onChange={(e) => handleQtyChange(item.id, Number(e.target.value))}
                          className="w-20 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-2.5 py-1 text-center font-mono font-black text-white text-sm"
                        />
                        <span className="text-slate-400 text-xs">Stk.</span>
                      </div>
                      <span className="hidden print:inline font-mono font-black text-sm text-black">
                        {item.orderQty || item.suggestedQty} Stk.
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Wareneingang buchen */}
      {bookingModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="font-black text-lg mb-2 flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-emerald-400" />
              <span>Wareneingang verbuchen</span>
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Möchtest du die eingetragenen Bestellmengen als Wareneingang in das Warenwirtschafts-Lager von OpenBon einbuchen?
            </p>

            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 max-h-48 overflow-y-auto mb-4 space-y-1.5 text-xs font-mono">
              {items
                .filter((i) => (i.orderQty || 0) > 0)
                .map((i) => (
                  <div key={i.id} className="flex justify-between text-slate-300">
                    <span>{i.name}</span>
                    <span className="text-emerald-400 font-bold">+{i.orderQty} Stk.</span>
                  </div>
                ))}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setBookingModal(false)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-bold"
              >
                Abbrechen
              </button>
              <button
                onClick={handleBookStock}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-5 py-2.5 rounded-xl text-xs transition shadow"
              >
                Jetzt einbuchen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
