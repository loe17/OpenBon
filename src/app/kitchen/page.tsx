'use client';

import React, { useEffect, useState } from 'react';
import { useSocket } from '@/components/providers/socket-provider';
import { playKitchenChime, triggerHapticFeedback } from '@/lib/socket-client';
import { playVoidAlert } from '@/lib/audio-feedback';
import { COURSES } from '@/types/domain';
import {
  ChefHat,
  Clock,
  CheckCircle2,
  ListOrdered,
  Layers,
  Volume2,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  Filter,
  Check,
  Printer,
  Ban,
  Search,
  X,
  CheckSquare,
  Square,
  Eye,
  FileText,
  History,
  RotateCcw,
  Maximize2,
  Minimize2,
} from 'lucide-react';

import StationGate from '@/components/auth/station-gate';
import { useToast } from '@/components/ui/toast';

interface KitchenOrder {
  id: string;
  orderNumber: number;
  tableId?: string | null;
  tableLabel?: string | null;
  table?: { label: string } | null;
  tokenNumber?: number | null;
  waiterName: string;
  status: string;
  createdAt: string;
  items: {
    id: string;
    productName: string;
    quantity: number;
    variantName?: string | null;
    selectedOptions?: string | null;
    customizationText?: string | null;
    kdsStatus: string;
    printStatus?: string;
    courseNumber?: number;
    isHold?: boolean;
    isCancelled?: boolean;
    cancellationReason?: string | null;
    createdAt?: string;
    product?: {
      id?: string;
      categoryId?: string | null;
      category?: { id: string; name: string } | null;
    } | null;
  }[];
}

interface CategoryOption {
  id: string;
  name: string;
  color?: string | null;
}

interface ProductSoldOutItem {
  id: string;
  name: string;
  isSoldOut: boolean;
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
}

interface TableGroupItem {
  id: string;
  orderId: string;
  orderNumber: number;
  waiterName: string;
  productName: string;
  quantity: number;
  variantName?: string | null;
  selectedOptions?: string | null;
  customizationText?: string | null;
  kdsStatus: string;
  printStatus?: string;
  courseNumber?: number;
  isHold?: boolean;
  isCancelled?: boolean;
  cancellationReason?: string | null;
  createdAt: string;
  product?: any;
  categoryName: string;
  isDrink: boolean;
}

interface TableGroup {
  tableKey: string;
  tableLabel: string;
  waiterNames: string[];
  orderNumbers: number[];
  oldestTimestamp: number;
  items: TableGroupItem[];
}

