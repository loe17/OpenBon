'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Printer,
  Server,
  Utensils,
  ShieldCheck,
  Zap,
  Play,
  FileText,
  Clock,
  Wifi,
  Layers,
  ArrowRight,
} from 'lucide-react';

import { useToast } from '@/components/ui/toast';

interface PreflightCheck {
  id: string;
  label: string;
  status: 'OK' | 'WARNING' | 'ERROR' | 'SKIPPED';
  detail: string;
}

interface PreflightReport {
  status: 'OK' | 'WARNING' | 'ERROR';
  role: string;
  checkedAt: string;
  checks: PreflightCheck[];
}

interface DiagnosticReport {
  timestamp: string;
  durationMs: number;
  overallStatus: 'ALL_OK' | 'WARNING' | 'ERROR';
  issues: string[];
  system: {
    nodeVersion: string;
    platform: string;
    arch: string;
    hostname: string;
    localIps: string[];
    baseUrl: string;
  };
  eventConfig: {
    name: string;
    currency: string;
    enableTax: boolean;
    enableGuestSelfOrder: boolean;
    haPartnerUrl: string | null;
  };
  license: {
    tier: string;
    maxDevices: number;
    isValid: boolean;
    features: string[];
  };
  counts: {
    products: number;
    categories: number;
    printGroups: number;
    printers: number;
    tables: number;
    orders: number;
  };
  printers: {
    id: string;
    name: string;
    ipAddress: string;
    port: number;
    isVirtual: boolean;
    reachable: boolean;
    latencyMs: number;
    status: string;
    details: string;
  }[];
  consistency: {
    unmappedPrintGroupsCount: number;
    unmappedProductsCount: number;
  };
}

