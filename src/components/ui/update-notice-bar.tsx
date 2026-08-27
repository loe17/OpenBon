'use client';

import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { APP_VERSION } from '@/lib/version';

const DISMISS_KEY = 'openbon_update_notice_dismissed_version';
const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 Minuten

/**
 * N3.3 "Neue Version verfuegbar"-Hinweis fuer alle Stations-Clients.
 *
 * Bisher erfuhren Tablets/Stationen von einem Server-Update nie - der
 * ServiceWorker lieferte die alte Shell weiter und niemand wusste, dass ein
 * Reload noetig ist. Diese Leiste vergleicht die laufende Client-Build-Version
 * (APP_VERSION beim Build kompiliert) mit der aktuellen Server-Version aus
 * /api/config/public und bietet den Reload an. Nach einem Reload sind beide
 * identisch -> Hinweis verschwindet von selbst.
 */
export default function UpdateNoticeBar() {
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/config/public', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data?.appVersion === 'string') {
          setServerVersion(data.appVersion);
          try {
            setDismissedVersion(localStorage.getItem(DISMISS_KEY));
          } catch {}
        }
      } catch {
        /* offline: kein Hinweis */
      }
    };

    void load();
    const timer = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const updateAvailable =
    serverVersion !== null && serverVersion !== APP_VERSION && dismissedVersion !== serverVersion;

  if (!updateAvailable) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-[102] flex flex-wrap items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-700 shadow-lg"
    >
      <Download className="w-4 h-4" />
      <span>
        Neue Kassenversion v{serverVersion} verfügbar (aktuell: v{APP_VERSION}) – bitte neu laden.
      </span>
      <button
        onClick={() => window.location.reload()}
        className="ml-2 inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-md transition"
      >
        Jetzt aktualisieren
      </button>
      <button
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY, serverVersion ?? '');
          } catch {}
          setDismissedVersion(serverVersion);
        }}
        className="inline-flex items-center px-2 py-1 rounded-md hover:bg-white/20 transition text-white/80"
      >
        Später
      </button>
    </div>
  );
}
