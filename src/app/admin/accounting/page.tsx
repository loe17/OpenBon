'use client';

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Settings,
  CheckCircle2,
  Save,
  Loader2,
  BookOpen,
} from 'lucide-react';

export default function AdminAccountingPage() {
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const [consultantNumber, setConsultantNumber] = useState('');
  const [clientNumber, setClientNumber] = useState('');
  const [cashAccount, setCashAccount] = useState('1000');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const cfg = await res.json();
          setConsultantNumber(cfg.datevConsultantNumber || '');
          setClientNumber(cfg.datevClientNumber || '');
          setCashAccount(cfg.datevCashAccount || '1000');
        }
      } catch (err) {
        console.error('Fehler beim Laden der DATEV-Config:', err);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const saveDatevConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datevConsultantNumber: consultantNumber,
          datevClientNumber: clientNumber,
          datevCashAccount: cashAccount,
        }),
      });
      if (res.ok) {
        alert('DATEV-Stammdaten erfolgreich gespeichert!');
      } else {
        alert('Fehler beim Speichern der Konfiguration');
      }
    } catch (err) {
      alert('Netzwerkfehler');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleDownload = () => {
    const url = `/api/fiscal/datev?startDate=${startDate}&endDate=${endDate}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-3" />
        <p>DATEV-Buchhaltung wird geladen...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              DATEV Kassenbuch-Export
            </h1>
          </div>
          <p className="text-sm text-slate-400">
            Erzeugen Sie standardkonforme DATEV-Buchungsstapel (Format EXTF 700 / Kassenbuch Online) zur Übergabe an das Steuerbüro (Spec V2 §7.1).
          </p>
        </div>

        {/* DATEV Konfiguration */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" /> DATEV-Stammdaten & Sachkonten
          </h2>

          <form onSubmit={saveDatevConfig} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">
                Beraternummer (DATEV):
              </label>
              <input
                type="text"
                value={consultantNumber}
                onChange={(e) => setConsultantNumber(e.target.value)}
                placeholder="z. B. 10001"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">
                Mandantennummer:
              </label>
              <input
                type="text"
                value={clientNumber}
                onChange={(e) => setClientNumber(e.target.value)}
                placeholder="z. B. 99999"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">
                Kassenkonto (SKR03/04):
              </label>
              <input
                type="text"
                value={cashAccount}
                onChange={(e) => setCashAccount(e.target.value)}
                placeholder="z. B. 1000"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={isSavingConfig}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 font-bold text-sm text-white rounded-xl shadow transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Stammdaten speichern</span>
              </button>
            </div>
          </form>
        </div>

        {/* Export-Bereich */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-400" /> Zeitraum für Buchungsstapel auswählen
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">Von Datum:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">Bis Datum:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs text-slate-300">
            <div className="font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-blue-400" /> Enthaltene Standard-Buchungslogik:
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>19% Umsatzerlöse → Gegenkonto <span className="font-mono text-emerald-400">8400</span></li>
              <li>7% Umsatzerlöse → Gegenkonto <span className="font-mono text-emerald-400">8300</span></li>
              <li>Kartenzahlungen & Umbuchtungen → Transitkonto <span className="font-mono text-blue-400">1360</span></li>
              <li>Wechselgeld-Einlagen & Entnahmen aus dem Kassenbuch</li>
            </ul>
          </div>

          <button
            onClick={handleDownload}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-lg rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all"
          >
            <Download className="w-6 h-6" />
            <span>DATEV-Kassenbuch CSV herunterladen</span>
          </button>
        </div>
      </div>
    </div>
  );
}
