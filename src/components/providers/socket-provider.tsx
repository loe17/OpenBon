'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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
  const [failoverBanner, setFailoverBanner] = useState<string | null>(null);
  const disconnectStartRef = useRef<number | null>(null);
  const failoverTriggeredRef = useRef(false);

  useEffect(() => {
    const s = getSocket();
    setSocket(s);

    const onConnect = () => {
      setIsConnected(true);
      disconnectStartRef.current = null;
    };
    const onDisconnect = () => {
      setIsConnected(false);
      if (!disconnectStartRef.current) {
        disconnectStartRef.current = Date.now();
      }
    };

    if (s.connected) {
      setIsConnected(true);
      disconnectStartRef.current = null;
    } else {
      disconnectStartRef.current = Date.now();
    }

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    // HA Partner-URL im Browser cachen für nahtloses Failover & Failback
    fetch('/api/config/public')
      .then((r) => r.json())
      .then((cfg) => {
        if (cfg?.haPartnerUrl) {
          localStorage.setItem('openbon_ha_partner_url', String(cfg.haPartnerUrl));
        }
      })
      .catch(() => {});

    // HA Failback: Wenn dieser Knoten auf STANDBY zurücktritt (Hauptrechner wieder aktiv)
    const onHaRoleChanged = async (data: { role: string; partnerUrl?: string | null }) => {
      if (data?.role === 'STANDBY') {
        const partnerUrl = data.partnerUrl || localStorage.getItem('openbon_ha_partner_url');
        if (!partnerUrl || failoverTriggeredRef.current) return;

        const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
        if (partnerUrl.trim().replace(/\/$/, '') === currentOrigin.trim().replace(/\/$/, '')) {
          return;
        }

        failoverTriggeredRef.current = true;
        setFailoverBanner('Hauptrechner wieder aktiv – Kassenbetrieb wird nahtlos zurückübertragen...');
        triggerHapticFeedback();

        // Puffer leeren / Outbox senden, bevor die Seite umschaltet
        try {
          const { syncOutboxWithServer } = await import('@/lib/offline/outbox');
          await syncOutboxWithServer();
        } catch {}

        setTimeout(() => {
          try {
            const target = new URL(window.location.pathname + window.location.search, partnerUrl);
            const waiter = localStorage.getItem('pos_waiter_name') || localStorage.getItem('openbon_waiter_name');
            if (waiter && !target.searchParams.get('waiterName')) {
              target.searchParams.set('waiterName', waiter);
            }
            window.location.replace(target.toString());
          } catch {
            window.location.replace(partnerUrl);
          }
        }, 1500);
      }
    };
    s.on('ha:role_changed', onHaRoleChanged);

    // Failover-Wächter: Wenn Verbindung mehr als 10s abbricht, Partner prüfen
    const failoverCheckInterval = setInterval(async () => {
      if (s.connected || !disconnectStartRef.current || failoverTriggeredRef.current) return;
      const durationMs = Date.now() - disconnectStartRef.current;
      if (durationMs < 10000) return; // Noch in der 10s Pufferzeit

      try {
        const partnerUrl = localStorage.getItem('openbon_ha_partner_url');
        if (!partnerUrl) return;
        const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
        if (partnerUrl.trim().replace(/\/$/, '') === currentOrigin.trim().replace(/\/$/, '')) {
          return;
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`${partnerUrl}/api/health`, { signal: controller.signal });
        clearTimeout(timer);

        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data?.system === 'OpenBon' || data?.status === 'HEALTHY' || data?.haRole === 'PRIMARY') {
            failoverTriggeredRef.current = true;
            setFailoverBanner('Hauptrechner nicht erreichbar. Ersatzrechner übernimmt – Seite wird automatisch umgeschaltet...');
            triggerHapticFeedback();

            // Puffer leeren / Outbox senden, bevor die Seite umleitet
            try {
              const { syncOutboxWithServer } = await import('@/lib/offline/outbox');
              await syncOutboxWithServer();
            } catch {}

            setTimeout(() => {
              try {
                const target = new URL(window.location.pathname + window.location.search, partnerUrl);
                const waiter = localStorage.getItem('pos_waiter_name') || localStorage.getItem('openbon_waiter_name');
                if (waiter && !target.searchParams.get('waiterName')) {
                  target.searchParams.set('waiterName', waiter);
                }
                window.location.replace(target.toString());
              } catch {
                window.location.replace(partnerUrl);
              }
            }, 1800);
          }
        }
      } catch {
        // Partner noch nicht bereit oder ebenfalls offline
      }
    }, 3000);

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
      s.off('ha:role_changed', onHaRoleChanged);
      s.off('device:play_sound');
      s.off('device:name_updated');
      s.off('device:role_changed');
      s.off('device:kicked');
      clearInterval(interval);
      clearInterval(failoverCheckInterval);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {failoverBanner && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-600 text-white font-bold py-2.5 px-4 shadow-xl text-xs sm:text-sm text-center flex items-center justify-center gap-2 animate-pulse">
          <span>{failoverBanner}</span>
        </div>
      )}
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
