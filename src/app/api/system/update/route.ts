import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { APP_VERSION, GITHUB_REPO_URL } from '@/lib/version';

const execAsync = promisify(exec);
const projectRoot = process.cwd();

export async function GET() {
  try {
    let localCommit = 'Unbekannt';
    let branch = 'master';
    let remoteStatus = 'System ist auf dem neuesten Stand';
    let pendingCommits: string[] = [];

    try {
      const { stdout: bOut } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectRoot });
      branch = bOut.trim();

      const { stdout: cOut } = await execAsync('git rev-parse --short HEAD', { cwd: projectRoot });
      localCommit = cOut.trim();

      // Configure safe directory if needed
      await execAsync('git config --global --add safe.directory *', { cwd: projectRoot }).catch(() => {});

      // Fetch from remote
      await execAsync('git fetch origin master', { cwd: projectRoot, timeout: 8000 }).catch(() => {});

      const { stdout: diffOut } = await execAsync(`git log HEAD..origin/${branch} --oneline`, {
        cwd: projectRoot,
        timeout: 5000,
      }).catch(() => ({ stdout: '' }));

      if (diffOut.trim()) {
        pendingCommits = diffOut.trim().split('\n');
        remoteStatus = `${pendingCommits.length} neue(s) Update(s) auf GitHub verfügbar`;
      } else {
        remoteStatus = 'System ist auf dem neuesten Stand';
      }
    } catch (e: any) {
      remoteStatus = 'System ist auf dem neuesten Stand';
    }

    return NextResponse.json({
      system: 'OpenBon',
      version: APP_VERSION,
      repoUrl: GITHUB_REPO_URL,
      branch,
      localCommit,
      remoteStatus,
      hasUpdate: pendingCommits.length > 0,
      pendingCommits,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: Math.round(process.uptime()),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
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

      const startTime = Date.now();
      try {
        const { stdout, stderr } = await execAsync(customCommand, {
          cwd: projectRoot,
          timeout: 30000,
          maxBuffer: 1024 * 1024 * 5,
        });

        const duration = Date.now() - startTime;
        return NextResponse.json({
          success: true,
          command: customCommand,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          duration,
        });
      } catch (err: any) {
        return NextResponse.json({
          success: false,
          command: customCommand,
          stdout: err.stdout ? err.stdout.trim() : '',
          stderr: err.stderr ? err.stderr.trim() : err.message,
          error: err.message,
        });
      }
    }

    if (action === 'INSTALL_UPDATE') {
      const logs: string[] = [];
      const startTime = Date.now();

      try {
        logs.push('[1/4] Lade neuesten Code von GitHub herunter (git pull)...');
        await execAsync('git config --global --add safe.directory *', { cwd: projectRoot }).catch(() => {});
        const { stdout: pullOut } = await execAsync('git pull origin master', { cwd: projectRoot });
        logs.push(pullOut.trim());

        logs.push('[2/4] Aktualisiere Abhängigkeiten (npm install)...');
        const { stdout: npmOut } = await execAsync('npm install --production=false', { cwd: projectRoot });
        logs.push(npmOut.trim());

        logs.push('[3/4] Aktualisiere Datenbankschema (prisma db push)...');
        const { stdout: dbOut } = await execAsync('npx prisma db push --skip-generate', {
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
        logs.push(`[ERFOLG] Update in ${duration}s abgeschlossen! Server startet automatisch neu...`);

        // Trigger graceful process exit so systemd restarts the server with the new build
        setTimeout(() => {
          console.log('[UPDATE] Server startet neu, um die neue Version zu laden...');
          process.exit(0);
        }, 1500);

        return NextResponse.json({ success: true, logs: logs.join('\n\n'), restart: true });
      } catch (updateErr: any) {
        logs.push(`[FEHLER]: ${updateErr.message}`);
        return NextResponse.json({ success: false, error: updateErr.message, logs: logs.join('\n\n') }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
