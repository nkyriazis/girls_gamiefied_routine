import { createHash } from 'crypto';
import {
  chownSync, closeSync, copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, openSync, readdirSync, readSync,
  renameSync, rmSync, statSync, writeFileSync
} from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

// ============================================================================
// The daily backup of the family's data (issue #45), written to BACKUP_DIR.
//
// One backup is a folder <dir>/<YYYY-MM-DD_HHMMSS> (local time) with:
//   routine.db      one consistent copy (VACUUM INTO: a single file, no -wal),
//                   checked with PRAGMA integrity_check
//   data.json, exercises.json   byte for byte, as they are on disk
//   uploads/        the avatars and pictures
//   SHA256SUMS      in sha256sum's format: `sha256sum -c SHA256SUMS` verifies it
// It is written as <dir>/.partial-<stamp> and renamed when complete, so a
// backup cut short never counts. The newest `keep` are kept; rotation only
// ever deletes folders it named itself.
//
// This runs in a child process (backup-cli.ts, spawned by backupSchedule.ts),
// so a slow USB stick or NAS never blocks the server's event loop.
// ============================================================================

export interface BackupOptions {
  dbFile: string;
  dataFile: string;
  exercisesFile: string;
  uploadsDir: string;
  dir: string; // BACKUP_DIR
  keep: number; // BACKUP_KEEP
  now?: Date;
}

export interface BackupResult {
  folder: string;
  files: number;
  bytes: number;
  integrity: string; // PRAGMA integrity_check on the copy: 'ok'
  stars: Record<string, number>; // the balances in the copy, to recognise it by
  sameFilesystem: boolean; // BACKUP_DIR is on the database's filesystem (the SD card, unless set)
  removed: string[]; // older backups rotated out
  ms: number;
}

/** Complete backups are named like this; nothing else in BACKUP_DIR is ever touched. */
const BACKUP_NAME = /^\d{4}-\d{2}-\d{2}_\d{6}$/;
const PARTIAL = '.partial-';

