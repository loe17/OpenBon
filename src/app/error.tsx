'use client';

import React from 'react';
import { AlertOctagon, RotateCcw, Home } from 'lucide-react';
import Link from 'next/link';

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-8 shadow-2xl text-center">
        <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <AlertOctagon className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-black mb-3">Unerwarteter Anwendungsfehler</h1>
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
          Ein Fehler ist aufgetreten. Das Kassen-Journal und die Datenbank wurden nicht beeinträchtigt.
        </p>

        {error.message && (
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono text-rose-300 text-left mb-6 overflow-auto max-h-32">
            {error.message}
          </div>
        )}

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition shadow-lg shadow-blue-900/40"
          >
            <RotateCcw className="w-4 h-4" />
            Erneut versuchen
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold transition"
          >
            <Home className="w-4 h-4" />
            Zur Hauptseite
          </Link>
        </div>
      </div>
    </div>
  );
}
