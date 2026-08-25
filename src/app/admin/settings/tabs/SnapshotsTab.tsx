'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Download, Upload, Trash2, RotateCcw, CheckCircle2, HardDrive } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

export function SnapshotsTab() {
  const { success, error, warning } = useToast();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDesc, setNewProfileDesc] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadProfiles = async () => {
    try {
      const res = await fetch('/api/profiles');
      if (res.ok) {
        setProfiles(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleSaveCurrentAsProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) {
      warning('Bitte gib einen Vorlagennamen ein.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SAVE_CURRENT',
          name: newProfileName.trim(),
          description: newProfileDesc.trim() || undefined,
        }),
      });

      if (res.ok) {
        success(`Veranstaltungs-Vorlage "${newProfileName}" gesichert!`);
        setNewProfileName('');
        setNewProfileDesc('');
        loadProfiles();
      } else {
        error('Fehler beim Sichern der Vorlage');
      }
    } catch {
      error('Netzwerkfehler beim Sichern');
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreProfile = async (profileId: string, name: string) => {
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RESTORE',
          profileId,
        }),
      });

      if (res.ok) {
        success(`Vorlage "${name}" erfolgreich wiederhergestellt!`);
        setTimeout(() => window.location.reload(), 1200);
      } else {
        error('Fehler beim Wiederherstellen der Vorlage');
      }
    } catch {
      error('Netzwerkfehler beim Wiederherstellen');
    }
  };

  return (
    <div className="space-y-6">
      {/* Profil anlegen */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-base text-white">
            Aktuelle Kassenkonfiguration als Vorlage speichern
          </h3>
        </div>

        <form onSubmit={handleSaveCurrentAsProfile} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Name der Fest-Vorlage
              </label>
              <input
                type="text"
                required
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:border-amber-500"
                placeholder="z. B. Feuerwehrfest 2026 (Komplett)"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Beschreibung (Optional)
              </label>
              <input
                type="text"
                value={newProfileDesc}
                onChange={(e) => setNewProfileDesc(e.target.value)}
                className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:border-amber-500"
                placeholder="z. B. 20 Tische, Grill- & Ausschank-Routing"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="min-h-[48px] px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm transition active:scale-95 touch-manipulation shadow-lg shadow-amber-950/30 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>{saving ? 'Wird gespeichert...' : 'Als Vorlage sichern'}</span>
          </button>
        </form>
      </div>

      {/* Gespeicherte Profile */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <HardDrive className="w-5 h-5 text-blue-400" />
          <h3 className="font-bold text-base text-white">
            Gespeicherte Veranstaltungs-Vorlagen ({profiles.length})
          </h3>
        </div>

        {profiles.length === 0 ? (
          <p className="text-xs text-slate-500 py-4">Noch keine Vorlagen gespeichert.</p>
        ) : (
          <div className="space-y-3">
            {profiles.map((prof) => (
              <div
                key={prof.id}
                className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800"
              >
                <div>
                  <h4 className="font-bold text-sm text-white">{prof.name}</h4>
                  {prof.description && (
                    <p className="text-xs text-slate-400">{prof.description}</p>
                  )}
                  <span className="text-[11px] text-slate-500">
                    Erstellt: {new Date(prof.createdAt).toLocaleDateString('de-DE')}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleRestoreProfile(prof.id, prof.name)}
                  className="min-h-[48px] px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition active:scale-95 touch-manipulation shadow flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Laden</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
