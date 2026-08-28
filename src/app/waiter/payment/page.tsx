'use client';

import React, { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatCurrency, generateIdempotencyKey } from '@/lib/utils';
import { triggerHapticFeedback } from '@/lib/socket-client';
import { computeCheckout } from '@/lib/pricing';
import { PAYMENT_METHODS, isPaymentMethodAvailable, getActiveCardPaymentMethod } from '@/lib/payment/methods';
import { playPaymentSuccess, playPaymentFailure } from '@/lib/audio-feedback';
import { ChangeCalculator } from '@/components/ui/change-calculator';
import PaymentService from '@/lib/payment/payment-service';
import type { DiningTableDTO, OrderDTO, PaymentMethod, EventConfigDTO } from '@/types/domain';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Ban,
  RefreshCw,
  Coins,
  PlusCircle,
  Receipt,
  CreditCard,
  DoorOpen,
  Eye,
  RotateCcw,
  History,
  Volume2,
  VolumeX,
  QrCode,
  Radio,
  Smartphone,
  X,
} from 'lucide-react';
import { isAudioMuted, setAudioMuted } from '@/lib/socket-client';
import { sendWithOutboxFallback } from '@/lib/offline/outbox';
import { WaiterOrderHistoryModal } from '@/components/waiter/waiter-order-history-modal';

import StationGate from '@/components/auth/station-gate';
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

function extractPayableItems(orders: any[]): PayableItem[] {
  const result: PayableItem[] = [];
  for (const order of orders) {
    if (!order.items) continue;
    for (const item of order.items) {
      if (item.isCancelled) continue;
      const unpaid = (item.quantity || 0) - (item.paidQuantity || 0);
      if (unpaid > 0) {
        result.push({
          orderItemId: item.id,
          productName: item.productName || item.name || 'Artikel',
          variantName: item.variantName || item.variant?.name || null,
          unitPrice: item.unitPrice || 0,
          deposit: item.deposit || 0,
          taxRate: item.taxRate || 19,
          totalUnpaidQty: unpaid,
          selectedQty: unpaid,
        });
      }
    }
  }
  return result;
}

function WaiterPaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tableId = searchParams.get('tableId');

  const [stage, setStage] = useState<Stage>('SPLIT');
  const [config, setConfig] = useState<EventConfigDTO | null>(null);
  const [table, setTable] = useState<DiningTableDTO | null>(null);
  const [items, setItems] = useState<PayableItem[]>([]);

  const [returnDeposits, setReturnDeposits] = useState<Record<number, number>>({
    0.5: 0,
    1.0: 0,
    2.0: 0,
    3.0: 0,
    5.0: 0,
  });

  const updateDepositQty = (unit: number, delta: number) => {
    haptic();
    setReturnDeposits((prev) => ({
      ...prev,
      [unit]: Math.max(0, (prev[unit] || 0) + delta),
    }));
  };

  const totalReturnDeposit = useMemo(() => {
    return Object.entries(returnDeposits).reduce(
      (sum, [unit, count]) => sum + parseFloat(unit) * count,
      0
    );
  }, [returnDeposits]);

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
  const [completedDigitalReceiptUrl, setCompletedDigitalReceiptUrl] = useState<string | null>(null);
  const [completedDigitalReceiptCode, setCompletedDigitalReceiptCode] = useState<string | null>(null);
  const [showEBonModal, setShowEBonModal] = useState(false);
  const [eBonQrDataUrl, setEBonQrDataUrl] = useState<string | null>(null);
  const [eBonMode, setEBonMode] = useState<'QR' | 'NFC'>('QR');
  const [nfcStatus, setNfcStatus] = useState<'IDLE' | 'WRITING' | 'SUCCESS' | 'ERROR' | 'UNSUPPORTED'>('IDLE');
  const [nfcMessage, setNfcMessage] = useState<string>('');
  const [guestFacingMode, setGuestFacingMode] = useState(false);
  const [guestFacingRotated, setGuestFacingRotated] = useState(true);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [soundMuted, setSoundMuted] = useState(true);
  const [waiterName, setWaiterName] = useState('Bedienung');
  // WICHTIG: Der Idempotenz-Schluessel gilt fuer GENAU EINEN Kassiervorgang.
  // Bleibt er ueber mehrere Zahlungen gleich, erkennt der Server die zweite
  // Zahlung als Wiederholung, bucht nichts und liefert den alten Beleg zurueck -
  // genau das liess das Teilen einer Rechnung wirkungslos erscheinen.
  const [requestId, setRequestId] = useState(() => generateIdempotencyKey('pay'));

  const haptic = () => triggerHapticFeedback();

  /* ------------------------------------------------------------------ Daten */

  const fetchTableOrders = useCallback(async () => {
    if (!tableId) return;
    try {
      const res = await fetch(`/api/orders?tableId=${tableId}`);
      if (!res.ok) return;
      const orders = await res.json();
      const openOrders = (orders as any[]).filter(
        (o) => o.status !== 'PAID' && o.status !== 'CANCELLED'
      );
      const payables = extractPayableItems(openOrders);
      setItems(payables);
    } catch {
      /* Leise ignorieren */
    }
  }, [tableId]);

  useEffect(() => {
    fetch('/api/config/public')
      .then((r) => r.json())
      .then((cfg) => {
        if (cfg && !cfg.error) {
          setConfig(cfg);
          // Die Kundenanzeige ist eine Einstellungssache: ist sie deaktiviert,
          // darf sie sich auch nicht ueber den Knopf einschalten lassen.
          setGuestFacingMode(Boolean(cfg.enableGuestFacingDisplay));
        }
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
        returnDepositAmount: totalReturnDeposit,
        givenAmount: Number(keypadValue.replace(',', '.')) || 0,
      }),
    [items, totalReturnDeposit, keypadValue]
  );

  const hasSelection = items.some((i) => i.selectedQty > 0) || totalReturnDeposit > 0;
  const givenAmount = Number(keypadValue.replace(',', '.')) || 0;
  const isCashSufficient = givenAmount >= checkout.amountDueWithTip;

  /* ----------------------------------------------------- Stufe 1: Auswahl */

  /**
   * Spec 5.1: "1/n" teilt die Rechnung auf n Personen auf.
   *
   * Die bisherige Umsetzung rechnete Math.ceil(Menge / n) je Position. Bei einem
   * Tisch mit lauter Einzelstuecken ergab das ueberall 1 – "1/2" markierte also
   * genauso alles wie "Alles". Stattdessen wird jetzt nach WERT aufgeteilt:
   * es werden so lange Einheiten ausgewaehlt, bis der Zielanteil erreicht ist.
   */
  const applyValueSplit = (parts: number) => {
    haptic();
    const openTotal = items.reduce(
      (sum, i) => sum + (i.unitPrice + i.deposit) * i.totalUnpaidQty,
      0
    );
    if (openTotal <= 0 || parts < 2) return;

    const target = openTotal / parts;

    // Teuerste Positionen zuerst, damit der Zielwert moeglichst genau getroffen wird
    const order = [...items].sort(
      (a, b) => b.unitPrice + b.deposit - (a.unitPrice + a.deposit)
    );

    const selected = new Map<string, number>();
    let acc = 0;

    for (const item of order) {
      const unitValue = item.unitPrice + item.deposit;
      let take = 0;
      while (take < item.totalUnpaidQty) {
        // Einheit nur nehmen, wenn sie den Zielwert nicht deutlicher ueberschreitet,
        // als sie ihn unterschreiten wuerde
        const withUnit = acc + unitValue;
        if (withUnit <= target || target - acc > withUnit - target) {
          acc = withUnit;
          take++;
        } else {
          break;
        }
      }
      if (take > 0) selected.set(item.orderItemId, take);
    }

    // Mindestens eine Position auswaehlen, damit der Knopf nie folgenlos bleibt
    if (selected.size === 0 && items.length > 0) {
      const cheapest = [...items].sort(
        (a, b) => a.unitPrice + a.deposit - (b.unitPrice + b.deposit)
      )[0];
      selected.set(cheapest.orderItemId, 1);
    }

    setItems((prev) =>
      prev.map((i) => ({ ...i, selectedQty: selected.get(i.orderItemId) ?? 0 }))
    );
  };

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

  /* ----------------------------------------- Stufe 4: Kartenzahlung (Spec 4) */

  const startCardPayment = useCallback(
    async (method: PaymentMethod | 'CARD') => {
      setStage('CARD');
      setCardStatus('WAITING');
      setCardAuthCode(null);
      setCardMessage('Kartenzahlung wird initialisiert...');

      const effectiveMethod = (method === 'CARD' ? getActiveCardPaymentMethod(config) : method) || 'CARD_SUMUP';
      setPaymentMethod(effectiveMethod);

      const amount = checkout.amountDueWithTip;
      const title = table ? `OrderBon Tisch ${table.label}` : 'OrderBon Direktverkauf';

      try {
        const init = await PaymentService.initiate({
          provider: effectiveMethod,
          amount,
          tableId: table?.id,
          title,
          context: {
            requestId,
            amountDue: checkout.amountDue,
            returnDeposit: checkout.returnDeposit,
            selectedItems: items.filter((i) => i.selectedQty > 0),
          },
        });

        if (init.kind === 'sync') {
          const syncResult = init.result as any;
          if (syncResult?.status === 'SUCCESS') {
            setCardStatus('OK');
            setCardAuthCode(syncResult.authCode ?? null);
            setCardMessage('Zahlung autorisiert.');
            playPaymentSuccess();
          } else {
            setCardStatus('FAILED');
            setCardMessage(syncResult?.errorMessage || 'Die Zahlung wurde abgebrochen.');
            playPaymentFailure();
          }
        } else if (init.kind === 'qr' && init.url) {
          setCardMessage('Bitte QR-Code scannen oder am Terminal autorisieren...');
        } else {
          setCardMessage('Kartendienst wird geöffnet. Bitte Zahlung in der App abschließen...');
        }
      } catch (err) {
        setCardStatus('FAILED');
        setCardMessage(err instanceof Error ? err.message : 'Der Kartendienst ist nicht erreichbar.');
        playPaymentFailure();
      }
    },
    [checkout, requestId, table, items]
  );

  // Rückkehr aus der Karten-App auswerten (Spec 4.1 Callback)
  // N2.1: Nur noch serverseitig signaturverifizierte Rückkehr schaltet die
  // Verbuchung frei. Unverifizierte Rückkehr (alte Links, Manipulation oder
  // verpasste Signatur) erzeugt eine klare Meldung statt "OK".
  useEffect(() => {
    if (stage !== 'CARD') return;
    const check = () => {
      try {
        const raw = sessionStorage.getItem('openbon_card_result');
        if (!raw) return;
        const result = JSON.parse(raw) as CardCallbackResult & { verified?: boolean; unverifiedNote?: string };
        sessionStorage.removeItem('openbon_card_result');

        if (result.status === 'success' && result.verified === true) {
          setCardStatus('OK');
          setCardAuthCode(result.authCode);
          setCardMessage('Zahlung autorisiert.');
          playPaymentSuccess();
        } else if (result.status === 'success' && result.verified !== true) {
          setCardStatus('FAILED');
          setCardMessage(
            result.unverifiedNote ||
              'Rückkehr der Karten-App war nicht serverseitig signiert - bitte am Terminal prüfen und die Zahlung erneut starten.'
          );
          playPaymentFailure();
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
      const res = await sendWithOutboxFallback(
        'PAYMENT',
        '/api/payments',
        {
          tableId: tableId || null,
          waiterName: localStorage.getItem('pos_waiter_name') || 'Bedienung 1',
          deviceId: localStorage.getItem('pos_device_id'),
          paymentMethod,
          nonPaidReason: paymentMethod.startsWith('NON_PAID') ? nonPaidReason : null,
          cardAuthCode,
          returnDepositCount: Object.values(returnDeposits).reduce((a, b) => a + b, 0),
          returnDepositAmount: totalReturnDeposit,
          givenAmount: paymentMethod === 'CASH' ? givenAmount : 0,
          printReceipt: opts.printReceipt,
          requestId,
          idempotencyKey: requestId,
          itemsToPay,
        }
      );

      // N3.1: Zahlungsversuche laufen über die Offline-Outbox. Gelingt der
      // Versand nicht sofort, ist der Vorgang sicher eingereiht und wird
      // automatisch nachgesendet - inklusive Idempotenz gegen Doppelbuchung.
      if (!res.success) {
        setError(res.error || 'Fehler bei der Zahlung');
        playPaymentFailure();
        return;
      }

      if (res.pending || !res.data) {
        playPaymentFailure();
        setError(
          res.error ||
            'Verbindung unterbrochen – Zahlung wurde LOKAL gesichert und wird automatisch nachgesendet. Bitte Verbindung wiederherstellen und Vorgang im Sync-Hinweis beobachten.'
        );
        // Neuer Idempotenzschlüssel für den nächsten Versuch, damit keine
        // Wiedereinspielung mit verändertem Warenkorb kollidiert.
        setRequestId(generateIdempotencyKey('pay'));
        return;
      }

      const data = res.data as {
        id?: string;
        invoiceNumber?: string;
        digitalReceiptUrl?: string;
        digitalReceiptCode?: string;
        error?: string;
      };
      haptic();
      if (paymentMethod === 'CASH') playPaymentSuccess();
      // Neuer Schluessel fuer den naechsten Teilbetrag / naechsten Gast
      setRequestId(generateIdempotencyKey('pay'));
      setCompletedInvoice(data.invoiceNumber ?? null);
      setCompletedPaymentId(data.id ?? null);
      setReceiptPrinted(opts.printReceipt);
      setCompletedDigitalReceiptUrl(data.digitalReceiptUrl ?? null);
      setCompletedDigitalReceiptCode(data.digitalReceiptCode ?? null);
      if (data.digitalReceiptUrl) {
        QRCode.toDataURL(data.digitalReceiptUrl, { width: 256, margin: 1 })
          .then((url) => setEBonQrDataUrl(url))
          .catch(() => {});
      } else {
        setEBonQrDataUrl(null);
      }
      setStage('DONE');
    } catch {
      setError('Verbindungsfehler beim Kassieren.');
      playPaymentFailure();
    } finally {
      setIsProcessing(false);
    }
  };

  /* ------------------------------------------------------------- E-Bon & NFC */

  const isInternetActive = Boolean(config?.enableDigitalReceipt || config?.enableDigitalReceiptQr);
  const isNfcActive = Boolean(config?.enableNfc && config?.enableNfcWaiter !== false);
  const isEBonAvailable = isInternetActive || isNfcActive;

  const startNfcBeam = async (url?: string) => {
    const targetUrl = url || completedDigitalReceiptUrl;
    if (!targetUrl) return;
    haptic();

    if (typeof window === 'undefined' || !('NDEFReader' in window)) {
      setNfcStatus('UNSUPPORTED');
      setNfcMessage(
        'Web NFC wird auf diesem Gerät/Browser nicht direkt unterstützt (z. B. iOS). Bitte auf Android-Chrome mit NFC nutzen oder den QR-Code verwenden.'
      );
      return;
    }

    try {
      setNfcStatus('WRITING');
      setNfcMessage('Halte die Rückseite deines Smartphones jetzt an das Kunden-Smartphone...');
      const ndef = new (window as any).NDEFReader();
      await ndef.write({
        records: [{ recordType: 'url', data: targetUrl }],
      });
      setNfcStatus('SUCCESS');
      setNfcMessage('E-Bon erfolgreich per NFC übertragen!');
      triggerHapticFeedback();
      playPaymentSuccess();
    } catch (err: any) {
      console.error('NFC Write Error:', err);
      setNfcStatus('ERROR');
      setNfcMessage(err?.message ? `NFC-Fehler: ${err.message}` : 'Übertragung fehlgeschlagen. Bitte erneut versuchen.');
      playPaymentFailure();
    }
  };

  const openEBonDialog = () => {
    haptic();
    if (isInternetActive && isNfcActive) {
      setEBonMode('QR');
      setNfcStatus('IDLE');
      setShowEBonModal(true);
    } else if (isNfcActive) {
      setEBonMode('NFC');
      setShowEBonModal(true);
      void startNfcBeam();
    } else if (isInternetActive) {
      setEBonMode('QR');
      setShowEBonModal(true);
    }
  };

  /* ------------------------------------------------------------- Rendering */

  const guestFacingAllowed = Boolean(config?.enableGuestFacingDisplay);

  const stageIndex = { SPLIT: 1, METHOD: 2, CASH: 3, CARD: 3, DONE: 4 }[stage];

  const goBack = () => {
    haptic();
    if (stage === 'SPLIT') router.push('/waiter');
    else if (stage === 'METHOD') setStage('SPLIT');
    else if (stage === 'CASH' || stage === 'CARD') setStage('METHOD');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-white">
      {/* ===================== STICKY TOP CONTAINER (Permanent ganz oben über der Tischnummer fixiert) ===================== */}
      <div className="sticky top-0 z-50 shadow-2xl bg-slate-950 shrink-0">
        {/* XXL Gast-Display Banner (Ganz oben) */}
        {guestFacingAllowed && guestFacingMode && (
          <div
            className={`p-5 sm:p-7 bg-gradient-to-br from-blue-950 via-slate-950 to-blue-950 border-b-4 border-blue-500 shadow-2xl transition-transform ${
              guestFacingRotated ? 'rotate-180 origin-center' : ''
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-center sm:text-left">
              <div>
                <span className="text-xs font-mono font-extrabold uppercase tracking-widest text-blue-300 block mb-1">
                  FÜR DEN GAST • ZU ZAHLENDER BETRAG
                </span>
                <span className="text-5xl sm:text-6xl font-mono font-black text-white tracking-tight drop-shadow-md">
                  {formatCurrency(checkout.amountDueWithTip)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Gast-Sicht Widget Steuerung
            Nur sichtbar, wenn die Kundenanzeige in den Einstellungen freigegeben
            ist - sonst bliebe ein Knopf stehen, der nichts bewirken darf. */}
        <div className="bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 p-2 px-4 flex items-center justify-between">
          {guestFacingAllowed ? (
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
            <Eye className="w-4 h-4" />
            <span>Gast-Sicht</span>
            <span className="text-[10px] opacity-75">{guestFacingMode ? '(Aktiv)' : ''}</span>
          </button>
          ) : (
            <span className="text-xs text-slate-500 font-bold">Kassieren</span>
          )}

          {guestFacingAllowed && guestFacingMode ? (
            <button
              onClick={() => {
                haptic();
                setGuestFacingRotated(!guestFacingRotated);
              }}
              className="text-xs font-bold text-blue-300 bg-blue-950/80 border border-blue-800 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow"
            >
              <RotateCcw className="w-4 h-4" />
              <span>180°</span>
              <span>{guestFacingRotated ? 'Gedreht (Zum Gast)' : 'Normal (Zu mir)'}</span>
            </button>
          ) : (
            <span className="text-xs text-slate-400 font-mono font-bold">
              Auswahl: {formatCurrency(checkout.amountDueWithTip)}
            </span>
          )}
        </div>

        {/* Kopfzeile mit Tischnummer & Stufenanzeige */}
        <div className="p-2.5 sm:p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-1.5">
            <button
              onClick={goBack}
              disabled={stage === 'DONE'}
              className="touch-target flex items-center gap-2 text-slate-300 hover:text-white px-3.5 py-1.5 rounded-2xl bg-slate-800 border border-slate-700 text-sm font-bold transition active:scale-95 disabled:opacity-40"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Zurück</span>
            </button>

            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="p-2 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl text-slate-300 hover:text-white flex items-center gap-1 text-xs font-bold transition active:scale-95 shadow"
              title="Bestellverlauf anzeigen"
            >
              <History className="w-4 h-4 text-blue-400" />
              <span className="hidden md:inline">Verlauf</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const next = !soundMuted;
                setSoundMuted(next);
                setAudioMuted(next);
              }}
              className={`p-2 rounded-2xl border transition active:scale-95 ${
                soundMuted
                  ? 'bg-rose-950/50 border-rose-800 text-rose-400'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title={soundMuted ? 'Ton stumm' : 'Ton aktiv'}
            >
              {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          <div className="text-center">
            <div className="font-black text-base sm:text-lg leading-tight">
              {table?.label || 'Direktverkauf'}
            </div>
            <div className="flex items-center justify-center gap-1.5 mt-0.5">
              {[1, 2, 3, 4].map((s) => (
                <span
                  key={s}
                  className={`h-1.5 rounded-full transition-all ${
                    s === stageIndex ? 'w-6 bg-emerald-400' : s < stageIndex ? 'w-3 bg-emerald-800' : 'w-3 bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>

          {stage === 'SPLIT' ? (
            <button
              onClick={() => toggleSelectAll(items.some((i) => i.selectedQty < i.totalUnpaidQty))}
              className="touch-target px-3.5 py-1.5 text-xs font-bold text-blue-300 bg-blue-950 rounded-2xl border border-blue-800"
            >
              {items.every((i) => i.selectedQty === i.totalUnpaidQty) ? 'Alle ab' : 'Alle an'}
            </button>
          ) : (
            <div className="w-[72px]" />
          )}
        </div>
      </div>

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
              <div className="flex items-center gap-1.5 text-xs flex-wrap">
                <button
                  onClick={() => toggleSelectAll(true)}
                  className="px-2.5 py-1 rounded-xl bg-blue-600/30 border border-blue-500/50 hover:bg-blue-600 text-white font-bold text-[11px] transition"
                >
                  Alles
                </button>
                {[2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => applyValueSplit(n)}
                    className="px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 hover:border-blue-500 text-slate-300 font-mono font-bold text-[11px] transition"
                    title={`Rechnung wertmäßig auf ${n} Personen aufteilen`}
                  >
                    1/{n}
                  </button>
                ))}
                <button
                  onClick={() => toggleSelectAll(false)}
                  className="px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 hover:bg-rose-950 text-slate-400 font-bold text-[11px] transition"
                >
                  Keine
                </button>
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

            {/* Rückpfand Matrix (Mehrere Pfandwerte gleichzeitig, z. B. 1x 1€, 2x 2€) */}
            <div className="p-4 rounded-3xl bg-slate-900 border-2 border-blue-900/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-black text-blue-300">
                  <Coins className="w-5 h-5 text-blue-400" />
                  <span>Rückpfand (Leergut-Gutschrift)</span>
                </div>
                <div className="text-base font-mono font-black text-amber-400">
                  {totalReturnDeposit > 0 ? `−${formatCurrency(totalReturnDeposit)}` : '0,00 €'}
                </div>
              </div>

              {/* Grid von Pfandwerten mit Plus/Minus Zählern */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { unit: 1.0, label: '1,00 € (Glas/Becher)' },
                  { unit: 2.0, label: '2,00 € (Krug/Teller)' },
                  { unit: 0.5, label: '0,50 € (Flasche)' },
                ].map(({ unit, label }) => {
                  const count = returnDeposits[unit] || 0;
                  return (
                    <div
                      key={unit}
                      className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between shadow-sm"
                    >
                      <div className="min-w-0 pr-1">
                        <div className="text-xs font-black text-slate-200">{unit.toFixed(2)} €</div>
                        <div className="text-[10px] text-slate-500 truncate">{label}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateDepositQty(unit, -1)}
                          disabled={count === 0}
                          className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 disabled:opacity-30 border border-slate-700 rounded-xl text-slate-200 font-bold text-lg active:scale-95 transition"
                        >
                          −
                        </button>
                        <span className="w-7 text-center font-black font-mono text-sm text-blue-400">
                          {count}x
                        </span>
                        <button
                          type="button"
                          onClick={() => updateDepositQty(unit, 1)}
                          className="w-8 h-8 flex items-center justify-center bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-bold text-lg active:scale-95 transition shadow"
                        >
                          +
                        </button>
                      </div>
                    </div>
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
                className="pos-touch-btn h-16 rounded-2xl font-black text-base bg-emerald-500 hover:bg-emerald-400 text-slate-950 dark:text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 shadow-lg shadow-emerald-950/50 disabled:bg-slate-800 disabled:text-slate-500"
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
            {PAYMENT_METHODS.filter((m) => {
              if (m.id.startsWith('CARD_')) return false; // Nur der einheitliche "Kartenzahlung"-Button
              return isPaymentMethodAvailable(m.id, config);
            }).map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    haptic();
                    if (m.id === 'CASH') {
                      setPaymentMethod('CASH');
                      setKeypadValue('');
                      setStage('CASH');
                    } else if (m.isCard) {
                      void startCardPayment('CARD');
                    } else {
                      setPaymentMethod(m.id);
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
                      {m.isCard ? 'Kartenzahlung (Terminal / App)' : m.isNonPaid ? 'Ohne Geldfluss' : 'Barzahlung'}
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
        <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto max-w-2xl w-full mx-auto space-y-4">
          {/* Stückelungs-Rechner mit Scheinen (5€–200€), Münzen (1ct–2€) und Ziffernblock */}
          {paymentMethod === 'CASH' && (
            <ChangeCalculator
              amountDue={checkout.amountDueWithTip}
              givenAmount={givenAmount}
              onGivenChange={(val) => {
                setKeypadValue(val > 0 ? val.toFixed(2).replace('.', ',') : '');
              }}
              defaultExpanded={true}
            />
          )}

          {paymentMethod.startsWith('NON_PAID') && (
            <div className="rounded-3xl bg-slate-900 border border-slate-800 p-5 space-y-3">
              <div className="flex justify-between text-sm font-bold text-slate-300">
                <span>Zu buchender Betrag</span>
                <span className="font-mono text-amber-400 text-2xl">
                  {formatCurrency(checkout.amountDueWithTip)}
                </span>
              </div>
              <div>
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
            </div>
          )}

          {/* Zentraler Kassieren-Button */}
          <button
            onClick={() => void submitPayment({ printReceipt: false })}
            disabled={
              isProcessing ||
              (paymentMethod === 'CASH' && givenAmount > 0 && !isCashSufficient) ||
              (paymentMethod.startsWith('NON_PAID') && !nonPaidReason.trim())
            }
            className="pos-touch-btn w-full h-16 sm:h-20 rounded-3xl font-black text-xl flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xl shadow-emerald-950/60 disabled:bg-slate-800 disabled:text-slate-500 transition active:scale-95"
          >
            {isProcessing ? (
              <RefreshCw className="w-6 h-6 animate-spin" />
            ) : (
              <Check className="w-7 h-7" />
            )}
            <span>Kassieren {formatCurrency(checkout.amountDueWithTip)}</span>
          </button>
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

          <div className={`grid grid-cols-1 sm:grid-cols-${isEBonAvailable ? '4' : '3'} gap-3 w-full max-w-3xl`}>
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
              className="pos-touch-btn h-20 rounded-3xl bg-blue-600 hover:bg-blue-500 text-white font-black flex flex-col items-center justify-center gap-1 disabled:bg-slate-800 disabled:text-slate-500 transition active:scale-95 shadow"
            >
              <Printer className="w-6 h-6" />
              <span className="text-sm">{receiptPrinted ? 'Beleg gedruckt' : 'Papierbon'}</span>
            </button>

            {/* E-Bon Button: Nur aktiv/sichtbar wenn Internet- oder NFC-Option im Admin aktiv ist */}
            {isEBonAvailable && (
              <button
                type="button"
                onClick={openEBonDialog}
                className="pos-touch-btn h-20 rounded-3xl bg-emerald-600 hover:bg-emerald-500 text-white font-black flex flex-col items-center justify-center gap-1 transition active:scale-95 shadow shadow-emerald-950/60"
              >
                <div className="flex items-center gap-1">
                  {isInternetActive && <QrCode className="w-5 h-5" />}
                  {isInternetActive && isNfcActive && <span className="text-xs opacity-70">/</span>}
                  {isNfcActive && <Radio className="w-5 h-5" />}
                </div>
                <span className="text-sm">
                  {isInternetActive && isNfcActive
                    ? 'E-Bon (QR / NFC)'
                    : isNfcActive
                    ? 'E-Bon per NFC'
                    : 'E-Bon (QR-Code)'}
                </span>
              </button>
            )}

            <button
              onClick={() => {
                haptic();
                router.push('/waiter');
              }}
              className="pos-touch-btn h-20 rounded-3xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-black flex flex-col items-center justify-center gap-1 transition active:scale-95"
            >
              <Ban className="w-6 h-6" />
              <span className="text-sm">Kein Beleg</span>
            </button>
            <button
              onClick={() => {
                haptic();
                router.push('/waiter');
              }}
              className="pos-touch-btn h-20 rounded-3xl bg-emerald-900 hover:bg-emerald-800 border border-emerald-700 text-emerald-100 font-black flex flex-col items-center justify-center gap-1 transition active:scale-95 shadow"
            >
              <DoorOpen className="w-6 h-6" />
              <span className="text-sm">Tisch schließen</span>
            </button>
          </div>

          {/* Digitaler E-Bon & NFC Dialog */}
          {showEBonModal && (
            <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl max-w-sm w-full shadow-2xl text-center space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h3 className="font-black text-base text-white flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-emerald-400" />
                    <span>Digitaler E-Bon (§ 33)</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEBonModal(false);
                      setNfcStatus('IDLE');
                    }}
                    className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Umschalter wenn beides (Internet-QR und NFC) aktiv ist */}
                {isInternetActive && isNfcActive && (
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        haptic();
                        setEBonMode('QR');
                        setNfcStatus('IDLE');
                      }}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        eBonMode === 'QR' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>QR-Code</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        haptic();
                        setEBonMode('NFC');
                        void startNfcBeam();
                      }}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        eBonMode === 'NFC' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>NFC Beamen</span>
                    </button>
                  </div>
                )}

                {/* QR-Code Ansicht */}
                {eBonMode === 'QR' && (
                  <div className="space-y-3">
                    {eBonQrDataUrl ? (
                      <div className="bg-white p-3 rounded-2xl w-48 h-48 mx-auto flex items-center justify-center shadow-lg border-2 border-slate-700">
                        <img src={eBonQrDataUrl} alt="E-Bon QR-Code" className="w-full h-full" />
                      </div>
                    ) : (
                      <div className="p-8 bg-slate-950 rounded-2xl border border-slate-800 text-slate-500 text-xs">
                        Generiere QR-Code...
                      </div>
                    )}
                    <p className="text-xs text-slate-400">Gast scannt den QR-Code mit der Smartphone-Kamera:</p>
                    {completedDigitalReceiptUrl && (
                      <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-400 break-all select-all">
                        {completedDigitalReceiptUrl}
                      </div>
                    )}
                  </div>
                )}

                {/* NFC Ansicht */}
                {eBonMode === 'NFC' && (
                  <div className="space-y-4 py-2">
                    <div className="relative w-24 h-24 mx-auto rounded-full bg-emerald-950/60 border-2 border-emerald-500 flex items-center justify-center shadow-lg">
                      {nfcStatus === 'WRITING' && (
                        <span className="absolute inset-0 rounded-full animate-ping bg-emerald-500/20" />
                      )}
                      <Radio
                        className={`w-10 h-10 ${
                          nfcStatus === 'SUCCESS'
                            ? 'text-emerald-400'
                            : nfcStatus === 'ERROR'
                            ? 'text-rose-400'
                            : 'text-emerald-300 animate-pulse'
                        }`}
                      />
                    </div>

                    <div className="text-xs text-slate-300 font-semibold px-2 leading-relaxed">
                      {nfcMessage || 'Smartphone an die Geräterückseite halten...'}
                    </div>

                    {nfcStatus !== 'WRITING' && (
                      <button
                        type="button"
                        onClick={() => void startNfcBeam()}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow"
                      >
                        <Radio className="w-3.5 h-3.5" />
                        <span>NFC Übertragung erneut starten</span>
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowEBonModal(false);
                    setNfcStatus('IDLE');
                  }}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-xs"
                >
                  Schließen
                </button>
              </div>
            </div>
          )}

          {items.some((i) => i.selectedQty < i.totalUnpaidQty) && (
            <button
              onClick={() => {
                haptic();
                setCompletedInvoice(null);
                setCompletedPaymentId(null);
                setReceiptPrinted(false);
                setKeypadValue('');
                setReturnDeposits({ 0.5: 0, 1.0: 0, 2.0: 0, 3.0: 0, 5.0: 0 });
                setStage('SPLIT');
                void fetchTableOrders();
              }}
              className="pos-touch-btn w-full max-w-3xl h-16 rounded-3xl bg-amber-600 hover:bg-amber-500 text-white font-black text-base shadow-xl flex items-center justify-center gap-2.5 transition active:scale-95"
            >
              <RefreshCw className="w-5 h-5" />
              <span>Nächsten Gast am selben Tisch kassieren (Rest abrechnen)</span>
            </button>
          )}
        </div>
      )}

      {/* Bestellverlauf Modal (Schreibgeschützt) */}
      <WaiterOrderHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        waiterName={waiterName}
      />
    </div>
  );
}

function WaiterPaymentPageInner() {
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

/**
 * Session-Gate: prueft beim Laden, ob an dieser Station eine gueltige
 * Anmeldung besteht, und zeigt sonst sofort das PIN-Pad.
 */
export default function WaiterPaymentPage() {
  return (
    <StationGate station="WAITER" label="Kassieren" allow={['WAITER', 'POS_CASHIER']}>
      <WaiterPaymentPageInner />
    </StationGate>
  );
}
