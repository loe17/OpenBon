'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  Plus,
  RefreshCw,
  AlertTriangle,
  Trash2,
  Edit2,
  X,
  Save,
  Link2,
  PackagePlus,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { useSocket } from '@/components/providers/socket-provider';
import { triggerHapticFeedback } from '@/lib/socket-client';

/**
 * Lagerposten mit Verbrauchszuordnung.
 *
 * Bewusst getrennt von „Warenbestand" (/admin/inventory): dort hängt der
 * Bestand fest an einem einzelnen Artikel. Hier ist der Vorrat eine eigene
 * Einheit — „Brötchen", „Schnitzel", „Fass Helles" — von der mehrere Artikel,
 * Untereinträge und Optionen abziehen. Läuft sie leer, werden alle
 * verbrauchenden Artikel gesperrt, nicht nur einer.
 */

interface Consumption {
  id: string;
  amount: number;
  productId: string | null;
  variantId: string | null;
  optionId: string | null;
  product: { id: string; name: string } | null;
  variant: { id: string; name: string; productId: string } | null;
  option: { id: string; name: string; productId: string } | null;
}

interface StockUnit {
  id: string;
  name: string;
  unitLabel: string;
  initialQuantity: number;
  currentQuantity: number;
  alertThreshold: number;
  isActive: boolean;
  blockWhenEmpty: boolean;
  note: string | null;
  consumptions: Consumption[];
  isLow: boolean;
  isEmpty: boolean;
}

interface ProductRow {
  id: string;
  name: string;
  variants?: { id: string; name: string }[];
  options?: { id: string; name: string }[];
}

const EMPTY_FORM = {
  id: '',
  name: '',
  unitLabel: 'Stück',
  initialQuantity: 100,
  currentQuantity: 100,
  alertThreshold: 10,
  blockWhenEmpty: true,
  note: '',
};

