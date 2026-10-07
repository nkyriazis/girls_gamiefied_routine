import { createHash } from 'crypto';
import { chownSync, constants, copyFileSync, existsSync, readFileSync, renameSync, statSync, unwatchFile, watchFile, writeFileSync } from 'fs';
import path from 'path';
import { isDeepStrictEqual } from 'util';
import { DataConfig, Exercise, ExerciseCategoryDef } from '../../shared/types';
import { DATA_EXAMPLE_FILE, DATA_FILE, EXERCISES_EXAMPLE_FILE, EXERCISES_FILE } from './paths';
import { check, dataSchema, exercisesSchema, ValidationError } from './schemas';

// ============================================================================
// Config (data.json + exercises.json), cached in memory.
//
// Files are read at startup, after an edit through the admin API, and when
// they change on disk — never per request. An invalid file on disk never
// replaces the cached config: the last valid version stays live and the error
// is reported, so a bad edit can't take the app (or its state) down.
//
// Saving never writes over a file the server couldn't load (issue #45). While
// the file on disk is invalid, save() refuses, so no read-modify-write editor
// (the forms) can put the live copy over the file being fixed. The one
// override is `replace`, sent only by the Advanced JSON editor: it replaces the
// invalid file deliberately, keeping it beside as <file>.invalid-<stamp>. Even
// then the empty fallback (live when the file was unreadable at startup) is
// never written: there the editor shows the file's own text to fix instead.
// A missing file counts as unreadable: on a live install (a database with
// history) a lost data.json or exercises.json is not created from the example
// (seedConfig below), so it is never loaded and saving is refused the same
// way. A file seeded from its example on a new install is loaded like any other.
//
// Nor does a save go over a version its writer never saw (issue #33). The
// version is a short hash of the live file's text: it moves on every save and
// every valid reload from disk. A writer sends the version it edited, and a
// save naming an older one is refused as a conflict (the route's 409), so the
// last save no longer silently wins. A save that names no version is not
// checked (scripts, and the editor fixing a file that doesn't parse).
// ============================================================================

/** exercises.json, as described by exercises.schema.json. */
export interface ExercisesConfig {
  categories?: ExerciseCategoryDef[];
  exercises: Exercise[];
}

const EMPTY_DATA: DataConfig = {
  users: [], tasks: [], routines: [], routineTasks: [], routineAssignments: [],
  flows: [], schedules: [], rewards: [], chores: [], settings: { timezone: 'Europe/Athens' }
};
const EMPTY_EXERCISES: ExercisesConfig = { categories: [], exercises: [] };

const refusal = (message: string): ValidationError => ({ message, errors: [] });

/** Why save() wrote nothing. `conflict`: the writer edited an older version than the live one. */
export interface SaveRefusal extends ValidationError {
  conflict?: boolean;
}

/** The version of a file's text: the first 12 hex characters of its sha256. */
const versionOf = (text: string | null): string => createHash('sha256').update(text ?? '').digest('hex').slice(0, 12);

/** YYYY-MM-DD_HHMMSS in the process's time zone, like the backups' folders. */
function localStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

/** What is wrong with a config file, as the parents' screen shows it. */
export interface ConfigProblem extends ValidationError {
  file: string; // data.json or exercises.json
  emptyFallback: boolean; // never loaded since the start: the empty config is live, not the last valid one
}

/**
 * One cached, validated JSON config file. The cached value is deep-frozen:
 * callers that want to edit it take a copy via `raw()` and `save()` it.
 */
export class ConfigFile<T> {
  private value: T;
  private liveText: string | null = null;
  /** A valid version was read (or saved) since the start: `value` is the file's, not the fallback. */
  private loaded = false;
  error: ValidationError | null = null;

  constructor(
    readonly file: string,
    private readonly schema: typeof dataSchema,
    private readonly fallback: T
  ) {
    this.value = deepFreeze(structuredClone(fallback));
  }

  get(): T {
    return this.value;
  }

  /** The live version: it changes whenever the live text does (a save, a valid reload from disk). */
  version(): string {
    return versionOf(this.liveText);
  }

  /** The live value and its version, read together, so they always belong to each other. */
  current(): { value: T; version: string } {
    return { value: this.value, version: this.version() };
  }

  /** A mutable deep copy of the cached value. */
  raw(): T {
    return structuredClone(this.value);
  }

  /** The current problem with the file, or null. */
  problem(): ConfigProblem | null {
    return this.error && { ...this.error, file: path.basename(this.file), emptyFallback: !this.loaded };
  }

