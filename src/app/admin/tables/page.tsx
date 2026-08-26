'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Grid,
  Plus,
  Printer,
  Sliders,
  Trash2,
  X,
  FileDown,
  Circle,
  Edit2,
  Move,
  Footprints,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  QrCode,
  Eye,
  Check,
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

interface AisleItem {
  id: string;
  type: 'COL' | 'ROW';
  index: number; // grid position after which the aisle is located
}

export default function AdminTablesPage() {
  const { success, error, warning } = useToast();
  const [tables, setTables] = useState<AdminTableRow[]>([]);
  const [printers, setPrinters] = useState<any[]>([]);
  const [aisles, setAisles] = useState<AisleItem[]>([]);
  const [eventName, setEventName] = useState('Festveranstaltung 2026');
  const [baseUrl, setBaseUrl] = useState('http://openbon.local');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showGenModal, setShowGenModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  // Generator form
  const [genRows, setGenRows] = useState(4);
  const [genCols, setGenCols] = useState(6);
  const [genStart, setGenStart] = useState(10);
  const [genStepX, setGenStepX] = useState(1);
  const [genStepY, setGenStepY] = useState(10);

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

  // Marker Print & Preview form
  const [selectedPrinterId, setSelectedPrinterId] = useState('');
  const [markerStart, setMarkerStart] = useState(1);
  const [markerEnd, setMarkerEnd] = useState(24);
  const [markerFontSize, setMarkerFontSize] = useState<number>(4);
  const [markerQrSize, setMarkerQrSize] = useState<number>(5);
  const [markerNoteText, setMarkerNoteText] = useState('Tischnummer bitte bei Bestellung angeben');
  const [markerPaperWidth, setMarkerPaperWidth] = useState<80 | 58>(80);
  const [includeQr, setIncludeQr] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);

  // Dragging in Floorplan
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Insert Menu Popup
  const [insertPopup, setInsertPopup] = useState<{
    type: 'COL' | 'ROW';
    index: number;
    posX: number;
    posY: number;
  } | null>(null);

  const fetchTablesAndPrinters = async () => {
    try {
      const [tRes, pRes, cfgRes] = await Promise.all([
        fetch('/api/tables?all=true'),
        fetch('/api/printers'),
        fetch('/api/config'),
      ]);
      const tData = await tRes.json();
      const pData = await pRes.json();
      const cfgData = await cfgRes.json();

      if (Array.isArray(tData)) setTables(tData);
      if (Array.isArray(pData)) {
        setPrinters(pData);
        if (pData.length > 0 && !selectedPrinterId) {
          setSelectedPrinterId(pData[0].id);
        }
      }
      if (cfgData) {
        if (cfgData.name) setEventName(cfgData.name);
        if (cfgData.baseUrl) setBaseUrl(cfgData.baseUrl);
        if (cfgData.tableMarkerFontSize) setMarkerFontSize(Number(cfgData.tableMarkerFontSize));
        if (cfgData.aisles) {
          try {
            const parsed = JSON.parse(cfgData.aisles);
            if (Array.isArray(parsed)) setAisles(parsed);
          } catch {}
        }
      }
    } catch {
      error('Fehler beim Laden der Tisch- und Druckerdaten');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTablesAndPrinters();
  }, []);

  // Sync Aisles mit Backend Config
  const saveAislesToConfig = async (newAisles: AisleItem[]) => {
    try {
      await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aisles: JSON.stringify(newAisles) }),
      });
    } catch {
      console.error('Failed to sync aisles');
    }
  };

  const handleToggleTableStatus = async (table: AdminTableRow) => {
    const newActive = table.isActive === false ? true : false;
    try {
      await fetch('/api/tables', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: table.id, isActive: newActive }),
      });
      fetchTablesAndPrinters();
      success(`Tisch ${table.label} ${newActive ? 'aktiviert' : 'deaktiviert'}`);
    } catch {
      error('Fehler beim Ändern des Tischstatus');
    }
  };

  const handleDeleteTable = async (id: string) => {
    try {
      await fetch(`/api/tables?id=${id}`, { method: 'DELETE' });
      fetchTablesAndPrinters();
      success('Tisch gelöscht');
    } catch {
      error('Fehler beim Löschen des Tisches');
    }
  };

  const handleDeleteAllTables = async () => {
    try {
      const res = await fetch('/api/tables?all=true', { method: 'DELETE' });
      if (res.ok) {
        setShowDeleteAllModal(false);
        setAisles([]);
        await saveAislesToConfig([]);
        fetchTablesAndPrinters();
        success('Alle Tische und Gänge wurden erfolgreich gelöscht.');
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
      const maxX = tables.reduce((max, t) => Math.max(max, t.gridX || 1), 1);
      await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber: newTableNum,
          label: newTableLabel || `Tisch ${newTableNum}`,
          gridX: (tables.length % maxX) + 1,
          gridY: Math.floor(tables.length / maxX) + 1,
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
          stepX: genStepX,
          stepY: genStepY,
        }),
      });
      if (res.ok) {
        setShowGenModal(false);
        setAisles([]);
        await saveAislesToConfig([]);
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

  // Gang (Aisle) oder Spalte/Reihe einfügen
  const handleInsertStructure = async (type: 'COL' | 'ROW', index: number, isAisle: boolean) => {
    setInsertPopup(null);
    let updatedTables = [...tables];
    let updatedAisles = [...aisles];

    if (type === 'COL') {
      updatedTables = updatedTables.map((t) => (t.gridX > index ? { ...t, gridX: t.gridX + 1 } : t));
      updatedAisles = updatedAisles.map((a) => (a.type === 'COL' && a.index > index ? { ...a, index: a.index + 1 } : a));
      if (isAisle) {
        updatedAisles.push({ id: Math.random().toString(36).substring(2, 9), type: 'COL', index: index + 1 });
      }
    } else {
      updatedTables = updatedTables.map((t) => (t.gridY > index ? { ...t, gridY: t.gridY + 1 } : t));
      updatedAisles = updatedAisles.map((a) => (a.type === 'ROW' && a.index > index ? { ...a, index: a.index + 1 } : a));
      if (isAisle) {
        updatedAisles.push({ id: Math.random().toString(36).substring(2, 9), type: 'ROW', index: index + 1 });
      }
    }

    setTables(updatedTables);
    setAisles(updatedAisles);
    await saveAislesToConfig(updatedAisles);

    try {
      await Promise.all(
        updatedTables.map((t) =>
          fetch('/api/tables', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: t.id, gridX: t.gridX, gridY: t.gridY }),
          })
        )
      );
      success(isAisle ? 'Gang erfolgreich eingefügt' : 'Neue Reihe/Spalte eingefügt');
    } catch {
      fetchTablesAndPrinters();
    }
  };

  // Gang (Aisle) löschen
  const handleDeleteAisle = async (aisleId: string) => {
    const targetAisle = aisles.find((a) => a.id === aisleId);
    if (!targetAisle) return;

    let updatedAisles = aisles.filter((a) => a.id !== aisleId);
    let updatedTables = [...tables];

    if (targetAisle.type === 'COL') {
      updatedTables = updatedTables.map((t) => (t.gridX > targetAisle.index ? { ...t, gridX: t.gridX - 1 } : t));
      updatedAisles = updatedAisles.map((a) => (a.type === 'COL' && a.index > targetAisle.index ? { ...a, index: a.index - 1 } : a));
    } else {
      updatedTables = updatedTables.map((t) => (t.gridY > targetAisle.index ? { ...t, gridY: t.gridY - 1 } : t));
      updatedAisles = updatedAisles.map((a) => (a.type === 'ROW' && a.index > targetAisle.index ? { ...a, index: a.index - 1 } : a));
    }

    setTables(updatedTables);
    setAisles(updatedAisles);
    await saveAislesToConfig(updatedAisles);

    try {
      await Promise.all(
        updatedTables.map((t) =>
          fetch('/api/tables', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: t.id, gridX: t.gridX, gridY: t.gridY }),
          })
        )
      );
      success('Gang entfernt');
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
      const res = await fetch('/api/tables/print-markers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerId: selectedPrinterId,
          start: markerStart,
          end: markerEnd,
          fontSize: markerFontSize,
          qrSize: markerQrSize,
          noteText: markerNoteText,
          includeQr,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        success(`${data.count || 0} Tischmarken wurden an den Drucker gesendet!`);
        setShowPrintModal(false);
      } else {
        const data = await res.json().catch(() => ({}));
        error(data.error || 'Fehler beim Drucken der Tischmarken');
      }
    } catch {
      error('Fehler beim Drucken der Tischmarken');
    } finally {
      setIsPrinting(false);
    }
  };

  // 2D Saalplan Dimensionen berechnen
  const maxTableX = tables.reduce((max, t) => Math.max(max, t.gridX || 1), 0);
  const maxTableY = tables.reduce((max, t) => Math.max(max, t.gridY || 1), 0);
  const maxAisleX = aisles.filter((a) => a.type === 'COL').reduce((max, a) => Math.max(max, a.index), 0);
  const maxAisleY = aisles.filter((a) => a.type === 'ROW').reduce((max, a) => Math.max(max, a.index), 0);

  const floorCols = Math.max(tables.length > 0 ? 6 : 0, maxTableX, maxAisleX);
  const floorRows = Math.max(tables.length > 0 ? 4 : 0, maxTableY, maxAisleY);

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
              Interaktiver Saalplan mit durchgehenden Gängen, Schrittweiten-Generator &amp; Tischmarken
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/tables/print"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition shadow"
          >
            <FileDown className="w-4 h-4 text-sky-400" />
            <span>Raumplan drucken / PDF</span>
          </Link>

          <button
            onClick={() => {
              if (tables.length > 0) {
                const nums = tables.map((t) => t.tableNumber);
                setMarkerStart(Math.min(...nums));
                setMarkerEnd(Math.max(...nums));
              }
              setShowPrintModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow"
          >
            <Printer className="w-4 h-4" />
            <span>Tischmarken einstellen &amp; drucken</span>
          </button>

          <button
            onClick={() => {
              setNewTableNum(tables.length > 0 ? Math.max(...tables.map((t) => t.tableNumber)) + 1 : 1);
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition"
          >
            <Plus className="w-4 h-4" />
            <span>Tisch hinzufügen</span>
          </button>

          <button
            onClick={() => setShowGenModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow"
          >
            <Sliders className="w-4 h-4" />
            <span>Raster generieren</span>
          </button>

          <button
            onClick={() => setShowDeleteAllModal(true)}
            disabled={tables.length === 0 && aisles.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-xl text-xs font-bold transition disabled:opacity-40"
            title="Löscht alle konfigurierten Tische und Gänge"
          >
            <Trash2 className="w-4 h-4" />
            <span>Alle löschen</span>
          </button>
        </div>
      </div>

      {/* Interaktiver Saalplan (Alleinige Hauptansicht) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 font-bold">
          <span className="flex items-center gap-2">
            <Move className="w-4 h-4 text-blue-400" />
            Ziehe Tische auf freie Felder. Klicke auf die <span className="text-blue-400 font-black px-1.5 py-0.5 bg-blue-950/80 rounded border border-blue-800">+</span> Symbole zwischen den Spalten/Reihen, um Gänge oder neue Reihen einzufügen.
          </span>
          <div className="flex items-center gap-3">
            <span className="bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
              Tische: <strong className="text-white">{tables.length}</strong>
            </span>
            <span className="bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
              Gänge: <strong className="text-amber-400">{aisles.length}</strong>
            </span>
            {floorCols > 0 && (
              <span className="bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
                Raster: <strong className="text-blue-400">{floorCols} × {floorRows}</strong>
              </span>
            )}
          </div>
        </div>

        {tables.length === 0 && aisles.length === 0 ? (
          <div className="text-center py-16 px-4 bg-slate-950/60 border border-dashed border-slate-800 rounded-2xl space-y-3">
            <Grid className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-300">Noch kein Tischplan angelegt</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Nutze den Generator, um ein geordnetes Tischraster mit Reihen, Spalten und Schrittweiten zu erstellen, oder füge einzelne Tische manuell hinzu.
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={() => setShowGenModal(true)}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow"
              >
                Raster jetzt generieren
              </button>
            </div>
          </div>
        ) : (
          /* Column Insert Header Toolbar (+ Buttons between columns) */
          <div className="overflow-x-auto pb-4">
            <div className="inline-block min-w-full">
              {/* Top Column + Insert Handles */}
              <div className="flex items-center gap-2 mb-2 pl-10">
                {Array.from({ length: floorCols }).map((_, cIdx) => {
                  const colNum = cIdx + 1;
                  const isColAisle = aisles.some((a) => a.type === 'COL' && a.index === colNum);
                  const aisleColObj = aisles.find((a) => a.type === 'COL' && a.index === colNum);

                  return (
                    <React.Fragment key={`col-header-${colNum}`}>
                      <div
                        className={`${
                          isColAisle ? 'w-[48px]' : 'w-[90px]'
                        } text-center font-mono text-[10px] font-bold py-1 rounded border flex items-center justify-between px-1 ${
                          isColAisle
                            ? 'bg-amber-950/40 border-amber-800 text-amber-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        <span className="truncate flex-1">{isColAisle ? 'Gang' : `S${colNum}`}</span>
                        {isColAisle && aisleColObj && (
                          <button
                            onClick={() => handleDeleteAisle(aisleColObj.id)}
                            className="text-rose-400 hover:text-rose-200 p-0.5"
                            title="Gang löschen"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Intermediate Column + Insert Handle */}
                      {colNum < floorCols && (
                        <button
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setInsertPopup({
                              type: 'COL',
                              index: colNum,
                              posX: rect.left - 10,
                              posY: rect.bottom + 8,
                            });
                          }}
                          className="w-5 h-5 -mx-1.5 shrink-0 rounded-full bg-blue-950 hover:bg-blue-600 border border-blue-700 text-blue-300 hover:text-white flex items-center justify-center text-xs font-black shadow transition active:scale-95 z-10"
                          title={`Gang oder Spalte nach Spalte ${colNum} einfügen`}
                        >
                          +
                        </button>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Saalplan Raster Matrix */}
              <div className="flex flex-col gap-0">
                {Array.from({ length: floorRows }).map((_, rIdx) => {
                  const rowNum = rIdx + 1;
                  const isRowAisle = aisles.some((a) => a.type === 'ROW' && a.index === rowNum);
                  const aisleRowObj = aisles.find((a) => a.type === 'ROW' && a.index === rowNum);

                  return (
                    <div key={`row-wrap-${rowNum}`} className="space-y-0">
                      <div className="flex items-stretch gap-2 my-1">
                        {/* Left Row Label & + Insert Handle */}
                        <div className="w-8 flex flex-col items-center justify-center shrink-0">
                          <div
                            className={`text-center font-mono text-[10px] font-bold px-1 py-1 rounded border ${
                              isRowAisle
                                ? 'bg-amber-950/40 border-amber-800 text-amber-300'
                                : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}
                          >
                            {isRowAisle ? <Footprints className="w-3.5 h-3.5 mx-auto text-amber-400" /> : `R${rowNum}`}
                          </div>
                        </div>

                        {/* Row Cells */}
                        {isRowAisle ? (
                          /* Horizontal Walkway / Gang */
                          <div className="flex-1 min-h-[48px] bg-amber-950/20 border-2 border-dashed border-amber-600/50 rounded-2xl flex items-center justify-between px-4 text-amber-300 font-bold text-xs select-none">
                            <span className="flex items-center gap-2">
                              <Footprints className="w-4 h-4 text-amber-400" />
                              <span>GANG / LAUFWEG (Reihe {rowNum})</span>
                            </span>
                            <button
                              onClick={() => aisleRowObj && handleDeleteAisle(aisleRowObj.id)}
                              className="p-1.5 rounded-lg bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 flex items-center gap-1 text-[11px] font-bold transition shadow"
                              title="Gang entfernen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Gang löschen</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-stretch gap-2">
                            {Array.from({ length: floorCols }).map((__, cIdx) => {
                              const colNum = cIdx + 1;
                              const isColAisle = aisles.some((a) => a.type === 'COL' && a.index === colNum);
                              const aisleColObj = aisles.find((a) => a.type === 'COL' && a.index === colNum);

                              if (isColAisle) {
                                /* Durchgehender vertikaler Laufweg / Gang */
                                const isFirst = rowNum === 1;
                                const isLast = rowNum === floorRows;

                                return (
                                  <div
                                    key={`aisle-col-cell-${colNum}-${rowNum}`}
                                    className={`w-[48px] min-h-[85px] bg-amber-950/20 border-x-2 border-dashed border-amber-600/50 flex flex-col items-center justify-center p-1 text-amber-400 text-[10px] font-bold select-none relative group ${
                                      isFirst ? 'border-t-2 rounded-t-2xl' : ''
                                    } ${isLast ? 'border-b-2 rounded-b-2xl' : ''}`}
                                  >
                                    <Footprints className="w-4 h-4 opacity-80" />
                                    <span className="text-[8px] uppercase tracking-wider text-amber-500/90 font-black mt-1">
                                      Gang
                                    </span>
                                    {rowNum === 1 && aisleColObj && (
                                      <button
                                        onClick={() => handleDeleteAisle(aisleColObj.id)}
                                        className="absolute -top-2 bg-rose-900 hover:bg-rose-700 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition"
                                        title="Spalten-Gang löschen"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                );
                              }

                              const tableOnCell = tables.find(
                                (t) => (t.gridX || 1) === colNum && (t.gridY || 1) === rowNum
                              );

                              return (
                                <div
                                  key={`cell-${colNum}-${rowNum}`}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={() => handleDropOnFloor(colNum, rowNum)}
                                  onClick={() => {
                                    if (draggingId && !tableOnCell) {
                                      handleDropOnFloor(colNum, rowNum);
                                    }
                                  }}
                                  className={`w-[90px] relative rounded-2xl border transition flex flex-col items-center justify-center p-2 min-h-[85px] select-none ${
                                    tableOnCell
                                      ? tableOnCell.isActive !== false
                                        ? 'bg-blue-950/70 border-blue-600 text-white cursor-grab shadow-md hover:border-blue-400 hover:bg-blue-900/60'
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
                                      <div className="text-[11px] font-mono font-black text-blue-300">
                                        #{tableOnCell.tableNumber}
                                      </div>
                                      <div className="text-xs font-black truncate">{tableOnCell.label}</div>
                                      <div className="text-[9px] text-slate-400 font-mono">
                                        ({colNum},{rowNum})
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-[9px] font-mono text-slate-700">
                                      {colNum},{rowNum}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Intermediate Row + Insert Handle */}
                      {rowNum < floorRows && (
                        <div className="flex items-center pl-1.5 my-1">
                          <button
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setInsertPopup({
                                type: 'ROW',
                                index: rowNum,
                                posX: rect.right + 8,
                                posY: rect.top - 10,
                              });
                            }}
                            className="w-5 h-5 rounded-full bg-blue-950 hover:bg-blue-600 border border-blue-700 text-blue-300 hover:text-white flex items-center justify-center text-xs font-black shadow transition active:scale-95"
                            title={`Gang oder Reihe nach Reihe ${rowNum} einfügen`}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Insert Menu Popup Modal */}
      {insertPopup && (
        <div
          className="fixed z-50 bg-slate-900 border border-blue-500/80 rounded-2xl p-2.5 shadow-2xl space-y-1 animate-in zoom-in-95 text-xs"
          style={{ top: insertPopup.posY, left: insertPopup.posX }}
        >
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
            Einfügen nach {insertPopup.type === 'COL' ? `Spalte ${insertPopup.index}` : `Reihe ${insertPopup.index}`}
          </div>
          <button
            onClick={() => handleInsertStructure(insertPopup.type, insertPopup.index, true)}
            className="w-full text-left px-3 py-2 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/60 text-amber-200 font-bold flex items-center gap-2 transition"
          >
            <Footprints className="w-4 h-4 text-amber-400" />
            <span>Laufweg / Gang einfügen</span>
          </button>
          <button
            onClick={() => handleInsertStructure(insertPopup.type, insertPopup.index, false)}
            className="w-full text-left px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4 text-blue-400" />
            <span>Leere {insertPopup.type === 'COL' ? 'Spalte' : 'Reihe'} einfügen</span>
          </button>
          <button
            onClick={() => setInsertPopup(null)}
            className="w-full text-center py-1 text-[10px] text-slate-500 hover:text-slate-300"
          >
            Abbrechen
          </button>
        </div>
      )}

      {/* Generator Modal */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-lg text-white">Tischraster automatisch generieren</h3>
              </div>
              <button
                onClick={() => setShowGenModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGenerateGrid} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Reihen (Y-Achse)</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={genRows}
                    onChange={(e) => setGenRows(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-center font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Spalten (X-Achse)</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={genCols}
                    onChange={(e) => setGenCols(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-center font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Startnummer (1. Tisch)</label>
                <input
                  type="number"
                  min={1}
                  value={genStart}
                  onChange={(e) => setGenStart(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-center font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Schrittweite X (Spalte)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={genStepX}
                    onChange={(e) => setGenStepX(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-center font-bold"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">z.B. +1: 10, 11, 12, 13</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Schrittweite Y (Reihe)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={genStepY}
                    onChange={(e) => setGenStepY(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-center font-bold"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">z.B. +10: R1: 10.., R2: 20..</p>
                </div>
              </div>

              {/* Live Voransicht der Zahlen */}
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Muster-Vorschau:</span>
                <div className="font-mono text-xs text-blue-300 space-y-0.5">
                  <div>R1: {genStart}, {genStart + genStepX}, {genStart + genStepX * 2}, ...</div>
                  <div>R2: {genStart + genStepY}, {genStart + genStepY + genStepX}, ...</div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGenModal(false)}
                  className="flex-1 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-bold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="flex-1 p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg"
                >
                  Generieren
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
            <h3 className="font-bold text-lg text-white">Neuen Tisch hinzufügen</h3>
            <form onSubmit={handleAddTable} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Tischnummer</label>
                <input
                  type="number"
                  min={1}
                  value={newTableNum}
                  onChange={(e) => setNewTableNum(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono font-bold"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Bezeichnung (optional)</label>
                <input
                  type="text"
                  placeholder={`Tisch ${newTableNum}`}
                  value={newTableLabel}
                  onChange={(e) => setNewTableLabel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-bold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="flex-1 p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg"
                >
                  Hinzufügen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Table Modal */}
      {editingTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-white">Tisch #{editingTable.tableNumber} bearbeiten</h3>
              <button
                onClick={() => setEditingTable(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Tischnummer</label>
                <input
                  type="number"
                  min={1}
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Position Spalte (X)</label>
                  <input
                    type="number"
                    min={1}
                    value={editGridX}
                    onChange={(e) => setEditGridX(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-center"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Position Reihe (Y)</label>
                  <input
                    type="number"
                    min={1}
                    value={editGridY}
                    onChange={(e) => setEditGridY(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-center"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editTableActive}
                  onChange={(e) => setEditTableActive(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <span className="text-xs font-bold text-slate-300">Tisch im Serviceplan aktiv</span>
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteTable(editingTable.id);
                    setEditingTable(null);
                  }}
                  className="p-3 rounded-xl bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold"
                  title="Tisch löschen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTable(null)}
                  className="flex-1 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-bold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="flex-1 p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tischmarken-Konfigurator mit Live-Bonvorschau */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-indigo-700/80 rounded-3xl p-6 max-w-4xl w-full shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 text-indigo-400">
                <Printer className="w-6 h-6" />
                <h3 className="font-black text-lg text-white">Tischmarken-Konfigurator &amp; Druck</h3>
              </div>
              <button
                onClick={() => setShowPrintModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Form & Sliders */}
              <div className="lg:col-span-7 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Drucker auswählen</label>
                  <select
                    value={selectedPrinterId}
                    onChange={(e) => setSelectedPrinterId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-bold focus:border-indigo-500"
                  >
                    {printers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.ipAddress}:{p.port || 9100}) - {p.paperWidth || 80}mm
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Von Tischnummer</label>
                    <input
                      type="number"
                      value={markerStart}
                      onChange={(e) => setMarkerStart(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Bis Tischnummer</label>
                    <input
                      type="number"
                      value={markerEnd}
                      onChange={(e) => setMarkerEnd(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-center font-bold"
                    />
                  </div>
                </div>

                {/* Schriftgröße Tischzahl Slider (1-10) */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span>Schriftgröße Tischzahl</span>
                    <span className="font-mono text-indigo-400">Stufe {markerFontSize} / 10</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={markerFontSize}
                    onChange={(e) => setMarkerFontSize(parseInt(e.target.value, 10))}
                    className="w-full accent-indigo-500"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                    <span>1: Fein</span>
                    <span>4: Standard</span>
                    <span>7: Groß</span>
                    <span>10: Vollbreite</span>
                  </div>
                </div>

                {/* QR-Code Größe Slider (1-10) */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span>QR-Code Größe</span>
                    <span className="font-mono text-indigo-400">Stufe {markerQrSize} / 10</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    disabled={!includeQr}
                    value={markerQrSize}
                    onChange={(e) => setMarkerQrSize(parseInt(e.target.value, 10))}
                    className="w-full accent-indigo-500 disabled:opacity-30"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                    <span>1: Klein</span>
                    <span>5: Mittel</span>
                    <span>8: Groß</span>
                    <span>10: Vollbreite</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Hinweistext auf der Tischmarke</label>
                  <input
                    type="text"
                    value={markerNoteText}
                    onChange={(e) => setMarkerNoteText(e.target.value)}
                    placeholder="z. B. Tischnummer bitte bei Bestellung angeben"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white font-bold"
                  />
                </div>

                <label className="flex items-center gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeQr}
                    onChange={(e) => setIncludeQr(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600"
                  />
                  <span className="text-xs font-bold text-slate-300">
                    Gast-QR-Code für Smartphone-Bestellung mitdrucken
                  </span>
                </label>
              </div>

              {/* Right Column: Live Bonvorschau */}
              <div className="lg:col-span-5 flex flex-col items-center justify-start space-y-3 bg-slate-950 p-4 rounded-3xl border border-slate-800">
                <div className="w-full flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Live Bonvorschau</span>
                  </span>
                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px] font-bold font-mono">
                    <button
                      type="button"
                      onClick={() => setMarkerPaperWidth(80)}
                      className={`px-2 py-0.5 rounded-lg ${markerPaperWidth === 80 ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                    >
                      80 mm
                    </button>
                    <button
                      type="button"
                      onClick={() => setMarkerPaperWidth(58)}
                      className={`px-2 py-0.5 rounded-lg ${markerPaperWidth === 58 ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                    >
                      58 mm
                    </button>
                  </div>
                </div>

                {/* Thermal Ticket Mockup */}
                <div
                  className={`bg-white text-black p-5 rounded-2xl shadow-2xl font-mono text-center transition-all ${
                    markerPaperWidth === 58 ? 'w-[230px]' : 'w-[290px]'
                  }`}
                >
                  <div className="text-xs font-bold uppercase tracking-tight">{eventName}</div>
                  <div className="my-1 border-b-2 border-dashed border-black" />
                  
                  {/* Table Label with Scalable Font Size */}
                  <div
                    className="font-black my-3 uppercase tracking-tighter"
                    style={{
                      fontSize: `${Math.max(14, Math.min(38, 12 + markerFontSize * 2.6))}px`,
                      lineHeight: '1.1',
                    }}
                  >
                    TISCH {markerStart}
                  </div>

                  <div className="my-1 border-b-2 border-dashed border-black" />

                  {/* QR Code Mockup */}
                  {includeQr && (
                    <div className="py-2 flex flex-col items-center justify-center">
                      <div
                        className="bg-slate-100 border-2 border-black rounded-lg flex items-center justify-center p-2 mx-auto"
                        style={{
                          width: `${Math.max(60, Math.min(180, 50 + markerQrSize * 13))}px`,
                          height: `${Math.max(60, Math.min(180, 50 + markerQrSize * 13))}px`,
                        }}
                      >
                        <QrCode className="w-full h-full text-black" />
                      </div>
                      <div className="text-[10px] font-bold mt-1 text-slate-800">
                        HIER MIT DEM HANDY SCANNEN
                      </div>
                    </div>
                  )}

                  {markerNoteText && (
                    <div className="text-[11px] font-bold text-slate-700 mt-1">
                      {markerNoteText}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowPrintModal(false)}
                className="flex-1 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-bold text-slate-300"
              >
                Schließen
              </button>
              <button
                onClick={handlePrintMarkers}
                disabled={isPrinting}
                className="flex-1 p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-black shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>{isPrinting ? 'Wird an Drucker gesendet...' : 'Tischmarken jetzt drucken'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Modal */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-rose-800/60 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-lg text-white">Alle Tische &amp; Gänge löschen?</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Möchtest du wirklich alle {tables.length} Tische und {aisles.length} Gänge vollständig aus dem Raumplan entfernen? Bereits erfasste historische Buchungen bleiben im Journal erhalten.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowDeleteAllModal(false)}
                className="flex-1 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-bold"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDeleteAllTables}
                className="flex-1 p-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold shadow-lg"
              >
                Ja, alle löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
