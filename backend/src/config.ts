import { copyFileSync, existsSync, readFileSync, renameSync, unwatchFile, watchFile, writeFileSync } from 'fs';
import path from 'path';
import { isDeepStrictEqual } from 'util';
import { DataConfig, Exercise, ExerciseCategoryDef } from '../../shared/types';
import { DATA_FILE, EXERCISES_FILE } from './paths';
import { check, dataSchema, exercisesSchema, ValidationError } from './schemas';

// ============================================================================
// Config (data.json + exercises.json), cached in memory.
//
// Files are read at startup, after an edit through the admin API/MCP, and when
// they change on disk — never per request. An invalid file on disk never
// replaces the cached config: the last valid version stays live and the error
// is reported, so a bad edit can't take the app (or its state) down.
//
// Saving never writes over a file the server couldn't load (issue #45). While
// the file on disk is invalid, save() refuses, so no read-modify-write editor
// (the forms, MCP) can put the live copy over the file being fixed. The one
// override is `replace`, sent only by the Advanced JSON editor: it replaces the
// invalid file deliberately, keeping it beside as <file>.invalid-<stamp>. Even
// then the empty fallback (live when the file was unreadable at startup) is
// never written: there the editor shows the file's own text to fix instead.
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
    private readonly fallback: T,
    private readonly optional: boolean
  ) {
    this.value = deepFreeze(structuredClone(fallback));
  }

  get(): T {
    return this.value;
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
      if (this.optional && (err as NodeJS.ErrnoException).code === 'ENOENT') {
        text = JSON.stringify(this.fallback);
      } else {
        this.error = { message: `Cannot read ${path.basename(this.file)}: ${(err as Error).message}`, errors: [] };
        return 'invalid';
      }
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
   * invalid file is kept as <file>.invalid-<stamp>.
   */
  save(value: unknown, { replace = false }: { replace?: boolean } = {}): ValidationError | null {
    const name = path.basename(this.file);
    const error = check(this.schema, value, `${name} failed schema validation`);
    if (error) return error;
    if (!this.loaded && (!replace || isDeepStrictEqual(value, this.fallback))) {
      return refusal(`${name} was never loaded (it could not be read at startup), so saving would replace it ` +
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

export const dataConfig = new ConfigFile<DataConfig>(DATA_FILE, dataSchema, EMPTY_DATA, false);
export const exercisesConfig = new ConfigFile<ExercisesConfig>(EXERCISES_FILE, exercisesSchema, EMPTY_EXERCISES, true);

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
