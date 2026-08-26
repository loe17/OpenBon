import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import { APP_VERSION, GITHUB_REPO_URL } from '@/lib/version';
import { requireAdmin } from '@/lib/admin-guard';
import { requireApiAuth } from '@/lib/api-guard';

const execAsync = promisify(exec);
const projectRoot = process.cwd();

function compareSemver(vA: string, vB: string): number {
  const cleanA = vA.replace(/^v/i, '').split('.').map((p) => parseInt(p, 10) || 0);
  const cleanB = vB.replace(/^v/i, '').split('.').map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const a = cleanA[i] || 0;
    const b = cleanB[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

export async function GET(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    let localCommit = 'Unbekannt';
    let branch = 'master';
    let pendingCommits: string[] = [];

    let isNewRelease = false;
    let latestReleaseVersion: string | null = null;
    let latestReleaseName: string | null = null;
    let latestReleaseBody: string | null = null;
    let latestReleaseUrl: string | null = null;

    let availableTags: string[] = [];
    try {
      const { stdout: tagOut } = await execAsync('git tag -l "v*" --sort=-v:refname', { cwd: projectRoot }).catch(() => ({ stdout: '' }));
      if (tagOut.trim()) {
        availableTags = tagOut.trim().split('\n').map((t) => t.trim()).filter(Boolean);
      }
    } catch {}

    // 1. Prüfe offizielle GitHub Tags & Releases via GitHub API
    try {
      const ghTagsRes = await fetch('https://api.github.com/repos/loe17/OpenBon/tags', {
        headers: { 'User-Agent': 'OpenBon-POS-System' },
        signal: AbortSignal.timeout(4000),
      });

      if (ghTagsRes.ok) {
        const tagsData = await ghTagsRes.json();
        if (Array.isArray(tagsData) && tagsData.length > 0) {
          const apiTags = tagsData.map((t: any) => t.name).filter(Boolean);
          // Kombiniere und dedupliziere Tags
          availableTags = Array.from(new Set([...apiTags, ...availableTags]));

          const sorted = tagsData
            .map((t: any) => (t.name || '').replace(/^v/i, ''))
            .filter((v: string) => /^\d+\.\d+\.\d+/.test(v))
            .sort((a: string, b: string) => compareSemver(b, a));

          if (sorted.length > 0) {
            const topTag = sorted[0];
            latestReleaseVersion = topTag;
            latestReleaseName = `Release v${topTag}`;
            latestReleaseUrl = `https://github.com/loe17/OpenBon/releases/tag/v${topTag}`;

            if (compareSemver(topTag, APP_VERSION) > 0) {
              isNewRelease = true;
            }
          }
        }
      }
    } catch {
      // Offline oder API-Ratelimit -> ignorieren und via Git prüfen
    }

    // 2. Prüfe Git-Commits auf master
    try {
      const { stdout: bOut } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectRoot });
      branch = bOut.trim();

      const { stdout: cOut } = await execAsync('git rev-parse --short HEAD', { cwd: projectRoot });
      localCommit = cOut.trim();

      // Configure safe directory
      await execAsync('git config --global --add safe.directory *', { cwd: projectRoot }).catch(() => {});

      // Fetch from remote
      await execAsync('git fetch origin master', { cwd: projectRoot, timeout: 6000 }).catch(() => {});

      const { stdout: diffOut } = await execAsync(`git log HEAD..origin/${branch} --oneline`, {
        cwd: projectRoot,
        timeout: 4000,
      }).catch(() => ({ stdout: '' }));

      if (diffOut.trim()) {
        pendingCommits = diffOut.trim().split('\n');
      }
    } catch {}

    const hasUpdate = isNewRelease || pendingCommits.length > 0;
    const updateType: 'RELEASE' | 'HOTFIX' | 'NONE' = isNewRelease
      ? 'RELEASE'
      : pendingCommits.length > 0
      ? 'HOTFIX'
      : 'NONE';

    let remoteStatus = 'System ist auf dem neuesten Stand';
    if (updateType === 'RELEASE') {
      remoteStatus = `Neues offizielles Release v${latestReleaseVersion} verfügbar`;
    } else if (updateType === 'HOTFIX') {
      remoteStatus = `${pendingCommits.length} neue(r) Hotfix-Commit(s) verfügbar`;
    }

    return NextResponse.json({
      system: 'OpenBon',
      version: APP_VERSION,
      repoUrl: GITHUB_REPO_URL,
      branch,
      localCommit,
      remoteStatus,
      hasUpdate,
      updateType,
      isNewRelease,
      latestReleaseVersion,
      latestReleaseName,
      latestReleaseBody,
      latestReleaseUrl,
      availableTags,
      pendingCommits,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: Math.round(process.uptime()),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const { action, customCommand } = await req.json();

    if (action === 'RESTART' || (action === 'EXEC' && /restart|reboot|systemctl restart/i.test(customCommand || ''))) {
      setTimeout(() => {
        console.log('[RESTART] Server wird durch Benutzerbefehl neu gestartet...');
        process.exit(0);
      }, 1000);

      return NextResponse.json({
        success: true,
        command: customCommand || 'restart',
        stdout: '[SYSTEM] Server-Prozess beendet sich kontrolliert. Der systemd-Dienst startet den Server in 1-2 Sekunden neu...',
        stderr: '',
        duration: 50,
        restart: true,
      });
    }

    if (action === 'EXEC') {
      if (!customCommand || typeof customCommand !== 'string') {
        return NextResponse.json({ error: 'Befehl fehlt' }, { status: 400 });
      }

      const trimmed = customCommand.trim();
      const ALLOWED_COMMANDS = [
        'git status',
        'git log',
        'git log -n 5',
        'git log -n 10',
        'git pull',
        'git pull origin master',
        'git fetch origin master',
        'git reset --hard origin/master',
        'git reset --hard HEAD',
        'git checkout -f master',
        'git stash',
        'git stash drop',
        'npm install --production=false',
        'npm install',
        'npx prisma db push --accept-data-loss',
        'npx prisma generate',
        'npm run build',
        'restart',
        'systemctl status openbon',
      ];

      // Keine Shell-Meta-Zeichen erlauben (Command Injection Schutz)
      if (/[;&|`$\n\r><]/.test(trimmed)) {
        return NextResponse.json(
          {
            success: false,
            command: trimmed,
            stdout: '',
            stderr: '[SICHERHEITSHINWEIS] Shell-Chaining und Steuerzeichen sind unzulässig.',
            error: 'Ungültige Steuerzeichen im Befehl',
          },
          { status: 403 }
        );
      }

      const isAllowed = ALLOWED_COMMANDS.includes(trimmed);
      if (!isAllowed) {
        return NextResponse.json(
          {
            success: false,
            command: trimmed,
            stdout: '',
            stderr: `[SICHERHEITSHINWEIS] Der Befehl "${trimmed}" ist nicht in der System-Allowlist erlaubt.`,
            error: 'Befehl nicht in der Allowlist',
          },
          { status: 403 }
        );
      }

      const startTime = Date.now();
      try {
        const { stdout, stderr } = await execAsync(trimmed, {
          cwd: projectRoot,
          timeout: 30000,
          maxBuffer: 1024 * 1024 * 5,
        });

        const duration = Date.now() - startTime;
        return NextResponse.json({
          success: true,
          command: trimmed,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          duration,
        });
      } catch (err) {
        const execErr = err as { stdout?: string; stderr?: string };
        return NextResponse.json({
          success: false,
          command: customCommand,
          stdout: execErr.stdout ? execErr.stdout.trim() : '',
          stderr: execErr.stderr
            ? execErr.stderr.trim()
            : err instanceof Error
              ? err.message
              : String(err),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (action === 'INSTALL_UPDATE') {
      const logs: string[] = [];
      const startTime = Date.now();
      const body = await req.clone().json().catch(() => ({}));
      const target = (body.targetVersion || 'master').trim();
      const targetType = body.targetType || (target.startsWith('v') ? 'TAG' : 'BRANCH');

      try {
        logs.push('[0/4] Erstelle Sicherheits-Backup vor dem Update...');
        try {
          const { createDatabaseBackup } = require('@/lib/backup-scheduler');
          const backupPath = await createDatabaseBackup();
          if (backupPath) {
            logs.push(`[BACKUP] Sicherheits-Snapshot erstellt: ${backupPath}`);
          }
        } catch (bErr) {
          logs.push(`[HINWEIS] Vorab-Backup übersprungen: ${bErr}`);
        }

        logs.push(`[1/4] Lade neuesten Code von GitHub & checke "${target}" aus...`);
        await execAsync('git config --global --add safe.directory *', { cwd: projectRoot }).catch(() => {});
        await execAsync('git fetch --all --tags', { cwd: projectRoot, timeout: 25000 }).catch(() => {});

        if (target.startsWith('v') || targetType === 'TAG') {
          const { stdout: coOut } = await execAsync(`git checkout -f tags/${target}`, { cwd: projectRoot });
          logs.push(coOut.trim() || `Erfolgreich auf Tag ${target} gewechselt.`);
        } else if (target === 'master' || targetType === 'BRANCH') {
          await execAsync(`git checkout -f ${target}`, { cwd: projectRoot });
          const { stdout: resetOut } = await execAsync(`git reset --hard origin/${target}`, { cwd: projectRoot });
          logs.push(resetOut.trim() || `Codebasis erfolgreich auf origin/${target} aktualisiert.`);
        } else {
          const { stdout: coOut } = await execAsync(`git checkout -f ${target}`, { cwd: projectRoot });
          logs.push(coOut.trim() || `Erfolgreich auf ${target} gewechselt.`);
        }

        logs.push('[2/4] Aktualisiere Abhängigkeiten (npm install)...');
        const { stdout: npmOut } = await execAsync('npm install --production=false', { cwd: projectRoot });
        logs.push(npmOut.trim());

        logs.push('[3/4] Aktualisiere Datenbankschema (prisma db push)...');
        const { stdout: dbOut } = await execAsync('npx prisma db push --accept-data-loss --skip-generate', {
          cwd: projectRoot,
          env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db' },
        });
        logs.push(dbOut.trim());

        logs.push('[4/4] Kompiliere Produktions-Build (npm run build)...');
        const { stdout: buildOut } = await execAsync('npm run build', {
          cwd: projectRoot,
          env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db' },
        });
        logs.push(buildOut.trim());

        const duration = Math.round((Date.now() - startTime) / 1000);
        logs.push(`[ERFOLG] Update/Wechsel auf ${target} in ${duration}s abgeschlossen! Server startet automatisch neu...`);

        setTimeout(() => {
          console.log('[UPDATE] Server startet neu, um die neue Version zu laden...');
          process.exit(0);
        }, 1500);

        await logSystemActionSafe(() => ({
          action: 'SYSTEM_UPDATE',
          category: 'SYSTEM',
          actor: auth.session.waiterName || auth.session.role,
          details: `Systemaktualisierung/Wechsel auf ${target} ausgefuehrt.`,
        }));

        return NextResponse.json({ success: true, logs: logs.join('\n\n'), restart: true });
      } catch (updateErr) {
        logs.push(`[FEHLER]: ${updateErr instanceof Error ? updateErr.message : String(updateErr)}`);
        return NextResponse.json({ success: false, error: updateErr instanceof Error ? updateErr.message : String(updateErr), logs: logs.join('\n\n') }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
