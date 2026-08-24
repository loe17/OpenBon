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
  Globe,
  Lock,
  FileDown,
  Utensils,
  LayoutGrid,
} from 'lucide-react';
import { triggerHapticFeedback } from '@/lib/socket-client';
import type { LucideIcon } from 'lucide-react';

interface NetworkInfo {
  localIp?: string;
  localDomainUrl?: string;
  ipBaseUrl?: string;
  hostname?: string;
  port?: number;
}

interface StationQR {
  id: string;
  title: string;
  role: string;
  path: string;
  description: string;
  pin: string;
  icon: LucideIcon;
  qrDataUrl?: string;
  fullUrl?: string;
}

export default function QrCodesPage() {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [printers, setPrinters] = useState<any[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState('');
  const [useDomainUrl, setUseDomainUrl] = useState(false);
  const [pins, setPins] = useState({
    adminPin: '1234',
    posPin: '1111',
    kitchenPin: '2222',
    waiterPin: '3333',
  });

  const [stations, setStations] = useState<StationQR[]>([
    {
      id: 'waiter',
      title: 'Bedienung (Kellner-Station)',
      role: 'WAITER',
      path: '/waiter',
      description: 'Tischplan, mobile Bestellaufnahme, Sonderwünsche und Rechnungs-Splitting',
      pin: '3333',
      icon: Smartphone,
    },
    {
      id: 'pos',
      title: 'Bonkasse (Theken-Express)',
      role: 'POS_CASHIER',
      path: '/pos',
      description: 'Direktverkauf, Wertmarken, Abholnummern und Kassenladen-Steuerung',
      pin: '1111',
      icon: CreditCard,
    },
    {
      id: 'kitchen',
      title: 'Küchenmonitor (KDS)',
      role: 'KITCHEN',
      path: '/kitchen',
      description: 'Echtzeit-Auftragsanzeige mit Wartezeit-Ampel, Rückstandszähler und Gong',
      pin: '2222',
      icon: ChefHat,
    },
    {
      id: 'guest',
      title: 'Gäste-Tischbestellung (BYOD)',
      role: 'GUEST',
      path: '/guest/table/1',
      description: 'Gäste scannen den QR-Code am Tisch (z. B. Tisch 1) und bestellen direkt ohne Login',
      pin: 'Kein PIN (Öffentlich)',
      icon: Utensils,
    },
    {
      id: 'kiosk',
      title: 'SB-Bestellkiosk (Kiosk-Terminal)',
      role: 'KIOSK',
      path: '/kiosk',
      description: 'Selbstbedienungs-Terminal für Gäste mit automatischer Abholnummer',
      pin: 'Kein PIN (Öffentlich)',
      icon: LayoutGrid,
    },
    {
      id: 'admin',
      title: 'Admin Command Center',
      role: 'ADMIN',
      path: '/admin/dashboard',
      description: 'Zentrale Verwaltung, Artikel, Berichte, TSE, Drucker und Systemstatus',
      pin: '1234',
      icon: ShieldCheck,
    },
    {
      id: 'printer',
      title: 'Virtueller Drucker-Monitor',
      role: 'ADMIN',
      path: '/virtual-printer',
      description: 'Live-Vorschau aller ESC/POS Thermobelege im Browser',
      pin: '1234',
      icon: Printer,
    },
  ]);

  const fetchNetworkAndGenerate = async (preferDomain = useDomainUrl) => {
    try {
      const [ipRes, prnRes, cfgRes] = await Promise.all([
        fetch('/api/network-ip'),
        fetch('/api/printers'),
        fetch('/api/config'),
      ]);
      const ipData = await ipRes.json();
      const prnData = await prnRes.json();
      const cfgData = await cfgRes.json();

      setNetworkInfo(ipData);
      if (Array.isArray(prnData)) {
        setPrinters(prnData);
        if (prnData.length > 0) setSelectedPrinterId(prnData[0].id);
      }

      const activePins = {
        adminPin: cfgData?.adminPin || '1234',
        posPin: cfgData?.posPin || '1111',
        kitchenPin: cfgData?.kitchenPin || '2222',
        waiterPin: cfgData?.waiterPin || '3333',
      };
      setPins(activePins);

      const baseUrl = preferDomain
        ? ipData.localDomainUrl || 'http://openbon.local:3000'
        : ipData.ipBaseUrl || ipData.baseUrl || window.location.origin;

      const generated = await Promise.all(
        stations.map(async (s) => {
          let sPin = activePins.adminPin;
          if (s.id === 'waiter') sPin = activePins.waiterPin;
          else if (s.id === 'pos') sPin = activePins.posPin;
          else if (s.id === 'kitchen') sPin = activePins.kitchenPin;
          else if (s.id === 'guest' || s.id === 'kiosk') sPin = 'Kein PIN (Öffentlich)';

          const targetUrl = `${baseUrl}${s.path}`;
          const qrDataUrl = await QRCode.toDataURL(targetUrl, {
            width: 320,
            margin: 1.5,
            color: { dark: '#000000', light: '#ffffff' },
          });
          return { ...s, pin: sPin, qrDataUrl, fullUrl: targetUrl };
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
      const res = await fetch('/api/printers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'PRINT_STATION_TICKET',
          printerId: selectedPrinterId,
          title: station.title,
          role: station.role,
          description: station.description,
          url: station.fullUrl,
          pin: station.pin,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(`Beitritts-Bon für "${station.title}" erfolgreich gedruckt!`);
      } else {
        alert(`Druckfehler: ${data.error || 'Unbekannt'}`);
      }
    } catch {
      alert('Verbindungsfehler zum Drucker');
    }
  };

  const handleBrowserPrint = () => {
    window.print();
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
          <button
            onClick={handleBrowserPrint}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition shadow"
          >
            <FileDown className="w-4 h-4" />
            <span>Alle QR-Codes drucken / PDF</span>
          </button>

          <button
            onClick={() => fetchNetworkAndGenerate(useDomainUrl)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Aktualisieren</span>
          </button>
        </div>
      </div>

      {/* Domain / IP Toggle Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800 rounded-xl text-blue-400">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-300">Netzwerk-Zugriffsmodus</div>
            <div className="text-xs text-slate-400">
              Aktuell:{' '}
              <span className="text-white font-mono font-bold">
                {useDomainUrl
                  ? networkInfo?.localDomainUrl || 'http://openbon.local:3000'
                  : networkInfo?.ipBaseUrl || 'IP-Adresse'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setUseDomainUrl(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                !useDomainUrl ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              IP-Adresse ({networkInfo?.localIp || '192.168.x.x'})
            </button>
            <button
              onClick={() => setUseDomainUrl(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                useDomainUrl ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              mDNS Name (openbon.local)
            </button>
          </div>

          {/* Printer Selector */}
          {printers.length > 0 && (
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-slate-400" />
              <select
                value={selectedPrinterId}
                onChange={(e) => setSelectedPrinterId(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {printers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.isVirtual ? '(Virtuell)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Grid of Stations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stations.map((station) => {
          const Icon = station.icon;
          return (
            <div
              key={station.id}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col items-center text-center shadow-lg hover:border-slate-700 transition"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-blue-950 text-blue-400 rounded-xl border border-blue-800">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-white">{station.title}</h3>
              </div>

              <p className="text-xs text-slate-400 mb-4 min-h-[32px]">{station.description}</p>

              {/* Station PIN Badge */}
              <div className="w-full bg-slate-950 border border-slate-800 rounded-xl py-1.5 px-3 mb-4 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 flex items-center gap-1 font-semibold">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Stations-PIN:</span>
                </span>
                <span className="font-mono font-black text-amber-300 text-sm tracking-widest">
                  {station.pin}
                </span>
              </div>

              {/* QR Code */}
              <div className="bg-white p-3 rounded-2xl shadow-inner mb-4 flex items-center justify-center">
                {station.qrDataUrl ? (
                  <img
                    src={station.qrDataUrl}
                    alt={`QR Code ${station.title}`}
                    className="w-44 h-44 object-contain"
                  />
                ) : (
                  <div className="w-44 h-44 flex items-center justify-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  </div>
                )}
              </div>

              {/* URL Display */}
              <div className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 mb-4 flex items-center justify-between gap-2 text-left">
                <span className="text-[11px] font-mono text-slate-300 truncate">
                  {station.fullUrl}
                </span>
                <button
                  onClick={() => handleCopy(station.id, station.fullUrl || '')}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition shrink-0"
                  title="URL kopieren"
                >
                  {copiedId === station.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="w-full grid grid-cols-2 gap-2 mt-auto">
                <a
                  href={station.fullUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition border border-slate-700"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Öffnen</span>
                </a>
                <button
                  onClick={() => handlePrintQrTicket(station)}
                  className="py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Bon drucken</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
