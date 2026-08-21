'use client';

import React, { useEffect, useState } from 'react';
import {
  Settings,
  GraduationCap,
  Layers,
  Save,
  Download,
  Upload,
  RefreshCw,
  Check,
  AlertTriangle,
  HardDrive,
  Globe,
} from 'lucide-react';

export default function AdminSettingsPage() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setConfig(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e) {
      alert('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadBackup = () => {
    window.open('/api/backup', '_blank');
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('Achtung: Dadurch werden bestehende Stammdaten mit dem Backup überschrieben. Fortfahren?')) return;

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const json = JSON.parse(event.target?.result as string);
        const res = await fetch('/api/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json),
        });
        if (res.ok) {
          alert('Backup erfolgreich wiederhergestellt!');
          window.location.reload();
        } else {
          alert('Fehler beim Wiederherstellen des Backups.');
        }
      };
      reader.readAsText(file);
    } catch (err) {
      alert('Ungültige Backup-Datei.');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 text-white p-4 sm:p-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-purple-600 text-white p-2.5 rounded-2xl">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Einstellungen & Hochverfügbarkeit</h1>
            <p className="text-xs text-slate-400">
              Veranstaltungsdaten, Übungsmodus, 2-Server Replikation und JSON-Datensicherung
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Lade Einstellungen...</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Card 1: General Event Config */}
          <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              <span>Veranstaltungs-Stammdaten</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Veranstaltungsname *</label>
                <input
                  type="text"
                  required
                  value={config.name}
                  onChange={(e) => setConfig({ ...config, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Währung</label>
                <select
                  value={config.currency}
                  onChange={(e) => setConfig({ ...config, currency: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                >
                  <option value="EUR">Euro (€ - EUR)</option>
                  <option value="CHF">Schweizer Franken (CHF)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 2: Training Mode Toggle */}
          <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl flex items-center justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 mt-0.5">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-white">Übungsmodus (Trainingsmodus)</h4>
                <p className="text-xs text-slate-400 max-w-xl">
                  Wenn aktiviert, können neue Helfer gefahrlos das Bestellen und Kassieren üben. Es werden
                  keine echten Bons gedruckt und keine Umsätze in die Kassenberichte übernommen.
                </p>
              </div>
            </div>

            <input
              type="checkbox"
              checked={config.trainingMode}
              onChange={(e) => setConfig({ ...config, trainingMode: e.target.checked })}
              className="w-6 h-6 text-amber-500 rounded bg-slate-800 border-slate-700 cursor-pointer"
            />
          </div>

          {/* Card 3: High-Availability Failover Configuration */}
          <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Hochverfügbarkeit (Zwei-Rechner-Echtzeitsynchronisation)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Server-Rolle</label>
                <select
                  value={config.haRole}
                  onChange={(e) => setConfig({ ...config, haRole: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                >
                  <option value="PRIMARY">Hauptserver (Primary Master)</option>
                  <option value="STANDBY">Ersatzserver (Hot-Standby)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Partner-Server URL</label>
                <input
                  type="text"
                  placeholder="http://192.168.1.101:3000"
                  value={config.haPartnerUrl || ''}
                  onChange={(e) => setConfig({ ...config, haPartnerUrl: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                />
              </div>
            </div>

            <p className="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800">
              ℹ️ Der Ersatzserver (Standby) überwacht den Hauptserver sekündlich per Heartbeat und spiegelt alle
              Transaktionen in Echtzeit. Fällt der Hauptserver aus, übernimmt der Ersatzserver automatisch die Führung.
            </p>
          </div>

          {/* Card 4: Backup & Restore */}
          <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-purple-400" />
              <span>Veranstaltungs-Datensicherung (Export & Import)</span>
            </h3>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border border-slate-700 transition"
              >
                <Download className="w-4 h-4 text-blue-400" />
                <span>Stammdaten exportieren (JSON)</span>
              </button>

              <label className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border border-slate-700 transition cursor-pointer">
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>Backup importieren</span>
                <input type="file" accept=".json" onChange={handleRestoreBackup} className="hidden" />
              </label>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-end gap-3 pt-4">
            {saveSuccess && (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <Check className="w-4 h-4" />
                <span>Erfolgreich gespeichert!</span>
              </span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="pos-touch-btn flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold text-base shadow-lg shadow-blue-900/30 transition"
            >
              <Save className="w-5 h-5" />
              <span>{saving ? 'Speichert...' : 'Einstellungen speichern'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
