'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Smartphone,
  CreditCard,
  ChefHat,
  Printer,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Layers,
  Sparkles,
  Globe,
  Wifi,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { triggerHapticFeedback } from '@/lib/socket-client';

interface StationQR {
  id: string;
  title: string;
  role: string;
  path: string;
  description: string;
  icon: any;
  qrDataUrl?: string;
  fullUrl?: string;
}

export default function QrCodesPage() {
  const [networkInfo, setNetworkInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [printers, setPrinters] = useState<any[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState('');
  const [useDomainUrl, setUseDomainUrl] = useState(false); // true: openbon.local, false: IP
  const [stations, setStations] = useState<StationQR[]>([
    {
      id: 'waiter',
      title: 'Bedienung (Kellner-Station)',
      role: 'WAITER',
      path: '/waiter',
      description: 'Tischplan, mobile Bestellaufnahme, Sonderwünsche und Rechnungs-Splitting',
      icon: Smartphone,
    },
    {
      id: 'pos',
      title: 'Bonkasse (Theken-Express)',
      role: 'POS_CASHIER',
      path: '/pos',
      description: 'Direktverkauf, Wertmarken, Abholnummern und Kassenladen-Steuerung',
      icon: CreditCard,
    },
    {
      id: 'kitchen',
      title: 'Küchenmonitor (KDS)',
      role: 'KITCHEN',
      path: '/kitchen',
      description: 'Echtzeit-Auftragsanzeige mit Wartezeit-Ampel, Rückstandszähler und Gong',
      icon: ChefHat,
    },
    {
      id: 'printer',
      title: 'Virtueller Drucker-Monitor',
      role: 'ADMIN',
      path: '/virtual-printer',
      description: 'Live-Vorschau aller ESC/POS Thermobelege im Browser',
      icon: Printer,
    },
  ]);

  const fetchNetworkAndGenerate = async (preferDomain = useDomainUrl) => {
    try {
      const [ipRes, prnRes] = await Promise.all([
        fetch('/api/network-ip'),
        fetch('/api/printers'),
      ]);
      const ipData = await ipRes.json();
      const prnData = await prnRes.json();

      setNetworkInfo(ipData);
      if (Array.isArray(prnData)) {
        setPrinters(prnData);
        if (prnData.length > 0) setSelectedPrinterId(prnData[0].id);
      }

      const baseUrl = preferDomain
        ? ipData.localDomainUrl || 'http://openbon.local:3000'
        : ipData.ipBaseUrl || ipData.baseUrl || window.location.origin;

      const generated = await Promise.all(
        stations.map(async (s) => {
          const targetUrl = `${baseUrl}${s.path}`;
          const qrDataUrl = await QRCode.toDataURL(targetUrl, {
            width: 320,
            margin: 1.5,
            color: { dark: '#000000', light: '#ffffff' },
          });
          return { ...s, qrDataUrl, fullUrl: targetUrl };
        })
      );

      setStations(generated);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNetworkAndGenerate(useDomainUrl);
  }, [useDomainUrl]);

  const handleCopy = (id: string, text: string) => {
    triggerHapticFeedback();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePrintQrTicket = async (station: StationQR) => {
    if (!selectedPrinterId) {
      alert('Bitte wähle zuerst einen Drucker aus.');
      return;
    }

    try {
      await fetch('/api/printers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TEST_PRINT', printerId: selectedPrinterId }),
      });

      alert(`Beitritts-Bon für "${station.title}" an den Drucker gesendet!`);
    } catch (e) {
      alert('Druckfehler');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 text-white p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2.5 rounded-2xl shadow">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black">QR-Code Beitritts-Center</h1>
            <p className="text-xs text-slate-400">
              Scanne QR-Codes mit Smartphone oder Tablet, um Geräte direkt in der passenden Rolle einzubinden
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Domain vs IP Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 p-1 rounded-2xl">
            <button
              onClick={() => {
                triggerHapticFeedback();
                setUseDomainUrl(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                !useDomainUrl ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>WLAN-IP</span>
            </button>
            <button
              onClick={() => {
                triggerHapticFeedback();
                setUseDomainUrl(true);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                useDomainUrl ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>openbon.local</span>
            </button>
          </div>

          {printers.length > 0 && (
            <select
              value={selectedPrinterId}
              onChange={(e) => setSelectedPrinterId(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none"
            >
              {printers.map((p) => (
                <option key={p.id} value={p.id}>
                  Drucker: {p.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => fetchNetworkAndGenerate(useDomainUrl)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Neu laden</span>
          </button>
        </div>
      </div>

      {/* Network Server Banner */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 mb-6 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Aktive Server-Adresse:
          </span>
          <div className="text-xl sm:text-3xl font-mono font-black text-blue-400 flex items-center gap-3">
            <span>{useDomainUrl ? networkInfo?.localDomainUrl || 'http://openbon.local:3000' : networkInfo?.ipBaseUrl || 'http://127.0.0.1:3000'}</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {useDomainUrl ? 'mDNS Bonjour' : 'IPv4 Direct'}
            </span>
          </div>
        </div>

        <div className="text-xs text-slate-400 max-w-sm">
          Alle Smartphones im selben WLAN können diese QR-Codes mit der Standard-Kamera scannen und starten sofort ohne Passwort.
        </div>
      </div>

      {/* Stations QR Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Erzeuge QR-Codes...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {stations.map((st) => {
            const Icon = st.icon;
            const isCopied = copiedId === st.id;

            return (
              <div
                key={st.id}
                className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between items-center text-center shadow-xl hover:border-slate-700 transition"
              >
                <div className="w-full flex flex-col items-center">
                  {/* Icon & Title */}
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 mb-3 shadow-inner">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-base text-white mb-1">{st.title}</h3>
                  <p className="text-xs text-slate-400 mb-4 min-h-[32px]">{st.description}</p>

                  {/* QR Image */}
                  <div className="p-3 bg-white rounded-2xl border-4 border-slate-800 shadow-md mb-4 group cursor-pointer">
                    {st.qrDataUrl && (
                      <img
                        src={st.qrDataUrl}
                        alt={`QR Code für ${st.title}`}
                        className="w-44 h-44 object-contain rounded-lg group-hover:scale-105 transition-transform"
                      />
                    )}
                  </div>

                  {/* URL Text Pill */}
                  <div className="w-full bg-slate-950 p-2 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 truncate mb-4 text-center">
                    {st.fullUrl}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="w-full space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(st.id, st.fullUrl || '')}
                      className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-slate-700"
                    >
                      {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>{isCopied ? 'Kopiert!' : 'Link kopieren'}</span>
                    </button>
                    <a
                      href={st.fullUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white rounded-xl text-xs transition border border-slate-700"
                      title="Öffnen"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>

                  <button
                    onClick={() => handlePrintQrTicket(st)}
                    className="w-full py-2 bg-blue-600/20 hover:bg-blue-600 active:scale-95 text-blue-300 hover:text-white border border-blue-500/40 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Auf Bon drucken</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
