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
} from 'lucide-react';

export default function AdminPrintersPage() {
  const [printers, setPrinters] = useState<any[]>([]);
  const [printGroups, setPrintGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);

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
      const [pRes, pgRes] = await Promise.all([fetch('/api/printers'), fetch('/api/print-groups')]);
      const pData = await pRes.json();
      const pgData = await pgRes.json();
      if (Array.isArray(pData)) setPrinters(pData);
      if (Array.isArray(pgData)) setPrintGroups(pgData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrintersAndGroups();
  }, []);

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
      fetchPrintersAndGroups();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (groupForm.id) {
        await fetch('/api/print-groups', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(groupForm),
        });
      } else {
        await fetch('/api/print-groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(groupForm),
        });
      }
      setShowGroupModal(false);
      fetchPrintersAndGroups();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 text-white p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2.5 rounded-2xl">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Drucker & Ausdruckgruppen</h1>
            <p className="text-xs text-slate-400">
              ESC/POS Netzwerk-Thermodrucker (Port 9100), Bon-Splitting und Kassenladen-Steuerung
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setGroupForm({ id: '', name: '', printerId: printers[0]?.id || '', maxItemsPerTicket: 0, autoCut: true });
              setShowGroupModal(true);
            }}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm border border-slate-700 transition"
          >
            <Layers className="w-4 h-4 text-blue-400" />
            <span>Ausdruckgruppe +</span>
          </button>
          <button
            onClick={() => {
              setPrinterForm({ name: '', ipAddress: '192.168.1.200', port: 9100, paperWidth: 80, characterSet: 'CP858', isVirtual: false });
              setShowPrinterModal(true);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-lg shadow-blue-900/30 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Drucker anlegen</span>
          </button>
        </div>
      </div>

      {/* Section 1: Physical & Virtual Printers */}
      <div className="mb-8">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">
          Konfigurierte Netzwerkdrucker ({printers.length})
        </h3>

        {loading ? (
          <div className="flex items-center justify-center h-32 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            <span>Lade Drucker...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {printers.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between shadow-lg"
              >
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-bold text-base text-white">{p.name}</h4>
                    {p.isVirtual ? (
                      <span className="bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                        Virtuell (Browser)
                      </span>
                    ) : (
                      <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Wifi className="w-3 h-3" />
                        <span>LAN / WLAN</span>
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 text-xs text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 mb-3 font-mono">
                    <div>IP: {p.ipAddress}:{p.port}</div>
                    <div>Papier: {p.paperWidth}mm | Kodierung: {p.characterSet}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => handleTestPrint(p.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition"
                  >
                    <Send className="w-3.5 h-3.5 text-blue-400" />
                    <span>Testdruck</span>
                  </button>
                  <button
                    onClick={() => handleOpenDrawer(p.id)}
                    className="p-2 bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white rounded-xl text-xs transition"
                    title="Kassenlade öffnen"
                  >
                    <DoorOpen className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Print Groups (Ausdruckgruppen) */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">
          Ausdruckgruppen & Bon-Splitting ({printGroups.length})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {printGroups.map((pg) => (
            <div
              key={pg.id}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between shadow-lg"
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-base text-white">{pg.name}</h4>
                  <span className="text-xs bg-blue-950 text-blue-300 px-2 py-0.5 rounded border border-blue-800">
                    {pg.printer ? pg.printer.name : 'Kein Drucker'}
                  </span>
                </div>

                <div className="text-xs text-slate-400 space-y-1 bg-slate-950 p-2.5 rounded-xl border border-slate-800 mb-3">
                  <div>
                    Max. Artikel pro Bon:{' '}
                    <span className="font-bold text-white">
                      {pg.maxItemsPerTicket === 0
                        ? 'Unbegrenzt (Sammelbon)'
                        : pg.maxItemsPerTicket === 1
                        ? '1 (Einzel-Zubereitungsbon)'
                        : `${pg.maxItemsPerTicket} (Tablett-Limit)`}
                    </span>
                  </div>
                  <div>Papierschnitt: {pg.autoCut ? 'Automatisch' : 'Manuell'}</div>
                </div>
              </div>

              <button
                onClick={() => {
                  setGroupForm({
                    id: pg.id,
                    name: pg.name,
                    printerId: pg.printerId || '',
                    maxItemsPerTicket: pg.maxItemsPerTicket,
                    autoCut: pg.autoCut,
                  });
                  setShowGroupModal(true);
                }}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Bearbeiten
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Printer Modal */}
      {showPrinterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleSavePrinter}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">Neuen Drucker hinzufügen</h3>
              <button type="button" onClick={() => setShowPrinterModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Druckername *</label>
              <input
                type="text"
                required
                placeholder="z. B. Küche Grillstation"
                value={printerForm.name}
                onChange={(e) => setPrinterForm({ ...printerForm, name: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">IP-Adresse (LAN)</label>
                <input
                  type="text"
                  required
                  placeholder="192.168.1.200"
                  value={printerForm.ipAddress}
                  onChange={(e) => setPrinterForm({ ...printerForm, ipAddress: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Port (Standard 9100)</label>
                <input
                  type="number"
                  value={printerForm.port}
                  onChange={(e) => setPrinterForm({ ...printerForm, port: parseInt(e.target.value) || 9100 })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Papierbreite</label>
                <select
                  value={printerForm.paperWidth}
                  onChange={(e) => setPrinterForm({ ...printerForm, paperWidth: parseInt(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                >
                  <option value={80}>80 mm (Standard)</option>
                  <option value={58}>58 mm (Kompakt)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Zeichensatz</label>
                <select
                  value={printerForm.characterSet}
                  onChange={(e) => setPrinterForm({ ...printerForm, characterSet: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                >
                  <option value="CP858">CP858 (Euro + Umlaute)</option>
                  <option value="PC850">PC850 (Multilingual)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800">
              <input
                type="checkbox"
                id="isVirtual"
                checked={printerForm.isVirtual}
                onChange={(e) => setPrinterForm({ ...printerForm, isVirtual: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded bg-slate-800 border-slate-700"
              />
              <label htmlFor="isVirtual" className="text-xs text-slate-300 font-semibold cursor-pointer">
                Als virtuellen Simulator-Drucker anlegen (Vorschau im Browser)
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPrinterModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-900/30"
              >
                Speichern
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Print Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleSaveGroup}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">Ausdruckgruppe konfigurieren</h3>
              <button type="button" onClick={() => setShowGroupModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Gruppenname *</label>
              <input
                type="text"
                required
                placeholder="z. B. Küche Speisen"
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Ziel-Drucker</label>
              <select
                value={groupForm.printerId}
                onChange={(e) => setGroupForm({ ...groupForm, printerId: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
              >
                {printers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.ipAddress})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">
                Maximale Artikel pro Bon (Splitting)
              </label>
              <select
                value={groupForm.maxItemsPerTicket}
                onChange={(e) => setGroupForm({ ...groupForm, maxItemsPerTicket: parseInt(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
              >
                <option value={0}>Unbegrenzt (Alle auf 1 Bon)</option>
                <option value={1}>1 Artikel pro Bon (Einzel-Zubereitung)</option>
                <option value={2}>Max. 2 Artikel pro Bon</option>
                <option value={4}>Max. 4 Artikel pro Bon (Getränke-Tablett)</option>
                <option value={6}>Max. 6 Artikel pro Bon</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowGroupModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-900/30"
              >
                Speichern
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
