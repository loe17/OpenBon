'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Sparkles,
  CreditCard,
  RotateCcw,
  Clock,
  ChevronRight,
  Loader2,
  Trash2,
} from 'lucide-react';
import { getEffectiveProductPrice } from '@/lib/pricing';
import { generateIdempotencyKey } from '@/lib/utils';
import { sendWithOutboxFallback, removeOutboxItem } from '@/lib/offline/outbox';
import { useToast } from '@/components/ui/toast';

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
  happyHourPrice?: number | null;
  happyHourStart?: string | null;
  happyHourEnd?: string | null;
  happyHourDays?: string | null;
}

interface Category {
  id: string;
  name: string;
  icon?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export default function KioskPage() {
  const { error } = useToast();
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [kioskSearch, setKioskSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [inactivitySeconds, setInactivitySeconds] = useState(60);
  const [step, setStep] = useState<'SELECT' | 'UPSELL' | 'PAYMENT' | 'SUCCESS'>('SELECT');
  const [orderResult, setOrderResult] = useState<{ tokenNumber: string; orderNumber: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Inaktivitäts-Timer
  const resetTimer = () => {
    setInactivitySeconds(60);
  };

  useEffect(() => {
    const handleActivity = () => resetTimer();
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keydown', handleActivity);

    timerRef.current = setInterval(() => {
      setInactivitySeconds((prev) => {
        if (prev <= 1) {
          // Reset Kiosk
          setCart([]);
          setStep('SELECT');
          setOrderResult(null);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    async function load() {
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
        console.error('Kiosk Load Error:', err);
      }
    }
    load();
  }, []);

  const addToCart = (product: Product) => {
    resetTimer();
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item === existing ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    resetTimer();
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const totalGross = cart.reduce((sum, item) => {
    const { price } = getEffectiveProductPrice(item.product);
    return sum + (price + (item.product.deposit || 0)) * item.quantity;
  }, 0);

  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);

  const proceedToCheckout = () => {
    resetTimer();
    setStep('PAYMENT');
  };

  const executeKioskPayment = async () => {
    setIsProcessing(true);
    resetTimer();
    try {
      // Atomic Checkout: Bestellung + Kartenzahlung in einem Request (eine Transaktion).
      // Bei Netzwerkabbruch wird der Vorgang in der Outbox zwischengespeichert und automatisch nachgesendet.
      const kioskIdempotencyKey = generateIdempotencyKey('kiosk');
      const result = await sendWithOutboxFallback('ORDER', '/api/orders/checkout', {
        orderType: 'KIOSK',
        source: 'KIOSK',
        waiterName: 'SB-Kiosk Terminal #1',
        idempotencyKey: kioskIdempotencyKey,
        paymentMethod: 'CARD_TERMINAL',
        givenAmount: totalGross,
        printReceipt: true,
        openDrawer: false,
        items: cart.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
        })),
      });

      if (!result.success) {
        throw new Error(result.error || 'Bestellung fehlgeschlagen');
      }

      // Ohne Serverbestaetigung gibt es keine Abholnummer. Der Selbstbedienungs-
      // Kiosk darf hier KEINEN Erfolg vortaeuschen, sonst wartet der Gast auf eine
      // Nummer, die nie aufgerufen wird.
      if (result.pending) {
        // Der Vorgang wird bewusst NICHT nachgesendet: am Selbstbedienungs-Kiosk
        // steht niemand bereit, der eine spaeter entstandene Bestellung zuordnen
        // koennte. Der Gast bestellt stattdessen neu oder beim Personal.
        await removeOutboxItem(kioskIdempotencyKey);
        throw new Error(
          result.error || 'Kasse ist derzeit nicht erreichbar. Bitte wenden Sie sich an das Personal.'
        );
      }

      const orderData = result.data;
      const tokenStr = `#K-${String(orderData?.tokenNumber || orderData?.orderNumber).padStart(3, '0')}`;
      setOrderResult({ tokenNumber: tokenStr, orderNumber: orderData?.orderNumber });
      setStep('SUCCESS');
      setCart([]);
    } catch (err) {
      const detail = err instanceof Error ? err.message : '';
      error(detail ? `Zahlungsvorgang fehlgeschlagen: ${detail}` : 'Zahlungsvorgang abgebrochen oder fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* Kiosk Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-8 py-5 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg font-black text-2xl">
            OB
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">Self-Service Bestellterminal</h1>
            <p className="text-xs font-semibold text-slate-400">Tippen Sie Ihre Auswahl einfach an</p>
          </div>
        </div>

        {/* Inaktivitäts-Anzeige */}
        <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 px-4 py-2 rounded-2xl">
          <Clock className="w-5 h-5 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
          <span className="text-sm font-mono font-bold text-slate-300">
            Automatischer Reset in <span className="text-amber-400 text-base">{inactivitySeconds}s</span>
          </span>
          <button
            onClick={() => {
              setCart([]);
              setStep('SELECT');
              setOrderResult(null);
            }}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all ml-2"
            title="Abbrechen & Neu starten"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Hauptinhalt */}
      <div className="flex-1 flex overflow-hidden">
        {/* Erfolgs-Bildschirm */}
        {step === 'SUCCESS' && orderResult && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950 animate-in zoom-in-95">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 max-w-lg w-full text-center shadow-2xl">
              <div className="w-24 h-24 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-emerald-500/40">
                <CheckCircle2 className="w-16 h-16" />
              </div>
              <h2 className="text-3xl font-black text-white mb-2">Vielen Dank für Ihre Bestellung!</h2>
              <p className="text-slate-400 text-base mb-6">
                Ihr Beleg mit Abholmarke wird jetzt am Drucker ausgegeben.
              </p>

              <div className="bg-slate-950 border-2 border-emerald-500/30 p-6 rounded-3xl mb-8">
                <span className="text-sm text-slate-400 uppercase tracking-widest font-bold block mb-1">
                  Ihre Abholnummer
                </span>
                <div className="text-6xl font-mono font-black text-emerald-400 tracking-wider">
                  {orderResult.tokenNumber}
                </div>
              </div>

              <button
                onClick={() => {
                  setStep('SELECT');
                  setOrderResult(null);
                }}
                className="w-full py-5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-extrabold text-xl rounded-2xl shadow-xl transition-all"
              >
                Neue Bestellung starten
              </button>
            </div>
          </div>
        )}

        {/* Bezahl-Schritt */}
        {step === 'PAYMENT' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 max-w-md w-full text-center shadow-2xl">
              <div className="w-20 h-20 bg-blue-600/20 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/40 animate-pulse">
                <CreditCard className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">Kartenzahlung am Terminal</h2>
              <p className="text-slate-400 text-sm mb-6">
                Bitte halten Sie Ihre EC-/Kreditkarte oder Smartphone an das Terminal.
              </p>

              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl mb-8 font-mono">
                <span className="text-xs text-slate-500 uppercase tracking-wider block">Zu zahlender Betrag</span>
                <span className="text-4xl font-black text-emerald-400">{totalGross.toFixed(2)} €</span>
              </div>

              <div className="space-y-3">
                <button
                  onClick={executeKioskPayment}
                  disabled={isProcessing}
                  className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 text-white font-extrabold text-xl rounded-2xl shadow-xl flex items-center justify-center gap-3 transition-all"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Zahlung wird autorisiert...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-6 h-6" />
                      <span>Zahlung abschließen</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setStep('SELECT')}
                  disabled={isProcessing}
                  className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-sm transition-all"
                >
                  Zurück zur Artikelauswahl
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Artikelauswahl & Layout */}
        {step === 'SELECT' && (
          <>
            {/* Kategorie Leiste Links */}
            <aside className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col gap-2 overflow-y-auto">
              <button
                onClick={() => {
                  setSelectedCategory('ALL');
                  resetTimer();
                }}
                className={`w-full py-4 px-5 rounded-2xl font-black text-base flex items-center justify-between transition-all ${
                  selectedCategory === 'ALL'
                    ? 'bg-blue-600 text-white shadow-lg scale-102'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-850'
                }`}
              >
                <span>Alle Kategorien</span>
                <ChevronRight className="w-5 h-5 opacity-60" />
              </button>

              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    resetTimer();
                  }}
                  className={`w-full py-4 px-5 rounded-2xl font-black text-base flex items-center justify-between transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-blue-600 text-white shadow-lg scale-102'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-850'
                  }`}
                >
                  <span>{cat.name}</span>
                  <ChevronRight className="w-5 h-5 opacity-60" />
                </button>
              ))}
            </aside>

            {/* Produkt Raster Mitte */}
            <main className="flex-1 p-6 overflow-y-auto">
              <input
                value={kioskSearch}
                onChange={(e) => { setKioskSearch(e.target.value); resetTimer(); }}
                placeholder="Artikel suchen …"
                aria-label="Artikel suchen"
                className="w-full max-w-sm bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-base text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 min-h-[48px] mb-4"
              />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {(selectedCategory === 'ALL'
                ? products
                : products.filter((p) => p.categoryId === selectedCategory)
              ).filter((p) => !kioskSearch.trim() || p.name.toLowerCase().includes(kioskSearch.trim().toLowerCase())).map((product) => {
                const { price, isHappyHour } = getEffectiveProductPrice(product);
                return (
                  <button
                    key={product.id}
                    onClick={() => !product.isSoldOut && addToCart(product)}
                    disabled={product.isSoldOut}
                    className={`bg-slate-900 border-2 rounded-3xl p-5 flex flex-col justify-between text-left transition-all relative ${
                      product.isSoldOut
                        ? 'opacity-40 border-red-900/40 cursor-not-allowed'
                        : 'border-slate-800 hover:border-blue-500/80 active:scale-98 shadow-md hover:shadow-blue-500/10'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-extrabold text-white text-lg leading-tight mb-2">
                          {product.name}
                        </h3>
                        {isHappyHour && (
                          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-lg text-[11px] font-black flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> AKTION
                          </span>
                        )}
                      </div>

                      {product.deposit > 0 && (
                        <span className="text-xs text-slate-400 font-semibold block">
                          +{product.deposit.toFixed(2)} € Pfand
                        </span>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-2xl font-mono font-black text-emerald-400">
                        {price.toFixed(2)} €
                      </span>
                      <div className="w-10 h-10 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-md">
                        <Plus className="w-6 h-6" />
                      </div>
                    </div>
                  </button>
                );
              })}
              </div>
            </main>

            {/* Warenkorb Rechts */}
            <aside className="w-96 bg-slate-900 border-l border-slate-800 p-6 flex flex-col justify-between shadow-2xl">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <ShoppingCart className="w-6 h-6 text-blue-400" /> Ihre Bestellung
                  </h2>
                  {cart.length > 0 && (
                    <button
                      onClick={() => setCart([])}
                      className="text-xs text-red-400 hover:underline font-bold"
                    >
                      Leeren
                    </button>
                  )}
                </div>

                {/* Items Liste */}
                <div className="py-4 space-y-3 overflow-y-auto max-h-[55vh] no-scrollbar">
                  {cart.length === 0 ? (
                    <div className="text-center py-16 text-slate-500">
                      <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p className="font-semibold text-sm">Warenkorb ist leer</p>
                      <p className="text-xs text-slate-600 mt-1">Wählen Sie Artikel links aus</p>
                    </div>
                  ) : (
                    cart.map((item) => {
                      const { price } = getEffectiveProductPrice(item.product);
                      const itemTotal = (price + (item.product.deposit || 0)) * item.quantity;
                      return (
                        <div
                          key={item.product.id}
                          className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between"
                        >
                          <div className="flex-1 mr-2">
                            <h4 className="font-bold text-white text-sm leading-tight">
                              {item.product.name}
                            </h4>
                            <span className="font-mono text-xs text-slate-400">
                              {price.toFixed(2)} € {item.product.deposit > 0 && `(+${item.product.deposit.toFixed(2)}€ Pfand)`}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl">
                              <button
                                onClick={() => updateQuantity(item.product.id, -1)}
                                className="p-2 text-slate-400 hover:text-white"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="font-mono font-bold text-sm px-2 text-white">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.product.id, 1)}
                                className="p-2 text-slate-400 hover:text-white"
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
              </div>

              {/* Checkout Footer */}
              <div className="pt-4 border-t border-slate-800 space-y-4">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-sm font-semibold">Gesamtsumme:</span>
                  <span className="text-3xl font-mono font-black text-emerald-400">
                    {totalGross.toFixed(2)} €
                  </span>
                </div>

                <button
                  onClick={proceedToCheckout}
                  disabled={cart.length === 0}
                  className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 active:scale-95 text-white font-black text-xl rounded-2xl shadow-xl flex items-center justify-center gap-3 transition-all"
                >
                  <CreditCard className="w-6 h-6" />
                  <span>Jetzt Bezahlen ({totalItems})</span>
                </button>
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
