'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ShieldCheck,
  Printer,
  Grid,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Building2,
  Lock,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';

export default function SetupWizardPage() {
  const router = useRouter();
  const { success, error } = useToast();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Event Info
  const [eventName, setEventName] = useState('Vereinsfest 2026');
  const [organizer, setOrganizer] = useState('Freiwillige Feuerwehr e.V.');
  const [currency, setCurrency] = useState('EUR');
  const [enableTax, setEnableTax] = useState(false);

  // Step 2: PINs (Sicherheit)
  const [adminPin, setAdminPin] = useState('');
  const [posPin, setPosPin] = useState('');
  const [waiterPin, setWaiterPin] = useState('');

  // Step 3: Tische
  const [tableCount, setTableCount] = useState(20);
  const [columns, setColumns] = useState(4);

  // Step 4: Drucker
  const [enableVirtual, setEnableVirtual] = useState(true);

  const handleFinish = async () => {
    setLoading(true);
    try {
      // 1. EventConfig speichern
      const configRes = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: eventName,
          receiptSubHeader: organizer,
          currency,
          enableTax,
          enableVirtualPrinters: enableVirtual,
          adminPin: adminPin || '4321',
          posPin: posPin || '5555',
          waiterPin: waiterPin || '7777',
        }),
      });

      if (!configRes.ok) {
        throw new Error('Fehler beim Speichern der Konfiguration');
      }

      // 2. Tische generieren
      await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REGENERATE_GRID',
          rows: Math.ceil(tableCount / columns),
          cols: columns,
          startNumber: 1,
          step: 1,
        }),
      });

      success('Einrichtungs-Assistent erfolgreich abgeschlossen!');
      router.push('/admin/dashboard');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Einrichtungsfehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-10 shadow-2xl animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-black">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black">OpenBon Erststart-Assistent</h1>
            <p className="text-slate-400 text-xs sm:text-sm">
              Schritt {step} von 4: Schnelleinrichtung für den Kassenbetrieb
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-800 h-2 rounded-full mb-8 overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        {/* Step 1: Allgemeine Angaben */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center gap-2 text-sm font-bold text-blue-400 mb-2">
              <Building2 className="w-4 h-4" />
              <span>Veranstaltungs-Grunddaten</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Name der Veranstaltung
              </label>
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-medium"
                placeholder="z. B. Feuerwehrfest 2026"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Veranstalter / Verein
              </label>
              <input
                type="text"
                value={organizer}
                onChange={(e) => setOrganizer(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-medium"
                placeholder="z. B. Freiwillige Feuerwehr Musterstadt e.V."
              />
            </div>

            <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
              <input
                type="checkbox"
                id="enableTax"
                checked={enableTax}
                onChange={(e) => setEnableTax(e.target.checked)}
                className="w-5 h-5 rounded accent-blue-600"
              />
              <label htmlFor="enableTax" className="text-xs text-slate-300 cursor-pointer">
                <strong>Mehrwertsteuer ausweisen (19% / 7%)</strong>
                <span className="block text-slate-500">
                  Für Vereine & Kleinunternehmer standardmäßig deaktiviert
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Step 2: Sicherheit & Stations-PINs */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-400 mb-2">
              <Lock className="w-4 h-4" />
              <span>Sicherheit & Stations-PINs festlegen</span>
            </div>
            <p className="text-xs text-slate-400">
              Bitte lege individuelle PINs fest, um die Standard-PINs zu ersetzen.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Admin-PIN (Vollzugriff)
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                placeholder="z. B. 8492"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Kassen- / Theken-PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={posPin}
                onChange={(e) => setPosPin(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                placeholder="z. B. 6214"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Kellner-PIN (Mobilteile)
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={waiterPin}
                onChange={(e) => setWaiterPin(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                placeholder="z. B. 3918"
              />
            </div>
          </div>
        )}

        {/* Step 3: Tischplan Schnellgenerator */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-400 mb-2">
              <Grid className="w-4 h-4" />
              <span>Tischplan Schnellgenerator</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Anzahl Tische im Festzelt
              </label>
              <input
                type="number"
                min="1"
                max="200"
                value={tableCount}
                onChange={(e) => setTableCount(parseInt(e.target.value, 10) || 1)}
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Spalten im Kassenraster
              </label>
              <input
                type="number"
                min="2"
                max="8"
                value={columns}
                onChange={(e) => setColumns(parseInt(e.target.value, 10) || 4)}
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
              />
            </div>
          </div>
        )}

        {/* Step 4: Drucker & Abschluss */}
        {step === 4 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center gap-2 text-sm font-bold text-purple-400 mb-2">
              <Printer className="w-4 h-4" />
              <span>Drucker & Ausgabe</span>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
              <input
                type="checkbox"
                id="enableVirtual"
                checked={enableVirtual}
                onChange={(e) => setEnableVirtual(e.target.checked)}
                className="w-5 h-5 rounded accent-purple-600"
              />
              <label htmlFor="enableVirtual" className="text-xs text-slate-300 cursor-pointer">
                <strong>Virtuellen Drucker aktivieren</strong>
                <span className="block text-slate-500">
                  Ermöglicht das Testen und Einsehen von Bons im Web-Browser ohne echten ESC/POS Drucker.
                </span>
              </label>
            </div>

            <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-800 text-xs text-blue-200 leading-relaxed">
              <ShieldCheck className="w-5 h-5 text-blue-400 mb-2 inline-block" />
              <div>
                <strong>Bereit für den Kassenbetrieb!</strong>
                <p className="mt-1 text-slate-300">
                  Nach dem Abschluss kannst du im Admin-Menü jederzeit weitere Warengruppen, Produkte,
                  Bondrucker und Benutzerprofile anpassen.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-10 pt-6 border-t border-slate-800">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold transition text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Zurück
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition text-sm shadow-lg shadow-blue-900/40"
            >
              Weiter
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={handleFinish}
              className="flex items-center gap-2 px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black transition text-sm shadow-lg shadow-emerald-900/40"
            >
              {loading ? (
                'Wird eingerichtet...'
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Kassensystem starten
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
