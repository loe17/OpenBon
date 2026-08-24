'use client';

import React, { useEffect, useState } from 'react';
import {
  Terminal,
  RefreshCw,
  DownloadCloud,
  CheckCircle2,
  AlertTriangle,
  GitBranch,
  Cpu,
  Clock,
  Sparkles,
  Play,
  RotateCcw,
  Trash2,
  Tag,
  ExternalLink,
  ShieldCheck,
  Copy,
  Check,
} from 'lucide-react';
import { APP_VERSION, GITHUB_REPO_URL } from '@/lib/version';
import { triggerHapticFeedback } from '@/lib/socket-client';
import { copyTextToClipboard } from '@/lib/clipboard';

interface SystemInfo {
  currentVersion?: string;
  version?: string;
  latestVersion?: string;
  branch?: string;
  localCommit?: string;
  remoteStatus?: string;
  nodeVersion?: string;
  arch?: string;
  uptime?: number;
  hasUpdate?: boolean;
  updateType?: 'RELEASE' | 'HOTFIX' | 'NONE';
  isNewRelease?: boolean;
  latestReleaseVersion?: string | null;
  latestReleaseName?: string | null;
  latestReleaseBody?: string | null;
  latestReleaseUrl?: string | null;
  pendingCommits?: string[];
}

interface TerminalLog {
  id: string;
  text: string;
  isError?: boolean;
  timestamp: string;
  command?: string;
}

