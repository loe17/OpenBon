'use client';

import React, { useState } from 'react';
import { Coins, Banknote, RotateCcw, Check, X, Calculator } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { triggerHapticFeedback } from '@/lib/socket-client';

interface ChangeCalculatorProps {
  amountDue: number;
  givenAmount: number;
  onGivenChange: (amount: number) => void;
  className?: string;
  defaultExpanded?: boolean;
}

export function ChangeCalculator({
  amountDue,
  givenAmount,
  onGivenChange,
  className = '',
}: ChangeCalculatorProps) {
  const [keypadBuffer, setKeypadBuffer] = useState('');

  const change = Math.max(0, givenAmount - amountDue);
  const isSufficient = givenAmount >= amountDue;

  const handleKeypadPress = (key: string) => {
    triggerHapticFeedback();
    let nextBuffer = keypadBuffer;

    if (key === 'C') {
      nextBuffer = '';
      setKeypadBuffer('');
      onGivenChange(0);
      return;
    }

    if (key === ',' || key === '.') {
      if (!nextBuffer.includes('.')) {
        nextBuffer = nextBuffer === '' ? '0.' : `${nextBuffer}.`;
      }
    } else {
      // Ziffer 0-9
      if (nextBuffer === '0') {
        nextBuffer = key;
      } else {
        const parts = nextBuffer.split('.');
        if (parts.length === 2 && parts[1].length >= 2) {
          return; // Maximal 2 Nachkommastellen
        }
        nextBuffer = `${nextBuffer}${key}`;
      }
    }

    setKeypadBuffer(nextBuffer);
    const num = parseFloat(nextBuffer);
    if (!isNaN(num)) {
      onGivenChange(num);
    }
  };

  const handleSetDirect = (value: number) => {
    triggerHapticFeedback();
    setKeypadBuffer(String(value));
    onGivenChange(value);
  };

  const handleAdd = (value: number) => {
    triggerHapticFeedback();
    const currentCents = Math.round((givenAmount || 0) * 100);
    const addCents = Math.round(value * 100);
    const nextEuro = (currentCents + addCents) / 100;
    setKeypadBuffer(String(nextEuro));
    onGivenChange(nextEuro);
  };

  const handleClear = () => {
    triggerHapticFeedback();
    setKeypadBuffer('');
    onGivenChange(0);
  };

  // Euro-Scheine als Rechtecke (5€, 10€, 20€, 50€, 100€, 200€)
  const banknotes = [
    { value: 5, label: '5', color: 'bg-emerald-900/60 border-emerald-600 text-emerald-200 hover:bg-emerald-800' },
    { value: 10, label: '10', color: 'bg-rose-900/60 border-rose-600 text-rose-200 hover:bg-rose-800' },
    { value: 20, label: '20', color: 'bg-blue-900/60 border-blue-600 text-blue-200 hover:bg-blue-800' },
    { value: 50, label: '50', color: 'bg-amber-900/60 border-amber-600 text-amber-200 hover:bg-amber-800' },
    { value: 100, label: '100', color: 'bg-teal-900/60 border-teal-600 text-teal-200 hover:bg-teal-800' },
    { value: 200, label: '200', color: 'bg-yellow-900/60 border-yellow-500 text-yellow-200 hover:bg-yellow-800' },
  ] as const;

  // Euro-Münzen als Kreise (1ct bis 2€)
  const coins = [
    { value: 2.0, label: '2€', style: 'bg-gradient-to-br from-amber-400 via-slate-200 to-amber-500 border-2 border-amber-600 text-slate-950' },
    { value: 1.0, label: '1€', style: 'bg-gradient-to-br from-slate-200 via-amber-300 to-slate-300 border-2 border-slate-500 text-slate-950' },
    { value: 0.5, label: '50', style: 'bg-amber-300 border-2 border-amber-600 text-amber-950' },
    { value: 0.2, label: '20', style: 'bg-amber-300 border-2 border-amber-600 text-amber-950' },
    { value: 0.1, label: '10', style: 'bg-amber-300 border-2 border-amber-600 text-amber-950' },
    { value: 0.05, label: '5', style: 'bg-orange-400 border-2 border-orange-700 text-orange-950' },
    { value: 0.02, label: '2', style: 'bg-orange-400 border-2 border-orange-700 text-orange-950' },
    { value: 0.01, label: '1', style: 'bg-orange-400 border-2 border-orange-700 text-orange-950' },
  ] as const;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Rückgeldrechner Header & Gegeben/Rückgeld Zeile */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-md space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-400">
          <span className="flex items-center gap-1.5 text-white">
            <Calculator className="w-4 h-4 text-emerald-400" />
            <span>Rückgeldrechner</span>
          </span>
          {givenAmount > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-bold"
            >
              <X className="w-3.5 h-3.5" />
              <span>Zurücksetzen</span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-bold">Gegeben:</span>
            <span className="text-xl sm:text-2xl font-black font-mono text-amber-300">
              {formatCurrency(givenAmount)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-right">
            <span className="text-xs text-slate-400 font-bold">Rückgeld:</span>
            <span
              className={`text-xl sm:text-2xl font-black font-mono ${
                isSufficient ? 'text-emerald-400 animate-pulse' : 'text-slate-500'
              }`}
            >
              {formatCurrency(change)}
            </span>
          </div>
        </div>
      </div>

      {/* Euro-Scheine (Rechteckige Banknoten nach Bild 1) */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
          <Banknote className="w-3 h-3 text-blue-400" />
          <span>Scheine (Direktwahl)</span>
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {banknotes.map((note) => (
            <button
              key={note.value}
              type="button"
              onClick={() => handleSetDirect(note.value)}
              className={`h-11 rounded-xl border-2 font-black font-mono text-xs sm:text-sm transition active:scale-95 flex flex-col items-center justify-center shadow ${note.color} ${
                givenAmount === note.value ? 'ring-2 ring-white scale-105' : ''
              }`}
              title={`${note.value} € Schein`}
            >
              <span className="leading-none">{note.label} €</span>
            </button>
          ))}
        </div>
      </div>

      {/* Euro-Münzen (Kreise nach Bild 1) */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
          <Coins className="w-3 h-3 text-amber-400" />
          <span>Münzen (+ Addieren)</span>
        </div>
        <div className="grid grid-cols-8 gap-1.5">
          {coins.map((coin) => (
            <button
              key={coin.value}
              type="button"
              onClick={() => handleAdd(coin.value)}
              className={`w-full aspect-square rounded-full flex items-center justify-center font-black font-mono text-xs sm:text-sm shadow-md transition active:scale-90 ${coin.style}`}
              title={`+ ${coin.label}`}
            >
              <span>{coin.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Ziffernblock 3x4 (ohne 00!) */}
      <div>
        <div className="grid grid-cols-3 gap-1.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleKeypadPress(digit)}
              className="min-h-[46px] rounded-2xl font-mono font-black text-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white transition active:scale-95 shadow flex items-center justify-center keypad-key"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleKeypadPress('C')}
            className="min-h-[46px] rounded-2xl font-mono font-black text-lg bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 transition active:scale-95 shadow flex items-center justify-center keypad-key"
            title="Eingabe löschen"
          >
            C
          </button>
          <button
            type="button"
            onClick={() => handleKeypadPress('0')}
            className="min-h-[46px] rounded-2xl font-mono font-black text-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white transition active:scale-95 shadow flex items-center justify-center keypad-key"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleKeypadPress(',')}
            className="min-h-[46px] rounded-2xl font-mono font-black text-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white transition active:scale-95 shadow flex items-center justify-center keypad-key"
          >
            ,
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChangeCalculator;

