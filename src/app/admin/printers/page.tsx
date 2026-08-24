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
} from 'lucide-react';

export default function AdminPrintersPage() {
  const [printers, setPrinters] = useState<any[]>([]);
  const [printGroups, setPrintGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [enableVirtual, setEnableVirtual] = useState(true);

  // Network Scan State
  const [isScanning, setIsScanning] = useState(false);
  const [scannedPrinters, setScannedPrinters] = useState<any[]>([]);
  const [showScanModal, setShowScanModal] = useState(false);

  const [printerForm, setPrinterForm] = useState({
    name: '',
    ipAddress: '192.168.1.200',
    port: 9100,
    paperWidth: 80,
    characterSet: 'CP858',
    isVirtual: false,
  });

  const [groupForm, setGroupForm] = useState({
    id: '',
    name: '',
    printerId: '',
    maxItemsPerTicket: 0,
    autoCut: true,
  });

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
      if (cfgData && cfgData.enableVirtualPrinters !== undefined) {
        setEnableVirtual(cfgData.enableVirtualPrinters);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrintersAndGroups();
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
    } catch {
      alert('Fehler beim Aktualisieren der Druckereinstellung');
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
      alert('Fehler beim Netzwerkscan');
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
      alert(`Drucker ${p.name} erfolgreich hinzugefügt!`);
    } catch {
      alert('Fehler beim Hinzufügen des Druckers');
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
        alert('Virtueller Testbon wurde erfolgreich generiert! Siehe "Virtueller Drucker".');
      } else {
        alert('Testbon an Netzwerkdrucker gesendet!');
      }
    } catch (e) {
      alert('Drucker-Fehler');
    }
  };

  const handleOpenDrawer = async (printerId: string) => {
    try {
      await fetch('/api/printers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'OPEN_DRAWER', printerId }),
      });
      alert('Kassenladen-Impuls ausgelöst!');
    } catch (e) {
      alert('Fehler beim Öffnen der Kassenlade');
    }
  };

  const handleSavePrinter = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/printers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(printerForm),
      });
      setShowPrinterModal(false);
      setPrinterForm({
        name: '',
        ipAddress: '192.168.1.200',
        port: 9100,
        paperWidth: 80,
        characterSet: 'CP858',
        isVirtual: false,
      });
      fetchPrintersAndGroups();
    } catch {
      alert('Fehler beim Speichern');
    }
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/print-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupForm),
      });
      setShowGroupModal(false);
      setGroupForm({ id: '', name: '', printerId: '', maxItemsPerTicket: 0, autoCut: true });
      fetchPrintersAndGroups();
    } catch {
      alert('Fehler beim Speichern der Druckgruppe');
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

          <button
            onClick={() => setShowGroupModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Druckgruppe</span>
          </button>

          <button
            onClick={() => setShowPrinterModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Drucker manuell</span>
          </button>
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
                    <h3 className="font-bold text-base text-white">{p.name}</h3>
                    {p.isVirtual ? (
                      <span className="px-2 py-0.5 bg-blue-950 text-blue-400 border border-blue-800 rounded-full text-[10px] font-bold">
                        Virtuell (Browser)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full text-[10px] font-bold">
                        Netzwerk
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-400 font-mono space-y-1 mb-4">
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
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800">
                  <button
                    onClick={() => handleTestPrint(p.id)}
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition border border-slate-700"
                  >
                    <Send className="w-3 h-3" />
                    <span>Testdruck</span>
                  </button>
                  <button
                    onClick={() => handleOpenDrawer(p.id)}
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition border border-slate-700"
                  >
                    <DoorOpen className="w-3 h-3 text-amber-400" />
                    <span>Lade auf</span>
                  </button>
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
              </div>
            ))}
          </div>
        </div>
      </div>

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
                      <div className="text-xs font-bold text-white">{sp.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {sp.ipAddress}:{sp.port}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddScannedPrinter(sp)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow"
                    >
                      Hinzufügen
                    </button>
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
              <h3 className="font-bold text-lg text-white">Drucker manuell hinzufügen</h3>
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
                  Name / Bezeichnung
                </label>
                <input
                  required
                  type="text"
                  placeholder="z. B. Grill / Ausschank"
                  value={printerForm.name}
                  onChange={(e) => setPrinterForm({ ...printerForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">IP-Adresse</label>
                  <input
                    required
                    type="text"
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

              <div className="flex items-center gap-2 p-2 bg-slate-950 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  id="isVirtual"
                  checked={printerForm.isVirtual}
                  onChange={(e) =>
                    setPrinterForm({ ...printerForm, isVirtual: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-blue-600"
                />
                <label htmlFor="isVirtual" className="text-xs text-slate-300">
                  Als virtuellen Browser-Drucker anlegen
                </label>
              </div>

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
    </div>
  );
}
