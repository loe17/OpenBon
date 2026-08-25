'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSocket } from '@/components/providers/socket-provider';
import { triggerHapticFeedback } from '@/lib/socket-client';
import { formatCurrency } from '@/lib/utils';
import {
  ArrowLeft,
  Plus,
  Minus,
  Send,
  MessageSquarePlus,
  X,
  RefreshCw,
  PauseCircle,
  PlayCircle,
  ShieldAlert,
  Sparkles,
  Filter,
  AlertCircle,
  Radio,
  Trash2,
  ChevronUp,
  ChevronDown,
  ShoppingBag,
} from 'lucide-react';
import { COURSES } from '@/types/domain';
import { calculateMinBirthdate, EU_ALLERGENS, filterProductsByExcludedAllergens } from '@/lib/compliance';
import { getEffectiveProductPrice } from '@/lib/pricing';
import type {
  DiningTableDTO,
  ProductCategoryDTO,
  ProductDTO,
  ProductVariantDTO,
} from '@/types/domain';
import { playConfirm, playVoidAlert } from '@/lib/audio-feedback';
import { sendWithOutboxFallback } from '@/lib/offline/outbox';
import { useToast } from '@/components/ui/toast';

const parseWordsList = (raw: any): string[] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return raw.split(',').map((w: string) => w.trim()).filter(Boolean);
    }
  }
  return [];
};

interface WordGroup {
  id: string;
  name: string;
  words: any;
}

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  deposit: number;
  quantity: number;
  variantName?: string;
  selectedOptions: string[];
  customizationText?: string;
  courseNumber: number;
  isHold: boolean;
}

