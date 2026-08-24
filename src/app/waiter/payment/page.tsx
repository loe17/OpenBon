'use client';

import React, { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';
import { triggerHapticFeedback } from '@/lib/socket-client';
import { computeCheckout, CASH_QUICK_NOTES } from '@/lib/pricing';
import { PAYMENT_METHODS, isPaymentMethodAvailable } from '@/lib/payment/methods';
import { playPaymentSuccess, playPaymentFailure } from '@/lib/audio-feedback';
import type { DiningTableDTO, OrderDTO, PaymentMethod, EventConfigDTO } from '@/types/domain';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Ban,
  RefreshCw,
  Coins,
  Delete,
  PlusCircle,
  Receipt,
  DoorOpen,
  CreditCard,
} from 'lucide-react';

type Stage = 'SPLIT' | 'METHOD' | 'CASH' | 'CARD' | 'DONE';

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

interface CardCallbackResult {
  orderId: string;
  provider: string;
  status: 'success' | 'failed';
  authCode: string | null;
}

const DEPOSIT_UNITS = [1.0, 2.0, 0.5];

function WaiterPaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tableId = searchParams.get('tableId');

  const [stage, setStage] = useState<Stage>('SPLIT');
  const [config, setConfig] = useState<EventConfigDTO | null>(null);
  const [table, setTable] = useState<DiningTableDTO | null>(null);
  const [items, setItems] = useState<PayableItem[]>([]);

  const [returnDepositCount, setReturnDepositCount] = useState(0);
  const [depositUnit, setDepositUnit] = useState(1.0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [tipAmount, setTipAmount] = useState(0);
  const [surchargePercent, setSurchargePercent] = useState(0);
  const [surchargeFixed, setSurchargeFixed] = useState(0);
  const [surchargeReason, setSurchargeReason] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [nonPaidReason, setNonPaidReason] = useState('');
  const [keypadValue, setKeypadValue] = useState('');

  const [cardStatus, setCardStatus] = useState<'WAITING' | 'OK' | 'FAILED'>('WAITING');
  const [cardMessage, setCardMessage] = useState('Bitte Karte an das Terminal halten...');
  const [cardAuthCode, setCardAuthCode] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedInvoice, setCompletedInvoice] = useState<string | null>(null);
  const [completedPaymentId, setCompletedPaymentId] = useState<string | null>(null);
  const [receiptPrinted, setReceiptPrinted] = useState(false);
  const [guestFacingMode, setGuestFacingMode] = useState(false);
  const [guestFacingRotated, setGuestFacingRotated] = useState(true);
  const [requestId] = useState(() =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );

  const haptic = () => triggerHapticFeedback();

  /* ------------------------------------------------------------------ Daten */

  const fetchTableOrders = useCallback(async () => {
    if (!tableId) return;
    try {
      const res = await fetch(`/api/orders?tableId=${tableId}`);
      const orders = (await res.json()) as OrderDTO[];

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
              selectedQty: unpaid,
            });
          }
        }
      }
      setItems(payables);
    } catch (e) {
      console.error(e);
      setError('Die offenen Posten konnten nicht geladen werden.');
    }
  }, [tableId]);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((cfg) => {
        if (cfg) setConfig(cfg);
      })
      .catch(() => {});

    if (!tableId) return;
    fetch('/api/tables')
      .then((r) => r.json())
      .then((tables: DiningTableDTO[]) => {
        const found = tables.find((t) => t.id === tableId);
        if (found) setTable(found);
      })
      .catch(() => undefined);
    void fetchTableOrders();
  }, [tableId, fetchTableOrders]);

  /* -------------------------------------------------- Berechnung (Spec 5.1) */

  const checkout = useMemo(
    () =>
      computeCheckout({
        lines: items
          .filter((i) => i.selectedQty > 0)
          .map((i) => ({
            unitPrice: i.unitPrice,
            deposit: i.deposit,
            quantity: i.selectedQty,
            taxRate: i.taxRate,
          })),
        returnDepositAmount: returnDepositCount * depositUnit,
        discountAmount,
        surchargeFixed,
        surchargePercent,
        tipAmount,
        givenAmount: Number(keypadValue.replace(',', '.')) || 0,
      }),
    [
      items,
      returnDepositCount,
      depositUnit,
      discountAmount,
      surchargeFixed,
      surchargePercent,
      tipAmount,
      keypadValue,
    ]
  );

  const hasSelection = items.some((i) => i.selectedQty > 0) || returnDepositCount > 0;
  const givenAmount = Number(keypadValue.replace(',', '.')) || 0;
  const isCashSufficient = givenAmount >= checkout.amountDueWithTip;

  /* ----------------------------------------------------- Stufe 1: Auswahl */

  const toggleSelectAll = (select: boolean) => {
    haptic();
    setItems((prev) => prev.map((i) => ({ ...i, selectedQty: select ? i.totalUnpaidQty : 0 })));
  };

  const updateItemQty = (orderItemId: string, delta: number) => {
    haptic();
    setItems((prev) =>
      prev.map((i) =>
        i.orderItemId === orderItemId
          ? { ...i, selectedQty: Math.max(0, Math.min(i.totalUnpaidQty, i.selectedQty + delta)) }
          : i
      )
    );
  };

  const toggleItem = (orderItemId: string) => {
    haptic();
    setItems((prev) =>
      prev.map((i) =>
        i.orderItemId === orderItemId
          ? { ...i, selectedQty: i.selectedQty > 0 ? 0 : i.totalUnpaidQty }
          : i
      )
    );
  };

  /* ----------------------------------------------------- Stufe 3: Keypad */

  const pressKey = (key: string) => {
    haptic();
    setKeypadValue((prev) => {
      if (key === 'DEL') return prev.slice(0, -1);
      if (key === 'CLR') return '';
      if (key === ',') return prev.includes(',') ? prev : (prev || '0') + ',';
      if (prev.includes(',') && prev.split(',')[1].length >= 2) return prev;
      if (prev === '0') return key;
      return prev + key;
    });
  };

  const setNote = (value: number) => {
    haptic();
    setKeypadValue(value.toFixed(2).replace('.', ','));
  };

  const setExact = () => {
    haptic();
    setKeypadValue(checkout.amountDueWithTip.toFixed(2).replace('.', ','));
  };

  /* ----------------------------------------- Stufe 4: Kartenzahlung (Spec 4) */

  const startCardPayment = useCallback(
    async (method: PaymentMethod) => {
      setStage('CARD');
      setCardStatus('WAITING');
      setCardAuthCode(null);
      setCardMessage('Bitte Karte an das Terminal halten...');

      const amount = checkout.amountDueWithTip;
      const title = table ? `OrderBon Tisch ${table.label}` : 'OrderBon Direktverkauf';

      try {
        if (method === 'CARD_TERMINAL') {
          // ZVT-over-IP: Server spricht direkt mit dem Terminal
          setCardMessage('Terminal wird angesprochen (ZVT)...');
          const res = await fetch('/api/payments/card', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ method, amount, reference: requestId }),
          });
          const data = (await res.json()) as {
            success?: boolean;
            authCode?: string | null;
            error?: string | null;
          };
          if (data.success) {
            setCardStatus('OK');
            setCardAuthCode(data.authCode ?? null);
            setCardMessage('Zahlung autorisiert.');
            playPaymentSuccess();
          } else {
            setCardStatus('FAILED');
            setCardMessage(data.error || 'Die Zahlung wurde abgebrochen.');
            playPaymentFailure();
          }
          return;
        }

        // App-to-App Deep Link (SumUp / VR-Pay Me / Sparkasse S-POS)
        const params = new URLSearchParams({
          method,
          amount: String(amount),
          reference: requestId,
          title,
        });
        const res = await fetch(`/api/payments/card?${params.toString()}`);
        const data = (await res.json()) as { deepLink?: string; error?: string };

        if (!res.ok || !data.deepLink) {
          setCardStatus('FAILED');
          setCardMessage(data.error || 'Der Kartendienst ist nicht konfiguriert.');
          playPaymentFailure();
          return;
        }

        setCardMessage('Kartendienst wird geöffnet. Bitte Zahlung in der App abschließen...');
        try {
          sessionStorage.removeItem('openbon_card_result');
        } catch {
          /* ignorieren */
        }
        window.location.href = data.deepLink;
      } catch {
        setCardStatus('FAILED');
        setCardMessage('Der Kartendienst ist nicht erreichbar.');
        playPaymentFailure();
      }
    },
    [checkout.amountDueWithTip, requestId, table]
  );

  // Rückkehr aus der Karten-App auswerten (Spec 4.1 Callback)
  useEffect(() => {
    if (stage !== 'CARD') return;
    const check = () => {
      try {
        const raw = sessionStorage.getItem('openbon_card_result');
        if (!raw) return;
        const result = JSON.parse(raw) as CardCallbackResult;
        sessionStorage.removeItem('openbon_card_result');
        if (result.status === 'success') {
          setCardStatus('OK');
          setCardAuthCode(result.authCode);
          setCardMessage('Zahlung autorisiert.');
          playPaymentSuccess();
        } else {
          setCardStatus('FAILED');
          setCardMessage('Die Kartenzahlung wurde abgebrochen.');
          playPaymentFailure();
        }
      } catch {
        /* ignorieren */
      }
    };
    check();
    const timer = setInterval(check, 1000);
    return () => clearInterval(timer);
  }, [stage]);

  /* --------------------------------------------------------- Verbuchen */

  const submitPayment = async (opts: { printReceipt: boolean }) => {
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

    setIsProcessing(true);
    setError(null);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: tableId || null,
          waiterName: localStorage.getItem('pos_waiter_name') || 'Bedienung 1',
          deviceId: localStorage.getItem('pos_device_id'),
          paymentMethod,
          nonPaidReason: paymentMethod.startsWith('NON_PAID') ? nonPaidReason : null,
          cardAuthCode,
          returnDepositCount,
          returnDepositAmount: returnDepositCount * depositUnit,
          discountAmount,
          tipAmount,
          surchargeAmount: surchargeFixed,
          surchargePercent,
          surchargeReason: surchargeFixed + surchargePercent > 0 ? surchargeReason || 'Aufschlag' : null,
          givenAmount: paymentMethod === 'CASH' ? givenAmount : 0,
          printReceipt: opts.printReceipt,
          requestId,
          itemsToPay,
        }),
      });

      const data = (await res.json()) as { id?: string; invoiceNumber?: string; error?: string };
      if (!res.ok) {
        setError(data.error || 'Fehler bei der Zahlung');
        playPaymentFailure();
        return;
      }

      haptic();
      if (paymentMethod === 'CASH') playPaymentSuccess();
      setCompletedInvoice(data.invoiceNumber ?? null);
      setCompletedPaymentId(data.id ?? null);
      setReceiptPrinted(opts.printReceipt);
      setStage('DONE');
    } catch {
      setError('Verbindungsfehler beim Kassieren.');
      playPaymentFailure();
    } finally {
      setIsProcessing(false);
    }
  };

  /* ------------------------------------------------------------- Rendering */

  const stageIndex = { SPLIT: 1, METHOD: 2, CASH: 3, CARD: 3, DONE: 4 }[stage];

  const goBack = () => {
    haptic();
    if (stage === 'SPLIT') router.push('/waiter');
    else if (stage === 'METHOD') setStage('SPLIT');
    else if (stage === 'CASH' || stage === 'CARD') setStage('METHOD');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-white">
      {/* Kopfzeile mit Stufenanzeige */}
      <div className="p-3 sm:p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shadow-md shrink-0">
        <button
          onClick={goBack}
          disabled={stage === 'DONE'}
          className="touch-target flex items-center gap-2 text-slate-300 hover:text-white px-4 rounded-2xl bg-slate-800 border border-slate-700 text-sm font-bold transition active:scale-95 disabled:opacity-40"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Zurück</span>
        </button>

        <div className="text-center">
          <div className="font-black text-base sm:text-xl leading-tight">
            {table?.label || 'Direktverkauf'}
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            {[1, 2, 3, 4].map((s) => (
              <span
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  s === stageIndex ? 'w-7 bg-emerald-400' : s < stageIndex ? 'w-4 bg-emerald-800' : 'w-4 bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        {stage === 'SPLIT' ? (
          <button
            onClick={() => toggleSelectAll(items.some((i) => i.selectedQty < i.totalUnpaidQty))}
            className="touch-target px-4 text-xs font-bold text-blue-300 bg-blue-950 rounded-2xl border border-blue-800"
          >
            {items.every((i) => i.selectedQty === i.totalUnpaidQty) ? 'Alle ab' : 'Alle an'}
          </button>
        ) : (
          <div className="w-[72px]" />
        )}
      </div>

      {/* Spec 12: Gast-Sicht Widget im oberen Drittel des Mobilteils */}
      <div className="bg-slate-900/95 border-b border-slate-800 p-2.5 px-4 flex items-center justify-between shrink-0 shadow-inner">
        <button
          onClick={() => {
            haptic();
            setGuestFacingMode(!guestFacingMode);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
            guestFacingMode
              ? 'bg-blue-600 border-blue-400 text-white shadow-md'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
          }`}
        >
          <span>👀 Gast-Sicht</span>
          <span className="text-[10px] opacity-75">{guestFacingMode ? '(Aktiv)' : ''}</span>
        </button>

        {guestFacingMode ? (
          <button
            onClick={() => {
              haptic();
              setGuestFacingRotated(!guestFacingRotated);
            }}
            className="text-xs font-bold text-blue-300 bg-blue-950/80 border border-blue-800 px-2.5 py-1 rounded-lg"
          >
            🔄 180° {guestFacingRotated ? 'Gedreht' : 'Normal'}
          </button>
        ) : (
          <span className="text-xs text-slate-400 font-mono font-bold">
            Auswahl: {formatCurrency(checkout.amountDueWithTip)}
          </span>
        )}
      </div>

      {/* Gast-Display Banner im oberen Drittel (Richtung Gast) */}
      {guestFacingMode && (
        <div
          className={`p-4 bg-gradient-to-r from-blue-950 via-slate-900 to-blue-950 border-b-2 border-blue-500 transition-transform ${
            guestFacingRotated ? 'rotate-180 origin-center' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-300 block">
                Für den Gast • Zu zahlender Betrag
              </span>
              <span className="text-3xl font-mono font-black text-white">
                {formatCurrency(checkout.amountDueWithTip)}
              </span>
            </div>
            {checkout.tipAmount > 0 && (
              <span className="text-xs text-emerald-400 font-bold bg-emerald-950/80 px-2.5 py-1 rounded-xl border border-emerald-800">
                inkl. {formatCurrency(checkout.tipAmount)} Trinkgeld
              </span>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 py-2.5 bg-rose-950 border-b border-rose-800 text-rose-200 text-sm font-bold flex items-center gap-2 shrink-0">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ============================ STUFE 1: SPLIT ============================ */}
      {stage === 'SPLIT' && (
        <>
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                Zu zahlende Posten wählen (Rechnung teilen)
              </div>
              {/* Quick Split Buttons */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 text-[10px] font-bold">Split:</span>
                {[2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => {
                      haptic();
                      setItems((prev) =>
                        prev.map((i) => ({
                          ...i,
                          selectedQty: Math.max(1, Math.round(i.totalUnpaidQty / n)),
                        }))
                      );
                    }}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-blue-500 text-slate-300 font-mono font-bold text-[11px]"
                    title={`Auf ${n} Personen aufteilen`}
                  >
                    1/{n}
                  </button>
                ))}
              </div>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-12 text-slate-500 font-bold text-sm">
                Keine offenen Posten auf diesem Tisch.
              </div>
            ) : (
              items.map((item) => {
                const active = item.selectedQty > 0;
                return (
                  <div
                    key={item.orderItemId}
                    className={`p-4 rounded-3xl border-2 transition-all flex items-center justify-between ${
                      active
                        ? 'bg-slate-900 border-emerald-500 shadow-lg shadow-emerald-950/40'
                        : 'bg-slate-950 border-slate-800 opacity-60'
                    }`}
                  >
                    <button
                      onClick={() => toggleItem(item.orderItemId)}
                      className="flex-1 min-w-0 pr-3 text-left"
                    >
                      <div className="font-extrabold text-base text-white truncate">
                        {item.productName}
                        {item.variantName ? (
                          <span className="text-slate-400 font-bold"> · {item.variantName}</span>
                        ) : null}
                      </div>
                      <div className="text-xs text-slate-400 font-semibold mt-0.5">
                        <span className="font-mono">{formatCurrency(item.unitPrice + item.deposit)}</span>
                        {item.deposit > 0 && (
                          <span className="text-blue-400"> (inkl. {formatCurrency(item.deposit)} Pfand)</span>
                        )}
                        {' · offen: '}
                        <span className="font-mono">{item.totalUnpaidQty}</span>
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => updateItemQty(item.orderItemId, -1)}
                        className="touch-target w-12 h-12 flex items-center justify-center bg-slate-800 border border-slate-700 rounded-2xl text-slate-200 font-bold text-2xl active:scale-95"
                      >
                        −
                      </button>
                      <span className="w-10 text-center font-black font-mono text-xl text-emerald-400">
                        {item.selectedQty}
                      </span>
                      <button
                        onClick={() => updateItemQty(item.orderItemId, 1)}
                        className="touch-target w-12 h-12 flex items-center justify-center bg-blue-600 rounded-2xl text-white font-bold text-2xl active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {/* Rückpfand */}
            <div className="p-4 rounded-3xl bg-slate-900 border-2 border-blue-900/80">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-black text-blue-300">
                  <Coins className="w-5 h-5 text-blue-400" />
                  <span>Rückpfand (Leergut)</span>
                </div>
                <div className="text-base font-mono font-black text-amber-400">
                  −{formatCurrency(returnDepositCount * depositUnit)}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                  {DEPOSIT_UNITS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDepositUnit(d)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold font-mono ${
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
                    className="touch-target w-12 h-12 flex items-center justify-center bg-slate-800 border border-slate-700 rounded-2xl text-slate-200 font-bold text-2xl active:scale-95"
                  >
                    −
                  </button>
                  <span className="w-12 text-center font-black font-mono text-lg">
                    {returnDepositCount}x
                  </span>
                  <button
                    onClick={() => setReturnDepositCount(returnDepositCount + 1)}
                    className="touch-target w-12 h-12 flex items-center justify-center bg-blue-600 rounded-2xl text-white font-bold text-2xl active:scale-95"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Aufschlag / Rabatt */}
            <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-sm font-black text-purple-300 flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-purple-400" />
                  <span>Aufschlag & Rabatt</span>
                </span>
                {(surchargeFixed > 0 || surchargePercent > 0 || discountAmount > 0) && (
                  <button
                    onClick={() => {
                      setSurchargeFixed(0);
                      setSurchargePercent(0);
                      setSurchargeReason('');
                      setDiscountAmount(0);
                    }}
                    className="text-xs text-rose-400 font-bold"
                  >
                    Entfernen
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {[
                  { label: '+5 %', percent: 5, fixed: 0, discount: 0, reason: '5 % Aufschlag' },
                  { label: '+10 %', percent: 10, fixed: 0, discount: 0, reason: '10 % Aufschlag' },
                  { label: '+1,00 €', percent: 0, fixed: 1, discount: 0, reason: '1 € Pauschale' },
                  { label: '+2,00 €', percent: 0, fixed: 2, discount: 0, reason: '2 € Pauschale' },
                  { label: '−1,00 €', percent: 0, fixed: 0, discount: 1, reason: '' },
                ].map((sc) => {
                  const isActive =
                    (sc.percent > 0 && surchargePercent === sc.percent) ||
                    (sc.fixed > 0 && surchargeFixed === sc.fixed) ||
                    (sc.discount > 0 && discountAmount === sc.discount);
                  return (
                    <button
                      key={sc.label}
                      onClick={() => {
                        haptic();
                        if (isActive) {
                          setSurchargePercent(0);
                          setSurchargeFixed(0);
                          setDiscountAmount(0);
                          return;
                        }
                        setSurchargePercent(sc.percent);
                        setSurchargeFixed(sc.fixed);
                        setDiscountAmount(sc.discount);
                        setSurchargeReason(sc.reason);
                      }}
                      className={`touch-target rounded-2xl text-xs font-bold border transition ${
                        isActive
                          ? 'bg-purple-600 text-white border-purple-500'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {sc.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Leuchtbalken (Spec 5.1) */}
          <div className="shrink-0 border-t border-slate-800 bg-slate-900 p-3 sm:p-4 shadow-[0_-8px_24px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                Zwischenbetrag
              </span>
              <span
                className="font-mono font-extrabold text-emerald-400 leading-none"
                style={{ fontSize: '32px' }}
              >
                {formatCurrency(checkout.amountDue)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  toggleSelectAll(true);
                  setStage('METHOD');
                }}
                disabled={items.length === 0}
                className="pos-touch-btn h-16 rounded-2xl font-black text-sm sm:text-base bg-slate-800 border border-slate-700 text-slate-100 disabled:opacity-40"
              >
                Alles bezahlen
                <span className="block text-xs font-mono text-emerald-400 mt-0.5">
                  {formatCurrency(
                    items.reduce((s, i) => s + (i.unitPrice + i.deposit) * i.totalUnpaidQty, 0)
                  )}
                </span>
              </button>
              <button
                onClick={() => {
                  haptic();
                  setStage('METHOD');
                }}
                disabled={!hasSelection}
                className="pos-touch-btn h-16 rounded-2xl font-black text-base bg-emerald-600 text-white shadow-lg shadow-emerald-950/50 disabled:bg-slate-800 disabled:text-slate-500"
              >
                Weiter zur Zahlart
              </button>
            </div>
          </div>
        </>
      )}

      {/* =========================== STUFE 2: ZAHLART =========================== */}
      {stage === 'METHOD' && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col">
          <div className="text-center mb-5">
            <div className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              Zu zahlen
            </div>
            <div className="font-mono font-black text-emerald-400 text-5xl leading-tight mt-1">
              {formatCurrency(checkout.amountDueWithTip)}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl w-full mx-auto">
            {PAYMENT_METHODS.filter((m) => isPaymentMethodAvailable(m.id, config)).map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    haptic();
                    setPaymentMethod(m.id);
                    if (m.id === 'CASH') {
                      setKeypadValue('');
                      setStage('CASH');
                    } else if (m.isCard) {
                      void startCardPayment(m.id);
                    } else {
                      setStage('CASH');
                    }
                  }}
                  className="pos-touch-btn flex items-center gap-4 p-5 rounded-3xl border-2 text-left shadow-lg"
                  style={{
                    backgroundColor: `${m.color}22`,
                    borderColor: m.color,
                  }}
                >
                  <span
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: m.color }}
                  >
                    <Icon className="w-7 h-7 text-white" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-black text-lg text-white truncate">{m.label}</span>
                    <span className="block text-xs font-semibold text-slate-300">
                      {m.isCard ? 'Kartenzahlung' : m.isNonPaid ? 'Ohne Geldfluss' : 'Barzahlung'}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ====================== STUFE 3: BARGELD-RECHENCENTER ==================== */}
      {stage === 'CASH' && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto">
            <div className="rounded-3xl bg-slate-900 border border-slate-800 p-4 mb-4">
              <div className="flex justify-between text-sm font-bold text-slate-300 mb-1">
                <span>Zu zahlen</span>
                <span className="font-mono text-emerald-400 text-2xl">
                  {formatCurrency(checkout.amountDueWithTip)}
                </span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-slate-400">
                <span>Gegeben</span>
                <span className="font-mono text-lg text-white">
                  {givenAmount > 0 ? formatCurrency(givenAmount) : '—'}
                </span>
              </div>
            </div>

            {/* Rückgeld-Anzeige: 48px Bernstein (Spec 5.3) */}
            <div
              className={`rounded-3xl border-2 p-5 text-center mb-4 transition-all ${
                givenAmount > checkout.amountDueWithTip
                  ? 'bg-amber-950/50 border-amber-500'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="text-xs font-extrabold uppercase tracking-widest text-amber-300/80 mb-1">
                Rückgeld
              </div>
              <div
                className="font-mono font-extrabold leading-none"
                style={{
                  fontSize: '48px',
                  color: givenAmount > checkout.amountDueWithTip ? '#F59E0B' : '#334155',
                }}
              >
                {formatCurrency(checkout.changeAmount)}
              </div>
            </div>

            {/* Trinkgeld (Spec 6.9) */}
            <div className="rounded-3xl bg-slate-900 border border-slate-800 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                  Trinkgeld
                </span>
                <span className="font-mono font-bold text-amber-400">
                  {formatCurrency(tipAmount)}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[0, 0.5, 1, 2].map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      haptic();
                      setTipAmount(t);
                    }}
                    className={`touch-target rounded-2xl text-xs font-bold border ${
                      tipAmount === t
                        ? 'bg-amber-600 text-white border-amber-500'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {t === 0 ? 'kein' : `${t.toFixed(2).replace('.', ',')} €`}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod.startsWith('NON_PAID') && (
              <div className="mt-4">
                <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Grund (Pflicht)
                </label>
                <input
                  value={nonPaidReason}
                  onChange={(e) => setNonPaidReason(e.target.value)}
                  placeholder="z. B. Ehrengast, Musiker, Helfer"
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            )}
          </div>

          {/* Riesen-Keypad 4x3 (Spec 5.3) */}
          <div className="w-full lg:w-[440px] bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 p-4 flex flex-col gap-3 shrink-0">
            {paymentMethod === 'CASH' && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {CASH_QUICK_NOTES.map((n) => (
                    <button
                      key={n}
                      onClick={() => setNote(n)}
                      className="touch-target h-12 rounded-2xl bg-emerald-950 border border-emerald-800 text-emerald-300 font-mono font-bold text-sm"
                    >
                      {n} €
                    </button>
                  ))}
                  <button
                    onClick={setExact}
                    className="touch-target h-12 rounded-2xl bg-emerald-600 text-white font-bold text-sm"
                  >
                    Passend
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
                    <button key={k} onClick={() => pressKey(k)} className="keypad-key">
                      {k}
                    </button>
                  ))}
                  <button onClick={() => pressKey(',')} className="keypad-key">
                    ,
                  </button>
                  <button onClick={() => pressKey('0')} className="keypad-key">
                    0
                  </button>
                  <button
                    onClick={() => pressKey('DEL')}
                    onDoubleClick={() => pressKey('CLR')}
                    className="keypad-key !bg-slate-700"
                  >
                    <Delete className="w-7 h-7" />
                  </button>
                </div>
              </>
            )}

            <button
              onClick={() => void submitPayment({ printReceipt: false })}
              disabled={
                isProcessing ||
                (paymentMethod === 'CASH' && givenAmount > 0 && !isCashSufficient) ||
                (paymentMethod.startsWith('NON_PAID') && !nonPaidReason.trim())
              }
              className="pos-touch-btn mt-auto h-20 rounded-3xl font-black text-xl flex items-center justify-center gap-3 bg-emerald-600 text-white shadow-2xl shadow-emerald-950/60 disabled:bg-slate-800 disabled:text-slate-500"
            >
              {isProcessing ? (
                <RefreshCw className="w-6 h-6 animate-spin" />
              ) : (
                <Check className="w-7 h-7" />
              )}
              <span>Kassieren {formatCurrency(checkout.amountDueWithTip)}</span>
            </button>
          </div>
        </div>
      )}

      {/* ==================== STUFE 3b: KARTENZAHLUNGS-MONITOR =================== */}
      {stage === 'CARD' && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
          <div
            className={`relative w-36 h-36 rounded-full flex items-center justify-center ${
              cardStatus === 'WAITING'
                ? 'status-ring text-blue-400'
                : cardStatus === 'OK'
                  ? 'text-emerald-400'
                  : 'text-rose-400'
            }`}
            style={{
              backgroundColor:
                cardStatus === 'OK'
                  ? 'rgba(16,185,129,0.12)'
                  : cardStatus === 'FAILED'
                    ? 'rgba(239,68,68,0.12)'
                    : 'rgba(59,130,246,0.12)',
            }}
          >
            {cardStatus === 'OK' ? (
              <CheckCircle2 className="w-16 h-16" />
            ) : cardStatus === 'FAILED' ? (
              <AlertTriangle className="w-16 h-16" />
            ) : (
              <CreditCard className="w-16 h-16" />
            )}
          </div>

          <div className="text-center">
            <div className="font-mono font-black text-4xl text-white">
              {formatCurrency(checkout.amountDueWithTip)}
            </div>
            <div className="text-base font-bold text-slate-300 mt-2 max-w-md">{cardMessage}</div>
            {cardAuthCode && (
              <div className="font-mono text-sm text-emerald-400 mt-1">
                Autorisierung: {cardAuthCode}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
            {cardStatus === 'OK' && (
              <button
                onClick={() => void submitPayment({ printReceipt: false })}
                disabled={isProcessing}
                className="pos-touch-btn flex-1 h-16 rounded-2xl bg-emerald-600 text-white font-black text-base"
              >
                Zahlung verbuchen
              </button>
            )}
            {cardStatus === 'FAILED' && (
              <button
                onClick={() => void startCardPayment(paymentMethod)}
                className="pos-touch-btn flex-1 h-16 rounded-2xl bg-blue-600 text-white font-black text-base"
              >
                Erneut versuchen
              </button>
            )}
            <button
              onClick={() => {
                haptic();
                setStage('METHOD');
              }}
              className="pos-touch-btn flex-1 h-16 rounded-2xl bg-slate-800 border border-slate-700 text-slate-200 font-bold text-base"
            >
              Andere Zahlart
            </button>
          </div>
        </div>
      )}

      {/* ============================ STUFE 4: ABSCHLUSS ======================== */}
      {stage === 'DONE' && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-7">
          <div className="w-28 h-28 rounded-full bg-emerald-950 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-16 h-16" />
          </div>
          <div className="text-center">
            <div className="text-3xl font-black text-white">Zahlung verbucht</div>
            {completedInvoice && (
              <div className="font-mono text-sm text-slate-400 mt-1.5">{completedInvoice}</div>
            )}
            {checkout.changeAmount > 0 && (
              <div className="mt-4">
                <div className="text-xs font-extrabold uppercase tracking-widest text-amber-300/80">
                  Rückgeld
                </div>
                <div
                  className="font-mono font-extrabold leading-none"
                  style={{ fontSize: '48px', color: '#F59E0B' }}
                >
                  {formatCurrency(checkout.changeAmount)}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-3xl">
            <button
              disabled={!completedPaymentId || receiptPrinted}
              onClick={() => {
                haptic();
                if (!completedPaymentId) return;
                setReceiptPrinted(true);
                void fetch(`/api/payments/${completedPaymentId}/receipt`, { method: 'POST' }).catch(
                  () => setReceiptPrinted(false)
                );
              }}
              className="pos-touch-btn h-20 rounded-3xl bg-blue-600 text-white font-black flex flex-col items-center justify-center gap-1 disabled:bg-slate-800 disabled:text-slate-500"
            >
              <Printer className="w-6 h-6" />
              <span className="text-sm">{receiptPrinted ? 'Beleg gedruckt' : 'Beleg drucken'}</span>
            </button>
            <button
              onClick={() => {
                haptic();
                router.push('/waiter');
              }}
              className="pos-touch-btn h-20 rounded-3xl bg-slate-800 border border-slate-700 text-slate-200 font-black flex flex-col items-center justify-center gap-1"
            >
              <Ban className="w-6 h-6" />
              <span className="text-sm">Kein Beleg</span>
            </button>
            <button
              onClick={() => {
                haptic();
                router.push('/waiter');
              }}
              className="pos-touch-btn h-20 rounded-3xl bg-emerald-600 text-white font-black flex flex-col items-center justify-center gap-1"
            >
              <DoorOpen className="w-6 h-6" />
              <span className="text-sm">Tisch schließen</span>
            </button>
          </div>

          {items.some((i) => i.selectedQty < i.totalUnpaidQty) && (
            <button
              onClick={() => {
                haptic();
                setCompletedInvoice(null);
                setKeypadValue('');
                setTipAmount(0);
                setReturnDepositCount(0);
                setStage('SPLIT');
                void fetchTableOrders();
              }}
              className="pos-touch-btn px-6 h-14 rounded-2xl bg-slate-900 border border-slate-700 text-slate-300 font-bold text-sm flex items-center gap-2"
            >
              <Receipt className="w-5 h-5" />
              <span>Nächsten Gast am selben Tisch kassieren</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function WaiterPaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Lade Kassiermaske...</span>
        </div>
      }
    >
      <WaiterPaymentContent />
    </Suspense>
  );
}
