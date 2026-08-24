'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Download,
  Calendar,
  FileCheck,
  CheckCircle2,
  FileText,
  Loader2,
  Lock,
} from 'lucide-react';

export default function AdminFiscalPage() {
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [tseProvider, setTseProvider] = useState('NONE');
  const [tseSerial, setTseSerial] = useState('');
  
  const [exportData, setExportData] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'bonkopf' | 'bonpos' | 'preise' | 'tse'>('bonkopf');

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const cfg = await res.json();
          setTseProvider(cfg.tseProvider || 'NONE');
          setTseSerial(cfg.tseSerialNumber || 'NONE');
        }
      } catch (err) {
        console.error('Fehler beim Laden:', err);
      }
    }
    loadConfig();
  }, []);

  const generateExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch(`/api/fiscal/dsfinvk?startDate=${startDate}&endDate=${endDate}`);
      if (res.ok) {
        const data = await res.json();
        setExportData(data);
      } else {
        alert('Fehler beim Generieren des Prüfer-Exports');
      }
    } catch (err) {
      alert('Netzwerkfehler');
    } finally {
      setIsExporting(false);
    }
  };

  const downloadTable = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              DSFinV-K & TSE Prüfer-Export
            </h1>
          </div>
          <p className="text-sm text-slate-400">
            Digitale Schnittstelle der Finanzverwaltung für Kassensysteme (DSFinV-K 2.3+) nach KassenSichV und GoBD (Spec V2 §7.2).
          </p>
        </div>

        {/* Compliance Status Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-2xl">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-bold block mb-1">TSE-Modul</span>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span className="font-mono font-bold text-white text-sm">{tseProvider}</span>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-2xl">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-bold block mb-1">TSE-Seriennummer</span>
            <span className="font-mono text-xs text-slate-300 truncate block">{tseSerial}</span>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-2xl">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-bold block mb-1">DSFinV-K Standard</span>
            <span className="font-bold text-emerald-400 text-sm flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Version 2.3+ Konform
            </span>
          </div>
        </div>

        {/* Zeitraum & Generierung */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" /> Prüfungszeitraum festlegen
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">Startdatum:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">Enddatum:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <button
            onClick={generateExport}
            disabled={isExporting}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-50 text-white font-extrabold text-lg rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>DSFinV-K Daten werden generiert...</span>
              </>
            ) : (
              <>
                <FileCheck className="w-6 h-6" />
                <span>1-Klick Prüfer-Export generieren</span>
              </>
            )}
          </button>
        </div>

        {/* Export Ergebnis & Tabellen Preview */}
        {exportData && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6 animate-in fade-in-50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Prüfer-Datensatz erfolgreich erstellt
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-1">
                  SHA-256 Prüfsumme: <span className="text-emerald-400 font-bold">{exportData.checksumSha256}</span>
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => downloadTable(exportData.tables.bonkopfCsv, `bonkopf_${startDate}.csv`)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl text-white flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> bonkopf.csv
                </button>
                <button
                  onClick={() => downloadTable(exportData.tables.bonposCsv, `bonpos_${startDate}.csv`)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl text-white flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> bonpos.csv
                </button>
              </div>
            </div>

            {/* Tab Umschalter */}
            <div className="flex gap-2 border-b border-slate-800 pb-2">
              {[
                { key: 'bonkopf', label: 'bonkopf.csv' },
                { key: 'bonpos', label: 'bonpos.csv' },
                { key: 'preise', label: 'bonpos_preise.csv' },
                { key: 'tse', label: 'tse_transaktionen.csv' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === tab.key
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white bg-slate-950'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content Preview Box */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 overflow-x-auto max-h-64 font-mono text-xs text-slate-300 whitespace-pre">
              {activeTab === 'bonkopf' && exportData.tables.bonkopfCsv}
              {activeTab === 'bonpos' && exportData.tables.bonposCsv}
              {activeTab === 'preise' && exportData.tables.bonposPreiseCsv}
              {activeTab === 'tse' && exportData.tables.tseTransaktionenCsv}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