export default function AdminSystemUpdatePage() {
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [executing, setExecuting] = useState(false);
  const [terminalHistory, setTerminalHistory] = useState<TerminalLog[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);

  const copyAllLogs = async () => {
    triggerHapticFeedback();
    const text = terminalHistory
      .map((l) => (l.command ? `$ ${l.command} [${l.timestamp}]\n${l.text}` : l.text))
      .join('\n\n');

    const success = await copyTextToClipboard(text);
    if (success) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    }
  };

  const addTerminalLog = (text: string, isError = false, command?: string) => {
    const newLog: TerminalLog = {
      id: Math.random().toString(36).substring(2, 9),
      text,
      isError,
      timestamp: new Date().toLocaleTimeString('de-DE'),
      command,
    };
    setTerminalHistory((prev) => [...prev, newLog]);
  };

  const fetchSystemStatus = async () => {
    setChecking(true);
    triggerHapticFeedback();
    try {
      const res = await fetch('/api/system/update');
      const data = await res.json();
      setSysInfo(data);

      if (data.updateType === 'RELEASE') {
        addTerminalLog(
          `[RELEASE-UPDATE] Neues offizielles Release v${data.latestReleaseVersion} (${data.latestReleaseName || ''}) auf GitHub verfügbar!\nAktuell installiert: v${APP_VERSION}`,
          false
        );
      } else if (data.pendingCommits && data.pendingCommits.length > 0) {
        addTerminalLog(
          `[PATCH-UPDATE] ${data.pendingCommits.length} Hotfix-Commit(s) auf GitHub verfügbar:\n${data.pendingCommits.join('\n')}`,
          false
        );
      } else {
        addTerminalLog(`[STATUS] System ist auf dem neuesten Stand (v${APP_VERSION}, Commit: ${data.localCommit || '-'})`);
      }
    } catch (e) {
      addTerminalLog(`Fehler bei Statusprüfung: ${e instanceof Error ? e.message : String(e)}`, true);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    addTerminalLog(
      `[OPENBON SYSTEM-UPDATE & KONSOLE v${APP_VERSION}]\nBereit fuer Git-Befehle und System-Updates. Ziel: ${GITHUB_REPO_URL}`
    );
    fetchSystemStatus();
  }, []);

  const handleExecuteCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = commandInput.trim();
    if (!cmd || executing) return;

    triggerHapticFeedback();
    setExecuting(true);
    setCommandInput('');

    try {
      const res = await fetch('/api/system/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'EXEC', customCommand: cmd }),
      });
      const data = await res.json();

      if (data.success) {
        addTerminalLog(
          data.stdout || (data.stderr ? `[STDERR]: ${data.stderr}` : '[Befehl ohne Ausgabe beendet]'),
          false,
          cmd
        );
        if (data.restart) {
          addTerminalLog('[NEUSTART] Seite wird in 3 Sekunden automatisch neu geladen...', false);
          setTimeout(() => {
            window.location.reload();
          }, 3500);
        }
      } else {
        addTerminalLog(data.stderr || data.error || 'Ausführungsfehler', true, cmd);
      }
    } catch (e) {
      addTerminalLog(`Netzwerkfehler: ${e instanceof Error ? e.message : String(e)}`, true, cmd);
    } finally {
      setExecuting(false);
    }
  };

  const handleRestartServer = async () => {
    if (!confirm('Möchtest du den OpenBon Server-Prozess jetzt neu starten?')) return;

    triggerHapticFeedback();
    addTerminalLog('[START] Sende Neustart-Signal an den OpenBon Dienst...', false);

    try {
      const res = await fetch('/api/system/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESTART' }),
      });
      const data = await res.json();

      if (data.success) {
        addTerminalLog(data.stdout || '[INFO] Neustart initiiert...', false);
        addTerminalLog('[INFO] Bitte warte 3-5 Sekunden während der Dienst neu anläuft...', false);
        setTimeout(() => {
          window.location.reload();
        }, 4000);
      } else {
        addTerminalLog(data.error || 'Fehler beim Neustarten', true);
      }
    } catch (e) {
      addTerminalLog(`Netzwerkfehler: ${e instanceof Error ? e.message : String(e)}`, true);
    }
  };

  const handleInstallUpdate = async () => {
    if (!sysInfo?.hasUpdate) return;

    const label = sysInfo.updateType === 'RELEASE'
      ? `Release v${sysInfo.latestReleaseVersion}`
      : `${sysInfo.pendingCommits?.length || 1} neue(n) Commit(s)`;

    if (
      !confirm(
        `OpenBon jetzt auf ${label} aktualisieren?\n\nDer Server lädt den neuesten Stand von GitHub, migriert die Datenbank, kompiliert den Build neu und startet sich automatisch wieder.`
      )
    ) {
      return;
    }

    triggerHapticFeedback();
    setUpdating(true);
    addTerminalLog(`[UPDATE-START] Starte Update auf ${label}...`, false);

    try {
      const res = await fetch('/api/system/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'INSTALL_UPDATE' }),
      });
      const data = await res.json();

      if (data.success) {
        addTerminalLog(data.logs || '[INFO] Update erfolgreich!', false);
        addTerminalLog('[INFO] Der Server startet jetzt neu. Die Seite lädt sich in Kürze automatisch neu...', false);
        setTimeout(() => {
          window.location.reload();
        }, 5000);
      } else {
        addTerminalLog(data.logs || data.error || 'Fehler beim Update-Vorgang', true);
      }
    } catch (e) {
      addTerminalLog(`Update-Fehler: ${e instanceof Error ? e.message : String(e)}`, true);
    } finally {
      setUpdating(false);
    }
  };

  const clearTerminal = () => {
    setTerminalHistory([]);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-white p-3 sm:p-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black">System-Update & Konsole</h1>
              <span className="bg-blue-950 text-blue-300 font-bold px-2.5 py-0.5 rounded-lg text-xs border border-blue-700">
                v{APP_VERSION}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              GitHub-Repository: <span className="text-blue-400 font-mono">{GITHUB_REPO_URL}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchSystemStatus}
            disabled={checking}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-200 border border-slate-700 transition active:scale-95"
            title="Auf GitHub nach neuen Releases und Commits suchen"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            <span>Prüfen</span>
          </button>

          <button
            onClick={handleRestartServer}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-amber-950/60 hover:border-amber-700 text-amber-300 rounded-xl text-xs font-bold border border-slate-700 transition shadow active:scale-95"
            title="Startet den Server-Prozess im Hintergrunddienst neu"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Server neu starten</span>
          </button>

          {/* Intelligenter Update-Button (Option C) */}
          <button
            onClick={handleInstallUpdate}
            disabled={updating || !sysInfo?.hasUpdate}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black shadow-lg transition ${
              updating
                ? 'bg-amber-600 text-white cursor-wait'
                : !sysInfo?.hasUpdate
                ? 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed opacity-60 shadow-none'
                : sysInfo.updateType === 'RELEASE'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50 animate-pulse active:scale-95'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-950/50 active:scale-95'
            }`}
            title={
              !sysInfo?.hasUpdate
                ? 'Das System ist auf dem neuesten Stand. Kein Update erforderlich.'
                : 'Klicken, um das Update von GitHub zu laden und zu installieren.'
            }
          >
            {updating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Installiert Update...</span>
              </>
            ) : !sysInfo?.hasUpdate ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>System ist aktuell (v{APP_VERSION})</span>
              </>
            ) : sysInfo.updateType === 'RELEASE' ? (
              <>
                <DownloadCloud className="w-4 h-4 animate-bounce" />
                <span>Update auf v{sysInfo.latestReleaseVersion} installieren</span>
              </>
            ) : (
              <>
                <DownloadCloud className="w-4 h-4" />
                <span>Patch installieren ({sysInfo.pendingCommits?.length} Commits)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Release Banner if new official release is available */}
      {sysInfo?.isNewRelease && sysInfo.latestReleaseVersion && (
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border-2 border-emerald-500/80 rounded-2xl p-4 mb-4 flex items-center justify-between shadow-xl animate-in slide-in-from-top">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/40">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-white">
                  Neues offizielles Release verfügbar: v{sysInfo.latestReleaseVersion}
                </span>
                <span className="text-[10px] bg-emerald-900/80 text-emerald-300 font-mono font-bold px-2 py-0.5 rounded border border-emerald-700">
                  Empfohlen
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 line-clamp-1">
                {sysInfo.latestReleaseName || 'Neue Funktionen & Stabilitätsverbesserungen'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {sysInfo.latestReleaseUrl && (
              <a
                href={sysInfo.latestReleaseUrl}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 transition"
              >
                <span>Release-Notes</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Status Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 shrink-0">
        <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 flex items-center gap-3">
          <GitBranch className="w-5 h-5 text-blue-400 shrink-0" />
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Branch & Commit</span>
            <span className="text-xs font-mono font-bold text-slate-200 truncate block">
              {sysInfo?.branch || 'master'} ({sysInfo?.localCommit || '-'})
            </span>
          </div>
        </div>

        <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 flex items-center gap-3">
          <Cpu className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Umgebung</span>
            <span className="text-xs font-mono font-bold text-slate-200 truncate block">
              Node {sysInfo?.nodeVersion || process.version} ({sysInfo?.arch || 'x64'})
            </span>
          </div>
        </div>

        <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Server-Uptime</span>
            <span className="text-xs font-mono font-bold text-slate-200 truncate block">
              {sysInfo?.uptime ? `${Math.floor(sysInfo.uptime / 60)} Min.` : 'Online'}
            </span>
          </div>
        </div>

        <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 flex items-center gap-3">
          {sysInfo?.hasUpdate ? (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">GitHub-Status</span>
            <span
              className={`text-xs font-bold truncate block ${
                sysInfo?.hasUpdate ? 'text-amber-300' : 'text-emerald-300'
              }`}
            >
              {sysInfo?.remoteStatus || 'Wird geprüft...'}
            </span>
          </div>
        </div>
      </div>

      {/* Terminal View Container */}
      <div className="flex-1 flex flex-col bg-black border border-slate-800 rounded-3xl overflow-hidden shadow-2xl font-mono text-xs min-h-0">
        {/* Terminal Header */}
        <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            <span className="text-slate-400 font-bold ml-2 text-[11px]">Server-Konsole & Git-Runner</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={copyAllLogs}
              disabled={terminalHistory.length === 0}
              className="flex items-center gap-1 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition text-[11px] font-bold border border-slate-700 disabled:opacity-40 active:scale-95"
              title="Gesamte Konsolenausgabe in Zwischenablage kopieren"
            >
              {copiedAll ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Kopiert!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Kopieren</span>
                </>
              )}
            </button>

            <button
              onClick={clearTerminal}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              title="Terminal leeren"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Terminal Output Log Area */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono select-text selection:bg-blue-600 selection:text-white cursor-text">
          {terminalHistory.map((log) => (
            <div key={log.id} className="space-y-1 select-text">
              {log.command && (
                <div className="text-emerald-400 font-bold flex items-center gap-2 select-text">
                  <span className="text-slate-500 select-none">$</span>
                  <span className="select-text">{log.command}</span>
                  <span className="text-[10px] text-slate-600 font-normal ml-auto select-none">{log.timestamp}</span>
                </div>
              )}
              <pre
                className={`whitespace-pre-wrap leading-relaxed select-text cursor-text font-mono ${
                  log.isError ? 'text-rose-400 font-bold' : 'text-slate-300'
                }`}
              >
                {log.text}
              </pre>
            </div>
          ))}
        </div>

        {/* Command Input Bar */}
        <form onSubmit={handleExecuteCommand} className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2 shrink-0">
          <span className="text-emerald-400 font-black pl-2">$</span>
          <input
            type="text"
            placeholder="Befehl eingeben (z. B. 'git status', 'git pull', 'restart')..."
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            disabled={executing}
            className="flex-1 bg-transparent border-none text-white text-xs font-mono focus:outline-none placeholder-slate-600"
          />
          <button
            type="submit"
            disabled={executing || !commandInput.trim()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Ausführen</span>
          </button>
        </form>
      </div>
    </div>
  );
}
