'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Terminal,
  RefreshCw,
  DownloadCloud,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Play,
  Trash2,
  Cpu,
  GitBranch,
  Clock,
  Sparkles,
  ShieldCheck,
  HardDrive,
  Copy,
  Check,
} from 'lucide-react';
import { APP_VERSION, GITHUB_REPO_URL } from '@/lib/version';
import { triggerHapticFeedback } from '@/lib/socket-client';

interface TerminalEntry {
  id: string;
  command?: string;
  output: string;
  isError?: boolean;
  timestamp: string;
}

export default function SystemUpdatePage() {
  const [sysInfo, setSysInfo] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [executing, setExecuting] = useState(false);
  const [terminalHistory, setTerminalHistory] = useState<TerminalEntry[]>([
    {
      id: 'welcome',
      output: `[OPENBON SYSTEM-UPDATE & KONSOLE v${APP_VERSION}]\nBereit fuer Git-Befehle und System-Updates. Ziel: ${GITHUB_REPO_URL}`,
      timestamp: new Date().toLocaleTimeString('de-DE'),
    },
  ]);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  const fetchSystemStatus = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/system/update');
      const data = await res.json();
      setSysInfo(data);

      addTerminalLog(
        `[STATUS] Branch: ${data.branch} | Commit: ${data.localCommit} | Remote: ${data.remoteStatus}`,
        data.hasUpdate
      );
    } catch (e: any) {
      addTerminalLog(`[FEHLER] Statusabfrage fehlgeschlagen: ${e.message}`, true);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    fetchSystemStatus();
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalHistory]);

  const addTerminalLog = (output: string, isError = false, command?: string) => {
    setTerminalHistory((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        command,
        output,
        isError,
        timestamp: new Date().toLocaleTimeString('de-DE'),
      },
    ]);
  };

  const handleRunCommand = async (cmdToRun?: string) => {
    const cmd = (cmdToRun || commandInput).trim();
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
      } else {
        addTerminalLog(data.stderr || data.error || 'Ausführungsfehler', true, cmd);
      }
    } catch (e: any) {
      addTerminalLog(`Netzwerkfehler: ${e.message}`, true, cmd);
    } finally {
      setExecuting(false);
    }
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
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSystemStatus}
            disabled={checking}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-200 border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            <span>Prüfen</span>
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
          <Sparkles className="w-5 h-5 text-purple-400" />
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">GitHub Status</span>
            <span
              className={`text-xs font-bold truncate block ${
                sysInfo?.hasUpdate ? 'text-amber-400 animate-pulse' : 'text-emerald-400'
              }`}
            >
              {sysInfo?.remoteStatus || 'Wird geprüft...'}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Web Terminal Box */}
      <div className="flex-1 bg-black border-2 border-slate-800 rounded-3xl flex flex-col overflow-hidden shadow-2xl">
        {/* Terminal Header Bar */}
        <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            <span className="text-xs font-mono text-slate-400 font-bold ml-2">
              openbon@server:~/Kassensystem$
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={clearTerminal}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-bold px-2.5 py-1 rounded-lg bg-slate-800"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Leeren</span>
            </button>
          </div>
        </div>

        {/* Terminal Logs Viewport */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs sm:text-sm space-y-3">
          {terminalHistory.map((item) => (
            <div key={item.id} className="leading-relaxed">
              {item.command && (
                <div className="text-blue-400 font-bold flex items-center gap-2">
                  <span className="text-emerald-400">$</span>
                  <span>{item.command}</span>
                  <span className="text-[10px] text-slate-600 ml-auto font-normal">{item.timestamp}</span>
                </div>
              )}
              <pre
                className={`whitespace-pre-wrap font-mono mt-1 ${
                  item.isError ? 'text-rose-400 font-bold' : 'text-slate-300'
                }`}
              >
                {item.output}
              </pre>
            </div>
          ))}
          <div ref={terminalEndRef} />
        </div>

        {/* Quick Command Snippets Bar */}
        <div className="p-2 bg-slate-900/60 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[11px] font-bold text-slate-500 uppercase px-2">Schnellbefehle:</span>
          {[
            { label: 'git status', cmd: 'git status' },
            { label: 'git log (5)', cmd: 'git log -n 5 --oneline' },
            { label: 'git pull', cmd: 'git pull origin master' },
            { label: 'Tests ausführen', cmd: 'npm test' },
            { label: 'DB Status', cmd: 'npx prisma db push --skip-generate' },
          ].map((s) => (
            <button
              key={s.label}
              onClick={() => handleRunCommand(s.cmd)}
              disabled={executing}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300 border border-slate-700 whitespace-nowrap active:scale-95 transition"
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Terminal Input Line */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
          <span className="text-emerald-400 font-mono font-black text-sm">$</span>
          <input
            type="text"
            placeholder="Befehl eingeben (z. B. git status, git pull, npm test)..."
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRunCommand();
            }}
            disabled={executing}
            className="flex-1 bg-transparent border-none text-white font-mono text-xs sm:text-sm focus:outline-none placeholder-slate-600"
          />
          <button
            onClick={() => handleRunCommand()}
            disabled={executing || !commandInput.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Ausführen</span>
          </button>
        </div>
      </div>
    </div>
  );
}
