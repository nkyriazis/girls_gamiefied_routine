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
export const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