export const SAME_FILESYSTEM_WARNING =
  "BACKUP_DIR is on the same filesystem as the database: if that disk (the Pi's SD card) dies, the backups go with it. " +
  'Set BACKUP_DIR in .env to a USB disk or NAS (see BACKUP.md).';

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** The folder name for a backup taken at `d`, in the process's time zone (TZ). */
export function backupName(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** True when `dir` is on the same filesystem (st_dev) as the folder holding `dbFile`. */
export function sameFilesystem(dir: string, dbFile: string): boolean {
  return statSync(dir).dev === statSync(path.dirname(dbFile)).dev;
}

/** The newest complete backup in `dir` and when it completed, or null. */
export function newestBackup(dir: string): { folder: string; at: Date } | null {
  const done = completeBackups(dir);
  if (!done.length) return null;
  const folder = path.join(dir, done[done.length - 1]);
  return { folder, at: statSync(path.join(folder, 'SHA256SUMS')).mtime };
}

/** Names of the complete backups in `dir`, oldest first. */
function completeBackups(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(name => BACKUP_NAME.test(name) && existsSync(path.join(dir, name, 'SHA256SUMS')))
    .sort();
}

/** Every file under `root`, as paths relative to it with '/' separators, sorted. */
function filesUnder(root: string, rel = ''): string[] {
  return readdirSync(path.join(root, rel), { withFileTypes: true }).flatMap(entry => {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return filesUnder(root, child);
    return entry.isFile() ? [child] : [];
  }).sort();
}

/** sha256 and size of a file, read 1 MB at a time (an upload may be large; the Pi's memory is not). */
function sha256File(file: string): { hex: string; size: number } {
  const hash = createHash('sha256');
  const buffer = Buffer.allocUnsafe(1 << 20);
  const fd = openSync(file, 'r');
  let size = 0;
  try {
    for (let n; (n = readSync(fd, buffer, 0, buffer.length, null)) > 0; size += n) hash.update(buffer.subarray(0, n));
  } finally {
    closeSync(fd);
  }
  return { hex: hash.digest('hex'), size };
}

/** Give what the backup wrote to the owner of BACKUP_DIR, so they can manage it without sudo. */
function chownLike(dir: string, target: string): void {
  if (process.getuid?.() !== 0) return;
  const { uid, gid } = statSync(dir);
  const walk = (p: string) => {
    try {
      chownSync(p, uid, gid);
    } catch {
      return; // FAT/exFAT has no owners; NFS may not let root chown
    }
    if (lstatSync(p).isDirectory()) readdirSync(p).forEach(name => walk(path.join(p, name)));
  };
  walk(target);
}

/** Take one backup into `options.dir` and rotate. Throws on failure, leaving no partial folder. */
export function takeBackup(options: BackupOptions): BackupResult {
  const started = Date.now();
  const { dbFile, dataFile, exercisesFile, uploadsDir, dir, keep } = options;
  if (!existsSync(dbFile)) throw new Error(`No database at ${dbFile}`);
  mkdirSync(dir, { recursive: true });

  // A backup that died half-way (power cut, full disk) is cleared first
  for (const name of readdirSync(dir)) {
    if (name.startsWith(PARTIAL)) rmSync(path.join(dir, name), { recursive: true, force: true });
  }

  const name = backupName(options.now ?? new Date());
  const folder = path.join(dir, name);
  if (existsSync(folder)) throw new Error(`${folder} already exists`);
  const partial = path.join(dir, PARTIAL + name);
  mkdirSync(partial);
  try {
    // The database: one consistent single-file copy, taken while the server keeps writing
    const live = new DatabaseSync(dbFile, { readOnly: true });
    try {
      live.exec('PRAGMA busy_timeout = 10000');
      live.prepare('VACUUM INTO ?').run(path.join(partial, 'routine.db'));
    } finally {
      live.close();
    }
    const copy = new DatabaseSync(path.join(partial, 'routine.db'), { readOnly: true });
    let integrity: string;
    let stars: Record<string, number>;
    try {
      integrity = String((copy.prepare('PRAGMA integrity_check').get() as { integrity_check: string }).integrity_check);
      const rows = copy.prepare('SELECT userId, stars FROM user_stars ORDER BY rowid').all() as { userId: string; stars: number }[];
      stars = Object.fromEntries(rows.map(r => [r.userId, r.stars]));
    } finally {
      copy.close();
    }
    if (integrity !== 'ok') throw new Error(`The database copy failed its integrity check: ${integrity}`);

    // The config files as they are on disk (even an invalid one: it is what there is)
    for (const file of [dataFile, exercisesFile]) {
      if (existsSync(file)) copyFileSync(file, path.join(partial, path.basename(file)));
    }
    if (existsSync(uploadsDir)) cpSync(uploadsDir, path.join(partial, 'uploads'), { recursive: true });

    const files = filesUnder(partial);
    let bytes = 0;
    const sums = files.map(rel => {
      const { hex, size } = sha256File(path.join(partial, rel));
      bytes += size;
      return `${hex}  ${rel}\n`;
    });
    writeFileSync(path.join(partial, 'SHA256SUMS'), sums.join(''));

    renameSync(partial, folder);
    chownLike(dir, folder);

    // Rotation: the newest `keep` complete backups stay
    const done = completeBackups(dir);
    const removed = done.slice(0, Math.max(0, done.length - Math.max(1, keep)));
    removed.forEach(old => rmSync(path.join(dir, old), { recursive: true, force: true }));

    return {
      folder, files: files.length, bytes, integrity, stars, removed,
      sameFilesystem: sameFilesystem(dir, dbFile), ms: Date.now() - started
    };
  } catch (err) {
    rmSync(partial, { recursive: true, force: true });
    throw err;
  }
}
