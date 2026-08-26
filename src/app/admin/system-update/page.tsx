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
  Play,
  RotateCcw,
  Trash2,
  Tag,
  ExternalLink,
  Copy,
  Check,
  Layers,
  ArrowDownCircle,
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
  availableTags?: string[];
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
  const [selectedTarget, setSelectedTarget] = useState<string>('v0.4.2');
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateStage, setUpdateStage] = useState('Vorbereitung...');
  const [updateElapsed, setUpdateElapsed] = useState(0);

  // Live Timer & Progress Simulation waehrend des Update-Laufs
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (updating) {
      setUpdateElapsed(0);
      setUpdateProgress(8);
      setUpdateStage('Sicherheits-Backup der Datenbank wird erstellt...');

      interval = setInterval(() => {
        setUpdateElapsed((prev) => {
          const next = prev + 1;
          if (next <= 5) {
            setUpdateProgress(15);
            setUpdateStage('1/5: Sicherheits-Snapshot der Datenbank wird gespeichert...');
          } else if (next <= 12) {
            setUpdateProgress(32);
            setUpdateStage('2/5: Neuesten Code von GitHub laden & Tag auschecken...');
          } else if (next <= 22) {
            setUpdateProgress(52);
            setUpdateStage('3/5: Node.js-Abhängigkeiten installieren (npm install)...');
          } else if (next <= 34) {
            setUpdateProgress(68);
            setUpdateStage('4/5: Datenbankschema synchronisieren (prisma db push)...');
          } else if (next <= 120) {
            // Langsamer Anstieg während des next build (dauert auf Raspberry Pi am längsten)
            setUpdateProgress((p) => Math.min(93, p + 0.5));
            setUpdateStage('5/5: Produktions-Build kompilieren (next build)... Dies kann auf Einplatinencomputern 1-2 Minuten dauern.');
          }
          return next;
        });
      }, 1000);
    } else {
      if (updateProgress > 0 && updateProgress < 100) {
        setUpdateProgress(100);
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [updating]);

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

      if (data.availableTags && data.availableTags.length > 0) {
        if (!selectedTarget || selectedTarget === 'v0.4.2') {
          setSelectedTarget(data.availableTags[0] || 'v0.4.2');
        }
      }

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
      `[OPENBON SYSTEM-UPDATE & VERSIONS-MANAGER v${APP_VERSION}]\nBereit für Releases, Tags, Rollbacks und Git-Befehle. Repository: ${GITHUB_REPO_URL}`
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

  const handleInstallTarget = async (targetRef: string) => {
    const isMaster = targetRef === 'master';
    const isTag = targetRef.startsWith('v');
    const label = isMaster ? 'Entwicklungs-Branch (master)' : `Release-Version ${targetRef}`;

    if (
      !confirm(
        `OpenBon jetzt auf ${label} setzen?\n\nDer Server führt vorab ein Sicherheits-Backup der Datenbank durch, lädt den Stand von GitHub herunter, führt eventuelle Datenbankmigrationen aus, kompiliert die Anwendung neu und startet den Dienst wieder.`
      )
    ) {
      return;
    }

    triggerHapticFeedback();
    setUpdating(true);
    addTerminalLog(`[UPDATE-START] Wechsle zu ${label}...`, false);

    try {
      const res = await fetch('/api/system/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'INSTALL_UPDATE',
          targetVersion: targetRef,
          targetType: isTag ? 'TAG' : isMaster ? 'BRANCH' : 'COMMIT',
        }),
      });
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        const text = await res.text().catch(() => '');
        data = {
          success: false,
          error: text || `HTTP-Status ${res.status}: ${res.statusText}`,
          logs: text ? `Server-Antwort:\n${text}` : undefined,
        };
      }

      if (data && data.success) {
        addTerminalLog(data.logs || '[INFO] Aktualisierung erfolgreich abgeschlossen!', false);
        addTerminalLog('[INFO] Der Server startet jetzt neu. Die Seite lädt sich in Kürze automatisch neu...', false);
        setTimeout(() => {
          window.location.reload();
        }, 5000);
      } else {
        addTerminalLog(data?.logs || data?.error || 'Fehler beim Update-Vorgang', true);
      }
    } catch (e) {
      addTerminalLog(`Netzwerk-/Verbindungsabbruch: ${e instanceof Error ? e.message : String(e)}\nHinweis: Auf Single-Board-Computern (Raspberry Pi) kann das Bauen 2-3 Minuten dauern. Bitte prüfe per Terminal mit "journalctl -u openbon -f" den Status.`, true);
    } finally {
      setUpdating(false);
    }
  };

  const clearTerminal = () => {
    setTerminalHistory([]);
  };

  const tagsList = sysInfo?.availableTags && sysInfo.availableTags.length > 0
    ? sysInfo.availableTags
    : ['v0.4.2', 'v0.4.1', 'v0.4.0'];

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
              <h1 className="text-xl sm:text-2xl font-black">System-Update &amp; Versions-Manager</h1>
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
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-200 border border-slate-700 transition active:scale-95"
            title="Auf GitHub nach neuen Releases und Commits suchen"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            <span>Prüfen</span>
          </button>

          <button
            onClick={handleRestartServer}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-amber-950/60 hover:border-amber-700 text-amber-300 rounded-xl text-xs font-bold border border-slate-700 transition shadow active:scale-95"
            title="Startet den Server-Prozess im Hintergrunddienst neu"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Server neu starten</span>
          </button>
        </div>
      </div>

      {/* Version & Channel Chooser Card */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 mb-4 shrink-0 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-800">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black text-white flex items-center gap-2">
                <span>Zielversion / Release auswählen</span>
                <span className="text-[10px] font-mono font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                  Aktiv: v{APP_VERSION} ({sysInfo?.localCommit || '-'})
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Wähle ein offizielles Release (Tag) für Festbetrieb oder den Master-Branch für Entwicklungsstände.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-white text-xs font-bold font-mono rounded-xl px-3 py-2.5 focus:border-blue-500"
            >
              <optgroup label="🏷️ Versionen &amp; Git-Tags">
                {tagsList.map((t) => (
                  <option key={t} value={t}>
                    Tag {t} {t === `v${APP_VERSION}` ? '(Aktuell installiert)' : ''}
                  </option>
                ))}
              </optgroup>
              <optgroup label="🌿 Entwicklungs-Branch">
                <option value="master">Branch: master (Entwicklungsstand)</option>
              </optgroup>
            </select>

            <button
              onClick={() => handleInstallTarget(selectedTarget)}
              disabled={updating}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition active:scale-95 disabled:opacity-50"
            >
              {updating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Wird installiert...</span>
                </>
              ) : (
                <>
                  <ArrowDownCircle className="w-4 h-4" />
                  <span>Auf {selectedTarget} wechseln</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Release Banner if new official release is available */}
      {sysInfo?.isNewRelease && sysInfo.latestReleaseVersion && (
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border-2 border-emerald-500/80 rounded-2xl p-4 mb-4 flex items-center justify-between shadow-xl animate-in slide-in-from-top shrink-0">
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
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Branch &amp; Commit</span>
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

      {/* Live Update Progress & Stage Indicator Bar */}
      {updating && (
        <div className="bg-slate-900 border-2 border-emerald-500/80 rounded-3xl p-4 sm:p-5 mb-4 shadow-2xl animate-in zoom-in-95 shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <RefreshCw className="w-5 h-5 animate-spin" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-black text-white flex items-center gap-2">
                  <span>System-Update läuft...</span>
                  <span className="font-mono text-xs text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-700">
                    {Math.round(updateProgress)}%
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium mt-0.5 truncate">{updateStage}</p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[10px] uppercase font-bold text-slate-400">Dauer</div>
              <div className="text-sm font-mono font-black text-emerald-300">
                {String(Math.floor(updateElapsed / 60)).padStart(2, '0')}:{String(updateElapsed % 60).padStart(2, '0')} min
              </div>
            </div>
          </div>

          {/* Progress Bar Track & Glow Fill */}
          <div className="w-full bg-slate-950 h-3.5 rounded-full overflow-hidden border border-slate-800 p-0.5">
            <div
              className="bg-gradient-to-r from-blue-500 via-emerald-400 to-emerald-500 h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_12px_rgba(16,185,129,0.5)]"
              style={{ width: `${Math.max(5, Math.min(100, updateProgress))}%` }}
            />
          </div>

          {/* Progress Stages Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1 text-center">
            <div className={`p-1.5 rounded-xl text-[10px] font-bold border transition ${updateProgress >= 15 ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300' : 'bg-slate-950/60 border-slate-800 text-slate-500'}`}>
              💾 1. Backup
            </div>
            <div className={`p-1.5 rounded-xl text-[10px] font-bold border transition ${updateProgress >= 32 ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300' : 'bg-slate-950/60 border-slate-800 text-slate-500'}`}>
              📥 2. Checkout
            </div>
            <div className={`p-1.5 rounded-xl text-[10px] font-bold border transition ${updateProgress >= 52 ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300' : 'bg-slate-950/60 border-slate-800 text-slate-500'}`}>
              📦 3. npm install
            </div>
            <div className={`p-1.5 rounded-xl text-[10px] font-bold border transition ${updateProgress >= 68 ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300' : 'bg-slate-950/60 border-slate-800 text-slate-500'}`}>
              🗄️ 4. Prisma DB
            </div>
            <div className={`p-1.5 rounded-xl text-[10px] font-bold border transition ${updateProgress >= 85 ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300 animate-pulse' : 'bg-slate-950/60 border-slate-800 text-slate-500'}`}>
              ⚙️ 5. Build
            </div>
          </div>
        </div>
      )}

      {/* Terminal View Container */}
      <div className="flex-1 flex flex-col bg-black border border-slate-800 rounded-3xl overflow-hidden shadow-2xl font-mono text-xs min-h-0">
        {/* Terminal Header */}
        <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            <span className="text-slate-400 font-bold ml-2 text-[11px]">Server-Konsole &amp; Git-Runner</span>
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
