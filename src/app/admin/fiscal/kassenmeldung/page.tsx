'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileText,
  Printer,
  Copy,
  Check,
  ShieldCheck,
  Building2,
  Lock,
  Smartphone,
  ArrowLeft,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { APP_VERSION, APP_NAME } from '@/lib/version';
import { useToast } from '@/components/ui/toast';

export default function KassenmeldungPage() {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [cRes, dRes] = await Promise.all([
          fetch('/api/config'),
          fetch('/api/devices'),
        ]);
        if (cRes.ok) setConfig(await cRes.json());
        if (dRes.ok) setDevices(await dRes.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const reportData = {
    paragraph: '§ 146a Abs. 4 AO (Mitteilung über elektronische Aufzeichnungssysteme)',
    organization: config?.name || 'Vereinsfest 2026',
    organizer: config?.receiptSubHeader || 'Verein e.V.',
    taxOfficeNumber: config?.datevClientNumber || 'Nicht hinterlegt',
    systemType: 'PC-/Server-Kassensystem (Webbasiert)',
    softwareName: `${APP_NAME} Community`,
    softwareVersion: APP_VERSION,
    systemId: config?.id || 'openbon-default',
    commissioningDate: config?.createdAt ? new Date(config.createdAt).toLocaleDateString('de-DE') : '2026-01-01',
    tseProvider: config?.tseProvider || 'NONE',
    tseSerialNumber: config?.tseSerialNumber || 'NONE-DEV-001',
    tseCertificateId: config?.tseProvider === 'SWISSBIT_USB' ? 'BSI-K-TR-0362-2020' : 'BSI-K-TR-0393-2021',
    deviceCount: devices.length || 1,
    devices: devices.map((d) => ({
      name: d.name,
      role: d.role,
      id: d.id,
      ip: d.ipAddress,
    })),
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(reportData, null, 2));
    setCopied(true);
    success('Meldedaten als JSON in die Zwischenablage kopiert!');
    setTimeout(() => setCopied(false), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans print:bg-white print:text-black print:p-0">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header & Back (Hidden when printing) */}
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-800 pb-4 print:hidden">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/fiscal"
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-white flex items-center gap-2">
                <FileText className="w-6 h-6 text-blue-400" />
                <span>Kassenmeldung nach § 146a Abs. 4 AO</span>
              </h1>
              <p className="text-xs text-slate-400">
                Amtliche Übersicht zur Mitteilungspflicht elektronischer Aufzeichnungssysteme an das Finanzamt
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyJson}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 transition active:scale-95"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>JSON kopieren</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg transition active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Drucken / PDF</span>
            </button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-800/80 text-xs text-blue-200 leading-relaxed print:hidden">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <strong>Rechtlicher Hinweis zur Kassenmeldung nach § 146a Abs. 4 AO:</strong>
              <p className="mt-0.5 text-slate-300">
                Diese Zusammenstellung enthält alle gesetzlich geforderten Angaben (Aufzeichnungssystem, Seriennummern,
                Inbetriebnahme, TSE-Modul und angeschlossene Terminals) für die elektronische Übermittlung an das zuständige Finanzamt (via ERiC / MeinELSTER).
              </p>
            </div>
          </div>
        </div>

        {/* Meldebogen / Dokumenten-Körper */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl print:border-none print:shadow-none print:bg-white print:text-black">
          {/* Titelkopf */}
          <div className="border-b border-slate-800 print:border-slate-300 pb-4">
            <div className="text-xs uppercase font-bold text-slate-400 print:text-slate-600 tracking-wider">
              Bundesrepublik Deutschland · Finanzverwaltung
            </div>
            <h2 className="text-xl font-black text-white print:text-black mt-1">
              Mitteilung über ein elektronisches Aufzeichnungssystem (§ 146a Abs. 4 AO)
            </h2>
          </div>

          {/* Block 1: Organisation & Betreiber */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-blue-400 print:text-blue-800 flex items-center gap-2 border-b border-slate-800 print:border-slate-200 pb-1.5">
              <Building2 className="w-4 h-4" />
              <span>1. Angaben zum Betreiber / Steuerpflichtigen</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950 print:bg-slate-50 p-3 rounded-xl border border-slate-800 print:border-slate-200">
                <span className="text-slate-400 print:text-slate-600 block">Name / Verein:</span>
                <strong className="text-white print:text-black text-sm">{reportData.organization}</strong>
              </div>
              <div className="bg-slate-950 print:bg-slate-50 p-3 rounded-xl border border-slate-800 print:border-slate-200">
                <span className="text-slate-400 print:text-slate-600 block">Zusatz / Anschrift:</span>
                <strong className="text-white print:text-black text-sm">{reportData.organizer}</strong>
              </div>
            </div>
          </div>

          {/* Block 2: Elektronisches Aufzeichnungssystem */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-blue-400 print:text-blue-800 flex items-center gap-2 border-b border-slate-800 print:border-slate-200 pb-1.5">
              <FileText className="w-4 h-4" />
              <span>2. Angaben zum elektronischen Aufzeichnungssystem</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-950 print:bg-slate-50 p-3 rounded-xl border border-slate-800 print:border-slate-200">
                <span className="text-slate-400 print:text-slate-600 block">Art des Systems:</span>
                <strong className="text-white print:text-black">{reportData.systemType}</strong>
              </div>
              <div className="bg-slate-950 print:bg-slate-50 p-3 rounded-xl border border-slate-800 print:border-slate-200">
                <span className="text-slate-400 print:text-slate-600 block">Software & Version:</span>
                <strong className="text-white print:text-black">{reportData.softwareName} v{reportData.softwareVersion}</strong>
              </div>
              <div className="bg-slate-950 print:bg-slate-50 p-3 rounded-xl border border-slate-800 print:border-slate-200">
                <span className="text-slate-400 print:text-slate-600 block">Inbetriebnahme-Datum:</span>
                <strong className="text-white print:text-black">{reportData.commissioningDate}</strong>
              </div>
            </div>
          </div>

          {/* Block 3: Technische Sicherheitseinrichtung (TSE) */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-blue-400 print:text-blue-800 flex items-center gap-2 border-b border-slate-800 print:border-slate-200 pb-1.5">
              <Lock className="w-4 h-4" />
              <span>3. Angaben zur zertifizierten Sicherheitseinrichtung (TSE)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-950 print:bg-slate-50 p-3 rounded-xl border border-slate-800 print:border-slate-200">
                <span className="text-slate-400 print:text-slate-600 block">TSE-Modul / Hersteller:</span>
                <strong className="text-white print:text-black">{reportData.tseProvider}</strong>
              </div>
              <div className="bg-slate-950 print:bg-slate-50 p-3 rounded-xl border border-slate-800 print:border-slate-200">
                <span className="text-slate-400 print:text-slate-600 block">TSE-Seriennummer:</span>
                <strong className="text-white print:text-black font-mono">{reportData.tseSerialNumber}</strong>
              </div>
              <div className="bg-slate-950 print:bg-slate-50 p-3 rounded-xl border border-slate-800 print:border-slate-200">
                <span className="text-slate-400 print:text-slate-600 block">BSI-Zertifizierungs-ID:</span>
                <strong className="text-white print:text-black font-mono">{reportData.tseCertificateId}</strong>
              </div>
            </div>
          </div>

          {/* Block 4: Angeschlossene Kassen / Endgeräte */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-blue-400 print:text-blue-800 flex items-center gap-2 border-b border-slate-800 print:border-slate-200 pb-1.5">
              <Smartphone className="w-4 h-4" />
              <span>4. Registrierte Eingabe- und Kassen-Endgeräte ({reportData.deviceCount})</span>
            </h3>
            <div className="border border-slate-800 print:border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 print:bg-slate-100 text-slate-400 print:text-slate-600 border-b border-slate-800 print:border-slate-200">
                  <tr>
                    <th className="p-2.5">Gerätename</th>
                    <th className="p-2.5">Rolle</th>
                    <th className="p-2.5">Geräte-ID / UUID</th>
                    <th className="p-2.5">Netzwerk-IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 print:divide-slate-200">
                  {devices.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-3 text-center text-slate-500">
                        1 Hauptkassen-Terminal (Server) aktiv
                      </td>
                    </tr>
                  ) : (
                    devices.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-800/40">
                        <td className="p-2.5 font-bold text-white print:text-black">{d.name}</td>
                        <td className="p-2.5 text-slate-300 print:text-slate-700">{d.role}</td>
                        <td className="p-2.5 font-mono text-[11px] text-slate-400 print:text-slate-600">{d.id}</td>
                        <td className="p-2.5 font-mono text-slate-400 print:text-slate-600">{d.ipAddress || 'Lokal'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
