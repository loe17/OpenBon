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
  DoorOpen,
  UtensilsCrossed,
  Wine,
  Music,
  Landmark,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import type { LandmarkItem } from '@/types/domain';

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
  const [landmarks, setLandmarks] = useState<LandmarkItem[]>([]);
  const [editingLandmark, setEditingLandmark] = useState<LandmarkItem | null>(null);
  const [showLandmarkModal, setShowLandmarkModal] = useState(false);
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
  const [markerCopiesPerTable, setMarkerCopiesPerTable] = useState<number>(2);
  const [markerFontSize, setMarkerFontSize] = useState<number>(4);
  const [markerQrSize, setMarkerQrSize] = useState<number>(5);
  const [markerNoteText, setMarkerNoteText] = useState('');
  const [markerPaperWidth, setMarkerPaperWidth] = useState<80 | 58>(80);
  const [includeQr, setIncludeQr] = useState(true);
  const [markerNumberOnly, setMarkerNumberOnly] = useState(false);
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
        if (cfgData.tablePlanLandmarks) {
          try {
            const parsed = JSON.parse(cfgData.tablePlanLandmarks);
            if (Array.isArray(parsed)) setLandmarks(parsed);
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

  // Sync Landmarks mit Backend Config
  const saveLandmarksToConfig = async (newLms: LandmarkItem[]) => {
    try {
      await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tablePlanLandmarks: JSON.stringify(newLms) }),
      });
    } catch {
      console.error('Failed to sync landmarks');
    }
  };

  const handleSaveLandmark = async (lm: LandmarkItem) => {
    let updated: LandmarkItem[];
    if (lm.id) {
      updated = landmarks.map((item) => (item.id === lm.id ? lm : item));
    } else {
      const newId = Math.random().toString(36).substring(2, 9);
      updated = [...landmarks, { ...lm, id: newId }];
    }
    setLandmarks(updated);
    setShowLandmarkModal(false);
    setEditingLandmark(null);
    await saveLandmarksToConfig(updated);
    success('Randfeld gespeichert');
  };

  const handleDeleteLandmark = async (id: string) => {
    const updated = landmarks.filter((item) => item.id !== id);
    setLandmarks(updated);
    setShowLandmarkModal(false);
    setEditingLandmark(null);
    await saveLandmarksToConfig(updated);
    success('Randfeld entfernt');
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
        setLandmarks([]);
        await Promise.all([saveAislesToConfig([]), saveLandmarksToConfig([])]);
        fetchTablesAndPrinters();
        success('Alle Tische, Gänge und Randfelder wurden gelöscht.');
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
          copiesPerTable: markerCopiesPerTable,
          fontSize: markerFontSize,
          qrSize: markerQrSize,
          noteText: markerNoteText,
          includeQr,
          numberOnly: markerNumberOnly,
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

  const getColWidthPx = (colIdx: number) => {
    const isColAisle = aisles.some((a) => a.type === 'COL' && a.index === colIdx);
    return isColAisle ? 48 : 90;
  };

  const getRowHeightPx = (rowIdx: number) => {
    const isRowAisle = aisles.some((a) => a.type === 'ROW' && a.index === rowIdx);
    return isRowAisle ? 48 : 85;
  };

  const getLandmarkColorClass = (color?: string) => {
    switch (color) {
      case 'rose':
        return 'bg-rose-950/80 border-rose-500/80 text-rose-200';
      case 'blue':
        return 'bg-blue-950/80 border-blue-500/80 text-blue-200';
      case 'amber':
        return 'bg-amber-950/80 border-amber-500/80 text-amber-200';
      case 'purple':
        return 'bg-purple-950/80 border-purple-500/80 text-purple-200';
      case 'slate':
        return 'bg-slate-800 border-slate-600 text-slate-200';
      case 'emerald':
      default:
        return 'bg-emerald-950/80 border-emerald-500/80 text-emerald-200';
    }
  };

  const renderHorizontalLandmarkBar = (side: 'TOP' | 'BOTTOM') => {
    const sideLandmarks = landmarks.filter((l) => l.side === side);
    const elements: React.ReactNode[] = [];

    for (let c = 1; c <= floorCols; c++) {
      const coveredBy = sideLandmarks.find((l) => l.index <= c && c < l.index + l.span);
      if (coveredBy && coveredBy.index < c) {
        continue;
      }

      if (coveredBy && coveredBy.index === c) {
        let totalW = 0;
        for (let k = 0; k < coveredBy.span && c + k <= floorCols; k++) {
          totalW += getColWidthPx(c + k);
          if (k > 0) totalW += 8; // gap-2
        }

        elements.push(
          <div
            key={`${side}-lm-${coveredBy.id}`}
            style={{ width: `${totalW}px` }}
            onClick={() => {
              setEditingLandmark({ ...coveredBy });
              setShowLandmarkModal(true);
            }}
            className={`h-[38px] rounded-xl border-2 flex items-center justify-center px-2 cursor-pointer transition shadow hover:brightness-125 select-none shrink-0 text-xs font-black truncate gap-1 ${getLandmarkColorClass(
              coveredBy.color
            )}`}
            title={`Randfeld: ${coveredBy.label} (Klicken zum Bearbeiten)`}
          >
            <span className="truncate">{coveredBy.label}</span>
          </div>
        );
      } else {
        const slotW = getColWidthPx(c);
        elements.push(
          <div
            key={`${side}-slot-${c}`}
            style={{ width: `${slotW}px` }}
            onClick={() => {
              setEditingLandmark({
                id: '',
                side,
                index: c,
                span: 1,
                label: 'Tür',
                color: 'emerald',
              });
              setShowLandmarkModal(true);
            }}
            className="h-[38px] rounded-xl border border-dashed border-slate-800 hover:border-slate-600 hover:bg-slate-800/40 flex items-center justify-center text-slate-600 hover:text-slate-300 cursor-pointer transition select-none shrink-0 group text-[11px]"
            title={`Randfeld (${side === 'TOP' ? 'Oben' : 'Unten'}, Spalte ${c}) hinzufügen`}
          >
            <span className="opacity-0 group-hover:opacity-100 font-bold transition flex items-center gap-0.5">
              <Plus className="w-3.5 h-3.5" />
            </span>
          </div>
        );
      }
    }

    return (
      <div className="flex items-center gap-2">
        <div className="w-[98px] shrink-0 flex items-center justify-end pr-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
          {side === 'TOP' ? 'Nord ↑' : 'Süd ↓'}
        </div>
        <div className="flex items-center gap-2">
          {elements}
        </div>
      </div>
    );
  };

  const renderVerticalLandmarkBar = (side: 'LEFT' | 'RIGHT') => {
    const sideLandmarks = landmarks.filter((l) => l.side === side);
    const elements: React.ReactNode[] = [];

    for (let r = 1; r <= floorRows; r++) {
      const coveredBy = sideLandmarks.find((l) => l.index <= r && r < l.index + l.span);
      if (coveredBy && coveredBy.index < r) {
        continue;
      }

      if (coveredBy && coveredBy.index === r) {
        let totalH = 0;
        for (let k = 0; k < coveredBy.span && r + k <= floorRows; k++) {
          totalH += getRowHeightPx(r + k);
          if (k > 0) totalH += 8; // gap-2
        }

        elements.push(
          <div
            key={`${side}-lm-${coveredBy.id}`}
            style={{ height: `${totalH}px` }}
            onClick={() => {
              setEditingLandmark({ ...coveredBy });
              setShowLandmarkModal(true);
            }}
            className={`w-[50px] rounded-xl border-2 flex flex-col items-center justify-center p-1 cursor-pointer transition shadow hover:brightness-125 select-none shrink-0 text-center ${getLandmarkColorClass(
              coveredBy.color
            )}`}
            title={`Randfeld: ${coveredBy.label} (Klicken zum Bearbeiten)`}
          >
            <span className="text-[10px] font-black leading-tight break-words line-clamp-3">
              {coveredBy.label}
            </span>
          </div>
        );
      } else {
        const slotH = getRowHeightPx(r);
        elements.push(
          <div
            key={`${side}-slot-${r}`}
            style={{ height: `${slotH}px` }}
            onClick={() => {
              setEditingLandmark({
                id: '',
                side,
                index: r,
                span: 1,
                label: 'Tür',
                color: 'emerald',
              });
              setShowLandmarkModal(true);
            }}
            className="w-[50px] rounded-xl border border-dashed border-slate-800 hover:border-slate-600 hover:bg-slate-800/40 flex items-center justify-center text-slate-600 hover:text-slate-300 cursor-pointer transition select-none shrink-0 group text-[11px]"
            title={`Randfeld (${side === 'LEFT' ? 'Links' : 'Rechts'}, Reihe ${r}) hinzufügen`}
          >
            <span className="opacity-0 group-hover:opacity-100 font-bold transition">
              <Plus className="w-3.5 h-3.5" />
            </span>
          </div>
        );
      }
    }

    return (
      <div className="w-[50px] shrink-0 flex flex-col gap-2">
        {elements}
      </div>
    );
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
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-xl text-xs font-bold transition disabled:opacity-40"
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
            Ziehe Tische auf freie Felder. Klicke auf die <span className="text-blue-400 font-black px-1.5 py-0.5 bg-blue-950/80 rounded border border-blue-800">+</span> Symbole für Gänge oder auf die Randleisten für Türen, Küche, Bar etc.
          </span>
          <div className="flex items-center gap-3">
            <span className="bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
              Tische: <strong className="text-white">{tables.length}</strong>
            </span>
            <span className="bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
              Gänge: <strong className="text-amber-400">{aisles.length}</strong>
            </span>
            <span className="bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
              Randfelder: <strong className="text-emerald-400">{landmarks.length}</strong>
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
          <div className="overflow-x-auto pb-4">
            <div className="inline-block min-w-full space-y-2">
              {/* 1. TOP LANDMARK BAR (Nord) */}
              {renderHorizontalLandmarkBar('TOP')}

              {/* 2. COLUMN INSERT / HEADER TOOLBAR */}
              <div className="flex items-center gap-2">
                <div className="w-[98px] shrink-0 text-right pr-2 font-mono text-[9px] text-slate-600 uppercase">
                  Spalten →
                </div>
                <div className="flex items-center gap-2">
                  {Array.from({ length: floorCols }).map((_, cIdx) => {
                    const colNum = cIdx + 1;
                    const isColAisle = aisles.some((a) => a.type === 'COL' && a.index === colNum);
                    const aisleColObj = aisles.find((a) => a.type === 'COL' && a.index === colNum);

                    return (
                      <div key={`col-header-${colNum}`} className="relative shrink-0">
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
                            className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-blue-950 hover:bg-blue-600 border border-blue-700 text-blue-300 hover:text-white flex items-center justify-center text-xs font-black shadow transition active:scale-95 z-20"
                            title={`Gang oder Spalte nach Spalte ${colNum} einfügen`}
                          >
                            +
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. MAIN MATRIX WITH LEFT & RIGHT LANDMARK BARS */}
              <div className="flex items-start gap-2">
                {/* 3a. Row Labels Column */}
                <div className="w-8 shrink-0 flex flex-col gap-2">
                  {Array.from({ length: floorRows }).map((_, rIdx) => {
                    const rowNum = rIdx + 1;
                    const isRowAisle = aisles.some((a) => a.type === 'ROW' && a.index === rowNum);
                    const slotH = getRowHeightPx(rowNum);

                    return (
                      <div
                        key={`row-label-${rowNum}`}
                        style={{ height: `${slotH}px` }}
                        className="relative shrink-0 flex flex-col items-center justify-center"
                      >
                        <div
                          className={`w-full text-center font-mono text-[10px] font-bold px-1 py-1 rounded border ${
                            isRowAisle
                              ? 'bg-amber-950/40 border-amber-800 text-amber-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          {isRowAisle ? <Footprints className="w-3.5 h-3.5 mx-auto text-amber-400" /> : `R${rowNum}`}
                        </div>
                        {rowNum < floorRows && (
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
                            className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-blue-950 hover:bg-blue-600 border border-blue-700 text-blue-300 hover:text-white flex items-center justify-center text-xs font-black shadow transition active:scale-95 z-20"
                            title={`Gang oder Reihe nach Reihe ${rowNum} einfügen`}
                          >
                            +
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 3b. LEFT LANDMARK BAR (West) */}
                {renderVerticalLandmarkBar('LEFT')}

                {/* 3c. TABLE CELLS MATRIX */}
                <div className="flex flex-col gap-2">
                  {Array.from({ length: floorRows }).map((_, rIdx) => {
                    const rowNum = rIdx + 1;
                    const isRowAisle = aisles.some((a) => a.type === 'ROW' && a.index === rowNum);
                    const aisleRowObj = aisles.find((a) => a.type === 'ROW' && a.index === rowNum);
                    const slotH = getRowHeightPx(rowNum);

                    if (isRowAisle) {
                      return (
                        <div
                          key={`row-aisle-wrap-${rowNum}`}
                          style={{ height: `${slotH}px` }}
                          className="flex items-stretch gap-2 shrink-0"
                        >
                          {Array.from({ length: floorCols }).map((__, cIdx) => {
                            const colNum = cIdx + 1;
                            const isColAisle = aisles.some((a) => a.type === 'COL' && a.index === colNum);
                            const isFirstCol = colNum === 1;
                            const isLastCol = colNum === floorCols;

                            if (isColAisle) {
                              return (
                                <div
                                  key={`aisle-cross-${colNum}-${rowNum}`}
                                  className="w-[48px] h-full bg-amber-950/40 border-2 border-amber-500/70 rounded-xl flex items-center justify-center p-1 text-amber-300 text-[10px] font-black select-none shadow-inner"
                                  title={`Gang-Kreuzung (R${rowNum} / S${colNum})`}
                                >
                                  <Footprints className="w-4 h-4 text-amber-400" />
                                </div>
                              );
                            }

                            return (
                              <div
                                key={`aisle-row-cell-${colNum}-${rowNum}`}
                                className={`w-[90px] h-full bg-amber-950/20 border-y-2 border-dashed border-amber-600/50 flex items-center justify-between px-2 text-amber-300 font-bold text-xs select-none ${
                                  isFirstCol ? 'border-l-2 rounded-l-2xl' : ''
                                } ${isLastCol ? 'border-r-2 rounded-r-2xl' : ''}`}
                              >
                                {isFirstCol ? (
                                  <span className="flex items-center gap-1.5 text-[11px] font-black text-amber-400">
                                    <Footprints className="w-3.5 h-3.5" />
                                    <span>GANG</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-amber-500/60 font-mono">···</span>
                                )}
                                {isLastCol && aisleRowObj && (
                                  <button
                                    onClick={() => handleDeleteAisle(aisleRowObj.id)}
                                    className="p-1 rounded-md bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 text-[10px] font-bold"
                                    title="Reihen-Gang löschen"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={`row-cells-${rowNum}`}
                        style={{ height: `${slotH}px` }}
                        className="flex items-stretch gap-2 shrink-0"
                      >
                        {Array.from({ length: floorCols }).map((__, cIdx) => {
                          const colNum = cIdx + 1;
                          const isColAisle = aisles.some((a) => a.type === 'COL' && a.index === colNum);
                          const aisleColObj = aisles.find((a) => a.type === 'COL' && a.index === colNum);

                          if (isColAisle) {
                            const isFirst = rowNum === 1;
                            const isLast = rowNum === floorRows;

                            return (
                              <div
                                key={`aisle-col-cell-${colNum}-${rowNum}`}
                                className={`w-[48px] h-full bg-amber-950/20 border-x-2 border-dashed border-amber-600/50 flex flex-col items-center justify-center p-1 text-amber-400 text-[10px] font-bold select-none relative group ${
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
                              className={`w-[90px] relative rounded-2xl border transition flex flex-col items-center justify-center p-2 h-full select-none ${
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
                    );
                  })}
                </div>

                {/* 3d. RIGHT LANDMARK BAR (Ost) */}
                {renderVerticalLandmarkBar('RIGHT')}
              </div>

              {/* 4. BOTTOM LANDMARK BAR (Süd) */}
              {renderHorizontalLandmarkBar('BOTTOM')}
            </div>
          </div>
        )}
      </div>

      {/* Randfeld Modal (Türen, Küche, Bar etc.) */}
      {showLandmarkModal && editingLandmark && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-white">
                  {editingLandmark.id ? 'Randfeld bearbeiten' : 'Neues Randfeld hinzufügen'}
                </h3>
                <p className="text-xs text-slate-400">
                  {editingLandmark.side === 'TOP'
                    ? 'Oberer Rand (Nord)'
                    : editingLandmark.side === 'BOTTOM'
                    ? 'Unterer Rand (Süd)'
                    : editingLandmark.side === 'LEFT'
                    ? 'Linker Rand (West)'
                    : 'Rechter Rand (Ost)'}{' '}
                  · Position {editingLandmark.index}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowLandmarkModal(false);
                  setEditingLandmark(null);
                }}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Schnellauswahl / Presets */}
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1.5">
                  Schnell-Vorlagen
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: '🚪 Eingang', color: 'emerald' },
                    { label: '🚪 Ausgang', color: 'emerald' },
                    { label: '🚨 Notausgang', color: 'rose' },
                    { label: '🍳 Küche', color: 'blue' },
                    { label: '🍸 Bar / Schank', color: 'amber' },
                    { label: '🚻 WC', color: 'slate' },
                    { label: '🎭 Bühne', color: 'purple' },
                    { label: '🧥 Garderobe', color: 'slate' },
                    { label: 'ℹ️ Kasse / Info', color: 'blue' },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        setEditingLandmark({
                          ...editingLandmark,
                          label: preset.label,
                          color: preset.color,
                        })
                      }
                      className="px-2 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-[11px] font-semibold text-slate-300 text-left transition"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Eigene Beschriftung */}
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Freie Beschriftung
                </label>
                <input
                  type="text"
                  required
                  placeholder="z.B. Haupttür / Bar / Küche"
                  value={editingLandmark.label}
                  onChange={(e) =>
                    setEditingLandmark({ ...editingLandmark, label: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold"
                />
              </div>

              {/* Breite / Länge (Span in Feldern) */}
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Größe (Anzahl Felder breit/hoch)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={
                      editingLandmark.side === 'TOP' || editingLandmark.side === 'BOTTOM'
                        ? floorCols - editingLandmark.index + 1
                        : floorRows - editingLandmark.index + 1
                    }
                    value={editingLandmark.span || 1}
                    onChange={(e) =>
                      setEditingLandmark({
                        ...editingLandmark,
                        span: Math.max(1, parseInt(e.target.value, 10) || 1),
                      })
                    }
                    className="w-24 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono font-bold"
                  />
                  <span className="text-xs text-slate-400">
                    {editingLandmark.side === 'TOP' || editingLandmark.side === 'BOTTOM'
                      ? 'Felder breit'
                      : 'Felder hoch'}
                  </span>
                </div>
              </div>

              {/* Farbauswahl */}
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1.5">
                  Farbe
                </label>
                <div className="flex items-center gap-2">
                  {[
                    { id: 'emerald', label: 'Grün', bg: 'bg-emerald-600' },
                    { id: 'rose', label: 'Rot', bg: 'bg-rose-600' },
                    { id: 'amber', label: 'Gelb', bg: 'bg-amber-600' },
                    { id: 'blue', label: 'Blau', bg: 'bg-blue-600' },
                    { id: 'purple', label: 'Lila', bg: 'bg-purple-600' },
                    { id: 'slate', label: 'Grau', bg: 'bg-slate-600' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setEditingLandmark({ ...editingLandmark, color: c.id })}
                      className={`w-7 h-7 rounded-xl ${c.bg} transition flex items-center justify-center ${
                        editingLandmark.color === c.id ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                      title={c.label}
                    >
                      {editingLandmark.color === c.id && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aktionen */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                {editingLandmark.id ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteLandmark(editingLandmark.id)}
                    className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Löschen</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowLandmarkModal(false);
                      setEditingLandmark(null);
                    }}
                    className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveLandmark(editingLandmark)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow"
                  >
                    Speichern
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Von Tisch</label>
                    <input
                      type="number"
                      min={1}
                      value={markerStart}
                      onChange={(e) => setMarkerStart(parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Bis Tisch</label>
                    <input
                      type="number"
                      min={1}
                      value={markerEnd}
                      onChange={(e) => setMarkerEnd(parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Anzahl je Tisch</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={markerCopiesPerTable}
                      onChange={(e) => setMarkerCopiesPerTable(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-center font-bold"
                    />
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-slate-400">Druckumfang:</span>
                  <span className="font-mono font-bold text-indigo-400">
                    {Math.max(0, markerEnd >= markerStart ? markerEnd - markerStart + 1 : 0)} Tische × {markerCopiesPerTable} {markerCopiesPerTable === 1 ? 'Ausdruck' : 'Ausdrucke'} = {Math.max(0, markerEnd >= markerStart ? markerEnd - markerStart + 1 : 0) * markerCopiesPerTable} Tischmarken gesamt
                  </span>
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
                    placeholder="Optionaler Hinweistext (Standard: leer)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white font-bold"
                  />
                </div>

                <label className="flex items-center gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={markerNumberOnly}
                    onChange={(e) => setMarkerNumberOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">
                      Nur Nummer drucken (ohne &bdquo;TISCH&ldquo;)
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Druckt die Tischnummer extra groß und zentriert auf das Papier.
                    </span>
                  </div>
                </label>

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
                  {!markerNumberOnly && (
                    <>
                      <div className="text-xs font-bold uppercase tracking-tight">{eventName}</div>
                      <div className="my-1 border-b-2 border-dashed border-black" />
                    </>
                  )}
                  
                  {/* Table Label with Scalable Font Size (Stufe 10 füllt die gesamte Bonbreite) */}
                  {(() => {
                    const printableWidth = markerPaperWidth === 58 ? 190 : 250;
                    let calculatedFontSize: number;
                    if (markerNumberOnly) {
                      const numStr = String(markerStart);
                      const charWidthRatio = numStr.length === 1 ? 0.65 : (numStr.includes('1') ? 0.52 : 0.58);
                      const maxTargetPx = Math.min(235, Math.floor((printableWidth * 0.96) / (Math.max(1, numStr.length) * charWidthRatio)));
                      const minTargetPx = 32;
                      calculatedFontSize = Math.round(minTargetPx + (markerFontSize - 1) * ((maxTargetPx - minTargetPx) / 9));
                    } else {
                      const labelStr = `TISCH ${markerStart}`;
                      const maxTargetPx = Math.min(70, Math.floor((printableWidth * 0.95) / (Math.max(1, labelStr.length) * 0.6)));
                      const minTargetPx = 16;
                      calculatedFontSize = Math.round(minTargetPx + (markerFontSize - 1) * ((maxTargetPx - minTargetPx) / 9));
                    }
                    return (
                      <div
                        className="font-black my-2 uppercase tracking-tighter leading-none whitespace-nowrap select-none flex items-center justify-center overflow-hidden w-full"
                        style={{
                          fontSize: `${calculatedFontSize}px`,
                        }}
                      >
                        {markerNumberOnly ? markerStart : `TISCH ${markerStart}`}
                      </div>
                    );
                  })()}

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
