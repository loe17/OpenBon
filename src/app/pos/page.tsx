'use client';

import React, { useEffect, useState } from 'react';
import { useSocket } from '@/components/providers/socket-provider';
import { formatCurrency } from '@/lib/utils';
import { triggerHapticFeedback } from '@/lib/socket-client';
import {
  Ticket,
  Plus,
  Minus,
  Trash2,
  Check,
  CreditCard,
  Banknote,
  Percent,
  Sparkles,
  DoorOpen,
  Receipt,
  User,
  Ban,
  LayoutList,
  ShieldAlert,
  Filter,
  AlertCircle,
  QrCode,
  Coins,
  Package,
} from 'lucide-react';
import { SubCategoryIcon } from '@/components/ui/subcategory-icon';
import { calculateMinBirthdate, EU_ALLERGENS, filterProductsByExcludedAllergens } from '@/lib/compliance';
import { getEffectiveProductPrice } from '@/lib/pricing';
import type { ProductDTO, ProductVariantDTO, OrderItemDTO, ProductCategoryDTO } from '@/types/domain';

export default function PosCounterPage() {
  const { socket } = useSocket();
  const [categories, setCategories] = useState<ProductCategoryDTO[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [selectedSubCat, setSelectedSubCat] = useState<string>('ALL');
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [showAllergenFilter, setShowAllergenFilter] = useState(false);
  const [cart, setCart] = useState<any[]>([]);
  const [mode, setMode] = useState<'DIRECT' | 'VOUCHER' | 'DUAL'>('DUAL');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [givenAmount, setGivenAmount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastToken, setLastToken] = useState<number | null>(null);
  const [completedPayment, setCompletedPayment] = useState<any | null>(null);
  const [selectedProductInfo, setSelectedProductInfo] = useState<any | null>(null);
  const [lowStockWarning, setLowStockWarning] = useState<string | null>(null);

  const minBirth16 = calculateMinBirthdate(16);
  const minBirth18 = calculateMinBirthdate(18);

  const totalGross = cart.reduce((sum, item) => sum + (item.price + item.deposit) * item.quantity, 0);
  const totalDeposit = cart.reduce((sum, item) => sum + item.deposit * item.quantity, 0);

  // Synchronisation mit Kundendisplay / Customer Screen
  useEffect(() => {
    if (!socket) return;
    if (cart.length > 0) {
      socket.emit('pos:cart_updated', {
        stationId: 'MAIN_CASH',
        stationName: 'Hauptkasse',
        items: cart.map((i) => ({
          name: i.variantName ? `${i.name} (${i.variantName})` : i.name,
          quantity: i.quantity,
          price: i.price,
          deposit: i.deposit,
        })),
        totalGross,
        totalDeposit,
      });
    } else {
      socket.emit('pos:cart_cleared', { stationId: 'MAIN_CASH' });
    }
  }, [cart, totalGross, totalDeposit, socket]);

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d) && d.length > 0) {
          setCategories(d);
          setSelectedCatId(d[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const addToCart = (product: ProductDTO, variant?: ProductVariantDTO) => {
    if (product.isSoldOut || (variant && variant.isSoldOut)) {
      alert(`Artikel "${product.name}" ist derzeit ausverkauft / gesperrt.`);
      return;
    }

    triggerHapticFeedback();
    const { price: effectivePrice } = getEffectiveProductPrice(product as any);
    const unitPrice = effectivePrice + (variant ? variant.priceDelta : 0);
    const lineId = `${product.id}_${variant ? variant.name : 'def'}`;

    // Pruefe Meldebestand-Warnung
    if (product.trackStock && product.stockQuantity <= ((product as any).minStockAlert || 10)) {
      setLowStockWarning(`Hinweis: "${product.name}" hat nur noch ${product.stockQuantity} Stk. auf Lager!`);
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.id === lineId);
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
        },
      ];
    });
  };

  const updateQty = (lineId: string, delta: number) => {
    triggerHapticFeedback();
    setCart((prev) =>
      prev
        .map((i) => (i.id === lineId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.price + item.deposit) * item.quantity, 0);
  const changeAmount = Math.max(0, givenAmount - totalAmount);

  const openDrawer = async () => {
    triggerHapticFeedback();
    try {
      const prnRes = await fetch('/api/printers');
      const prns = await prnRes.json();
      if (Array.isArray(prns) && prns.length > 0) {
        await fetch('/api/printers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'OPEN_DRAWER', printerId: prns[0].id }),
        });
      }
    } catch {
      // Ignore
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || isProcessing) return;
    setIsProcessing(true);
    triggerHapticFeedback();

    try {
      const waiterName = localStorage.getItem('pos_waiter_name') || 'Bonkasse Theke';
      const deviceId = localStorage.getItem('pos_device_id');

      // 1. Create Counter / Voucher Order
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderType: mode === 'DIRECT' ? 'DIRECT_SALE' : 'VOUCHER',
          source: 'POS_CASHIER',
          waiterName,
          deviceId,
          items: cart.map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            deposit: item.deposit,
            variantName: item.variantName,
          })),
        }),
      });

      const orderData = await orderRes.json();
      if (orderData.tokenNumber) {
        setLastToken(orderData.tokenNumber);
      }

      // 2. Complete Payment
      const paymentRes = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderData.id,
          waiterName,
          deviceId,
          paymentMethod,
          givenAmount: paymentMethod === 'CASH' ? givenAmount : totalAmount,
          printReceipt: mode !== 'DIRECT',
          itemsToPay: orderData.items.map((i: OrderItemDTO) => ({
            orderItemId: i.id,
            productName: i.productName,
            quantityToPay: i.quantity,
            unitPrice: i.unitPrice,
            deposit: i.deposit,
            taxRate: i.taxRate,
          })),
        }),
      });

      if (paymentRes.ok) {
        const payData = await paymentRes.json();
        setCompletedPayment(payData);
        triggerHapticFeedback();
        setCart([]);
        setGivenAmount(0);
        if (paymentMethod === 'CASH') {
          openDrawer();
        }
      }
    } catch (e) {
      console.error(e);
      alert('Fehler beim Kassiervorgang.');
    } finally {
      setIsProcessing(false);
    }
  };

  const currentCategory = categories.find((c) => c.id === selectedCatId);
  const rawProducts = currentCategory?.products?.filter((p) => {
    if (selectedSubCat !== 'ALL' && p.subCategory !== selectedSubCat) return false;
    return true;
  }) || [];

  const displayedProducts = filterProductsByExcludedAllergens(rawProducts, selectedAllergens);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-white font-sans">
      {/* Top Header */}
      <div className="p-3 sm:p-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between flex-wrap gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 text-white p-2.5 rounded-2xl shadow">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-black text-lg sm:text-xl">Bonkasse & Thekenverkauf</h2>
            <p className="text-xs text-slate-400 font-semibold">
              {mode === 'DIRECT'
                ? 'Direktverkauf (Theke / Bar ohne Küchenbon)'
                : mode === 'VOUCHER'
                ? 'Gutscheinbon / Wertmarke (Einzelbons mit Abhol-Nr.)'
                : 'Gutschein + Gegenbon (Gastbon + Küchenbon)'}
            </p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-700">
          <button
            onClick={() => setMode('DIRECT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              mode === 'DIRECT' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
            title="Reiner Verkauf an der Theke"
          >
            Nur Kassieren
          </button>
          <button
            onClick={() => setMode('VOUCHER')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              mode === 'VOUCHER' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
            title="Druckt Wertmarken je Artikel mit Abholnummer"
          >
            Wertmarken
          </button>
          <button
            onClick={() => setMode('DUAL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              mode === 'DUAL' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
            title="Druckt Gast-Wertmarke UND Küchen-Gegenbon"
          >
            Gutschein + Gegenbon
          </button>
        </div>

        {/* Open Drawer Button */}
        <button
          onClick={openDrawer}
          className="pos-touch-btn flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-2xl text-xs font-bold border border-slate-700 shadow transition active:scale-95"
        >
          <DoorOpen className="w-4 h-4 text-emerald-400" />
          <span>Lade öffnen</span>
        </button>
      </div>

      {/* Meldebestand Low-Stock Alert Bar */}
      {lowStockWarning && (
        <div className="bg-amber-950 border-b border-amber-800 px-4 py-2 text-xs font-bold text-amber-200 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-400" />
            {lowStockWarning}
          </span>
          <button onClick={() => setLowStockWarning(null)} className="text-amber-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Jugendschutz-Hinweis Bar mit taggenauen Geburtsdaten */}
      <div className="bg-slate-900/95 border-b border-slate-800 px-4 py-1.5 flex items-center justify-between text-xs font-mono text-slate-300">
        <div className="flex items-center gap-2">
          <span className="bg-red-500/20 text-red-300 border border-red-500/30 px-1.5 py-0.5 rounded font-black text-[10px] flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" /> JUGENDSCHUTZ
          </span>
          <span>Ab 16 J. (Bier/Wein): <strong className="text-amber-400 font-bold">≤ {minBirth16.formattedDate}</strong></span>
          <span className="text-slate-600">|</span>
          <span>Ab 18 J. (Spirituosen): <strong className="text-red-400 font-bold">≤ {minBirth18.formattedDate}</strong></span>
        </div>

        <button
          onClick={() => setShowAllergenFilter(!showAllergenFilter)}
          className={`px-2 py-0.5 rounded-lg text-xs font-bold flex items-center gap-1 border transition ${
            selectedAllergens.length > 0
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
          }`}
        >
          <Filter className="w-3 h-3" />
          <span>Allergene {selectedAllergens.length > 0 && `(${selectedAllergens.length})`}</span>
        </button>
      </div>

      {/* Allergen Filter Dropdown */}
      {showAllergenFilter && (
        <div className="bg-slate-900 border-b border-slate-800 p-2.5 flex flex-wrap gap-1.5 items-center text-xs">
          <span className="font-bold text-slate-400 mr-1">Ausschließen:</span>
          {EU_ALLERGENS.map((a) => {
            const active = selectedAllergens.includes(a.code);
            return (
              <button
                key={a.code}
                onClick={() => {
                  setSelectedAllergens((prev) =>
                    active ? prev.filter((c) => c !== a.code) : [...prev, a.code]
                  );
                }}
                className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border transition ${
                  active
                    ? 'bg-red-500/20 text-red-300 border-red-500/40 font-bold'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {active ? `✕ Ohne ${a.name}` : a.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Categories */}
      <div className="bg-slate-900 px-3 py-2 border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              setSelectedCatId(cat.id);
              setSelectedSubCat('ALL');
            }}
            className={`pos-touch-btn px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all border ${
              selectedCatId === cat.id
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/50'
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
          { id: 'ALL', label: 'Alle Artikel' },
          { id: 'BIER', label: 'Bier' },
          { id: 'WEIN', label: 'Wein' },
          { id: 'ALKOHOLFREI', label: 'Alkoholfrei' },
          { id: 'HEISS', label: 'Heißgetränke' },
          { id: 'BAR', label: 'Bar' },
        ].map((sub) => (
          <button
            key={sub.id}
            onClick={() => setSelectedSubCat(sub.id)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition border flex items-center gap-1.5 whitespace-nowrap ${
              selectedSubCat === sub.id
                ? 'bg-slate-800 text-amber-300 border-amber-500/60'
                : 'bg-transparent text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            {sub.id === 'ALL' ? (
              <LayoutList className="w-4 h-4" />
            ) : (
              <SubCategoryIcon subCategory={sub.id} className="w-4 h-4" />
            )}
            <span>{sub.label}</span>
          </button>
        ))}
      </div>

      {/* Main Split */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Product Tiles */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {displayedProducts?.map((prod) => {
              const isOut = prod.isSoldOut;
              const { price: effectivePrice, isHappyHour } = getEffectiveProductPrice(prod as any);

              return (
                <button
                  key={prod.id}
                  disabled={isOut}
                  onClick={() => addToCart(prod)}
                  className={`pos-touch-btn relative flex flex-col justify-between p-4 rounded-3xl border-2 shadow-lg text-left min-h-[120px] transition ${
                    isOut
                      ? 'bg-slate-950/60 border-rose-900/40 opacity-40 cursor-not-allowed line-through'
                      : 'bg-slate-900 border-slate-700 hover:border-emerald-500 active:scale-95'
                  }`}
                  style={{ borderLeftColor: isOut ? '#991b1b' : prod.buttonColor || '#10b981', borderLeftWidth: '6px' }}
                >
                  <div>
                    <div className="flex items-start justify-between gap-1">
                      <div className="font-extrabold text-sm sm:text-base text-white line-clamp-2">
                        {prod.name}
                      </div>
                      {prod.allergens && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProductInfo(prod);
                          }}
                          className="text-slate-500 hover:text-amber-400 p-0.5"
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1 mt-1">
                      {isOut && (
                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800">
                          Ausverkauft
                        </span>
                      )}
                      {isHappyHour && (
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5" /> HH
                        </span>
                      )}
                      {(prod as any).hasAgeRestriction && (
                        <span className="bg-red-500/20 text-red-300 border border-red-500/30 text-[9px] font-black px-1.5 py-0.5 rounded">
                          {(prod as any).minAge}+
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between w-full mt-2">
                    <span className="text-base sm:text-lg font-black font-mono text-emerald-400">
                      {formatCurrency(effectivePrice)}
                    </span>
                    {!isOut && (
                      <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200">
                        <Plus className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Cart & Quick Checkout */}
        <div className="w-full lg:w-[420px] bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-700 p-5 flex flex-col justify-between overflow-y-auto shadow-2xl">
          <div>
            {/* Last Token Banner */}
            {lastToken && (
              <div className="p-3 mb-3 rounded-2xl bg-gradient-to-r from-emerald-950 to-blue-950 border-2 border-emerald-500 text-center animate-in zoom-in-95 shadow">
                <span className="text-xs text-slate-300 uppercase font-black tracking-wider">Letzte Abholnummer:</span>
                <div className="text-4xl font-black text-emerald-400 font-mono">#{lastToken}</div>
              </div>
            )}

            {/* Cart Items */}
            <div className="space-y-2 max-h-48 overflow-y-auto mb-3 pr-1">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 font-medium">Korb ist leer.</div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="font-bold text-sm text-white truncate">{item.name}</div>
                      <div className="text-xs text-slate-400 font-mono font-bold">
                        {formatCurrency((item.price + item.deposit) * item.quantity)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        className="w-8 h-8 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-200 font-bold"
                      >
                        -
                      </button>
                      <span className="w-7 text-center font-black font-mono text-base">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.id, 1)}
                        className="w-8 h-8 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Total Amount */}
            <div className="p-4 rounded-3xl bg-slate-950 border border-slate-800 mb-3 flex items-baseline justify-between shadow-inner">
              <span className="text-sm font-bold text-slate-400">Gesamtbetrag:</span>
              <span className="text-3xl font-black text-emerald-400 font-mono">
                {formatCurrency(totalAmount)}
              </span>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={`py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                  paymentMethod === 'CASH'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>Bargeld</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('CARD_TERMINAL')}
                className={`py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                  paymentMethod === 'CARD_TERMINAL'
                    ? 'bg-purple-600 text-white border-purple-500 shadow-md'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>EC / Karte</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('TOKEN')}
                className={`py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                  paymentMethod === 'TOKEN'
                    ? 'bg-amber-600 text-white border-amber-500 shadow-md'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                <Ticket className="w-4 h-4" />
                <span>Wertmarke</span>
              </button>
            </div>

            {/* Quick Cash Buttons */}
            {paymentMethod === 'CASH' && (
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[5, 10, 20, 50].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setGivenAmount(amt)}
                    className="py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 active:scale-95"
                  >
                    {amt} €
                  </button>
                ))}
              </div>
            )}

            {/* Change Return Box */}
            {paymentMethod === 'CASH' && givenAmount > 0 && (
              <div className="p-3 mb-3 rounded-2xl bg-slate-950 border border-slate-800 flex justify-between items-center text-xs font-bold">
                <span className="text-slate-400">Rückgeld:</span>
                <span className="text-amber-400 text-lg font-black font-mono">
                  {formatCurrency(changeAmount)}
                </span>
              </div>
            )}
          </div>

          {/* Checkout Submit Button */}
          <button
            disabled={cart.length === 0 || isProcessing}
            onClick={handleCheckout}
            className={`pos-touch-btn w-full h-16 rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-2xl transition ${
              cart.length > 0 && !isProcessing
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/60'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            <Check className="w-6 h-6" />
            <span>
              {isProcessing
                ? 'Wird gedruckt & gebucht...'
                : `Kassieren & ${mode === 'DIRECT' ? 'Lade auf' : 'Bons drucken'}`}
            </span>
          </button>
        </div>
      </div>

      {/* Digital Receipt E-Bon Modal */}
      {completedPayment?.digitalReceiptUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl max-w-sm w-full shadow-2xl text-center">
            <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3 border border-emerald-500/30">
              <QrCode className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Digitaler E-Bon (§33 KassenSichV)</h3>
            <p className="text-xs text-slate-400 mb-4">Der Gast kann den Beleg per Smartphone abrufen:</p>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 font-mono text-xs text-emerald-400 break-all select-all mb-4">
              {completedPayment.digitalReceiptUrl}
            </div>

            <button
              onClick={() => setCompletedPayment(null)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl text-sm shadow-lg"
            >
              Fertig / Schließen
            </button>
          </div>
        </div>
      )}

      {/* Allergen Info Modal */}
      {selectedProductInfo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl max-w-sm w-full shadow-2xl">
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
                  <span>Jugendschutz: Ab {selectedProductInfo.minAge} Jahren (Geboren bis: {selectedProductInfo.minAge === 18 ? minBirth18.formattedDate : minBirth16.formattedDate})</span>
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
