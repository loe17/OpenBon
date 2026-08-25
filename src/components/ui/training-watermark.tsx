'use client';

import React, { useEffect, useState } from 'react';
import { useSocket } from '@/components/providers/socket-provider';

/**
 * Spec 6.11: Schulungs- & Trainingsmodus mit deutlichem Wasserzeichen auf dem Screen.
 */
export function TrainingWatermark() {
  const [active, setActive] = useState(false);
  const { socket } = useSocket();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/config/public');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setActive(Boolean(data?.trainingMode));
      } catch {
        /* Offline: Wasserzeichen bleibt aus */
      }
    };
    load();
    const timer = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onConfig = (cfg: { trainingMode?: boolean }) => {
      if (typeof cfg?.trainingMode === 'boolean') setActive(cfg.trainingMode);
    };
    socket.on('config:updated', onConfig);
    return () => {
      socket.off('config:updated', onConfig);
    };
  }, [socket]);

  if (!active) return null;

  return (
    <div className="training-watermark" aria-hidden="true">
      <span>Übungsmodus</span>
    </div>
  );
}

export default TrainingWatermark;
