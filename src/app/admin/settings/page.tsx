'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Settings,
  Building2,
  Printer,
  Lock,
  Percent,
  Sparkles,
  Save,
  Search,
  RefreshCw,
  CheckCircle,
  Receipt,
  CreditCard,
} from 'lucide-react';
import { triggerHapticFeedback } from '@/lib/socket-client';
import { useToast } from '@/components/ui/toast';
import type { EventConfigDTO } from '@/types/domain';
import { GeneralTab } from './tabs/GeneralTab';
import { PrintersTab } from './tabs/PrintersTab';
import { SecurityTab } from './tabs/SecurityTab';
import { FiscalTab } from './tabs/FiscalTab';
import { SnapshotsTab } from './tabs/SnapshotsTab';
import { ReceiptTab } from './tabs/ReceiptTab';
import { CardPaymentTab } from './tabs/CardPaymentTab';

type SettingsTab = 'GENERAL' | 'RECEIPT' | 'PRINTERS' | 'CARDS' | 'SECURITY' | 'FISCAL' | 'SNAPSHOTS';

export default function AdminSettingsPage() {
  const { success, error } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>('GENERAL');
  const [config, setConfig] = useState<EventConfigDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [printers, setPrinters] = useState<any[]>([]);
  const [autostartInfo, setAutostartInfo] = useState<any>(null);
  const [togglingAutostart, setTogglingAutostart] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // N3.4: Basis-Snapshot gegen ungespeicherte Änderungen schützen
  const baselineRef = useRef<string | null>(null);

  const fetchConfig = async () => {
    try {
      const [cfgRes, autoRes, printRes] = await Promise.all([
        fetch('/api/config'),
        fetch('/api/system/autostart'),
        fetch('/api/printers'),
      ]);
      const data = await cfgRes.json();
      const autoData = await autoRes.json();
      const printData = await printRes.json();

      setConfig(data);
      try {
        baselineRef.current = JSON.stringify(data);
      } catch {}
      setAutostartInfo(autoData);
      if (Array.isArray(printData)) setPrinters(printData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleConfigUpdate = (updates: Partial<EventConfigDTO>) => {
    setConfig((prev) => (prev ? { ...prev, ...updates } : null));
  };

  const isDirty = Boolean(
    config && baselineRef.current !== null && JSON.stringify(config) !== baselineRef.current
  );

  // N3.4: Browser-Warnung bei ungespeicherten Änderungen (Tab schließen/navigieren)
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const handleSave = async () => {
    if (!config || saving) return;
    setSaving(true);
    triggerHapticFeedback();
    const snapshot = (() => {
      try {
        return JSON.stringify(config);
      } catch {
        return null;
      }
    })();
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (snapshot !== null) {
          baselineRef.current = snapshot;
        }
        success('Einstellungen erfolgreich gespeichert!');
      } else {
        error(data.error || data.message || data.details || 'Fehler beim Speichern der Einstellungen');
      }
    } catch (err) {
      error(err instanceof Error ? err.message : 'Netzwerkfehler beim Speichern');
    } finally {
      setSaving(false);
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
      setAutostartInfo(data);
      success(data.message || (nextVal ? 'Autostart aktiviert' : 'Autostart deaktiviert'));
    } catch {
      error('Fehler beim Ändern des Autostarts');
    } finally {
      setTogglingAutostart(false);
    }
  };

  if (loading || !config) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px] text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mr-2" />
        <span>Lade Einstellungen...</span>
      </div>
    );
  }

  const tabs: { id: SettingsTab; label: string; icon: any }[] = [
    { id: 'GENERAL', label: 'Allgemein', icon: Building2 },
    { id: 'RECEIPT', label: 'Bonlayout & Vorschau', icon: Receipt },
    { id: 'PRINTERS', label: 'Drucker', icon: Printer },
    { id: 'CARDS', label: 'Kartenzahlung', icon: CreditCard },
    { id: 'SECURITY', label: 'Sicherheit & PINs', icon: Lock },
    { id: 'FISCAL', label: 'Fiskal & Steuern', icon: Percent },
    { id: 'SNAPSHOTS', label: 'Vorlagen & Snapshots', icon: Sparkles },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 text-white p-3 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
      {/* Top Header & Save Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2.5 rounded-2xl shadow">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Systemeinstellungen</h1>
            <p className="text-xs text-slate-400">
              Zentrale Konfiguration für Veranstaltungsdaten, Drucker, PINs und Fiskalisierung
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !isDirty}
          className={`min-h-[48px] px-6 py-2.5 rounded-xl text-white font-black text-sm transition active:scale-95 touch-manipulation shadow-lg flex items-center gap-2 ${
            isDirty && !saving
              ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40'
              : 'bg-slate-700 opacity-60 cursor-not-allowed'
          }`}
        >
          <Save className="w-4 h-4" />
          <span>
            {saving
              ? 'Wird gespeichert...'
              : isDirty
                ? 'Änderungen speichern •'
                : 'Keine Änderungen'}
          </span>
        </button>
      </div>

      {/* Touch-Friendly Tab Navigation Bar (min 48px height) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800 scrollbar-none">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                triggerHapticFeedback();
                setActiveTab(t.id);
              }}
              className={`min-h-[48px] px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2 transition active:scale-95 touch-manipulation whitespace-nowrap ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Tab Content */}
      <div className="animate-in fade-in">
        {activeTab === 'GENERAL' && (
          <GeneralTab
            config={config}
            onChange={handleConfigUpdate}
            autostartInfo={autostartInfo}
            onToggleAutostart={handleToggleAutostart}
            togglingAutostart={togglingAutostart}
          />
        )}
        {activeTab === 'RECEIPT' && <ReceiptTab config={config} onChange={handleConfigUpdate} />}
        {activeTab === 'CARDS' && <CardPaymentTab config={config} onChange={handleConfigUpdate} />}
        {activeTab === 'PRINTERS' && (
          <PrintersTab config={config} onChange={handleConfigUpdate} printers={printers} />
        )}
        {activeTab === 'SECURITY' && (
          <SecurityTab config={config} onChange={handleConfigUpdate} />
        )}
        {activeTab === 'FISCAL' && (
          <FiscalTab config={config} onChange={handleConfigUpdate} />
        )}
        {activeTab === 'SNAPSHOTS' && <SnapshotsTab />}
      </div>
    </div>
  );
}
