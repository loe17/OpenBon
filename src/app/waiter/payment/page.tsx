'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';
import { triggerHapticFeedback } from '@/lib/socket-client';
import {
  ArrowLeft,
  Check,
  CreditCard,
  Banknote,
  Percent,
  AlertCircle,
  Printer,
  Sparkles,
  RefreshCw,
  Coins,
  Receipt,
  HeartHandshake,
} from 'lucide-react';

interface PayableItem {
  orderItemId: string;
  productName: string;
  variantName?: string | null;
  unitPrice: number;
  deposit: number;
  taxRate: number;
  totalUnpaidQty: number;
  selectedQty: number;
}

export default function WaiterPaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tableId = searchParams.get('tableId');

  const [table, setTable] = useState<any>(null);
  const [items, setItems] = useState<PayableItem[]>([]);
  const [returnDepositCount, setReturnDepositCount] = useState<number>(0);
  const [depositUnit, setDepositUnit] = useState<number>(1.0); // 1€ standard
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [givenAmount, setGivenAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [nonPaidReason, setNonPaidReason] = useState<string>('');
  const [printReceipt, setPrintReceipt] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchTableOrders = async () => {
    if (!tableId) return;
    try {
      const res = await fetch(`/api/orders?tableId=${tableId}`);
      const orders = await res.json();

      const payables: PayableItem[] = [];
      for (const ord of orders) {
        if (ord.status === 'COMPLETED' || ord.status === 'CANCELLED') continue;
        for (const itm of ord.items) {
          if (itm.isCancelled) continue;
          const unpaid = itm.quantity - itm.paidQuantity;
          if (unpaid > 0) {
            payables.push({
              orderItemId: itm.id,
              productName: itm.productName,
              variantName: itm.variantName,
              unitPrice: itm.unitPrice,
              deposit: itm.deposit || 0,
              taxRate: itm.taxRate || 19,
              totalUnpaidQty: unpaid,
              selectedQty: unpaid, // Default: select all for fast full-table checkout
            });
          }
        }
      }
      setItems(payables);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (tableId) {
      fetch('/api/tables')
        .then((r) => r.json())
        .then((tables) => {
          const found = tables.find((t: any) => t.id === tableId);
          if (found) setTable(found);
        })
        .catch(() => {});

      fetchTableOrders();
    }
  }, [tableId]);

  // Toggle item selection count
  const toggleSelectAll = (select: boolean) => {
    triggerHapticFeedback();
    setItems((prev) =>
      prev.map((i) => ({ ...i, selectedQty: select ? i.totalUnpaidQty : 0 }))
    );
  };

  const updateItemQty = (orderItemId: string, delta: number) => {
    triggerHapticFeedback();
    setItems((prev) =>
      prev.map((i) => {
        if (i.orderItemId === orderItemId) {
          const next = Math.max(0, Math.min(i.totalUnpaidQty, i.selectedQty + delta));
          return { ...i, selectedQty: next };
        }
        return i;
      })
    );
  };

  // Financial Calculations
  const selectedGrossTotal = items.reduce(
    (sum, i) => sum + (i.unitPrice + i.deposit) * i.selectedQty,
    0
  );
  const totalReturnDeposit = returnDepositCount * depositUnit;
  const finalToPay = Math.max(0, selectedGrossTotal - totalReturnDeposit - discountAmount);
  const change = givenAmount > 0 ? Math.max(0, givenAmount - finalToPay - tipAmount) : 0;

  // Process Checkout
  const handleCheckout = async () => {
    const itemsToPay = items
      .filter((i) => i.selectedQty > 0)
      .map((i) => ({
        orderItemId: i.orderItemId,
        productName: i.productName,
        quantityToPay: i.selectedQty,
        unitPrice: i.unitPrice,
        deposit: i.deposit,
        taxRate: i.taxRate,
      }));

    if (itemsToPay.length === 0 && totalReturnDeposit === 0) {
      alert('Bitte wähle mindestens einen Artikel oder Rückpfand aus.');
      return;
    }

    setIsProcessing(true);
    try {
      const waiterName = localStorage.getItem('pos_waiter_name') || 'Bedienung 1';
      const deviceId = localStorage.getItem('pos_device_id');

      const payload = {
        tableId: tableId || null,
        waiterName,
        deviceId,
        paymentMethod,
        nonPaidReason: paymentMethod.startsWith('NON_PAID') ? nonPaidReason : null,
        returnDepositCount,
        returnDepositAmount: totalReturnDeposit,
        discountAmount,
        tipAmount,
        givenAmount,
        printReceipt,
        itemsToPay,
      };

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        triggerHapticFeedback();
        router.push('/waiter');
      } else {
        const err = await res.json();
        alert(err.error || 'Fehler bei der Zahlung');
      }
    } catch (e) {
      console.error(e);
      alert('Verbindungsfehler beim Kassieren.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-white">
      {/* Top Bar */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <button
          onClick={() => router.push('/waiter')}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white px-2 py-1 rounded-lg bg-slate-800 text-sm font-semibold transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Tische</span>
        </button>

        <div className="font-bold text-base sm:text-lg">
          Kassieren: {table?.label || 'Tisch'}
        </div>

        <button
          onClick={() => toggleSelectAll(items.some((i) => i.selectedQty < i.totalUnpaidQty))}
          className="text-xs font-semibold text-blue-400 bg-blue-950 px-2.5 py-1 rounded-lg border border-blue-800"
        >
          {items.every((i) => i.selectedQty === i.totalUnpaidQty) ? 'Alle abwählen' : 'Alle wählen'}
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Split Item Selector */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Zu zahlende Artikel auswählen (Rechnung teilen):
          </div>

          {items.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              Keine offenen Posten auf diesem Tisch.
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.orderItemId}
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                  item.selectedQty > 0
                    ? 'bg-slate-900 border-blue-600 shadow-md'
                    : 'bg-slate-950/70 border-slate-800 opacity-60'
                }`}
              >
                <div className="flex-1 min-w-0 pr-2">
                  <div className="font-bold text-sm sm:text-base text-white truncate">
                    {item.productName}
                  </div>
                  <div className="text-xs text-slate-400">
                    {formatCurrency(item.unitPrice + item.deposit)} je Pos. • Offen: {item.totalUnpaidQty}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateItemQty(item.orderItemId, -1)}
                    className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 font-bold text-lg"
                  >
                    -
                  </button>
                  <span className="w-6 text-center font-bold font-mono text-base text-emerald-400">
                    {item.selectedQty}
                  </span>
                  <button
                    onClick={() => updateItemQty(item.orderItemId, 1)}
                    className="w-8 h-8 flex items-center justify-center bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-bold text-lg"
                  >
                    +
                  </button>
                </div>
              </div>
            ))
          )}

          {/* Rückpfand / Deposit deduction section */}
          <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-blue-950/40 to-slate-900 border border-blue-800/60">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-bold text-blue-300">
                <Coins className="w-4 h-4" />
                <span>Rückpfand verrechnen (Leergut)</span>
              </div>
              <div className="text-sm font-mono font-bold text-amber-400">
                -{formatCurrency(totalReturnDeposit)}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                {[1.0, 2.0, 0.5].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDepositUnit(d)}
                    className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                      depositUnit === d ? 'bg-blue-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    {d.toFixed(2)} €
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setReturnDepositCount(Math.max(0, returnDepositCount - 1))}
                  className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded-xl text-slate-300 font-bold"
                >
                  -
                </button>
                <span className="w-8 text-center font-bold font-mono text-base">
                  {returnDepositCount}x
                </span>
                <button
                  onClick={() => setReturnDepositCount(returnDepositCount + 1)}
                  className="w-8 h-8 flex items-center justify-center bg-blue-600 rounded-xl text-white font-bold"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Payment Calculation & Method Drawer */}
        <div className="w-full lg:w-[420px] bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 p-4 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-4">
            {/* Amount Summary */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Zwischensumme Artikel:</span>
                <span>{formatCurrency(selectedGrossTotal)}</span>
              </div>
              {totalReturnDeposit > 0 && (
                <div className="flex justify-between text-xs text-blue-400 mb-1">
                  <span>Abzgl. Rückpfand:</span>
                  <span>-{formatCurrency(totalReturnDeposit)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-xs text-rose-400 mb-1">
                  <span>Abzgl. Rabatt:</span>
                  <span>-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              {tipAmount > 0 && (
                <div className="flex justify-between text-xs text-amber-400 mb-1">
                  <span>Trinkgeld:</span>
                  <span>+{formatCurrency(tipAmount)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
                <span className="font-bold text-sm text-slate-300">Zu zahlen:</span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                  {formatCurrency(finalToPay + tipAmount)}
                </span>
              </div>
            </div>

            {/* Quick Change Calculator (Rückgeld-Rechner) */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Gegebenes Bargeld:
              </label>
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                {[10, 20, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setGivenAmount(amt)}
                    className={`pos-touch-btn py-2 rounded-xl text-xs font-bold border ${
                      givenAmount === amt
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {amt} €
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Anderer Betrag..."
                  value={givenAmount || ''}
                  onChange={(e) => setGivenAmount(parseFloat(e.target.value) || 0)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={() => setGivenAmount(finalToPay + tipAmount)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300"
                >
                  Passend
                </button>
              </div>

              {givenAmount > 0 && (
                <div className="mt-2 p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800/80 flex items-center justify-between text-sm">
                  <span className="font-bold text-emerald-300">Rückgeld:</span>
                  <span className="text-xl font-black font-mono text-emerald-400">
                    {formatCurrency(change)}
                  </span>
                </div>
              )}
            </div>

            {/* Trinkgeld Stepper */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Trinkgeld (Kellner):
              </label>
              <div className="flex items-center gap-1.5">
                {[0.5, 1.0, 2.0, 5.0].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipAmount(tipAmount === t ? 0 : t)}
                    className={`pos-touch-btn flex-1 py-1.5 rounded-xl text-xs font-bold border ${
                      tipAmount === t
                        ? 'bg-amber-500 text-black border-amber-400'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    +{t.toFixed(2)} €
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Zahlungsart:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'CASH', label: 'Bargeld', icon: Banknote },
                  { id: 'CARD_SUMUP', label: 'Kartenzahlung', icon: CreditCard },
                  { id: 'NON_PAID_STAFF', label: 'Personal / Bewirtung', icon: HeartHandshake },
                  { id: 'DISCOUNT', label: 'Rabatt', icon: Percent },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className={`pos-touch-btn flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition ${
                        paymentMethod === m.id
                          ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Print receipt toggle */}
            <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-300 flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-blue-400" />
                <span>Kassenbeleg drucken</span>
              </span>
              <input
                type="checkbox"
                checked={printReceipt}
                onChange={(e) => setPrintReceipt(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded bg-slate-800 border-slate-700"
              />
            </div>
          </div>

          {/* Checkout Submit Button */}
          <button
            disabled={isProcessing || (items.every((i) => i.selectedQty === 0) && totalReturnDeposit === 0)}
            onClick={handleCheckout}
            className={`pos-touch-btn mt-4 w-full py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-xl transition ${
              !isProcessing && (items.some((i) => i.selectedQty > 0) || totalReturnDeposit > 0)
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Check className="w-6 h-6" />
            <span>
              {isProcessing ? 'Wird verbucht...' : `Kassieren (${formatCurrency(finalToPay + tipAmount)})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
