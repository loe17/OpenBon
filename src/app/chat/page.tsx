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
  ShieldCheck,
  Smartphone,
  CreditCard,
  ChefHat,
  X,
} from 'lucide-react';
import StationGate from '@/components/auth/station-gate';
interface ChatMessage {
  id: string;
  senderName: string;
  senderDeviceId?: string | null;
  targetDeviceId?: string | null;
  message: string;
  isUrgent: boolean;
  isRead: boolean;
  createdAt: string;
}

function ChatPageContent() {
  const { socket } = useSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [senderName, setSenderName] = useState('Bedienung');
  const [userRole, setUserRole] = useState('WAITER');

  // Eildurchsage In-App Modal State
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastSender, setBroadcastSender] = useState('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    const role = localStorage.getItem('pos_user_role') || 'WAITER';
    const waiter = localStorage.getItem('pos_waiter_name');
    setUserRole(role);

    let defaultName = 'Bedienung';
    if (role === 'WAITER') {
      defaultName = waiter ? `Bedienung ${waiter}` : 'Bedienung (Mobil)';
    } else if (role === 'POS_CASHIER') {
      defaultName = 'Bonkasse / Theke';
    } else if (role === 'KITCHEN') {
      defaultName = 'Küchenmonitor';
    } else if (role === 'ADMIN') {
      defaultName = 'Admin / Festleitung';
    }

    setSenderName(defaultName);
    fetchMessages();

    if (socket) {
      socket.on('chat:incoming', (msg: ChatMessage) => {
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
          senderName: senderName.trim() || 'Bedienung',
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
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-950 text-white max-w-4xl mx-auto w-full">
      {/* Top Bar */}
      <div className="p-3 sm:p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-2xl shadow">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-base sm:text-lg">Team-Funk & Notrufe</h1>
            <p className="text-xs text-slate-400">
              Echtzeit-Kurznachrichten zwischen Service, Theke, Küche und Leitung
            </p>
          </div>
        </div>

        {/* Sender Name Identifier Pill & Broadcast Button */}
        <div className="flex items-center gap-2">
          {userRole !== 'WAITER' && (
            <button
              type="button"
              onClick={() => {
                setBroadcastSender(senderName.trim() || 'Leitung / Theke');
                setShowBroadcastModal(true);
              }}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg shadow-rose-950/60 transition active:scale-95 animate-pulse"
              title="Sendet sofort ein Pop-up an alle Bedienungs-Mobilteile"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Eildurchsage</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-xl text-xs">
            <User className="w-3.5 h-3.5 text-blue-400" />
            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="bg-transparent border-none text-white font-bold text-xs focus:outline-none w-24 sm:w-32"
              title="Klicke zum Ändern deines Funk-Namens"
            />
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
            <MessageSquare className="w-8 h-8 stroke-1" />
            <p className="text-sm">Keine Funksprüche vorhanden.</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderName === senderName;
            return (
              <div
                key={msg.id || idx}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-400">
                  <span className="font-bold text-slate-300">{msg.senderName}</span>
                  <span>•</span>
                  <span>{new Date(msg.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <div
                  className={`p-3 rounded-2xl max-w-[85%] sm:max-w-md shadow-md text-sm ${
                    msg.isUrgent
                      ? 'bg-rose-600 text-white font-bold border-2 border-rose-400 animate-pulse'
                      : isMe
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'
                  }`}
                >
                  {msg.isUrgent && (
                    <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider mb-1 font-black text-rose-200">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Dringender Notruf / Priorität</span>
                    </div>
                  )}
                  <p className="break-words">{msg.message}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSendMessage} className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsUrgent(!isUrgent)}
          className={`p-2.5 rounded-xl border transition ${
            isUrgent
              ? 'bg-rose-600 border-rose-400 text-white animate-pulse'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
          }`}
          title={isUrgent ? 'Dringend aktiviert' : 'Als dringenden Notruf markieren'}
        >
          <AlertTriangle className="w-5 h-5" />
        </button>

        <input
          type="text"
          placeholder="Nachricht an alle Stationen senden..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
        />

        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-2xl font-bold shadow-lg transition"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>

      {/* In-App Eildurchsage Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-rose-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400">
                <Radio className="w-5 h-5" />
                <h3 className="font-black text-lg text-white">Eildurchsage an alle Mobilteile</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBroadcastModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Absender</label>
                <input
                  type="text"
                  value={broadcastSender}
                  onChange={(e) => setBroadcastSender(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Nachricht / Durchsage</label>
                <textarea
                  rows={3}
                  value={broadcastText}
                  onChange={(e) => setBroadcastText(e.target.value)}
                  placeholder="z. B. Grillstation kurzzeitig überlastet – bitte vorerst keine Steaks aufnehmen!"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm"
                  autoFocus
                />
              </div>

              <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Dringende Prioritätsmeldung</span>
                </div>
                <p className="text-[11px] text-rose-300/80">
                  Erscheint sofort als In-App-Banner auf den Bildschirmen aller Bedienungen.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="flex-1 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  disabled={!broadcastText.trim() || isSendingBroadcast}
                  onClick={async () => {
                    if (!broadcastText.trim()) return;
                    setIsSendingBroadcast(true);
                    try {
                      await fetch('/api/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          senderName: broadcastSender.trim() || senderName.trim() || 'Leitung / Theke',
                          message: broadcastText.trim(),
                          isUrgent: true,
                          broadcastAlert: true,
                        }),
                      });
                      setBroadcastText('');
                      setShowBroadcastModal(false);
                      fetchMessages();
                    } finally {
                      setIsSendingBroadcast(false);
                    }
                  }}
                  className="flex-1 p-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-950/60 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingBroadcast ? 'Sendet...' : 'Jetzt senden'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <StationGate station="WAITER" label="Team-Funk" allow={['WAITER', 'POS_CASHIER', 'KITCHEN']}>
      <ChatPageContent />
    </StationGate>
  );
}
