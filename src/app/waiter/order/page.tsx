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
  LayoutList,
  ShieldAlert,
  Sparkles,
  Filter,
  AlertCircle,
  Check,
  BellRing,
} from 'lucide-react';
import { SubCategoryIcon } from '@/components/ui/subcategory-icon';
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
  /** Spec 6.5: Gang-Steuerung */
  courseNumber: number;
  /** Spec 6.5: Zurückhalten bis zum manuellen Postenabruf */
  isHold: boolean;
}

function WaiterOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tableId = searchParams.get('tableId');
  const waiterFromUrl = searchParams.get('waiterName');

  const [table, setTable] = useState<DiningTableDTO | null>(null);
  const [categories, setCategories] = useState<ProductCategoryDTO[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [selectedSubCat, setSelectedSubCat] = useState<string>('ALL');
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [showAllergenFilter, setShowAllergenFilter] = useState(false);
  const [selectedProductInfo, setSelectedProductInfo] = useState<any | null>(null);
  const [enableAgeAlerts, setEnableAgeAlerts] = useState(true);

  const minBirth16 = calculateMinBirthdate(16);
  const minBirth18 = calculateMinBirthdate(18);
  const [cart, setCart] = useState<CartItem[]>([]);
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
  const { socket } = useSocket();

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
        alert(`🚨 EILDURCHSAGE VON ${data.sender || 'KASSE / LEITUNG'}:\n\n${data.message}`);
      };

      const handleInventory = () => {
        fetch('/api/categories')
          .then((r) => r.json())
          .then((data) => {
            if (Array.isArray(data)) setCategories(data);
          })
          .catch(() => {});
      };

      socket.on('broadcast:alert', handleAlert);
      socket.on('inventory:updated', handleInventory);

      return () => {
        socket.off('broadcast:alert', handleAlert);
        socket.off('inventory:updated', handleInventory);
      };
    }
  }, [socket]);

  useEffect(() => {
    const savedWaiter = waiterFromUrl || localStorage.getItem('pos_waiter_name') || 'Bedienung';
    setWaiterName(savedWaiter);

    fetch('/api/categories')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setCategories(data);
          setSelectedCatId(data[0].id);
        }
      })
      .catch(() => {});

    fetch('/api/word-groups')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setWordGroups(data);
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
    // Spec 6.6: aus "Gleiche Runde" übernommene Positionen einlesen
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
        /* Übernahme fehlgeschlagen – Warenkorb bleibt leer */
      }
    }
  }, [tableId, waiterFromUrl, searchParams]);

  const handleProductClick = (product: ProductDTO, variant?: ProductVariantDTO) => {
    const hasOptions = product.options && product.options.length > 0;
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
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      });

      if (res.ok) {
        triggerHapticFeedback();
        playConfirm();
        router.push('/waiter');
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setNotice(err.error || 'Fehler beim Übermitteln der Bestellung.');
      }
    } catch (e) {
      console.error(e);
      setNotice('Netzwerkfehler beim Absenden der Bestellung.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentCategory = categories.find((c) => c.id === selectedCatId);
  const rawProducts = currentCategory?.products?.filter((p) => {
    if (selectedSubCat !== 'ALL' && p.subCategory !== selectedSubCat) return false;
    return true;
  }) || [];

  const displayedProducts = filterProductsByExcludedAllergens(rawProducts, selectedAllergens);

  const totalAmount = cart.reduce(
    (sum, item) => sum + (item.price + item.deposit) * item.quantity,
    0
  );
  const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-white">
      {/* Top Header */}
      <div className="p-3 bg-slate-900 border-b border-slate-700 flex items-center justify-between shadow-md">
        <button
          onClick={() => router.push('/waiter')}
          className="pos-touch-btn p-2 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-300 flex items-center gap-1.5 text-xs font-bold transition active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Tische</span>
        </button>

        <div className="text-center">
          <span className="text-xs text-slate-400 font-bold block">
            {waiterName} • Tisch:
          </span>
          <h2 className="text-base sm:text-lg font-black text-white">
            {table ? table.label : `Tisch ${tableId}`}
          </h2>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-400 font-bold block">{totalItemCount} Pos.</span>
          <span className="text-sm sm:text-base font-black text-emerald-400 font-mono">
            {formatCurrency(totalAmount)}
          </span>
        </div>
      </div>

      {/* Spec V2 §6.1: Dynamischer Jugendschutz-Hinweis mit Mindestgeburtsdatum */}
      {enableAgeAlerts && (
        <div className="bg-slate-900/95 border-b border-red-500/20 px-3 py-1.5 flex items-center justify-between text-[11px] font-mono text-slate-300">
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
        <div className="bg-slate-900 border-b border-slate-800 p-2.5 flex flex-wrap gap-1.5 items-center">
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

      {/* Category Selection Bar */}
      <div className="bg-slate-900 px-3 py-2 border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              setSelectedCatId(cat.id);
              setSelectedSubCat('ALL');
            }}
            className={`pos-touch-btn px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border ${
              selectedCatId === cat.id
                ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-950/50'
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
          { id: 'ALL', label: 'Alle' },
          { id: 'BIER', label: 'Bier' },
          { id: 'WEIN', label: 'Wein' },
          { id: 'ALKOHOLFREI', label: 'Alkoholfrei' },
          { id: 'HEISS', label: 'Heiß' },
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

      {/* Spec 6.5: Gang-Steuerung & Zurückhalten für neu gebuchte Artikel (nur wenn aktiv) */}
      {enableCourses && (
        <div className="bg-slate-900 px-3 py-2 border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider shrink-0">
            Buchen auf
          </span>
          {COURSES.map((c) => (
            <button
              key={c.number}
              onClick={() => {
                triggerHapticFeedback();
                setActiveCourse(c.number);
              }}
              className={`touch-target px-3 rounded-2xl text-xs font-bold whitespace-nowrap border transition ${
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
            className={`touch-target px-3 rounded-2xl text-xs font-bold whitespace-nowrap border transition flex items-center gap-1.5 ml-auto shrink-0 ${
              holdNext
                ? 'bg-amber-600 text-white border-amber-500'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {holdNext ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
            <span>{holdNext ? 'HOLD aktiv' : 'Zurückhalten'}</span>
          </button>
        </div>
      )}

      {notice && (
        <div className="px-4 py-2.5 bg-amber-950 border-b border-amber-800 text-amber-200 text-xs font-bold flex items-center justify-between gap-2">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="p-1 shrink-0" aria-label="Schließen">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Split Area: Products on Left, Cart on Right */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
            {displayedProducts?.map((product) => {
              const hasVariants = product.variants && product.variants.length > 0;
              const hasOptions = product.options && product.options.length > 0;
              const isOut = product.isSoldOut;
              const { price: effectivePrice, isHappyHour } = getEffectiveProductPrice(product as any);

              return (
                <div
                  key={product.id}
                  className={`relative flex flex-col justify-between p-3.5 rounded-3xl border-2 shadow-md transition ${
                    isOut
                      ? 'bg-slate-950/60 border-rose-900/40 opacity-40 cursor-not-allowed line-through'
                      : 'bg-slate-900 border-slate-700 hover:border-blue-500'
                  }`}
                  style={{ borderLeftColor: isOut ? '#991b1b' : product.buttonColor || '#3b82f6', borderLeftWidth: '6px' }}
                >
                  <div className="mb-2">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="font-extrabold text-sm sm:text-base text-white leading-snug">
                        {product.name}
                      </h3>
                      {product.allergens && (
                        <button
                          onClick={() => setSelectedProductInfo(product)}
                          className="text-slate-500 hover:text-amber-400 p-0.5"
                          title="Allergene einsehen"
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-mono font-black text-emerald-400">
                        {formatCurrency(effectivePrice)}
                      </span>
                      {isHappyHour && (
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-black px-1 rounded flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5" /> HH
                        </span>
                      )}
                      {(product as any).hasAgeRestriction && (
                        <span className="bg-red-500/20 text-red-300 border border-red-500/30 text-[9px] font-black px-1 rounded flex items-center gap-0.5">
                          {(product as any).minAge}+
                        </span>
                      )}
                    </div>
                  </div>

                  {/* If product has variants */}
                  {hasVariants ? (
                    <div className="grid grid-cols-1 gap-1.5 mt-2">
                      {product.variants?.map((variant) => {
                        const vOut = isOut || variant.isSoldOut;
                        return (
                          <button
                            key={variant.id}
                            disabled={vOut}
                            onClick={() => (hasOptions ? handleProductClick(product, variant) : addToCart(product, variant))}
                            className={`pos-touch-btn py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-between border transition ${
                              vOut
                                ? 'bg-slate-950 text-slate-600 border-slate-900 line-through'
                                : 'bg-slate-800 hover:bg-blue-600 hover:border-blue-500 active:scale-95 text-slate-200 border-slate-700'
                            }`}
                          >
                            <span>{variant.name}</span>
                            <span className="font-mono text-emerald-300">
                              {formatCurrency(effectivePrice + variant.priceDelta)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <button
                      disabled={isOut}
                      onClick={() => handleProductClick(product)}
                      className={`pos-touch-btn w-full mt-2 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow-md transition ${
                        isOut
                          ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-500 active:scale-95 text-white shadow-blue-950/50'
                      }`}
                    >
                      {isOut ? (
                        <span>Ausverkauft</span>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>{hasOptions ? 'Optionen' : 'Buchen'}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Cart Bottom Sheet (Mobile) / Sidebar (Desktop) */}
        <div className="w-full lg:w-[380px] bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-700 p-4 flex flex-col justify-between shadow-2xl overflow-y-auto max-h-[45vh] lg:max-h-full">
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Aktuelle Tischbestellung
              </span>
              <button
                onClick={() => setCart([])}
                disabled={cart.length === 0}
                className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-30 font-semibold"
              >
                Korb leeren
              </button>
            </div>

            {/* Cart Items List */}
            <div className="space-y-2.5 overflow-y-auto max-h-48 lg:max-h-[calc(100vh-320px)] pr-1">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 font-medium">
                  Noch keine Artikel ausgewählt.
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col gap-2 shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 pr-2">
                        <div className="font-extrabold text-sm text-white">
                          {item.name}
                          {item.variantName && (
                            <span className="ml-1 text-xs text-blue-400 font-normal">
                              ({item.variantName})
                            </span>
                          )}
                        </div>
                        {item.selectedOptions && item.selectedOptions.length > 0 && (
                          <div className="text-[11px] text-emerald-400 font-medium">
                            + {item.selectedOptions.join(', ')}
                          </div>
                        )}
                        <div className="text-xs font-mono font-bold text-slate-400">
                          {formatCurrency((item.price + item.deposit) * item.quantity)}
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-black active:scale-95 border border-slate-700"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center font-black text-sm font-mono">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center font-black active:scale-95 shadow"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Customization Text / Sonderwunsch Button */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                      {item.customizationText ? (
                        <div className="text-xs text-amber-300 font-semibold italic flex items-center gap-1">
                          <span>Wunsch: {item.customizationText}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500">Kein Sonderwunsch</span>
                      )}

                      <button
                        onClick={() => openCustomizer(item)}
                        className="text-[11px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 bg-blue-950/60 px-2 py-0.5 rounded-lg border border-blue-800/60"
                      >
                        <MessageSquarePlus className="w-3 h-3" />
                        <span>{item.customizationText ? 'Ändern' : '+ Wunsch'}</span>
                      </button>
                    </div>

                    {/* Spec 6.5: Gang und HOLD je Position ändern (nur wenn Gänge aktiv) */}
                    {enableCourses && (
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                        <div className="flex items-center gap-1">
                          {COURSES.map((c) => (
                            <button
                              key={c.number}
                              onClick={() => setLineCourse(item.id, c.number)}
                              title={c.label}
                              className={`w-8 h-8 rounded-lg text-[11px] font-black border transition ${
                                item.courseNumber === c.number
                                  ? 'bg-violet-600 text-white border-violet-500'
                                  : 'bg-slate-900 text-slate-500 border-slate-800'
                              }`}
                            >
                              G{c.number}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => toggleLineHold(item.id)}
                          className={`text-[11px] font-bold flex items-center gap-1 px-2 py-1 rounded-lg border transition ${
                            item.isHold
                              ? 'bg-amber-950 text-amber-300 border-amber-700'
                              : 'bg-slate-900 text-slate-500 border-slate-800'
                          }`}
                        >
                          {item.isHold ? (
                            <PauseCircle className="w-3.5 h-3.5" />
                          ) : (
                            <PlayCircle className="w-3.5 h-3.5" />
                          )}
                          <span>{item.isHold ? 'Zurückgehalten' : 'Sofort'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-3 border-t border-slate-800">
            <button
              disabled={cart.length === 0 || isSubmitting}
              onClick={submitOrder}
              className={`pos-touch-btn w-full h-14 rounded-2xl font-black text-base flex items-center justify-center gap-2 shadow-2xl transition ${
                cart.length > 0 && !isSubmitting
                  ? 'bg-blue-600 hover:bg-blue-500 active:scale-95 text-white shadow-blue-950/60'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              <Send className="w-5 h-5" />
              <span>
                {isSubmitting ? 'Wird gesendet & gedruckt...' : `Bestellen (${formatCurrency(totalAmount)})`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Options / Variant Selection Modal */}
      {productWithOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <span className="text-xs text-blue-400 font-bold uppercase">Auswahl & Zusätze</span>
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
                            ? 'bg-blue-600 border-blue-400 text-white shadow'
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

      {/* Customization Popup Modal */}
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

              {/* Free Text Input */}
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Freitext oder Sonderanweisung an die Küche:
                </label>
                <input
                  type="text"
                  placeholder="z. B. Bitte extra knusprig..."
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                />
              </div>
            </div>

            {/* Buttons */}
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
