'use client';

import React, { useEffect, useState } from 'react';
import { Printer, ArrowLeft, Grid, Check } from 'lucide-react';
import Link from 'next/link';

export default function PrintTableOverviewPage() {
  const [tables, setTables] = useState<any[]>([]);
  const [eventName, setEventName] = useState('Festveranstaltung 2026');

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
      <div className="print:hidden max-w-4xl mx-auto mb-6 p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between shadow-lg">
        <Link
          href="/admin/tables"
          className="flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Zurück zum Tischplan</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow"
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
            <p className="text-sm font-bold text-slate-700">Offizielle Tischübersicht & Serviceplan</p>
          </div>
          <div className="text-right text-xs">
            <div>Stand: {new Date().toLocaleDateString('de-DE')}</div>
            <div className="font-bold">Aktive Tische: {activeTables.length}</div>
          </div>
        </div>

        {/* Tables Spatial Room Grid */}
        {(() => {
          const maxCols = Math.max(6, Math.min(12, ...tables.map((t) => t.gridX || 1)));
          const maxRows = Math.max(4, Math.min(12, ...tables.map((t) => t.gridY || 1)));

          return (
            <div
              className="grid gap-2 mb-8"
              style={{
                gridTemplateColumns: `repeat(${maxCols}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: maxRows }).map((_, rIdx) => {
                const y = rIdx + 1;
                return Array.from({ length: maxCols }).map((__, cIdx) => {
                  const x = cIdx + 1;
                  const t = tables.find((tbl) => (tbl.gridX || 1) === x && (tbl.gridY || 1) === y);

                  if (t) {
                    return (
                      <div
                        key={`t-${t.id}`}
                        className={`p-2.5 rounded-lg border-2 text-center flex flex-col justify-between min-h-[72px] ${
                          t.isActive !== false
                            ? 'border-black bg-slate-50'
                            : 'border-slate-300 bg-slate-100 opacity-40 line-through'
                        }`}
                      >
                        <div className="text-[10px] font-bold text-slate-600 font-mono">Nr. {t.tableNumber}</div>
                        <div className="text-sm font-black truncate">{t.label}</div>
                        <div className="text-[9px] text-slate-500 font-mono">
                          ({x},{y}) {t.isActive !== false ? '✓' : '✗'}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`empty-${x}-${y}`}
                      className="p-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 text-center flex flex-col justify-center items-center min-h-[72px] text-slate-400"
                    >
                      <span className="text-[10px] font-mono">Gang / Frei</span>
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
