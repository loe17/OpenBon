import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  RotateCcw,
  HardDrive,
  Eye,
  X,
  Utensils,
  Layers,
  Printer,
  Trash2,
  AlertTriangle,
  FileText,
  Download,
  Upload,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { formatCurrency, formatCents } from '@/lib/utils';

export function SnapshotsTab() {
  const { success, error, warning } = useToast();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDesc, setNewProfileDesc] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inspectingProfile, setInspectingProfile] = useState<any | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [activeInspectorSection, setActiveInspectorSection] = useState<'products' | 'categories' | 'tables' | 'printers' | 'config'>('products');

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

  const handleExportProfile = (prof: any) => {
    const exportData = {
      type: 'OPENBON_EVENT_PROFILE',
      version: 1,
      exportedAt: new Date().toISOString(),
      name: prof.name,
      description: prof.description,
      snapshot: prof.snapshot,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vorlage-${prof.name.toLowerCase().replace(/[^a-z0-9]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    success(`Vorlage "${prof.name}" als JSON-Datei heruntergeladen.`);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const snapshot = parsed.snapshot || parsed;
      const name = parsed.name || file.name.replace(/\.json$/i, '');
      const description = parsed.description || 'Aus Datei importiert';

      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'IMPORT',
          name,
          description,
          snapshot,
        }),
      });

      if (res.ok) {
        success(`Vorlage "${name}" erfolgreich importiert!`);
        loadProfiles();
      } else {
        const j = await res.json().catch(() => ({}));
        error(j.error || 'Fehler beim Importieren der Vorlage');
      }
    } catch {
      error('Ungültige Vorlagendatei (JSON-Format erwartet).');
    } finally {
      e.target.value = '';
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    try {
      const res = await fetch(`/api/profiles?id=${encodeURIComponent(profileId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        success('Vorlage gelöscht.');
        setProfiles((prev) => prev.filter((p) => p.id !== profileId));
        setDeleteConfirmId(null);
        if (inspectingProfile?.id === profileId) {
          setInspectingProfile(null);
        }
      } else {
        error('Fehler beim Löschen der Vorlage');
      }
    } catch {
      error('Netzwerkfehler beim Löschen');
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
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <HardDrive className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-base text-white">
              Gespeicherte Veranstaltungs-Vorlagen ({profiles.length})
            </h3>
          </div>

          <label className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 transition cursor-pointer flex items-center gap-2 shadow active:scale-95">
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span>Vorlage aus Datei laden (.json)</span>
            <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
          </label>
        </div>

        {loading ? (
          <p className="text-xs text-slate-400 py-4">Lade Vorlagen...</p>
        ) : profiles.length === 0 ? (
          <p className="text-xs text-slate-500 py-4">Noch keine Vorlagen gespeichert.</p>
        ) : (
          <div className="space-y-3">
            {profiles.map((prof) => (
              <div
                key={prof.id}
                className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <h4 className="font-bold text-base text-white">{prof.name}</h4>
                    {prof.description && (
                      <p className="text-xs text-slate-400">{prof.description}</p>
                    )}
                    <div className="text-[11px] text-slate-500">
                      Erstellt am {new Date(prof.createdAt).toLocaleDateString('de-DE')} um{' '}
                      {new Date(prof.createdAt).toLocaleTimeString('de-DE', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleExportProfile(prof)}
                      className="min-h-[40px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5"
                      title="Vorlage als JSON-Datei herunterladen"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Download</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setInspectingProfile(prof);
                        setActiveInspectorSection('products');
                      }}
                      className="min-h-[40px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5"
                      title="Inhalte dieser Vorlage ansehen"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-400" />
                      <span>Details ansehen</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRestoreProfile(prof.id, prof.name)}
                      className="min-h-[40px] px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition active:scale-95 shadow flex items-center gap-1.5"
                      title="Diese Vorlage in die Kasse einspielen"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Vorlage laden</span>
                    </button>

                    {deleteConfirmId === prof.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteProfile(prof.id)}
                          className="min-h-[40px] px-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition"
                        >
                          Wirklich löschen?
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="min-h-[40px] px-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                        >
                          Abbrechen
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(prof.id)}
                        className="min-h-[40px] p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition"
                        title="Vorlage löschen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick Summary Badges */}
                {prof.summary && (
                  <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-900 text-xs text-slate-300">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
                      <Utensils className="w-3 h-3 text-emerald-400" />
                      <strong>{prof.summary.productCount}</strong> Artikel
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
                      <Layers className="w-3 h-3 text-blue-400" />
                      <strong>{prof.summary.categoryCount}</strong> Warengruppen
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
                      <strong>{prof.summary.tableCount}</strong> Tische
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
                      <Printer className="w-3 h-3 text-amber-400" />
                      <strong>{prof.summary.printerCount}</strong> Drucker
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Template Inspection Modal */}
      {inspectingProfile && inspectingProfile.snapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-blue-400" />
                  <h3 className="font-bold text-lg text-white">
                    Inhalt der Vorlage: {inspectingProfile.name}
                  </h3>
                </div>
                {inspectingProfile.description && (
                  <p className="text-xs text-slate-400">{inspectingProfile.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setInspectingProfile(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Tabs inside Modal */}
            <div className="flex items-center gap-1 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shrink-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveInspectorSection('products')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                  activeInspectorSection === 'products'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Artikel ({inspectingProfile.snapshot.products?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveInspectorSection('categories')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                  activeInspectorSection === 'categories'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Warengruppen ({inspectingProfile.snapshot.categories?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveInspectorSection('tables')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                  activeInspectorSection === 'tables'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Tische ({inspectingProfile.snapshot.tables?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveInspectorSection('printers')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                  activeInspectorSection === 'printers'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Drucker ({inspectingProfile.snapshot.printers?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveInspectorSection('config')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                  activeInspectorSection === 'config'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Stammdaten
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {activeInspectorSection === 'products' && (
                <div className="space-y-2">
                  {(inspectingProfile.snapshot.products || []).length === 0 ? (
                    <p className="text-slate-500 py-4 text-center">Keine Artikel enthalten.</p>
                  ) : (
                    (inspectingProfile.snapshot.products || []).map((prod: any) => {
                      const priceEuro =
                        typeof prod.priceCents === 'number'
                          ? prod.priceCents / 100
                          : prod.price || 0;
                      return (
                        <div
                          key={prod.id || prod.name}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800"
                        >
                          <div>
                            <span className="font-bold text-white block">{prod.name}</span>
                            <span className="text-[11px] text-slate-400">
                              {prod.depositCents > 0
                                ? `Pfand: ${formatCents(prod.depositCents)} · `
                                : ''}
                              MwSt: {prod.taxRate ?? 19}%
                              {prod.variants?.length > 0
                                ? ` · ${prod.variants.length} Variante(n)`
                                : ''}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-emerald-400 text-sm">
                            {formatCurrency(priceEuro)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {activeInspectorSection === 'categories' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(inspectingProfile.snapshot.categories || []).length === 0 ? (
                    <p className="text-slate-500 py-4 text-center col-span-2">
                      Keine Warengruppen enthalten.
                    </p>
                  ) : (
                    (inspectingProfile.snapshot.categories || []).map((cat: any) => (
                      <div
                        key={cat.id || cat.name}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2"
                      >
                        <Layers className="w-4 h-4 text-blue-400" />
                        <div>
                          <div className="font-bold text-white">{cat.name}</div>
                          <div className="text-[10px] text-slate-500">
                            Reihenfolge: #{cat.sortOrder ?? 0}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeInspectorSection === 'tables' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(inspectingProfile.snapshot.tables || []).length === 0 ? (
                    <p className="text-slate-500 py-4 text-center col-span-3">
                      Keine Tische enthalten.
                    </p>
                  ) : (
                    (inspectingProfile.snapshot.tables || []).map((t: any) => (
                      <div
                        key={t.id || t.tableNumber}
                        className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center"
                      >
                        <div className="font-bold text-white">Tisch #{t.tableNumber}</div>
                        <div className="text-[10px] text-slate-400">{t.label || t.section || 'Bereich'}</div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeInspectorSection === 'printers' && (
                <div className="space-y-3">
                  <div>
                    <h5 className="font-bold text-slate-300 mb-1.5">Drucker</h5>
                    <div className="space-y-1.5">
                      {(inspectingProfile.snapshot.printers || []).map((pr: any) => (
                        <div
                          key={pr.id || pr.name}
                          className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                        >
                          <span className="font-bold text-white">{pr.name}</span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            {pr.ipAddress || (pr.isVirtual ? 'Virtuell' : 'Lokal')} · {pr.paperWidth ?? 80}mm
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h5 className="font-bold text-slate-300 mb-1.5">Druckgruppen (Routing)</h5>
                    <div className="space-y-1.5">
                      {(inspectingProfile.snapshot.printGroups || []).map((pg: any) => (
                        <div
                          key={pg.id || pg.name}
                          className="p-2.5 rounded-xl bg-slate-950 border border-slate-800"
                        >
                          <span className="font-bold text-white">{pg.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeInspectorSection === 'config' && (
                <div className="space-y-2 p-3 bg-slate-950 rounded-2xl border border-slate-800">
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Veranstaltungsname:</span>
                    <strong className="text-white">
                      {inspectingProfile.snapshot.config?.name || 'Standard'}
                    </strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Währung:</span>
                    <strong className="text-white">
                      {inspectingProfile.snapshot.config?.currency || 'EUR'}
                    </strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">MwSt-Satz normal:</span>
                    <strong className="text-white">
                      {inspectingProfile.snapshot.config?.taxRateNormal ?? 19}%
                    </strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">MwSt-Satz ermäßigt:</span>
                    <strong className="text-white">
                      {inspectingProfile.snapshot.config?.taxRateReduced ?? 7}%
                    </strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Belegkopf:</span>
                    <strong className="text-white">
                      {inspectingProfile.snapshot.config?.receiptHeader || '-'}
                    </strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Gesichert am:</span>
                    <strong className="text-white">
                      {inspectingProfile.snapshot.savedAt
                        ? new Date(inspectingProfile.snapshot.savedAt).toLocaleString('de-DE')
                        : '-'}
                    </strong>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setInspectingProfile(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
              >
                Schließen
              </button>
              <button
                type="button"
                onClick={() => handleRestoreProfile(inspectingProfile.id, inspectingProfile.name)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Diese Vorlage jetzt laden</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
