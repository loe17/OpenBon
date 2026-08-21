'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
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
  Terminal,
  CheckSquare,
  Square,
  Sparkles,
  CreditCard,
  Receipt,
  FileCheck,
  AlertCircle,
} from 'lucide-react';
import { APP_VERSION, APP_IS_BETA } from '@/lib/version';
import { triggerHapticFeedback } from '@/lib/socket-client';
import { parseAndValidateLicense, LicenseData } from '@/lib/license';

export default function AdminSettingsPage() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // License State
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [licenseInfo, setLicenseInfo] = useState<LicenseData | null>(null);

  // Selective Backup Scopes State
  const [backupScopes, setBackupScopes] = useState({
    config: true,
    products: true,
    wordGroups: true,
    tables: true,
    printers: true,
    stock: true,
    orders: false,
    payments: false,
  });

  // Autostart State
  const [autostartInfo, setAutostartInfo] = useState<any>(null);
  const [togglingAutostart, setTogglingAutostart] = useState(false);

  const fetchConfig = async () => {
    try {
      const [cfgRes, autoRes] = await Promise.all([
        fetch('/api/config'),
        fetch('/api/system/autostart'),
      ]);
      const data = await cfgRes.json();
      const autoData = await autoRes.json();
      setConfig(data);
      setAutostartInfo(autoData);

      const parsedLic = parseAndValidateLicense(data.licenseKey || '');
      setLicenseInfo(parsedLic);
      setLicenseKeyInput(data.licenseKey || '');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutostart = async () => {
    triggerHapticFeedback();
    setTogglingAutostart(true);
    try {
      const nextVal = !autostartInfo?.autostartEnabled;
      const res = await fetch('/api/system/autostart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: nextVal }),
      });
      const data = await res.json();
      if (data.success) {
        setAutostartInfo((prev: any) => ({ ...prev, autostartEnabled: nextVal }));
      }
    } catch {
      alert('Fehler beim Ändern des Autostarts.');
    } finally {
      setTogglingAutostart(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    triggerHapticFeedback();

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          licenseKey: licenseKeyInput.trim() || 'OPENBON-COMMUNITY-FREE',
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        const parsedLic = parseAndValidateLicense(licenseKeyInput.trim());
        setLicenseInfo(parsedLic);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert('Fehler beim Speichern der Einstellungen!');
      }
    } catch {
      alert('Verbindungsfehler beim Speichern!');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadBackup = () => {
    triggerHapticFeedback();
    const activeScopes = Object.entries(backupScopes)
      .filter(([_, v]) => v)
      .map(([k]) => k)
      .join(',');

    window.open(`/api/backup?scopes=${activeScopes}`, '_blank');
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('Achtung: Dies stellt die gewählten Daten aus der Sicherung wieder her. Fortfahren?')) {
      return;
    }

    triggerHapticFeedback();
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      });

      const result = await res.json();
      if (res.ok) {
        alert(
          `Sicherung erfolgreich wiederhergestellt!\n\nDetails:\n- ${result.restored?.products || 0} Artikel\n- ${result.restored?.tables || 0} Tische\n- ${result.restored?.orders || 0} Bestellungen`
        );
        fetchConfig();
      } else {
        alert(`Fehler bei der Wiederherstellung: ${result.error}`);
      }
    } catch {
      alert('Fehler beim Lesen oder Verarbeiten der Sicherungsdatei.');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 text-white p-3 sm:p-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2.5 rounded-2xl shadow">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Grundeinstellungen & TSE</h1>
            <p className="text-xs text-slate-400">
              Eventkonfiguration, Stations-PINs, Kartendienste, KassenSichV TSE & Offline-Lizenz
            </p>
          </div>
        </div>

        {/* Top Save Button */}
        <button
          onClick={handleSave}
          disabled={saving || !config}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-xs transition shadow-lg ${
            saveSuccess
              ? 'bg-emerald-600 text-white shadow-emerald-950/50 scale-105'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-950/50'
          }`}
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : saveSuccess ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>{saveSuccess ? 'Erfolgreich gespeichert!' : 'Einstellungen speichern'}</span>
        </button>
      </div>

      {loading || !config ? (
        <div className="h-48 flex items-center justify-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Lade Einstellungen...</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Card 1: Event Info & Steuersätze */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-lg space-y-4">
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span>Veranstaltung & Währung</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Name der Veranstaltung (Auf allen Bons)
                </label>
                <input
                  type="text"
                  required
                  value={config.name || ''}
                  onChange={(e) => setConfig({ ...config, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Währungssymbol / ISO
                </label>
                <input
                  type="text"
                  required
                  value={config.currency || 'EUR'}
                  onChange={(e) => setConfig({ ...config, currency: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  MwSt-Normalsatz (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={config.taxRateNormal || 19}
                  onChange={(e) =>
                    setConfig({ ...config, taxRateNormal: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  MwSt-Ermäßigt (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={config.taxRateReduced || 7}
                  onChange={(e) =>
                    setConfig({ ...config, taxRateReduced: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Stations-PINs */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-lg space-y-4">
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>Stations-PINs & Zugriffsschutz</span>
            </h2>
            <p className="text-xs text-slate-400">
              PIN-Codes, die beim Wechsel auf die jeweilige Station oder im QR-Beitrittscenter abgefragt werden.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Admin-PIN
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={config.adminPin || '1234'}
                  onChange={(e) => setConfig({ ...config, adminPin: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-amber-300 font-mono font-bold text-center tracking-widest"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Bonkassen-PIN
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={config.posPin || '1111'}
                  onChange={(e) => setConfig({ ...config, posPin: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-emerald-300 font-mono font-bold text-center tracking-widest"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Küchen-PIN
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={config.kitchenPin || '2222'}
                  onChange={(e) => setConfig({ ...config, kitchenPin: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-blue-300 font-mono font-bold text-center tracking-widest"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Bedienungs-PIN
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={config.waiterPin || '3333'}
                  onChange={(e) => setConfig({ ...config, waiterPin: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-purple-300 font-mono font-bold text-center tracking-widest"
                />
              </div>
            </div>
          </div>

          {/* Card 3: Kartenzahlungs-Dienste */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-lg space-y-4">
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-400" />
              <span>Kartenzahlungs-Dienste (SumUp & VR-Pay Me)</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  SumUp Merchant Code / Affiliate Key
                </label>
                <input
                  type="text"
                  placeholder="z. B. M1234567"
                  value={config.sumupMerchantCode || ''}
                  onChange={(e) => setConfig({ ...config, sumupMerchantCode: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  VR-Pay Me Terminal-ID / Händler-Kennung
                </label>
                <input
                  type="text"
                  placeholder="z. B. VR-TERMINAL-889"
                  value={config.vrPayTerminalId || ''}
                  onChange={(e) => setConfig({ ...config, vrPayTerminalId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Card 4: KassenSichV & TSE Fiskalisierung */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-lg space-y-4">
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-400" />
              <span>KassenSichV & TSE-Fiskalisierung</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  TSE-Schnittstelle
                </label>
                <select
                  value={config.tseProvider || 'NONE'}
                  onChange={(e) => setConfig({ ...config, tseProvider: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="NONE">Keine TSE (Vereins-/Übungsbetrieb)</option>
                  <option value="SWISSBIT_USB">Swissbit Hardware TSE (USB / microSD)</option>
                  <option value="FISKALTRUST_CLOUD">fiskaltrust Cloud TSE</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  TSE-Seriennummer / Client-ID
                </label>
                <input
                  type="text"
                  placeholder="z. B. TSE-SWISS-99881122"
                  value={config.tseSerialNumber || ''}
                  onChange={(e) => setConfig({ ...config, tseSerialNumber: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Card 5: 100% Offline-Lizenzverwaltung */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-lg space-y-4">
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-amber-400" />
              <span>Offline-Lizenzverwaltung</span>
            </h2>

            {licenseInfo && (
              <div
                className={`p-4 rounded-2xl border ${
                  licenseInfo.isValid
                    ? 'bg-slate-950 border-emerald-800 text-slate-200'
                    : 'bg-rose-950/40 border-rose-800 text-rose-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-extrabold text-sm text-white">
                    {licenseInfo.licensee}
                  </span>
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      licenseInfo.isValid ? 'bg-emerald-950 text-emerald-400 border border-emerald-700' : 'bg-rose-950 text-rose-400 border border-rose-700'
                    }`}
                  >
                    {licenseInfo.isValid ? 'Gültig' : 'Ungültig'}
                  </span>
                </div>
                <div className="text-xs text-slate-400 space-y-1">
                  <div>Typ: <strong className="text-slate-200">{licenseInfo.type}</strong> | Max. Geräte: <strong className="text-slate-200">{licenseInfo.maxDevices}</strong></div>
                  <div>Gültig bis: <strong className="text-slate-200">{licenseInfo.expiresAt ? new Date(licenseInfo.expiresAt).toLocaleDateString('de-DE') : 'Unbegrenzt (Lifetime)'}</strong></div>
                  <div className="text-[11px] text-slate-500 pt-1">{licenseInfo.message}</div>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">
                Offline-Lizenzschlüssel eingeben
              </label>
              <textarea
                rows={2}
                placeholder="Lizenzschlüssel hier einfügen..."
                value={licenseKeyInput}
                onChange={(e) => setLicenseKeyInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Card 6: Autostart & Datensicherung */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-lg space-y-4">
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-blue-400" />
              <span>Autostart & Datensicherung</span>
            </h2>

            {/* Autostart Switch */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-sm font-extrabold text-white">Automatischer Systemstart</div>
                <div className="text-xs text-slate-400">
                  {autostartInfo?.autostartEnabled
                    ? 'OpenBon startet automatisch bei Hochfahren des Geräts'
                    : 'Manueller Start erforderlich'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleAutostart}
                disabled={togglingAutostart}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow ${
                  autostartInfo?.autostartEnabled
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                }`}
              >
                {autostartInfo?.autostartEnabled ? 'Aktiviert' : 'Deaktiviert'}
              </button>
            </div>

            {/* Backup Scopes */}
            <div className="pt-2">
              <label className="text-xs font-bold text-slate-400 block mb-2">
                Datensicherung Export / Import
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow"
                >
                  <Download className="w-4 h-4" />
                  <span>Sicherungsdatei herunterladen</span>
                </button>

                <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>Sicherung wiederherstellen</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleRestoreBackup}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Bottom Sticky Save Button */}
          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className={`flex items-center gap-2 px-8 py-3.5 rounded-2xl font-black text-sm transition shadow-2xl ${
                saveSuccess
                  ? 'bg-emerald-600 text-white shadow-emerald-950/60'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-950/60'
              }`}
            >
              {saving ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : saveSuccess ? (
                <Check className="w-5 h-5" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              <span>{saveSuccess ? 'Erfolgreich gespeichert!' : 'Einstellungen jetzt speichern'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
