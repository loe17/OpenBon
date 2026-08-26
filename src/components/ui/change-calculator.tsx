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
  const [mode, setMode] = useState<'KEYPAD' | 'DENOMINATION'>('KEYPAD');
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
      // Digit 0-9
      if (nextBuffer === '0') {
        nextBuffer = key;
      } else {
        const parts = nextBuffer.split('.');
        if (parts.length === 2 && parts[1].length >= 2) {
          return; // Max 2 decimal places
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
    const currentCents = Math.round(givenAmount * 100);
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
            <span className="text-[10px] text-slate-400">Ziffernblock &amp; Stückelung</span>
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
        <div className="p-3 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
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

          {/* Quick Cash Buttons */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            <button
              type="button"
              onClick={handleSetExact}
              className="py-2 px-1 bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition active:scale-95 shadow"
            >
              <Check className="w-3 h-3" />
              <span>Passend</span>
            </button>
            {[5, 10, 20, 50, 100].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handleSetDirect(val)}
                className={`py-2 rounded-xl text-xs font-bold font-mono border transition active:scale-95 shadow ${
                  givenAmount === val
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
                }`}
              >
                {val} €
              </button>
            ))}
          </div>

          {/* Mode Tabs */}
          <div className="flex items-center justify-between gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setMode('KEYPAD')}
              className={`flex-1 py-1 rounded-lg transition ${
                mode === 'KEYPAD' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Ziffernblock (Tastatur)
            </button>
            <button
              type="button"
              onClick={() => setMode('DENOMINATION')}
              className={`flex-1 py-1 rounded-lg transition ${
                mode === 'DENOMINATION' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Scheine &amp; Münzen (+ Addieren)
            </button>
          </div>

          {mode === 'KEYPAD' ? (
            /* Touch Numeric Keypad */
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', ','].map((btn) => (
                <button
                  key={btn}
                  type="button"
                  onClick={() => handleKeypadPress(btn)}
                  className={`min-h-[44px] rounded-xl font-mono font-black text-base border transition active:scale-95 shadow flex items-center justify-center keypad-key ${
                    btn === 'C'
                      ? 'bg-rose-950/80 hover:bg-rose-900 border-rose-800 text-rose-300'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-white'
                  }`}
                >
                  {btn}
                </button>
              ))}
            </div>
          ) : (
            /* Stückelung / Denominations */
            <div className="space-y-2 pt-1">
              {/* Scheine */}
              <div className="grid grid-cols-5 gap-1.5">
                {CASH_NOTE_VALUES.map((note) => (
                  <button
                    key={note}
                    type="button"
                    onClick={() => handleAdd(note)}
                    className="min-h-[40px] rounded-xl bg-blue-950/80 hover:bg-blue-900 border border-blue-700/60 active:scale-95 text-blue-200 font-bold font-mono text-xs transition flex items-center justify-center shadow"
                  >
                    +{note}€
                  </button>
                ))}
              </div>

              {/* Münzen */}
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                {CASH_COIN_VALUES.map((coin) => (
                  <button
                    key={coin}
                    type="button"
                    onClick={() => handleAdd(coin)}
                    className="min-h-[36px] rounded-xl bg-amber-950/60 hover:bg-amber-900 border border-amber-700/60 active:scale-95 text-amber-200 font-bold font-mono text-[11px] transition flex items-center justify-center shadow"
                  >
                    {coin >= 1 ? `+${coin}€` : `+${Math.round(coin * 100)}ct`}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleClear}
                className="w-full min-h-[38px] px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-rose-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Zurücksetzen (C)</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ChangeCalculator;
