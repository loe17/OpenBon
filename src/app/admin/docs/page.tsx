'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Smartphone,
  Banknote,
  ChefHat,
  Settings,
  Utensils,
  Printer as PrinterIcon,
  CreditCard,
  ShieldCheck,
  Activity,
  Search,
  Lightbulb,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Printer,
  FileText,
} from 'lucide-react';
import { HANDBOOK, type DocChapter } from '../../docs/handbook-data';
import { APP_VERSION } from '@/lib/version';

/**
 * Spec 8: Vollständige, interaktive Offline-Dokumentation.
 * Alle Inhalte sind Teil des Bundles - kein Internet erforderlich.
 * Beim Klick auf Drucken wird das gesamte Handbuch mit Titelblatt,
 * Versionsnummer (v0.4.2) und Inhaltsverzeichnis ausgegeben.
 */

const ICONS: Record<DocChapter['icon'], React.ComponentType<{ className?: string }>> = {
  system: Settings,
  waiter: Smartphone,
  pos: Banknote,
  kitchen: ChefHat,
  products: Utensils,
  printers: PrinterIcon,
  payment: CreditCard,
  backup: ShieldCheck,
  diagnostics: Activity,
};

const ACCENTS: Record<DocChapter['icon'], string> = {
  system: '#64748B',
  waiter: '#3B82F6',
  pos: '#10B981',
  kitchen: '#8B5CF6',
  products: '#F97316',
  printers: '#06B6D4',
  payment: '#EC4899',
  backup: '#14B8A6',
  diagnostics: '#F59E0B',
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
    <div className="flex-1 overflow-y-auto bg-slate-950 text-slate-100 print:bg-white print:text-slate-950">
      {/* ========================================================================= */}
      {/* 1. SCREEN VIEW (Hidden in Print) */}
      {/* ========================================================================= */}
      <div className="max-w-6xl mx-auto p-4 sm:p-8 print:hidden">
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
            className="touch-target inline-flex items-center gap-2 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-sm font-bold text-white shadow-lg transition"
          >
            <Printer className="w-4 h-4" />
            <span>Gesamtes Handbuch drucken (PDF)</span>
          </button>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-800">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-white">OpenBon Handbuch</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-900 text-blue-300 border border-blue-700">
                v{APP_VERSION}
              </span>
            </div>
            <p className="text-sm text-slate-400 font-semibold">
              Vollständig offline verfügbar – 9 Kapitel mit allen Funktionen &amp; Einstellungen
            </p>
          </div>
        </div>

        {/* Suchfeld */}
        <div className="relative my-6">
          <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Handbuch durchsuchen (z. B. 'Ziffernblock', 'Splitten', 'Kassensturz', 'Kartenzahlung', 'Storno') …"
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Suchergebnisse */}
        {results ? (
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-400 uppercase">
              Suchergebnisse ({results.length})
            </div>
            {results.map((hit, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setActiveId(hit.chapter.id);
                  setQuery('');
                }}
                className="w-full text-left p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-600 transition"
              >
                <div className="text-xs font-bold text-blue-400 uppercase mb-0.5">
                  Kapitel {hit.chapter.chapterNumber}: {hit.chapter.title}
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
          <div className="grid lg:grid-cols-[300px_1fr] gap-6">
            {/* Kapitelnavigation */}
            <nav className="space-y-2 lg:sticky lg:top-4 lg:self-start">
              {HANDBOOK.map((chapter) => {
                const Icon = ICONS[chapter.icon] || Settings;
                const isActive = chapter.id === activeId;
                return (
                  <button
                    key={chapter.id}
                    onClick={() => setActiveId(chapter.id)}
                    className={`w-full text-left p-3.5 rounded-2xl border-2 transition flex items-start gap-3 ${
                      isActive ? 'bg-slate-900' : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                    style={isActive ? { borderColor: ACCENTS[chapter.icon] } : undefined}
                  >
                    <span
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: `${ACCENTS[chapter.icon]}22`, color: ACCENTS[chapter.icon] }}
                    >
                      <Icon className="w-5 h-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-black text-sm text-white">
                        {chapter.chapterNumber}. {chapter.title}
                      </span>
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
                <div className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Kapitel {active.chapterNumber} von {HANDBOOK.length}
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-1">{active.title}</h2>
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
                    <ol className="space-y-2 my-3">
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
                    <div className="overflow-x-auto my-4 rounded-2xl border border-slate-800">
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

      {/* ========================================================================= */}
      {/* 2. PRINT VIEW: Complete Book with Cover, Table of Contents & All Chapters */}
      {/* ========================================================================= */}
      <div className="hidden print:block p-8 max-w-4xl mx-auto font-sans text-slate-950 bg-white">
        {/* Cover Page */}
        <div className="text-center py-20 border-b-4 border-slate-900 mb-12">
          <div className="w-20 h-20 mx-auto mb-6 bg-slate-900 text-white rounded-3xl flex items-center justify-center font-black text-3xl">
            OB
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tight text-slate-950">OpenBon Kassenhandbuch</h1>
          <p className="text-xl font-bold text-slate-700 mt-2">
            Vollständiges Bedien- und Administrationshandbuch
          </p>
          <div className="inline-block mt-6 px-4 py-1.5 rounded-full border-2 border-slate-900 font-mono font-black text-sm">
            Version v{APP_VERSION} · Stand: {new Date().toLocaleDateString('de-DE')}
          </div>
          <p className="text-xs text-slate-500 mt-8">
            Revisionssicheres Fest- &amp; Gastronomiekassensystem · 100% Offline-fähig
          </p>
        </div>

        {/* Table of Contents */}
        <div className="mb-12 border-b-2 border-slate-300 pb-8" style={{ pageBreakAfter: 'always' }}>
          <h2 className="text-2xl font-black uppercase tracking-wider mb-6 pb-2 border-b-2 border-slate-900">
            Inhaltsverzeichnis
          </h2>
          <div className="space-y-4">
            {HANDBOOK.map((chapter) => (
              <div key={chapter.id} className="space-y-1">
                <div className="flex justify-between font-black text-base border-b border-dotted border-slate-400 pb-0.5">
                  <span>Kapitel {chapter.chapterNumber}: {chapter.title}</span>
                  <span className="font-mono text-slate-600">Kap. {chapter.chapterNumber}</span>
                </div>
                <div className="pl-4 space-y-0.5 text-xs text-slate-600 font-medium">
                  {chapter.sections.map((sec, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{sec.heading}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* All Chapters Sequentially */}
        <div className="space-y-12">
          {HANDBOOK.map((chapter) => (
            <div key={chapter.id} className="space-y-6" style={{ pageBreakBefore: 'always' }}>
              <div className="border-b-2 border-slate-900 pb-3">
                <div className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Kapitel {chapter.chapterNumber}
                </div>
                <h2 className="text-2xl font-black text-slate-950 uppercase">{chapter.title}</h2>
                <p className="text-sm font-bold text-slate-600">{chapter.subtitle}</p>
              </div>

              {chapter.sections.map((section, idx) => (
                <div key={idx} className="space-y-3 text-sm leading-relaxed border-b border-slate-200 pb-4">
                  <h3 className="text-base font-black text-slate-900">{section.heading}</h3>

                  {section.paragraphs?.map((p, pIdx) => (
                    <p key={pIdx} className="text-slate-800">
                      {p}
                    </p>
                  ))}

                  {section.steps && (
                    <ol className="space-y-1.5 my-2">
                      {section.steps.map((step, sIdx) => (
                        <li key={sIdx} className="flex gap-2 text-slate-800">
                          <span className="font-black text-xs font-mono">{sIdx + 1}.</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  )}

                  {section.table && (
                    <table className="w-full text-xs my-3 border border-slate-400">
                      <thead className="bg-slate-100 border-b border-slate-400 font-black">
                        <tr>
                          {section.table.headers.map((h) => (
                            <th key={h} className="text-left px-3 py-2 border-r border-slate-300 last:border-r-0">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {section.table.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="border-b border-slate-300">
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="px-3 py-1.5 border-r border-slate-200 last:border-r-0">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {section.hints?.map((hint, hIdx) => (
                    <div key={hIdx} className="p-2.5 rounded-lg bg-slate-100 border border-slate-300 text-xs font-medium">
                      <span className="font-bold">{hint.kind === 'tip' ? 'Tipp: ' : 'Hinweis: '}</span>
                      {hint.text}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
