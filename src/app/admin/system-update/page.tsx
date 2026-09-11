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
  HardDrive,
  Activity,
} from 'lucide-react';
import { APP_VERSION, GITHUB_REPO_URL } from '@/lib/version';
import { triggerHapticFeedback } from '@/lib/socket-client';
import { copyTextToClipboard } from '@/lib/clipboard';
import { useConfirm } from '@/components/ui/confirm-dialog';

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
  officialReleases?: string[];
  pendingCommits?: string[];
  updateCheckWarning?: string | null;
  checkNotes?: string[];
  diskSpace?: {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usedPercentage: number;
    formattedTotal: string;
    formattedFree: string;
    formattedUsed: string;
    isSufficient: boolean;
    minRequiredMb: number;
  };
  memory?: {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usedPercentage: number;
    formattedTotal: string;
    formattedFree: string;
    formattedUsed: string;
  };
  cpu?: {
    usedPercentage: number;
    cores: number;
    model: string;
  };
}

interface TerminalLog {
  id: string;
  text: string;
  isError?: boolean;
  timestamp: string;
  command?: string;
}

export default function AdminSystemUpdatePage() {
  const { confirm } = useConfirm();
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [executing, setExecuting] = useState(false);
  const [terminalHistory, setTerminalHistory] = useState<TerminalLog[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<string>(`v${APP_VERSION}`);
  const [onlyReleases, setOnlyReleases] = useState(true);
  const [liveUptime, setLiveUptime] = useState<number | null>(null);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateStage, setUpdateStage] = useState('Vorbereitung...');
  const [updateElapsed, setUpdateElapsed] = useState(0);
  const terminalEndRef = React.useRef<HTMLDivElement | null>(null);

  // Live Server-Uptime Sekundenzähler
  useEffect(() => {
    if (liveUptime === null) return;
    const t = setInterval(() => {
      setLiveUptime((prev) => (prev !== null ? prev + 1 : null));
    }, 1000);
    return () => clearInterval(t);
  }, [liveUptime !== null]);

  const formatLiveUptime = (totalSec: number | null | undefined) => {
    if (totalSec === null || totalSec === undefined) return 'Online';
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (d > 0) return `${d} T. ${h} Std. ${m} Min.`;
    if (h > 0) return `${h} Std. ${m} Min. ${s} Sek.`;
    return `${m} Min. ${s} Sek.`;
  };

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalHistory]);

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
      if (typeof data.uptime === 'number') {
        setLiveUptime(data.uptime);
      }

      if (data.availableTags && data.availableTags.length > 0) {
        const curTag = `v${data.version || APP_VERSION}`;
        if (!selectedTarget || selectedTarget === 'v0.4.2' || selectedTarget === `v${APP_VERSION}`) {
          setSelectedTarget(data.availableTags.includes(curTag) ? curTag : data.availableTags[0]);
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
      } else if (data.updateCheckWarning) {
        addTerminalLog(`[WARNUNG] ${data.updateCheckWarning}`, true);
        if (data.checkNotes && data.checkNotes.length > 0) {
          addTerminalLog(`[HINWEIS] ${data.checkNotes.join(' ')}`, true);
        }
        addTerminalLog(`[STATUS] Prüfung unvollständig – bitte erneut auf "Prüfen" klicken (v${APP_VERSION}, Commit: ${data.localCommit || '-'})`, true);
      } else {
        if (data.checkNotes && data.checkNotes.length > 0) {
          addTerminalLog(`[HINWEIS] ${data.checkNotes.join(' ')}`, false);
        }
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

    // Automatisches 10-Sekunden-Intervall für Live-Metriken (CPU, RAM, Festplatte)
    const interval = setInterval(() => {
      if (!updating) {
        fetchSystemStatus();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [updating]);

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
    const ok = await confirm({
      title: 'Server neu starten?',
      message: 'Möchten Sie den OpenBon Server-Prozess jetzt neu starten?\n\nLaufende Vorgänge werden kurz pausiert, der Dienst startet innerhalb weniger Sekunden neu.',
      confirmText: 'Jetzt neu starten',
      cancelText: 'Abbrechen',
      isDestructive: false,
    });
    if (!ok) return;

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

    if (sysInfo?.diskSpace && !sysInfo.diskSpace.isSufficient) {
      const okDisk = await confirm({
        title: 'Geringer Festplattenspeicher',
        message: `⚠️ ACHTUNG: Auf dem Server sind nur ${sysInfo.diskSpace.formattedFree} freier Festplattenspeicher verfügbar (empfohlen: mindestens ${sysInfo.diskSpace.minRequiredMb} MB für den Build-Prozess).\n\nMöchten Sie trotzdem fortfahren? Das System wird versuchen, vor dem Bauen temporäre Caches und alte Backups automatisch zu bereinigen.`,
        confirmText: 'Trotzdem fortfahren',
        cancelText: 'Abbrechen',
        isDestructive: true,
      });
      if (!okDisk) return;
    }

    const okInstall = await confirm({
      title: 'Update durchführen?',
      message: `OpenBon jetzt auf ${label} setzen?\n\nDer Server führt vorab ein Sicherheits-Backup der Datenbank durch, lädt den Stand von GitHub herunter, führt eventuelle Datenbankmigrationen aus, kompiliert die Anwendung neu und startet den Dienst wieder.`,
      confirmText: 'Update jetzt starten',
      cancelText: 'Abbrechen',
    });
    if (!okInstall) return;

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

  const tagsList = React.useMemo(() => {
    const baseTags = sysInfo?.availableTags && sysInfo.availableTags.length > 0
      ? sysInfo.availableTags
      : [`v${APP_VERSION}`];
    if (!onlyReleases) return baseTags;

    // Nur offizielle Releases: Strikte Beschränkung auf verifizierte GitHub Releases (keine Git-Tags)
    return (sysInfo?.officialReleases || []).map((r) => r.trim()).filter(Boolean);
  }, [sysInfo?.availableTags, sysInfo?.officialReleases, onlyReleases]);

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
                {onlyReleases
                  ? 'Nur offizielle Releases sichtbar (höchste Stabilität).'
                  : 'Alle Git-Tags und der Entwicklungs-Branch (master) sind eingeblendet.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Filter Toggle: Nur offizielle Releases */}
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 select-none hover:border-slate-700 transition">
              <input
                type="checkbox"
                checked={onlyReleases}
                onChange={(e) => {
                  const val = e.target.checked;
                  setOnlyReleases(val);
                  if (val && selectedTarget === 'master') {
                    setSelectedTarget(tagsList[0] || `v${APP_VERSION}`);
                  }
                }}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-900 border-slate-700"
              />
              <span className="font-bold">Nur Releases anzeigen</span>
            </label>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-white text-xs font-bold font-mono rounded-xl px-3 py-2.5 focus:border-blue-500"
              >
                <optgroup label={onlyReleases ? '🏷️ Offizielle Releases' : '🏷️ Versionen & Git-Tags'}>
                  {tagsList.length === 0 ? (
                    <option disabled value="">
                      Keine separaten GitHub-Releases vorhanden (Tags ausgeblendet)
                    </option>
                  ) : (
                    tagsList.map((t) => (
                      <option key={t} value={t}>
                        {t} {t === `v${APP_VERSION}` ? '(Aktuell installiert)' : ''}
                      </option>
                    ))
                  )}
                </optgroup>
                {!onlyReleases && (
                  <optgroup label="🌿 Entwicklungs-Branch">
                    <option value="master">Branch: master (Entwicklungsstand)</option>
                  </optgroup>
                )}
              </select>

              <button
                onClick={() => handleInstallTarget(selectedTarget)}
                disabled={updating || (onlyReleases && tagsList.length === 0)}
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
                    <span>Auf {selectedTarget || 'Version'} wechseln</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hotfix Banner if hotfix commits are available */}
      {sysInfo?.updateType === 'HOTFIX' && sysInfo.pendingCommits && sysInfo.pendingCommits.length > 0 && (
        <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border-2 border-blue-500/80 rounded-2xl p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl animate-in slide-in-from-top shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/40">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-white">
                  Neuer Hotfix verfügbar ({sysInfo.pendingCommits.length} Änderung{sysInfo.pendingCommits.length === 1 ? '' : 'en'})
                </span>
                <span className="text-[10px] bg-blue-900/80 text-blue-300 font-mono font-bold px-2 py-0.5 rounded border border-blue-700">
                  Patch
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 line-clamp-1">
                Neueste Fehlerbehebung: {sysInfo.pendingCommits[0]}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleInstallTarget('master')}
              disabled={updating}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition active:scale-95 disabled:opacity-50"
            >
              <DownloadCloud className="w-4 h-4" />
              <span>⚡ Hotfix installieren ({sysInfo.pendingCommits.length})</span>
            </button>
          </div>
        </div>
      )}

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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4 shrink-0">
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
          <Cpu className={`w-5 h-5 shrink-0 ${(sysInfo?.cpu?.usedPercentage ?? 0) > 85 ? 'text-rose-400' : (sysInfo?.cpu?.usedPercentage ?? 0) > 70 ? 'text-amber-400' : 'text-emerald-400'}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Prozessor (CPU)</span>
              {sysInfo?.cpu && (
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${(sysInfo.cpu.usedPercentage > 85) ? 'text-rose-400 bg-rose-950/80 font-black animate-pulse' : (sysInfo.cpu.usedPercentage > 70) ? 'text-amber-400 bg-amber-950/60' : 'text-emerald-400 bg-emerald-950/60'}`}>
                  {sysInfo.cpu.usedPercentage}%
                </span>
              )}
            </div>
            <span className="text-xs font-mono font-bold text-slate-200 truncate block">
              {sysInfo?.cpu ? `${sysInfo.cpu.usedPercentage}% Auslastung` : 'Wird geprüft...'}
            </span>
            {sysInfo?.cpu && (
              <span className="text-[10px] text-slate-500 block truncate">
                {sysInfo.cpu.cores} Kerne ({sysInfo.cpu.model.slice(0, 18)})
              </span>
            )}
          </div>
        </div>

        <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 flex items-center gap-3">
          <HardDrive className={`w-5 h-5 shrink-0 ${sysInfo?.diskSpace?.isSufficient === false ? 'text-rose-400' : 'text-sky-400'}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Speicherplatz</span>
              {sysInfo?.diskSpace && (
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${sysInfo.diskSpace.isSufficient ? 'text-emerald-400 bg-emerald-950/60' : 'text-rose-400 bg-rose-950/80 font-black animate-pulse'}`}>
                  {sysInfo.diskSpace.isSufficient ? 'OK' : 'KNAPP'}
                </span>
              )}
            </div>
            <span className="text-xs font-mono font-bold text-slate-200 truncate block">
              {sysInfo?.diskSpace ? `${sysInfo.diskSpace.formattedFree} frei` : 'Wird geprüft...'}
            </span>
            {sysInfo?.diskSpace && (
              <span className="text-[10px] text-slate-500 block truncate">
                von {sysInfo.diskSpace.formattedTotal} ({sysInfo.diskSpace.usedPercentage}% belegt)
              </span>
            )}
          </div>
        </div>

        <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 flex items-center gap-3">
          <Activity className={`w-5 h-5 shrink-0 ${(sysInfo?.memory?.usedPercentage ?? 0) > 85 ? 'text-rose-400' : (sysInfo?.memory?.usedPercentage ?? 0) > 70 ? 'text-amber-400' : 'text-purple-400'}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Arbeitsspeicher</span>
              {sysInfo?.memory && (
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${(sysInfo.memory.usedPercentage > 85) ? 'text-rose-400 bg-rose-950/80 font-black animate-pulse' : (sysInfo.memory.usedPercentage > 70) ? 'text-amber-400 bg-amber-950/60' : 'text-emerald-400 bg-emerald-950/60'}`}>
                  {sysInfo.memory.usedPercentage}%
                </span>
              )}
            </div>
            <span className="text-xs font-mono font-bold text-slate-200 truncate block">
              {sysInfo?.memory ? `${sysInfo.memory.formattedUsed} belegt` : 'Wird geprüft...'}
            </span>
            {sysInfo?.memory && (
              <span className="text-[10px] text-slate-500 block truncate">
                von {sysInfo.memory.formattedTotal} ({sysInfo.memory.formattedFree} frei)
              </span>
            )}
          </div>
        </div>

        <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Server-Uptime</span>
            <span className="text-xs font-mono font-bold text-slate-200 truncate block">
              {formatLiveUptime(liveUptime ?? sysInfo?.uptime)}
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

          {/* Progress Bar Track & Glow Fill - High contrast border & vibrant glow */}
          <div className="w-full bg-slate-800/90 h-3.5 rounded-full overflow-hidden border-2 border-slate-600 p-0.5 shadow-inner">
            <div
              className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_14px_rgba(52,211,153,0.9)]"
              style={{ width: `${Math.max(5, Math.min(100, updateProgress))}%` }}
            />
          </div>

          {/* Progress Stages Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1 text-center">
            <div className={`p-1.5 rounded-xl text-[10px] font-bold border transition ${updateProgress >= 15 ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 shadow-sm' : 'bg-slate-950/80 border-slate-700 text-slate-400'}`}>
              💾 1. Backup
            </div>
            <div className={`p-1.5 rounded-xl text-[10px] font-bold border transition ${updateProgress >= 32 ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 shadow-sm' : 'bg-slate-950/80 border-slate-700 text-slate-400'}`}>
              📥 2. Checkout
            </div>
            <div className={`p-1.5 rounded-xl text-[10px] font-bold border transition ${updateProgress >= 52 ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 shadow-sm' : 'bg-slate-950/80 border-slate-700 text-slate-400'}`}>
              📦 3. npm install
            </div>
            <div className={`p-1.5 rounded-xl text-[10px] font-bold border transition ${updateProgress >= 68 ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 shadow-sm' : 'bg-slate-950/80 border-slate-700 text-slate-400'}`}>
              🗄️ 4. Prisma DB
            </div>
            <div className={`p-1.5 rounded-xl text-[10px] font-bold border transition ${updateProgress >= 85 ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 animate-pulse shadow-sm' : 'bg-slate-950/80 border-slate-700 text-slate-400'}`}>
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
          <div ref={terminalEndRef} />
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
