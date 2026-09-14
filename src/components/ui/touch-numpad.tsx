'use client';

import React, { useState, useEffect } from 'react';
import { X, Delete, Check, Calculator, Coins } from 'lucide-react';
import { triggerHapticFeedback } from '@/lib/socket-client';

interface TouchNumpadModalProps {
  isOpen: boolean;
  title?: string;
  initialValue?: string;
  isCurrency?: boolean;
  onConfirm: (value: string) => void;
  onClose: () => void;
}

export function TouchNumpadModal({
  isOpen,
  title = 'Zahl eingeben',
  initialValue = '',
  isCurrency = false,
  onConfirm,
  onClose,
}: TouchNumpadModalProps) {
  const [val, setVal] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Wenn der Anfangswert "0" oder "0,00" ist, leer starten oder markieren
      const clean = initialValue === '0' || initialValue === '0,00' ? '' : initialValue;
      setVal(clean);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleDigit = (d: string) => {
    triggerHapticFeedback();
    setVal((prev) => {
      // Wenn bisher nur '0' da stand und keine Nachkommastelle, die '0' ersetzen
      if (prev === '0') return d;
      return prev + d;
    });
  };

  const handleComma = () => {
    triggerHapticFeedback();
    setVal((prev) => {
      if (!prev) return '0,';
      if (prev.includes(',') || prev.includes('.')) return prev;
      return prev + ',';
    });
  };

  const handleBackspace = () => {
    triggerHapticFeedback();
    setVal((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    triggerHapticFeedback();
    setVal('');
  };

  const handleAddAmount = (addCents: number) => {
    triggerHapticFeedback();
    const currentNum = parseFloat((val || '0').replace(',', '.')) || 0;
    const nextNum = Math.max(0, currentNum + addCents / 100);
    setVal(nextNum.toFixed(2).replace('.', ','));
  };

  const handleDone = () => {
    triggerHapticFeedback();
    onConfirm(val);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-sm bg-slate-900 border-2 border-slate-700 rounded-3xl p-5 shadow-2xl text-white flex flex-col items-center">
        {/* Header */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl">
              <Calculator className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm text-slate-200">{title}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Display */}
        <div className="w-full my-3 p-3.5 bg-slate-950 border-2 border-slate-800 rounded-2xl flex items-center justify-between">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Wert:</span>
          <span className="font-mono text-3xl font-black text-white tracking-tight">
            {val || <span className="text-slate-600">0,00</span>}
            {isCurrency && <span className="text-emerald-400 text-xl ml-1.5">€</span>}
          </span>
        </div>

        {/* Currency Quick Buttons */}
        {isCurrency && (
          <div className="grid grid-cols-4 gap-1.5 w-full mb-3">
            {[
              { label: '+5 €', cents: 500 },
              { label: '+10 €', cents: 1000 },
              { label: '+20 €', cents: 2000 },
              { label: '+50 €', cents: 500 },
            ].map((btn, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAddAmount(btn.label === '+50 €' ? 5000 : btn.cents)}
                className="py-2 bg-slate-800 hover:bg-slate-700 active:bg-blue-600 text-xs font-bold text-slate-200 rounded-xl border border-slate-700 transition"
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}

        {/* Numeric Buttons Grid */}
        <div className="grid grid-cols-3 gap-2 w-full mb-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-14 bg-slate-800 hover:bg-slate-700 active:bg-blue-600 active:scale-95 text-xl font-bold text-white rounded-2xl border border-slate-700/80 shadow transition flex items-center justify-center touch-manipulation"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-14 bg-slate-800/60 hover:bg-slate-700 text-rose-400 font-bold text-sm rounded-2xl border border-slate-700/60 transition flex items-center justify-center touch-manipulation"
            title="Eingabe leeren"
          >
            C
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-14 bg-slate-800 hover:bg-slate-700 active:bg-blue-600 active:scale-95 text-xl font-bold text-white rounded-2xl border border-slate-700/80 shadow transition flex items-center justify-center touch-manipulation"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleComma}
            className="h-14 bg-slate-800 hover:bg-slate-700 active:bg-blue-600 active:scale-95 text-xl font-bold text-white rounded-2xl border border-slate-700/80 shadow transition flex items-center justify-center touch-manipulation"
          >
            ,
          </button>
        </div>

        {/* Bottom Actions */}
        <div className="grid grid-cols-3 gap-2 w-full">
          <button
            type="button"
            onClick={handleBackspace}
            className="h-13 bg-slate-800/80 hover:bg-slate-700 active:scale-95 rounded-2xl text-slate-300 font-bold border border-slate-700 flex items-center justify-center gap-1 transition touch-manipulation"
            title="Letztes Zeichen löschen"
          >
            <Delete className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleDone}
            className="col-span-2 h-13 bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40 transition touch-manipulation"
          >
            <Check className="w-5 h-5" />
            <span>Übernehmen</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface TouchNumberInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onChangeValue: (val: string) => void;
  title?: string;
  isCurrency?: boolean;
}

export function TouchNumberInput({
  value,
  onChangeValue,
  title = 'Wert eingeben',
  isCurrency = false,
  className = '',
  placeholder = '0,00',
  autoFocus,
  ...props
}: TouchNumberInputProps) {
  const [showNumpad, setShowNumpad] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^0-9.,]/g, '');
    if (raw.length > 1 && raw.startsWith('0') && !raw.startsWith('0.') && !raw.startsWith('0,')) {
      raw = raw.replace(/^0+/, '');
    }
    onChangeValue(raw);
  };

  return (
    <>
      <div className="relative flex items-center w-full">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={handleChange}
          onFocus={(e) => {
            e.target.select();
            if (props.onFocus) props.onFocus(e);
          }}
          placeholder={placeholder}
          className={`${className} pr-12`}
          autoFocus={autoFocus}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShowNumpad(true)}
          className="absolute right-2.5 p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition"
          title="Touch-Ziffernblock öffnen"
        >
          <Calculator className="w-5 h-5" />
        </button>
      </div>

      <TouchNumpadModal
        isOpen={showNumpad}
        title={title}
        initialValue={value}
        isCurrency={isCurrency}
        onConfirm={(nextVal) => onChangeValue(nextVal)}
        onClose={() => setShowNumpad(false)}
      />
    </>
  );
}
