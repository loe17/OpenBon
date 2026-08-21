import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { APP_VERSION, GITHUB_REPO_URL } from '@/lib/version';

const execAsync = promisify(exec);
const projectRoot = process.cwd();

export async function GET() {
  try {
    // 1. Get current git commit hash & branch
    let localCommit = 'Unbekannt';
    let branch = 'master';
    let remoteStatus = 'Aktuell';
    let pendingCommits: string[] = [];

    try {
      const { stdout: bOut } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectRoot });
      branch = bOut.trim();

      const { stdout: cOut } = await execAsync('git rev-parse --short HEAD', { cwd: projectRoot });
      localCommit = cOut.trim();

      // Fetch from remote
      await execAsync('git fetch origin master', { cwd: projectRoot, timeout: 8000 });

      const { stdout: diffOut } = await execAsync(`git log HEAD..origin/${branch} --oneline`, {
        cwd: projectRoot,
        timeout: 5000,
      });

      if (diffOut.trim()) {
        pendingCommits = diffOut.trim().split('\n');
        remoteStatus = `${pendingCommits.length} neue(s) Update(s) verfügbar`;
      }
    } catch (e: any) {
      remoteStatus = `Git-Prüfung: ${e.message.split('\n')[0]}`;
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

      // Step 1: Git Pull
      logs.push('[1/4] Führe "git pull origin master" aus...');
      const pullRes = await execAsync('git pull origin master', { cwd: projectRoot, timeout: 30000 });
      logs.push(pullRes.stdout || pullRes.stderr);

      // Step 2: Dependencies
      logs.push('[2/4] Aktualisiere npm Abhängigkeiten...');
      const npmRes = await execAsync('npm install --production=false', { cwd: projectRoot, timeout: 60000 });
      logs.push(npmRes.stdout || npmRes.stderr);

      // Step 3: Database Push
      logs.push('[3/4] Führe Datenbank-Migrationen aus...');
      const dbRes = await execAsync('npx prisma db push --skip-generate', { cwd: projectRoot, timeout: 30000 });
      logs.push(dbRes.stdout || dbRes.stderr);

      // Step 4: Build
      logs.push('[4/4] Erstelle Next.js Build...');
      const buildRes = await execAsync('npm run build', { cwd: projectRoot, timeout: 120000 });
      logs.push(buildRes.stdout || buildRes.stderr);

      const duration = Date.now() - startTime;
      logs.push(`[ERFOLG] Update in ${(duration / 1000).toFixed(1)}s erfolgreich abgeschlossen!`);

      return NextResponse.json({
        success: true,
        logs: logs.join('\n\n'),
        duration,
      });
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
