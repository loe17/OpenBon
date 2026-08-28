'use client';

import React, { useState } from 'react';
import { Coins, Banknote, RotateCcw, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { CASH_NOTE_VALUES, CASH_COIN_VALUES } from '@/lib/pricing';
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
  defaultExpanded = true,
}: ChangeCalculatorProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
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
    } else if (key === '00') {
      if (nextBuffer && !nextBuffer.includes('.')) {
        nextBuffer = `${nextBuffer}00`;
      } else if (!nextBuffer) {
        nextBuffer = '0';
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

  const handleSetExact = () => {
    triggerHapticFeedback();
    setKeypadBuffer(String(amountDue));
    onGivenChange(amountDue);
  };

  const handleClear = () => {
    triggerHapticFeedback();
    setKeypadBuffer('');
    onGivenChange(0);
  };

  // Alle Euro-Scheine von 5€ bis 200€
  const banknoteDenominations = [5, 10, 20, 50, 100, 200] as const;

  // Alle Euro-Münzen von 1 Cent bis 2 Euro
  const coinDenominations = [
    { value: 0.01, label: '1ct' },
    { value: 0.02, label: '2ct' },
    { value: 0.05, label: '5ct' },
    { value: 0.1, label: '10ct' },
    { value: 0.2, label: '20ct' },
    { value: 0.5, label: '50ct' },
    { value: 1.0, label: '1€' },
    { value: 2.0, label: '2€' },
  ] as const;

  return (
    <div className={`bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-lg ${className}`}>
      {/* Header / Display */}
      <div className="p-3 flex items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-900/60">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-left"
        >
          <Coins className="w-4 h-4 text-amber-400" />
          <div>
            <span className="text-xs font-bold text-slate-300 block leading-tight">Bargeld &amp; Rückgeld</span>
            <span className="text-[10px] text-slate-400">Ziffernblock &amp; Stückelung (0,01 € – 200 €)</span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400 ml-1" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />
          )}
        </button>

        <div className="text-right">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Rückgeld:</span>
          <span
            className={`text-base font-black font-mono ${
              isSufficient ? 'text-emerald-400' : 'text-slate-500'
            }`}
          >
            {formatCurrency(change)}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Display Gegeben vs Zu Zahlen */}
          <div className="grid grid-cols-2 gap-2 bg-slate-900 rounded-xl p-2.5 border border-slate-800 text-center">
            <div>
              <span className="text-[10px] font-bold text-slate-400 block">Gegeben:</span>
              <span className="text-lg font-mono font-black text-amber-300">
                {formatCurrency(givenAmount)}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block">Zu zahlen:</span>
              <span className="text-lg font-mono font-black text-white">
                {formatCurrency(amountDue)}
              </span>
            </div>
          </div>

          {/* Schnellwahltasten Scheine & Passend */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Banknote className="w-3 h-3 text-blue-400" />
                <span>Scheine &amp; Schnellwahl</span>
              </span>
              <button
                type="button"
                onClick={handleClear}
                className="text-[10px] text-rose-400 hover:text-rose-300 font-bold underline"
              >
                Zurücksetzen (C)
              </button>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
              <button
                type="button"
                onClick={handleSetExact}
                className="col-span-2 sm:col-span-1 min-h-[38px] py-1.5 px-2 bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition active:scale-95 shadow"
              >
                <Check className="w-3 h-3" />
                <span>Passend</span>
              </button>
              {banknoteDenominations.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleSetDirect(val)}
                  className={`min-h-[38px] py-1.5 rounded-xl text-xs font-bold font-mono border transition active:scale-95 shadow ${
                    givenAmount === val
                      ? 'bg-blue-600 text-white border-blue-400 shadow-blue-900/50'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
                  }`}
                >
                  {val} €
                </button>
              ))}
            </div>
          </div>

            {/* Schnellwahltasten Münzen (0,01 € bis 2 € zum Addieren) */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <Coins className="w-3 h-3 text-amber-400" />
              <span>Münzen (+ Addieren)</span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1">
              {coinDenominations.map((coin) => (
                <button
                  key={coin.value}
                  type="button"
                  onClick={() => handleAdd(coin.value)}
                  className="min-h-[34px] py-1 rounded-xl bg-amber-200/90 dark:bg-amber-950/40 hover:bg-amber-300 dark:hover:bg-amber-900/70 border border-amber-400 dark:border-amber-800/60 active:scale-95 text-slate-950 dark:text-amber-200 font-black font-mono text-[11px] transition flex items-center justify-center shadow-sm"
                >
                  +{coin.label}
                </button>
              ))}
            </div>
          </div>

          {/* Vollständiger Ziffernblock (0-9, 00, C, Komma) */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Ziffernblock (Direkteingabe)
            </div>
            <div className="space-y-1.5 pt-0.5">
              <div className="grid grid-cols-3 gap-1.5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleKeypadPress(digit)}
                    className="min-h-[44px] rounded-xl font-mono font-black text-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white transition active:scale-95 shadow flex items-center justify-center keypad-key"
                  >
                    {digit}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleKeypadPress('C')}
                  className="min-h-[44px] rounded-xl font-mono font-black text-base bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 transition active:scale-95 shadow flex items-center justify-center keypad-key"
                  title="Eingabe löschen"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress('0')}
                  className="min-h-[44px] rounded-xl font-mono font-black text-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white transition active:scale-95 shadow flex items-center justify-center keypad-key"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress('00')}
                  className="min-h-[44px] rounded-xl font-mono font-black text-base bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white transition active:scale-95 shadow flex items-center justify-center keypad-key"
                >
                  00
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress(',')}
                  className="min-h-[44px] rounded-xl font-mono font-black text-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white transition active:scale-95 shadow flex items-center justify-center keypad-key"
                >
                  ,
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChangeCalculator;
