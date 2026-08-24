'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Smartphone,
  Banknote,
  ChefHat,
  Settings,
  Search,
  Lightbulb,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Printer,
} from 'lucide-react';
import { HANDBOOK, type DocChapter } from './handbook-data';

/**
 * Spec 8: Vollständige, interaktive Offline-HTML-Dokumentation unter /docs.
 * Alle Inhalte sind Teil des Bundles – kein Internet erforderlich.
 */

const ICONS = {
  waiter: Smartphone,
  pos: Banknote,
  kitchen: ChefHat,
  admin: Settings,
} as const;

const ACCENTS: Record<DocChapter['icon'], string> = {
  waiter: '#3B82F6',
  pos: '#10B981',
  kitchen: '#8B5CF6',
  admin: '#F59E0B',
};

export default function DocsPage() {
  const [activeId, setActiveId] = useState<string>(HANDBOOK[0].id);
  const [query, setQuery] = useState('');

  const active = HANDBOOK.find((c) => c.id === activeId) ?? HANDBOOK[0];

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return null;
    const hits: { chapter: DocChapter; heading: string; snippet: string }[] = [];
    for (const chapter of HANDBOOK) {
      for (const section of chapter.sections) {
        const haystack = [
          section.heading,
          ...(section.paragraphs ?? []),
          ...(section.steps ?? []),
          ...(section.hints ?? []).map((h) => h.text),
        ]
          .join(' ')
          .toLowerCase();
        if (haystack.includes(q)) {
          const source = section.paragraphs?.[0] ?? section.steps?.[0] ?? section.hints?.[0]?.text ?? '';
          hits.push({ chapter, heading: section.heading, snippet: source.slice(0, 160) });
        }
      }
    }
    return hits;
  }, [query]);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-8">
        {/* Kopfbereich */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <Link
            href="/"
            className="touch-target inline-flex items-center gap-2 px-4 rounded-2xl bg-slate-900 border border-slate-800 text-sm font-bold text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Startseite</span>
          </Link>
          <button
            onClick={() => window.print()}
            className="touch-target inline-flex items-center gap-2 px-4 rounded-2xl bg-slate-900 border border-slate-800 text-sm font-bold text-slate-300 hover:text-white"
          >
            <Printer className="w-4 h-4" />
            <span>Handbuch drucken</span>
          </button>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-800">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">OpenBon Handbuch</h1>
            <p className="text-sm text-slate-400 font-semibold">
              Vollständig offline verfügbar – auch ohne Internet am Festplatz
            </p>
          </div>
        </div>

        {/* Suche */}
        <div className="relative my-6">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Im Handbuch suchen, z. B. Storno, Pfand, Drucker..."
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {results ? (
          <div className="space-y-2 mb-8">
            <div className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              {results.length} Treffer
            </div>
            {results.map((hit, idx) => (
              <button
                key={`${hit.chapter.id}-${idx}`}
                onClick={() => {
                  setActiveId(hit.chapter.id);
                  setQuery('');
                }}
                className="w-full text-left p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-600 transition"
              >
                <div className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                  {hit.chapter.title}
                </div>
                <div className="font-black text-white">{hit.heading}</div>
                <div className="text-xs text-slate-400 font-medium mt-1 line-clamp-2">
                  {hit.snippet}…
                </div>
              </button>
            ))}
            {results.length === 0 && (
              <p className="text-sm text-slate-500 font-semibold py-6 text-center">
                Kein Treffer. Bitte einen anderen Begriff versuchen.
              </p>
            )}
          </div>
        ) : (
          <div className="grid lg:grid-cols-[280px_1fr] gap-6">
            {/* Kapitelnavigation */}
            <nav className="space-y-2 lg:sticky lg:top-4 lg:self-start">
              {HANDBOOK.map((chapter) => {
                const Icon = ICONS[chapter.icon];
                const isActive = chapter.id === activeId;
                return (
                  <button
                    key={chapter.id}
                    onClick={() => setActiveId(chapter.id)}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition flex items-start gap-3 ${
                      isActive ? 'bg-slate-900' : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                    style={isActive ? { borderColor: ACCENTS[chapter.icon] } : undefined}
                  >
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${ACCENTS[chapter.icon]}22`, color: ACCENTS[chapter.icon] }}
                    >
                      <Icon className="w-5 h-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-black text-sm text-white">{chapter.title}</span>
                      <span className="block text-[11px] text-slate-400 font-semibold leading-snug mt-0.5">
                        {chapter.subtitle}
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* Kapitelinhalt */}
            <article className="space-y-5">
              <header
                className="p-5 rounded-3xl border"
                style={{
                  backgroundColor: `${ACCENTS[active.icon]}14`,
                  borderColor: `${ACCENTS[active.icon]}55`,
                }}
              >
                <h2 className="text-xl font-black text-white">{active.title}</h2>
                <p className="text-sm text-slate-300 font-semibold mt-1">{active.subtitle}</p>
              </header>

              {active.sections.map((section) => (
                <section
                  key={section.heading}
                  className="p-5 rounded-3xl bg-slate-900 border border-slate-800"
                >
                  <h3 className="text-base font-black text-white mb-3">{section.heading}</h3>

                  {section.paragraphs?.map((p, idx) => (
                    <p key={idx} className="text-sm text-slate-300 font-medium leading-relaxed mb-2">
                      {p}
                    </p>
                  ))}

                  {section.steps && (
                    <ol className="space-y-2 my-2">
                      {section.steps.map((step, idx) => (
                        <li key={idx} className="flex gap-3 text-sm text-slate-300 font-medium">
                          <span className="w-6 h-6 shrink-0 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono font-bold flex items-center justify-center text-slate-300">
                            {idx + 1}
                          </span>
                          <span className="leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  )}

                  {section.table && (
                    <div className="overflow-x-auto my-3 rounded-2xl border border-slate-800">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-950">
                            {section.table.headers.map((h) => (
                              <th
                                key={h}
                                className="text-left px-4 py-2.5 font-black text-xs uppercase tracking-wider text-slate-400"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {section.table.rows.map((row, idx) => (
                            <tr key={idx} className="border-t border-slate-800">
                              {row.map((cell, cidx) => (
                                <td
                                  key={cidx}
                                  className="px-4 py-2.5 text-slate-300 font-medium align-top"
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {section.hints?.map((hint, idx) => (
                    <div
                      key={idx}
                      className={`mt-3 p-3.5 rounded-2xl border flex gap-2.5 text-sm font-semibold ${
                        hint.kind === 'tip'
                          ? 'bg-blue-950/50 border-blue-800 text-blue-200'
                          : 'bg-amber-950/50 border-amber-800 text-amber-200'
                      }`}
                    >
                      {hint.kind === 'tip' ? (
                        <Lightbulb className="w-5 h-5 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                      )}
                      <span className="leading-relaxed">{hint.text}</span>
                    </div>
                  ))}
                </section>
              ))}
            </article>
          </div>
        )}
      </div>
    </div>
  );
}
