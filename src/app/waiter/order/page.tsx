'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { triggerHapticFeedback } from '@/lib/socket-client';
import { formatCurrency } from '@/lib/utils';
import {
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  Send,
  MessageSquarePlus,
  Check,
  X,
  Layers,
  Sparkles,
  Search,
} from 'lucide-react';

interface CartItem {
  id: string; // unique cart line id
  productId: string;
  name: string;
  price: number;
  deposit: number;
  quantity: number;
  variantName?: string;
  selectedOptions: string[];
  customizationText?: string;
}

export default function WaiterOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tableId = searchParams.get('tableId');

  const [table, setTable] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wordGroups, setWordGroups] = useState<any[]>([]);
  const [customizingItem, setCustomizingItem] = useState<CartItem | null>(null);
  const [selectedPrefix, setSelectedPrefix] = useState<string>('');
  const [selectedIngredient, setSelectedIngredient] = useState<string>('');
  const [customText, setCustomText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Load categories with products
    fetch('/api/categories')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setCategories(data);
          setSelectedCatId(data[0].id);
        }
      })
      .catch(() => {});

    // Load customization word groups
    fetch('/api/word-groups')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setWordGroups(data);
      })
      .catch(() => {});

    // Load table details
    if (tableId) {
      fetch('/api/tables')
        .then((r) => r.json())
        .then((tables) => {
          const found = tables.find((t: any) => t.id === tableId);
          if (found) setTable(found);
        })
        .catch(() => {});
    }
  }, [tableId]);

  // Add Product to Cart
  const addToCart = (product: any, variant?: any) => {
    triggerHapticFeedback();
    const unitPrice = product.price + (variant ? variant.priceDelta : 0);
    const lineId = `${product.id}_${variant ? variant.name : 'default'}`;

    setCart((prev) => {
      const existing = prev.find((i) => i.id === lineId && !i.customizationText);
      if (existing) {
        return prev.map((i) =>
          i === existing ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          id: lineId,
          productId: product.id,
          name: product.name,
          price: unitPrice,
          deposit: product.deposit || 0,
          quantity: 1,
          variantName: variant ? variant.name : undefined,
          selectedOptions: [],
        },
      ];
    });
  };

  const updateQuantity = (lineId: string, delta: number) => {
    triggerHapticFeedback();
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.id === lineId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const openCustomizer = (item: CartItem) => {
    setCustomizingItem(item);
    setCustomText(item.customizationText || '');
    setSelectedPrefix('');
    setSelectedIngredient('');
  };

  const saveCustomization = () => {
    if (!customizingItem) return;
    let finalNote = customText.trim();
    if (selectedPrefix && selectedIngredient) {
      const combined = `${selectedPrefix} ${selectedIngredient}`;
      finalNote = finalNote ? `${finalNote}, ${combined}` : combined;
    } else if (selectedIngredient) {
      finalNote = finalNote ? `${finalNote}, ${selectedIngredient}` : selectedIngredient;
    }

    setCart((prev) =>
      prev.map((i) =>
        i.id === customizingItem.id ? { ...i, customizationText: finalNote } : i
      )
    );
    setCustomizingItem(null);
  };

  // Calculate cart total gross
  const totalAmount = cart.reduce(
    (sum, i) => sum + (i.price + i.deposit) * i.quantity,
    0
  );
  const totalItemsCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  // Submit Order
  const submitOrder = async () => {
    if (cart.length === 0 || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const waiterName = localStorage.getItem('pos_waiter_name') || 'Bedienung 1';
      const deviceId = localStorage.getItem('pos_device_id');

      const payload = {
        tableId: tableId || null,
        waiterName,
        deviceId,
        orderType: tableId ? 'TABLE' : 'COUNTER_DIRECT',
        items: cart.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          variantName: i.variantName,
          selectedOptions: i.selectedOptions,
          customizationText: i.customizationText,
        })),
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        triggerHapticFeedback();
        router.push('/waiter');
      } else {
        const err = await res.json();
        alert(err.error || 'Fehler beim Absenden der Bestellung');
      }
    } catch (e) {
      console.error(e);
      alert('Netzwerkfehler beim Senden.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentCategory = categories.find((c) => c.id === selectedCatId);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-white">
      {/* Header */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <button
          onClick={() => router.push('/waiter')}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white px-2 py-1 rounded-lg bg-slate-800 text-sm font-semibold transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Tische</span>
        </button>

        <div className="text-center font-bold text-base sm:text-lg">
          {table ? table.label : 'Schnellbestellung'}
        </div>

        <div className="text-xs text-blue-400 font-semibold bg-blue-950 px-2.5 py-1 rounded-full border border-blue-800">
          {totalItemsCount} Pos.
        </div>
      </div>

      {/* Category Tabs */}
      <div className="bg-slate-900/80 px-2 py-1.5 border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCatId(cat.id)}
            className={`pos-touch-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
              selectedCatId === cat.id
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40 scale-105'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Main Split: Left Products Grid, Right/Bottom Cart */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {currentCategory?.products?.length === 0 ? (
            <div className="text-center py-12 text-slate-400">Keine Produkte in dieser Kategorie.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
              {currentCategory?.products?.map((prod: any) => {
                const hasVariants = prod.variants && prod.variants.length > 0;
                return (
                  <div
                    key={prod.id}
                    className="flex flex-col justify-between p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 shadow-md relative"
                    style={{ borderLeftColor: prod.buttonColor || '#3b82f6', borderLeftWidth: '4px' }}
                  >
                    <div>
                      <h4 className="font-bold text-sm sm:text-base leading-snug mb-1 text-white">
                        {prod.name}
                      </h4>
                      {prod.deposit > 0 && (
                        <span className="text-[10px] bg-blue-950 text-blue-300 px-1.5 py-0.5 rounded border border-blue-800">
                          +{formatCurrency(prod.deposit)} Pfand
                        </span>
                      )}
                    </div>

                    <div className="mt-3">
                      {hasVariants ? (
                        <div className="flex flex-col gap-1.5">
                          {prod.variants.map((v: any) => (
                            <button
                              key={v.id}
                              onClick={() => addToCart(prod, v)}
                              className="pos-touch-btn flex items-center justify-between w-full bg-slate-800 hover:bg-blue-600 px-2 py-1.5 rounded-lg text-xs font-semibold transition"
                            >
                              <span>{v.name}</span>
                              <span className="font-mono text-emerald-400">
                                {formatCurrency(prod.price + v.priceDelta)}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(prod)}
                          className="pos-touch-btn flex items-center justify-between w-full bg-slate-800 hover:bg-blue-600 text-white px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition"
                        >
                          <span className="font-mono text-emerald-400">{formatCurrency(prod.price)}</span>
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart Tray (Sidebar on Desktop, Bottom Sheet on Mobile) */}
        <div className="w-full lg:w-96 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col max-h-[45vh] lg:max-h-full">
          {/* Cart Header */}
          <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950">
            <span className="font-bold text-sm text-slate-300">Aktuelle Auswahl ({totalItemsCount})</span>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Leeren</span>
              </button>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                Tippe auf Produkte, um sie zur Bestellung hinzuzufügen.
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2"
                >
                  <div className="flex-1 min-w-0" onClick={() => openCustomizer(item)}>
                    <div className="font-bold text-sm truncate text-white cursor-pointer hover:text-blue-400">
                      {item.name}
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                      {item.variantName && <span>{item.variantName} •</span>}
                      <span className="font-mono text-emerald-400">
                        {formatCurrency((item.price + item.deposit) * item.quantity)}
                      </span>
                    </div>
                    {item.customizationText && (
                      <div className="text-[11px] font-bold text-amber-400 truncate mt-0.5">
                        ! {item.customizationText}
                      </div>
                    )}
                  </div>

                  {/* Quantity Stepper & Customizer Button */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openCustomizer(item)}
                      className="p-1.5 text-slate-400 hover:text-amber-400 bg-slate-800 rounded-lg"
                      title="Sonderwunsch hinzufügen"
                    >
                      <MessageSquarePlus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-bold"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-5 text-center font-bold text-sm font-mono">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-7 h-7 flex items-center justify-center bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Footer & Submit */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-slate-400">Gesamtsumme:</div>
              <div className="text-xl sm:text-2xl font-black text-emerald-400">
                {formatCurrency(totalAmount)}
              </div>
            </div>

            <button
              disabled={cart.length === 0 || isSubmitting}
              onClick={submitOrder}
              className={`pos-touch-btn flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-base shadow-lg transition ${
                cart.length > 0 && !isSubmitting
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Send className="w-5 h-5" />
              <span>{isSubmitting ? 'Sendet...' : 'Bestellen'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sonderwunsch & Customization Modal */}
      {customizingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div>
                <h3 className="font-bold text-base text-white">Sonderwunsch</h3>
                <p className="text-xs text-slate-400">{customizingItem.name}</p>
              </div>
              <button onClick={() => setCustomizingItem(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Word Groups Selector */}
            <div className="space-y-3 mb-4">
              {wordGroups.map((wg, idx) => (
                <div key={wg.id}>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    {wg.name}:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {wg.words.map((w: string) => {
                      const isSelected =
                        idx === 0 ? selectedPrefix === w : selectedIngredient === w;
                      return (
                        <button
                          key={w}
                          type="button"
                          onClick={() => {
                            if (idx === 0) setSelectedPrefix(isSelected ? '' : w);
                            else setSelectedIngredient(isSelected ? '' : w);
                          }}
                          className={`pos-touch-btn px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                            isSelected
                              ? 'bg-amber-500 text-black border-amber-400 shadow'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {w}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Free Text Input */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Freitext Notiz:
                </label>
                <input
                  type="text"
                  placeholder="z. B. bitte extra heiß servieren"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCustomizingItem(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={saveCustomization}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-sm font-bold shadow-md shadow-amber-900/30"
              >
                Übernehmen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
