'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Receipt,
  Printer,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Download,
  Loader2,
} from 'lucide-react';

interface PaymentItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  deposit: number;
  taxRate: number;
}

interface PaymentData {
  id: string;
  invoiceNumber: string;
  digitalReceiptCode: string;
  waiterName: string;
  totalGross: number;
  totalNet: number;
  totalTax: number;
  taxBase19: number;
  taxAmount19: number;
  taxBase7: number;
  taxAmount7: number;
  taxBase0: number;
  totalDeposit: number;
  returnDeposit: number;
  discountAmount: number;
  tipAmount: number;
  givenAmount: number;
  changeAmount: number;
  paymentMethod: string;
  cardAuthCode?: string | null;
  isTraining: boolean;
  createdAt: string;
  items: PaymentItem[];
  table?: { tableNumber: number; label: string } | null;
}

export default function DigitalReceiptPage() {
  const params = useParams();
  const code = params.code as string;

  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [eventName, setEventName] = useState('OrderBon');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReceipt() {
      try {
        const res = await fetch(`/api/receipt/${code}`);
        if (!res.ok) {
          setError('Digitaler Beleg nicht gefunden oder abgelaufen.');
          return;
        }
        const data = await res.json();
        setPayment(data.payment);
        if (data.eventConfig?.name) setEventName(data.eventConfig.name);
      } catch (err) {
        setError('Verbindungsfehler beim Laden des Belegs.');
      } finally {
        setLoading(false);
      }
    }
    loadReceipt();
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="font-semibold text-lg">Digitaler Beleg wird geladen...</p>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mb-3" />
        <h1 className="text-xl font-bold text-white mb-1">Beleg nicht gefunden</h1>
        <p className="text-slate-400 text-sm">{error || 'Ungültiger Belegcode.'}</p>
      </div>
    );
  }

  const dateFormatted = new Date(payment.createdAt).toLocaleString('de-DE');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-900 py-10 px-4 flex flex-col items-center print:bg-white print:p-0">
      {/* Action Bar (nicht im Druck) */}
      <div className="w-full max-w-sm flex items-center justify-between mb-4 print:hidden">
        <div className="flex items-center gap-2 text-white">
          <Receipt className="w-5 h-5 text-emerald-400" />
          <span className="font-bold text-sm">Digitaler Kassenbon (§33 KassenSichV)</span>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow transition-all"
        >
          <Printer className="w-4 h-4" /> Drucken / PDF
        </button>
      </div>

      {/* Thermobon Papier Simulation */}
      <div className="w-full max-w-sm bg-white p-6 rounded-3xl shadow-2xl border border-slate-200 font-mono text-xs leading-relaxed text-slate-900 print:shadow-none print:border-none print:p-0">
        {/* Header */}
        <div className="text-center pb-4 border-b border-dashed border-slate-300">
          {payment.isTraining && (
            <div className="bg-amber-100 text-amber-900 font-black text-xs py-1 px-2 rounded mb-2 border border-amber-300">
              *** ÜBUNGSBON - KEINE BEZAHLUNG ***
            </div>
          )}
          <h2 className="text-base font-black tracking-tight">{eventName}</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">Offizieller Bewirtungs- & Kassenbeleg</p>
        </div>

        {/* Metadaten */}
        <div className="py-3 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span className="text-slate-500">Beleg-Nr:</span>
            <span className="font-bold">{payment.invoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Datum & Zeit:</span>
            <span>{dateFormatted}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Bedienung:</span>
            <span>{payment.waiterName}</span>
          </div>
          {payment.table && (
            <div className="flex justify-between">
              <span className="text-slate-500">Tisch:</span>
              <span className="font-bold">{payment.table.label || `Tisch ${payment.table.tableNumber}`}</span>
            </div>
          )}
        </div>

        {/* Positionen */}
        <div className="py-3 border-b border-dashed border-slate-300 space-y-2">
          {payment.items.map((item) => {
            const lineTotal = item.unitPrice * item.quantity;
            return (
              <div key={item.id} className="flex justify-between items-start">
                <div className="flex-1 mr-2">
                  <span className="font-bold">{item.quantity}x {item.productName}</span>
                  <div className="text-[10px] text-slate-500">
                    à {item.unitPrice.toFixed(2)} € (inkl. {item.taxRate}% USt)
                    {item.deposit > 0 && ` + ${(item.deposit * item.quantity).toFixed(2)} € Pfand`}
                  </div>
                </div>
                <span className="font-bold text-right">
                  {(lineTotal + item.deposit * item.quantity).toFixed(2)} €
                </span>
              </div>
            );
          })}
        </div>

        {/* Summen */}
        <div className="py-3 border-b-2 border-slate-800 space-y-1.5">
          {payment.returnDeposit > 0 && (
            <div className="flex justify-between text-slate-600 text-[11px]">
              <span>Rückpfand Verrechnung:</span>
              <span>-{payment.returnDeposit.toFixed(2)} €</span>
            </div>
          )}
          {payment.discountAmount > 0 && (
            <div className="flex justify-between text-slate-600 text-[11px]">
              <span>Rabatt / Nachlass:</span>
              <span>-{payment.discountAmount.toFixed(2)} €</span>
            </div>
          )}
          {payment.tipAmount > 0 && (
            <div className="flex justify-between text-slate-600 text-[11px]">
              <span>Trinkgeld (freiwillig):</span>
              <span>+{payment.tipAmount.toFixed(2)} €</span>
            </div>
          )}

          <div className="flex justify-between items-center text-sm font-black pt-1">
            <span>GESAMTBETRAG:</span>
            <span className="text-base font-extrabold">
              {(payment.totalGross + (payment.tipAmount || 0)).toFixed(2)} €
            </span>
          </div>

          <div className="flex justify-between text-[11px] text-slate-600 pt-1">
            <span>Zahlungsart:</span>
            <span className="font-bold">{payment.paymentMethod}</span>
          </div>
          {payment.givenAmount > 0 && (
            <>
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>Gegeben:</span>
                <span>{payment.givenAmount.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>Rückgeld:</span>
                <span>{payment.changeAmount.toFixed(2)} €</span>
              </div>
            </>
          )}
        </div>

        {/* Steuer-Aufschlüsselung */}
        <div className="py-3 border-b border-dashed border-slate-300 space-y-1 text-[10px] text-slate-600">
          <div className="font-bold text-slate-800 mb-1">Steueraufschlüsselung:</div>
          {payment.taxAmount19 > 0 && (
            <div className="flex justify-between">
              <span>USt 19%: Netto {payment.taxBase19.toFixed(2)} €</span>
              <span>Steuer: {payment.taxAmount19.toFixed(2)} €</span>
            </div>
          )}
          {payment.taxAmount7 > 0 && (
            <div className="flex justify-between">
              <span>USt 7%: Netto {payment.taxBase7.toFixed(2)} €</span>
              <span>Steuer: {payment.taxAmount7.toFixed(2)} €</span>
            </div>
          )}
          {payment.taxBase0 > 0 && (
            <div className="flex justify-between">
              <span>Steuerfrei (0% / Pfand):</span>
              <span>{payment.taxBase0.toFixed(2)} €</span>
            </div>
          )}
        </div>

        {/* E-Bon & Prüfcode */}
        <div className="pt-4 text-center text-[10px] text-slate-500 space-y-1">
          <div className="font-bold text-slate-700">Digitaler Verifikationscode:</div>
          <div className="bg-slate-100 p-1.5 rounded font-mono text-[9px] text-slate-800 break-all select-all">
            {payment.digitalReceiptCode}
          </div>
          <p className="mt-2 pt-2 border-t border-slate-100">
            Vielen Dank für Ihren Besuch!
          </p>
        </div>
      </div>
    </div>
  );
}
