import { spawn } from 'child_process';
import { mkdirSync } from 'fs';
import path from 'path';
import cron from 'node-cron';
import { BackupResult, newestBackup, SAME_FILESYSTEM_WARNING, sameFilesystem } from './backup';

// Runs the daily backup (backup.ts) in a child process, so a slow or hung
// USB stick or NAS can't block the server's event loop: the kids' screens
// keep their heartbeat. One at a time; the schedule is in the process's time
// zone (TZ). At startup it catches up when the newest backup is over a day old
// (a Pi switched off at night would otherwise never back up). A run still going
// after BACKUP_TIMEOUT is killed and logged as failed (backupRunner).

const DAY_MS = 24 * 60 * 60 * 1000;

type Log = (type: string, details: unknown) => void;

export interface BackupJob {
  /** Start a backup now unless one is running; returns whether it started. */
  run(why: string): boolean;
}

/** The child's command: the same entry point as `npm run backup`, from the sources in dev (ts-node) or dist in prod. */
function backupCommand(): string[] {
  const ext = path.extname(__filename);
  const cli = path.join(__dirname, `backup-cli${ext}`);
  return ext === '.ts' ? ['--require', 'ts-node/register', cli, '--json'] : [cli, '--json'];
}

/**
 * Runs backups in a child process, one at a time. A run that passes its
 * deadline (a disk or share that hangs for good) is killed and logged as
 * BACKUP_FAILED, and the next run may start: without it the guard would stay
 * set until a restart and every later run would only be skipped.
 */
export function backupRunner({ dir, log, timeoutMs, command = backupCommand() }: {
  dir: string; log: Log; timeoutMs: number; command?: string[];
}): BackupJob {
  let running = false;

  const run = (why: string): boolean => {
    if (running) {
      log('BACKUP_SKIPPED', { why, reason: 'the previous backup is still running' });
      return false;
    }
    running = true;
    let over = false; // this run has ended: in time, failed, or timed out
    let deadline: NodeJS.Timeout | undefined = undefined;
    const end = () => {
      if (over) return false;
      over = true;
      clearTimeout(deadline);
      running = false;
      return true;
    };
    const child = spawn(process.execPath, command, {
      env: { ...process.env, TS_NODE_TRANSPILE_ONLY: 'true' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    // A process stuck in the kernel on a dead disk may not die even from SIGKILL until
    // the disk answers, so the run counts as over now, whether or not the child exits.
    deadline = setTimeout(() => {
      if (!end()) return;
      child.kill('SIGKILL');
      log('BACKUP_FAILED', { why, dir, reason: 'timed out', error: `still running after ${Math.round(timeoutMs / 1000)} s (BACKUP_TIMEOUT); killed` });
    }, timeoutMs);
    let out = '';
    let err = '';
    child.stdout.on('data', chunk => { out += chunk; });
    child.stderr.on('data', chunk => { err += chunk; });
    child.on('error', error => {
      if (!end()) return;
      log('BACKUP_FAILED', { why, dir, error: error.message });
    });
    child.on('close', code => {
      if (!end()) return;
      if (code !== 0) {
        log('BACKUP_FAILED', { why, dir, error: err.trim().split('\n').slice(-3).join(' ') || `exit code ${code}` });
        return;
      }
      try {
        const result = JSON.parse(out.trim().split('\n').pop() ?? '') as BackupResult;
        const { folder, files, bytes, integrity, stars, removed, ms } = result;
        log('BACKUP', {
          why, folder, files, bytes, integrity, stars, removed, ms,
          ...(result.sameFilesystem ? { warning: SAME_FILESYSTEM_WARNING } : {})
        });
        if (result.sameFilesystem) console.warn(`[backup] ${SAME_FILESYSTEM_WARNING}`);
      } catch {
        log('BACKUP_FAILED', { why, dir, error: `unexpected output: ${out.slice(-300)}` });
      }
    });
    return true;
  };
  return { run };
}

export function scheduleBackups({ cron: expression, dir, dbFile, timeoutMs, log }: {
  cron: string; dir: string; dbFile: string; timeoutMs: number; log: Log;
}): BackupJob {
  const { run } = backupRunner({ dir, log, timeoutMs });

  try {
    mkdirSync(dir, { recursive: true });
    if (sameFilesystem(dir, dbFile)) console.warn(`[backup] ${SAME_FILESYSTEM_WARNING} (BACKUP_DIR=${dir})`);
    const newest = newestBackup(dir);
    console.log(`[backup] into ${dir} at "${expression}"; newest: ${newest ? `${newest.folder} (${newest.at.toISOString()})` : 'none'}`);
    if (!newest || Date.now() - newest.at.getTime() > DAY_MS) run('catch-up');
  } catch (error) {
    log('BACKUP_FAILED', { why: 'startup', dir, error: (error as Error).message });
  }
  try {
    cron.schedule(expression, () => { run('daily'); });
  } catch (error) {
    log('BACKUP_FAILED', { why: 'schedule', cron: expression, error: (error as Error).message });
  }
  return { run };
}
