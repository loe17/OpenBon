'use client';

import React, { useEffect, useState } from 'react';
import { useSocket } from '@/components/providers/socket-provider';
import { playAcousticPing, triggerHapticFeedback } from '@/lib/socket-client';
import {
  MessageSquare,
  Send,
  AlertTriangle,
  Radio,
  RefreshCw,
  User,
  Clock,
} from 'lucide-react';

export default function ChatPage() {
  const { socket } = useSocket();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [senderName, setSenderName] = useState('Bedienung');

  const fetchMessages = async () => {
    try {
      const res = await fetch('/api/chat');
      const data = await res.json();
      if (Array.isArray(data)) {
        setMessages(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const savedName = localStorage.getItem('pos_waiter_name') || 'Bedienung 1';
    setSenderName(savedName);
    fetchMessages();

    if (socket) {
      socket.on('chat:incoming', (msg: any) => {
        setMessages((prev) => [...prev, msg]);
        if (msg.isUrgent) {
          playAcousticPing();
        }
      });
    }

    return () => {
      if (socket) {
        socket.off('chat:incoming');
      }
    };
  }, [socket]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    triggerHapticFeedback();
    try {
      const deviceId = localStorage.getItem('pos_device_id');
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName,
          senderDeviceId: deviceId,
          message: inputText.trim(),
          isUrgent,
        }),
      });

      setInputText('');
      setIsUrgent(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-white max-w-4xl mx-auto w-full p-3 sm:p-6">
      {/* Header */}
      <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 flex items-center justify-between mb-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2.5 rounded-2xl">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base sm:text-lg">Interne Funk-Nachrichten & Chat</h2>
            <p className="text-xs text-slate-400">Schnelle Kommunikation zwischen Theke, Küche und Bedienung</p>
          </div>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-900/60 rounded-3xl border border-slate-800 space-y-3 mb-3">
        {messages.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-500">Noch keine Nachrichten vorhanden.</div>
        ) : (
          messages.map((m) => {
            const isMine = m.senderName === senderName;
            return (
              <div
                key={m.id}
                className={`flex flex-col max-w-[80%] ${isMine ? 'ml-auto items-end' : 'mr-auto items-start'}`}
              >
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1 px-1">
                  <span className="font-bold text-slate-300">{m.senderName}</span>
                  <span>•</span>
                  <span>{new Date(m.createdAt).toLocaleTimeString('de-DE')}</span>
                  {m.isUrgent && (
                    <span className="bg-rose-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full uppercase ml-1 animate-pulse">
                      EILMELDUNG
                    </span>
                  )}
                </div>

                <div
                  className={`p-3 rounded-2xl text-sm leading-relaxed ${
                    m.isUrgent
                      ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white font-bold shadow-lg shadow-rose-950/50'
                      : isMine
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'
                  }`}
                >
                  {m.message}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Message Input Box */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 bg-slate-900 rounded-3xl border border-slate-800 flex flex-col gap-2 shadow-xl"
      >
        <div className="flex items-center justify-between px-1">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={isUrgent}
              onChange={(e) => setIsUrgent(e.target.checked)}
              className="w-4 h-4 text-rose-600 rounded bg-slate-800 border-slate-700"
            />
            <span className={isUrgent ? 'font-black text-rose-400' : 'text-slate-400'}>
              🚨 Als dringende Eilmeldung senden (mit Signalton)
            </span>
          </label>

          <input
            type="text"
            placeholder="Dein Name"
            value={senderName}
            onChange={(e) => {
              setSenderName(e.target.value);
              localStorage.setItem('pos_waiter_name', e.target.value);
            }}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5 text-xs text-slate-200 w-32 text-right"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Nachricht eingeben..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold shadow-lg shadow-blue-900/30 transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
