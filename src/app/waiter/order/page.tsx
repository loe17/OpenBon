'use client';

import React, { useEffect, useState, Suspense } from 'react';
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
  RefreshCw,
  Ban,
} from 'lucide-react';

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  deposit: number;
  quantity: number;
  variantName?: string;
  selectedOptions: string[];
  customizationText?: string;
}

function WaiterOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tableId = searchParams.get('tableId');
  const waiterFromUrl = searchParams.get('waiterName');

  const [table, setTable] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [selectedSubCat, setSelectedSubCat] = useState<string>('ALL');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wordGroups, setWordGroups] = useState<any[]>([]);
  const [customizingItem, setCustomizingItem] = useState<CartItem | null>(null);
  const [selectedPrefix, setSelectedPrefix] = useState<string>('');
  const [selectedIngredient, setSelectedIngredient] = useState<string>('');
  const [customText, setCustomText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [waiterName, setWaiterName] = useState('Bedienung');

  useEffect(() => {
    const savedWaiter = waiterFromUrl || localStorage.getItem('pos_waiter_name') || 'Bedienung';
    setWaiterName(savedWaiter);

    fetch('/api/categories')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setCategories(data);
          setSelectedCatId(data[0].id);
        }
      })
      .catch(() => {});

    fetch('/api/word-groups')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setWordGroups(data);
      })
      .catch(() => {});

    if (tableId) {
      fetch('/api/tables')
        .then((r) => r.json())
        .then((tables) => {
          const found = tables.find((t: any) => t.id === tableId);
          if (found) setTable(found);
        })
        .catch(() => {});
    }
  }, [tableId, waiterFromUrl]);

  const addToCart = (product: any, variant?: any) => {
    if (product.isSoldOut || (variant && variant.isSoldOut)) {
      alert(`Artikel "${product.name}" ist derzeit ausverkauft.`);
      return;
    }

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
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === lineId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const openCustomizer = (item: CartItem) => {
    triggerHapticFeedback();
    setCustomizingItem(item);
    setSelectedPrefix('');
    setSelectedIngredient('');
    setCustomText(item.customizationText || '');
  };

  const addPrefixToText = (prefix: string) => {
    triggerHapticFeedback();
    setSelectedPrefix(prefix);
    if (selectedIngredient) {
      const combined = `${prefix} ${selectedIngredient}`;
      setCustomText((prev) => (prev ? `${prev}, ${combined}` : combined));
      setSelectedPrefix('');
      setSelectedIngredient('');
    }
  };

  const addIngredientToText = (ing: string) => {
    triggerHapticFeedback();
    setSelectedIngredient(ing);
    if (selectedPrefix) {
      const combined = `${selectedPrefix} ${ing}`;
      setCustomText((prev) => (prev ? `${prev}, ${combined}` : combined));
      setSelectedPrefix('');
      setSelectedIngredient('');
    } else {
      setCustomText((prev) => (prev ? `${prev}, ${ing}` : ing));
      setSelectedIngredient('');
    }
  };

  const saveCustomization = () => {
    if (!customizingItem) return;
    triggerHapticFeedback();

    setCart((prev) =>
      prev.map((item) => {
        if (item.id === customizingItem.id) {
          return {
            ...item,
            customizationText: customText.trim() || undefined,
          };
        }
        return item;
      })
    );

    setCustomizingItem(null);
  };

  const submitOrder = async () => {
    if (!tableId || cart.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    triggerHapticFeedback();

    try {
      const deviceId = localStorage.getItem('pos_device_id');
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId,
          waiterName,
          deviceId,
          items: cart.map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            deposit: item.deposit,
            variantName: item.variantName,
            selectedOptions: item.selectedOptions,
            customizationText: item.customizationText,
          })),
        }),
      });

      if (res.ok) {
        triggerHapticFeedback();
        router.push('/waiter');
      } else {
        alert('Fehler beim Übermitteln der Bestellung!');
      }
    } catch (e) {
      console.error(e);
      alert('Netzwerkfehler beim Absenden der Bestellung.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentCategory = categories.find((c) => c.id === selectedCatId);
  const displayedProducts = currentCategory?.products?.filter((p: any) => {
    if (selectedSubCat !== 'ALL' && p.subCategory !== selectedSubCat) return false;
    return true;
  });

  const totalAmount = cart.reduce(
    (sum, item) => sum + (item.price + item.deposit) * item.quantity,
    0
  );
  const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-white">
      {/* Top Header */}
      <div className="p-3 bg-slate-900 border-b border-slate-700 flex items-center justify-between shadow-md">
        <button
          onClick={() => router.push('/waiter')}
          className="pos-touch-btn p-2 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-300 flex items-center gap-1.5 text-xs font-bold transition active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Tische</span>
        </button>

        <div className="text-center">
          <span className="text-xs text-slate-400 font-bold block">
            {waiterName} • Tisch:
          </span>
          <h2 className="text-base sm:text-lg font-black text-white">
            {table ? table.label : `Tisch ${tableId}`}
          </h2>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-400 font-bold block">{totalItemCount} Pos.</span>
          <span className="text-sm sm:text-base font-black text-emerald-400 font-mono">
            {formatCurrency(totalAmount)}
          </span>
        </div>
      </div>

      {/* Category Selection Bar */}
      <div className="bg-slate-900 px-3 py-2 border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              setSelectedCatId(cat.id);
              setSelectedSubCat('ALL');
            }}
            className={`pos-touch-btn px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border ${
              selectedCatId === cat.id
                ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-950/50'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Beverage Filter Bar */}
      <div className="bg-slate-950 px-3 py-1.5 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto text-xs">
        {[
          { id: 'ALL', label: 'Alle' },
          { id: 'BIER', label: '🍺 Bier' },
          { id: 'WEIN', label: '🍷 Wein' },
          { id: 'ALKOHOLFREI', label: '🥤 Alkoholfrei' },
          { id: 'HEISS', label: '☕ Heiß' },
          { id: 'BAR', label: '🍸 Bar' },
        ].map((sub) => (
          <button
            key={sub.id}
            onClick={() => setSelectedSubCat(sub.id)}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition border ${
              selectedSubCat === sub.id
                ? 'bg-slate-800 text-amber-300 border-amber-500/60'
                : 'bg-transparent text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            {sub.label}
          </button>
        ))}
      </div>

      {/* Split Area: Products on Left, Cart on Right */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
            {displayedProducts?.map((product: any) => {
              const hasVariants = product.variants && product.variants.length > 0;
              const isOut = product.isSoldOut;

              return (
                <div
                  key={product.id}
                  className={`relative flex flex-col justify-between p-3.5 rounded-3xl border-2 shadow-md transition ${
                    isOut
                      ? 'bg-slate-950/60 border-rose-900/40 opacity-40 cursor-not-allowed line-through'
                      : 'bg-slate-900 border-slate-700 hover:border-blue-500'
                  }`}
                  style={{ borderLeftColor: isOut ? '#991b1b' : product.buttonColor || '#3b82f6', borderLeftWidth: '6px' }}
                >
                  <div className="mb-2">
                    <h3 className="font-extrabold text-sm sm:text-base text-white leading-snug">
                      {product.name}
                    </h3>
                    <div className="text-sm font-mono font-black text-emerald-400 mt-1">
                      {formatCurrency(product.price)}
                    </div>
                  </div>

                  {/* If product has variants */}
                  {hasVariants ? (
                    <div className="grid grid-cols-1 gap-1.5 mt-2">
                      {product.variants.map((variant: any) => {
                        const vOut = isOut || variant.isSoldOut;
                        return (
                          <button
                            key={variant.id}
                            disabled={vOut}
                            onClick={() => addToCart(product, variant)}
                            className={`pos-touch-btn py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-between border transition ${
                              vOut
                                ? 'bg-slate-950 text-slate-600 border-slate-900 line-through'
                                : 'bg-slate-800 hover:bg-blue-600 hover:border-blue-500 active:scale-95 text-slate-200 border-slate-700'
                            }`}
                          >
                            <span>{variant.name}</span>
                            <span className="font-mono text-emerald-300">
                              {formatCurrency(product.price + variant.priceDelta)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <button
                      disabled={isOut}
                      onClick={() => addToCart(product)}
                      className={`pos-touch-btn w-full mt-2 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow-md transition ${
                        isOut
                          ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-500 active:scale-95 text-white shadow-blue-950/50'
                      }`}
                    >
                      {isOut ? (
                        <span>Ausverkauft</span>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Buchen</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Cart Bottom Sheet (Mobile) / Sidebar (Desktop) */}
        <div className="w-full lg:w-[380px] bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-700 p-4 flex flex-col justify-between shadow-2xl overflow-y-auto max-h-[45vh] lg:max-h-full">
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Aktuelle Tischbestellung
              </span>
              <button
                onClick={() => setCart([])}
                disabled={cart.length === 0}
                className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-30 font-semibold"
              >
                Korb leeren
              </button>
            </div>

            {/* Cart Items List */}
            <div className="space-y-2.5 overflow-y-auto max-h-48 lg:max-h-[calc(100vh-320px)] pr-1">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 font-medium">
                  Noch keine Artikel ausgewählt.
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col gap-2 shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 pr-2">
                        <div className="font-extrabold text-sm text-white">
                          {item.name}
                          {item.variantName && (
                            <span className="ml-1 text-xs text-blue-400 font-normal">
                              ({item.variantName})
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono font-bold text-slate-400">
                          {formatCurrency((item.price + item.deposit) * item.quantity)}
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-black active:scale-95 border border-slate-700"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center font-black text-sm font-mono">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center font-black active:scale-95 shadow"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Customization Text / Sonderwunsch Button */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                      {item.customizationText ? (
                        <div className="text-xs text-amber-300 font-semibold italic flex items-center gap-1">
                          <span>Wunsch: {item.customizationText}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500">Kein Sonderwunsch</span>
                      )}

                      <button
                        onClick={() => openCustomizer(item)}
                        className="text-[11px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 bg-blue-950/60 px-2 py-0.5 rounded-lg border border-blue-800/60"
                      >
                        <MessageSquarePlus className="w-3 h-3" />
                        <span>{item.customizationText ? 'Ändern' : '+ Wunsch'}</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-3 border-t border-slate-800">
            <button
              disabled={cart.length === 0 || isSubmitting}
              onClick={submitOrder}
              className={`pos-touch-btn w-full h-14 rounded-2xl font-black text-base flex items-center justify-center gap-2 shadow-2xl transition ${
                cart.length > 0 && !isSubmitting
                  ? 'bg-blue-600 hover:bg-blue-500 active:scale-95 text-white shadow-blue-950/60'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              <Send className="w-5 h-5" />
              <span>
                {isSubmitting ? 'Wird gesendet & gedruckt...' : `Bestellen (${formatCurrency(totalAmount)})`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Customization Popup Modal */}
      {customizingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <span className="text-xs text-blue-400 font-bold uppercase">Sonderwunsch</span>
                <h3 className="text-lg font-black text-white">{customizingItem.name}</h3>
              </div>
              <button
                onClick={() => setCustomizingItem(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Word Groups Blocks */}
            <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
              {wordGroups.map((group) => {
                let words: string[] = [];
                try {
                  words = JSON.parse(group.words);
                } catch {
                  words = group.words.split(',').map((s: string) => s.trim());
                }

                const isPrefixGroup =
                  group.name.toLowerCase().includes('zusatz') ||
                  group.name.toLowerCase().includes('präfix') ||
                  words.some((w) => ['ohne', 'extra', 'wenig', 'viel'].includes(w.toLowerCase()));

                return (
                  <div key={group.id} className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                      {group.name}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {words.map((w, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() =>
                            isPrefixGroup ? addPrefixToText(w) : addIngredientToText(w)
                          }
                          className="pos-touch-btn px-3 py-2 bg-slate-800 hover:bg-slate-700 active:bg-blue-600 active:text-white text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition"
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Free Text Input */}
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Freitext oder Sonderanweisung an die Küche:
                </label>
                <input
                  type="text"
                  placeholder="z. B. Bitte extra knusprig..."
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCustomizingItem(null)}
                className="flex-1 h-12 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-bold uppercase tracking-wider"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={saveCustomization}
                className="flex-1 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-950/50"
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

export default function WaiterOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Lade Bestellmaske...</span>
        </div>
      }
    >
      <WaiterOrderContent />
    </Suspense>
  );
}
