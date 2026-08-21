'use client';

import React, { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import {
  Utensils,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Layers,
  Sparkles,
  RefreshCw,
  Search,
  Check,
  X,
  Coins,
  Receipt,
  Package,
  Ban,
  CheckCircle,
  Tag,
} from 'lucide-react';

export default function AdminProductsPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [printGroups, setPrintGroups] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [selectedSubCat, setSelectedSubCat] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    alternativeTicketName: '',
    price: 4.5,
    deposit: 0.0,
    taxRate: 19.0,
    buttonColor: '#3b82f6',
    categoryId: '',
    printGroupId: '',
    isSoldOut: false,
    trackStock: false,
    stockQuantity: 100,
    stockAlertThreshold: 10,
    subCategory: '',
    variants: [] as { name: string; priceDelta: number; isSoldOut?: boolean }[],
    options: [] as { name: string; priceDelta: number }[],
  });

  const fetchData = async () => {
    try {
      const [catRes, pgRes, pRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/print-groups'),
        fetch('/api/products'),
      ]);
      const cats = await catRes.json();
      const pgs = await pgRes.json();
      const prods = await pRes.json();

      if (Array.isArray(cats)) {
        setCategories(cats);
        if (cats.length > 0 && !selectedCatId) setSelectedCatId(cats[0].id);
      }
      if (Array.isArray(pgs)) setPrintGroups(pgs);
      if (Array.isArray(prods)) setProducts(prods);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openNewModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      alternativeTicketName: '',
      price: 4.5,
      deposit: 0.0,
      taxRate: 19.0,
      buttonColor: '#3b82f6',
      categoryId: selectedCatId || (categories[0]?.id || ''),
      printGroupId: printGroups[0]?.id || '',
      isSoldOut: false,
      trackStock: false,
      stockQuantity: 100,
      stockAlertThreshold: 10,
      subCategory: '',
      variants: [],
      options: [],
    });
    setShowModal(true);
  };

  const openEditModal = (prod: any) => {
    setEditingProduct(prod);
    setFormData({
      name: prod.name,
      alternativeTicketName: prod.alternativeTicketName || '',
      price: prod.price,
      deposit: prod.deposit || 0.0,
      taxRate: prod.taxRate || 19.0,
      buttonColor: prod.buttonColor || '#3b82f6',
      categoryId: prod.categoryId,
      printGroupId: prod.printGroupId || '',
      isSoldOut: prod.isSoldOut || false,
      trackStock: prod.trackStock || false,
      stockQuantity: prod.stockQuantity || 0,
      stockAlertThreshold: prod.stockAlertThreshold || 10,
      subCategory: prod.subCategory || '',
      variants: prod.variants ? prod.variants.map((v: any) => ({ name: v.name, priceDelta: v.priceDelta, isSoldOut: v.isSoldOut })) : [],
      options: prod.options ? prod.options.map((o: any) => ({ name: o.name, priceDelta: o.priceDelta })) : [],
    });
    setShowModal(true);
  };

  const handleToggleSoldOut = async (prod: any) => {
    const nextVal = !prod.isSoldOut;
    try {
      await fetch(`/api/products/${prod.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSoldOut: nextVal }),
      });
      fetchData();
    } catch {
      alert('Fehler beim Aktualisieren des Sperrstatus');
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`Artikel "${name}" wirklich löschen / ausblenden?`)) return;
    try {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
      fetchData();
    } catch {
      alert('Fehler beim Löschen');
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await fetch(`/api/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      } else {
        await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }
      setShowModal(false);
      fetchData();
    } catch {
      alert('Fehler beim Speichern');
    }
  };

  const filteredProducts = products.filter((p) => {
    if (selectedCatId && p.categoryId !== selectedCatId) return false;
    if (selectedSubCat !== 'ALL' && p.subCategory !== selectedSubCat) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 text-white p-3 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2.5 rounded-2xl shadow">
            <Utensils className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Artikel & Speisekarte</h1>
            <p className="text-xs text-slate-400">
              Artikelverwaltung mit Varianten, Getränkefilter, Bestandsführung und 1-Klick Ausverkauft-Sperre
            </p>
          </div>
        </div>

        <button
          onClick={openNewModal}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold transition shadow-lg shadow-blue-950/50"
        >
          <Plus className="w-4 h-4" />
          <span>Artikel anlegen</span>
        </button>
      </div>

      {/* Category Navigation Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              setSelectedCatId(cat.id);
              setSelectedSubCat('ALL');
            }}
            className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider transition whitespace-nowrap border ${
              selectedCatId === cat.id
                ? 'bg-blue-600 text-white border-blue-400 shadow-md'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Beverage Subcategory Quick Filter (Optional) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 text-xs">
        <span className="text-slate-500 font-bold text-[11px] uppercase mr-1">Getränkefilter:</span>
        {[
          { id: 'ALL', label: 'Alle' },
          { id: 'BIER', label: '🍺 Bier & Radler' },
          { id: 'WEIN', label: '🍷 Wein & Schorle' },
          { id: 'ALKOHOLFREI', label: '🥤 Alkoholfrei / Soft' },
          { id: 'HEISS', label: '☕ Kaffee & Tee' },
          { id: 'BAR', label: '🍸 Bar & Spirituosen' },
        ].map((sub) => (
          <button
            key={sub.id}
            onClick={() => setSelectedSubCat(sub.id)}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition border ${
              selectedSubCat === sub.id
                ? 'bg-slate-800 text-amber-300 border-amber-500/50'
                : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
            }`}
          >
            {sub.label}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredProducts.map((p) => (
          <div
            key={p.id}
            className={`bg-slate-900 border rounded-3xl p-4 shadow-lg flex flex-col justify-between transition ${
              p.isSoldOut ? 'border-rose-900/60 bg-rose-950/20' : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: p.buttonColor || '#3b82f6' }}
                />
                <button
                  onClick={() => handleToggleSoldOut(p)}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition ${
                    p.isSoldOut
                      ? 'bg-rose-600 text-white shadow'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title={p.isSoldOut ? 'Artikel ist gesperrt / ausverkauft' : 'Artikel ist aktiv'}
                >
                  {p.isSoldOut ? <Ban className="w-3 h-3" /> : <CheckCircle className="w-3 h-3 text-emerald-400" />}
                  <span>{p.isSoldOut ? 'Gesperrt' : 'Aktiv'}</span>
                </button>
              </div>

              <h3 className={`font-extrabold text-base mb-1 ${p.isSoldOut ? 'line-through text-slate-400' : 'text-white'}`}>
                {p.name}
              </h3>

              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-xl font-black text-white">{formatCurrency(p.price)}</span>
                {p.deposit > 0 && (
                  <span className="text-xs text-slate-400 font-semibold">
                    +{formatCurrency(p.deposit)} Pfand
                  </span>
                )}
              </div>

              {/* Stock Info */}
              {p.trackStock && (
                <div className="text-[11px] font-semibold mb-3 flex items-center justify-between px-2.5 py-1 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Package className="w-3 h-3 text-blue-400" />
                    <span>Bestand:</span>
                  </span>
                  <span className={`font-black ${p.stockQuantity <= p.stockAlertThreshold ? 'text-rose-400' : 'text-slate-200'}`}>
                    {p.stockQuantity} Stk.
                  </span>
                </div>
              )}

              {/* Variants Pill List */}
              {p.variants && p.variants.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {p.variants.map((v: any, idx: number) => (
                    <span
                      key={idx}
                      className={`text-[10px] px-2 py-0.5 rounded-lg font-bold border ${
                        v.isSoldOut
                          ? 'bg-rose-950/40 text-rose-400 border-rose-800 line-through'
                          : 'bg-slate-950 text-slate-300 border-slate-800'
                      }`}
                    >
                      {v.name} ({v.priceDelta >= 0 ? `+${v.priceDelta.toFixed(2)}` : v.priceDelta.toFixed(2)} €)
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-3 border-t border-slate-800/80">
              <button
                onClick={() => openEditModal(p)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition border border-slate-700"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Bearbeiten</span>
              </button>
              <button
                onClick={() => handleDeleteProduct(p.id, p.name)}
                className="p-2 bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-xl transition border border-slate-700"
                title="Löschen"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Product Edit / Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-lg text-white">
                {editingProduct ? 'Artikel bearbeiten' : 'Neuen Artikel anlegen'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Artikelname (Anzeige & Kasse)
                </label>
                <input
                  required
                  type="text"
                  placeholder="z. B. Helles Bier 0,5l oder Bratwurstsemmel"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Preis (€)</label>
                  <input
                    required
                    type="number"
                    step="0.10"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Pfand (€)</label>
                  <input
                    type="number"
                    step="0.50"
                    value={formData.deposit}
                    onChange={(e) => setFormData({ ...formData, deposit: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">MwSt (%)</label>
                  <select
                    value={formData.taxRate}
                    onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value={19.0}>19 % (Getränke/Alkohol)</option>
                    <option value={7.0}>7 % (Speisen/Verzehr)</option>
                    <option value={0.0}>0 % (Steuerfrei)</option>
                  </select>
                </div>
              </div>

              {/* Category & Beverage Tag */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Warengruppe</label>
                  <select
                    required
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Getränke-Kategorie</label>
                  <select
                    value={formData.subCategory}
                    onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="">Kein Getränke-Tag</option>
                    <option value="BIER">🍺 Bier & Radler</option>
                    <option value="WEIN">🍷 Wein & Schorle</option>
                    <option value="ALKOHOLFREI">🥤 Alkoholfrei / Softdrinks</option>
                    <option value="HEISS">☕ Kaffee & Tee</option>
                    <option value="BAR">🍸 Bar & Spirituosen</option>
                  </select>
                </div>
              </div>

              {/* Stock Management Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-blue-400" />
                    <span>Bestand für diesen Artikel überwachen</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={formData.trackStock}
                    onChange={(e) => setFormData({ ...formData, trackStock: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                </div>

                {formData.trackStock && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">
                        Aktueller Bestand (Stk./Portionen)
                      </label>
                      <input
                        type="number"
                        value={formData.stockQuantity}
                        onChange={(e) =>
                          setFormData({ ...formData, stockQuantity: parseInt(e.target.value, 10) || 0 })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">
                        Warnschwelle (Stk.)
                      </label>
                      <input
                        type="number"
                        value={formData.stockAlertThreshold}
                        onChange={(e) =>
                          setFormData({ ...formData, stockAlertThreshold: parseInt(e.target.value, 10) || 0 })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Lock / Sold Out Checkbox */}
              <div className="flex items-center gap-2 p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <input
                  type="checkbox"
                  id="isSoldOut"
                  checked={formData.isSoldOut}
                  onChange={(e) => setFormData({ ...formData, isSoldOut: e.target.checked })}
                  className="w-4 h-4 rounded text-rose-600"
                />
                <label htmlFor="isSoldOut" className="text-xs text-rose-300 font-bold cursor-pointer">
                  Diesen Artikel sofort als AUSVERKAUFT / GESPERRT markieren
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black shadow-lg"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
