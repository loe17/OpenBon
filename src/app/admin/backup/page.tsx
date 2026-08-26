'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  HardDrive,
  Download,
  Upload,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowLeft,
  FileCheck,
  Check,
} from 'lucide-react';
import { APP_VERSION } from '@/lib/version';

export default function AdminBackupPage() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Auto Backup Settings State
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [autoBackupIntervalMinutes, setAutoBackupIntervalMinutes] = useState(30);

  // Selective Export Scope
  const [scope, setScope] = useState({
    incConfig: true,
    incProducts: true,
    incWordGroups: true,
    incTables: true,
    incPrinters: true,
    incStock: true,
    incOrders: true,
    incPayments: true,
  });

  // Restore State
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePreview, setRestorePreview] = useState<any>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Load Config
  const loadConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setAutoBackupEnabled(Boolean(data.autoBackupEnabled));
        setAutoBackupIntervalMinutes(Number(data.autoBackupIntervalMinutes || 30));
      }
    } catch (err) {
      console.error('Error loading config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  // Save Auto-Backup Settings
  const handleSaveAutoBackup = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoBackupEnabled,
          autoBackupIntervalMinutes,
        }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Error saving auto-backup settings:', err);
    } finally {
      setSaving(false);
    }
  };

  // Trigger Download
  const handleDownloadBackup = (full: boolean) => {
    const params = new URLSearchParams();
    if (full) {
      params.set('incConfig', '1');
      params.set('incProducts', '1');
      params.set('incWordGroups', '1');
      params.set('incTables', '1');
      params.set('incPrinters', '1');
      params.set('incStock', '1');
      params.set('incOrders', '1');
      params.set('incPayments', '1');
    } else {
      params.set('incConfig', scope.incConfig ? '1' : '0');
      params.set('incProducts', scope.incProducts ? '1' : '0');
      params.set('incWordGroups', scope.incWordGroups ? '1' : '0');
      params.set('incTables', scope.incTables ? '1' : '0');
      params.set('incPrinters', scope.incPrinters ? '1' : '0');
      params.set('incStock', scope.incStock ? '1' : '0');
      params.set('incOrders', scope.incOrders ? '1' : '0');
      params.set('incPayments', scope.incPayments ? '1' : '0');
    }

    window.location.href = `/api/backup?${params.toString()}`;
  };

  // Handle File Selection for Restore
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreFile(file);
    setRestoreError(null);
    setRestoreSuccess(false);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        if (!json.system || !json.version) {
          throw new Error('Ungültiges Dateiformat. Keine gültige OpenBon-Sicherungsdatei.');
        }
        setRestorePreview(json);
      } catch (err: any) {
        setRestoreError(err.message || 'Die Datei konnte nicht als JSON gelesen werden.');
        setRestorePreview(null);
      }
    };
    reader.readAsText(file);
  };

  // Execute Restore
  const handleExecuteRestore = async () => {
    if (!restorePreview) return;
    const confirm = window.confirm(
      'WARNUNG: Das Einspielen der Sicherung überschreibt die ausgewählten Datenbestände unwiderruflich! Fortfahren?'
    );
    if (!confirm) return;

    try {
      setRestoring(true);
      setRestoreError(null);
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: restorePreview,
          options: {
            config: true,
            products: true,
            wordGroups: true,
            tables: true,
            printers: true,
            stock: true,
            orders: Boolean(restorePreview.orders),
            payments: Boolean(restorePreview.payments),
          },
        }),
      });

      if (res.ok) {
        setRestoreSuccess(true);
        setRestorePreview(null);
        setRestoreFile(null);
        loadConfig();
      } else {
        const errData = await res.json();
        setRestoreError(errData.error || 'Fehler beim Wiederherstellen der Daten.');
      }
    } catch (err: any) {
      setRestoreError(err.message || 'Netzwerkfehler beim Wiederherstellen.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 text-slate-100 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin/settings"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900 border border-slate-800 text-sm font-bold text-slate-300 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Zurück zur Konfiguration</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
              OpenBon v{APP_VERSION}
            </span>
          </div>
        </div>

        {/* Title Card */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-800">
              <Database className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">Datensicherung &amp; Auto-Backup</h1>
              <p className="text-sm text-slate-400 font-semibold mt-0.5">
                Revisionssichere Backups, periodische Snapshots und Notfallwiederherstellung
              </p>
            </div>
          </div>
          <button
            onClick={() => handleDownloadBackup(true)}
            className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg transition active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>1-Klick Komplett-Backup</span>
          </button>
        </div>

        {/* Database Status & Health */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <span>Speicherort &amp; Format</span>
            </div>
            <div className="font-mono text-sm font-bold text-white">prisma/dev.db</div>
            <div className="text-xs text-slate-400">SQLite 3 mit WAL-Journal (Write-Ahead-Logging)</div>
          </div>

          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>Revisionssicherheit</span>
            </div>
            <div className="font-bold text-sm text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>GoBD / KassenSichV konform</span>
            </div>
            <div className="text-xs text-slate-400">Transaktionsgesichert &amp; unveränderbares Action-Log</div>
          </div>

          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Auto-Backup Status</span>
            </div>
            <div className={`font-bold text-sm ${autoBackupEnabled ? 'text-emerald-400' : 'text-slate-400'}`}>
              {autoBackupEnabled ? `Aktiv (alle ${autoBackupIntervalMinutes} Min)` : 'Deaktiviert (Manuell)'}
            </div>
            <div className="text-xs text-slate-400">Automatische Snapshots im laufenden Betrieb</div>
          </div>
        </div>

        {/* Section 1: Auto-Backup Settings */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              <span>Automatisches Backup konfigurieren</span>
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Erstellt während des Festbetriebs in regelmäßigen Abständen automatische Momentaufnahmen der Datenbank.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div>
                <div className="font-bold text-sm text-white">Auto-Backup aktivieren</div>
                <div className="text-xs text-slate-400 mt-0.5">Sicherung im Hintergrund ohne Arbeitsunterbrechung</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoBackupEnabled}
                  onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-bold text-sm text-white">Sicherungs-Intervall</div>
                <div className="text-xs text-slate-400 mt-0.5">Zeitspanne zwischen automatischen Snapshots</div>
              </div>
              <select
                disabled={!autoBackupEnabled}
                value={autoBackupIntervalMinutes}
                onChange={(e) => setAutoBackupIntervalMinutes(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded-xl px-3 py-2 disabled:opacity-50"
              >
                <option value={15}>Alle 15 Minuten</option>
                <option value={30}>Alle 30 Minuten (Empfohlen)</option>
                <option value={60}>Jede Stunde</option>
                <option value={120}>Alle 2 Stunden</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {saveSuccess ? (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                <span>Einstellungen erfolgreich gespeichert!</span>
              </span>
            ) : <span />}

            <button
              onClick={handleSaveAutoBackup}
              disabled={saving}
              className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow transition"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Auto-Backup speichern</span>
            </button>
          </div>
        </div>

        {/* Section 2: Selective Export */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-emerald-400" />
              <span>Manueller &amp; Selektiver Export</span>
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Wählen Sie die gewünschten Datenbestände für den Download auf einen USB-Stick oder Sicherungsrechner.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {[
              { key: 'incConfig', label: 'Grundeinstellungen' },
              { key: 'incProducts', label: 'Artikel & Kategorien' },
              { key: 'incWordGroups', label: 'Wünsche-Baukasten' },
              { key: 'incTables', label: 'Tische & Layout' },
              { key: 'incPrinters', label: 'Drucker & Gruppen' },
              { key: 'incStock', label: 'Zutatenlager' },
              { key: 'incOrders', label: 'Bestellungen' },
              { key: 'incPayments', label: 'Zahlungen & Kasse' },
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition"
              >
                <input
                  type="checkbox"
                  checked={(scope as any)[item.key]}
                  onChange={(e) => setScope({ ...scope, [item.key]: e.target.checked })}
                  className="rounded border-slate-700 text-blue-600 focus:ring-0 bg-slate-900"
                />
                <span className="font-bold text-slate-300">{item.label}</span>
              </label>
            ))}
          </div>

          <button
            onClick={() => handleDownloadBackup(false)}
            className="w-full py-3 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition"
          >
            <Download className="w-4 h-4" />
            <span>Ausgewählte Daten herunterladen (.json)</span>
          </button>
        </div>

        {/* Section 3: Restore / Import */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-amber-400" />
              <span>Sicherung wiederherstellen (Restore)</span>
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Spielen Sie eine zuvor erstellte Sicherungsdatei (.json) ein, um Stammdaten oder Umsätze wiederherzustellen.
            </p>
          </div>

          <div className="border-2 border-dashed border-slate-800 rounded-3xl p-6 text-center space-y-3 hover:border-blue-600 transition bg-slate-950/50">
            <FileCheck className="w-10 h-10 text-slate-500 mx-auto" />
            <div className="text-sm font-bold text-slate-300">
              {restoreFile ? restoreFile.name : 'OpenBon Sicherungsdatei (.json) auswählen'}
            </div>
            <input
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
            />
          </div>

          {restoreError && (
            <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{restoreError}</span>
            </div>
          )}

          {restoreSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Daten erfolgreich wiederhergestellt! Das System ist auf dem Stand der Sicherung.</span>
            </div>
          )}

          {restorePreview && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vorschau der Sicherungsdatei:</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-900">
                  <span className="text-slate-500 block">Festname:</span>
                  <span className="font-bold text-white">{restorePreview.eventName || 'Veranstaltung'}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900">
                  <span className="text-slate-500 block">OpenBon Version:</span>
                  <span className="font-mono font-bold text-blue-400">v{restorePreview.version}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900">
                  <span className="text-slate-500 block">Erstellt am:</span>
                  <span className="font-mono font-bold text-white">
                    {new Date(restorePreview.exportedAt).toLocaleString('de-DE')}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900">
                  <span className="text-slate-500 block">Kategorien / Artikel:</span>
                  <span className="font-bold text-white">{restorePreview.categories?.length ?? 0} Gruppen</span>
                </div>
              </div>

              <button
                onClick={handleExecuteRestore}
                disabled={restoring}
                className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95"
              >
                {restoring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span>Sicherung jetzt unwiderruflich einspielen</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
