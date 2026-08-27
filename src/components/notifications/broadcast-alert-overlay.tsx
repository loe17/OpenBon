'use client';

import React, { useEffect, useState } from 'react';
import { useSocket } from '@/components/providers/socket-provider';
import { playAcousticPing, triggerHapticFeedback, isAudioMuted } from '@/lib/socket-client';
import { Radio, AlertTriangle, X, Check } from 'lucide-react';

export interface AlertNotification {
  id: string;
  message: string;
  sender?: string;
  isUrgent?: boolean;
  timestamp?: string | Date;
}

export function BroadcastAlertOverlay() {
  const { socket } = useSocket();
  const [activeAlert, setActiveAlert] = useState<AlertNotification | null>(null);

  useEffect(() => {
    if (!socket) return;

    const handleBroadcast = (data: { message: string; sender?: string; timestamp?: string | Date }) => {
      const alert: AlertNotification = {
        id: Math.random().toString(36).substring(2, 9),
        message: data.message,
        sender: data.sender || 'Leitung / Theke',
        isUrgent: true,
        timestamp: data.timestamp || new Date(),
      };
      
      if (!isAudioMuted()) {
        playAcousticPing();
      }
      triggerHapticFeedback();
      setActiveAlert(alert);
    };

    const handleChatMessage = (msg: { message: string; senderName?: string; isUrgent?: boolean; createdAt?: string }) => {
      if (msg.isUrgent) {
        const alert: AlertNotification = {
          id: Math.random().toString(36).substring(2, 9),
          message: msg.message,
          sender: msg.senderName || 'Team-Funk Notruf',
          isUrgent: true,
          timestamp: msg.createdAt || new Date(),
        };

        if (!isAudioMuted()) {
          playAcousticPing();
        }
        triggerHapticFeedback();
        setActiveAlert(alert);
      }
    };

    socket.on('broadcast:alert', handleBroadcast);
    socket.on('chat:incoming', handleChatMessage);

    return () => {
      socket.off('broadcast:alert', handleBroadcast);
      socket.off('chat:incoming', handleChatMessage);
    };
  }, [socket]);

  if (!activeAlert) return null;

  const timeStr = activeAlert.timestamp
    ? new Date(activeAlert.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in select-none">
      <div className="bg-slate-900 border-2 border-rose-600 rounded-3xl p-6 max-w-lg w-full shadow-2xl shadow-rose-950/80 space-y-4 animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rose-900/60 pb-3">
          <div className="flex items-center gap-2.5 text-rose-400">
            <div className="p-2 rounded-2xl bg-rose-600/20 border border-rose-500/40 animate-pulse">
              <Radio className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-600 text-white shadow">
                  Eildurchsage / Notruf
                </span>
                {timeStr && <span className="text-xs font-mono text-slate-400">{timeStr} Uhr</span>}
              </div>
              <h3 className="text-base font-bold text-white mt-0.5">
                Von: <strong className="text-rose-300">{activeAlert.sender || 'Kasse / Leitung'}</strong>
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveAlert(null)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            title="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Content */}
        <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-800/60 text-white font-medium text-base sm:text-lg leading-relaxed whitespace-pre-wrap">
          {activeAlert.message}
        </div>

        {/* Confirm Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setActiveAlert(null)}
            className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-rose-950/60 flex items-center justify-center gap-2 transition active:scale-95"
          >
            <Check className="w-5 h-5" />
            <span>Verstanden / Gelesen</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default BroadcastAlertOverlay;
