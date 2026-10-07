import path from 'path';

// File locations, overridable through the environment. In Docker the backend
// directory is mounted at /data, so everything that must survive an image
// update (config, database, legacy files) lives there.

export const DATA_FILE = process.env.DATA_FILE || path.join(process.cwd(), 'data.json');
export const EXERCISES_FILE = process.env.EXERCISES_FILE || path.join(process.cwd(), 'exercises.json');
// The database defaults to sitting next to data.json, i.e. on the data volume.
export const DB_FILE = process.env.DB_FILE || path.join(path.dirname(DATA_FILE), 'routine.db');
// Legacy JSON persistence, read once by the import in migrate.ts.
export const STATE_FILE = process.env.STATE_FILE || path.join(process.cwd(), 'state.json');
export const LOGS_FILE = process.env.LOGS_FILE || path.join(process.cwd(), 'logs.jsonl');
// Exercise pools shipped with the app (part of the image, not of the data volume).
export const EXERCISE_POOLS_DIR = process.env.EXERCISE_POOLS_DIR || path.join(process.cwd(), 'exercise-pools');
export const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');

// The daily backup (backup.ts). In Docker, BACKUP_DIR is /backups, a bind mount of the host folder
// named by BACKUP_DIR in .env (default ./backups/daily, on the SD card). The schedule runs in the
// process's time zone (TZ).
export const BACKUP_DIR = process.env.BACKUP_DIR || path.join(path.dirname(DATA_FILE), 'backups');
export const BACKUP_KEEP = Math.max(1, Number.parseInt(process.env.BACKUP_KEEP ?? '', 10) || 14);
export const BACKUP_CRON = process.env.BACKUP_CRON || '17 3 * * *';
// Seconds a backup may run before it is killed and logged as BACKUP_FAILED (a disk or share hung for good)
export const BACKUP_TIMEOUT_MS = (Number.parseFloat(process.env.BACKUP_TIMEOUT ?? '') || 2 * 60 * 60) * 1000;
