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
} from 'lucide-react';

export default function AdminProductsPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [printGroups, setPrintGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
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
    trackStock: false,
    stockQuantity: 100,
    alertThreshold: 10,
    variants: [] as { name: string; priceDelta: number }[],
    options: [] as { name: string; priceDelta: number }[],
  });

  const fetchData = async () => {
    try {
      const [catRes, pgRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/print-groups'),
      ]);
      const cats = await catRes.json();
      const pgs = await pgRes.json();

      if (Array.isArray(cats)) {
        setCategories(cats);
        if (cats.length > 0 && !selectedCatId) setSelectedCatId(cats[0].id);
      }
      if (Array.isArray(pgs)) setPrintGroups(pgs);
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
      trackStock: false,
      stockQuantity: 100,
      alertThreshold: 10,
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
      trackStock: !!prod.stockItem,
      stockQuantity: prod.stockItem?.currentQuantity || 100,
      alertThreshold: prod.stockItem?.alertThreshold || 10,
      variants: prod.variants?.map((v: any) => ({ name: v.name, priceDelta: v.priceDelta })) || [],
      options: prod.options?.map((o: any) => ({ name: o.name, priceDelta: o.priceDelta })) || [],
    });
    setShowModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        // Update
        await fetch(`/api/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      } else {
        // Create
        await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Fehler beim Speichern');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Möchtest du dieses Produkt wirklich archivieren?')) return;
    try {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const currentCategory = categories.find((c) => c.id === selectedCatId);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 text-white p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2.5 rounded-2xl">
            <Utensils className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Preisliste & Artikelverwaltung</h1>
            <p className="text-xs text-slate-400">
              Pflege Artikel, Preise, Pfandbeträge, Varianten, Optionen und Bontexte
            </p>
          </div>
        </div>

        <button
          onClick={openNewModal}
          className="pos-touch-btn flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-900/30 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Artikel anlegen</span>
        </button>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCatId(cat.id)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
              selectedCatId === cat.id
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            {cat.name} ({cat.products?.length || 0})
          </button>
        ))}
      </div>

      {/* Products Table / List */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Lade Preisliste...</span>
        </div>
      ) : !currentCategory || currentCategory.products?.length === 0 ? (
        <div className="text-center py-12 text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800">
          Keine Artikel in dieser Warengruppe angelegt.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {currentCategory.products.map((prod: any) => (
            <div
              key={prod.id}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between shadow-lg relative"
              style={{ borderLeftColor: prod.buttonColor || '#3b82f6', borderLeftWidth: '4px' }}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="font-bold text-base text-white">{prod.name}</h4>
                  <span className="text-lg font-black font-mono text-emerald-400">
                    {formatCurrency(prod.price)}
                  </span>
                </div>

                {prod.alternativeTicketName && (
                  <div className="text-xs text-slate-400 mb-2">
                    Bontext: <span className="text-blue-300 font-semibold">{prod.alternativeTicketName}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-1.5 text-[11px] mb-3">
                  {prod.deposit > 0 && (
                    <span className="bg-blue-950 text-blue-300 px-2 py-0.5 rounded border border-blue-800 font-semibold">
                      +{formatCurrency(prod.deposit)} Pfand
                    </span>
                  )}
                  <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                    MwSt: {prod.taxRate}%
                  </span>
                  {prod.printGroup && (
                    <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                      Drucker: {prod.printGroup.name}
                    </span>
                  )}
                </div>

                {/* Variants / Options count */}
                {(prod.variants?.length > 0 || prod.options?.length > 0) && (
                  <div className="text-xs text-slate-400 bg-slate-950 p-2 rounded-xl mb-3 border border-slate-800/80">
                    {prod.variants?.length > 0 && (
                      <div>{prod.variants.length} Varianten ({prod.variants.map((v: any) => v.name).join(', ')})</div>
                    )}
                    {prod.options?.length > 0 && (
                      <div>{prod.options.length} Optionen ({prod.options.map((o: any) => o.name).join(', ')})</div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => openEditModal(prod)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Bearbeiten</span>
                </button>
                <button
                  onClick={() => handleDeleteProduct(prod.id)}
                  className="p-1.5 bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white rounded-xl text-xs transition"
                  title="Archivieren"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product Edit / Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <form
            onSubmit={handleSaveProduct}
            className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 my-8"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-xl font-bold text-white">
                {editingProduct ? 'Artikel bearbeiten' : 'Neuen Artikel anlegen'}
              </h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Artikelname *</label>
                <input
                  type="text"
                  required
                  placeholder="z. B. Schnitzel mit Pommes"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Alternativer Bontext (Kürzel)</label>
                <input
                  type="text"
                  placeholder="z. B. SchniPo"
                  value={formData.alternativeTicketName}
                  onChange={(e) => setFormData({ ...formData, alternativeTicketName: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Preis (€) *</label>
                <input
                  type="number"
                  step="0.05"
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Pfand (€)</label>
                <input
                  type="number"
                  step="0.50"
                  value={formData.deposit}
                  onChange={(e) => setFormData({ ...formData, deposit: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Warengruppe *</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Druckgruppe / Ausgabestelle</label>
                <select
                  value={formData.printGroupId}
                  onChange={(e) => setFormData({ ...formData, printGroupId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Keine (Kein Bon)</option>
                  {printGroups.map((pg) => (
                    <option key={pg.id} value={pg.id}>
                      {pg.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">MwSt.-Satz</label>
                <select
                  value={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                >
                  <option value={19}>19 % (Regelsteuersatz)</option>
                  <option value={7}>7 % (Ermäßigt / Speisen)</option>
                  <option value={0}>0 % (Steuerfrei)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Kachelfarbe</label>
                <input
                  type="color"
                  value={formData.buttonColor}
                  onChange={(e) => setFormData({ ...formData, buttonColor: e.target.value })}
                  className="w-full h-9 bg-slate-800 border border-slate-700 rounded-xl px-1 py-1 cursor-pointer"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-900/30"
              >
                Speichern
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
