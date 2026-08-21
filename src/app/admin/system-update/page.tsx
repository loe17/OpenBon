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
} from 'lucide-react';
import { APP_VERSION, GITHUB_REPO_URL } from '@/lib/version';
import { triggerHapticFeedback } from '@/lib/socket-client';

interface TerminalLog {
  id: string;
  text: string;
  isError?: boolean;
  timestamp: string;
  command?: string;
}

export default function AdminSystemUpdatePage() {
  const [sysInfo, setSysInfo] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [executing, setExecuting] = useState(false);
  const [terminalHistory, setTerminalHistory] = useState<TerminalLog[]>([]);

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
      if (data.pendingCommits && data.pendingCommits.length > 0) {
        addTerminalLog(
          `[STATUS] ${data.pendingCommits.length} Update(s) auf GitHub verfügbar:\n${data.pendingCommits.join('\n')}`,
          false
        );
      } else {
        addTerminalLog(`[STATUS] Branch: ${data.branch || 'master'} | Commit: ${data.localCommit || '-'} | Remote: Aktuell`);
      }
    } catch (e: any) {
      addTerminalLog(`Fehler bei Statusprüfung: ${e.message}`, true);
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
    } catch (e: any) {
      addTerminalLog(`Netzwerkfehler: ${e.message}`, true, cmd);
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
        addTerminalLog(data.stdout, false);
      }
    } catch {
      // Ignore network break during restart
    }

    addTerminalLog('[NEUSTART] Server startet neu. Seite lädt in 3 Sekunden neu...', false);
    setTimeout(() => {
      window.location.reload();
    }, 3500);
  };

  const handleInstallUpdate = async () => {
    if (updating) return;
    if (!confirm('Möchtest du das neueste Update von GitHub jetzt herunterladen und installieren?')) return;

    triggerHapticFeedback();
    setUpdating(true);
    addTerminalLog(`[START] Starte vollständigen Update-Prozess von GitHub (${GITHUB_REPO_URL})...`);

    try {
      const res = await fetch('/api/system/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'INSTALL_UPDATE' }),
      });
      const data = await res.json();

      if (data.success) {
        addTerminalLog(data.logs, false);
        addTerminalLog('[NEUSTART] Server startet jetzt mit der neuen Version neu. Seite lädt in Kürze neu...', false);
        setTimeout(() => {
          window.location.reload();
        }, 4000);
      } else {
        addTerminalLog(`[UPDATE FEHLGESCHLAGEN]: ${data.error}`, true);
      }
    } catch (e: any) {
      addTerminalLog(`[FEHLER]: ${e.message}`, true);
    } finally {
      setUpdating(false);
    }
  };

  const clearTerminal = () => {
    setTerminalHistory([]);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-white p-3 sm:p-6 max-w-6xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2.5 rounded-2xl shadow">
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
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-200 border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            <span>Prüfen</span>
          </button>

          <button
            onClick={handleRestartServer}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-amber-950/60 hover:border-amber-700 text-amber-300 rounded-xl text-xs font-bold border border-slate-700 transition shadow"
            title="Startet den Server-Prozess im Hintergrunddienst neu"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Server neu starten</span>
          </button>

          <button
            onClick={handleInstallUpdate}
            disabled={updating}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black shadow-lg transition ${
              updating
                ? 'bg-amber-600 text-white cursor-wait'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
            }`}
          >
            <DownloadCloud className={`w-4 h-4 ${updating ? 'animate-bounce' : ''}`} />
            <span>{updating ? 'Installiert Update...' : 'Update installieren'}</span>
          </button>
        </div>
      </div>

      {/* Status Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 flex items-center gap-3">
          <GitBranch className="w-5 h-5 text-blue-400" />
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Branch & Commit</span>
            <span className="text-xs font-mono font-bold text-slate-200 truncate block">
              {sysInfo?.branch || 'master'} ({sysInfo?.localCommit || '-'})
            </span>
          </div>
        </div>

        <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 flex items-center gap-3">
          <Cpu className="w-5 h-5 text-emerald-400" />
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Umgebung</span>
            <span className="text-xs font-mono font-bold text-slate-200 truncate block">
              Node {sysInfo?.nodeVersion || process.version} ({sysInfo?.arch || 'x64'})
            </span>
          </div>
        </div>

        <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-400" />
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Server-Uptime</span>
            <span className="text-xs font-mono font-bold text-slate-200 truncate block">
              {sysInfo?.uptime ? `${Math.floor(sysInfo.uptime / 60)} Min.` : 'Online'}
            </span>
          </div>
        </div>

        <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 flex items-center gap-3">
          {sysInfo?.hasUpdate ? (
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
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
      <div className="flex-1 flex flex-col bg-black border border-slate-800 rounded-3xl overflow-hidden shadow-2xl font-mono text-xs">
        {/* Terminal Header */}
        <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            <span className="text-slate-400 font-bold ml-2 text-[11px]">Server-Konsole & Git-Runner</span>
          </div>
          <button
            onClick={clearTerminal}
            className="text-slate-400 hover:text-white p-1 rounded transition"
            title="Terminal leeren"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Terminal Output Log Area */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono">
          {terminalHistory.map((log) => (
            <div key={log.id} className="space-y-1">
              {log.command && (
                <div className="text-emerald-400 font-bold flex items-center gap-2">
                  <span className="text-slate-500">$</span>
                  <span>{log.command}</span>
                  <span className="text-[10px] text-slate-600 font-normal ml-auto">{log.timestamp}</span>
                </div>
              )}
              <pre
                className={`whitespace-pre-wrap leading-relaxed ${
                  log.isError ? 'text-rose-400 font-bold' : 'text-slate-300'
                }`}
              >
                {log.text}
              </pre>
            </div>
          ))}
        </div>

        {/* Command Input Bar */}
        <form onSubmit={handleExecuteCommand} className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
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
