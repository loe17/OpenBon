'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ShieldCheck,
  Printer,
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
  const [enableTax, setEnableTax] = useState(false);

  // Step 2: PINs (Sicherheit - min. 6 Ziffern)
  const [adminPin, setAdminPin] = useState('');
  const [posPin, setPosPin] = useState('');
  const [kitchenPin, setKitchenPin] = useState('');
  const [waiterPin, setWaiterPin] = useState('');

  // Step 3: Drucker & Abschluss
  const [enableVirtual, setEnableVirtual] = useState(true);

  const handleFinish = async () => {
    if (adminPin.length < 6 || posPin.length < 6 || kitchenPin.length < 6 || waiterPin.length < 6) {
      error('Bitte für alle 4 Stationen eine PIN mit mindestens 6 Ziffern angeben.');
      setStep(2);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/initial-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPin,
          posPin,
          kitchenPin,
          waiterPin,
          eventName,
          organizer,
          enableTax,
          enableVirtualPrinters: enableVirtual,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Fehler beim Einrichten');
      }

      success('Kassensystem erfolgreich eingerichtet!');
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
              Schritt {step} von 3: Schnelleinrichtung für den Kassenbetrieb
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-800 h-2 rounded-full mb-8 overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
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
                  Für Vereine &amp; Kleinunternehmer standardmäßig deaktiviert
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
              <span>Sicherheit &amp; Stations-PINs festlegen</span>
            </div>
            <p className="text-xs text-slate-400">
              Aus Sicherheitsgründen muss jede PIN mindestens 6 Ziffern lang sein (keine einfachen Folgen wie 123456).
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Admin-PIN (Vollzugriff, min. 6 Ziffern)
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                placeholder="z. B. 849201"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Kassen- / Theken-PIN (min. 6 Ziffern)
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={posPin}
                onChange={(e) => setPosPin(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                placeholder="z. B. 621405"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Küchen- &amp; Ausschank-PIN (min. 6 Ziffern)
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={kitchenPin}
                onChange={(e) => setKitchenPin(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                placeholder="z. B. 451923"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Kellner-PIN (Mobilteile, min. 6 Ziffern)
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={waiterPin}
                onChange={(e) => setWaiterPin(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                placeholder="z. B. 391847"
              />
            </div>
          </div>
        )}

        {/* Step 3: Drucker & Abschluss */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center gap-2 text-sm font-bold text-purple-400 mb-2">
              <Printer className="w-4 h-4" />
              <span>Drucker &amp; Ausgabe</span>
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
                  Tische, Bondrucker und Benutzerprofile anpassen.
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

          {step < 3 ? (
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