function WaiterOrderContent() {
  const router = useRouter();
  const { success, error, warning } = useToast();
  const searchParams = useSearchParams();
  const tableId = searchParams.get('tableId');
  const waiterFromUrl = searchParams.get('waiterName');

  const [table, setTable] = useState<DiningTableDTO | null>(null);
  const [categories, setCategories] = useState<ProductCategoryDTO[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [showAllergenFilter, setShowAllergenFilter] = useState(false);
  const [selectedProductInfo, setSelectedProductInfo] = useState<any | null>(null);
  const [enableAgeAlerts, setEnableAgeAlerts] = useState(true);

  const minBirth16 = calculateMinBirthdate(16);
  const minBirth18 = calculateMinBirthdate(18);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartExpanded, setCartExpanded] = useState(false);
  const [wordGroups, setWordGroups] = useState<WordGroup[]>([]);
  const [customizingItem, setCustomizingItem] = useState<CartItem | null>(null);
  const [selectedPrefix, setSelectedPrefix] = useState<string>('');
  const [selectedIngredient, setSelectedIngredient] = useState<string>('');
  const [customText, setCustomText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [waiterName, setWaiterName] = useState('Bedienung');
  const [activeCourse, setActiveCourse] = useState<number>(1);
  const [holdNext, setHoldNext] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [enableCourses, setEnableCourses] = useState(false);
  const [productWithOptions, setProductWithOptions] = useState<ProductDTO | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariantDTO | null>(null);
  const [activeOptionNames, setActiveOptionNames] = useState<string[]>([]);
  const [urgentBroadcast, setUrgentBroadcast] = useState<{ message: string; sender?: string } | null>(null);
  const { socket } = useSocket();

  const fetchCategories = () => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setCategories(data);
          setSelectedCatId((prev) => (prev ? prev : data[0].id));
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((cfg) => {
        if (cfg) {
          setEnableCourses(Boolean(cfg.enableCourses));
          setEnableAgeAlerts(Boolean(cfg.enableAgeVerificationAlerts ?? true));
        }
      })
      .catch(() => {});

    if (socket) {
      const handleAlert = (data: { message: string; sender?: string }) => {
        playVoidAlert();
        triggerHapticFeedback();
        setUrgentBroadcast(data);
      };

      const handleInventory = () => {
        fetchCategories();
      };

      socket.on('broadcast:alert', handleAlert);
      socket.on('inventory:updated', handleInventory);
      socket.on('product:updated', handleInventory);

      return () => {
        socket.off('broadcast:alert', handleAlert);
        socket.off('inventory:updated', handleInventory);
        socket.off('product:updated', handleInventory);
      };
    }
  }, [socket]);

  useEffect(() => {
    const savedWaiter = waiterFromUrl || localStorage.getItem('pos_waiter_name') || 'Bedienung';
    setWaiterName(savedWaiter);

    fetchCategories();

    fetch('/api/word-groups')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          // Deduplizieren nach Name
          const seen = new Set<string>();
          const unique: WordGroup[] = [];
          for (const g of data) {
            const key = g.name.toLowerCase().trim();
            if (!seen.has(key)) {
              seen.add(key);
              unique.push(g);
            }
          }
          setWordGroups(unique);
        }
      })
      .catch(() => {});

    if (tableId) {
      fetch('/api/tables')
        .then((r) => r.json())
        .then((tables: DiningTableDTO[]) => {
          const found = tables.find((t) => t.id === tableId);
          if (found) setTable(found);
        })
        .catch(() => {});
    }

    // Letzte Runde aus vorheriger Bestellung übernehmen
    if (searchParams.get('repeat') === '1') {
      try {
        const raw = sessionStorage.getItem('openbon_repeat_cart');
        if (raw) {
          const lines = JSON.parse(raw) as {
            productId: string;
            productName: string;
            quantity: number;
            unitPrice: number;
            deposit: number;
            variantName: string | null;
            selectedOptions: string[];
            customizationText: string | null;
          }[];
          setCart(
            lines.map((l) => ({
              id: `${l.productId}_${l.variantName ?? 'default'}`,
              productId: l.productId,
              name: l.productName,
              price: l.unitPrice,
              deposit: l.deposit,
              quantity: l.quantity,
              variantName: l.variantName ?? undefined,
              selectedOptions: l.selectedOptions ?? [],
              customizationText: l.customizationText ?? undefined,
              courseNumber: 1,
              isHold: false,
            }))
          );
          setNotice('Letzte Runde übernommen – bitte prüfen und abschicken.');
          sessionStorage.removeItem('openbon_repeat_cart');
        }
      } catch {
        /* Ignorieren */
      }
    }
  }, [tableId, waiterFromUrl, searchParams]);

  const handleProductClick = (product: ProductDTO, variant?: ProductVariantDTO) => {
    const hasVariants = product.variants && product.variants.length > 0;
    const hasOptions = product.options && product.options.length > 0;
    if ((hasVariants || hasOptions) && !variant) {
      setProductWithOptions(product);
      setSelectedVariant(hasVariants ? product.variants![0] : null);
      setActiveOptionNames([]);
      return;
    }
    addToCart(product, variant, []);
  };

  const addToCart = (product: ProductDTO, variant?: ProductVariantDTO | null, optionsList: string[] = []) => {
    if (product.isSoldOut || (variant && variant.isSoldOut)) {
      setNotice(`Artikel "${product.name}" ist derzeit ausverkauft.`);
      return;
    }

    triggerHapticFeedback();
    const optionsDelta = (product.options || [])
      .filter((o) => optionsList.includes(o.name))
      .reduce((sum, o) => sum + (o.priceDelta || 0), 0);

    const { price: effectivePrice } = getEffectiveProductPrice(product as any);
    const unitPrice = effectivePrice + (variant ? variant.priceDelta : 0) + optionsDelta;
    const optionsKey = optionsList.slice().sort().join('|');
    const lineId = `${product.id}_${variant ? variant.name : 'default'}_${optionsKey}_g${activeCourse}${holdNext ? '_h' : ''}`;

    setCart((prev) => {
      const existing = prev.find((i) => i.id === lineId && !i.customizationText);
      if (existing) {
        return prev.map((i) => (i === existing ? { ...i, quantity: i.quantity + 1 } : i));
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
          courseNumber: activeCourse,
          isHold: holdNext,
        },
      ];
    });
  };

  const setLineCourse = (lineId: string, courseNumber: number) => {
    triggerHapticFeedback();
    setCart((prev) => prev.map((i) => (i.id === lineId ? { ...i, courseNumber } : i)));
  };

  const toggleLineHold = (lineId: string) => {
    triggerHapticFeedback();
    setCart((prev) => prev.map((i) => (i.id === lineId ? { ...i, isHold: !i.isHold } : i)));
  };

  const updateQuantity = (lineId: string, delta: number) => {
    triggerHapticFeedback();
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === lineId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleClearCart = () => {
    triggerHapticFeedback();
    if (cart.length === 0) return;
    setCart([]);
    success('Bestellliste geleert');
  };

  const openCustomizer = (item: CartItem) => {
    triggerHapticFeedback();
    setCustomizingItem(item);
    setSelectedPrefix('');
    setSelectedIngredient('');
    setCustomText(item.customizationText || '');
  };

  const addPrefixToText = (prefix: string) => {
    triggerHapticFeedback();
    setSelectedPrefix(prefix);
    if (selectedIngredient) {
      const combined = `${prefix} ${selectedIngredient}`;
      setCustomText((prev) => (prev ? `${prev}, ${combined}` : combined));
      setSelectedPrefix('');
      setSelectedIngredient('');
    }
  };

  const addIngredientToText = (ing: string) => {
    triggerHapticFeedback();
    setSelectedIngredient(ing);
    if (selectedPrefix) {
      const combined = `${selectedPrefix} ${ing}`;
      setCustomText((prev) => (prev ? `${prev}, ${combined}` : combined));
      setSelectedPrefix('');
      setSelectedIngredient('');
    } else {
      setCustomText((prev) => (prev ? `${prev}, ${ing}` : ing));
      setSelectedIngredient('');
    }
  };

  const saveCustomization = () => {
    if (!customizingItem) return;
    triggerHapticFeedback();

    setCart((prev) =>
      prev.map((item) => {
        if (item.id === customizingItem.id) {
          return {
            ...item,
            customizationText: customText.trim() || undefined,
          };
        }
        return item;
      })
    );

    setCustomizingItem(null);
  };

  const submitOrder = async () => {
    if (!tableId || cart.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    triggerHapticFeedback();

    try {
      const deviceId = localStorage.getItem('pos_device_id');
      const payload = {
        tableId,
        waiterName,
        deviceId,
        items: cart.map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          deposit: item.deposit,
          variantName: item.variantName,
          selectedOptions: item.selectedOptions,
          customizationText: item.customizationText,
          courseNumber: item.courseNumber,
          isHold: item.isHold,
        })),
      };

      const result = await sendWithOutboxFallback('ORDER', '/api/orders', payload);

      if (result.success) {
        triggerHapticFeedback();
        playConfirm();
        if (result.queuedOffline) {
          warning('WLAN nicht erreichbar: Bestellung wurde offline gesichert und wird automatisch übertragen.');
        }
        router.push('/waiter');
      } else {
        setNotice(result.error || 'Fehler beim Übermitteln der Bestellung.');
      }
    } catch (e) {
      console.error(e);
      setNotice('Netzwerkfehler beim Absenden der Bestellung.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentCategory = categories.find((c) => c.id === selectedCatId);
  const rawProducts = currentCategory?.products || [];
  const displayedProducts = filterProductsByExcludedAllergens(rawProducts, selectedAllergens);

  const totalAmount = cart.reduce(
    (sum, item) => sum + (item.price + item.deposit) * item.quantity,
    0
  );
  const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-white max-w-full">
      {/* Top Header */}
      <div className="p-2.5 sm:p-3 bg-slate-900 border-b border-slate-700 flex items-center justify-between shadow-md shrink-0">
        <button
          onClick={() => router.push('/waiter')}
          className="pos-touch-btn p-2 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-300 flex items-center gap-1.5 text-xs font-bold transition active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Tische</span>
        </button>

        <div className="text-center">
          <span className="text-[11px] text-slate-400 font-bold block">
            {waiterName} • Tisch:
          </span>
          <h2 className="text-base sm:text-lg font-black text-white leading-none">
            {table ? table.label : `Tisch ${tableId}`}
          </h2>
        </div>

        <div className="text-right">
          <span className="text-[11px] text-slate-400 font-bold block">{totalItemCount} Pos.</span>
          <span className="text-sm sm:text-base font-black text-emerald-400 font-mono">
            {formatCurrency(totalAmount)}
          </span>
        </div>
      </div>

      {/* Jugendschutz & Allergen-Schnellfilter */}
      {enableAgeAlerts && (
        <div className="bg-slate-900/95 border-b border-red-500/20 px-3 py-1.5 flex items-center justify-between text-[11px] font-mono text-slate-300 shrink-0">
          <div className="flex items-center gap-2">
            <span className="bg-red-500/20 text-red-300 border border-red-500/30 px-1.5 py-0.5 rounded font-black text-[10px] flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> JUGENDSCHUTZ
            </span>
            <span>Ab 16 J: <strong className="text-amber-400 font-bold">≤ {minBirth16.formattedDate}</strong></span>
            <span className="text-slate-600">|</span>
            <span>Ab 18 J: <strong className="text-red-400 font-bold">≤ {minBirth18.formattedDate}</strong></span>
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
      )}

      {/* Allergen Filter Dropdown */}
      {showAllergenFilter && (
        <div className="bg-slate-900 border-b border-slate-800 p-2 flex flex-wrap gap-1.5 items-center shrink-0">
          <span className="text-[11px] font-bold text-slate-400 mr-1">Ausschließen:</span>
          {EU_ALLERGENS.slice(0, 8).map((a) => {
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

      {/* Kategorien-Leiste (Eindeutig oben - Extra groß & touchfreundlich) */}
      <div className="bg-slate-900 px-3 py-2.5 border-b border-slate-800 flex items-center gap-2.5 overflow-x-auto shrink-0 shadow-inner">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCatId(cat.id)}
            className={`pos-touch-btn px-5 py-3 rounded-2xl text-sm sm:text-base font-black whitespace-nowrap transition-all border-2 shadow-sm ${
              selectedCatId === cat.id
                ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-950/60 scale-[1.02]'
                : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Gänge-Steuerung (nur wenn aktiviert) */}
      {enableCourses && (
        <div className="bg-slate-900 px-3 py-1.5 border-b border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider shrink-0">
            Buchen auf:
          </span>
          {COURSES.map((c) => (
            <button
              key={c.number}
              onClick={() => {
                triggerHapticFeedback();
                setActiveCourse(c.number);
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap border transition ${
                activeCourse === c.number
                  ? 'bg-violet-600 text-white border-violet-500'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              Gang {c.number}
            </button>
          ))}
          <button
            onClick={() => {
              triggerHapticFeedback();
              setHoldNext((v) => !v);
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap border transition flex items-center gap-1.5 ml-auto shrink-0 ${
              holdNext
                ? 'bg-amber-600 text-white border-amber-500'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {holdNext ? <PauseCircle className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
            <span>{holdNext ? 'HOLD' : 'Sofort'}</span>
          </button>
        </div>
      )}

      {notice && (
        <div className="px-4 py-2 bg-amber-950 border-b border-amber-800 text-amber-200 text-xs font-bold flex items-center justify-between gap-2 shrink-0">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="p-1 shrink-0" aria-label="Schließen">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Hauptbereich: Artikelkacheln mit flexibler voller Höhe & einklappbarem Warenkorb-Drawer */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0 relative">
        {/* ARTIKEL KACHELN: Großzügige Kacheln, große Typografie, maximaler vertikaler Platz */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
            {displayedProducts?.map((product) => {
              const hasVariants = product.variants && product.variants.length > 0;
              const hasOptions = product.options && product.options.length > 0;
              const isOut = product.isSoldOut;
              const { price: effectivePrice, isHappyHour } = getEffectiveProductPrice(product as any);

              return (
                <button
                  key={product.id}
                  disabled={isOut}
                  onClick={() => handleProductClick(product)}
                  className={`pos-touch-btn relative flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl border-2 shadow-md text-left transition ${
                    isOut
                      ? 'bg-slate-950/60 border-rose-900/40 opacity-40 cursor-not-allowed line-through'
                      : 'bg-slate-900 border-slate-700 hover:border-blue-500 active:scale-95'
                  }`}
                  style={{ borderLeftColor: isOut ? '#991b1b' : product.buttonColor || '#3b82f6', borderLeftWidth: '6px' }}
                >
                  <div className="w-full">
                    <div className="flex items-start justify-between gap-1.5">
                      <h3 className="font-black text-sm sm:text-base text-white line-clamp-2 leading-snug tracking-tight">
                        {product.name}
                      </h3>
                      {product.allergens && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProductInfo(product);
                          }}
                          className="text-slate-500 hover:text-amber-400 p-0.5"
                          title="Allergene"
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mt-1.5">
                      {isHappyHour && (
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5" /> HH
                        </span>
                      )}
                      {(product as any).hasAgeRestriction && (
                        <span className="bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-black px-1.5 py-0.5 rounded">
                          {(product as any).minAge}+
                        </span>
                      )}
                      {(hasVariants || hasOptions) && (
                        <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          +Sorten
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between w-full mt-3 pt-1.5 border-t border-slate-800/80">
                    <span className="text-sm sm:text-base font-mono font-black text-emerald-400">
                      {formatCurrency(effectivePrice)}
                    </span>
                    {!isOut && (
                      <div className="w-7 h-7 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200">
                        <Plus className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* EINKLAPPBARER TISCHBESTELLUNGS-DRAWER (Unten) */}
        <div
          className={`bg-slate-900 border-t-2 border-slate-800 shadow-2xl transition-all duration-300 flex flex-col z-20 shrink-0 ${
            cartExpanded ? 'h-[65vh] max-h-[600px]' : 'h-auto'
          }`}
        >
          {/* Header Bar / Toggle Button */}
          <div
            onClick={() => setCartExpanded((prev) => !prev)}
            className="p-3 bg-slate-900 hover:bg-slate-850 cursor-pointer flex items-center justify-between border-b border-slate-800/80 select-none"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-blue-400">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-black text-white block">
                  Tischbestellung ({totalItemCount} Pos.)
                </span>
                <span className="text-[11px] text-slate-400 font-bold font-mono">
                  Summe: {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-400 font-bold flex items-center gap-1 bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
                {cartExpanded ? (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    <span>Einklappen</span>
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    <span>Details &amp; Bearbeiten</span>
                  </>
                )}
              </span>
              {cartExpanded && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearCart();
                  }}
                  disabled={cart.length === 0}
                  className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-30 font-bold flex items-center gap-1 bg-rose-950/40 px-2.5 py-1 rounded-xl border border-rose-800/50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Leeren</span>
                </button>
              )}
            </div>
          </div>

          {/* Ausgeklappte Postenliste (Scrollbar) */}
          {cartExpanded && (
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 bg-slate-950/70">
              {cart.length === 0 ? (
                <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-center text-xs text-slate-500 font-medium">
                  <span>Tippe oben auf Artikel, um sie zur Bestellung hinzuzufügen.</span>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-900 border-2 border-slate-800 rounded-2xl flex flex-col gap-2 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 pr-3">
                        <div className="font-black text-sm sm:text-base text-white truncate leading-snug">
                          {item.name}
                          {item.variantName && (
                            <span className="ml-1.5 text-xs text-blue-400 font-bold">
                              ({item.variantName})
                            </span>
                          )}
                        </div>
                        {item.selectedOptions && item.selectedOptions.length > 0 && (
                          <div className="text-xs text-emerald-400 font-bold mt-0.5">
                            + {item.selectedOptions.join(', ')}
                          </div>
                        )}
                        <div className="text-sm font-mono font-black text-amber-300 mt-1">
                          {formatCurrency((item.price + item.deposit) * item.quantity)}
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-10 h-10 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-100 flex items-center justify-center font-black active:scale-95 border border-slate-700 text-lg"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-black text-base font-mono text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-10 h-10 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center font-black active:scale-95 shadow-md shadow-blue-950 text-lg"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Sonderwunsch Button & Text */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px]">
                      {item.customizationText ? (
                        <span className="text-amber-300 font-semibold italic truncate">
                          Wunsch: {item.customizationText}
                        </span>
                      ) : (
                        <span className="text-slate-500">Kein Sonderwunsch</span>
                      )}

                      <button
                        onClick={() => openCustomizer(item)}
                        className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 bg-blue-950/60 px-2 py-0.5 rounded-lg border border-blue-800/60 shrink-0"
                      >
                        <MessageSquarePlus className="w-3 h-3" />
                        <span>{item.customizationText ? 'Ändern' : '+ Wunsch'}</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Action Button: Immer sichtbar unten (Groß & Prominent) */}
          <div className="p-3 bg-slate-900 border-t border-slate-800 shrink-0">
            <button
              disabled={cart.length === 0 || isSubmitting}
              onClick={submitOrder}
              className={`pos-touch-btn w-full min-h-[58px] py-3.5 rounded-2xl font-black text-base sm:text-lg flex items-center justify-center gap-3 shadow-2xl transition ${
                cart.length > 0 && !isSubmitting
                  ? 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-emerald-950/80 border-2 border-emerald-400'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              <Send className="w-6 h-6" />
              <span>
                {isSubmitting ? 'Wird gesendet & gedruckt...' : `Tischbestellung abschicken (${formatCurrency(totalAmount)})`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Große Touch-Sorten & Optionen-Auswahl Modal */}
      {productWithOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <span className="text-xs text-blue-400 font-bold uppercase">1. Sorte & Zusätze wählen</span>
                <h3 className="text-lg font-black text-white">{productWithOptions.name}</h3>
              </div>
              <button
                onClick={() => setProductWithOptions(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Schritt 1: Varianten / Sorten (z. B. Helles, Dunkles, Russ, Colaweizen) */}
            {productWithOptions.variants && productWithOptions.variants.length > 0 && (
              <div>
                <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider block mb-2">
                  1. Sorte / Variante:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {productWithOptions.variants.map((v) => {
                    const active = selectedVariant?.name === v.name;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariant(v)}
                        className={`p-3.5 rounded-2xl text-xs font-black border text-left transition ${
                          active
                            ? 'bg-blue-600 border-blue-400 text-white shadow-lg'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="truncate font-black text-sm">{v.name}</div>
                        <div className="text-[11px] opacity-85 mt-0.5 font-mono">
                          {v.priceDelta > 0 ? `+${formatCurrency(v.priceDelta)}` : 'Standard'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Schritt 2: Zusätze & Extras (z. B. Zitrone, Eis, etc.) */}
            {productWithOptions.options && productWithOptions.options.length > 0 && (
              <div>
                <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider block mb-2">
                  2. Zusätze & Extras:
                </label>
                <div className="space-y-2 max-h-[25vh] overflow-y-auto">
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
                            ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200 shadow'
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
                            {checked && '✓'}
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
                className="flex-1 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black shadow-lg shadow-blue-950/50"
              >
                In den Korb
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sonderwunsch-Modal (Deduplizierte Textbausteine) */}
      {customizingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <span className="text-xs text-blue-400 font-bold uppercase">Sonderwunsch</span>
                <h3 className="text-lg font-black text-white">{customizingItem.name}</h3>
              </div>
              <button
                onClick={() => setCustomizingItem(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Word Groups Blocks */}
            <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
              {wordGroups.map((group) => {
                const words = parseWordsList(group.words);
                const isPrefixGroup =
                  group.name.toLowerCase().includes('zusatz') ||
                  group.name.toLowerCase().includes('präfix') ||
                  words.some((w) => ['ohne', 'extra', 'wenig', 'viel'].includes(w.toLowerCase()));

                return (
                  <div key={group.id} className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                      {group.name}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {words.map((w, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() =>
                            isPrefixGroup ? addPrefixToText(w) : addIngredientToText(w)
                          }
                          className="pos-touch-btn px-3 py-2 bg-slate-800 hover:bg-slate-700 active:bg-blue-600 active:text-white text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition"
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Freitext / Sonderanweisung:
                </label>
                <input
                  type="text"
                  placeholder="z. B. Bitte extra kross..."
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCustomizingItem(null)}
                className="flex-1 h-12 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-bold uppercase tracking-wider"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={saveCustomization}
                className="flex-1 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-950/50"
              >
                Übernehmen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Eildurchsage Push-Alarm Modal */}
      {urgentBroadcast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in zoom-in-95">
          <div className="bg-rose-950 border-2 border-rose-500 rounded-3xl p-6 max-w-md w-full shadow-2xl text-center space-y-4 animate-pulse">
            <div className="w-16 h-16 rounded-full bg-rose-600 text-white flex items-center justify-center mx-auto shadow-lg">
              <Radio className="w-8 h-8" />
            </div>
            <div>
              <span className="text-xs font-black tracking-widest text-rose-300 uppercase block">
                🚨 Eildurchsage von {urgentBroadcast.sender || 'Kasse / Leitung'}
              </span>
              <p className="text-lg font-black text-white mt-2 break-words">
                {urgentBroadcast.message}
              </p>
            </div>
            <button
              onClick={() => setUrgentBroadcast(null)}
              className="w-full py-3.5 bg-white hover:bg-slate-200 text-rose-950 font-black rounded-2xl text-sm shadow-xl transition"
            >
              Verstanden / Bestätigen
            </button>
          </div>
        </div>
      )}

      {/* Allergen & Product Detail Modal */}
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
                  <span>Jugendschutz: Ab {selectedProductInfo.minAge} Jahren</span>
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

export default function WaiterOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Lade Bestellmaske...</span>
        </div>
      }
    >
      <WaiterOrderContent />
    </Suspense>
  );
}
