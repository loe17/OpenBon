'use client';

import React, { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import {
  Utensils,
  Plus,
  Edit2,
  Trash2,
  Layers,
  Sparkles,
  Package,
  Ban,
  CheckCircle,
  X,
  ShieldAlert,
  AlertCircle,
  Ticket,
  Clock,
} from 'lucide-react';
import { EU_ALLERGENS, GASTRONOMY_ADDITIVES } from '@/lib/compliance';
import type { ProductDTO, ProductCategoryDTO, PrintGroupDTO } from '@/types/domain';

export default function AdminProductsPage() {
  const [categories, setCategories] = useState<ProductCategoryDTO[]>([]);
  const [printGroups, setPrintGroups] = useState<PrintGroupDTO[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [selectedSubCat, setSelectedSubCat] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);

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
    minStockAlert: 10 as number | null,
    stockAlertThreshold: 10,
    hasAgeRestriction: false,
    minAge: 16 as number | null,
    allergens: [] as string[],
    additives: [] as string[],
    happyHourPrice: '' as string | number,
    happyHourStart: '',
    happyHourEnd: '',
    happyHourDays: [1, 2, 3, 4, 5] as number[],
    isTokenProduct: false,
    tokenType: 'DRINK',
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
      minStockAlert: 10,
      stockAlertThreshold: 10,
      hasAgeRestriction: false,
      minAge: 16,
      allergens: [],
      additives: [],
      happyHourPrice: '',
      happyHourStart: '',
      happyHourEnd: '',
      happyHourDays: [1, 2, 3, 4, 5],
      isTokenProduct: false,
      tokenType: 'DRINK',
      subCategory: '',
      variants: [],
      options: [],
    });
    setShowModal(true);
  };

  const openEditModal = (prod: any) => {
    setEditingProduct(prod);

    let parsedAllergens: string[] = [];
    let parsedAdditives: string[] = [];
    let parsedDays: number[] = [1, 2, 3, 4, 5];

    try {
      if (prod.allergens) parsedAllergens = JSON.parse(prod.allergens);
      if (prod.additives) parsedAdditives = JSON.parse(prod.additives);
      if (prod.happyHourDays) parsedDays = JSON.parse(prod.happyHourDays);
    } catch {}

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
      minStockAlert: prod.minStockAlert !== undefined ? prod.minStockAlert : 10,
      stockAlertThreshold: prod.stockAlertThreshold || 10,
      hasAgeRestriction: Boolean(prod.hasAgeRestriction),
      minAge: prod.minAge || 16,
      allergens: Array.isArray(parsedAllergens) ? parsedAllergens : [],
      additives: Array.isArray(parsedAdditives) ? parsedAdditives : [],
      happyHourPrice: prod.happyHourPrice !== null && prod.happyHourPrice !== undefined ? prod.happyHourPrice : '',
      happyHourStart: prod.happyHourStart || '',
      happyHourEnd: prod.happyHourEnd || '',
      happyHourDays: Array.isArray(parsedDays) ? parsedDays : [1, 2, 3, 4, 5],
      isTokenProduct: Boolean(prod.isTokenProduct),
      tokenType: prod.tokenType || 'DRINK',
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
      const payload = {
        ...formData,
        allergens: JSON.stringify(formData.allergens),
        additives: JSON.stringify(formData.additives),
        happyHourDays: JSON.stringify(formData.happyHourDays),
        happyHourPrice: formData.happyHourPrice === '' ? null : parseFloat(String(formData.happyHourPrice)),
        minStockAlert: formData.trackStock ? (formData.minStockAlert !== null ? Number(formData.minStockAlert) : null) : null,
        minAge: formData.hasAgeRestriction ? Number(formData.minAge) : null,
      };

      if (editingProduct) {
        await fetch(`/api/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
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
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 text-white p-3 sm:p-6 max-w-7xl mx-auto w-full font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2.5 rounded-2xl shadow">
            <Utensils className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Artikel & Speisekarte</h1>
            <p className="text-xs text-slate-400">
              Mit Allergen-Matrix (LMIV), Jugendschutz-Altersprüfung, Happy-Hour Zeitfenstern und Meldebestand
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

      {/* Beverage Subcategory Quick Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 text-xs">
        <span className="text-slate-500 font-bold text-[11px] uppercase mr-1">Getränkefilter:</span>
        {[
          { id: 'ALL', label: 'Alle' },
          { id: 'BIER', label: 'Bier & Radler' },
          { id: 'WEIN', label: 'Wein & Schorle' },
          { id: 'ALKOHOLFREI', label: 'Alkoholfrei / Soft' },
          { id: 'HEISS', label: 'Kaffee & Tee' },
          { id: 'BAR', label: 'Bar & Spirituosen' },
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
                >
                  {p.isSoldOut ? <Ban className="w-3 h-3" /> : <CheckCircle className="w-3 h-3 text-emerald-400" />}
                  <span>{p.isSoldOut ? 'Gesperrt' : 'Aktiv'}</span>
                </button>
              </div>

              <h3 className={`font-extrabold text-base mb-1 ${p.isSoldOut ? 'line-through text-slate-400' : 'text-white'}`}>
                {p.name}
              </h3>

              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-xl font-black text-white">{formatCurrency(p.price)}</span>
                {p.deposit > 0 && (
                  <span className="text-xs text-slate-400 font-semibold">
                    +{formatCurrency(p.deposit)} Pfand
                  </span>
                )}
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-1 mb-3">
                {p.happyHourPrice && (
                  <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-1.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> {p.happyHourPrice.toFixed(2)}€ HH
                  </span>
                )}
                {p.hasAgeRestriction && (
                  <span className="bg-red-500/20 text-red-300 text-[10px] font-black px-1.5 py-0.5 rounded border border-red-500/30 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> Ab {p.minAge} J.
                  </span>
                )}
                {p.isTokenProduct && (
                  <span className="bg-purple-500/20 text-purple-300 text-[10px] font-black px-1.5 py-0.5 rounded border border-purple-500/30 flex items-center gap-1">
                    <Ticket className="w-3 h-3" /> Wertmarke
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
                  <span
                    className={`font-mono font-bold ${
                      p.stockQuantity <= (p.minStockAlert || 10) ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {p.stockQuantity} Stk (Meldebestand: {p.minStockAlert || 10})
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-1 pt-3 border-t border-slate-800">
              <button
                onClick={() => openEditModal(p)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                title="Bearbeiten"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteProduct(p.id, p.name)}
                className="p-2 text-slate-400 hover:text-rose-400 rounded-xl hover:bg-slate-800 transition"
                title="Löschen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Bearbeiten / Neu */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
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

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Kurzname für Thermobondruck (optional)
                </label>
                <input
                  type="text"
                  placeholder="z. B. Bratw. Senf"
                  value={formData.alternativeTicketName}
                  onChange={(e) => setFormData({ ...formData, alternativeTicketName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500"
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

              {/* Jugendschutz & Altersprüfung */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasAgeRestriction}
                    onChange={(e) => setFormData({ ...formData, hasAgeRestriction: e.target.checked })}
                    className="rounded text-red-600 focus:ring-0"
                  />
                  <span className="flex items-center gap-1.5 text-red-300">
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                    Jugendschutz-Altersprüfung aktivieren (Spec V2 §6.1)
                  </span>
                </label>

                {formData.hasAgeRestriction && (
                  <div className="pt-2">
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      Mindestalter (Jahre):
                    </label>
                    <select
                      value={formData.minAge || 16}
                      onChange={(e) => setFormData({ ...formData, minAge: parseInt(e.target.value, 10) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                    >
                      <option value={16}>16 Jahre (Bier, Wein, Sekt)</option>
                      <option value={18}>18 Jahre (Spirituosen, Cocktails, Tabak)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Happy Hour Preisgestaltung */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-3">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> Zeitgesteuerte Aktionspreise / Happy Hour (Spec V2 §6.5)
                </span>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">Aktionspreis (€)</label>
                    <input
                      type="number"
                      step="0.10"
                      placeholder="z. B. 3.50"
                      value={formData.happyHourPrice}
                      onChange={(e) => setFormData({ ...formData, happyHourPrice: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">Startzeit</label>
                    <input
                      type="time"
                      value={formData.happyHourStart}
                      onChange={(e) => setFormData({ ...formData, happyHourStart: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">Endzeit</label>
                    <input
                      type="time"
                      value={formData.happyHourEnd}
                      onChange={(e) => setFormData({ ...formData, happyHourEnd: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Allergene (LMIV 14 EU Allergene) */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-blue-400" />
                  Enthaltene Allergene (LMIV - Spec V2 §6.4)
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs max-h-36 overflow-y-auto p-1">
                  {EU_ALLERGENS.map((a) => {
                    const isChecked = formData.allergens.includes(a.code);
                    return (
                      <label key={a.code} className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-white">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setFormData((prev) => ({
                              ...prev,
                              allergens: isChecked
                                ? prev.allergens.filter((c) => c !== a.code)
                                : [...prev.allergens, a.code],
                            }));
                          }}
                          className="rounded text-blue-600 focus:ring-0"
                        />
                        <span className="truncate">{a.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Bestandsführung & Meldebestand */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-blue-400" />
                    <span>Bestand & Meldebestand überwachen (Spec V2 §6.3)</span>
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
                        Aktueller Bestand (Stk.)
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
                      <label className="text-[11px] font-bold text-amber-400 block mb-1">
                        Meldebestand für Warnung
                      </label>
                      <input
                        type="number"
                        value={formData.minStockAlert || 10}
                        onChange={(e) =>
                          setFormData({ ...formData, minStockAlert: parseInt(e.target.value, 10) || 0 })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Wertmarken / Gutschein Checkbox */}
              <div className="flex items-center gap-2 p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <input
                  type="checkbox"
                  id="isTokenProduct"
                  checked={formData.isTokenProduct}
                  onChange={(e) => setFormData({ ...formData, isTokenProduct: e.target.checked })}
                  className="w-4 h-4 rounded text-purple-600"
                />
                <label htmlFor="isTokenProduct" className="text-xs text-purple-300 font-bold cursor-pointer">
                  Dieser Artikel ist eine Fest-Wertmarke / Verzehrbon (Spec V2 §6.2)
                </label>
              </div>

              {/* Ausverkauft Checkbox */}
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