export default function DiagnosticsPage() {
  const { success, error } = useToast();
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPrintingTest, setIsPrintingTest] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationSteps, setSimulationSteps] = useState<{ name: string; success: boolean; details: string }[] | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<string>('');
  const [preflight, setPreflight] = useState<PreflightReport | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);

  const runPreflight = async () => {
    setPreflightLoading(true);
    try {
      const res = await fetch('/api/system/preflight');
      const data = await res.json();
      setPreflight(data);
      if (data.status === 'OK') success('Preflight-Check bestanden – alles bereit!');
      else if (data.status === 'WARNING') error('Preflight-Check mit Hinweisen – Details unten.');
      else error('Preflight-Check fehlgeschlagen – kritische Probleme gefunden!');
    } catch {
      error('Preflight-Check konnte nicht ausgeführt werden.');
    } finally {
      setPreflightLoading(false);
    }
  };

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/diagnostics');
      const data = await res.json();
      setReport(data);
      setLastCheckTime(new Date().toLocaleTimeString('de-DE'));
    } catch (e) {
      console.error('Diagnostics failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const handlePrintAllTestTickets = async () => {
    setIsPrintingTest(true);
    try {
      const res = await fetch('/api/diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'PRINT_TEST_TICKETS' }),
      });
      const data = await res.json();
      if (data.success) {
        success(`Testbelege erfolgreich an ${data.printedCount} Drucker gesendet!`);
      } else {
        error(data.error || 'Fehler beim Drucken der Testbelege');
      }
      runDiagnostics();
    } catch (e) {
      error('Verbindungsfehler beim Drucktest.');
    } finally {
      setIsPrintingTest(false);
    }
  };

  const handleSimulateOrderCycle = async () => {
    setIsSimulating(true);
    setSimulationSteps(null);
    try {
      const res = await fetch('/api/diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SIMULATE_ORDER_CYCLE' }),
      });
      const data = await res.json();
      if (data.steps) {
        setSimulationSteps(data.steps);
        success('Bestellzyklus erfolgreich simuliert!');
      }
      runDiagnostics();
    } catch (e) {
      error('Fehler bei der Simulation.');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleGeneralprobe = async () => {
    setIsSimulating(true);
    setSimulationSteps(null);
    try {
      const res = await fetch('/api/diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'GENERALPROBE' }),
      });
      const data = await res.json();
      if (data.steps) {
        setSimulationSteps(data.steps);
        success('Fest-Generalprobe erfolgreich durchgeführt!');
      }
      runDiagnostics();
    } catch {
      error('Fehler bei der Generalprobe.');
    } finally {
      setIsSimulating(false);
    }
  };

  const handlePurgeTestData = async () => {
    if (!confirm('Möchten Sie wirklich alle Test-Bestellungen, Test-Zahlungen und Druckaufträge rückstandsfrei bereinigen?\n\nIhre Stammdaten (Artikel, Warengruppen, Tische, Drucker) bleiben dabei vollständig erhalten.')) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'PURGE_TEST_DATA' }),
      });
      const data = await res.json();
      if (data.success) {
        success(data.message);
      } else {
        error(data.error || 'Fehler beim Bereinigen der Testdaten');
      }
      runDiagnostics();
    } catch {
      error('Verbindungsfehler beim Bereinigen der Testdaten.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 text-white p-3 sm:p-6 max-w-7xl mx-auto w-full font-sans print:bg-white print:text-black">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800 print:border-black">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2.5 rounded-2xl shadow">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black">System-Testbetrieb &amp; Hardware-Diagnose</h1>
            <p className="text-xs text-slate-400 print:text-gray-600">
              Vollständige Überprüfung aller Komponenten nach dem Aufbau (Drucker, Netzwerk, Speisekarte &amp; E2E-Kassenzyklus)
            </p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            onClick={runDiagnostics}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-xl text-xs font-bold transition border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Neu prüfen</span>
          </button>

          <button
            onClick={handleGeneralprobe}
            disabled={isSimulating || loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white rounded-xl text-xs font-black transition shadow-lg shadow-blue-950/60"
            title="Drucker-Testschnitt auf allen Druckern + Kassenladen-Kick"
          >
            <Zap className="w-4 h-4 text-amber-300" />
            <span>{isSimulating ? 'Prüft...' : 'Fest-Generalprobe'}</span>
          </button>

          <button
            onClick={handlePurgeTestData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900 active:scale-95 text-rose-300 rounded-xl text-xs font-bold transition border border-rose-800"
            title="Löscht alle Test-Bestellungen und Zahlungen vor Festbeginn"
          >
            <span>Testdaten bereinigen</span>
          </button>

          <button
            onClick={handlePrintAllTestTickets}
            disabled={isPrintingTest || loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white rounded-xl text-xs font-bold transition border border-slate-700"
          >
            <Printer className="w-4 h-4 text-blue-400" />
            <span>{isPrintingTest ? 'Druckt...' : 'Alle Drucker testen'}</span>
          </button>

          <button
            onClick={runPreflight}
            disabled={preflightLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 rounded-xl text-xs font-black transition shadow-md shadow-amber-950/50"
            title="DB, HA-Partner, Drucker & Backup-Replikat vor Festbeginn prüfen"
          >
            <ShieldCheck className={`w-4 h-4 ${preflightLoading ? 'animate-pulse' : ''}`} />
            <span>{preflightLoading ? 'Prüft...' : 'Preflight-Check'}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold transition border border-slate-800"
            title="Prüfprotokoll ausdrucken"
          >
            <FileText className="w-4 h-4" />
            <span>Bericht drucken</span>
          </button>
        </div>
      </div>

      {/* Preflight-Check Ergebnis (Festbeginn-Checkliste) */}
      {preflight && (
        <div
          className={`mb-6 p-4 rounded-2xl border print:hidden ${
            preflight.status === 'OK'
              ? 'bg-emerald-950/30 border-emerald-500/40'
              : preflight.status === 'WARNING'
              ? 'bg-amber-950/30 border-amber-500/40'
              : 'bg-rose-950/30 border-rose-500/40'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-black text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Preflight-Check vor Festbeginn ({new Date(preflight.checkedAt).toLocaleTimeString('de-DE')})
            </h3>
            <span className="text-[11px] font-mono opacity-70">HA-Rolle: {preflight.role}</span>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {preflight.checks.map((check) => (
              <div key={check.id} className="flex items-start gap-2 text-xs bg-slate-950/50 rounded-lg px-3 py-2">
                {check.status === 'OK' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : check.status === 'WARNING' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                ) : check.status === 'ERROR' ? (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <span className="w-4 h-4 rounded-full border border-slate-600 shrink-0 mt-0.5" title="Übersprungen" />
                )}
                <div>
                  <div className="font-bold">{check.label}</div>
                  <div className="opacity-75">{check.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && !report ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
          <p className="font-bold text-sm">Prüfe Systemkomponenten, Netzwerk &amp; Drucker...</p>
        </div>
      ) : report ? (
        <div className="space-y-6">
          {/* 1. Overall Status Hero Banner */}
          <div
            className={`p-6 rounded-3xl border-2 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition ${
              report.overallStatus === 'ALL_OK'
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-100'
                : report.overallStatus === 'WARNING'
                ? 'bg-amber-950/40 border-amber-500/50 text-amber-100'
                : 'bg-rose-950/40 border-rose-500/50 text-rose-100'
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`p-3.5 rounded-2xl ${
                  report.overallStatus === 'ALL_OK'
                    ? 'bg-emerald-500 text-white'
                    : report.overallStatus === 'WARNING'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-rose-600 text-white'
                }`}
              >
                {report.overallStatus === 'ALL_OK' ? (
                  <CheckCircle2 className="w-8 h-8" />
                ) : report.overallStatus === 'WARNING' ? (
                  <AlertTriangle className="w-8 h-8" />
                ) : (
                  <XCircle className="w-8 h-8" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-black">
                  {report.overallStatus === 'ALL_OK'
                    ? 'Alle Systeme betriebsbereit!'
                    : report.overallStatus === 'WARNING'
                    ? 'Testbetrieb mit Hinweisen abgeschlossen'
                    : 'Kritische Komponenten nicht erreichbar'}
                </h2>
                <p className="text-xs opacity-85 mt-0.5">
                  {report.issues.length === 0
                    ? 'Datenbank, Netzwerk, Drucker-Hardware und Kassenlogik funktionieren einwandfrei.'
                    : `Gefundene Auffälligkeiten: ${report.issues.join(' • ')}`}
                </p>
              </div>
            </div>

            <div className="text-xs font-mono opacity-70 sm:text-right shrink-0">
              <div>Letzter Check: {lastCheckTime}</div>
              <div>Dauer: {report.durationMs}ms</div>
            </div>
          </div>

          {/* 2. Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-bold uppercase">Bondrucker</span>
                <Printer className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-black font-mono text-white">
                {report.printers.filter((p) => p.reachable).length} / {report.printers.length}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {report.printers.filter((p) => p.reachable).length === report.printers.length
                  ? 'Alle Drucker online'
                  : 'Ausfälle erkannt'}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-bold uppercase">Speisekarte</span>
                <Utensils className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black font-mono text-white">
                {report.counts.products}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                in {report.counts.categories} Warengruppen
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-bold uppercase">Tischplan</span>
                <Layers className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-black font-mono text-white">
                {report.counts.tables}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Tische konfiguriert
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-bold uppercase">Lizenz</span>
                <ShieldCheck className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl font-black text-white">
                {report.license.tier}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {report.license.maxDevices >= 9999 ? 'Unbegrenzte Geräte' : `${report.license.maxDevices} Geräte`}
              </div>
            </div>
          </div>

          {/* 3. Section: Drucker & Hardware Status */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-400" />
                <span>Drucker-Hardware &amp; TCP Socket Diagnostik</span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                Port 9100 Direct Socket
              </span>
            </div>

            {report.printers.length === 0 ? (
              <div className="p-4 bg-slate-950 rounded-2xl text-center text-xs text-slate-400">
                Keine Drucker hinterlegt. Gehe zu <strong>Drucker &amp; Stationen</strong>, um Bondrucker anzulegen.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {report.printers.map((p) => (
                  <div
                    key={p.id}
                    className={`p-4 rounded-2xl border flex items-center justify-between transition ${
                      p.reachable
                        ? 'bg-slate-950 border-slate-800'
                        : 'bg-rose-950/30 border-rose-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          p.reachable ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-rose-500 animate-pulse'
                        }`}
                      />
                      <div>
                        <div className="font-extrabold text-sm text-white flex items-center gap-2">
                          <span>{p.name}</span>
                          {p.isVirtual && (
                            <span className="text-[10px] bg-blue-950 text-blue-300 border border-blue-800 px-1.5 py-0.2 rounded font-mono">
                              Virtuell
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono text-slate-400">
                          {p.ipAddress}:{p.port || 9100}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-xl border ${
                          p.reachable
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                            : 'bg-rose-950 text-rose-300 border-rose-800'
                        }`}
                      >
                        {p.reachable ? `OK (${p.latencyMs}ms)` : 'Fehler'}
                      </span>
                      <div className="text-[10px] text-slate-500 mt-1 max-w-[150px] truncate">
                        {p.details}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. Section: E2E Simulation Result (falls ausgeführt) */}
          {simulationSteps && (
            <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4 animate-in fade-in">
              <h3 className="text-base font-extrabold text-emerald-300 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                <span>E2E-Bestell- &amp; Druckzyklus Protokoll</span>
              </h3>

              <div className="space-y-2">
                {simulationSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-700 flex items-center justify-center font-bold text-[10px]">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-white">{step.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 font-mono text-[11px]">{step.details}</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Section: System- & Netzwerkintegrität */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-400 flex items-center gap-2">
                <Wifi className="w-4 h-4 text-blue-400" />
                <span>Lokale Netzwerk-Adressen</span>
              </h4>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between p-2 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-400">mDNS Domain:</span>
                  <span className="font-bold text-blue-300">{report.system.baseUrl}</span>
                </div>
                {report.system.localIps.map((ip, idx) => (
                  <div key={idx} className="flex justify-between p-2 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-slate-400">IPv4 Interface #{idx + 1}:</span>
                    <span className="font-bold text-emerald-400">http://{ip}:3000</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-400 flex items-center gap-2">
                <Server className="w-4 h-4 text-purple-400" />
                <span>Host- &amp; Kassenkonfiguration</span>
              </h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between p-2 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-400">Veranstaltungsname:</span>
                  <span className="font-bold text-white">{report.eventConfig.name}</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-400">MwSt.-Ausweis Belege:</span>
                  <span className={`font-bold ${report.eventConfig.enableTax ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {report.eventConfig.enableTax ? 'Aktiviert (Regelbesteuerung)' : 'Deaktiviert (§19 UStG / Verein)'}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-400">Gäste-Tischbestellung (BYOD):</span>
                  <span className={`font-bold ${report.eventConfig.enableGuestSelfOrder ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {report.eventConfig.enableGuestSelfOrder ? 'Aktiviert' : 'Deaktiviert (Standard)'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
