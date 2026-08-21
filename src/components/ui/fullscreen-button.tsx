'use client';

import React, { useState, useEffect } from 'react';
import { Maximize2, Minimize2, Share, HelpCircle, X } from 'lucide-react';

export default function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosTip, setShowIosTip] = useState(false);

  useEffect(() => {
    const checkIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIos(checkIos);

    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (isIos) {
      setShowIosTip(true);
      return;
    }

    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        setShowIosTip(true);
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <>
      <button
        onClick={toggleFullscreen}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold shadow-sm transition active:scale-95 touch-manipulation"
        title="Vollbildmodus aktivieren/beenden"
      >
        {isFullscreen ? (
          <>
            <Minimize2 className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline">Fenster</span>
          </>
        ) : (
          <>
            <Maximize2 className="w-4 h-4 text-blue-400" />
            <span className="hidden md:inline">Vollbild</span>
          </>
        )}
      </button>

      {/* iOS Safari Tip Modal */}
      {showIosTip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-5 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2 font-bold text-base">
                <Share className="w-4 h-4 text-blue-400" />
                <span>Vollbild auf Apple iOS</span>
              </div>
              <button onClick={() => setShowIosTip(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Apple Safari unterstützt Vollbild direkt als <strong>Web-App</strong>:
            </p>

            <ol className="text-xs text-slate-300 space-y-2 mb-4 bg-slate-950 p-3 rounded-2xl border border-slate-800 list-decimal list-inside">
              <li>Tippe unten in Safari auf das <strong>Teilen-Symbol</strong>.</li>
              <li>Wähle <strong>"Zum Home-Bildschirm"</strong>.</li>
              <li>Öffne <strong>OpenBon</strong> über das neue App-Icon auf deinem Homescreen.</li>
            </ol>

            <button
              onClick={() => setShowIosTip(false)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg"
            >
              Verstanden
            </button>
          </div>
        </div>
      )}
    </>
  );
}
