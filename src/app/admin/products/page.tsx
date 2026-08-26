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
  Printer,
  FileText,
  Tag,
  Settings2,
} from 'lucide-react';
import { EU_ALLERGENS, GASTRONOMY_ADDITIVES } from '@/lib/compliance';
import { useToast } from '@/components/ui/toast';
import type { ProductDTO, ProductCategoryDTO, PrintGroupDTO } from '@/types/domain';

export default function AdminProductsPage() {
  const { success, error, warning } = useToast();
  const [categories, setCategories] = useState<ProductCategoryDTO[]>([]);
  const [printGroups, setPrintGroups] = useState<PrintGroupDTO[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);

  // Category management state
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#3b82f6');
  const [editingCat, setEditingCat] = useState<ProductCategoryDTO | null>(null);

  // Printable Menu state
  const [showMenuPrintModal, setShowMenuPrintModal] = useState(false);

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
      const [catRes, pgRes, pRes, cfgRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/print-groups'),
        fetch('/api/products'),
        fetch('/api/config'),
      ]);
      const cats = await catRes.json();
      const pgs = await pgRes.json();
      const prods = await pRes.json();
      const cfg = await cfgRes.json();

      if (Array.isArray(cats)) {
        setCategories(cats);
        if (cats.length > 0 && !selectedCatId) setSelectedCatId(cats[0].id);
      }
      if (Array.isArray(pgs)) setPrintGroups(pgs);
      if (Array.isArray(prods)) setProducts(prods);
      if (cfg) setConfig(cfg);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      if (editingCat) {
        await fetch('/api/categories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingCat.id, name: newCatName.trim(), color: newCatColor }),
        });
      } else {
        await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newCatName.trim(), color: newCatColor, sortIndex: categories.length }),
        });
      }
      setNewCatName('');
      setEditingCat(null);
      fetchData();
      success('Warengruppe gespeichert');
    } catch {
      error('Fehler beim Speichern der Warengruppe');
    }
  };

  const handleDeleteCategory = async (catId: string, catName: string) => {
    try {
      await fetch(`/api/categories?id=${catId}`, { method: 'DELETE' });
      fetchData();
      success(`Warengruppe "${catName}" gelöscht`);
    } catch {
      error('Fehler beim Löschen der Warengruppe');
    }
  };

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
      success(nextVal ? `Artikel "${prod.name}" gesperrt` : `Artikel "${prod.name}" freigegeben`);
    } catch {
      error('Fehler beim Aktualisieren des Sperrstatus');
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    try {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
      fetchData();
      success(`Artikel "${name}" gelöscht`);
    } catch {
      error('Fehler beim Löschen des Artikels');
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
      success('Artikel erfolgreich gespeichert!');
    } catch {
      error('Fehler beim Speichern des Artikels');
    }
  };

  const filteredProducts = products.filter((p) => {
    if (selectedCatId && p.categoryId !== selectedCatId) return false;
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
            <h1 className="text-2xl font-black">Artikel- & Menüverwaltung</h1>
            <p className="text-xs text-slate-400">
              Speisen, Getränke, Preise, Meldebestände & LMIV-Allergene verwalten
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* CSV Export & Import */}
          <a
            href="/api/products/csv"
            download
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-2xl text-xs font-bold transition shadow"
            title="Speisekarte als CSV exportieren"
          >
            <Package className="w-4 h-4 text-sky-400" />
            <span>CSV Export</span>
          </a>

          <label className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-2xl text-xs font-bold transition shadow cursor-pointer">
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>CSV Import</span>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                try {
                  const res = await fetch('/api/products/csv', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ csvText: text }),
                  });
                  const d = await res.json();
                  if (d.success) {
                    success(d.message || 'Import erfolgreich!');
                    fetchData();
                  } else {
                    error(d.error || 'Fehler beim CSV-Import');
                  }
                } catch {
                  error('Netzwerkfehler beim CSV-Import');
                }
              }}
            />
          </label>

          {/* Printable Menu PDF Button */}
          <button
            onClick={() => setShowMenuPrintModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-2xl text-xs font-bold transition shadow"
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>Speisekarte drucken</span>
          </button>

          {/* Manage Categories Button */}
          <button
            onClick={() => {
              setEditingCat(null);
              setNewCatName('');
              setShowCatModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-2xl text-xs font-bold transition shadow"
          >
            <Tag className="w-4 h-4 text-purple-400" />
            <span>Warengruppen</span>
          </button>

          {/* New Product Button */}
          <button
            onClick={openNewModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold transition shadow-lg shadow-blue-950/50"
          >
            <Plus className="w-4 h-4" />
            <span>Artikel anlegen</span>
          </button>
        </div>
      </div>

      {/* Search and Category Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
        {/* Search Input Bar */}
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Artikel suchen nach Name oder Bon-Kurzname..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition shadow-inner"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Navigation Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedCatId('')}
            className={`px-3 py-2 rounded-2xl text-xs font-black uppercase tracking-wider transition whitespace-nowrap border ${
              selectedCatId === ''
                ? 'bg-blue-600 text-white border-blue-400 shadow-md'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
            }`}
          >
            Alle Gruppen
          </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              setSelectedCatId(cat.id);
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

        <button
          onClick={() => {
            setEditingCat(null);
            setNewCatName('');
            setShowCatModal(true);
          }}
          className="px-3 py-2 rounded-2xl text-xs font-bold text-slate-400 hover:text-white bg-slate-950 border border-dashed border-slate-800 hover:border-slate-600 transition flex items-center gap-1 shrink-0"
          title="Neue Warengruppe anlegen"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Gruppe</span>
        </button>
        </div>
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

              {/* Zuordnung: Warengruppe und Druckgruppe
                  Beide Felder fehlten bisher im Formular. Ein Artikel liess sich
                  dadurch nachtraeglich weder umhaengen noch einem anderen Drucker
                  zuordnen – neue Getraenke landeten immer auf dem Kuechendrucker. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    Warengruppe
                  </label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {categories.length === 0 && <option value="">Keine Warengruppe vorhanden</option>}
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    Druckgruppe (Bon-Ziel)
                  </label>
                  <select
                    value={formData.printGroupId || ''}
                    onChange={(e) => setFormData({ ...formData, printGroupId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="">Kein Bondruck</option>
                    {printGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                        {g.printer?.name ? ` – ${g.printer.name}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 font-semibold mt-1">
                    Bestimmt, an welcher Station der Bon für diesen Artikel gedruckt wird.
                  </p>
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

              {/* Sorten & Varianten */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-400" />
                    <span>Sorten & Varianten (z. B. Helles Weizen, Colaweizen, Russ)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        variants: [...formData.variants, { name: '', priceDelta: 0.0, isSoldOut: false }],
                      })
                    }
                    className="px-2.5 py-1 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition border border-blue-500/30 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Variante</span>
                  </button>
                </div>

                {formData.variants.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    {formData.variants.map((v, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Variantenname (z. B. Colaweizen)"
                          value={v.name}
                          onChange={(e) => {
                            const updated = [...formData.variants];
                            updated[idx].name = e.target.value;
                            setFormData({ ...formData, variants: updated });
                          }}
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-slate-400 font-mono">+/- €</span>
                          <input
                            type="number"
                            step="0.10"
                            value={v.priceDelta}
                            onChange={(e) => {
                              const updated = [...formData.variants];
                              updated[idx].priceDelta = parseFloat(e.target.value) || 0.0;
                              setFormData({ ...formData, variants: updated });
                            }}
                            className="w-20 bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-white font-mono"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = formData.variants.filter((_, i) => i !== idx);
                            setFormData({ ...formData, variants: updated });
                          }}
                          className="p-1.5 text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Zusatz-Optionen & Extras */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-emerald-400" />
                    <span>Zusätze & Extras (z. B. Ketchup, Mayonnaise, Extra Käse)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        options: [...formData.options, { name: '', priceDelta: 0.5 }],
                      })
                    }
                    className="px-2.5 py-1 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-bold transition border border-emerald-500/30 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Zusatz</span>
                  </button>
                </div>

                {formData.options.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    {formData.options.map((o, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Zusatzname (z. B. Mayonnaise)"
                          value={o.name}
                          onChange={(e) => {
                            const updated = [...formData.options];
                            updated[idx].name = e.target.value;
                            setFormData({ ...formData, options: updated });
                          }}
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-slate-400 font-mono">+ €</span>
                          <input
                            type="number"
                            step="0.10"
                            value={o.priceDelta}
                            onChange={(e) => {
                              const updated = [...formData.options];
                              updated[idx].priceDelta = parseFloat(e.target.value) || 0.0;
                              setFormData({ ...formData, options: updated });
                            }}
                            className="w-20 bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-white font-mono"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = formData.options.filter((_, i) => i !== idx);
                            setFormData({ ...formData, options: updated });
                          }}
                          className="p-1.5 text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
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

      {/* Warengruppen-Verwaltung Modal */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-lg text-white">Warengruppen & Kategorien</h3>
              </div>
              <button
                onClick={() => setShowCatModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Neue Gruppe anlegen / Bearbeiten Formular */}
            <form onSubmit={handleSaveCategory} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
              <div className="text-xs font-bold text-purple-300">
                {editingCat ? `Warengruppe "${editingCat.name}" bearbeiten` : '+ Neue Warengruppe anlegen'}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  placeholder="z. B. Getränke, Alkoholfrei, Speisen, Bar..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
                <input
                  type="color"
                  value={newCatColor}
                  onChange={(e) => setNewCatColor(e.target.value)}
                  className="w-9 h-9 rounded-xl border border-slate-700 bg-slate-900 cursor-pointer p-0.5"
                  title="Farbe für Schaltflächen"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow"
                >
                  {editingCat ? 'Aktualisieren' : 'Anlegen'}
                </button>
                {editingCat && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCat(null);
                      setNewCatName('');
                    }}
                    className="px-2.5 py-2 bg-slate-800 text-slate-400 rounded-xl text-xs font-bold"
                  >
                    Neu
                  </button>
                )}
              </div>
            </form>

            {/* Liste bestehender Warengruppen */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                Bestehende Warengruppen ({categories.length})
              </div>
              {categories.map((cat) => {
                const count = products.filter((p) => p.categoryId === cat.id).length;
                return (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color || '#3b82f6' }}
                      />
                      <span className="font-bold text-sm text-white">{cat.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">({count} Artikel)</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingCat(cat);
                          setNewCatName(cat.name);
                          setNewCatColor(cat.color || '#3b82f6');
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-950/40 transition"
                        title="Warengruppe umbenennen / Farbe ändern"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition"
                        title="Warengruppe löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowCatModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Druckbare Speise- & Getränkekarte Modal (PDF) */}
      {showMenuPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[95vh] border border-slate-200 print:max-w-none print:shadow-none print:border-none print:rounded-none print:max-h-none print:p-0">
            {/* Modal Top Actions (Hidden in Print) */}
            <div className="p-4 bg-slate-100 border-b border-slate-200 rounded-t-3xl flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2 text-slate-800">
                <FileText className="w-5 h-5 text-emerald-600" />
                <span className="font-bold text-base">Speise- & Getränkekarte Vorschau</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow flex items-center gap-1.5 transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>Jetzt Drucken / PDF speichern</span>
                </button>
                <button
                  onClick={() => setShowMenuPrintModal(false)}
                  className="p-2 text-slate-600 hover:text-slate-900 rounded-xl bg-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Menu Paper Content */}
            <div className="p-6 sm:p-10 overflow-y-auto font-serif print:p-6 print:overflow-visible text-slate-900 bg-white">
              {/* Event Header */}
              <div className="text-center pb-6 mb-6 border-b-2 border-slate-900">
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight uppercase font-sans text-slate-950">
                  {config?.name || config?.receiptHeader || 'Speisen- & Getränkekarte'}
                </h1>
                <p className="text-sm font-sans text-slate-600 uppercase tracking-widest mt-1">
                  Offizielle Speisen- &amp; Getränkekarte
                </p>
              </div>

              {/* Categorized Products */}
              <div className="space-y-8">
                {categories.map((cat) => {
                  const catProducts = products.filter(
                    (p) => p.categoryId === cat.id && !p.isSoldOut
                  );
                  if (catProducts.length === 0) return null;

                  return (
                    <div key={cat.id} className="break-inside-avoid">
                      <h2 className="text-xl font-bold uppercase tracking-wider font-sans text-slate-900 pb-1 mb-4 border-b border-slate-300 flex items-center justify-between">
                        <span>{cat.name}</span>
                      </h2>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 font-sans">
                        {catProducts.map((p) => {
                          const allergensList = Array.isArray(p.allergens)
                            ? p.allergens.join(', ')
                            : typeof p.allergens === 'string'
                            ? JSON.parse(p.allergens || '[]').join(', ')
                            : '';

                          return (
                            <div
                              key={p.id}
                              className="flex items-start justify-between gap-3 pb-1 border-b border-dotted border-slate-200 text-sm"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-slate-900">
                                  {p.name}
                                  {allergensList && (
                                    <span className="text-[10px] font-mono text-slate-500 font-normal ml-1.5">
                                      ({allergensList})
                                    </span>
                                  )}
                                </div>
                                {p.variants && p.variants.length > 0 && (
                                  <div className="text-xs text-slate-500">
                                    {p.variants.map((v: any) => v.name).join(' · ')}
                                  </div>
                                )}
                              </div>

                              <div className="text-right font-mono font-bold text-slate-950 shrink-0">
                                {formatCurrency(p.price)}
                                {p.deposit > 0 && (
                                  <span className="text-[10px] block font-sans text-slate-500 font-normal">
                                    +{formatCurrency(p.deposit)} Pfand
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* LMIV Footnotes / Allergens Key */}
              <div className="mt-10 pt-6 border-t border-slate-300 font-sans text-[10px] text-slate-600 leading-relaxed break-inside-avoid">
                <div className="font-bold text-slate-800 uppercase mb-1">
                  Hinweise zu Allergenen & Zusatzstoffen (LMIV):
                </div>
                <p>
                  Alle Preise inkl. gesetzlicher Mehrwertsteuer. Bei Fragen zu Allergenen und Inhaltsstoffen wenden Sie sich bitte an unser Servicepersonal.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
