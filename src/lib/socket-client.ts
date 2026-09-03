'use client';

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket && typeof window !== 'undefined') {
    socket = io({
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    // Auto-register device info
    socket.on('connect', async () => {
      let deviceId = localStorage.getItem('pos_device_id');
      if (!deviceId) {
        deviceId = 'dev_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('pos_device_id', deviceId);
      }

      let deviceName = localStorage.getItem('pos_device_name');
      if (!deviceName) {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        deviceName = isMobile ? 'Smartphone ' + deviceId.slice(-4) : 'Terminal ' + deviceId.slice(-4);
        localStorage.setItem('pos_device_name', deviceName);
      }

      const role = localStorage.getItem('pos_user_role') || 'WAITER';

      // Read Battery API if supported
      let batteryLevel = 100;
      let isCharging = false;
      if ('getBattery' in navigator) {
        try {
          const battery = await navigator.getBattery!();
          batteryLevel = Math.round(battery.level * 100);
          isCharging = battery.charging;
        } catch {}
      }

      socket?.emit('device:register', {
        id: deviceId,
        name: deviceName,
        role,
        userAgent: navigator.userAgent,
        batteryLevel,
        isCharging,
        connectedAt: new Date().toISOString(),
      });
    });

    // Start periodic device & battery heartbeat (every 60s, gedrosselt für Festbetrieb)
    setInterval(async () => {
      if (!socket?.connected) return;
      let batteryLevel = 100;
      let isCharging = false;
      if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
        try {
          const battery = await (navigator as any).getBattery!();
          batteryLevel = Math.round(battery.level * 100);
          isCharging = battery.charging;
        } catch {}
      }
      socket?.emit('device:heartbeat', {
        batteryLevel,
        isCharging,
      });
    }, 60000);

    // Handle "Find My Device" Acoustic Ping
    socket.on('device:play_sound', ({ targetDeviceId }) => {
      const myId = localStorage.getItem('pos_device_id');
      if (myId === targetDeviceId || !targetDeviceId) {
        playAcousticPing();
      }
    });

    // Handle Force Logout (kein blockierendes alert(), sondern Toast-Event + Confirm-Dialog)
    socket.on('device:kicked', ({ targetDeviceId }) => {
      const myId = localStorage.getItem('pos_device_id');
      if (myId === targetDeviceId) {
        localStorage.removeItem('pos_user_role');
        window.dispatchEvent(new CustomEvent('openbon:force-logout', { detail: { targetDeviceId } }));
        window.location.href = '/?kicked=1';
      }
    });

    // Async Druck-ACK (statt Polling): print:queued/acked/failed
    socket.on('print:acked', (payload) => {
      window.dispatchEvent(new CustomEvent('openbon:print-acked', { detail: payload }));
    });
    socket.on('print:failed', (payload) => {
      window.dispatchEvent(new CustomEvent('openbon:print-failed', { detail: payload }));
    });
    socket.on('print:queued', (payload) => {
      window.dispatchEvent(new CustomEvent('openbon:print-queued', { detail: payload }));
    });
    socket.on('print:confirmed', (payload) => {
      window.dispatchEvent(new CustomEvent('openbon:print-confirmed', { detail: payload }));
    });
  }

  return socket!;
}

let memoryMuted = true;

export function isAudioMuted(): boolean {
  if (typeof window === 'undefined') return memoryMuted;
  const stored = localStorage.getItem('openbon_sound_muted');
  return stored !== null ? stored === 'true' : true;
}

export function setAudioMuted(muted: boolean): void {
  memoryMuted = muted;
  if (typeof window !== 'undefined') {
    localStorage.setItem('openbon_sound_muted', muted ? 'true' : 'false');
  }
}

export function playAcousticPing() {
  if (typeof window === 'undefined' || isAudioMuted()) return;
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext!)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
    osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.3); // High octave

    gain.gain.setValueAtTime(1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 1.2);

    // Also trigger mobile vibration if supported
    if ('vibrate' in navigator) {
      navigator.vibrate([300, 100, 300, 100, 500]);
    }
  } catch (e) {
    console.error('Audio play error:', e);
  }
}

export function playKitchenChime() {
  if (typeof window === 'undefined' || isAudioMuted()) return;
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext!)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.setValueAtTime(880.0, audioCtx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.6, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.8);
  } catch (e) {}
}

export function triggerHapticFeedback() {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(30);
    } catch {}
  }
}

export function onPrintAck(cb: (payload: { jobId: string; orderId: string | null }) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent).detail);
  window.addEventListener('openbon:print-acked', handler);
  return () => window.removeEventListener('openbon:print-acked', handler);
}

export function onPrintFailed(cb: (payload: { jobId: string; orderId: string | null; error?: string }) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent).detail);
  window.addEventListener('openbon:print-failed', handler);
  return () => window.removeEventListener('openbon:print-failed', handler);
}