  /** The file's text as it is on disk now (to fix a file that doesn't parse), or null when missing. */
  text(): string | null {
    try {
      return readFileSync(this.file, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Re-read the file. Returns 'unchanged', 'updated', or 'invalid' (the
   * cached value is kept and `error` explains why).
   */
  reload(): 'unchanged' | 'updated' | 'invalid' {
    let text: string;
    try {
      text = readFileSync(this.file, 'utf-8');
    } catch (err) {
      this.error = { message: `Cannot read ${path.basename(this.file)}: ${(err as Error).message}`, errors: [] };
      return 'invalid';
    }
    if (text === this.liveText) {
      // Back to the live version after a broken edit: the error is resolved.
      if (!this.error) return 'unchanged';
      this.error = null;
      return 'updated';
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      this.error = { message: `${path.basename(this.file)} is not valid JSON: ${(err as Error).message}`, errors: [] };
      return 'invalid';
    }
    const error = check(this.schema, parsed, `${path.basename(this.file)} failed schema validation`);
    if (error) {
      this.error = error;
      return 'invalid';
    }
    this.liveText = text;
    this.value = deepFreeze(parsed as T);
    this.loaded = true;
    this.error = null;
    return 'updated';
  }

  /**
   * Validate and atomically write a new version, then make it live. Refused
   * (nothing written) while the file on disk is invalid, unless `replace`
   * asks to replace it; and never with the empty fallback over a file that
   * was never loaded, nor over a live config that has content. A replaced
   * invalid file is kept as <file>.invalid-<stamp>. When `version` is given
   * and the live version has moved past it, refused as a conflict.
   */
  save(value: unknown, { replace = false, version }: { replace?: boolean; version?: string } = {}): SaveRefusal | null {
    const name = path.basename(this.file);
    const error = check(this.schema, value, `${name} failed schema validation`);
    if (error) return error;
    if (version !== undefined && version !== this.version()) {
      return { ...refusal(`Το ${name} άλλαξε στο μεταξύ (από άλλη οθόνη ή στον δίσκο). Φόρτωσε ξανά και κάνε την αλλαγή σου πάλι.`), conflict: true };
    }
    if (!this.loaded && (!replace || isDeepStrictEqual(value, this.fallback))) {
      return refusal(`${name} was never loaded (it was missing or could not be read at startup), so saving would replace it ` +
        `with ${replace ? 'the empty config' : 'what is live, the empty config'}. Fix the file itself ` +
        `(Γονείς → Προχωρημένα shows its text) or restore it from a backup.`);
    }
    if (isDeepStrictEqual(value, this.fallback) && !isDeepStrictEqual(this.value, this.fallback)) {
      // What a screen holds before its first state arrives: never the family's config wiped by one tap
      return refusal(`Refused: this would replace ${name} with the empty config, which has nothing in it. ` +
        `A screen that saved before it had loaded the config sends exactly that; reload the page and try again.`);
    }
    if (this.error && !replace) {
      return refusal(`${name} on disk is not valid, so saving is off: it would replace the file being fixed. ` +
        `Fix the file, or replace it from Γονείς → Προχωρημένα. (${this.error.message})`);
    }
    if (this.error && existsSync(this.file)) {
      // Keep the invalid file beside, so a replace never loses what was in it
      copyFileSync(this.file, `${this.file}.invalid-${localStamp(new Date())}`);
    }
    const text = JSON.stringify(value, null, 2);
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, text);
    renameSync(tmp, this.file);
    this.liveText = text;
    this.value = deepFreeze(structuredClone(value as T));
    this.loaded = true;
    this.error = null;
    return null;
  }
}

/** The top-level keys whose values differ between two versions of a config file, for the action log. */
export function changedKeys(before: object, after: object): string[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return keys.filter(k => !isDeepStrictEqual((before as Record<string, unknown>)[k], (after as Record<string, unknown>)[k]));
}

// Both files are required: a missing one is an error the parents see, never a silent empty config.
export const dataConfig = new ConfigFile<DataConfig>(DATA_FILE, dataSchema, EMPTY_DATA);
export const exercisesConfig = new ConfigFile<ExercisesConfig>(EXERCISES_FILE, exercisesSchema, EMPTY_EXERCISES);

const EXAMPLES = [
  { file: DATA_FILE, example: DATA_EXAMPLE_FILE },
  { file: EXERCISES_FILE, example: EXERCISES_EXAMPLE_FILE }
];

/**
 * First start: create each missing config file from its example, but only on a database with
 * no history. A live install that lost its file (history, no data.json) gets nothing: running
 * the family on the example would hide it, so the file stays missing and the parents see the
 * error until it is restored. Never overwrites a file. The new file belongs to its directory's
 * owner (the backend runs as root in the image; the host's files stay the host user's).
 */
export function seedConfig(hasHistory: boolean, files = EXAMPLES): { seeded: string[]; missing: string[] } {
  const seeded: string[] = [], missing: string[] = [];
  for (const { file, example } of files) {
    if (existsSync(file)) continue;
    if (hasHistory) {
      missing.push(file);
      continue;
    }
    try {
      copyFileSync(example, file, constants.COPYFILE_EXCL);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') continue;
      throw err;
    }
    try {
      const dir = statSync(path.dirname(file));
      chownSync(file, dir.uid, dir.gid);
    } catch {
      // not root: the file is already ours
    }
    seeded.push(file);
  }
  return { seeded, missing };
}

/** The live data.json config. */
export function config(): DataConfig {
  return dataConfig.get();
}

/** The live exercises.json config. */
export function exercisesFile(): ExercisesConfig {
  return exercisesConfig.get();
}

/** Current config problem, if any: the app runs on the last valid config, or on the empty one if none was ever loaded. */
export function configError(): ConfigProblem | null {
  return dataConfig.problem() ?? exercisesConfig.problem();
}

export type ConfigChange = { type: 'updated' } | { type: 'invalid'; error: ValidationError };

/** Reload both files; reports whether anything changed or failed. */
export function reloadConfig(): ConfigChange | null {
  const results = [dataConfig.reload(), exercisesConfig.reload()];
  const error = configError();
  if (results.includes('invalid') && error) return { type: 'invalid', error };
  if (results.includes('updated')) return { type: 'updated' };
  return null;
}

const WATCH_INTERVAL_MS = 2000;

/**
 * Watch both files for edits on disk. Uses stat polling on just these two
 * paths: cheap, survives editors that replace files, and works on bind mounts.
 */
export function watchConfig(onChange: (change: ConfigChange) => void): () => void {
  const files = [dataConfig.file, exercisesConfig.file];
  const listener = () => {
    const change = reloadConfig();
    if (change) onChange(change);
  };
  files.forEach(file => watchFile(file, { interval: WATCH_INTERVAL_MS }, listener));
  return () => files.forEach(file => unwatchFile(file, listener));
}