export default function AdminStockUnitsPage() {
  const { success, error: toastError } = useToast();
  const { socket } = useSocket();

  const [units, setUnits] = useState<StockUnit[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [showForm, setShowForm] = useState(false);
  const [consumptionFor, setConsumptionFor] = useState<StockUnit | null>(null);

  /* --------------------------------------------------------------- Laden */

  const load = useCallback(async () => {
    try {
      const [uRes, pRes] = await Promise.all([fetch('/api/stock-units'), fetch('/api/products')]);
      if (uRes.ok) {
        const data = await uRes.json();
        if (Array.isArray(data)) setUnits(data);
      }
      if (pRes.ok) {
        const data = await pRes.json();
        if (Array.isArray(data)) setProducts(data);
      }
    } catch {
      toastError('Lagerposten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => void load();
    socket.on('stock:updated', handler);
    return () => {
      socket.off('stock:updated', handler);
    };
  }, [socket, load]);

  /* ------------------------------------------------------------ Speichern */

  const openNew = () => {
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  };

  const openEdit = (u: StockUnit) => {
    setForm({
      id: u.id,
      name: u.name,
      unitLabel: u.unitLabel,
      initialQuantity: u.initialQuantity,
      currentQuantity: u.currentQuantity,
      alertThreshold: u.alertThreshold,
      blockWhenEmpty: u.blockWhenEmpty,
      note: u.note || '',
    });
    setShowForm(true);
  };

  const save = async () => {
    if (form.name.trim().length < 2) {
      toastError('Bitte einen Namen mit mindestens 2 Zeichen angeben.');
      return;
    }
    setSaving(true);
    triggerHapticFeedback();
    try {
      const res = await fetch('/api/stock-units', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError(data.error || 'Speichern fehlgeschlagen.');
        return;
      }
      success(form.id ? 'Lagerposten aktualisiert.' : 'Lagerposten angelegt.');
      setShowForm(false);
      await load();
    } catch {
      toastError('Netzwerkfehler beim Speichern.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (u: StockUnit) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/stock-units?id=${encodeURIComponent(u.id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        toastError(data.error || 'Löschen fehlgeschlagen.');
        return;
      }
      success(`Lagerposten „${u.name}" gelöscht.`);
      await load();
    } catch {
      toastError('Netzwerkfehler beim Löschen.');
    } finally {
      setSaving(false);
    }
  };

  /** Schnelles Nachlegen im Betrieb. */
  const restock = async (u: StockUnit, plus: number) => {
    try {
      const res = await fetch('/api/stock-units', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: u.id, currentQuantity: u.currentQuantity + plus }),
      });
      if (!res.ok) {
        const data = await res.json();
        toastError(data.error || 'Nachlegen fehlgeschlagen.');
        return;
      }
      success(`${plus} ${u.unitLabel} nachgelegt.`);
      await load();
    } catch {
      toastError('Netzwerkfehler beim Nachlegen.');
    }
  };

  /* ---------------------------------------------------------- Rendering */

  const lowCount = useMemo(() => units.filter((u) => u.isActive && u.isLow).length, [units]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px] text-slate-400 gap-2">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
        <span>Lade Lagerposten …</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 text-white p-3 sm:p-6 max-w-5xl mx-auto w-full space-y-6">
      {/* Kopf */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 text-white p-2.5 rounded-2xl shadow">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Lagerposten</h1>
            <p className="text-xs text-slate-400">
              Vorräte, von denen mehrere Artikel gemeinsam abziehen
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="min-h-[48px] px-5 rounded-2xl bg-blue-600 hover:bg-blue-500 font-black text-sm flex items-center gap-2 transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Lagerposten anlegen
        </button>
      </div>

      {/* Erklärung */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 text-xs text-slate-400 leading-relaxed">
        Ein Lagerposten ist ein Vorrat als eigene Einheit — etwa „Brötchen“. Darunter legen Sie
        fest, welcher Artikel wie viel davon verbraucht. So zieht die Bratwurstsemmel dasselbe
        Brötchen ab wie die Steaksemmel, und wenn der Vorrat leer ist, sind beide gesperrt.
        <br />
        Für Artikel mit eigenem, nicht geteiltem Bestand bleibt der{' '}
        <span className="text-slate-300 font-bold">Warenbestand</span> die einfachere Wahl.
      </div>

      {lowCount > 0 && (
        <div className="flex items-center gap-2.5 bg-amber-950/40 border border-amber-800/60 text-amber-200 rounded-2xl p-3.5">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-bold">
            {lowCount} Lagerposten {lowCount === 1 ? 'liegt' : 'liegen'} unter der Warnschwelle.
          </span>
        </div>
      )}

      {/* Liste */}
      {units.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 mx-auto">
            <Boxes className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-slate-300">Noch kein Lagerposten angelegt</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Sinnvoll für alles, was knapp werden kann und von mehreren Artikeln gebraucht wird:
            Brötchen, Schnitzel, Pommesportionen, Fassinhalt.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {units.map((u) => {
            const pct =
              u.initialQuantity > 0
                ? Math.max(0, Math.min(100, Math.round((u.currentQuantity / u.initialQuantity) * 100)))
                : 0;
            return (
              <div
                key={u.id}
                className={`bg-slate-900 border rounded-3xl p-4 space-y-3 ${
                  !u.isActive
                    ? 'border-slate-800 opacity-60'
                    : u.isEmpty
                    ? 'border-rose-700'
                    : u.isLow
                    ? 'border-amber-700'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-lg">{u.name}</span>
                      {!u.isActive && (
                        <span className="text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
                          inaktiv
                        </span>
                      )}
                      {u.isEmpty && u.isActive && (
                        <span className="text-[10px] font-bold bg-rose-950 border border-rose-800 text-rose-300 px-2 py-0.5 rounded-full">
                          aufgebraucht
                        </span>
                      )}
                      {!u.isEmpty && u.isLow && u.isActive && (
                        <span className="text-[10px] font-bold bg-amber-950 border border-amber-800 text-amber-300 px-2 py-0.5 rounded-full">
                          wird knapp
                        </span>
                      )}
                    </div>
                    {u.note ? <p className="text-xs text-slate-500 mt-0.5">{u.note}</p> : null}
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono font-black text-2xl">
                      {u.currentQuantity}
                      <span className="text-sm text-slate-400 font-bold ml-1">{u.unitLabel}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      von {u.initialQuantity} · Warnung ab {u.alertThreshold}
                    </div>
                  </div>
                </div>

                {/* Füllstand */}
                <div className="h-2 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      u.isEmpty ? 'bg-rose-600' : u.isLow ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Verbraucher */}
                <div className="flex flex-wrap gap-1.5">
                  {u.consumptions.length === 0 ? (
                    <span className="text-xs text-slate-500">
                      Noch kein Artikel zugeordnet — dieser Vorrat wird nie abgebaut.
                    </span>
                  ) : (
                    u.consumptions.map((c) => {
                      const label = c.product
                        ? c.product.name
                        : c.variant
                        ? `${c.variant.name} (Untereintrag)`
                        : c.option
                        ? `${c.option.name} (Option)`
                        : 'unbekannt';
                      return (
                        <span
                          key={c.id}
                          className="text-[11px] font-bold bg-slate-950 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-lg"
                        >
                          {label} · {c.amount} {u.unitLabel}
                        </span>
                      );
                    })
                  )}
                </div>

                {/* Aktionen */}
                <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-800">
                  {[10, 25, 50].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => void restock(u, n)}
                      className="min-h-[40px] px-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                    >
                      <PackagePlus className="w-3.5 h-3.5" />+{n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setConsumptionFor(u)}
                    className="min-h-[40px] px-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Verbrauch zuordnen
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(u)}
                    className="min-h-[40px] px-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Bearbeiten
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void remove(u)}
                    className="min-h-[40px] px-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Löschen
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------ Formular-Dialog */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="font-black text-lg">
                {form.id ? 'Lagerposten bearbeiten' : 'Lagerposten anlegen'}
              </h2>
              <button type="button" onClick={() => setShowForm(false)} className="p-2 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="z. B. Brötchen"
                className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Einheit</label>
                <input
                  type="text"
                  value={form.unitLabel}
                  onChange={(e) => setForm({ ...form, unitLabel: e.target.value })}
                  placeholder="Stück"
                  className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Warnung ab</label>
                <input
                  type="number"
                  min={0}
                  value={form.alertThreshold}
                  onChange={(e) => setForm({ ...form, alertThreshold: Number(e.target.value) || 0 })}
                  className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Anfangsbestand</label>
                <input
                  type="number"
                  min={0}
                  value={form.initialQuantity}
                  onChange={(e) => {
                    const v = Number(e.target.value) || 0;
                    // Beim Neuanlegen zieht der aktuelle Bestand mit.
                    setForm((f) => ({
                      ...f,
                      initialQuantity: v,
                      currentQuantity: f.id ? f.currentQuantity : v,
                    }));
                  }}
                  className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Aktueller Bestand</label>
                <input
                  type="number"
                  min={0}
                  value={form.currentQuantity}
                  onChange={(e) => setForm({ ...form, currentQuantity: Number(e.target.value) || 0 })}
                  className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Bemerkung</label>
              <input
                type="text"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="z. B. Lieferung Samstag früh"
                className="w-full min-h-[48px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:border-blue-500"
              />
            </div>

            <label className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer">
              <div>
                <div className="font-bold text-sm">Artikel sperren, wenn aufgebraucht</div>
                <p className="text-xs text-slate-400">
                  Ausgeschaltet läuft der Verkauf weiter und der Bestand geht ins Minus – nur
                  sinnvoll, wenn Sie nachlegen können.
                </p>
              </div>
              <input
                type="checkbox"
                checked={form.blockWhenEmpty}
                onChange={(e) => setForm({ ...form, blockWhenEmpty: e.target.checked })}
                className="w-6 h-6 accent-blue-500 shrink-0"
              />
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="min-h-[48px] px-5 rounded-2xl bg-slate-800 border border-slate-700 font-bold text-sm"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="flex-1 min-h-[48px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-black text-sm flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------- Verbrauchs-Dialog */}
      {consumptionFor && (
        <ConsumptionEditor
          unit={consumptionFor}
          products={products}
          onClose={() => setConsumptionFor(null)}
          onSaved={async () => {
            await load();
          }}
        />
      )}
    </div>
  );
}

/* ==================================================================== */

function ConsumptionEditor({
  unit,
  products,
  onClose,
  onSaved,
}: {
  unit: StockUnit;
  products: ProductRow[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { success, error: toastError } = useToast();
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  /** Aktueller Verbrauch je Ziel, damit Eingaben sofort sichtbar sind. */
  const current = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of unit.consumptions) {
      const key = c.productId
        ? `p:${c.productId}`
        : c.variantId
        ? `v:${c.variantId}`
        : `o:${c.optionId}`;
      map.set(key, c.amount);
    }
    return map;
  }, [unit.consumptions]);

  const [draft, setDraft] = useState<Map<string, string>>(new Map());

  const valueFor = (key: string) => {
    const d = draft.get(key);
    if (d !== undefined) return d;
    const v = current.get(key);
    return v === undefined ? '' : String(v);
  };

  const setValue = (key: string, v: string) => {
    const next = new Map(draft);
    next.set(key, v.replace(/[^0-9.,]/g, ''));
    setDraft(next);
  };

  const persist = async (key: string) => {
    const raw = valueFor(key);
    const amount = raw.trim() === '' ? 0 : parseFloat(raw.replace(',', '.'));
    const [kind, id] = key.split(':');

    setBusy(true);
    try {
      const res = await fetch('/api/stock-units/consumption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockUnitId: unit.id,
          productId: kind === 'p' ? id : null,
          variantId: kind === 'v' ? id : null,
          optionId: kind === 'o' ? id : null,
          amount: Number.isFinite(amount) ? amount : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError(data.error || 'Zuordnung konnte nicht gespeichert werden.');
        return;
      }
      success(amount > 0 ? 'Verbrauch gespeichert.' : 'Zuordnung entfernt.');
      await onSaved();
    } catch {
      toastError('Netzwerkfehler beim Speichern der Zuordnung.');
    } finally {
      setBusy(false);
    }
  };

  const filtered = products.filter((p) =>
    search.trim() === '' ? true : p.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  const inputClass =
    'w-24 min-h-[40px] px-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white font-mono text-right focus:border-blue-500';

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div>
            <h2 className="font-black text-lg">Verbrauch von „{unit.name}“</h2>
            <p className="text-xs text-slate-400">
              Wie viel {unit.unitLabel} zieht ein Artikel ab? Leer oder 0 hebt die Zuordnung auf.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-800">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Artikel suchen …"
            className="w-full min-h-[44px] px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:border-blue-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">Kein Artikel gefunden.</p>
          ) : (
            filtered.map((p) => (
              <div key={p.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-sm">{p.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={valueFor(`p:${p.id}`)}
                      onChange={(e) => setValue(`p:${p.id}`, e.target.value)}
                      onBlur={() => void persist(`p:${p.id}`)}
                      placeholder="0"
                      disabled={busy}
                      className={inputClass}
                    />
                    <span className="text-xs text-slate-500 w-12">{unit.unitLabel}</span>
                  </div>
                </div>

                {(p.variants || []).length > 0 && (
                  <div className="pl-4 border-l border-slate-800 space-y-1.5">
                    {(p.variants || []).map((v) => (
                      <div key={v.id} className="flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-400">
                          Untereintrag: <span className="text-slate-300">{v.name}</span>
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={valueFor(`v:${v.id}`)}
                            onChange={(e) => setValue(`v:${v.id}`, e.target.value)}
                            onBlur={() => void persist(`v:${v.id}`)}
                            placeholder="0"
                            disabled={busy}
                            className={inputClass}
                          />
                          <span className="text-xs text-slate-500 w-12">{unit.unitLabel}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(p.options || []).length > 0 && (
                  <div className="pl-4 border-l border-slate-800 space-y-1.5">
                    {(p.options || []).map((o) => (
                      <div key={o.id} className="flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-400">
                          Option: <span className="text-slate-300">{o.name}</span>
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={valueFor(`o:${o.id}`)}
                            onChange={(e) => setValue(`o:${o.id}`, e.target.value)}
                            onBlur={() => void persist(`o:${o.id}`)}
                            placeholder="0"
                            disabled={busy}
                            className={inputClass}
                          />
                          <span className="text-xs text-slate-500 w-12">{unit.unitLabel}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="border-t border-slate-800 p-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500">
            Änderungen werden beim Verlassen des Feldes gespeichert.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 rounded-2xl bg-blue-600 hover:bg-blue-500 font-black text-sm"
          >
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
}
