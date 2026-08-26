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
  LayoutGrid,
  MapPin,
  Move,
  Save,
  AlertTriangle,
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
  openGrossAmount?: number;
}

export default function AdminTablesPage() {
  const { success, error, warning } = useToast();
  const [tables, setTables] = useState<AdminTableRow[]>([]);
  const [printers, setPrinters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'GRID' | 'FLOORPLAN'>('GRID');

  // Modals
  const [showGenModal, setShowGenModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

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
  const [editGridX, setEditGridX] = useState(0);
  const [editGridY, setEditGridY] = useState(0);

  // Single table form
  const [newTableNum, setNewTableNum] = useState<number>(1);
  const [newTableLabel, setNewTableLabel] = useState('');

  // Marker Print form
  const [selectedPrinterId, setSelectedPrinterId] = useState('');
  const [markerStart, setMarkerStart] = useState(1);
  const [markerEnd, setMarkerEnd] = useState(24);
  const [includeQr, setIncludeQr] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Dragging in 2D Floorplan
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const fetchTablesAndPrinters = async () => {
    try {
      const [tRes, pRes] = await Promise.all([
        fetch('/api/tables?all=true'),
        fetch('/api/printers'),
      ]);
      const tData = await tRes.json();
      const pData = await pRes.json();
      if (Array.isArray(tData)) {
        setTables(tData);
        if (tData.length > 0) {
          const maxNum = Math.max(...tData.map((t: AdminTableRow) => t.tableNumber || 1));
          setNewTableNum(maxNum + 1);
          setMarkerEnd(maxNum);
        }
      }
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
        body: JSON.stringify({
          id: t.id,
          isActive: nextActive,
          label: t.label,
          gridX: t.gridX,
          gridY: t.gridY,
          status: t.status,
        }),
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

  const handleDeleteAllTables = async () => {
    try {
      const res = await fetch('/api/tables?all=true', { method: 'DELETE' });
      if (res.ok) {
        setShowDeleteAllModal(false);
        fetchTablesAndPrinters();
        success('Alle Tische wurden erfolgreich gelöscht.');
      } else {
        error('Fehler beim Löschen der Tische.');
      }
    } catch {
      error('Netzwerkfehler beim Löschen.');
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
          gridX: (tables.length % 6) + 1,
          gridY: Math.floor(tables.length / 6) + 1,
        }),
      });
      setShowAddModal(false);
      setNewTableLabel('');
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
    setEditGridX(t.gridX || 1);
    setEditGridY(t.gridY || 1);
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
          label: editTableLabel,
          isActive: editTableActive,
          gridX: editGridX,
          gridY: editGridY,
        }),
      });
      setEditingTable(null);
      fetchTablesAndPrinters();
      success('Tisch aktualisiert');
    } catch {
      error('Fehler beim Speichern');
    }
  };

  const handleGenerateGrid = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/tables', {
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
      if (res.ok) {
        setShowGenModal(false);
        fetchTablesAndPrinters();
        success(`Raster mit ${genRows * genCols} Tischen erfolgreich generiert!`);
      } else {
        error('Fehler beim Generieren');
      }
    } catch {
      error('Fehler beim Generieren');
    }
  };

  const handleDropOnFloor = async (targetX: number, targetY: number) => {
    if (!draggingId) return;
    const table = tables.find((t) => t.id === draggingId);
    if (!table) return;

    // Optimistisches Update
    setTables((prev) =>
      prev.map((t) => (t.id === draggingId ? { ...t, gridX: targetX, gridY: targetY } : t))
    );
    setDraggingId(null);

    try {
      await fetch('/api/tables', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: table.id,
          gridX: targetX,
          gridY: targetY,
        }),
      });
      success(`${table.label} auf Position (${targetX}, ${targetY}) platziert`);
    } catch {
      fetchTablesAndPrinters();
    }
  };

  const handlePrintMarkers = async () => {
    if (!selectedPrinterId) {
      warning('Bitte wähle einen Drucker aus.');
      return;
    }
    setIsPrinting(true);
    try {
      await fetch('/api/tables/print-markers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerId: selectedPrinterId,
          start: markerStart,
          end: markerEnd,
          includeQr,
        }),
      });
      success('Tischmarken wurden an den Drucker gesendet!');
      setShowPrintModal(false);
    } catch {
      error('Fehler beim Drucken der Tischmarken');
    } finally {
      setIsPrinting(false);
    }
  };

  // 2D Saalplan Raster Dimensionen
  const floorCols = 8;
  const floorRows = 6;

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
              Interaktiver Saalplan, Raster-Generator &amp; Bondruck-Tischmarken
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Umschalter Ansicht */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('GRID')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'GRID' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Kacheln</span>
            </button>
            <button
              onClick={() => setViewMode('FLOORPLAN')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'FLOORPLAN' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Interaktiver Saalplan</span>
            </button>
          </div>

          <Link
            href="/admin/tables/print"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition shadow"
          >
            <FileDown className="w-4 h-4 text-blue-400" />
            <span>PDF / Druck</span>
          </Link>

          <button
            onClick={() => setShowPrintModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition"
          >
            <Printer className="w-4 h-4" />
            <span>Tischmarken</span>
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

          <button
            onClick={() => setShowDeleteAllModal(true)}
            disabled={tables.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-xl text-xs font-bold transition disabled:opacity-40"
            title="Löscht alle konfigurierten Tische"
          >
            <Trash2 className="w-4 h-4" />
            <span>Alle Tische löschen</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'GRID' ? (
        /* Kachel-Ansicht */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
            <span>Konfigurierte Tische ({tables.length})</span>
            <span>Aktiv: {tables.filter((t) => t.isActive !== false).length}</span>
          </div>

          {tables.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-3">
              <Grid className="w-12 h-12 mx-auto text-slate-700" />
              <p className="font-bold text-sm">Noch keine Tische vorhanden.</p>
              <p className="text-xs">Klicke oben auf „Raster generieren“ oder „Einzeltisch“.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {tables.map((t) => (
                <div
                  key={t.id}
                  className={`relative rounded-2xl p-3 border transition flex flex-col justify-between min-h-[95px] ${
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
                        title="Bearbeiten"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleTable(t)}
                        className={`p-1 rounded-lg transition ${
                          t.isActive !== false
                            ? 'text-emerald-400 hover:bg-emerald-950'
                            : 'text-slate-500 hover:bg-slate-800'
                        }`}
                        title={t.isActive !== false ? 'Deaktivieren' : 'Aktivieren'}
                      >
                        {t.isActive !== false ? (
                          <ToggleRight className="w-4 h-4" />
                        ) : (
                          <ToggleLeft className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteTable(t)}
                        className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 transition"
                        title="Löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="font-extrabold text-sm truncate">{t.label}</div>

                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Circle
                        className={`w-2 h-2 ${
                          t.isActive !== false
                            ? 'fill-emerald-400 text-emerald-400'
                            : 'fill-slate-600 text-slate-600'
                        }`}
                      />
                      <span>{t.isActive !== false ? 'Aktiv' : 'Inaktiv'}</span>
                    </span>
                    {(t.openItemCount ?? 0) > 0 && (
                      <span className="text-amber-400 font-bold">{t.openItemCount} Bons</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Interaktiver 2D Saalplan Designer */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
            <span className="flex items-center gap-2">
              <Move className="w-4 h-4 text-blue-400" />
              Ziehe Tische auf freie Felder des Saalplans, um das Layout anzupassen.
            </span>
            <span>Raster: {floorCols} x {floorRows}</span>
          </div>

          <div
            className="grid gap-2 p-4 bg-slate-950 rounded-2xl border border-slate-800 overflow-x-auto min-w-[700px]"
            style={{
              gridTemplateColumns: `repeat(${floorCols}, minmax(80px, 1fr))`,
              gridTemplateRows: `repeat(${floorRows}, minmax(80px, 1fr))`,
            }}
          >
            {Array.from({ length: floorRows }).map((_, rIdx) => {
              const y = rIdx + 1;
              return Array.from({ length: floorCols }).map((__, cIdx) => {
                const x = cIdx + 1;
                const tableOnCell = tables.find(
                  (t) => (t.gridX || 1) === x && (t.gridY || 1) === y
                );

                return (
                  <div
                    key={`cell-${x}-${y}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDropOnFloor(x, y)}
                    onClick={() => {
                      if (draggingId && !tableOnCell) {
                        handleDropOnFloor(x, y);
                      }
                    }}
                    className={`relative rounded-2xl border transition flex flex-col items-center justify-center p-2 min-h-[85px] select-none ${
                      tableOnCell
                        ? tableOnCell.isActive !== false
                          ? 'bg-blue-950/70 border-blue-600 text-white cursor-grab shadow'
                          : 'bg-slate-900/60 border-slate-800 text-slate-500 opacity-60'
                        : draggingId
                        ? 'border-dashed border-blue-500/50 bg-blue-950/20 hover:bg-blue-900/40 cursor-pointer'
                        : 'border-slate-800/80 bg-slate-950 hover:border-slate-700'
                    }`}
                  >
                    {tableOnCell ? (
                      <div
                        draggable
                        onDragStart={() => setDraggingId(tableOnCell.id)}
                        onDragEnd={() => setDraggingId(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(tableOnCell);
                        }}
                        className="w-full text-center space-y-1"
                      >
                        <div className="text-[10px] font-mono font-bold text-blue-300">
                          #{tableOnCell.tableNumber}
                        </div>
                        <div className="text-xs font-black truncate">{tableOnCell.label}</div>
                        <div className="text-[9px] text-slate-400 font-mono">({x},{y})</div>
                      </div>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-700">
                        {x},{y}
                      </span>
                    )}
                  </div>
                );
              });
            })}
          </div>
        </div>
      )}

      {/* Generator Modal */}
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-center font-bold"
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-center font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Startnummer</label>
                  <input
                    type="number"
                    min="1"
                    value={genStart}
                    onChange={(e) => setGenStart(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-center font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Schrittweite</label>
                  <input
                    type="number"
                    min="1"
                    value={genStep}
                    onChange={(e) => setGenStep(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-center font-bold"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-950/40 border border-blue-800 rounded-xl text-xs text-blue-200">
                Erzeugt insgesamt <strong>{genRows * genCols}</strong> Tische von Tisch {genStart} bis Tisch{' '}
                {genStart + (genRows * genCols - 1) * genStep}.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGenModal(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow"
                >
                  Raster generieren
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Single Table Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
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
                  min="1"
                  value={newTableNum}
                  onChange={(e) => setNewTableNum(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Bezeichnung / Label</label>
                <input
                  type="text"
                  value={newTableLabel}
                  onChange={(e) => setNewTableLabel(e.target.value)}
                  placeholder={`z. B. Tisch ${newTableNum} oder Stehtisch 3`}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow"
                >
                  Hinzufügen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-white">Tisch bearbeiten</h3>
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
                  min="1"
                  value={editTableNum}
                  onChange={(e) => setEditTableNum(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Bezeichnung</label>
                <input
                  type="text"
                  value={editTableLabel}
                  onChange={(e) => setEditTableLabel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Position X</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={editGridX}
                    onChange={(e) => setEditGridX(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-center"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Position Y</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={editGridY}
                    onChange={(e) => setEditGridY(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-center"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-xs font-bold text-slate-300">Tisch aktiv</span>
                <button
                  type="button"
                  onClick={() => setEditTableActive(!editTableActive)}
                  className={`p-1.5 rounded-lg ${
                    editTableActive ? 'text-emerald-400' : 'text-slate-600'
                  }`}
                >
                  {editTableActive ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                </button>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTable(null)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Modal */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-rose-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-8 h-8 shrink-0" />
              <div>
                <h3 className="font-black text-lg text-white">Alle Tische wirklich löschen?</h3>
                <p className="text-xs text-rose-300">Diese Aktion kann nicht rückgängig gemacht werden.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-2xl border border-slate-800">
              Es werden alle <strong>{tables.length}</strong> Tische aus der Datenbank entfernt. Offene Bestellungen
              sollten vor dem Löschen abgeschlossen werden.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-white"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleDeleteAllTables}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow"
              >
                Endgültig löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Marker Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-white">Tischmarken drucken</h3>
              <button
                onClick={() => setShowPrintModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Bondrucker</label>
                <select
                  value={selectedPrinterId}
                  onChange={(e) => setSelectedPrinterId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-xs font-bold"
                >
                  {printers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.ipAddress || 'Virtuell'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Von Tisch-Nr.</label>
                  <input
                    type="number"
                    min="1"
                    value={markerStart}
                    onChange={(e) => setMarkerStart(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-center font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Bis Tisch-Nr.</label>
                  <input
                    type="number"
                    min="1"
                    value={markerEnd}
                    onChange={(e) => setMarkerEnd(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-center font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <span className="text-xs font-bold text-slate-300 block">QR-Code aufdrucken</span>
                  <span className="text-[10px] text-slate-500">Für QR-Bestellung der Gäste</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIncludeQr(!includeQr)}
                  className={`p-1.5 rounded-lg ${includeQr ? 'text-emerald-400' : 'text-slate-600'}`}
                >
                  {includeQr ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                </button>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  disabled={isPrinting}
                  onClick={handlePrintMarkers}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isPrinting ? 'Druckt...' : 'Jetzt drucken'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
