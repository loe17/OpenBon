'use client';

import React, { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { triggerHapticFeedback } from '@/lib/socket-client';
import {
  CreditCard,
  Plus,
  Minus,
  Trash2,
  Check,
  Printer,
  Sparkles,
  Layers,
  Banknote,
  Coins,
  Ticket,
  DoorOpen,
} from 'lucide-react';

export default function PosCounterPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [cart, setCart] = useState<any[]>([]);
  const [mode, setMode] = useState<'DIRECT' | 'VOUCHER' | 'DUAL'>('DUAL');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD_SUMUP'>('CASH');
  const [givenAmount, setGivenAmount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastToken, setLastToken] = useState<number | null>(null);

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

  const addToCart = (product: any, variant?: any) => {
    triggerHapticFeedback();
    const unitPrice = product.price + (variant ? variant.priceDelta : 0);
    const lineId = `${product.id}_${variant ? variant.name : 'def'}`;

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
        .map((i) => {
          if (i.id === lineId) {
            const next = i.quantity + delta;
            return next > 0 ? { ...i, quantity: next } : null;
          }
          return i;
        })
        .filter(Boolean)
    );
  };

  const openDrawer = async () => {
    const printerRes = await fetch('/api/printers');
    const printers = await printerRes.json();
    if (printers.length > 0) {
      await fetch('/api/printers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'OPEN_DRAWER', printerId: printers[0].id }),
      });
      triggerHapticFeedback();
    }
  };

  const totalAmount = cart.reduce(
    (sum, i) => sum + (i.price + i.deposit) * i.quantity,
    0
  );
  const change = givenAmount > 0 ? Math.max(0, givenAmount - totalAmount) : 0;

  const handleCheckout = async () => {
    if (cart.length === 0 || isProcessing) return;
    setIsProcessing(true);

    try {
      const waiterName = 'Thekenkasse 1';
      const deviceId = localStorage.getItem('pos_device_id');

      const orderType = mode === 'DIRECT' ? 'COUNTER_DIRECT' : 'COUNTER_VOUCHER';
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waiterName,
          deviceId,
          orderType,
          items: cart.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            variantName: i.variantName,
          })),
        }),
      });

      const orderData = await orderRes.json();
      if (orderData.tokenNumber) {
        setLastToken(orderData.tokenNumber);
      }

      const paymentRes = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waiterName,
          deviceId,
          paymentMethod,
          givenAmount,
          printReceipt: mode !== 'DIRECT',
          itemsToPay: orderData.items.map((i: any) => ({
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
        triggerHapticFeedback();
        setCart([]);
        setGivenAmount(0);
      }
    } catch (e) {
      console.error(e);
      alert('Fehler beim Kassiervorgang.');
    } finally {
      setIsProcessing(false);
    }
  };

  const currentCategory = categories.find((c) => c.id === selectedCatId);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-white">
      {/* Top Header */}
      <div className="p-3 sm:p-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between flex-wrap gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 text-white p-2.5 rounded-2xl shadow">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-black text-lg sm:text-xl">Bonkasse & Thekenverkauf</h2>
            <p className="text-xs text-slate-400 font-semibold">Schnellverkauf mit fortlaufenden Abholnummern</p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-700">
          <button
            onClick={() => setMode('DIRECT')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              mode === 'DIRECT' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Nur Kassieren
          </button>
          <button
            onClick={() => setMode('VOUCHER')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              mode === 'VOUCHER' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Gutscheinbon
          </button>
          <button
            onClick={() => setMode('DUAL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              mode === 'DUAL' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
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

      {/* Categories */}
      <div className="bg-slate-900 px-3 py-2 border-b border-slate-700 flex items-center gap-2 overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCatId(cat.id)}
            className={`pos-touch-btn px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all border ${
              selectedCatId === cat.id
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/50'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Main Split */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Product Tiles */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {currentCategory?.products?.map((prod: any) => (
              <button
                key={prod.id}
                onClick={() => addToCart(prod)}
                className="pos-touch-btn flex flex-col justify-between p-4 rounded-3xl bg-slate-900 border-2 border-slate-700 hover:border-emerald-500 shadow-lg text-left min-h-[120px] transition"
                style={{ borderLeftColor: prod.buttonColor || '#10b981', borderLeftWidth: '6px' }}
              >
                <div className="font-extrabold text-sm sm:text-base text-white line-clamp-2">
                  {prod.name}
                </div>
                <div className="flex items-center justify-between w-full mt-2">
                  <span className="text-base sm:text-lg font-black font-mono text-emerald-400">
                    {formatCurrency(prod.price)}
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200">
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
              </button>
            ))}
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

            {/* Payment Method */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
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
                onClick={() => setPaymentMethod('CARD_SUMUP')}
                className={`py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                  paymentMethod === 'CARD_SUMUP'
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>SumUp</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('CARD_VRPAY')}
                className={`py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                  paymentMethod === 'CARD_VRPAY'
                    ? 'bg-blue-700 text-white border-blue-400 shadow-md'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>VR-Pay Me</span>
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
                <span>EC-Terminal</span>
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

            {givenAmount > 0 && (
              <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-700 text-xs flex justify-between font-bold text-emerald-300 mb-2">
                <span>Rückgeld:</span>
                <span className="font-mono text-lg font-black text-emerald-400">{formatCurrency(change)}</span>
              </div>
            )}
          </div>

          {/* Big Checkout Button */}
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
            <span>{isProcessing ? 'Druckt Bon...' : `Buchen & Drucken (${formatCurrency(totalAmount)})`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
