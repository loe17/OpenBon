'use client';

import React, { useState, useEffect } from 'react';
import { useSocket } from '@/components/providers/socket-provider';
import QRCode from 'qrcode';
import { formatCurrency } from '@/lib/utils';
import {
  Monitor,
  Receipt,
  QrCode,
  CheckCircle2,
  Sparkles,
  ShoppingBag,
  CreditCard,
  Coins,
  Settings2,
  UtensilsCrossed,
} from 'lucide-react';

interface CartItem {
  id?: string;
  name: string;
  quantity: number;
  price: number;
  deposit?: number;
  variantName?: string;
  selectedOptions?: string[];
}

interface CustomerDisplayState {
  stationId: string;
  stationName: string;
  status: 'IDLE' | 'CART' | 'PAYING' | 'PAID';
  items: CartItem[];
  totalGross: number;
  totalDeposit: number;
  givenAmount?: number;
  changeAmount?: number;
  digitalReceiptCode?: string | null;
  digitalReceiptUrl?: string | null;
  paymentMethod?: string;
}

export default function CustomerDisplayPage() {
  const { socket } = useSocket();
  const [selectedStation, setSelectedStation] = useState<string>('ALL');
  const [showConfig, setShowConfig] = useState(false);
  const [devices, setDevices] = useState<{ id: string; name: string }[]>([]);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [state, setState] = useState<CustomerDisplayState>({
    stationId: 'ALL',
    stationName: 'OpenBon Kasse',
    status: 'IDLE',
    items: [],
    totalGross: 0,
    totalDeposit: 0,
  });

  // Track Fullscreen state to auto-hide setup bar
  useEffect(() => {
    const handleFullscreen = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreen);
    return () => document.removeEventListener('fullscreenchange', handleFullscreen);
  }, []);

  const fetchDevices = async () => {
    try {
      const res = await fetch('/api/devices');
      const data = await res.json();
      if (Array.isArray(data)) {
        setDevices(data.map((d: any) => ({ id: d.id, name: d.name })));
      }
    } catch {}
  };

  useEffect(() => {
    fetchDevices();

    if (socket) {
      const isMatch = (stationId?: string) => {
        if (selectedStation === 'ALL') return true;
        if (!stationId) return false;
        if (stationId === selectedStation) return true;
        if (
          (stationId === 'MAIN_CASH' || stationId === 'POS_MAIN') &&
          (selectedStation === 'POS_MAIN' || selectedStation === 'MAIN_CASH')
        ) {
          return true;
        }
        return false;
      };

      // Höre auf Live-Warenkorb Aktualisierungen von der Kasse
      socket.on('pos:cart_updated', (payload: any) => {
        if (!isMatch(payload.stationId)) return;
        setState({
          stationId: payload.stationId || 'ALL',
          stationName: payload.stationName || 'Kasse',
          status: 'CART',
          items: payload.items || [],
          totalGross: payload.totalGross || 0,
          totalDeposit: payload.totalDeposit || 0,
        });
      });

      // Höre auf Bezahlungsabschluss
      socket.on('payment:completed', (payment: any) => {
        if (!isMatch(payment.deviceId || payment.stationId)) return;
        const receiptUrl = payment.digitalReceiptUrl || (payment.digitalReceiptCode ? `http://openbon.local/receipt/${payment.digitalReceiptCode}` : null);
        
        setState((prev) => ({
          ...prev,
          status: 'PAID',
          totalGross: payment.totalGross,
          givenAmount: payment.givenAmount,
          changeAmount: payment.changeAmount,
          digitalReceiptCode: payment.digitalReceiptCode,
          digitalReceiptUrl: receiptUrl,
          paymentMethod: payment.paymentMethod,
        }));

        if (receiptUrl) {
          QRCode.toDataURL(receiptUrl, { width: 256, margin: 1 })
            .then((url) => setQrCodeDataUrl(url))
            .catch(() => {});
        }

        // Nach 25 Sekunden automatisch wieder auf IDLE zurücksetzen
        setTimeout(() => {
          setState((p) => (p.status === 'PAID' ? { ...p, status: 'IDLE', items: [] } : p));
          setQrCodeDataUrl(null);
        }, 25000);
      });

      // Korb geleert / Abbruch
      socket.on('pos:cart_cleared', (payload: any) => {
        if (!isMatch(payload?.stationId)) return;
        setState((prev) => ({
          ...prev,
          status: 'IDLE',
          items: [],
          totalGross: 0,
          totalDeposit: 0,
        }));
        setQrCodeDataUrl(null);
      });
    }

    return () => {
      if (socket) {
        socket.off('pos:cart_updated');
        socket.off('payment:completed');
        socket.off('pos:cart_cleared');
      }
    };
  }, [socket, selectedStation]);

  // Sofortige Abfrage des aktuellen Warenkorbs beim Stationswechsel
  useEffect(() => {
    if (socket) {
      socket.emit('pos:request_cart_state', { stationId: selectedStation });
    }
  }, [selectedStation, socket]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-white overflow-hidden select-none">
      {/* Top Station Bar / Config Toggle (wird im Vollbildmodus ausgeblendet) */}
      {!isFullscreen && (
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <span className="bg-blue-600 text-white px-2.5 py-1 rounded-xl text-xs font-black tracking-wider uppercase shadow">
              OB
            </span>
            <div>
              <h1 className="font-black text-base tracking-tight text-white flex items-center gap-2">
                <span>Kundendisplay</span>
                <span className="text-xs text-blue-400 font-mono font-bold bg-blue-950/80 px-2 py-0.5 rounded-lg border border-blue-800">
                  {state.stationName || (selectedStation === 'ALL' ? 'Alle Kassen' : selectedStation)}
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Kassen-Zuordnung ändern"
            >
              <Settings2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Station Selector Dropdown Panel */}
      {showConfig && !isFullscreen && (
        <div className="bg-slate-900 border-b border-slate-700 p-4 animate-in slide-in-from-top">
          <div className="max-w-md mx-auto flex items-center gap-3">
            <label className="text-xs font-bold text-slate-400">Angezeigte Kasse:</label>
            <select
              value={selectedStation}
              onChange={(e) => {
                setSelectedStation(e.target.value);
                setShowConfig(false);
              }}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="ALL">✨ Alle Stationen &amp; Mobilteile (Global)</option>
              <option value="POS_MAIN">Haupt-Bonkasse</option>
              <option value="POS_1">Thekenkasse 1</option>
              <option value="POS_2">Thekenkasse 2</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.id})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {state.status === 'IDLE' ? (
          /* Idle / Welcome Screen (ohne hüpfende Animation) */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-slate-950 to-slate-900">
            <div className="w-20 h-20 rounded-3xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-6 shadow-2xl">
              <UtensilsCrossed className="w-10 h-10" />
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-3 text-white">
              Herzlich willkommen!
            </h2>
            <p className="text-base sm:text-xl text-slate-400 max-w-lg font-medium">
              Ihre Bestellung wird gleich hier angezeigt. Wir wünschen Ihnen einen schönen Aufenthalt!
            </p>
          </div>
        ) : state.status === 'PAID' ? (
          /* Payment Completed Screen with Prominent E-Bon QR-Code */
          <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 text-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h2 className="text-3xl sm:text-4xl font-black text-white mb-1">
              Vielen Dank für Ihren Besuch!
            </h2>
            <p className="text-sm text-slate-400 mb-6">Zahlung erfolgreich abgeschlossen</p>

            {/* Receipt Summary Card with QR Code */}
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl flex flex-col items-center">
              <div className="flex items-center justify-between w-full border-b border-slate-800 pb-4 mb-4">
                <span className="text-sm text-slate-400 font-bold">Gezahlter Betrag:</span>
                <span className="text-2xl sm:text-3xl font-mono font-black text-emerald-400">
                  {formatCurrency(state.totalGross)}
                </span>
              </div>

              {state.changeAmount && state.changeAmount > 0 ? (
                <div className="flex items-center justify-between w-full bg-emerald-950/40 border border-emerald-800/60 p-3 rounded-2xl mb-4">
                  <span className="text-xs text-emerald-300 font-bold">Ihr Rückgeld:</span>
                  <span className="text-xl font-mono font-black text-emerald-300">
                    {formatCurrency(state.changeAmount)}
                  </span>
                </div>
              ) : null}

              {/* QR Code Section */}
              {qrCodeDataUrl && (
                <div className="flex flex-col items-center mt-2">
                  <div className="bg-white p-3 rounded-3xl shadow-xl border-4 border-slate-800 mb-3">
                    <img
                      src={qrCodeDataUrl}
                      alt="Digitaler E-Bon QR-Code"
                      className="w-44 h-44 rounded-xl"
                    />
                  </div>
                  <span className="text-xs font-mono font-black text-amber-300 bg-amber-950/80 border border-amber-800 px-3 py-1 rounded-xl">
                    {state.digitalReceiptCode}
                  </span>
                  <p className="text-xs text-slate-400 font-semibold mt-2 flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-blue-400" />
                    <span>QR-Code scannen für digitalen Kassenbeleg</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Live Cart / Order Breakdown Screen */
          <>
            {/* Left: Items List */}
            <div className="flex-1 flex flex-col bg-slate-900/60 border-r border-slate-800 p-6 overflow-y-auto">
              <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-blue-400" />
                <span>Ihre Bestellung</span>
              </h2>

              <div className="space-y-3 flex-1">
                {state.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-mono font-black text-sm">
                        {item.quantity}x
                      </span>
                      <div>
                        <span className="font-extrabold text-base sm:text-lg text-white block">
                          {item.name}
                        </span>
                        {item.variantName && !item.name.toLowerCase().includes(item.variantName.toLowerCase()) && (
                          <span className="text-xs text-blue-300 font-semibold block">
                            {item.variantName}
                          </span>
                        )}
                        {item.selectedOptions && item.selectedOptions.length > 0 && (
                          <span className="text-xs text-emerald-400 block font-medium">
                            + {item.selectedOptions.join(', ')}
                          </span>
                        )}
                        {item.deposit && item.deposit > 0 ? (
                          <span className="text-xs text-amber-400 font-medium block">
                            inkl. {formatCurrency(item.deposit * item.quantity)} Pfand
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <span className="font-mono font-black text-lg sm:text-xl text-white">
                      {formatCurrency(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Total Summary Card */}
            <div className="w-full md:w-96 bg-slate-900 p-6 sm:p-8 flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-800">
              <div className="space-y-4">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                  Zu zahlender Betrag
                </h3>

                <div className="space-y-2 py-4 border-y border-slate-800 text-sm">
                  <div className="flex justify-between text-slate-400">
                    <span>Zwischensumme:</span>
                    <span className="font-mono text-slate-200">
                      {formatCurrency(state.totalGross - state.totalDeposit)}
                    </span>
                  </div>
                  {state.totalDeposit > 0 && (
                    <div className="flex justify-between text-amber-400 font-semibold">
                      <span>Pfandbetrag:</span>
                      <span className="font-mono">{formatCurrency(state.totalDeposit)}</span>
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-xs font-mono uppercase text-slate-400 block mb-1">
                    Gesamtbetrag
                  </span>
                  <span className="text-4xl sm:text-5xl font-mono font-black text-emerald-400 tracking-tight block">
                    {formatCurrency(state.totalGross)}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center text-xs text-slate-400 mt-6">
                <CreditCard className="w-5 h-5 text-blue-400 mx-auto mb-1.5" />
                <span>Barzahlung, EC-/Kreditkarte oder Wertmarke möglich</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
