'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  Utensils,
  Beer,
  Wine,
  CupSoda,
  Coffee,
  ShoppingCart,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  Filter,
  Sparkles,
  ShieldAlert,
  Loader2,
  Trash2,
} from 'lucide-react';
import { EU_ALLERGENS, filterProductsByExcludedAllergens } from '@/lib/compliance';
import { useToast } from '@/components/ui/toast';

interface Variant {
  id: string;
  name: string;
  priceDelta: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  deposit: number;
  taxRate: number;
  buttonColor?: string;
  subCategory?: string;
  categoryId: string;
  isSoldOut: boolean;
  allergens?: string;
  additives?: string;
  happyHourPrice?: number | null;
  happyHourStart?: string | null;
  happyHourEnd?: string | null;
  happyHourDays?: string | null;
  hasAgeRestriction?: boolean;
  minAge?: number | null;
  variants?: Variant[];
}

interface Category {
  id: string;
  name: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  selectedVariant?: Variant;
  note?: string;
}

export default function GuestTableOrderPage() {
  const { error } = useToast();
  const params = useParams();
  const searchParams = useSearchParams();
  const tableNumber = params.tableNumber as string;
  const qrToken = searchParams.get('token') || '';

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [guestNote, setGuestNote] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{ orderNumber: number; itemCount: number } | null>(null);
  const [selectedProductInfo, setSelectedProductInfo] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [catRes, prodRes] = await Promise.all([
          fetch('/api/categories'),
          fetch('/api/products'),
        ]);
        if (catRes.ok && prodRes.ok) {
          const catData = await catRes.json();
          const prodData = await prodRes.json();
          setCategories(catData);
          setProducts(prodData);
        }
      } catch (err) {
        console.error('Fehler beim Laden:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredProducts = filterProductsByExcludedAllergens(
    selectedCategory === 'ALL'
      ? products
      : products.filter((p) => p.categoryId === selectedCategory),
    selectedAllergens
  );

  const addToCart = (product: Product, variant?: Variant) => {
    setCart((prev) => {
      const existing = prev.find(
        (item) => item.product.id === product.id && item.selectedVariant?.id === variant?.id
      );
      if (existing) {
        return prev.map((item) =>
          item === existing ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1, selectedVariant: variant }];
    });
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const item = prev[index];
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }
      return prev.map((it, i) => (i === index ? { ...it, quantity: newQty } : it));
    });
  };

  const totalGross = cart.reduce((sum, item) => {
    const basePrice = item.product.price + (item.selectedVariant?.priceDelta || 0);
    return sum + (basePrice + (item.product.deposit || 0)) * item.quantity;
  }, 0);

  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);

  const submitOrder = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/guest/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber,
          qrToken,
          guestNote,
          items: cart.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
            variantName: item.selectedVariant?.name || null,
            customizationText: item.note || null,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setOrderSuccess({ orderNumber: data.orderNumber, itemCount: data.itemCount });
        setCart([]);
        setIsCartOpen(false);
      } else {
        const errData = await res.json();
        error(errData.error || 'Fehler bei der Bestellung');
      }
    } catch (err) {
      error('Verbindungsfehler beim Absenden der Bestellung');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="font-semibold text-lg">Speisekarte wird geladen...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24 font-sans antialiased">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-blue-600/20 text-blue-400 font-bold px-2.5 py-0.5 rounded-full text-xs border border-blue-500/30">
              Tisch {tableNumber}
            </span>
            <h1 className="font-extrabold text-lg tracking-tight text-white">OrderBon Self-Order</h1>
          </div>
          <p className="text-xs text-slate-400">Direkt vom Smartphone bestellen</p>
        </div>

        <button
          onClick={() => setIsCartOpen(true)}
          className="relative p-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-white shadow-lg transition-all active:scale-95"
        >
          <ShoppingCart className="w-5 h-5" />
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 bg-emerald-500 text-slate-950 text-xs font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-pulse">
              {totalItems}
            </span>
          )}
        </button>
      </header>

      {/* Erfolgs-Modal */}
      {orderSuccess && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/40">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-white mb-1">Bestellung erfasst!</h2>
            <p className="text-slate-400 text-sm mb-4">
              Ihre Bestellung wurde direkt an Küche und Schanktheke übermittelt.
            </p>
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl mb-6">
              <span className="text-xs text-slate-400 uppercase tracking-widest font-bold">Bestellnummer</span>
              <div className="text-4xl font-mono font-black text-emerald-400 mt-1">
                #{orderSuccess.orderNumber}
              </div>
              <span className="text-xs text-slate-400 mt-1 block">
                {orderSuccess.itemCount} Position(en) an Tisch {tableNumber}
              </span>
            </div>
            <button
              onClick={() => setOrderSuccess(null)}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-lg active:scale-95"
            >
              Weitere Artikel bestellen
            </button>
          </div>
        </div>
      )}

      {/* Kategorien & Filter */}
      <div className="px-4 py-3 space-y-3">
        {/* Kategorien Leiste */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              selectedCategory === 'ALL'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-850'
            }`}
          >
            Alle Artikel
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-850'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Allergen Ausschluss-Filter Toggle */}
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
              <Filter className="w-3.5 h-3.5 text-blue-400" /> Allergene filtern
            </span>
            {selectedAllergens.length > 0 && (
              <button
                onClick={() => setSelectedAllergens([])}
                className="text-xs text-blue-400 hover:underline font-semibold"
              >
                Zurücksetzen ({selectedAllergens.length})
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['GLUTEN', 'MILCH', 'EIER', 'ERDNUESSE', 'SCHALENFRUECHTE', 'SOJA'].map((code) => {
              const active = selectedAllergens.includes(code);
              const label = EU_ALLERGENS.find((a) => a.code === code)?.name || code;
              return (
                <button
                  key={code}
                  onClick={() => {
                    setSelectedAllergens((prev) =>
                      active ? prev.filter((c) => c !== code) : [...prev, code]
                    );
                  }}
                  className={`text-xs px-2.5 py-1 rounded-lg font-semibold border transition-all ${
                    active
                      ? 'bg-red-500/20 text-red-300 border-red-500/40 font-bold'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {active ? `✕ Ohne ${label}` : `Ohne ${label}`}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Produkt Grid */}
      <main className="px-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredProducts.map((product) => {
          const hasHappyHour = Boolean(product.happyHourPrice);
          return (
            <div
              key={product.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all shadow-sm"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-bold text-white text-base leading-tight">{product.name}</h3>
                  <button
                    onClick={() => setSelectedProductInfo(product)}
                    className="text-slate-500 hover:text-slate-300 p-1"
                    title="Allergene & Details"
                  >
                    <AlertCircle className="w-4 h-4" />
                  </button>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5 my-2">
                  {hasHappyHour && (
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> HAPPY HOUR
                    </span>
                  )}
                  {product.hasAgeRestriction && product.minAge && (
                    <span className="bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> Ab {product.minAge} J.
                    </span>
                  )}
                  {product.deposit > 0 && (
                    <span className="bg-slate-800 text-slate-400 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                      +{product.deposit.toFixed(2)} € Pfand
                    </span>
                  )}
                </div>
              </div>

              {/* Preis & Action */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/60">
                <div className="font-mono">
                  <span className="text-lg font-extrabold text-emerald-400">
                    {product.price.toFixed(2)} €
                  </span>
                  {product.happyHourPrice && (
                    <span className="text-xs text-slate-500 line-through ml-2">
                      {(product.price * 1.2).toFixed(2)} €
                    </span>
                  )}
                </div>

                {product.isSoldOut ? (
                  <span className="text-xs font-bold text-red-400 bg-red-950/40 border border-red-800/40 px-3 py-1.5 rounded-xl">
                    Ausverkauft
                  </span>
                ) : product.variants && product.variants.length > 0 ? (
                  <div className="flex gap-1">
                    {product.variants.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => addToCart(product, v)}
                        className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {v.name} ({(product.price + v.priceDelta).toFixed(2)} €)
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    onClick={() => addToCart(product)}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Hinzufügen
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </main>

      {/* Floating Warenkorb Button */}
      {totalItems > 0 && !isCartOpen && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white rounded-2xl shadow-2xl flex items-center justify-between font-black text-lg transition-all"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-6 h-6" />
              <span>{totalItems} Artikel</span>
            </div>
            <span className="font-mono">{totalGross.toFixed(2)} €</span>
          </button>
        </div>
      )}

      {/* Warenkorb Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end">
          <div className="bg-slate-900 border-l border-slate-800 w-full max-w-md h-full flex flex-col justify-between p-6 shadow-2xl animate-in slide-in-from-right">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-blue-400" /> Warenkorb (Tisch {tableNumber})
                </h2>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="text-slate-400 hover:text-white text-sm font-bold px-2 py-1"
                >
                  Schließen
                </button>
              </div>

              {/* Items Liste */}
              <div className="py-4 space-y-3 overflow-y-auto max-h-[60vh] no-scrollbar">
                {cart.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">Ihr Warenkorb ist leer.</p>
                ) : (
                  cart.map((item, idx) => {
                    const price = item.product.price + (item.selectedVariant?.priceDelta || 0);
                    const itemTotal = (price + (item.product.deposit || 0)) * item.quantity;
                    return (
                      <div
                        key={idx}
                        className="bg-slate-950 border border-slate-800/80 p-3 rounded-2xl flex items-center justify-between"
                      >
                        <div className="flex-1 mr-3">
                          <h4 className="font-bold text-white text-sm leading-tight">
                            {item.product.name}
                            {item.selectedVariant && (
                              <span className="text-blue-400 text-xs ml-1">({item.selectedVariant.name})</span>
                            )}
                          </h4>
                          <span className="font-mono text-xs text-slate-400">
                            {price.toFixed(2)} € {item.product.deposit > 0 && `+ ${item.product.deposit.toFixed(2)} € Pfand`}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl">
                            <button
                              onClick={() => updateQuantity(idx, -1)}
                              className="p-1.5 text-slate-400 hover:text-white"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="font-mono font-bold text-sm px-2 text-white">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(idx, 1)}
                              className="p-1.5 text-slate-400 hover:text-white"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <span className="font-mono font-bold text-sm text-emerald-400 w-16 text-right">
                            {itemTotal.toFixed(2)} €
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Anmerkung */}
              {cart.length > 0 && (
                <div className="mt-2">
                  <label className="text-xs text-slate-400 font-bold block mb-1">
                    Anmerkung an die Küche/Bar (optional):
                  </label>
                  <input
                    type="text"
                    value={guestNote}
                    onChange={(e) => setGuestNote(e.target.value)}
                    placeholder="z. B. Bitte ohne Zwiebeln..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}
            </div>

            {/* Footer & Checkout Button */}
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <div className="flex justify-between items-center text-slate-400 text-sm">
                <span>Gesamtbetrag (inkl. MwSt. & Pfand):</span>
                <span className="text-2xl font-mono font-black text-emerald-400">
                  {totalGross.toFixed(2)} €
                </span>
              </div>

              <button
                onClick={submitOrder}
                disabled={cart.length === 0 || isSubmitting}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-lg rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Bestellung wird gesendet...</span>
                  </>
                ) : (
                  <span>Jetzt verbindlich bestellen</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Allergen & Detail Modal */}
      {selectedProductInfo && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">{selectedProductInfo.name}</h3>
            
            <div className="space-y-3 text-xs text-slate-300">
              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Enthaltene Allergene:
                </span>
                {(() => {
                  try {
                    const list: string[] = selectedProductInfo.allergens ? JSON.parse(selectedProductInfo.allergens) : [];
                    if (list.length === 0) return <span className="text-slate-500">Keine deklarierungspflichtigen Allergene</span>;
                    return (
                      <div className="flex flex-wrap gap-1">
                        {list.map((code) => (
                          <span key={code} className="bg-slate-800 px-2 py-0.5 rounded text-amber-300 font-semibold">
                            {EU_ALLERGENS.find((a) => a.code === code)?.name || code}
                          </span>
                        ))}
                      </div>
                    );
                  } catch {
                    return <span className="text-slate-500">Keine Angaben</span>;
                  }
                })()}
              </div>

              {selectedProductInfo.hasAgeRestriction && selectedProductInfo.minAge && (
                <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded-xl text-red-300 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-400" />
                  <span>Altersbeschränkung: Ab {selectedProductInfo.minAge} Jahren</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedProductInfo(null)}
              className="mt-6 w-full py-2.5 bg-slate-800 hover:bg-slate-700 font-bold text-white rounded-xl text-sm"
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
