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

        {/* Tables Grid */}
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mb-8">
          {tables.map((t) => (
            <div
              key={t.id}
              className={`p-3 rounded-lg border-2 text-center flex flex-col justify-between min-h-[70px] ${
                t.isActive !== false
                  ? 'border-slate-800 bg-slate-50'
                  : 'border-slate-300 bg-slate-100 opacity-40 line-through'
              }`}
            >
              <div className="text-[10px] font-bold text-slate-500 uppercase">Nr. {t.tableNumber}</div>
              <div className="text-base font-black">{t.label}</div>
              <div className="text-[9px] text-slate-600 font-semibold">
                {t.isActive !== false ? 'Aktiv' : 'Inaktiv'}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Notes for Waiters */}
        <div className="border-t border-slate-400 pt-4 grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="font-bold block mb-1">Hinweise für das Servicepersonal:</span>
            <ul className="list-disc list-inside space-y-0.5 text-slate-700 text-[11px]">
              <li>Tischbestellungen immer sofort am Smartphone eingeben.</li>
              <li>Sonderwünsche über die Wortgruppen-Tasten erfassen.</li>
              <li>Rechnungs-Splitting direkt am Tisch möglich.</li>
            </ul>
          </div>
          <div className="text-right">
            <span className="font-bold block mb-1">OpenBon Kassensystem</span>
            <p className="text-slate-600 text-[11px]">Erstellt am {new Date().toLocaleString('de-DE')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
