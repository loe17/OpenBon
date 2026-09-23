'use client';

import React, { useEffect, useState } from 'react';
import {
  Printer,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Send,
  DoorOpen,
  Check,
  X,
  Layers,
  Sparkles,
  Wifi,
  Search,
  Eye,
  EyeOff,
  Radio,
  Globe,
  ExternalLink,
  ListOrdered,
} from 'lucide-react';

import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { PrintQueueManager } from '@/components/admin/print-queue-manager';

interface PrinterRow {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  paperWidth: number;
  characterSet: string;
  isVirtual: boolean;
  hasCashDrawer?: boolean;
  isActive?: boolean;
  connectionType?: string;
  relayStation?: string | null;
  totalPaperMm?: number;
  rollLengthM?: number;
  sensorNearEndActive?: boolean;
  paperSensorState?: string;
  calibLineMm?: number;
  calibFeedMm?: number;
}

interface PrintGroupRow {
  id: string;
  name: string;
  printerId: string | null;
  fallbackPrinterId?: string | null;
  maxItemsPerTicket: number;
  autoCut: boolean;
  printer?: PrinterRow | null;
}

export default function AdminPrintersPage() {
  const { confirm } = useConfirm();
  const { success, error, warning } = useToast();
  const [printers, setPrinters] = useState<PrinterRow[]>([]);
  const [printGroups, setPrintGroups] = useState<PrintGroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [enableVirtual, setEnableVirtual] = useState(true);
  const [enablePaperNearEnd, setEnablePaperNearEnd] = useState(false);
  const [mainTab, setMainTab] = useState<'CONFIG' | 'QUEUE'>('CONFIG');

  // Network Scan State
  const [isScanning, setIsScanning] = useState(false);
  const [scannedPrinters, setScannedPrinters] = useState<any[]>([]);
  const [showScanModal, setShowScanModal] = useState(false);

  // Paper Adjustment & Calibration Modal
  const [showPaperModal, setShowPaperModal] = useState(false);
  const [selectedPaperPrinter, setSelectedPaperPrinter] = useState<PrinterRow | null>(null);
  const [paperEditMeters, setPaperEditMeters] = useState('0');
  const [paperEditRollM, setPaperEditRollM] = useState('80');
  const [paperEditLineMm, setPaperEditLineMm] = useState('3.75');
  const [paperEditFeedMm, setPaperEditFeedMm] = useState('15.0');

  // Web-Relay Pairing State
  const [pairedRelayPrinterId, setPairedRelayPrinterId] = useState<string | null>(null);

  const [printerForm, setPrinterForm] = useState({
    id: '',
    name: '',
    ipAddress: '192.168.1.200',
    port: 9100,
    paperWidth: 80,
    characterSet: 'CP858',
    isVirtual: false,
    hasCashDrawer: false,
    connectionType: 'NETWORK',
    relayStation: '',
    rollLengthM: 80,
    calibLineMm: 3.75,
    calibFeedMm: 15.0,
  });

  const [groupForm, setGroupForm] = useState({
    id: '',
    name: '',
    printerId: '',
    fallbackPrinterId: '',
    maxItemsPerTicket: 0,
    autoCut: true,
  });

  const [pingStatus, setPingStatus] = useState<Record<string, { online: boolean; latencyMs?: number; isVirtual: boolean }>>({});
  const [pinging, setPinging] = useState(false);

  const checkPrinterPings = async () => {
    setPinging(true);
    try {
      const res = await fetch('/api/printers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'PING_ALL' }),
      });
      const data = await res.json();
      if (data.results) {
        setPingStatus(data.results);
      }
    } catch {} finally {
      setPinging(false);
    }
  };

  const fetchPrintersAndGroups = async () => {
    try {
      const [pRes, pgRes, cfgRes] = await Promise.all([
        fetch('/api/printers'),
        fetch('/api/print-groups'),
        fetch('/api/config'),
      ]);
      const pData = await pRes.json();
      const pgData = await pgRes.json();
      const cfgData = await cfgRes.json();

      if (Array.isArray(pData)) setPrinters(pData);
      if (Array.isArray(pgData)) setPrintGroups(pgData);
      if (cfgData) {
        if (cfgData.enableVirtualPrinters !== undefined) {
          setEnableVirtual(cfgData.enableVirtualPrinters);
        }
        if (cfgData.enablePaperNearEndWarning !== undefined) {
          setEnablePaperNearEnd(cfgData.enablePaperNearEndWarning);
        }
      }
      checkPrinterPings();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrintersAndGroups();

    let socketObj: any = null;
    let cleanupSocket = () => {};

    import('@/lib/socket-client').then(({ getSocket }) => {
      socketObj = getSocket();
      const onPaperUpdated = (data: { printerId: string; totalPaperMm: number }) => {
        if (!data?.printerId) return;
        setPrinters((prev) =>
          prev.map((p) => (p.id === data.printerId ? { ...p, totalPaperMm: data.totalPaperMm } : p))
        );
      };
      const onStatusUpdated = (data: { printerId: string; sensorNearEndActive?: boolean; paperSensorState?: string }) => {
        if (!data?.printerId) return;
        setPrinters((prev) =>
          prev.map((p) =>
            p.id === data.printerId
              ? {
                  ...p,
                  ...(data.sensorNearEndActive !== undefined ? { sensorNearEndActive: data.sensorNearEndActive } : {}),
                  ...(data.paperSensorState !== undefined ? { paperSensorState: data.paperSensorState } : {}),
                }
              : p
          )
        );
      };

      socketObj.on('printer:paper_updated', onPaperUpdated);
      socketObj.on('printer:status_update', onStatusUpdated);

      cleanupSocket = () => {
        socketObj.off('printer:paper_updated', onPaperUpdated);
        socketObj.off('printer:status_update', onStatusUpdated);
      };
    }).catch(() => null);

    // Visibility-aware pinging: Pausiert wenn Fenster minimiert ist (Effizienzoptimierung)
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      checkPrinterPings();
    }, 5000);

    return () => {
      clearInterval(interval);
      cleanupSocket();
    };
  }, []);

  const handleToggleVirtualPrinters = async () => {
    const nextVal = !enableVirtual;
    setEnableVirtual(nextVal);
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enableVirtualPrinters: nextVal }),
      });
      fetchPrintersAndGroups();
      success(nextVal ? 'Virtueller Drucker aktiviert' : 'Virtueller Drucker deaktiviert');
    } catch {
      error('Fehler beim Aktualisieren der Druckereinstellung');
    }
  };

  const handleScanNetwork = async () => {
    setIsScanning(true);
    setShowScanModal(true);
    setScannedPrinters([]);
    try {
      const res = await fetch('/api/printers/scan');
      const data = await res.json();
      setScannedPrinters(data.printers || []);
    } catch {
      error('Fehler beim Netzwerkscan');
    } finally {
      setIsScanning(false);
    }
  };

  const handleAddScannedPrinter = async (p: { ip: string; port: number; name?: string }) => {
    try {
      await fetch('/api/printers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      });
      fetchPrintersAndGroups();
      success(`Drucker ${p.name} erfolgreich hinzugefügt!`);
    } catch {
      error('Fehler beim Hinzufügen des Druckers');
    }
  };

  const handleDeletePrinter = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/printers?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchPrintersAndGroups();
        success(`Drucker "${name}" entfernt`);
      } else {
        const err = await res.json().catch(() => ({}));
        error(err.error || 'Fehler beim Löschen des Druckers');
      }
    } catch {
      error('Netzwerkfehler beim Löschen des Druckers');
    }
  };

  const handleTestPrint = async (printerId: string) => {
    try {
      const res = await fetch('/api/printers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TEST_PRINT', printerId }),
      });
      const data = await res.json();
      if (data.isVirtual) {
        success('Virtueller Testbon erfolgreich generiert!');
      } else {
        success('Testbon an Netzwerkdrucker gesendet!');
      }
    } catch (e) {
      error('Drucker-Fehler beim Testdruck');
    }
  };

  const handleOpenDrawer = async (printerId: string) => {
    try {
      await fetch('/api/printers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'OPEN_DRAWER', printerId }),
      });
      success('Kassenladen-Impuls ausgelöst!');
    } catch (e) {
      error('Fehler beim Öffnen der Kassenlade');
    }
  };

  const openPrinterEditor = (printer?: PrinterRow) => {
    if (printer) {
      setPrinterForm({
        id: printer.id,
        name: printer.name ?? '',
        ipAddress: printer.ipAddress ?? '192.168.1.200',
        port: printer.port ?? 9100,
        paperWidth: printer.paperWidth ?? 80,
        characterSet: printer.characterSet ?? 'CP858',
        isVirtual: Boolean(printer.isVirtual),
        hasCashDrawer: Boolean(printer.hasCashDrawer),
        connectionType: printer.connectionType ?? 'NETWORK',
        relayStation: printer.relayStation ?? '',
        rollLengthM: printer.rollLengthM ?? 80,
        calibLineMm: printer.calibLineMm ?? 3.75,
        calibFeedMm: printer.calibFeedMm ?? 15.0,
      });
    } else {
      setPrinterForm({
        id: '',
        name: '',
        ipAddress: '192.168.1.200',
        port: 9100,
        paperWidth: 80,
        characterSet: 'CP858',
        isVirtual: false,
        hasCashDrawer: false,
        connectionType: 'NETWORK',
        relayStation: '',
        rollLengthM: 80,
        calibLineMm: 3.75,
        calibFeedMm: 15.0,
      });
    }
    setShowPrinterModal(true);
  };

  const openPaperModal = (printer: PrinterRow) => {
    setSelectedPaperPrinter(printer);
    setPaperEditMeters(((printer.totalPaperMm || 0) / 1000).toFixed(2));
    setPaperEditRollM(String(printer.rollLengthM || 80));
    setPaperEditLineMm(String(printer.calibLineMm || 3.75));
    setPaperEditFeedMm(String(printer.calibFeedMm || 15.0));
    setShowPaperModal(true);
  };

  const handleSavePaperAdjust = async () => {
    if (!selectedPaperPrinter) return;
    try {
      const res = await fetch('/api/printers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADJUST_PAPER_METERS',
          printerId: selectedPaperPrinter.id,
          totalPaperMm: Math.round(parseFloat(paperEditMeters || '0') * 1000),
          rollLengthM: parseInt(paperEditRollM || '80', 10),
          calibLineMm: parseFloat(paperEditLineMm || '3.75'),
          calibFeedMm: parseFloat(paperEditFeedMm || '15.0'),
        }),
      });
      if (res.ok) {
        success('Papierverbrauch und Kalibrierung gespeichert!');
        setShowPaperModal(false);
        fetchPrintersAndGroups();
      } else {
        error('Fehler beim Speichern der Papierwerte');
      }
    } catch {
      error('Netzwerkfehler');
    }
  };

  const handleResetRoll = async (printerId: string) => {
    const ok = await confirm({
      title: 'Neue Rolle eingelegt?',
      message: 'Möchten Sie den Papierverbrauch für diesen Drucker auf 0 Meter zurücksetzen und die Vorwarnung quittieren?',
      confirmText: 'Ja, Rolle zurücksetzen',
      cancelText: 'Abbrechen',
    });
    if (!ok) return;

    try {
      const res = await fetch('/api/printers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESET_ROLL', printerId }),
      });
      if (res.ok) {
        success('Rolle zurückgesetzt (0.00 m)!');
        fetchPrintersAndGroups();
      } else {
        error('Fehler beim Zurücksetzen der Rolle');
      }
    } catch {
      error('Netzwerkfehler');
    }
  };

  const handlePairWebRelay = async (printer: PrinterRow) => {
    try {
      if (!('serial' in navigator)) {
        warning('WebSerial wird in diesem Browser nicht unterstützt. Bitte Chrome/Edge auf dem Kassen-PC nutzen oder den Drucker direkt am Server anschließen.');
        return;
      }
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      setPairedRelayPrinterId(printer.id);
      success(`Browser erfolgreich mit USB-Drucker für Station "${printer.relayStation || 'Kasse'}" gekoppelt!`);

      const { getSocket } = await import('@/lib/socket-client');
      const socket = getSocket();
      socket.emit('printer:register_relay', { station: printer.relayStation || 'POS_CASHIER', printerId: printer.id });

      socket.on('printer:relay_job', async (data: any) => {
        if (data.printerId === printer.id || data.relayStation === (printer.relayStation || 'POS_CASHIER')) {
          try {
            const rawBytes = Uint8Array.from(atob(data.rawBase64), (c) => c.charCodeAt(0));
            const writer = port.writable.getWriter();
            await writer.write(rawBytes);
            writer.releaseLock();
            socket.emit('printer:relay_ack', { jobId: data.jobId, printerId: printer.id, success: true });
          } catch (pErr: any) {
            socket.emit('printer:relay_ack', { jobId: data.jobId, printerId: printer.id, success: false, error: pErr.message });
          }
        }
      });
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        error(`Kopplung fehlgeschlagen: ${err.message}`);
      }
    }
  };

  const handleSavePrinter = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Mit ID wird aktualisiert (PUT), ohne ID neu angelegt (POST).
      // Bisher wurde immer POST gesendet – ein Bearbeiten war dadurch unmoeglich.
      const isEdit = Boolean(printerForm.id);
      const res = await fetch('/api/printers', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(printerForm),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        error(body.error || 'Der Drucker konnte nicht gespeichert werden.');
        return;
      }
      setShowPrinterModal(false);
      setPrinterForm({
        id: '',
        name: '',
        ipAddress: '192.168.1.200',
        port: 9100,
        paperWidth: 80,
        characterSet: 'CP858',
        isVirtual: false,
        hasCashDrawer: false,
        connectionType: 'NETWORK',
        relayStation: '',
        rollLengthM: 80,
        calibLineMm: 3.75,
        calibFeedMm: 15.0,
      });
      fetchPrintersAndGroups();
      success('Drucker erfolgreich gespeichert!');
    } catch {
      error('Fehler beim Speichern des Druckers');
    }
  };

  const openGroupEditor = (group?: PrintGroupRow) => {
    setGroupForm({
      id: group?.id ?? '',
      name: group?.name ?? '',
      printerId: group?.printerId ?? '',
      fallbackPrinterId: group?.fallbackPrinterId ?? '',
      maxItemsPerTicket: group?.maxItemsPerTicket ?? 0,
      autoCut: group?.autoCut ?? true,
    });
    setShowGroupModal(true);
  };

  const handleDeleteGroup = async (group: PrintGroupRow) => {
    const ok = await confirm({
      title: 'Druckgruppe löschen?',
      message: `Möchten Sie die Druckgruppe "${group.name}" wirklich unwiderruflich löschen?`,
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      isDestructive: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/print-groups?id=${group.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        error(body.error || 'Die Druckgruppe konnte nicht geloescht werden.');
        return;
      }
      fetchPrintersAndGroups();
      success('Druckgruppe geloescht.');
    } catch {
      error('Verbindungsfehler beim Loeschen der Druckgruppe.');
    }
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Vorhandene Gruppe aktualisieren statt ein Duplikat anzulegen
      const res = await fetch('/api/print-groups', {
        method: groupForm.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupForm),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        error(body.error || 'Die Druckgruppe konnte nicht gespeichert werden.');
        return;
      }
      setShowGroupModal(false);
      setGroupForm({
        id: '',
        name: '',
        printerId: '',
        fallbackPrinterId: '',
        maxItemsPerTicket: 0,
        autoCut: true,
      });
      fetchPrintersAndGroups();
      success('Druckgruppe erfolgreich gespeichert!');
    } catch {
      error('Fehler beim Speichern der Druckgruppe');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 text-white p-3 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2.5 rounded-2xl shadow">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Drucker & Druckgruppen</h1>
            <p className="text-xs text-slate-400">
              ESC/POS Thermodrucker, Netzwerk-Portscan (Port 9100) und Bon-Routen
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Virtual Printer Toggle */}
          <button
            onClick={handleToggleVirtualPrinters}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition border ${
              enableVirtual
                ? 'bg-blue-950/80 text-blue-300 border-blue-700'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
            title="Virtuelle Drucker simulieren Belege im Browser"
          >
            {enableVirtual ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>Virtuelle Drucker: {enableVirtual ? 'EIN' : 'AUS'}</span>
          </button>

          {/* Network Scan Button */}
          <button
            onClick={handleScanNetwork}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition shadow"
          >
            <Search className="w-3.5 h-3.5 text-blue-400" />
            <span>Netzwerk-Scan</span>
          </button>

          {/* Status Ping Check Button */}
          <button
            onClick={checkPrinterPings}
            disabled={pinging}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition shadow disabled:opacity-50"
            title="Prüft die Erreichbarkeit aller IP-Drucker per TCP-Ping auf Port 9100"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${pinging ? 'animate-spin' : ''}`} />
            <span>{pinging ? 'Prüft...' : 'Status prüfen'}</span>
          </button>

          <button
            onClick={() => openGroupEditor()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Druckgruppe</span>
          </button>

          <button
            onClick={() => openPrinterEditor()}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Drucker manuell</span>
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 mb-6">
        <button
          type="button"
          onClick={() => setMainTab('CONFIG')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition ${
            mainTab === 'CONFIG'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>Drucker & Druckgruppen</span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('QUEUE')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition ${
            mainTab === 'QUEUE'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <ListOrdered className="w-4 h-4" />
          <span>Live-Druckerwarteschlange</span>
        </button>
      </div>

      {mainTab === 'QUEUE' ? (
        <PrintQueueManager printers={printers} />
      ) : (
        <>
          {/* Step-by-Step Info Box: Drucker & Druckgruppen Routing */}
          <div className="bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/60 border border-blue-800/60 rounded-3xl p-5 shadow-xl space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span>So funktioniert das automatische Bon-Routing (Drucker → Druckgruppen → Artikel)</span>
          </h2>
          <a
            href="/admin/products"
            className="text-xs font-bold text-blue-300 hover:text-white bg-blue-900/60 px-3 py-1 rounded-xl border border-blue-700 transition"
          >
            Zu den Artikeln →
          </a>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
          <div className="p-3 bg-slate-950/70 rounded-2xl border border-slate-800">
            <span className="font-bold text-blue-400 block mb-1">1. Drucker anlegen (unten links)</span>
            Drucker mit Netzwerk-IP (z. B. 192.168.1.200) oder als &bdquo;Virtueller Drucker&ldquo; für Monitore/Testbetrieb anlegen.
          </div>
          <div className="p-3 bg-slate-950/70 rounded-2xl border border-slate-800">
            <span className="font-bold text-purple-400 block mb-1">2. Druckgruppe zuweisen (unten rechts)</span>
            Druckgruppe (z. B. &bdquo;Küche&ldquo;, &bdquo;Ausschank&ldquo;, &bdquo;Grill&ldquo;) erstellen und mit dem gewünschten Bondrucker verknüpfen.
          </div>
          <div className="p-3 bg-slate-950/70 rounded-2xl border border-slate-800">
            <span className="font-bold text-emerald-400 block mb-1">3. Artikel zuordnen (in Artikelverwaltung)</span>
            In der Artikelverwaltung bei jedem Artikel im Feld &bdquo;Druckgruppe&ldquo; wählen, wo der Bon ausgedruckt werden soll.
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Printers Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Eingerichtete Bondrucker ({printers.length})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {printers.map((p) => (
              <div
                key={p.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg flex flex-col justify-between hover:border-slate-700 transition"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-white">{p.name}</h3>
                      {p.hasCashDrawer && (
                        <span className="px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 rounded-full text-[10px] font-bold flex items-center gap-1">
                          <DoorOpen className="w-3 h-3 text-amber-400" />
                          Lade
                        </span>
                      )}
                    </div>
                    {p.isVirtual ? (
                      <span className="px-2 py-0.5 bg-blue-950 text-blue-400 border border-blue-800 rounded-full text-[10px] font-bold">
                        Virtuell (Browser)
                      </span>
                    ) : pingStatus[p.id]?.online ? (
                      <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full text-[10px] font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Online {pingStatus[p.id]?.latencyMs !== undefined ? `(${pingStatus[p.id].latencyMs}ms)` : ''}
                      </span>
                    ) : pingStatus[p.id] && !pingStatus[p.id].online ? (
                      <span className="px-2 py-0.5 bg-rose-950 text-rose-400 border border-rose-800 rounded-full text-[10px] font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Offline / Getrennt
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full text-[10px] font-bold">
                        Netzwerk
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-400 font-mono space-y-1 mb-3">
                    <div>
                      IP:{' '}
                      <span className="text-slate-200">
                        {p.ipAddress}:{p.port}
                      </span>
                    </div>
                    <div>
                      Breite:{' '}
                      <span className="text-slate-200">{p.paperWidth} mm</span> | Charset:{' '}
                      <span className="text-slate-200">{p.characterSet}</span>
                    </div>
                    <div>
                      Verbindung:{' '}
                      <span className="text-slate-200 font-sans font-medium">
                        {p.connectionType === 'WEB_RELAY'
                          ? `💻 Browser-Relay (${p.relayStation || 'Kasse'})`
                          : p.connectionType === 'USB_SERVER'
                          ? '🔌 Server-Direkt (USB/COM)'
                          : '🌐 Netzwerk (LAN/WLAN)'}
                      </span>
                    </div>
                  </div>

                  {/* Sensorhebel & Bonverbrauchsrechner (nur anzeigen, wenn Rollen-Überwachung in Einstellungen aktiviert ist) */}
                  {enablePaperNearEnd && (
                    <>
                      {/* Sensorhebel-Statusanzeige */}
                      <div className="mb-3">
                        {p.sensorNearEndActive ? (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                            <span>⚠️ Vorwarnhebel aktiv (Papierrolle fast leer)</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span>🟢 Sensorhebel ruht (Ausreichend Papier)</span>
                          </div>
                        )}
                      </div>

                      {/* Bonverbrauchsrechner: Zähler & Rollen-Fortschritt */}
                      <div className="p-2.5 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-1.5 mb-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Papierverbrauch:</span>
                          <span className="font-mono font-bold text-white">
                            {((p.totalPaperMm || 0) / 1000).toFixed(2)} m / {p.rollLengthM || 80} m
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                          {(() => {
                            const usedM = (p.totalPaperMm || 0) / 1000;
                            const rollM = p.rollLengthM || 80;
                            const pct = Math.min(100, Math.round((usedM / rollM) * 100));
                            const barColor = pct > 90 ? 'bg-rose-500' : pct > 75 ? 'bg-amber-400' : 'bg-blue-500';
                            return <div className={`h-full ${barColor} transition-all duration-300`} style={{ width: `${pct}%` }} />;
                          })()}
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <button
                            onClick={() => openPaperModal(p)}
                            className="text-[11px] text-blue-400 hover:text-blue-300 underline font-medium"
                          >
                            Werte &amp; Kalibrierung
                          </button>
                          <button
                            onClick={() => handleResetRoll(p.id)}
                            className="px-2 py-0.5 bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/80 rounded-lg text-[10px] font-bold transition"
                            title="Setzt den Zähler auf 0m und Vorwarnung zurück"
                          >
                            Neue Rolle eingelegt
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Web-Relay Browser-Kopplung (Lösung B) */}
                  {p.connectionType === 'WEB_RELAY' && (
                    <div className="p-2.5 bg-purple-950/30 border border-purple-800/50 rounded-2xl flex items-center justify-between text-xs mb-3">
                      <div>
                        <span className="font-bold text-purple-300 block">Web-Relay Station</span>
                        <span className="text-[10px] text-purple-200/70">
                          {pairedRelayPrinterId === p.id ? '🟢 Browser gekoppelt' : 'USB-Drucker an diesem PC'}
                        </span>
                      </div>
                      <button
                        onClick={() => handlePairWebRelay(p)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shadow ${
                          pairedRelayPrinterId === p.id ? 'bg-emerald-600 text-white' : 'bg-purple-600 hover:bg-purple-500 text-white'
                        }`}
                      >
                        {pairedRelayPrinterId === p.id ? 'Gekoppelt' : 'USB koppeln'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-800">
                  {/* Virtual Printer Monitor Button */}
                  <a
                    href={`/admin/virtual-printer?printerName=${encodeURIComponent(p.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-1.5 px-3 bg-blue-950/60 hover:bg-blue-900/80 text-blue-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition border border-blue-800/60"
                  >
                    <Globe className="w-3.5 h-3.5 text-blue-400" />
                    <span>Virtueller Monitor (Browser) öffnen</span>
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </a>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestPrint(p.id)}
                      className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition border border-slate-700"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Testdruck</span>
                    </button>
                    <button
                      onClick={() => openPrinterEditor(p)}
                      className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition border border-slate-700"
                      title="Drucker bearbeiten"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                    </button>
                    {p.hasCashDrawer && (
                      <button
                        onClick={() => handleOpenDrawer(p.id)}
                        className="py-2 px-3 bg-amber-950/60 hover:bg-amber-900 text-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition border border-amber-800"
                        title="Kassenlade öffnen / testen"
                      >
                        <DoorOpen className="w-3.5 h-3.5 text-amber-400" />
                        <span className="hidden sm:inline">Lade öffnen</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleDeletePrinter(p.id, p.name)}
                      className="py-2 px-3 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition border border-rose-900/50"
                      title="Drucker entfernen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Print Groups Column (1 Col) */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Druckgruppen / Routing ({printGroups.length})
          </h2>

          <div className="space-y-3">
            {printGroups.map((g) => (
              <div
                key={g.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-lg space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-sm">{g.name}</h4>
                  <span className="text-xs text-slate-400 font-mono">
                    {g.printer ? g.printer.name : 'Kein Drucker'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Auto-Cut: {g.autoCut ? 'Ja' : 'Nein'} | Max Items:{' '}
                  {g.maxItemsPerTicket || 'Unbegrenzt'}
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => openGroupEditor(g)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-[11px] font-bold text-slate-200 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Bearbeiten</span>
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(g)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 rounded-xl text-[11px] font-bold text-rose-300 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </>
      )}

      {/* Network Scan Results Modal */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-lg text-white">Netzwerkdrucker-Suche</h3>
              </div>
              <button
                onClick={() => setShowScanModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Durchsucht das lokale Subnetz auf Standard ESC/POS Port 9100.
            </p>

            {isScanning ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3 text-slate-300">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                <span className="text-sm font-semibold">Durchsuche Subnetz...</span>
              </div>
            ) : scannedPrinters.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs bg-slate-950 rounded-2xl p-4 border border-slate-800">
                Keine neuen ESC/POS Drucker auf Port 9100 im Subnetz gefunden.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {scannedPrinters.map((sp, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{sp.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {sp.ipAddress}:{sp.port}
                      </div>
                    </div>
                    {sp.alreadyExists ? (
                      <span className="px-2.5 py-1 bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 rounded-xl text-[11px] font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>Bereits eingerichtet</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAddScannedPrinter(sp)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow"
                      >
                        Hinzufügen
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Add Printer Modal */}
      {showPrinterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-white">{printerForm.id ? 'Drucker bearbeiten' : 'Drucker manuell hinzufügen'}</h3>
              <button
                onClick={() => setShowPrinterModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePrinter} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Verbindungsart
                </label>
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setPrinterForm({
                        ...printerForm,
                        connectionType: 'NETWORK',
                        isVirtual: false,
                        ipAddress: printerForm.ipAddress.startsWith('/dev/') || printerForm.ipAddress.startsWith('COM') ? '192.168.1.200' : printerForm.ipAddress,
                        port: printerForm.port || 9100,
                      });
                    }}
                    className={`py-1.5 text-[10px] sm:text-[11px] font-bold rounded-lg transition ${
                      printerForm.connectionType === 'NETWORK' && !printerForm.isVirtual
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Netzwerk
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPrinterForm({
                        ...printerForm,
                        connectionType: 'USB_SERVER',
                        isVirtual: false,
                        ipAddress: printerForm.ipAddress.startsWith('/dev/') || printerForm.ipAddress.startsWith('COM') ? printerForm.ipAddress : '/dev/usb/lp0',
                        port: 0,
                      });
                    }}
                    className={`py-1.5 text-[10px] sm:text-[11px] font-bold rounded-lg transition ${
                      printerForm.connectionType === 'USB_SERVER' && !printerForm.isVirtual
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Server-USB
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPrinterForm({
                        ...printerForm,
                        connectionType: 'WEB_RELAY',
                        isVirtual: false,
                        relayStation: printerForm.relayStation || 'Kasse 1',
                        ipAddress: '127.0.0.1',
                        port: 0,
                      });
                    }}
                    className={`py-1.5 text-[10px] sm:text-[11px] font-bold rounded-lg transition ${
                      printerForm.connectionType === 'WEB_RELAY' && !printerForm.isVirtual
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Web-Relay
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPrinterForm({
                        ...printerForm,
                        isVirtual: true,
                        ipAddress: '127.0.0.1',
                        port: 9100,
                      });
                    }}
                    className={`py-1.5 text-[10px] sm:text-[11px] font-bold rounded-lg transition ${
                      printerForm.isVirtual
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Virtuell
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Name / Bezeichnung
                </label>
                <input
                  required
                  type="text"
                  placeholder="z. B. Grill / Ausschank / Kasse 1"
                  value={printerForm.name}
                  onChange={(e) => setPrinterForm({ ...printerForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              {printerForm.connectionType === 'NETWORK' && !printerForm.isVirtual && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">IP-Adresse</label>
                    <input
                      required
                      type="text"
                      placeholder="192.168.1.200"
                      value={printerForm.ipAddress}
                      onChange={(e) =>
                        setPrinterForm({ ...printerForm, ipAddress: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">Port</label>
                    <input
                      required
                      type="number"
                      value={printerForm.port}
                      onChange={(e) =>
                        setPrinterForm({ ...printerForm, port: parseInt(e.target.value, 10) })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              )}

              {printerForm.connectionType === 'USB_SERVER' && !printerForm.isVirtual && (
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    Gerätepfad oder COM-Port
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="/dev/usb/lp0 oder COM3"
                    value={printerForm.ipAddress}
                    onChange={(e) =>
                      setPrinterForm({ ...printerForm, ipAddress: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Linux: /dev/usb/lp0 · Windows: COM3 oder Portname
                  </p>
                </div>
              )}

              {printerForm.connectionType === 'WEB_RELAY' && !printerForm.isVirtual && (
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    Relay-Stationsname (Kassen-PC)
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="z. B. Kasse 1 oder POS_CASHIER"
                    value={printerForm.relayStation}
                    onChange={(e) =>
                      setPrinterForm({ ...printerForm, relayStation: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                  <p className="text-[11px] text-purple-300/80 mt-1">
                    Der USB-Drucker wird an diesem PC angeschlossen und im Browser gekoppelt. Alle Geräte können dann darüber drucken.
                  </p>
                </div>
              )}

              {printerForm.isVirtual && (
                <div className="p-2.5 bg-purple-950/40 border border-purple-800/60 rounded-xl text-xs text-purple-300">
                  Virtueller Monitor: Zeigt die Druckausgabe direkt im Browser ohne physischen Drucker an.
                </div>
              )}

              {/* Rollen- und Kalibrierungseinstellungen */}
              <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-300 block">
                  Bon- &amp; Rolleneinstellungen
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Rolle (m)</label>
                    <input
                      type="number"
                      min={5}
                      value={printerForm.rollLengthM}
                      onChange={(e) =>
                        setPrinterForm({ ...printerForm, rollLengthM: parseInt(e.target.value, 10) || 80 })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Zeile (mm)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={printerForm.calibLineMm}
                      onChange={(e) =>
                        setPrinterForm({ ...printerForm, calibLineMm: parseFloat(e.target.value) || 3.75 })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Vorschub (mm)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={printerForm.calibFeedMm}
                      onChange={(e) =>
                        setPrinterForm({ ...printerForm, calibFeedMm: parseFloat(e.target.value) || 15.0 })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  id="hasCashDrawer"
                  checked={printerForm.hasCashDrawer}
                  onChange={(e) =>
                    setPrinterForm({ ...printerForm, hasCashDrawer: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-blue-600"
                />
                <label htmlFor="hasCashDrawer" className="text-xs text-slate-300 font-bold flex items-center gap-1.5 cursor-pointer">
                  <DoorOpen className="w-3.5 h-3.5 text-amber-400" />
                  <span>Kassenlade angeschlossen (Drawer Kick Impuls)</span>
                </label>
              </div>

              {printerForm.hasCashDrawer && (
                <div className="p-2.5 bg-amber-950/30 border border-amber-800/60 rounded-xl flex items-center justify-between gap-2 animate-in fade-in">
                  <span className="text-xs text-amber-300 font-bold flex items-center gap-1.5">
                    <DoorOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>Laden-Test:</span>
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (printerForm.id) {
                        await handleOpenDrawer(printerForm.id);
                      } else {
                        warning('Bitte speichere den Drucker zuerst, um den Impuls zu senden.');
                      }
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1.5 transition active:scale-95"
                  >
                    <DoorOpen className="w-3.5 h-3.5" />
                    <span>Kassenlade jetzt testen / Impuls senden</span>
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPrinterModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bon- und Papierverbrauch / Kalibrierungs-Modal */}
      {showPaperModal && selectedPaperPrinter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-white">Bon- &amp; Papierverbrauch</h3>
                <p className="text-xs text-slate-400">{selectedPaperPrinter.name}</p>
              </div>
              <button
                onClick={() => setShowPaperModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Sensor State Banner */}
              <div className="p-3 rounded-2xl border text-xs">
                {selectedPaperPrinter.sensorNearEndActive ? (
                  <div className="text-amber-300 font-semibold flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                    <span>⚠️ Vorwarnhebel im Drucker ausgelöst: Rolle ist fast leer!</span>
                  </div>
                ) : (
                  <div className="text-emerald-400 font-semibold flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span>🟢 Sensorhebel ruht: Genug Papier auf der Rolle vorhanden.</span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Aktueller Zählerstand (Meter)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paperEditMeters}
                  onChange={(e) => setPaperEditMeters(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Sie können den Wert jederzeit manuell anpassen oder korrigieren.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Rollenlänge (Meter)
                </label>
                <input
                  type="number"
                  step="1"
                  min="5"
                  value={paperEditRollM}
                  onChange={(e) => setPaperEditRollM(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Standard-Thermorollen haben meist 80 m oder 50 m.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    Zeilenhöhe (mm)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="1"
                    value={paperEditLineMm}
                    onChange={(e) => setPaperEditLineMm(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">Standard: 3.75 mm</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    Bon-Vorschub (mm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={paperEditFeedMm}
                    onChange={(e) => setPaperEditFeedMm(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">Standard: 15.0 mm</p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPaperEditMeters('0');
                  }}
                  className="w-full py-2 bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Auf 0 m zurücksetzen (Neue Rolle)</span>
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPaperModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleSavePaperAdjust}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow"
                >
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Druckgruppen-Modal
          Bisher setzte der Knopf "Druckgruppe" nur ein Flag – das Modal wurde
          nie gerendert, weshalb sich keine Druckgruppe anlegen liess. */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-lg text-white">
                  {groupForm.id ? 'Druckgruppe bearbeiten' : 'Neue Druckgruppe'}
                </h3>
              </div>
              <button
                onClick={() => setShowGroupModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
                aria-label="Schließen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Name der Gruppe
                </label>
                <input
                  type="text"
                  required
                  placeholder="z. B. Küche, Ausschank, Kasse"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Drucker</label>
                <select
                  value={groupForm.printerId}
                  onChange={(e) => setGroupForm({ ...groupForm, printerId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-semibold"
                >
                  <option value="">Kein Drucker (nur Bildschirm)</option>
                  {printers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.isVirtual ? '(virtuell)' : `– ${p.ipAddress}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Ersatzdrucker bei Ausfall
                </label>
                <select
                  value={groupForm.fallbackPrinterId}
                  onChange={(e) =>
                    setGroupForm({ ...groupForm, fallbackPrinterId: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-semibold"
                >
                  <option value="">Keiner</option>
                  {printers
                    .filter((p) => p.id !== groupForm.printerId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Tablett-Limit (Positionen pro Bon)
                </label>
                <input
                  type="number"
                  min={0}
                  value={groupForm.maxItemsPerTicket}
                  onChange={(e) =>
                    setGroupForm({
                      ...groupForm,
                      maxItemsPerTicket: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono font-bold"
                />
                <p className="text-[11px] text-slate-500 font-semibold mt-1">
                  0 = unbegrenzt · 1 = Einzelbons je Stück · sonst wird der Druck automatisch
                  auf mehrere Bons mit Kopfzeile &bdquo;BON 1 von 3&ldquo; aufgeteilt.
                </p>
              </div>

              <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-xs font-bold text-slate-300">
                  Bon nach dem Druck automatisch abschneiden
                </span>
                <input
                  type="checkbox"
                  checked={groupForm.autoCut}
                  onChange={(e) => setGroupForm({ ...groupForm, autoCut: e.target.checked })}
                  className="w-5 h-5 rounded bg-slate-800 border-slate-700"
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGroupModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
