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
  Lock,
  HardDrive,
  Globe,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';

export default function AdminSettingsPage() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // PIN change state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinChangeMsg, setPinChangeMsg] = useState<{ text: string; error?: boolean } | null>(null);

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

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeMsg(null);
    try {
      const res = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CHANGE', pin: currentPin, newPin }),
      });
      const data = await res.json();
      if (res.ok) {
        setPinChangeMsg({ text: 'Admin-PIN erfolgreich aktualisiert!' });
        setCurrentPin('');
        setNewPin('');
      } else {
        setPinChangeMsg({ text: data.error || 'Fehler beim Ändern', error: true });
      }
    } catch {
      setPinChangeMsg({ text: 'Verbindungsfehler', error: true });
    }
  };

  const handleDownloadBackup = () => {
    window.open('/api/backup', '_blank');
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('Achtung: Dadurch werden alle aktuellen Daten mit dem Backup überschrieben. Fortfahren?')) return;

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
          alert('Komplettbackup erfolgreich eingespielt!');
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
              Veranstaltungsdaten, Admin-PIN, 2-Server Replikation und Komplett-Datensicherung
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
        <div className="space-y-6">
          {/* Form 1: General Event Config */}
          <form onSubmit={handleSave} className="space-y-6">
            <div className="p-5 bg-slate-900 rounded-3xl border border-slate-700 shadow-xl space-y-4">
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
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Währung</label>
                  <select
                    value={config.currency}
                    onChange={(e) => setConfig({ ...config, currency: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-semibold"
                  >
                    <option value="EUR">Euro (€ - EUR)</option>
                    <option value="CHF">Schweizer Franken (CHF)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Card 2: Training Mode Toggle */}
            <div className="p-5 bg-slate-900 rounded-3xl border border-slate-700 shadow-xl flex items-center justify-between">
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
            <div className="p-5 bg-slate-900 rounded-3xl border border-slate-700 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Hochverfügbarkeit (Dual-Server Replikation)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Server-Rolle</label>
                  <select
                    value={config.haRole}
                    onChange={(e) => setConfig({ ...config, haRole: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-semibold"
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
                Der Ersatzserver (Standby) überwacht den Hauptserver sekündlich per Heartbeat und spiegelt alle
                Transaktionen in Echtzeit. Fällt der Hauptserver aus, übernimmt der Ersatzserver automatisch in &lt;3s.
              </p>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-end gap-3 pt-2">
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
                <span>{saving ? 'Speichert...' : 'Stammdaten speichern'}</span>
              </button>
            </div>
          </form>

          {/* Form 2: Change Admin PIN */}
          <form onSubmit={handleChangePin} className="p-5 bg-slate-900 rounded-3xl border border-slate-700 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-purple-400" />
              <span>Admin-PIN ändern</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Aktueller PIN</label>
                <input
                  type="password"
                  required
                  placeholder="Standard: 1234"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Neuer 4-stelliger PIN</label>
                <input
                  type="password"
                  required
                  placeholder="z. B. 5821"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                />
              </div>
            </div>

            {pinChangeMsg && (
              <div
                className={`text-xs font-bold p-2.5 rounded-xl border ${
                  pinChangeMsg.error
                    ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                    : 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                }`}
              >
                {pinChangeMsg.text}
              </div>
            )}

            <button
              type="submit"
              className="pos-touch-btn flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition"
            >
              <Lock className="w-4 h-4" />
              <span>Neuen PIN speichern</span>
            </button>
          </form>

          {/* Form 3: Complete Event Backup & Download */}
          <div className="p-5 bg-slate-900 rounded-3xl border border-slate-700 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <span>Gesamte Veranstaltung herunterladen & sichern</span>
            </h3>

            <p className="text-xs text-slate-400">
              Lade mit einem Klick das vollständige Archiv aller Artikel, Kategorien, Tische, Drucker, Bestellungen
              und Buchungen als portable JSON-Datei auf dein Endgerät (Laptop oder Smartphone) herunter.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="pos-touch-btn flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-2xl text-sm font-bold shadow-lg shadow-emerald-900/30 transition"
              >
                <Download className="w-4 h-4" />
                <span>Komplett-Backup herunterladen (JSON)</span>
              </button>

              <label className="pos-touch-btn flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-5 py-3 rounded-2xl text-sm font-bold border border-slate-700 transition cursor-pointer">
                <Upload className="w-4 h-4 text-blue-400" />
                <span>Backup wiederherstellen</span>
                <input type="file" accept=".json" onChange={handleRestoreBackup} className="hidden" />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