function KitchenMonitorContent() {
  const { socket } = useSocket();
  const { error: toastError, success: toastSuccess } = useToast();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [viewMode, setViewMode] = useState<'TABLE' | 'FIFO'>('TABLE');
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [voidAlert, setVoidAlert] = useState<string | null>(null);

  // KDS Drucksteuerung
  const [kdsControlsPrinting, setKdsControlsPrinting] = useState(false);
  const [kdsPrintDelayTicket, setKdsPrintDelayTicket] = useState(true);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [delayTicketToggles, setDelayTicketToggles] = useState<Record<string, boolean>>({});
  const [isSubmittingPrint, setIsSubmittingPrint] = useState(false);

  // Vollbild & Historie Modal
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyOrders, setHistoryOrders] = useState<KitchenOrder[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  // Ausverkauft-Schnellzugriff & Modal
  const [productsList, setProductsList] = useState<ProductSoldOutItem[]>([]);
  const [showSoldOutModal, setShowSoldOutModal] = useState(false);
  const [soldOutSearch, setSoldOutSearch] = useState('');
  const [soldOutFilterCategory, setSoldOutFilterCategory] = useState<string>('ALL');
  const [togglingProductId, setTogglingProductId] = useState<string | null>(null);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleToggleFullscreen = () => {
    triggerHapticFeedback();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config/public', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setKdsControlsPrinting(Boolean(data.kdsControlsPrinting));
        setKdsPrintDelayTicket(data.kdsPrintDelayTicket ?? true);
      }
    } catch (e) {
      console.error('Fehler beim Laden der KDS-Konfiguration:', e);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (Array.isArray(data)) {
        setCategories(data);
        const validIds = data.filter((c: any) => c?.id).map((c: any) => c.id);
        const saved = localStorage.getItem('openbon_kds_category_filter');
        if (saved) {
          try {
            setSelectedCategoryIds(JSON.parse(saved));
          } catch {
            setSelectedCategoryIds(validIds);
          }
        } else {
          setSelectedCategoryIds(validIds);
        }
      }
    } catch {}
  };

  const fetchKdsOrders = async () => {
    try {
      const res = await fetch('/api/orders?kds=true', { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data)) {
        setOrders(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/orders?kdsHistory=true', { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data)) {
        setHistoryOrders(data);
      }
    } catch (e) {
      console.error('Fehler beim Laden der Historie:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenHistory = () => {
    triggerHapticFeedback();
    setShowHistoryModal(true);
    fetchHistory();
  };

  const handleRestoreItem = async (itemId: string, orderId: string) => {
    triggerHapticFeedback();
    try {
      const res = await fetch('/api/kds/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderItemId: itemId }),
      });
      if (!res.ok) {
        await fetch(`/api/orders/${orderId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId, itemKdsStatus: 'PENDING' }),
        });
      }
      toastSuccess('Position wiederhergestellt');
      fetchKdsOrders();
      fetchHistory();
    } catch {
      toastError('Fehler beim Wiederherstellen');
    }
  };

  const handleRestoreTable = async (tableItems: { id: string; orderId: string }[]) => {
    triggerHapticFeedback();
    try {
      for (const it of tableItems) {
        const res = await fetch('/api/kds/undo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderItemId: it.id }),
        });
        if (!res.ok) {
          await fetch(`/api/orders/${it.orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId: it.id, itemKdsStatus: 'PENDING' }),
          });
        }
      }
      toastSuccess('Tisch wiederhergestellt');
      fetchKdsOrders();
      fetchHistory();
    } catch {
      toastError('Fehler beim Wiederherstellen des Tisches');
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setProductsList(data);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTogglePrintMode = async () => {
    triggerHapticFeedback();
    const nextMode = !kdsControlsPrinting;
    setKdsControlsPrinting(nextMode);
    try {
      const res = await fetch('/api/kds/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kdsControlsPrinting: nextMode }),
      });
      if (res.ok) {
        toastSuccess(
          nextMode
            ? 'Modus geändert: Monitor steuert Druck (Bons drucken erst nach Bestätigung)'
            : 'Modus geändert: Reine Überwachung (Sofortdruck beim Kellner)'
        );
      } else {
        toastError('Fehler beim Umschalten des KDS-Druckmodus');
      }
    } catch {
      toastError('Netzwerkfehler beim Umschalten');
    }
  };

  const handleToggleSoldOut = async (prod: ProductSoldOutItem) => {
    triggerHapticFeedback();
    setTogglingProductId(prod.id);
    const nextVal = !prod.isSoldOut;
    try {
      const res = await fetch(`/api/products/${prod.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSoldOut: nextVal }),
      });
      if (res.ok) {
        setProductsList((prev) =>
          prev.map((p) => (p.id === prod.id ? { ...p, isSoldOut: nextVal } : p))
        );
        if (nextVal) {
          toastSuccess(`"${prod.name}" als ausverkauft markiert`);
        } else {
          toastSuccess(`"${prod.name}" wieder verfügbar`);
        }
      } else {
        const j = await res.json().catch(() => ({}));
        toastError(j.error || 'Fehler beim Ändern des Ausverkauft-Status');
      }
    } catch {
      toastError('Netzwerkfehler beim Ändern des Status');
    } finally {
      setTogglingProductId(null);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchCategories();
    fetchKdsOrders();
    fetchProducts();
    fetchHistory();

    const timer = setInterval(() => setCurrentTime(Date.now()), 10000);

    if (socket) {
      socket.on('order:new', () => {
        playKitchenChime();
        fetchKdsOrders();
        fetchHistory();
      });

      socket.on('kds:item_updated', () => {
        fetchKdsOrders();
        fetchHistory();
      });
      socket.on('kds:order_updated', () => {
        fetchKdsOrders();
        fetchHistory();
      });

      socket.on('kds:mode_updated', (data?: { kdsControlsPrinting?: boolean; kdsPrintDelayTicket?: boolean }) => {
        if (typeof data?.kdsControlsPrinting === 'boolean') {
          setKdsControlsPrinting(data.kdsControlsPrinting);
        }
        if (typeof data?.kdsPrintDelayTicket === 'boolean') {
          setKdsPrintDelayTicket(data.kdsPrintDelayTicket);
        }
      });

      socket.on('product:updated', (updated?: ProductSoldOutItem) => {
        if (updated?.id) {
          setProductsList((prev) =>
            prev.map((p) => (p.id === updated.id ? { ...p, isSoldOut: Boolean(updated.isSoldOut) } : p))
          );
        } else {
          fetchProducts();
        }
      });

      socket.on('order:voided', (payload?: { reason?: string }) => {
        playVoidAlert();
        setVoidAlert(payload?.reason ? `Storno eingegangen: ${payload.reason}` : 'Storno eingegangen');
        setTimeout(() => setVoidAlert(null), 8000);
        fetchKdsOrders();
      });

      socket.on('order:course_released', () => {
        playKitchenChime();
        fetchKdsOrders();
      });
    }

    return () => {
      clearInterval(timer);
      if (socket) {
        socket.off('order:new');
        socket.off('kds:item_updated');
        socket.off('kds:order_updated');
        socket.off('kds:mode_updated');
        socket.off('product:updated');
        socket.off('order:voided');
        socket.off('order:course_released');
      }
    };
  }, [socket]);

  // Item Auswahl / Abhaken
  const toggleItemSelection = (itemId: string) => {
    triggerHapticFeedback();
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const toggleSelectTableItems = (table: TableGroup) => {
    triggerHapticFeedback();
    const openItems = table.items.filter((i) => i.kdsStatus !== 'COMPLETED' && !i.isCancelled);
    const allSelected = openItems.length > 0 && openItems.every((i) => selectedItemIds.has(i.id));

    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        openItems.forEach((i) => next.delete(i.id));
      } else {
        openItems.forEach((i) => next.add(i.id));
      }
      return next;
    });
  };

  const toggleItemDoneDirect = async (orderId: string, itemId: string, currentStatus: string) => {
    triggerHapticFeedback();
    const nextStatus = currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, itemKdsStatus: nextStatus }),
      });
      fetchKdsOrders();
    } catch (e) {
      console.error(e);
    }
  };

  const undoItem = async (itemId: string) => {
    triggerHapticFeedback();
    try {
      const res = await fetch('/api/kds/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderItemId: itemId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toastError(j.error || 'Rückgängig nicht möglich (nur 10 Minuten).');
        return;
      }
      toastSuccess('Position wieder als offen markiert');
      fetchKdsOrders();
    } catch (e) {
      console.error(e);
    }
  };

  // Aktion: Drucken & Bestätigen (Modus "Monitor steuert Druck")
  const handlePrintTableSelection = async (table: TableGroup) => {
    triggerHapticFeedback();
    const openItems = table.items.filter((i) => i.kdsStatus !== 'COMPLETED' && !i.isCancelled);
    const checkedItemIds = openItems.filter((i) => selectedItemIds.has(i.id)).map((i) => i.id);

    if (checkedItemIds.length === 0) {
      toastError('Bitte mindestens einen fertigen Artikel zum Drucken antippen');
      return;
    }

    const remainingItems = openItems.filter((i) => !selectedItemIds.has(i.id));
    const wantDelayTicket = delayTicketToggles[table.tableKey] ?? kdsPrintDelayTicket;

    setIsSubmittingPrint(true);
    try {
      const res = await fetch('/api/kds/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableLabel: table.tableLabel,
          itemIds: checkedItemIds,
          printDelayTicket: wantDelayTicket && remainingItems.length > 0,
          delayedItemIds: remainingItems.map((i) => i.id),
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toastError(j.error || 'Fehler beim Drucken der Bons.');
        return;
      }

      const result = await res.json();
      toastSuccess(
        result.delayTicketPrinted
          ? `${checkedItemIds.length} Position(en) gedruckt + Warte-Bon ausgegeben!`
          : `${checkedItemIds.length} Position(en) gedruckt & fertig!`
      );

      // Gewählte IDs bereinigen
      setSelectedItemIds((prev) => {
        const next = new Set(prev);
        checkedItemIds.forEach((id) => next.delete(id));
        return next;
      });

      fetchKdsOrders();
    } catch (err) {
      toastError('Netzwerkfehler beim KDS-Druck.');
    } finally {
      setIsSubmittingPrint(false);
    }
  };

  // Aktion: Fertig melden ohne Druck (Modus "Reine Überwachung")
  const handleMarkTableDone = async (table: TableGroup) => {
    triggerHapticFeedback();
    const openItems = table.items.filter((i) => i.kdsStatus !== 'COMPLETED' && !i.isCancelled);
    const checkedItemIds = openItems.filter((i) => selectedItemIds.has(i.id)).map((i) => i.id);
    const idsToComplete = checkedItemIds.length > 0 ? checkedItemIds : openItems.map((i) => i.id);

    if (idsToComplete.length === 0) return;

    try {
      for (const it of openItems.filter((i) => idsToComplete.includes(i.id))) {
        await fetch(`/api/orders/${it.orderId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: it.id, itemKdsStatus: 'COMPLETED' }),
        });
      }

      setSelectedItemIds((prev) => {
        const next = new Set(prev);
        idsToComplete.forEach((id) => next.delete(id));
        return next;
      });

      toastSuccess(`${idsToComplete.length} Position(en) als fertig markiert`);
      fetchKdsOrders();
    } catch {
      toastError('Fehler beim Aktualisieren des Status');
    }
  };

  const completeOrder = async (orderId: string) => {
    triggerHapticFeedback();
    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'COMPLETED' }),
      });
      fetchKdsOrders();
    } catch (e) {
      console.error(e);
    }
  };

  const isItemVisible = (item: KitchenOrder['items'][0]) => {
    if (!item) return false;
    if (categories.length === 0) return true;
    if (selectedCategoryIds.length === 0) return false;
    if (selectedCategoryIds.length === categories.length) return true;

    const catId = item.product?.categoryId || item.product?.category?.id;
    if (catId && selectedCategoryIds.includes(catId)) return true;

    const prodCatId = item.product?.categoryId;
    const prodId = item.product?.id || (item as any).productId;

    const itemCatName =
      item.product?.category?.name ||
      (prodCatId ? categories.find((c) => c?.id === prodCatId)?.name : undefined) ||
      (prodId
        ? (categories as any[]).find((c) =>
            c?.products?.some((p: any) => p?.id === prodId)
          )?.name
        : undefined);

    if (itemCatName) {
      const selectedNames = categories
        .filter((c) => c?.id && selectedCategoryIds.includes(c.id))
        .map((c) => c?.name?.trim().toLowerCase())
        .filter(Boolean);
      if (selectedNames.includes(itemCatName.trim().toLowerCase())) {
        return true;
      }
    }

    return false;
  };

  const toggleCategory = (catId: string) => {
    if (!catId) return;
    triggerHapticFeedback();
    let updated: string[];
    if (selectedCategoryIds.includes(catId)) {
      updated = selectedCategoryIds.filter((id) => id !== catId);
    } else {
      updated = [...selectedCategoryIds, catId];
    }
    setSelectedCategoryIds(updated);
    localStorage.setItem('openbon_kds_category_filter', JSON.stringify(updated));
  };

  const selectAllCategories = () => {
    triggerHapticFeedback();
    const all = categories.filter((c) => c?.id).map((c) => c.id);
    setSelectedCategoryIds(all);
    localStorage.setItem('openbon_kds_category_filter', JSON.stringify(all));
  };

  const filteredOrders = orders
    .map((order) => ({
      ...order,
      items: order.items.filter((it) => !it.isCancelled && isItemVisible(it)),
    }))
    .filter((order) => order.items.length > 0);

  // Gruppierung nach Tisch mit FIFO Sortierung (Ältester Tisch ganz rechts)
  const tableGroups: TableGroup[] = React.useMemo(() => {
    const map = new Map<string, TableGroup>();

    for (const order of filteredOrders) {
      const tableLabel = order.tokenNumber
        ? `Marke #${order.tokenNumber}`
        : (order.table?.label || order.tableLabel || 'Theke');
      const tableKey = order.tokenNumber
        ? `token_${order.tokenNumber}`
        : (order.table?.label || order.tableLabel || (order.tableId ? `table_${order.tableId}` : `theke_${order.waiterName || 'kasse'}_${order.id}`));

      if (!map.has(tableKey)) {
        map.set(tableKey, {
          tableKey,
          tableLabel,
          waiterNames: [],
          orderNumbers: [],
          oldestTimestamp: new Date(order.createdAt).getTime(),
          items: [],
        });
      }

      const group = map.get(tableKey)!;
      if (order.waiterName && !group.waiterNames.includes(order.waiterName)) {
        group.waiterNames.push(order.waiterName);
      }
      if (!group.orderNumbers.includes(order.orderNumber)) {
        group.orderNumbers.push(order.orderNumber);
      }

      const orderTime = new Date(order.createdAt).getTime();
      if (orderTime < group.oldestTimestamp) {
        group.oldestTimestamp = orderTime;
      }

      for (const item of order.items) {
        if (!item) continue;
        let categoryName = item.product?.category?.name;
        if (!categoryName && item.product?.categoryId) {
          const foundCat = categories.find((c) => c?.id === item.product?.categoryId);
          if (foundCat) categoryName = foundCat.name;
        }
        if (!categoryName) {
          const catForProd = (categories as any[]).find((c) =>
            c?.products?.some((p: any) => p?.id === (item.product?.id || (item as any).productId))
          );
          if (catForProd) categoryName = catForProd.name;
        }
        if (!categoryName) {
          categoryName = 'Sonstiges';
        }

        const catLower = categoryName.toLowerCase();
        const prodName = item.productName.toLowerCase();
        const isDrink = /getränk|getraenk|bier|wein|alkohol|softdrink|wasser|limo|cola|saft|schnaps|bar|ausschank|theke/i.test(
          catLower + ' ' + prodName
        );

        group.items.push({
          id: item.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          waiterName: order.waiterName,
          productName: item.productName,
          quantity: item.quantity,
          variantName: item.variantName,
          selectedOptions: item.selectedOptions,
          customizationText: item.customizationText,
          kdsStatus: item.kdsStatus,
          printStatus: item.printStatus,
          courseNumber: item.courseNumber,
          isHold: item.isHold,
          isCancelled: item.isCancelled,
          cancellationReason: item.cancellationReason,
          createdAt: order.createdAt,
          product: item.product,
          categoryName,
          isDrink,
        });
      }
    }

    const list = Array.from(map.values());
    // FIFO Sortierung (Ältester Tisch ganz links im Direktblick):
    // Älteste Bestellungen links (kleinster Zeitstempel, höchste Dringlichkeit), neueste rechts (größter Zeitstempel)
    list.sort((a, b) => a.oldestTimestamp - b.oldestTimestamp);

    return list;
  }, [filteredOrders, categories]);

  // Aktive Tische: Nur Tische mit mindestens einer noch offenen (nicht fertigen) Position
  const activeTableGroups: TableGroup[] = React.useMemo(() => {
    return tableGroups.filter((t) =>
      t.items.some((i) => i.kdsStatus !== 'COMPLETED' && !i.isCancelled)
    );
  }, [tableGroups]);

  // Aktive Einzelbestellungen (für FIFO / Order-Ansicht)
  const activeOrders = React.useMemo(() => {
    return filteredOrders.filter((o) =>
      o.items.some((i) => i.kdsStatus !== 'COMPLETED' && !i.isCancelled)
    );
  }, [filteredOrders]);

  // Gruppierung der Historie nach Tischen für den Tag
  const historyTables = React.useMemo(() => {
    const map = new Map<string, {
      tableKey: string;
      tableLabel: string;
      waiterNames: string[];
      orderNumbers: number[];
      completedAt: number;
      items: {
        id: string;
        orderId: string;
        productName: string;
        quantity: number;
        variantName?: string | null;
        selectedOptions?: string | null;
        customizationText?: string | null;
        courseNumber?: number;
      }[];
    }>();

    for (const order of historyOrders) {
      const tableLabel = order.tokenNumber
        ? `Marke #${order.tokenNumber}`
        : (order.table?.label || order.tableLabel || 'Theke');
      const tableKey = order.tokenNumber
        ? `token_${order.tokenNumber}`
        : (order.table?.label || order.tableLabel || (order.tableId ? `table_${order.tableId}` : `theke_${order.waiterName || 'kasse'}_${order.id}`));

      if (!map.has(tableKey)) {
        map.set(tableKey, {
          tableKey,
          tableLabel,
          waiterNames: [],
          orderNumbers: [],
          completedAt: new Date(order.createdAt).getTime(),
          items: [],
        });
      }

      const g = map.get(tableKey)!;
      if (order.waiterName && !g.waiterNames.includes(order.waiterName)) {
        g.waiterNames.push(order.waiterName);
      }
      if (!g.orderNumbers.includes(order.orderNumber)) {
        g.orderNumbers.push(order.orderNumber);
      }
      const orderTime = new Date(order.createdAt).getTime();
      if (orderTime > g.completedAt) g.completedAt = orderTime;

      for (const it of order.items) {
        if (it.kdsStatus === 'COMPLETED' && !it.isCancelled) {
          g.items.push({
            id: it.id,
            orderId: order.id,
            productName: it.productName,
            quantity: it.quantity,
            variantName: it.variantName,
            selectedOptions: it.selectedOptions,
            customizationText: it.customizationText,
            courseNumber: it.courseNumber,
          });
        }
      }
    }

    const list = Array.from(map.values()).filter((t) => t.items.length > 0);
    list.sort((a, b) => b.completedAt - a.completedAt);
    return list;
  }, [historyOrders]);

  const filteredHistoryTables = React.useMemo(() => {
    if (!historySearch.trim()) return historyTables;
    const q = historySearch.toLowerCase();
    return historyTables.filter((t) =>
      t.tableLabel.toLowerCase().includes(q) ||
      t.waiterNames.some((w) => w.toLowerCase().includes(q)) ||
      t.orderNumbers.some((num) => String(num).includes(q)) ||
      t.items.some((i) => i.productName.toLowerCase().includes(q))
    );
  }, [historyTables, historySearch]);

  const historyCount = historyTables.length;

  const backlogMap = new Map<string, number>();
  for (const ord of filteredOrders) {
    for (const item of ord.items) {
      if (item.kdsStatus !== 'COMPLETED') {
        const count = backlogMap.get(item.productName) || 0;
        backlogMap.set(item.productName, count + item.quantity);
      }
    }
  }

  const soldOutCount = productsList.filter((p) => p.isSoldOut).length;

  const filteredSoldOutProducts = productsList.filter((prod) => {
    const matchesSearch = !soldOutSearch || prod.name.toLowerCase().includes(soldOutSearch.toLowerCase());
    if (!matchesSearch) return false;
    if (soldOutFilterCategory === 'SOLDOUT_ONLY') {
      return prod.isSoldOut;
    }
    if (soldOutFilterCategory !== 'ALL') {
      const catId = prod.categoryId || prod.category?.id;
      return catId === soldOutFilterCategory;
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-white">
      {/* Spec 6.4: Storno-Hinweis für die Küche */}
      {voidAlert && (
        <div className="bg-rose-600 text-white px-4 py-2 text-center text-sm font-black tracking-wide uppercase flex items-center justify-center gap-2 shadow-lg animate-pulse shrink-0">
          <AlertTriangle className="w-5 h-5" />
          <span>{voidAlert} – bitte Storno-Bon beachten, nicht zubereiten</span>
        </div>
      )}

      {/* HAUPTBEREICH: TISCH-SPALTEN (Genau ein Tisch/Bon pro Spalte über volle Höhe) */}
      {viewMode === 'TABLE' ? (
        <div
          className="flex-1 overflow-x-auto overflow-y-hidden p-2.5 min-h-0 max-h-full"
          style={{
            display: 'grid',
            gridAutoFlow: 'column',
            gridAutoColumns: 'max(200px, calc((100% - 48px) / 7))',
            gap: '8px',
          }}
        >
          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-400 font-bold col-span-full">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              <span>Lade Küchenübersicht...</span>
            </div>
          ) : activeTableGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 col-span-full">
              <ChefHat className="w-16 h-16 text-slate-700 mb-3" />
              <h3 className="text-lg font-black text-slate-300">Monitor ist bereit</h3>
              <p className="text-xs font-semibold mt-0.5">Aktuell liegen keine offenen Positionen für diese Warengruppen vor.</p>
            </div>
          ) : (
            activeTableGroups.map((table) => {
              const openItems = table.items.filter((i) => i.kdsStatus !== 'COMPLETED' && !i.isCancelled);
              const completedItems = table.items.filter((i) => i.kdsStatus === 'COMPLETED');
              const checkedOpenItems = openItems.filter((i) => selectedItemIds.has(i.id));
              const remainingOpenItems = openItems.filter((i) => !selectedItemIds.has(i.id));

              const elapsedMinutes = Math.floor((currentTime - table.oldestTimestamp) / 60000);
              const isUrgent = elapsedMinutes >= 10;
              const isWarning = elapsedMinutes >= 5 && elapsedMinutes < 10;

              const wantDelayTicket = delayTicketToggles[table.tableKey] ?? kdsPrintDelayTicket;

              const categoryGroups = (() => {
                const map = new Map<string, { color: string; items: TableGroupItem[] }>();
                for (const item of table.items) {
                  const cName = item.categoryName || 'Sonstiges';
                  if (!map.has(cName)) {
                    const catObj = categories.find((c) => c?.name?.trim()?.toLowerCase() === cName.trim().toLowerCase());
                    const prodCatColor = item.product?.category?.color || catObj?.color || '#eab308';
                    map.set(cName, { color: prodCatColor, items: [] });
                  }
                  map.get(cName)!.items.push(item);
                }
                const orderList = categories.map((c) => c?.name?.trim()).filter(Boolean) as string[];
                const sortedKeys = Array.from(map.keys()).sort((a, b) => {
                  const idxA = orderList.indexOf(a);
                  const idxB = orderList.indexOf(b);
                  if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                  if (idxA !== -1) return -1;
                  if (idxB !== -1) return 1;
                  return a.localeCompare(b);
                });
                return sortedKeys
                  .map((name) => {
                    const entry = map.get(name)!;
                    return {
                      name,
                      color: entry.color || '#eab308',
                      items: entry.items.sort((a, b) => (a.courseNumber ?? 1) - (b.courseNumber ?? 1)),
                    };
                  })
                  .filter((group) => group.items.length > 0);
              })();

              return (
                <div
                  key={table.tableKey}
                  className={`h-full max-h-full flex flex-col rounded-xl border bg-slate-900 shadow-md overflow-hidden shrink-0 transition-all ${
                    isUrgent
                      ? 'border-rose-500 shadow-rose-950/60'
                      : isWarning
                      ? 'border-amber-500 shadow-amber-950/40'
                      : 'border-slate-800'
                  }`}
                >
                  {/* Tisch-Kopfzeile (.kds-ticket-header) */}
                  <div className="kds-ticket-header p-2 border-b flex items-center justify-between shrink-0 gap-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-[15px] text-white truncate leading-tight">
                        {table.tableLabel}
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                        #{table.orderNumbers.join(', #')} · {table.waiterNames.join(', ') || 'Kasse'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono font-extrabold text-base text-amber-400 shrink-0">
                        {elapsedMinutes}m
                      </span>

                      <button
                        type="button"
                        onClick={() => toggleSelectTableItems(table)}
                        disabled={openItems.length === 0}
                        title={checkedOpenItems.length === openItems.length && openItems.length > 0 ? 'Auswahl aufheben' : 'Alle Positionen markieren'}
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center transition active:scale-95 ${
                          checkedOpenItems.length === openItems.length && openItems.length > 0
                            ? 'bg-emerald-500 text-white border-emerald-400'
                            : checkedOpenItems.length > 0
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-600/60'
                            : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                    </div>
                  </div>

                  {/* Artikel-Liste des Tisches */}
                  <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-2 overscroll-contain touch-pan-y">
                    {categoryGroups.map((catGroup) => {
                      const openCount = catGroup.items.filter((i) => i.kdsStatus !== 'COMPLETED' && !i.isCancelled).length;
                      const isSingleCategoryFilter = selectedCategoryIds.length === 1 || categories.length <= 1;
                      const showCategoryHeader = !isSingleCategoryFilter && categoryGroups.length > 1;

                      return (
                        <div key={catGroup.name} className="space-y-1.5">
                          {showCategoryHeader && (
                            <div
                              className="flex items-center justify-between px-2 py-0.5 rounded-lg bg-slate-800/90 border border-slate-700/80 shadow-sm text-[11px] font-black uppercase tracking-wider"
                              style={{ borderLeftWidth: 3, borderLeftColor: catGroup.color }}
                            >
                              <span className="truncate" style={{ color: catGroup.color }}>{catGroup.name}</span>
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ml-1"
                                style={{ backgroundColor: `${catGroup.color}25`, color: catGroup.color }}
                              >
                                {openCount > 0 ? `${openCount} offen` : 'erledigt'}
                              </span>
                            </div>
                          )}

                          {catGroup.items.map((item) => (
                            <TableItemCard
                              key={item.id}
                              item={item}
                              isChecked={selectedItemIds.has(item.id)}
                              kdsControlsPrinting={kdsControlsPrinting}
                              onToggleCheck={() => toggleItemSelection(item.id)}
                              onToggleDoneDirect={() => toggleItemDoneDirect(item.orderId, item.id, item.kdsStatus)}
                              onUndo={() => undoItem(item.id)}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>

                  {/* Fußzeile: Aktionen */}
                  <div className="p-2 border-t border-slate-800 shrink-0 bg-slate-950/80 space-y-1.5">
                    {kdsControlsPrinting ? (
                      <>
                        {checkedOpenItems.length > 0 && remainingOpenItems.length > 0 && (
                          <label className="flex items-center justify-between text-[11px] text-amber-300 font-bold bg-amber-950/40 px-2 py-1 rounded-lg border border-amber-800/60 cursor-pointer select-none">
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3 text-amber-400" />
                              <span>Warte-Bon ({remainingOpenItems.length})</span>
                            </span>
                            <input
                              type="checkbox"
                              checked={wantDelayTicket}
                              onChange={() =>
                                setDelayTicketToggles((prev) => ({
                                  ...prev,
                                  [table.tableKey]: !wantDelayTicket,
                                }))
                              }
                              className="w-3.5 h-3.5 rounded text-amber-500 accent-amber-500 cursor-pointer"
                            />
                          </label>
                        )}

                        <button
                          type="button"
                          disabled={isSubmittingPrint || openItems.length === 0}
                          onClick={() => {
                            if (checkedOpenItems.length > 0) {
                              void handlePrintTableSelection(table);
                            } else {
                              toggleSelectTableItems(table);
                            }
                          }}
                          className="h-8 w-full rounded-lg border border-blue-500/80 text-blue-400 hover:bg-blue-950/40 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Bon erhalten</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleMarkTableDone(table)}
                          disabled={openItems.length === 0}
                          className="h-12 w-full rounded-xl bg-[#059669] hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Fertig</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleMarkTableDone(table)}
                        disabled={openItems.length === 0}
                        className="h-12 w-full rounded-xl bg-[#059669] hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Fertig ({openItems.length})</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ALTERNATIVE ANSICHT: EINZELBONS (Klassisches Kachel-Layout) */
        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-slate-400 font-bold">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              <span>Lade Küchenbons...</span>
            </div>
          ) : activeOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <ChefHat className="w-16 h-16 text-slate-700 mb-3" />
              <h3 className="text-lg font-black text-slate-300">Monitor ist bereit</h3>
              <p className="text-xs font-semibold mt-0.5">Aktuell liegen keine offenen Positionen für diese Warengruppen vor.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-start pb-8">
              {activeOrders.map((order) => {
                const elapsedMinutes = Math.floor(
                  (currentTime - new Date(order.createdAt).getTime()) / 60000
                );
                const isUrgent = elapsedMinutes >= 10;
                const isWarning = elapsedMinutes >= 5 && elapsedMinutes < 10;

                return (
                  <div
                    key={order.id}
                    className={`w-full flex flex-col justify-between rounded-3xl border-2 shadow-xl transition-all overflow-hidden ${
                      isUrgent
                        ? 'bg-slate-900 border-rose-500 shadow-rose-950/60'
                        : isWarning
                        ? 'bg-slate-900 border-amber-500 shadow-amber-950/40'
                        : 'bg-slate-900 border-slate-700'
                    }`}
                  >
                    <div className="p-3.5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/40">
                      <div>
                        <div className="font-black text-base text-white flex items-center gap-1.5">
                          {order.tokenNumber ? (
                            <span className="bg-amber-500 text-black px-2.5 py-0.5 rounded-lg text-sm font-black shadow">
                              #{order.tokenNumber}
                            </span>
                          ) : (
                            <span>{order.table?.label || 'Theke'}</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 font-medium">
                          Bedienung: <span className="text-slate-200 font-bold">{order.waiterName || 'Kasse'}</span>
                          <span className="text-slate-400 ml-1 font-semibold">
                            (#{order.orderNumber})
                          </span>
                        </div>
                      </div>

                      <div
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black font-mono shadow ${
                          isUrgent
                            ? 'bg-rose-600 text-white'
                            : isWarning
                            ? 'bg-amber-500 text-black'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>{elapsedMinutes}m</span>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-80 min-h-[90px]">
                      {[...order.items]
                        .sort((a, b) => (a.courseNumber ?? 1) - (b.courseNumber ?? 1))
                        .map((item, idx, arr) => {
                          const isDone = item.kdsStatus === 'COMPLETED';
                          const isVoided = Boolean(item.isCancelled);
                          const course = item.courseNumber ?? 1;
                          const showCourseHeader =
                            arr.some((i) => (i.courseNumber ?? 1) > 1) &&
                            (idx === 0 || (arr[idx - 1].courseNumber ?? 1) !== course);
                          return (
                            <React.Fragment key={item.id}>
                              {showCourseHeader && (
                                <div className="flex items-center gap-2 pt-1 first:pt-0">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-violet-300 bg-violet-950 border border-violet-800 px-2 py-0.5 rounded-lg">
                                    {COURSES.find((c) => c.number === course)?.label ?? `Gang ${course}`}
                                  </span>
                                  <span className="flex-1 h-px bg-slate-800" />
                                </div>
                              )}
                              <div
                                onClick={() => !isVoided && toggleItemDoneDirect(order.id, item.id, item.kdsStatus)}
                                className={`p-3 rounded-2xl border-2 select-none transition-all flex items-start justify-between gap-2.5 ${
                                  isVoided
                                    ? 'bg-rose-950/50 border-rose-700 text-rose-200 line-through cursor-not-allowed'
                                    : isDone
                                    ? 'bg-slate-950/60 border-slate-800/80 opacity-40 line-through cursor-pointer'
                                    : 'bg-slate-950 border-slate-700 hover:border-slate-500 text-white shadow-md cursor-pointer'
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="font-extrabold text-sm flex items-baseline gap-1.5 flex-wrap">
                                    <span className="text-amber-400 font-mono text-base font-black">
                                      {item.quantity}x
                                    </span>
                                    <span>{item.productName}</span>
                                    {isVoided && (
                                      <span className="text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white px-1.5 py-0.5 rounded no-underline">
                                        Storniert
                                      </span>
                                    )}
                                    {item.isHold && !isVoided && (
                                      <span className="text-[10px] font-black uppercase tracking-wider bg-amber-600 text-black px-1.5 py-0.5 rounded">
                                        Zurückgehalten
                                      </span>
                                    )}
                                    {!isVoided && item.printStatus === 'PENDING' && (
                                      <span className="text-[10px] font-black uppercase tracking-wider bg-sky-600 text-white px-1.5 py-0.5 rounded">
                                        Druck wartet
                                      </span>
                                    )}
                                  </div>

                                  {item.variantName && (
                                    <div className="text-xs text-slate-400 ml-5 font-bold">
                                      {item.variantName}
                                    </div>
                                  )}

                                  {item.customizationText && (
                                    <div className="text-xs font-black text-rose-300 ml-5 mt-1 bg-rose-950 px-2 py-0.5 rounded-lg border border-rose-800">
                                      ! {item.customizationText}
                                    </div>
                                  )}
                                </div>

                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                  <div
                                    className={`w-6 h-6 rounded-lg flex items-center justify-center mt-0.5 border ${
                                      isDone
                                        ? 'bg-emerald-600 border-emerald-500 text-white'
                                        : 'border-slate-700 bg-slate-800 text-transparent'
                                    }`}
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </div>
                                  {isDone && !isVoided && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void undoItem(item.id);
                                      }}
                                      className="text-[10px] font-bold text-slate-400 hover:text-white underline px-2 py-1 min-h-[32px]"
                                    >
                                      Rückgängig
                                    </button>
                                  )}
                                </div>
                              </div>
                            </React.Fragment>
                          );
                        })}
                    </div>

                    <div className="p-3 border-t border-slate-800 space-y-2 shrink-0 bg-slate-950/50">
                      <button
                        onClick={() => completeOrder(order.id)}
                        className="pos-touch-btn w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/50"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Bestellung Fertig</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Ausklappbare Warengruppen-Filterleiste (Direkt über der unteren Werkzeugleiste) */}
      {showFilterBar && (
        <div className="bg-slate-950 p-3 border-t-2 border-amber-500/50 space-y-2 animate-in fade-in shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-amber-400 tracking-wider">
              Warengruppen auswählen (z. B. Küche / Grill, Ausschank, Alkoholfrei):
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllCategories}
                className="text-xs text-amber-300 hover:underline font-bold"
              >
                Alle auswählen
              </button>
              <span className="text-slate-600">•</span>
              <button
                type="button"
                onClick={() => {
                  triggerHapticFeedback();
                  setSelectedCategoryIds([]);
                  localStorage.setItem('openbon_kds_category_filter', JSON.stringify([]));
                }}
                className="text-xs text-slate-400 hover:underline font-bold"
              >
                Keine
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {categories.map((cat) => {
              const isSelected = selectedCategoryIds.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-2 border transition active:scale-95 touch-manipulation ${
                    isSelected
                      ? 'bg-amber-500 text-black border-amber-400 shadow-md'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] font-bold ${
                      isSelected ? 'bg-black text-amber-400' : 'border border-slate-600'
                    }`}
                  >
                    {isSelected && <Check className="w-2.5 h-2.5" />}
                  </span>
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Werkzeugleiste unten (60 px Daumen-Zone) */}
      <div className="h-[60px] min-h-[60px] bg-slate-900 border-t border-slate-800 px-3 flex items-center justify-between gap-3 shrink-0 shadow-lg">
        {/* Links: RÜCKSTAND + Rückstand-Pillen */}
        <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 shrink-0">
            RÜCKSTAND:
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 pr-2">
            {backlogMap.size === 0 ? (
              <span className="text-xs text-emerald-400 font-bold whitespace-nowrap">Keine offenen Positionen</span>
            ) : (
              Array.from(backlogMap.entries()).map(([name, qty]) => (
                <span
                  key={name}
                  className="bg-slate-800 text-slate-200 border border-slate-700 px-2 py-0.5 rounded-lg text-[13px] font-black whitespace-nowrap shadow-sm shrink-0"
                >
                  <strong className="text-amber-400">{qty}x</strong> {name}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Rechts: Knöpfe (Ausverkauft, Filter, Wartezeit/Nach Tisch, Historie, Neu laden) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Umschalter: Drucksteuerung vs. Reine Überwachung */}
          <button
            type="button"
            onClick={handleTogglePrintMode}
            className={`h-11 px-2.5 rounded-xl text-xs font-bold transition border flex items-center gap-1.5 ${
              kdsControlsPrinting
                ? 'bg-amber-500 text-black border-amber-400 font-black shadow-amber-950/40'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
            title="Drucksteuerung"
          >
            {kdsControlsPrinting ? <Printer className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span className="hidden xl:inline">{kdsControlsPrinting ? 'Monitor steuert Druck' : 'Reine Überwachung'}</span>
          </button>

          {/* Ausverkauft */}
          <button
            type="button"
            onClick={() => {
              triggerHapticFeedback();
              fetchProducts();
              setShowSoldOutModal(true);
            }}
            className={`h-11 px-3 rounded-xl text-xs font-bold transition border flex items-center gap-1.5 ${
              soldOutCount > 0
                ? 'bg-rose-950/80 text-rose-300 border-rose-600 shadow-md font-black'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
            title="Artikel als ausverkauft sperren oder wieder freigeben"
          >
            <Ban className="w-4 h-4 text-rose-400" />
            <span>Ausverkauft</span>
            {soldOutCount > 0 && (
              <span className="bg-rose-600 text-white px-1.5 py-0.2 rounded text-[10px] font-black animate-pulse">
                {soldOutCount}
              </span>
            )}
          </button>

          {/* Filter */}
          <button
            type="button"
            onClick={() => {
              triggerHapticFeedback();
              setShowFilterBar(!showFilterBar);
            }}
            className={`h-11 px-3 rounded-xl text-xs font-bold transition border flex items-center gap-1.5 ${
              showFilterBar || selectedCategoryIds.length < categories.length
                ? 'bg-amber-500 text-black border-amber-400 shadow font-black'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filter</span>
            {selectedCategoryIds.length < categories.length && (
              <span className="bg-black text-amber-300 px-1.5 py-0.2 rounded text-[10px]">
                {selectedCategoryIds.length}/{categories.length}
              </span>
            )}
          </button>

          {/* Umschalter Wartezeit / Nach Tisch */}
          <div className="h-[38px] p-0.5 flex items-center gap-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('TABLE')}
              className={`h-[32px] px-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                viewMode === 'TABLE' ? 'bg-amber-500 text-black shadow' : 'text-slate-400 hover:text-white'
              }`}
              title="Nach Tisch"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Nach Tisch</span>
            </button>
            <button
              onClick={() => setViewMode('FIFO')}
              className={`h-[32px] px-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                viewMode === 'FIFO' ? 'bg-amber-500 text-black shadow' : 'text-slate-400 hover:text-white'
              }`}
              title="Wartezeit (Einzelbons)"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Wartezeit</span>
            </button>
          </div>

          {/* Historie */}
          <button
            type="button"
            onClick={handleOpenHistory}
            className="h-11 px-3 rounded-xl text-xs font-bold transition border bg-slate-800 text-slate-300 border-slate-700 hover:text-white active:scale-95 flex items-center gap-1.5"
            title="Historie erledigter Tische"
          >
            <History className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Historie</span>
          </button>

          {/* Neu laden */}
          <button
            onClick={() => {
              playKitchenChime();
              fetchKdsOrders();
            }}
            className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center justify-center transition"
            title="Aktualisieren"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
      {showSoldOutModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-600/20 text-rose-400 border border-rose-600/30 rounded-2xl">
                  <Ban className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white">Artikel als ausverkauft sperren</h3>
                  <p className="text-xs text-slate-400">
                    Gesperrte Artikel können von Bedienungen nicht mehr neu eingegeben werden.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSoldOutModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-800 space-y-3 bg-slate-900/50">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Artikel suchen (z.B. Schnitzel, Bier)..."
                  value={soldOutSearch}
                  onChange={(e) => setSoldOutSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  type="button"
                  onClick={() => setSoldOutFilterCategory('ALL')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 ${
                    soldOutFilterCategory === 'ALL'
                      ? 'bg-amber-500 text-black shadow'
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  Alle ({productsList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSoldOutFilterCategory('SOLDOUT_ONLY')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 ${
                    soldOutFilterCategory === 'SOLDOUT_ONLY'
                      ? 'bg-rose-600 text-white shadow'
                      : 'bg-slate-800 text-rose-300 hover:text-white'
                  }`}
                >
                  Nur Gesperrte ({soldOutCount})
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSoldOutFilterCategory(c.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 ${
                      soldOutFilterCategory === c.id
                        ? 'bg-amber-500 text-black shadow'
                        : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-2">
              {filteredSoldOutProducts.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  Keine passenden Artikel gefunden.
                </div>
              ) : (
                filteredSoldOutProducts.map((prod) => (
                  <div
                    key={prod.id}
                    className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                      prod.isSoldOut
                        ? 'bg-rose-950/30 border-rose-800/80 shadow'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${prod.isSoldOut ? 'text-rose-200 line-through' : 'text-white'}`}>
                          {prod.name}
                        </span>
                        {prod.isSoldOut && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white uppercase tracking-wider">
                            Ausverkauft
                          </span>
                        )}
                      </div>
                      {prod.category?.name && (
                        <span className="text-xs text-slate-400">
                          {prod.category.name}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={togglingProductId === prod.id}
                      onClick={() => handleToggleSoldOut(prod)}
                      className={`pos-touch-btn px-4 py-2 rounded-xl text-xs font-black transition active:scale-95 flex items-center gap-1.5 shadow ${
                        prod.isSoldOut
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-rose-600 hover:bg-rose-500 text-white'
                      }`}
                    >
                      {prod.isSoldOut ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Wieder freigeben</span>
                        </>
                      ) : (
                        <>
                          <Ban className="w-4 h-4" />
                          <span>Als ausverkauft sperren</span>
                        </>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60">
              <span className="text-xs text-slate-400">
                {soldOutCount} Artikel aktuell gesperrt
              </span>
              <button
                type="button"
                onClick={() => setShowSoldOutModal(false)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl transition"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Historie Modal für erledigte Tische des Tages */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 rounded-2xl">
                  <History className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white">Erledigte Tische des Tages (Historie)</h3>
                  <p className="text-xs text-slate-400">
                    Alle heute fertiggestellten Tische und Positionen im Überblick mit Option zum Wiederherstellen.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/50 shrink-0">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tisch, Bedienung oder Bon-Nummer suchen..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                />
              </div>
              <button
                type="button"
                onClick={fetchHistory}
                disabled={loadingHistory}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                <span>Aktualisieren</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {loadingHistory ? (
                <div className="flex items-center justify-center p-12 text-slate-400 font-bold gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Lade Historie...</span>
                </div>
              ) : filteredHistoryTables.length === 0 ? (
                <div className="text-center p-12 text-slate-500 font-medium">
                  Keine erledigten Tische {historySearch ? 'für diese Suche ' : ''}vorhanden.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredHistoryTables.map((hTable) => (
                    <div
                      key={hTable.tableKey}
                      className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-md"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                          <div>
                            <span className="font-black text-white text-base">{hTable.tableLabel}</span>
                            <div className="text-xs text-slate-400 mt-0.5">
                              Bedienung: <span className="text-slate-200 font-semibold">{hTable.waiterNames.join(', ') || 'Kasse'}</span>
                              {hTable.orderNumbers.length > 0 && (
                                <span className="text-slate-400 ml-1">(#{hTable.orderNumbers.join(', #')})</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-mono font-bold text-slate-400">
                              {new Date(hTable.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <div className="text-[11px] text-emerald-400 font-bold">
                              {hTable.items.length} Position(en)
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {hTable.items.map((it) => (
                            <div key={it.id} className="text-xs flex items-start justify-between gap-2 py-1 px-2 rounded-lg bg-slate-900 border border-slate-800/80">
                              <div>
                                <span className="font-black text-amber-300 mr-2">{it.quantity}x</span>
                                <span className="font-bold text-slate-200">{it.productName}</span>
                                {it.variantName && <span className="text-slate-400 ml-1">({it.variantName})</span>}
                                {it.selectedOptions && <div className="text-[11px] text-slate-400 ml-5">{it.selectedOptions}</div>}
                                {it.customizationText && (
                                  <div className="text-[11px] font-bold text-rose-300 ml-5">! {it.customizationText}</div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => void handleRestoreItem(it.id, it.orderId)}
                                className="text-[11px] text-emerald-400 hover:text-emerald-300 underline font-semibold shrink-0 ml-2"
                                title="Diese Position zurückholen"
                              >
                                Zurück
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleRestoreTable(hTable.items)}
                        className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-98"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                        <span>Ganzen Tisch wiederherstellen (auf Monitor holen)</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
              <span className="text-xs text-slate-400">
                {historyTables.length} Tisch(e) heute fertiggestellt
              </span>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl transition"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Einzelne Artikelkarte innerhalb einer Tischspalte */
function TableItemCard({
  item,
  isChecked,
  kdsControlsPrinting,
  onToggleCheck,
  onToggleDoneDirect,
  onUndo,
}: {
  item: TableGroupItem;
  isChecked: boolean;
  kdsControlsPrinting: boolean;
  onToggleCheck: () => void;
  onToggleDoneDirect: () => void;
  onUndo: () => void;
}) {
  const isDone = item.kdsStatus === 'COMPLETED';
  const isVoided = Boolean(item.isCancelled);

  return (
    <div
      onClick={() => {
        if (isVoided) return;
        if (isDone) return;
        if (kdsControlsPrinting) {
          onToggleCheck();
        } else {
          onToggleCheck();
        }
      }}
      className={`p-3 rounded-2xl border-2 select-none transition-all flex items-start justify-between gap-2.5 touch-manipulation cursor-pointer ${
        isVoided
          ? 'bg-rose-950/50 border-rose-700 text-rose-200 line-through cursor-not-allowed'
          : isDone
          ? 'bg-slate-950/60 border-slate-800/80 opacity-40 line-through'
          : isChecked
          ? 'bg-emerald-950/40 border-emerald-500 shadow-md text-white'
          : 'bg-slate-950 border-slate-800 hover:border-slate-600 text-white shadow-sm'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="font-extrabold text-sm flex items-baseline gap-1.5 flex-wrap">
          <span className="text-amber-400 font-mono text-base font-black">
            {item.quantity}x
          </span>
          <span className={isChecked ? 'text-emerald-200' : ''}>{item.productName}</span>
          {isVoided && (
            <span className="text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white px-1.5 py-0.5 rounded no-underline">
              Storniert
            </span>
          )}
          {item.isHold && !isVoided && (
            <span className="text-[10px] font-black uppercase tracking-wider bg-amber-600 text-black px-1.5 py-0.5 rounded">
              Zurückgehalten
            </span>
          )}
          {item.courseNumber && item.courseNumber > 1 && (
            <span className="text-[10px] font-black uppercase tracking-widest text-violet-300 bg-violet-950 border border-violet-800 px-1.5 py-0.5 rounded">
              Gang {item.courseNumber}
            </span>
          )}
        </div>

        {item.variantName && (
          <div className="text-xs text-slate-400 ml-5 font-bold">
            {item.variantName}
          </div>
        )}

        {item.selectedOptions && (
          <div className="text-xs text-amber-300/80 ml-5 font-semibold">
            {item.selectedOptions}
          </div>
        )}

        {item.customizationText && (
          <div className="text-xs font-black text-rose-300 ml-5 mt-1 bg-rose-950 px-2 py-0.5 rounded-lg border border-rose-800 inline-block">
            ! {item.customizationText}
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        {/* Checkbox / Status Icon */}
        <div
          className={`w-6 h-6 rounded-lg flex items-center justify-center border transition ${
            isDone
              ? 'bg-slate-800 border-slate-700 text-slate-400'
              : isChecked
              ? 'bg-emerald-600 border-emerald-500 text-white shadow'
              : 'border-slate-700 bg-slate-900 text-transparent hover:border-slate-500'
          }`}
        >
          {isDone ? <Check className="w-3.5 h-3.5" /> : isChecked ? <Check className="w-4 h-4 stroke-[3]" /> : null}
        </div>

        {isDone && !isVoided && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUndo();
            }}
            className="text-[10px] font-bold text-slate-400 hover:text-white underline px-1 py-0.5 mt-0.5"
            title="Versehentlich als erledigt markiert? 10 Minuten lang rückgängig machen"
          >
            Rückgängig
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Session-Gate: prueft beim Laden, ob an dieser Station eine gueltige
 * Anmeldung besteht, und zeigt sonst sofort das PIN-Pad.
 */
export default function KitchenMonitorPage() {
  return (
    <StationGate station="KITCHEN" label="Küchenmonitor" allow={['KITCHEN']}>
      <KitchenMonitorContent />
    </StationGate>
  );
}
