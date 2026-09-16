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
  Smartphone,
} from 'lucide-react';
import { useSocket } from '@/components/providers/socket-provider';
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
  const [step, setStep] = useState<'SELECT' | 'UPSELL' | 'PAYMENT' | 'SUCCESS'>('SELECT');
  const [orderResult, setOrderResult] = useState<{ tokenNumber: string; orderNumber: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { socket } = useSocket();
  const [paymentSessionId, setPaymentSessionId] = useState<string | null>(null);
  const [terminalWaiting, setTerminalWaiting] = useState(false);
  const [countdown, setCountdown] = useState(120);

  const resetTimer = () => {};

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
    startTerminalPayment();
  };

  const executeKioskPayment = async (method: string = 'CARD_TERMINAL') => {
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
        paymentMethod: method,
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
      setTerminalWaiting(false);
      setPaymentSessionId(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : '';
      error(detail ? `Zahlungsvorgang fehlgeschlagen: ${detail}` : 'Zahlungsvorgang abgebrochen oder fehlgeschlagen. Bitte erneut versuchen.');
      setTerminalWaiting(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const startTerminalPayment = async () => {
    setIsProcessing(true);
    setTerminalWaiting(true);
    setCountdown(120);
    try {
      const res = await fetch('/api/payments/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'CARD_VRPAY',
          amountCents: Math.round(totalGross * 100),
          orderType: 'KIOSK',
          deviceId: 'kiosk-1',
          waiterName: 'SB-Kiosk #1',
          title: `SB-Kiosk #${cart.length} Artikel`,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPaymentSessionId(data.sessionId);
      } else {
        const err = await res.json();
        error('Verbindungsfehler zum Bezahl-Terminal: ' + (err.error || 'Fehler beim Starten'));
        setTerminalWaiting(false);
      }
    } catch (e: any) {
      error('Verbindungsfehler: ' + e.message);
      setTerminalWaiting(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelTerminalPayment = async () => {
    if (paymentSessionId) {
      try {
        await fetch(`/api/payments/session/${paymentSessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'CANCEL', reason: 'Am Kiosk abgebrochen' }),
        });
      } catch {}
    }
    setTerminalWaiting(false);
    setPaymentSessionId(null);
    setStep('SELECT');
  };

  // Socket Listener für automatische Rückmeldung des Bezahl-Handys
  useEffect(() => {
    if (!socket || !paymentSessionId) return;

    const handleCompleted = (data: { sessionId: string }) => {
      if (data.sessionId === paymentSessionId) {
        executeKioskPayment('CARD_VRPAY');
      }
    };

    const handleCancelled = (data: { sessionId: string }) => {
      if (data.sessionId === paymentSessionId) {
        setTerminalWaiting(false);
        setPaymentSessionId(null);
        error('Zahlung am Bezahl-Smartphone abgebrochen.');
      }
    };

    socket.on('payment:completed', handleCompleted);
    socket.on('payment:cancelled', handleCancelled);

    return () => {
      socket.off('payment:completed', handleCompleted);
      socket.off('payment:cancelled', handleCancelled);
    };
  }, [socket, paymentSessionId]);

  // Countdown-Timer bei aktiver Terminal-Zahlung
  useEffect(() => {
    if (!terminalWaiting) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTerminalWaiting(false);
          setPaymentSessionId(null);
          error('Zeitüberschreitung: Zahlung wurde nicht rechtzeitig autorisiert.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [terminalWaiting]);

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

        {/* Alles löschen Button */}
        <button
          type="button"
          onClick={() => {
            setCart([]);
            setStep('SELECT');
            setOrderResult(null);
            setKioskSearch('');
          }}
          disabled={cart.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-rose-600/20 hover:bg-rose-600 active:bg-rose-700 text-rose-300 hover:text-white disabled:opacity-40 disabled:hover:bg-rose-600/20 disabled:hover:text-rose-300 border border-rose-500/40 hover:border-rose-400 rounded-2xl font-bold text-sm transition shadow-md active:scale-95 touch-manipulation"
          title="Gesamten Warenkorb leeren"
        >
          <Trash2 className="w-4 h-4" />
          <span>Alles löschen</span>
        </button>
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
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 max-w-lg w-full text-center shadow-2xl">
              <div className="w-24 h-24 bg-blue-600/20 text-blue-400 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-blue-500/40 relative">
                <Smartphone className="w-12 h-12" />
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>

              <h2 className="text-3xl font-black text-white mb-2">Kartenzahlung</h2>
              <p className="text-slate-300 text-base mb-2">
                Bitte halten Sie Ihre <strong>Girocard, Kreditkarte oder Ihr Handy</strong> an die Rückseite des Bezahl-Smartphones.
              </p>
              <p className="text-xs text-slate-500 mb-6">
                PIN-Eingabe (falls erforderlich) erfolgt direkt auf dem Display des Bezahl-Handys.
              </p>

              <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl mb-6">
                <span className="text-xs text-slate-400 uppercase tracking-widest font-bold block mb-1">
                  Zu zahlender Betrag
                </span>
                <span className="text-5xl font-mono font-black text-emerald-400">
                  {totalGross.toFixed(2)} €
                </span>
              </div>

              {terminalWaiting ? (
                <div className="space-y-4 mb-6">
                  <div className="flex items-center justify-center gap-3 text-blue-400 font-bold text-sm bg-blue-950/40 border border-blue-800/40 rounded-xl py-3 px-4">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Warte auf Bezahlung am Smartphone … ({countdown}s)</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-500 h-full transition-all duration-1000 ease-linear"
                      style={{ width: `${Math.max(0, Math.min(100, (countdown / 120) * 100))}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="mb-6">
                  <button
                    onClick={startTerminalPayment}
                    disabled={isProcessing}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all mb-3"
                  >
                    <RotateCcw className="w-5 h-5" />
                    <span>Zahlung am Bezahl-Smartphone erneut starten</span>
                  </button>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={() => executeKioskPayment('CARD_TERMINAL')}
                  disabled={isProcessing}
                  className="w-full py-3.5 bg-emerald-700/80 hover:bg-emerald-600 text-white font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-2 shadow"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Bestellung wird abgeschlossen …</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Direkt abschließen (Test / Sofort-Freigabe)</span>
                    </>
                  )}
                </button>

                <button
                  onClick={cancelTerminalPayment}
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
