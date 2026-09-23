import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { isDeepStrictEqual } from 'util';
import { ActionLog, StateSnapshot } from '../../shared/types';
import { check, stateSchema } from './schemas';
import { Store } from './store';

// ============================================================================
// One-time import of the legacy JSON files (state.json + logs.jsonl) into the
// database. The files are only read, never modified.
//
// Idempotent: the import runs in one transaction and records itself in the
// `meta` table, so it happens at most once per database; records are inserted
// by id and never overwrite what the database already holds.
// ============================================================================

export const LEGACY_IMPORT_KEY = 'legacy_import';

const COLLECTIONS = [
  'routineExecutions', 'taskExecutions', 'spendings', 'starTransfers',
  'choreInstances', 'exerciseSessions', 'exerciseAssignments'
] as const;

export interface LegacySources {
  stateFile: string;
  logsFile: string;
}

export interface LegacyData {
  state: StateSnapshot;
  logs: ActionLog[];
  /** logs.jsonl lines that could not be parsed (e.g. a truncated last line). */
  skippedLogLines: number;
}

/**
 * Parse state.json into a full snapshot. Collections added after a deployment
 * was set up may be missing from older files; they default to empty. Anything
 * else that doesn't match the schema aborts the import.
 */
export function readLegacyState(file: string): StateSnapshot {
  const empty: StateSnapshot = {
    userStars: {}, routineExecutions: [], taskExecutions: [], spendings: [],
    starTransfers: [], choreInstances: [], exerciseSessions: [], exerciseAssignments: []
  };
  if (!existsSync(file)) return empty;
  const state = { ...empty, ...JSON.parse(readFileSync(file, 'utf-8')) };
  const error = check(stateSchema, state, `${file} failed schema validation`);
  if (error) throw new Error(`${error.message}: ${JSON.stringify(error.errors)}`);
  return state;
}

/** Parse logs.jsonl (oldest first). Lines without an id get a stable content hash. */
export function readLegacyLogs(file: string): { logs: ActionLog[]; skipped: number } {
  if (!existsSync(file)) return { logs: [], skipped: 0 };
  const logs: ActionLog[] = [];
  let skipped = 0;
  for (const line of readFileSync(file, 'utf-8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      logs.push({
        id: typeof entry.id === 'string' ? entry.id : `legacy-${createHash('sha256').update(line).digest('hex').slice(0, 32)}`,
        timestamp: String(entry.timestamp),
        type: String(entry.type),
        details: entry.details ?? null
      });
    } catch {
      skipped++;
    }
  }
  return { logs, skipped };
}

export function readLegacy(sources: LegacySources): LegacyData {
  const { logs, skipped } = readLegacyLogs(sources.logsFile);
  return { state: readLegacyState(sources.stateFile), logs, skippedLogLines: skipped };
}

export interface ImportResult {
  imported: boolean;
  /** When the import ran (now, or the earlier run that already did it). */
  importedAt: string;
}

/** Import the legacy files unless this database already did. */
export function importLegacy(store: Store, sources: LegacySources): ImportResult {
  const previous = store.getMeta(LEGACY_IMPORT_KEY);
  if (previous) return { imported: false, importedAt: JSON.parse(previous).importedAt };

  const legacy = readLegacy(sources);
  const importedAt = new Date().toISOString();
  store.transaction(() => {
    store.mergeState(legacy.state);
    legacy.logs.forEach(entry => store.appendLog(entry));
    store.setMeta(LEGACY_IMPORT_KEY, JSON.stringify({
      importedAt, ...sources, skippedLogLines: legacy.skippedLogLines
    }));
  });
  return { imported: true, importedAt };
}

export interface VerificationRow {
  name: string;
  source: number;
  db: number;
  /** Source records absent from the database. */
  missing: number;
  /** Source records whose database copy differs. */
  changed: number;
}

export interface Verification {
  rows: VerificationRow[];
  stars: { userId: string; source: number; db: number }[];
  skippedLogLines: number;
  ok: boolean;
}

function compare<T extends { id: string }>(name: string, source: T[], db: T[]): VerificationRow {
  const byId = new Map(db.map(item => [item.id, item]));
  let missing = 0;
  let changed = 0;
  for (const item of source) {
    const stored = byId.get(item.id);
    if (!stored) missing++;
    else if (!isDeepStrictEqual(stored, item)) changed++;
  }
  return { name, source: source.length, db: db.length, missing, changed };
}

/**
 * Compare the legacy files against the database, record by record, plus every
 * user's star balance. `ok` means nothing from the files is missing or altered.
 */
export function verifyLegacyImport(store: Store, sources: LegacySources): Verification {
  const legacy = readLegacy(sources);
  const snapshot = store.snapshot();
  const rows = COLLECTIONS.map(name =>
    compare<{ id: string }>(name, legacy.state[name], snapshot[name])
  );
  rows.push(compare('actionLogs', legacy.logs, store.logs.all()));

  const userIds = [...new Set([...Object.keys(legacy.state.userStars), ...Object.keys(snapshot.userStars)])];
  const stars = userIds.map(userId => ({
    userId,
    source: legacy.state.userStars[userId] ?? 0,
    db: snapshot.userStars[userId] ?? 0
  }));

  const ok = rows.every(r => r.missing === 0 && r.changed === 0) && stars.every(s => s.source === s.db);
  return { rows, stars, skippedLogLines: legacy.skippedLogLines, ok };
}

export function formatVerification(v: Verification): string {
  const pad = (s: string | number, n: number) => String(s).padEnd(n);
  const lines = [
    `${pad('collection', 20)}${pad('source', 8)}${pad('db', 8)}${pad('missing', 9)}changed`,
    ...v.rows.map(r => `${pad(r.name, 20)}${pad(r.source, 8)}${pad(r.db, 8)}${pad(r.missing, 9)}${r.changed}`),
    '',
    `${pad('user', 20)}${pad('source', 8)}db`,
    ...v.stars.map(s => `${pad(s.userId, 20)}${pad(s.source, 8)}${s.db}`),
    '',
    `unparsable log lines skipped: ${v.skippedLogLines}`,
    v.ok ? 'RESULT: OK — every legacy record and balance is in the database, unchanged'
         : 'RESULT: MISMATCH — see rows above'
  ];
  return lines.join('\n');
}
