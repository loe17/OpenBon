'use client';

import React, { useState } from 'react';
import { Lock, Delete, X, ShieldCheck, AlertCircle } from 'lucide-react';
import { triggerHapticFeedback } from '@/lib/socket-client';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

export default function PinModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'PIN-Eingabe erforderlich',
  description = 'Bitte gib den 4-stelligen Admin-PIN ein, um fortzufahren.',
}: PinModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    triggerHapticFeedback();
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(false);

      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleDelete = () => {
    triggerHapticFeedback();
    setPin(pin.slice(0, -1));
    setError(false);
  };

  const handleClear = () => {
    triggerHapticFeedback();
    setPin('');
    setError(false);
  };

  const verifyPin = async (pinToVerify: string) => {
    setChecking(true);
    try {
      const res = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'VERIFY', pin: pinToVerify }),
      });
      const data = await res.json();
      if (data.success) {
        setPin('');
        onSuccess();
      } else {
        setError(true);
        triggerHapticFeedback();
        setTimeout(() => setPin(''), 600);
      }
    } catch {
      setError(true);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl text-white flex flex-col items-center">
        {/* Header */}
        <div className="w-full flex justify-between items-center mb-4">
          <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Lock className="w-5 h-5" />
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <h3 className="font-extrabold text-lg sm:text-xl text-center mb-1">{title}</h3>
        <p className="text-xs text-slate-400 text-center mb-6 max-w-xs">{description}</p>

        {/* PIN Circles */}
        <div className="flex items-center gap-3 mb-6">
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full border-2 transition-all ${
                  error
                    ? 'border-rose-500 bg-rose-500 animate-bounce'
                    : isFilled
                    ? 'border-blue-500 bg-blue-500 scale-110'
                    : 'border-slate-600 bg-slate-800'
                }`}
              />
            );
          })}
        </div>

        {error && (
          <div className="text-xs text-rose-400 font-bold mb-4 flex items-center gap-1.5 animate-pulse">
            <AlertCircle className="w-4 h-4" />
            <span>Falscher PIN! Bitte erneut versuchen.</span>
          </div>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[280px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-16 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-blue-600 active:scale-95 border border-slate-700 text-2xl font-bold font-mono transition touch-manipulation flex items-center justify-center text-white"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-16 rounded-2xl bg-slate-800/60 hover:bg-slate-800 active:scale-95 border border-slate-700 text-xs font-bold uppercase text-slate-400 transition touch-manipulation flex items-center justify-center"
          >
            Leeren
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-16 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-blue-600 active:scale-95 border border-slate-700 text-2xl font-bold font-mono transition touch-manipulation flex items-center justify-center text-white"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="h-16 rounded-2xl bg-slate-800/60 hover:bg-slate-800 active:scale-95 border border-slate-700 text-slate-300 transition touch-manipulation flex items-center justify-center"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
