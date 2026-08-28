'use client';

import React, { useEffect, useState } from 'react';
import { Printer, ArrowLeft, Grid, Check, Footprints } from 'lucide-react';
import Link from 'next/link';

interface AisleItem {
  id: string;
  type: 'COL' | 'ROW';
  index: number;
}

export default function PrintTableOverviewPage() {
  const [tables, setTables] = useState<any[]>([]);
  const [aisles, setAisles] = useState<AisleItem[]>([]);
  const [eventName, setEventName] = useState('Festveranstaltung 2026');
  const [hideEmptySpaces, setHideEmptySpaces] = useState(false);

  useEffect(() => {
    fetch('/api/tables?all=true')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setTables(d);
      })
      .catch(() => {});

    fetch('/api/config')
      .then((r) => r.json())
      .then((cfg) => {
        if (cfg?.name) setEventName(cfg.name);
        if (cfg?.aisles) {
          try {
            const parsed = JSON.parse(cfg.aisles);
            if (Array.isArray(parsed)) setAisles(parsed);
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const activeTables = tables.filter((t) => t.isActive !== false);

  return (
    <div className="min-h-screen bg-white text-black p-6 font-sans">
      {/* Screen-only Controls */}
      <div className="print:hidden max-w-4xl mx-auto mb-6 p-4 bg-slate-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <Link
          href="/admin/tables"
          className="flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Zurück zum Tischplan</span>
        </Link>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-300 font-bold cursor-pointer select-none bg-slate-800 px-3 py-2 rounded-xl border border-slate-700 hover:border-slate-600 transition">
            <input
              type="checkbox"
              checked={hideEmptySpaces}
              onChange={(e) => setHideEmptySpaces(e.target.checked)}
              className="rounded border-slate-600 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
            />
            <span>Freie Tische als Freiraum darstellen</span>
          </label>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow transition"
          >
            <Printer className="w-4 h-4" />
            <span>Tischübersicht jetzt drucken / PDF speichern</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet */}
      <div className="max-w-4xl mx-auto border border-slate-300 p-8 rounded-xl print:border-none print:p-0">
        {/* Header */}
        <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">{eventName}</h1>
            <p className="text-sm font-bold text-slate-700">Offizielle Tischübersicht &amp; Serviceplan</p>
          </div>
          <div className="text-right text-xs">
            <div>Stand: {new Date().toLocaleDateString('de-DE')}</div>
            <div className="font-bold">Aktive Tische: {activeTables.length}</div>
          </div>
        </div>

        {/* Tables Spatial Room Grid */}
        {(() => {
          const maxTableX = tables.reduce((max, t) => Math.max(max, t.gridX || 1), 0);
          const maxTableY = tables.reduce((max, t) => Math.max(max, t.gridY || 1), 0);
          const maxAisleX = aisles.filter((a) => a.type === 'COL').reduce((max, a) => Math.max(max, a.index), 0);
          const maxAisleY = aisles.filter((a) => a.type === 'ROW').reduce((max, a) => Math.max(max, a.index), 0);

          const maxCols = Math.max(6, maxTableX, maxAisleX);
          const maxRows = Math.max(4, maxTableY, maxAisleY);

          return (
            <div
              className="grid gap-2 mb-8"
              style={{
                gridTemplateColumns: `repeat(${maxCols}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: maxRows }).map((_, rIdx) => {
                const y = rIdx + 1;
                const isRowAisle = aisles.some((a) => a.type === 'ROW' && a.index === y);

                return Array.from({ length: maxCols }).map((__, cIdx) => {
                  const x = cIdx + 1;
                  const isColAisle = aisles.some((a) => a.type === 'COL' && a.index === x);
                  const isAisle = isRowAisle || isColAisle;

                  if (isAisle) {
                    return (
                      <div
                        key={`aisle-${x}-${y}`}
                        className="p-2 rounded-lg border-2 border-amber-400 bg-amber-50 text-center flex flex-col justify-center items-center min-h-[72px] text-amber-800"
                      >
                        <Footprints className="w-4 h-4 text-amber-600 mb-0.5" />
                        <span className="text-[9px] font-black uppercase tracking-wider">GANG</span>
                      </div>
                    );
                  }

                  const t = tables.find((tbl) => (tbl.gridX || 1) === x && (tbl.gridY || 1) === y);

                  if (t) {
                    return (
                      <div
                        key={`t-${t.id}`}
                        className={`p-2.5 rounded-lg border-2 text-center flex flex-col justify-between min-h-[72px] ${
                          t.isActive !== false
                            ? 'border-black bg-white shadow-sm'
                            : 'border-slate-300 bg-slate-100 opacity-40 line-through'
                        }`}
                      >
                        <div className="text-[10px] font-bold text-slate-700 font-mono">Nr. {t.tableNumber}</div>
                        <div className="text-sm font-black truncate text-black">{t.label}</div>
                        <div className="text-[9px] text-slate-500 font-mono">
                          ({x},{y})
                        </div>
                      </div>
                    );
                  }

                  if (hideEmptySpaces) {
                    return (
                      <div
                        key={`empty-${x}-${y}`}
                        className="min-h-[72px] bg-transparent border-none"
                      />
                    );
                  }

                  return (
                    <div
                      key={`empty-${x}-${y}`}
                      className="p-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center flex flex-col justify-center items-center min-h-[72px] text-slate-400"
                    >
                      <span className="text-[10px] font-mono">Frei</span>
                      <span className="text-[8px] font-mono text-slate-400">({x},{y})</span>
                    </div>
                  );
                });
              })}
            </div>
          );
        })()}

        {/* Clean Footer Timestamp */}
        <div className="border-t border-slate-400 pt-3 flex justify-between items-center text-xs text-slate-600">
          <div>OpenBon Kassensystem · Offizielle Raumübersicht</div>
          <div>Erstellt am {new Date().toLocaleString('de-DE')}</div>
        </div>
      </div>
    </div>
  );
}
