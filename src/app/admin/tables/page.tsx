'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
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
  FileDown,
  ToggleLeft,
  ToggleRight,
  Circle,
  Edit2,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface AdminTableRow {
  id: string;
  tableNumber: number;
  label: string;
  gridX: number;
  gridY: number;
  status: string;
  isActive?: boolean;
  openItemCount?: number;
}

export default function AdminTablesPage() {
  const { success, error, warning } = useToast();
  const [tables, setTables] = useState<any[]>([]);
  const [printers, setPrinters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenModal, setShowGenModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Generator form
  const [genRows, setGenRows] = useState(4);
  const [genCols, setGenCols] = useState(6);
  const [genStart, setGenStart] = useState(1);
  const [genStep, setGenStep] = useState(1);

  // Edit table form
  const [editingTable, setEditingTable] = useState<AdminTableRow | null>(null);
  const [editTableNum, setEditTableNum] = useState<number>(1);
  const [editTableLabel, setEditTableLabel] = useState('');
  const [editTableActive, setEditTableActive] = useState(true);

  // Single table form
  const [newTableNum, setNewTableNum] = useState<number>(1);
  const [newTableLabel, setNewTableLabel] = useState('');

  // Marker Print form
  const [selectedPrinterId, setSelectedPrinterId] = useState('');
  const [markerStart, setMarkerStart] = useState(1);
  const [markerEnd, setMarkerEnd] = useState(24);
  const [includeQr, setIncludeQr] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const fetchTablesAndPrinters = async () => {
    try {
      const [tRes, pRes] = await Promise.all([
        fetch('/api/tables?all=true'),
        fetch('/api/printers'),
      ]);
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

  const handleToggleTable = async (t: AdminTableRow) => {
    const nextActive = t.isActive === false ? true : false;
    try {
      await fetch('/api/tables', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id, isActive: nextActive, label: t.label, gridX: t.gridX, gridY: t.gridY, status: t.status }),
      });
      fetchTablesAndPrinters();
      success(nextActive ? 'Tisch aktiviert' : 'Tisch deaktiviert');
    } catch {
      error('Fehler beim Ändern des Tischstatus');
    }
  };

  const handleDeleteTable = async (t: AdminTableRow) => {
    try {
      await fetch(`/api/tables?id=${t.id}`, { method: 'DELETE' });
      fetchTablesAndPrinters();
      success(`Tisch "${t.label}" gelöscht`);
    } catch {
      error('Fehler beim Löschen des Tisches');
    }
  };

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber: newTableNum,
          label: newTableLabel || `Tisch ${newTableNum}`,
        }),
      });
      setShowAddModal(false);
      fetchTablesAndPrinters();
      success('Tisch erfolgreich hinzugefügt');
    } catch {
      error('Fehler beim Anlegen des Tisches');
    }
  };

  const handleOpenEdit = (t: AdminTableRow) => {
    setEditingTable(t);
    setEditTableNum(t.tableNumber);
    setEditTableLabel(t.label);
    setEditTableActive(t.isActive !== false);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable) return;
    try {
      await fetch('/api/tables', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTable.id,
          tableNumber: editTableNum,
          label: editTableLabel || `Tisch ${editTableNum}`,
          isActive: editTableActive,
        }),
      });
      setEditingTable(null);
      fetchTablesAndPrinters();
      success('Tischanpassung gespeichert');
    } catch {
      error('Fehler beim Speichern der Tischanpassung');
    }
  };

  const handleGenerateGrid = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'GENERATE_GRID',
          rows: genRows,
          cols: genCols,
          startNumber: genStart,
          step: genStep,
        }),
      });
      setShowGenModal(false);
      fetchTablesAndPrinters();
      success('Tischplan-Raster erfolgreich neu generiert!');
    } catch (e) {
      error('Fehler beim Generieren des Rasters');
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
          includeQr,
        }),
      });
      success('Tischmarken wurden an den Drucker gesendet!');
      setShowPrintModal(false);
    } catch (e) {
      error('Fehler beim Drucken der Tischmarken');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 text-white p-3 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2.5 rounded-2xl shadow">
            <Grid className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Tischplan Designer</h1>
            <p className="text-xs text-slate-400">
              Tische konfigurieren, aktivieren/deaktivieren, Druckübersicht & Bon-Tischmarken
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/tables/print"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition shadow"
          >
            <FileDown className="w-4 h-4 text-blue-400" />
            <span>Tischübersicht drucken / PDF</span>
          </Link>

          <button
            onClick={() => setShowPrintModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition"
          >
            <Printer className="w-4 h-4" />
            <span>Tischmarken (Bondrucker)</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition"
          >
            <Plus className="w-4 h-4" />
            <span>Einzeltisch</span>
          </button>

          <button
            onClick={() => setShowGenModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow"
          >
            <Sliders className="w-4 h-4" />
            <span>Raster generieren</span>
          </button>
        </div>
      </div>

      {/* Tables Grid Layout */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
          <span>Konfigurierte Tische ({tables.length}) - Klicke zum Aktivieren/Deaktivieren</span>
          <span>Aktiv: {tables.filter((t) => t.isActive !== false).length}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {tables.map((t) => (
            <div
              key={t.id}
              className={`relative rounded-2xl p-3 border transition flex flex-col justify-between min-h-[90px] ${
                t.isActive !== false
                  ? 'bg-slate-950 border-slate-700 text-white hover:border-blue-500'
                  : 'bg-slate-950/40 border-slate-800 text-slate-500 opacity-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono font-bold text-slate-400">
                  Nr. {t.tableNumber}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(t)}
                    className="p-1 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-950/50 transition"
                    title="Tischnummer / Label anpassen"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleToggleTable(t)}
                    className={`p-1 rounded-lg transition ${
                      t.isActive !== false ? 'text-emerald-400 hover:bg-emerald-950' : 'text-slate-500 hover:bg-slate-800'
                    }`}
                    title={t.isActive !== false ? 'Tisch deaktivieren' : 'Tisch aktivieren'}
                  >
                    {t.isActive !== false ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDeleteTable(t)}
                    className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 transition"
                    title="Tisch löschen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="font-extrabold text-sm truncate">{t.label}</div>

              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Circle
                    className={`w-2.5 h-2.5 ${
                      t.isActive !== false ? 'fill-emerald-400 text-emerald-400' : 'fill-slate-600 text-slate-600'
                    }`}
                  />
                  <span>{t.isActive !== false ? 'Aktiv' : 'Inaktiv'}</span>
                </span>
                {t.openItemCount > 0 && (
                  <span className="text-amber-400 font-bold">{t.openItemCount} Bons</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Generator Modal mit Schrittweite / Raster */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-white">Tischraster automatisch erstellen</h3>
              <button
                onClick={() => setShowGenModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGenerateGrid} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Reihen</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={genRows}
                    onChange={(e) => setGenRows(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Spalten</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={genCols}
                    onChange={(e) => setGenCols(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Start-Tischnummer</label>
                  <input
                    type="number"
                    min="1"
                    value={genStart}
                    onChange={(e) => setGenStart(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Schrittweite (Raster)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="z. B. 1, 5, 10"
                    value={genStep}
                    onChange={(e) => setGenStep(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800">
                Erstellt <span className="text-white font-bold">{genRows * genCols} Tische</span> von Nr.{' '}
                <span className="text-amber-400 font-mono font-bold">{genStart}</span> bis Nr.{' '}
                <span className="text-amber-400 font-mono font-bold">
                  {genStart + (genRows * genCols - 1) * genStep}
                </span>{' '}
                (Schrittweite: +{genStep}).
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGenModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow"
                >
                  Generieren
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Table Modal */}
      {editingTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-white">Tisch manuell anpassen</h3>
              <button
                onClick={() => setEditingTable(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Tischnummer</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={editTableNum}
                  onChange={(e) => setEditTableNum(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Bezeichnung / Label</label>
                <input
                  type="text"
                  required
                  value={editTableLabel}
                  onChange={(e) => setEditTableLabel(e.target.value)}
                  placeholder="z. B. Tisch 42, Stehtisch 3, VIP-Lounge"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                <span className="text-xs text-slate-300 font-bold">Tisch ist aktiv</span>
                <input
                  type="checkbox"
                  checked={editTableActive}
                  onChange={(e) => setEditTableActive(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTable(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Single Table Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-white">Einzeltisch anlegen</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddTable} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Tischnummer</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={newTableNum}
                  onChange={(e) => setNewTableNum(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Bezeichnung / Name
                </label>
                <input
                  type="text"
                  placeholder="z. B. Stehtisch 5 oder Biergarten 1"
                  value={newTableLabel}
                  onChange={(e) => setNewTableLabel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow"
                >
                  Hinzufügen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Marker Print Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-white">Tischmarken drucken (Bondrucker)</h3>
              <button
                onClick={() => setShowPrintModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePrintMarkers} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Drucker</label>
                <select
                  value={selectedPrinterId}
                  onChange={(e) => setSelectedPrinterId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  {printers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.ipAddress})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Von Tisch</label>
                  <input
                    type="number"
                    value={markerStart}
                    onChange={(e) => setMarkerStart(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Bis Tisch</label>
                  <input
                    type="number"
                    value={markerEnd}
                    onChange={(e) => setMarkerEnd(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 p-2.5 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeQr}
                  onChange={(e) => setIncludeQr(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <div>
                  <span className="text-xs font-bold text-slate-200 block">QR-Code für Gäste-Tischbestellung</span>
                  <span className="text-[10px] text-slate-400 block">Druckt Smartphone-Bestellcode mit auf die Tischmarke</span>
                </div>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isPrinting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
                >
                  {isPrinting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Drucken</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
