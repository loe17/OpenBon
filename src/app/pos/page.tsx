'use client';

import React, { useEffect, useState } from 'react';
import { useSocket } from '@/components/providers/socket-provider';
import QRCode from 'qrcode';
import { formatCurrency, generateIdempotencyKey } from '@/lib/utils';
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
  Store,
  X,
} from 'lucide-react';
import { SubCategoryIcon } from '@/components/ui/subcategory-icon';
import { calculateMinBirthdate, EU_ALLERGENS, filterProductsByExcludedAllergens } from '@/lib/compliance';
import { getEffectiveProductPrice } from '@/lib/pricing';
import { hasAnyCardPaymentConfigured, getActiveCardPaymentMethod } from '@/lib/payment/methods';
import { sendWithOutboxFallback } from '@/lib/offline/outbox';
import { useToast } from '@/components/ui/toast';
import { ChangeCalculator } from '@/components/ui/change-calculator';
import type { ProductDTO, ProductVariantDTO, OrderItemDTO, ProductCategoryDTO, EventConfigDTO } from '@/types/domain';

import StationGate from '@/components/auth/station-gate';
function PosCounterContent() {
  const { success, error, warning } = useToast();
  const { socket } = useSocket();
  const [config, setConfig] = useState<EventConfigDTO | null>(null);
  const [categories, setCategories] = useState<ProductCategoryDTO[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [selectedSubCat, setSelectedSubCat] = useState<string>('ALL');
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [showAllergenFilter, setShowAllergenFilter] = useState(false);
  const [enableDigitalReceipt, setEnableDigitalReceipt] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [mode, setMode] = useState<'DIRECT' | 'VOUCHER' | 'DUAL'>('DIRECT');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [givenAmount, setGivenAmount] = useState<number>(0);
  const [keypadInput, setKeypadInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastToken, setLastToken] = useState<number | null>(null);
  const [completedPayment, setCompletedPayment] = useState<any | null>(null);
  const [selectedProductInfo, setSelectedProductInfo] = useState<any | null>(null);
  const [lowStockWarning, setLowStockWarning] = useState<string | null>(null);

  const [productWithOptions, setProductWithOptions] = useState<ProductDTO | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariantDTO | null>(null);
  const [activeOptionNames, setActiveOptionNames] = useState<string[]>([]);

  const minBirth16 = calculateMinBirthdate(16);
  const minBirth18 = calculateMinBirthdate(18);

  const [stationName, setStationName] = useState<string>('Bonkasse 1');
  const [stationId, setStationId] = useState<string>('POS_1');
  const [showStationModal, setShowStationModal] = useState(false);

  const [editStationName, setEditStationName] = useState('Bonkasse 1');
  const [editDrawerConnected, setEditDrawerConnected] = useState(true);
  const [hasDrawerAvailable, setHasDrawerAvailable] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('openbon_pos_name') || 'Bonkasse 1';
      const savedId = localStorage.getItem('openbon_pos_id') || 'POS_1';
      setStationName(savedName);
      setEditStationName(savedName);
      setStationId(savedId);
    }
  }, []);

  // Station Announcement an alle Kundendisplays
  useEffect(() => {
    if (!socket || !stationName) return;
    socket.emit('pos:station_online', { stationId, stationName });
  }, [socket, stationId, stationName]);

  const totalGross = cart.reduce((sum, item) => sum + (item.price + item.deposit) * item.quantity, 0);
  const totalDeposit = cart.reduce((sum, item) => sum + item.deposit * item.quantity, 0);

  // Synchronisation mit Kundendisplay / Customer Screen
  useEffect(() => {
    if (!socket) return;
    if (cart.length > 0) {
      socket.emit('pos:cart_updated', {
        stationId,
        stationName,
        items: cart.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price,
          deposit: i.deposit,
          variantName: i.variantName,
          selectedOptions: i.selectedOptions,
        })),
        totalGross,
        totalDeposit,
      });
    } else {
      socket.emit('pos:cart_cleared', { stationId, stationName });
    }
  }, [cart, totalGross, totalDeposit, socket, stationId, stationName]);

  // Sofortiges Antworten auf Nachfragen vom Kundendisplay
  useEffect(() => {
    if (!socket) return;
    const handleCartRequest = (req?: { stationId?: string }) => {
      if (!req?.stationId || req.stationId === 'ALL' || req.stationId === stationId) {
        if (cart.length > 0) {
          socket.emit('pos:cart_updated', {
            stationId,
            stationName,
            items: cart.map((i) => ({
              name: i.name,
              quantity: i.quantity,
              price: i.price,
              deposit: i.deposit,
              variantName: i.variantName,
              selectedOptions: i.selectedOptions,
            })),
            totalGross,
            totalDeposit,
          });
        }
      }
    };
    socket.on('pos:request_cart_state', handleCartRequest);
    return () => {
      socket.off('pos:request_cart_state', handleCartRequest);
    };
  }, [socket, cart, totalGross, totalDeposit, stationId, stationName]);

  useEffect(() => {
    fetch('/api/config/public')
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (cfg && !cfg.error) {
          setConfig(cfg);
          setEnableDigitalReceipt(Boolean(cfg.enableDigitalReceipt || cfg.enableDigitalReceiptQr));
        }
      })
      .catch(() => {});

    fetch('/api/printers')
      .then((r) => (r.ok ? r.json() : []))
      .then((prns) => {
        if (Array.isArray(prns)) {
          const anyHasDrawer = prns.some((p: any) => p.isActive && p.hasCashDrawer);
          setHasDrawerAvailable(anyHasDrawer);
        }
      })
      .catch(() => {});

    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d) && d.length > 0) {
          setCategories(d);
          setSelectedCatId(d[0].id);
        }
      })
      .catch(() => {});

    if (socket) {
      const handleInventory = () => {
        fetch('/api/categories')
          .then((r) => r.json())
          .then((data) => {
            if (Array.isArray(data)) setCategories(data);
          })
          .catch(() => {});
      };
      socket.on('inventory:updated', handleInventory);
      socket.on('product:updated', handleInventory);
      return () => {
        socket.off('inventory:updated', handleInventory);
        socket.off('product:updated', handleInventory);
      };
    }
  }, [socket]);

  const handleProductClick = (product: ProductDTO, variant?: ProductVariantDTO) => {
    const hasOptions = (product.options && product.options.length > 0) || (product.variants && product.variants.length > 1 && !variant);
    if (hasOptions && !variant) {
      setProductWithOptions(product);
      setSelectedVariant(product.variants && product.variants.length > 0 ? product.variants[0] : null);
      setActiveOptionNames([]);
      return;
    }
    addToCart(product, variant, []);
  };

  const addToCart = (product: ProductDTO, variant?: ProductVariantDTO | null, optionsList: string[] = []) => {
    if (product.isSoldOut || (variant && variant.isSoldOut)) {
      warning(`Artikel "${product.name}" ist derzeit ausverkauft / gesperrt.`);
      return;
    }

    triggerHapticFeedback();
    const optionsDelta = (product.options || [])
      .filter((o) => optionsList.includes(o.name))
      .reduce((sum, o) => sum + (o.priceDelta || 0), 0);

    const { price: effectivePrice } = getEffectiveProductPrice(product as any);
    const unitPrice = effectivePrice + (variant ? variant.priceDelta : 0) + optionsDelta;
    const optionsKey = optionsList.slice().sort().join('|');
    const lineId = `${product.id}_${variant ? variant.name : 'def'}_${optionsKey}`;

    // Pruefe Meldebestand-Warnung
    // N3.2: Verbindliche Quelle ist der abgebuchte StockItem-Bestand - das
    // alte Feld stockQuantity blieb bei Standard-Verkaeften auf Altstand.
    const currentStock = product.stockItem?.currentQuantity ?? product.stockQuantity;
    if (product.trackStock && currentStock <= ((product as any).minStockAlert || 10)) {
      setLowStockWarning(`Hinweis: "${product.name}" hat nur noch ${currentStock} Stk. auf Lager!`);
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
          selectedOptions: optionsList,
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
    const drawerConnected = localStorage.getItem('pos_drawer_connected') !== '0';
    if (!drawerConnected || !hasDrawerAvailable) return;
    try {
      const prnRes = await fetch('/api/printers');
      const prns = await prnRes.json();
      if (Array.isArray(prns)) {
        const drawerPrinter = prns.find((p: any) => p.isActive && p.hasCashDrawer);
        if (drawerPrinter) {
          const res = await fetch('/api/printers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'OPEN_DRAWER', printerId: drawerPrinter.id }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            warning(
              `Kassenlade konnte nicht geöffnet werden${data.error ? `: ${data.error}` : ''}. Der Verkauf wurde erfolgreich abgeschlossen.`
            );
          }
        }
      }
    } catch {}
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || isProcessing) return;
    setIsProcessing(true);
    triggerHapticFeedback();

    try {
      const waiterName = localStorage.getItem('pos_waiter_name') || 'Bonkasse Theke';
      const deviceId = localStorage.getItem('pos_device_id');

      const idempotencyKey = generateIdempotencyKey('pos');

      // Atomic Checkout: Bestellung + Zahlung in einem Request (serverseitig eine Transaktion).
      // Bei Netzwerkabbruch landet der Vorgang in der Offline-Outbox und wird automatisch nachgesendet.
      const result = await sendWithOutboxFallback('ORDER', '/api/orders/checkout', {
        orderType: mode === 'DIRECT' ? 'COUNTER_DIRECT' : 'COUNTER_VOUCHER',
        source: 'POS_CASHIER',
        waiterName,
        deviceId,
        idempotencyKey,
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          variantName: item.variantName || undefined,
        })),
        paymentMethod,
        givenAmount: paymentMethod === 'CASH' ? givenAmount : undefined,
        openDrawer: false,
        printReceipt: mode !== 'DIRECT',
      });

      if (!result.success) {
        error(result.error || 'Fehler beim Kassiervorgang.');
        return;
      }

      // WICHTIG: `pending` bedeutet, dass der Server den Vorgang NICHT bestaetigt hat.
      // Es darf weder ein Bon gedruckt noch ein Abholtoken vergeben werden.
      if (result.pending) {
        warning(
          result.reason === 'SERVER_ERROR'
            ? `Server meldet einen Fehler – Vorgang wurde gesichert und wird erneut gesendet. Bon noch NICHT gebucht. (${result.error || ''})`
            : 'Keine Serververbindung – Vorgang wurde offline gespeichert und wird automatisch synchronisiert.'
        );
        setCart([]);
        setGivenAmount(0);
        return;
      }

      const payData = result.data;
      if (payData?.tokenNumber) {
        setLastToken(payData.tokenNumber);
      }

      if (enableDigitalReceipt && payData?.digitalReceiptUrl) {
        setCompletedPayment(payData);
        QRCode.toDataURL(payData.digitalReceiptUrl, { width: 256, margin: 1 })
          .then((url) => setQrDataUrl(url))
          .catch(() => {});
      } else {
        setCompletedPayment(null);
      }
      triggerHapticFeedback();
      success('Zahlung erfolgreich abgeschlossen!');
      setCart([]);
      setGivenAmount(0);
      if (paymentMethod === 'CASH') {
        openDrawer();
      }
    } catch (e) {
      console.error(e);
      const detail = e instanceof Error ? e.message : String(e);
      if (detail.includes('randomUUID') || detail.includes('crypto')) {
        error('Interner Fehler beim Erstellen der Vorgangs-ID. Bitte Seite neu laden und erneut versuchen.');
      } else if (detail) {
        error(`Fehler beim Kassiervorgang: ${detail}`);
      } else {
        error('Fehler beim Kassiervorgang. Bitte Verbindung prüfen und erneut versuchen.');
      }
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
            <div className="flex items-center gap-2">
              <h2 className="font-black text-lg sm:text-xl">Bonkasse & Thekenverkauf</h2>
              <button
                onClick={() => {
                  setEditStationName(stationName);
                  setShowStationModal(true);
                }}
                className="bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 px-2 py-0.5 rounded-lg text-[11px] font-black flex items-center gap-1.5 transition"
                title="Kassenname ändern"
              >
                <Store className="w-3.5 h-3.5 text-emerald-400" />
                <span>{stationName}</span>
                <span className="text-[9px] text-emerald-400 opacity-70 underline">Ändern</span>
              </button>
            </div>
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

        {/* Open Drawer Button (Nur wenn Kassenlade an einem konfigurierten Drucker verfügbar ist) */}
        {hasDrawerAvailable && (
          <button
            onClick={openDrawer}
            className="pos-touch-btn flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-2xl text-xs font-bold border border-slate-700 shadow transition active:scale-95"
            title="Kassenlade öffnen"
          >
            <DoorOpen className="w-4 h-4 text-emerald-400" />
            <span>Lade öffnen</span>
          </button>
        )}
      </div>

      {/* Meldebestand Low-Stock Alert Bar */}
      {lowStockWarning && (
        <div className="bg-amber-950 border-b border-amber-800 px-4 py-2 text-xs font-bold text-amber-200 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-400" />
            {lowStockWarning}
          </span>
          <button onClick={() => setLowStockWarning(null)} className="text-amber-400 hover:text-white p-1">
            <X className="w-3.5 h-3.5" />
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
                className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border transition flex items-center gap-1 ${
                  active
                    ? 'bg-red-500/20 text-red-300 border-red-500/40 font-bold'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {active && <X className="w-2.5 h-2.5" />}
                <span>{active ? `Ohne ${a.name}` : a.name}</span>
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
                  onClick={() => handleProductClick(prod)}
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
            <div className={`grid ${hasAnyCardPaymentConfigured(config) ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'} gap-2 mb-3`}>
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
              {hasAnyCardPaymentConfigured(config) && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod(getActiveCardPaymentMethod(config) || 'CARD_SUMUP')}
                  className={`py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                    paymentMethod.startsWith('CARD_') || paymentMethod === 'CARD'
                      ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Kartenzahlung</span>
                </button>
              )}
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

            {/* Stückelungs-Rückgeldrechner */}
            {paymentMethod === 'CASH' && (
              <div className="mb-3">
                <ChangeCalculator
                  amountDue={totalAmount}
                  givenAmount={givenAmount}
                  onGivenChange={(val) => setGivenAmount(val)}
                  defaultExpanded={true}
                />
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
                : mode === 'DIRECT'
                ? hasDrawerAvailable
                  ? 'Kassieren & Lade auf'
                  : 'Kassieren'
                : hasDrawerAvailable
                ? 'Kassieren, Lade auf & Bons drucken'
                : 'Kassieren & Bons drucken'}
            </span>
          </button>
        </div>
      </div>

      {/* Digital Receipt E-Bon Modal (nur wenn aktiv) */}
      {enableDigitalReceipt && completedPayment?.digitalReceiptUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl max-w-sm w-full shadow-2xl text-center space-y-3">
            {qrDataUrl ? (
              <div className="bg-white p-3 rounded-2xl w-48 h-48 mx-auto flex items-center justify-center shadow-lg border-2 border-slate-700">
                <img src={qrDataUrl} alt="Digitaler E-Bon QR-Code" className="w-full h-full" />
              </div>
            ) : (
              <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-2 border border-emerald-500/30">
                <QrCode className="w-8 h-8" />
              </div>
            )}
            <h3 className="text-lg font-bold text-white mb-1">Digitaler E-Bon (§33 KassenSichV)</h3>
            <p className="text-xs text-slate-400">Der Gast kann den Beleg per Smartphone abrufen:</p>

            <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800 font-mono text-xs text-emerald-400 break-all select-all">
              {completedPayment.digitalReceiptUrl}
            </div>

            <button
              onClick={() => {
                setCompletedPayment(null);
                setQrDataUrl(null);
              }}
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

      {/* Options / Variant Selection Modal */}
      {productWithOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <span className="text-xs text-emerald-400 font-bold uppercase">Auswahl & Zusätze</span>
                <h3 className="text-lg font-black text-white">{productWithOptions.name}</h3>
              </div>
              <button
                onClick={() => setProductWithOptions(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Varianten / Sorten wenn vorhanden */}
            {productWithOptions.variants && productWithOptions.variants.length > 0 && (
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Sorte / Variante wählen:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {productWithOptions.variants.map((v) => {
                    const active = selectedVariant?.name === v.name;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariant(v)}
                        className={`p-3 rounded-2xl text-xs font-bold border text-left transition ${
                          active
                            ? 'bg-emerald-600 border-emerald-400 text-white shadow'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="truncate font-black">{v.name}</div>
                        <div className="text-[11px] opacity-80 mt-0.5 font-mono">
                          {v.priceDelta > 0 ? `+${formatCurrency(v.priceDelta)}` : 'Standard'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Zusätze / Extras wenn vorhanden */}
            {productWithOptions.options && productWithOptions.options.length > 0 && (
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Zusätze & Extras wählen:
                </label>
                <div className="space-y-1.5 max-h-[30vh] overflow-y-auto">
                  {productWithOptions.options.map((opt) => {
                    const checked = activeOptionNames.includes(opt.name);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setActiveOptionNames((prev) =>
                            checked ? prev.filter((n) => n !== opt.name) : [...prev, opt.name]
                          );
                        }}
                        className={`w-full p-3 rounded-2xl text-xs font-bold border flex items-center justify-between transition ${
                          checked
                            ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200 shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-4 h-4 rounded-md flex items-center justify-center border text-[10px] ${
                              checked
                                ? 'bg-emerald-500 text-white border-emerald-400'
                                : 'border-slate-700'
                            }`}
                          >
                            {checked && <Check className="w-2.5 h-2.5 text-white" />}
                          </span>
                          <span>{opt.name}</span>
                        </div>
                        {opt.priceDelta && opt.priceDelta > 0 ? (
                          <span className="font-mono text-emerald-400">+{formatCurrency(opt.priceDelta)}</span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">Inklusive</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setProductWithOptions(null)}
                className="flex-1 h-12 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-bold"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  if (productWithOptions) {
                    addToCart(productWithOptions, selectedVariant, activeOptionNames);
                    setProductWithOptions(null);
                  }
                }}
                className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black shadow-lg shadow-emerald-950/50"
              >
                In den Korb
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Station Name Modal */}
      {showStationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-black text-base text-white flex items-center gap-2">
                <Store className="w-4 h-4 text-emerald-400" />
                <span>Bonkasse benennen</span>
              </h3>
              <button onClick={() => setShowStationModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Vergib einen individuellen Namen für dieses Terminal (z. B. <em>Bonkasse 1</em>, <em>Theke Hauptzelt</em>, <em>Grillkasse</em>). Dieser Name erscheint auch im Kundendisplay.
            </p>
            <input
              type="text"
              value={editStationName}
              onChange={(e) => setEditStationName(e.target.value)}
              placeholder="z. B. Bonkasse 2, Grillkasse"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold"
            />
            <label className="flex items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 cursor-pointer">
              <span className="text-xs font-bold text-slate-300">
                Kassenlade angeschlossen
                <span className="block text-[10px] font-semibold text-slate-500">
                  Deaktivieren, wenn an diesem Terminal keine Lade hängt – dann erscheint beim Kassieren keine Warnung.
                </span>
              </span>
              <input
                type="checkbox"
                checked={editDrawerConnected}
                onChange={(e) => setEditDrawerConnected(e.target.checked)}
                className="w-5 h-5 accent-emerald-500 shrink-0"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowStationModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  const clean = editStationName.trim() || 'Bonkasse 1';
                  const cleanId = clean.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'pos_1';
                  setStationName(clean);
                  setStationId(cleanId);
                  setEditDrawerConnected(editDrawerConnected);
                  localStorage.setItem('openbon_pos_name', clean);
                  localStorage.setItem('openbon_pos_id', cleanId);
                  localStorage.setItem('pos_drawer_connected', editDrawerConnected ? '1' : '0');
                  if (socket) {
                    socket.emit('pos:station_online', { stationId: cleanId, stationName: clean });
                  }
                  setShowStationModal(false);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Session-Gate: prueft beim Laden, ob an dieser Station eine gueltige
 * Anmeldung besteht, und zeigt sonst sofort das PIN-Pad.
 */
export default function PosCounterPage() {
  return (
    <StationGate station="POS" label="Bonkasse (Theke)" allow={['POS_CASHIER']}>
      <PosCounterContent />
    </StationGate>
  );
}
