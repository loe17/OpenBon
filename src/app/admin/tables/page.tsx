'use client';

import React, { useEffect, useState } from 'react';
import {
  Grid,
  Plus,
  Printer,
  RefreshCw,
  Sliders,
  Trash2,
  Check,
  X,
  Layers,
  Sparkles,
} from 'lucide-react';

export default function AdminTablesPage() {
  const [tables, setTables] = useState<any[]>([]);
  const [printers, setPrinters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenModal, setShowGenModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Generator form
  const [genRows, setGenRows] = useState(4);
  const [genCols, setGenCols] = useState(6);
  const [genStart, setGenStart] = useState(1);

  // Marker Print form
  const [selectedPrinterId, setSelectedPrinterId] = useState('');
  const [markerStart, setMarkerStart] = useState(1);
  const [markerEnd, setMarkerEnd] = useState(24);
  const [isPrinting, setIsPrinting] = useState(false);

  const fetchTablesAndPrinters = async () => {
    try {
      const [tRes, pRes] = await Promise.all([fetch('/api/tables'), fetch('/api/printers')]);
      const tData = await tRes.json();
      const pData = await pRes.json();
      if (Array.isArray(tData)) setTables(tData);
      if (Array.isArray(pData)) {
        setPrinters(pData);
        if (pData.length > 0) setSelectedPrinterId(pData[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTablesAndPrinters();
  }, []);

  const handleGenerateGrid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm('Achtung: Dies überschreibt alle bestehenden Tische. Fortfahren?')) return;
    try {
      await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'GENERATE_GRID',
          rows: genRows,
          cols: genCols,
          startNumber: genStart,
        }),
      });
      setShowGenModal(false);
      fetchTablesAndPrinters();
    } catch (e) {
      console.error(e);
    }
  };

  const handlePrintMarkers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPrinterId) return;
    setIsPrinting(true);
    try {
      await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'PRINT_MARKERS',
          printerId: selectedPrinterId,
          startNumber: markerStart,
          endNumber: markerEnd,
        }),
      });
      alert('Tischmarken wurden an den Drucker gesendet!');
      setShowPrintModal(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 text-white p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2.5 rounded-2xl">
            <Grid className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Tischplan-Designer & Tischmarken</h1>
            <p className="text-xs text-slate-400">
              Konfiguriere Tischanordnungen im Raster oder drucke Tischnummern auf Thermopapier
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPrintModal(true)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm border border-slate-700 transition"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>Tischmarken drucken</span>
          </button>
          <button
            onClick={() => setShowGenModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-lg shadow-blue-900/30 transition"
          >
            <Sliders className="w-4 h-4" />
            <span>Raster-Generator</span>
          </button>
        </div>
      </div>

      {/* Grid Canvas Preview */}
      <div className="p-4 sm:p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Aktuelles Tischlayout ({tables.length} Tische)
          </span>
          <span className="text-xs text-slate-500">Tippe auf einen Tisch zum Bearbeiten</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span>Lade Tischplan...</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {tables.map((t) => (
              <div
                key={t.id}
                className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-blue-500 transition text-center flex flex-col justify-center items-center h-24"
              >
                <div className="font-extrabold text-base text-white">{t.label}</div>
                <span className="text-xs text-slate-500 font-mono mt-0.5">
                  Pos: ({t.gridX}, {t.gridY})
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grid Generator Modal */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleGenerateGrid}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">Tischraster automatisch generieren</h3>
              <button type="button" onClick={() => setShowGenModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Reihen (Zeilen)</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={genRows}
                  onChange={(e) => setGenRows(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Spalten pro Reihe</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={genCols}
                  onChange={(e) => setGenCols(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="col-span-2">
                <label className="text-xs font-bold text-slate-400 block mb-1">Start-Tischnummer</label>
                <input
                  type="number"
                  min="1"
                  value={genStart}
                  onChange={(e) => setGenStart(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>
            </div>

            <p className="text-xs text-amber-400 bg-amber-950/40 p-2.5 rounded-xl border border-amber-900/50">
              Erzeugt {genRows * genCols} Tische von Tisch {genStart} bis Tisch {genStart + genRows * genCols - 1}.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowGenModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-900/30"
              >
                Generieren
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Marker Print Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handlePrintMarkers}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">Tischmarken ausdrucken</h3>
              <button type="button" onClick={() => setShowPrintModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Ziel-Drucker</label>
              <select
                value={selectedPrinterId}
                onChange={(e) => setSelectedPrinterId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
              >
                {printers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.ipAddress})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Von Tisch-Nr.</label>
                <input
                  type="number"
                  min="1"
                  value={markerStart}
                  onChange={(e) => setMarkerStart(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Bis Tisch-Nr.</label>
                <input
                  type="number"
                  min="1"
                  value={markerEnd}
                  onChange={(e) => setMarkerEnd(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={isPrinting}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-900/30"
              >
                {isPrinting ? 'Druckt...' : 'Drucken'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
