'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket, triggerHapticFeedback } from '@/lib/socket-client';
import { playVoidAlert } from '@/lib/audio-feedback';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const s = getSocket();
    setSocket(s);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    if (s.connected) setIsConnected(true);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    // Live Remote Control Actions vom Gerätemanager
    s.on('device:play_sound', (data: { targetDeviceId: string }) => {
      const myId = localStorage.getItem('pos_device_id');
      if (!data.targetDeviceId || data.targetDeviceId === myId) {
        playVoidAlert();
        triggerHapticFeedback();
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.5);
          gain.gain.setValueAtTime(1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.8);
        } catch {}
      }
    });

    s.on('device:name_updated', (data: { targetDeviceId: string; newName: string }) => {
      const myId = localStorage.getItem('pos_device_id');
      if (data.targetDeviceId === myId && data.newName) {
        localStorage.setItem('pos_waiter_name', data.newName);
        window.dispatchEvent(new Event('storage'));
      }
    });

    s.on('device:role_changed', (data: { targetDeviceId: string; newRole: string }) => {
      const myId = localStorage.getItem('pos_device_id');
      if (data.targetDeviceId === myId && data.newRole) {
        localStorage.setItem('pos_user_role', data.newRole);
        window.dispatchEvent(new Event('storage'));
      }
    });

    s.on('device:kicked', (data: { targetDeviceId: string }) => {
      const myId = localStorage.getItem('pos_device_id');
      if (data.targetDeviceId === myId) {
        localStorage.removeItem('pos_user_role');
        window.location.href = '/';
      }
    });

    // Heartbeat loop every 15 seconds
    const interval = setInterval(async () => {
      let batteryLevel = 100;
      let isCharging = false;
      if ('getBattery' in navigator) {
        try {
          const b = await navigator.getBattery!();
          batteryLevel = Math.round(b.level * 100);
          isCharging = b.charging;
        } catch {}
      }
      const deviceId = localStorage.getItem('pos_device_id');
      const waiterName = localStorage.getItem('pos_waiter_name') || 'Bedienung';
      const role = localStorage.getItem('pos_user_role') || 'WAITER';

      s.emit('device:heartbeat', {
        deviceId,
        name: waiterName,
        role,
        batteryLevel,
        isCharging,
      });
    }, 15000);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('device:play_sound');
      s.off('device:name_updated');
      s.off('device:role_changed');
      s.off('device:kicked');
      clearInterval(interval);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
