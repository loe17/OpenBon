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

  const change = Math.max(0, givenAmount - amountDue);
  const isSufficient = givenAmount >= amountDue;

  const handleAdd = (value: number) => {
    triggerHapticFeedback();
    const currentCents = Math.round(givenAmount * 100);
    const addCents = Math.round(value * 100);
    const nextEuro = (currentCents + addCents) / 100;
    onGivenChange(nextEuro);
  };

  const handleSetExact = () => {
    triggerHapticFeedback();
    onGivenChange(amountDue);
  };

  const handleClear = () => {
    triggerHapticFeedback();
    onGivenChange(0);
  };

  return (
    <div className={`bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-lg ${className}`}>
      {/* Header / Display */}
      <div className="p-3.5 flex items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-900/60">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-left"
        >
          <Coins className="w-4 h-4 text-amber-400" />
          <div>
            <span className="text-xs font-bold text-slate-300 block leading-tight">Rückgeldrechner</span>
            <span className="text-[10px] text-slate-400">Tippen addiert Scheine & Münzen</span>
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
              <span className="text-base font-mono font-black text-amber-300">
                {formatCurrency(givenAmount)}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block">Zu zahlen:</span>
              <span className="text-base font-mono font-black text-white">
                {formatCurrency(amountDue)}
              </span>
            </div>
          </div>

          {/* Scheine (Banknoten) */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Scheine (+ addieren):
            </span>
            <div className="grid grid-cols-5 gap-1.5">
              {CASH_NOTE_VALUES.map((note) => (
                <button
                  key={note}
                  type="button"
                  onClick={() => handleAdd(note)}
                  className="min-h-[42px] rounded-xl bg-blue-950/80 hover:bg-blue-900 border border-blue-700/60 active:scale-95 text-blue-200 font-bold font-mono text-xs sm:text-sm transition flex items-center justify-center shadow"
                >
                  +{note}€
                </button>
              ))}
            </div>
          </div>

          {/* Münzen */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Münzen (+ addieren):
            </span>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {CASH_COIN_VALUES.map((coin) => (
                <button
                  key={coin}
                  type="button"
                  onClick={() => handleAdd(coin)}
                  className="min-h-[38px] rounded-xl bg-amber-950/60 hover:bg-amber-900 border border-amber-700/60 active:scale-95 text-amber-200 font-bold font-mono text-xs transition flex items-center justify-center shadow"
                >
                  {coin >= 1 ? `+${coin}€` : `+${Math.round(coin * 100)}ct`}
                </button>
              ))}
            </div>
          </div>

          {/* Schnellaktionen: Passend & Löschen */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleSetExact}
              className="min-h-[40px] px-3 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Passend ({formatCurrency(amountDue)})</span>
            </button>

            <button
              type="button"
              onClick={handleClear}
              className="min-h-[40px] px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-rose-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Zurücksetzen (C)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChangeCalculator;
