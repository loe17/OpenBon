'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket-client';

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

    // Heartbeat loop every 15 seconds
    const interval = setInterval(async () => {
      let batteryLevel = 100;
      let isCharging = false;
      if ('getBattery' in navigator) {
        try {
          const b: any = await (navigator as any).getBattery();
          batteryLevel = Math.round(b.level * 100);
          isCharging = b.charging;
        } catch {}
      }
      s.emit('device:heartbeat', { batteryLevel, isCharging });
    }, 15000);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
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
