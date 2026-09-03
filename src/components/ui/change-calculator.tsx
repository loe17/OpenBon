'use client';

import React, { useState } from 'react';
import { Coins, Banknote, RotateCcw, Check, X, Calculator } from 'lucide-react';
import { formatCents } from '@/lib/utils';
import { triggerHapticFeedback } from '@/lib/socket-client';

interface ChangeCalculatorProps {
  /** Cent-hart (primär) */
  amountDueCents?: number;
  givenCents?: number;
  onGivenCentsChange?: (cents: number) => void;
  /** @deprecated Legacy Euro */
  amountDue?: number;
  givenAmount?: number;
  onGivenChange?: (amountEuro: number) => void;
  className?: string;
  defaultExpanded?: boolean;
}

function toCents(v: number | undefined): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
  return Math.round(v);
}
function euroToCents(euro: number | undefined): number {
  if (typeof euro !== 'number' || !Number.isFinite(euro)) return 0;
  return Math.round((euro + Number.EPSILON) * 100);
}

export function ChangeCalculator({
  amountDueCents,
  givenCents,
  onGivenCentsChange,
  amountDue,
  givenAmount,
  onGivenChange,
  className = '',
}: ChangeCalculatorProps) {
  const [keypadBuffer, setKeypadBuffer] = useState('');

  // Cent-hart auflösen (Legacy-Euro fallback)
  const dueCents = typeof amountDueCents === 'number' ? toCents(amountDueCents) : euroToCents(amountDue);
  const givCents = typeof givenCents === 'number' ? toCents(givenCents) : euroToCents(givenAmount);

  const changeCents = Math.max(0, givCents - dueCents);
  const isSufficient = givCents >= dueCents;

  const emit = (cents: number) => {
    const safe = Math.max(0, Math.round(cents));
    if (onGivenCentsChange) onGivenCentsChange(safe);
    if (onGivenChange) onGivenChange(safe / 100);
  };

  const handleKeypadPress = (key: string) => {
    triggerHapticFeedback();
    let nextBuffer = keypadBuffer;

    if (key === 'C') {
      nextBuffer = '';
      setKeypadBuffer('');
      emit(0);
      return;
    }

    if (key === ',' || key === '.') {
      if (!nextBuffer.includes('.')) {
        nextBuffer = nextBuffer === '' ? '0.' : `${nextBuffer}.`;
      }
    } else {
      if (nextBuffer === '0') {
        nextBuffer = key;
      } else {
        const parts = nextBuffer.split('.');
        if (parts.length === 2 && parts[1].length >= 2) {
          return;
        }
        nextBuffer = `${nextBuffer}${key}`;
      }
    }

    setKeypadBuffer(nextBuffer);
    const num = parseFloat(nextBuffer);
    if (!isNaN(num)) {
      emit(Math.round((num + Number.EPSILON) * 100));
    }
  };

  const handleSetDirectCents = (cents: number) => {
    triggerHapticFeedback();
    setKeypadBuffer(String(cents / 100));
    emit(cents);
  };

  const handleAddCents = (cents: number) => {
    triggerHapticFeedback();
    const next = givCents + cents;
    setKeypadBuffer(String(next / 100));
    emit(next);
  };

  const handleClear = () => {
    triggerHapticFeedback();
    setKeypadBuffer('');
    emit(0);
  };

  const banknotesCents = [
    { value: 500, label: '5', color: 'bg-emerald-900/60 border-emerald-600 text-emerald-200 hover:bg-emerald-800' },
    { value: 1000, label: '10', color: 'bg-rose-900/60 border-rose-600 text-rose-200 hover:bg-rose-800' },
    { value: 2000, label: '20', color: 'bg-blue-900/60 border-blue-600 text-blue-200 hover:bg-blue-800' },
    { value: 5000, label: '50', color: 'bg-amber-900/60 border-amber-600 text-amber-200 hover:bg-amber-800' },
    { value: 10000, label: '100', color: 'bg-teal-900/60 border-teal-600 text-teal-200 hover:bg-teal-800' },
    { value: 20000, label: '200', color: 'bg-yellow-900/60 border-yellow-500 text-yellow-200 hover:bg-yellow-800' },
  ] as const;

  const coinsCents = [
    { value: 200, label: '2€', style: 'bg-gradient-to-br from-amber-400 via-slate-200 to-amber-500 border-2 border-amber-600 text-slate-950' },
    { value: 100, label: '1€', style: 'bg-gradient-to-br from-slate-200 via-amber-300 to-slate-300 border-2 border-slate-500 text-slate-950' },
    { value: 50, label: '50', style: 'bg-amber-300 border-2 border-amber-600 text-amber-950' },
    { value: 20, label: '20', style: 'bg-amber-300 border-2 border-amber-600 text-amber-950' },
    { value: 10, label: '10', style: 'bg-amber-300 border-2 border-amber-600 text-amber-950' },
    { value: 5, label: '5', style: 'bg-orange-400 border-2 border-orange-700 text-orange-950' },
    { value: 2, label: '2', style: 'bg-orange-400 border-2 border-orange-700 text-orange-950' },
    { value: 1, label: '1', style: 'bg-orange-400 border-2 border-orange-700 text-orange-950' },
  ] as const;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-md space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-400">
          <span className="flex items-center gap-1.5 text-white">
            <Calculator className="w-4 h-4 text-emerald-400" />
            <span>Rückgeldrechner</span>
          </span>
          {givCents > 0 && (
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
              {formatCents(givCents)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-right">
            <span className="text-xs text-slate-400 font-bold">Rückgeld:</span>
            <span
              className={`text-xl sm:text-2xl font-black font-mono ${
                isSufficient ? 'text-emerald-400 animate-pulse' : 'text-slate-500'
              }`}
            >
              {formatCents(changeCents)}
            </span>
          </div>
        </div>
      </div>

      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
          <Banknote className="w-3 h-3 text-blue-400" />
          <span>Scheine (Direktwahl)</span>
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {banknotesCents.map((note) => (
            <button
              key={note.value}
              type="button"
              onClick={() => handleSetDirectCents(note.value)}
              className={`h-11 rounded-xl border-2 font-black font-mono text-xs sm:text-sm transition active:scale-95 flex flex-col items-center justify-center shadow ${note.color} ${
                givCents === note.value ? 'ring-2 ring-white scale-105' : ''
              }`}
              title={`${note.label} € Schein`}
            >
              <span className="leading-none">{note.label} €</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
          <Coins className="w-3 h-3 text-amber-400" />
          <span>Münzen (+ Addieren)</span>
        </div>
        <div className="grid grid-cols-8 gap-1.5">
          {coinsCents.map((coin) => (
            <button
              key={coin.value}
              type="button"
              onClick={() => handleAddCents(coin.value)}
              className={`w-full aspect-square rounded-full flex items-center justify-center font-black font-mono text-xs sm:text-sm shadow-md transition active:scale-90 ${coin.style}`}
              title={`+ ${coin.label}`}
            >
              <span>{coin.label}</span>
            </button>
          ))}
        </div>
      </div>

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
